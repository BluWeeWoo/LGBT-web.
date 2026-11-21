<?php
declare(strict_types=1);

function migrationStatements(string $file): array {
    $sql = file_get_contents(__DIR__ . '/migrations/' . $file);
    if ($sql === false) throw new RuntimeException('Missing database migration.');
    $sql = preg_replace('/^--[^\r\n]*(?:\r?\n|$)/m', '', $sql);
    return array_values(array_filter(array_map('trim', explode(';', $sql))));
}

function hasColumn(PDO $db, string $table, string $column): bool {
    return (bool)runQuery($db, 'SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [$table, $column])->fetchColumn();
}

function migrateDatabase(PDO $db): void {
    $lock = 'rye_' . substr(hash('sha256', $db->query('SELECT DATABASE()')->fetchColumn()), 0, 32);
    if ((int)runQuery($db, 'SELECT GET_LOCK(?, 10)', [$lock])->fetchColumn() !== 1) {
        throw new RuntimeException('Another database migration is running.');
    }
    try {
        foreach (migrationStatements('001_initial.sql') as $sql) $db->exec($sql);
        foreach (migrationStatements('004_connections.sql') as $sql) $db->exec($sql);
        if (!hasColumn($db, 'story_photos', 'jpeg')) return;
        foreach (migrationStatements('002_legacy_photo_metadata.sql') as $sql) {
            preg_match('/^ALTER TABLE (\w+) ADD COLUMN (\w+)/', $sql, $parts);
            if (!hasColumn($db, $parts[1], $parts[2])) $db->exec($sql);
        }
        // Run with the site offline. One story at a time keeps binary memory use bounded.
        $after = '';
        do {
            $ids = runQuery($db, 'SELECT DISTINCT story_id FROM story_photos WHERE story_id > ?
                ORDER BY story_id LIMIT 100', [$after])->fetchAll(PDO::FETCH_COLUMN);
            foreach ($ids as $id) {
                $id = checkedId($id);
                $db->beginTransaction();
                $story = runQuery($db, 'SELECT photo_album FROM stories WHERE id = ? FOR UPDATE', [$id])->fetch();
                $album = $story['photo_album'] ?? $id;
                foreach (runQuery($db, 'SELECT slot, jpeg, portrait_jpeg FROM story_photos
                    WHERE story_id = ? ORDER BY slot', [$id]) as $row) {
                    $name = (string)$row['slot'];
                    if (!in_array($name, ['0', '1', '2'], true) ||
                        ($name !== '0' && $row['portrait_jpeg'] !== null)) {
                        throw new RuntimeException('Unexpected photo slot in the old database.');
                    }
                    writePhotoFile($album, $name, $row['jpeg']);
                    $printed = $row['portrait_jpeg'] !== null;
                    if ($printed) writePhotoFile($album, 'portrait', $row['portrait_jpeg']);
                    runQuery($db, 'UPDATE story_photos SET has_portrait_print = ? WHERE story_id = ? AND slot = ?',
                        [(int)$printed, $id, $name]);
                }
                runQuery($db, 'UPDATE stories SET photo_album = ? WHERE id = ?', [$album, $id]);
                $db->commit();
                $after = $id;
            }
        } while (count($ids) === 100);
        foreach (migrationStatements('003_legacy_remove_photo_blobs.sql') as $sql) $db->exec($sql);
    } finally {
        if ($db->inTransaction()) $db->rollBack();
        runQuery($db, 'SELECT RELEASE_LOCK(?)', [$lock]);
    }
}
