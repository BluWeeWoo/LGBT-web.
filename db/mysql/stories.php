<?php
declare(strict_types=1);

function checkedId($value): string {
    if (!is_string($value) || !preg_match('/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/iD', $value)) {
        throw new RyeInputError(404, 'This story could not be found.');
    }
    return strtolower($value);
}

function storyPage(PDO $db, ?array $user, array $input, bool $review): array {
    $args = [];
    $where = ['status = ?'];
    $status = 'approved';
    if ($review) {
        requireReviewer($user);
        $status = $input['status'] ?? 'pending';
        if (!in_array($status, ['pending', 'approved', 'declined'], true)) throw new RyeInputError(400, 'Invalid queue.');
    }
    $args[] = $status;
    $single = !$review && isset($input['id']);
    if ($single) {
        $where[] = 'id = ?';
        $args[] = checkedId($input['id']);
    }
    if ($review && ($input['query'] ?? '') !== '') {
        $where[] = '(LOCATE(?, title) > 0 OR LOCATE(?, name) > 0)';
        $search = mb_substr($input['query'], 0, 100);
        array_push($args, $search, $search);
    }
    $ascending = $review && $status === 'pending';
    if (!$single && !empty($input['cursor'])) {
        $cursor = explode('|', $input['cursor']);
        if (count($cursor) !== 2 || !preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/D', $cursor[0])) {
            throw new RyeInputError(400, 'Invalid page.');
        }
        $op = $ascending ? '>' : '<';
        $where[] = "(created_at $op ? OR (created_at = ? AND id $op ?))";
        $date = str_replace(['T', 'Z'], [' ', ''], $cursor[0]);
        array_push($args, $date, $date, checkedId($cursor[1]));
    }
    $direction = $ascending ? 'ASC' : 'DESC';
    $size = $review ? 20 : 24;
    $rows = runQuery($db, 'SELECT id, author_id AS author, name, place, title, body, flag, topic, status,
        created_at AS createdAt, reviewed_at AS reviewedAt, use_photo_as_portrait
        FROM stories WHERE ' . implode(' AND ', $where) . " ORDER BY created_at $direction, id $direction LIMIT " .
        ($single ? 1 : $size + 1), $args)->fetchAll();
    if ($single && !$rows) throw new RyeInputError(404, 'This story is no longer available.');
    $more = count($rows) > $size;
    if ($more) array_pop($rows);
    $photos = [];
    if ($rows) {
        $ids = array_column($rows, 'id');
        $params = implode(',', array_fill(0, count($ids), '?'));
        foreach (runQuery($db, "SELECT story_id, slot, description, portrait_jpeg IS NOT NULL AS printed
            FROM story_photos WHERE story_id IN ($params) ORDER BY story_id, slot", $ids) as $photo) {
            $photos[$photo['story_id']][] = $photo;
        }
    }
    $cursor = null;
    foreach ($rows as &$row) {
        $album = $photos[$row['id']] ?? [];
        $row['media'] = $album ? ['descriptions' => array_column($album, 'description'),
            'usePhotoAsPortrait' => (bool)$row['use_photo_as_portrait'], 'hasPortraitPrint' => (bool)$album[0]['printed']] : null;
        unset($row['use_photo_as_portrait']);
        $row['createdAt'] = str_replace(' ', 'T', $row['createdAt']) . 'Z';
        if ($row['reviewedAt'] !== null) $row['reviewedAt'] = str_replace(' ', 'T', $row['reviewedAt']) . 'Z';
        if ($more) $cursor = $row['createdAt'] . '|' . $row['id'];
    }
    unset($row);
    $page = ['records' => $rows, 'viewer' => $user['id'] ?? null, 'cursor' => $cursor];
    if ($review) {
        $counts = ['pending' => 0, 'approved' => 0, 'declined' => 0];
        foreach (runQuery($db, 'SELECT status, COUNT(*) AS total FROM stories GROUP BY status') as $row) {
            $counts[$row['status']] = (int)$row['total'];
        }
        $page['counts'] = $counts;
    }
    return $page;
}

function photoBytes($source, int $limit): string {
    $prefix = 'data:image/jpeg;base64,';
    if (!is_string($source) || !str_starts_with($source, $prefix)) throw new RyeInputError(400, 'Choose a JPEG photo.');
    $bytes = base64_decode(substr($source, strlen($prefix)), true);
    if ($bytes === false || strlen($bytes) < 12 || strlen($bytes) > $limit ||
        !str_starts_with($bytes, "\xff\xd8\xff") || !str_ends_with($bytes, "\xff\xd9")) {
        throw new RyeInputError(400, 'Choose the photo again.');
    }
    return $bytes;
}

function submitStory(PDO $db, ?array $user, array $input): array {
    $owner = requireUser($user)['id'];
    $id = checkedId($input['id'] ?? null);
    // The website validates text, theme, consent and photo limits before forwarding the submission.
    $photos = $input['photos'] ?? [];
    $portrait = ($input['usePhotoAsPortrait'] ?? false) === true && count($photos) > 0;
    $db->beginTransaction();
    try {
        runQuery($db, 'INSERT INTO stories (id, author_id, name, place, title, body, flag, topic, use_photo_as_portrait)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [$id, $owner, $input['name'] === '' ? 'Anonymous' : $input['name'],
            $input['place'], $input['title'], $input['body'], $input['flag'], $input['topic'], (int)$portrait]);
    } catch (PDOException $e) {
        if (($e->errorInfo[1] ?? 0) != 1062) throw $e;
        $db->rollBack();
        $existing = runQuery($db, 'SELECT id, status FROM stories WHERE id = ? AND author_id = ?', [$id, $owner])->fetch();
        if (!$existing) throw new RyeInputError(409, 'Please reopen the form to submit.');
        return $existing;
    }
    foreach ($photos as $slot => $photo) {
        $print = $portrait && $slot === 0 && isset($photo['portraitSrc']) ? photoBytes($photo['portraitSrc'], 262144) : null;
        runQuery($db, 'INSERT INTO story_photos (story_id, slot, description, jpeg, portrait_jpeg) VALUES (?, ?, ?, ?, ?)',
            [$id, $slot, trim($photo['description']), photoBytes($photo['src'], 786432), $print]);
    }
    $db->commit();
    return ['id' => $id, 'status' => 'pending', 'created' => true];
}

function reviewStory(PDO $db, ?array $user, array $data): array {
    requireReviewer($user);
    $id = checkedId($data['id'] ?? null);
    $status = $data['status'] ?? '';
    if (!in_array($status, ['approved', 'declined'], true)) throw new RyeInputError(400, 'Choose a review decision.');
    $updated = runQuery($db, "UPDATE stories SET status = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(3)
        WHERE id = ? AND status = 'pending'", [$status, $user['id'], $id]);
    if (!$updated->rowCount()) {
        $current = runQuery($db, 'SELECT status FROM stories WHERE id = ?', [$id])->fetchColumn();
        if ($current === false) throw new RyeInputError(404, 'This submission is no longer available.');
        if ($current !== $status) throw new RyeInputError(409, 'Another reviewer already decided this story. Refresh the queue.');
    }
    return ['status' => $status];
}

function getPhoto(PDO $db, ?array $user, array $data): string {
    $id = checkedId($data['id'] ?? null);
    $slot = (string)($data['index'] ?? '');
    $portrait = $slot === 'portrait';
    if (!$portrait && !in_array($slot, ['0', '1', '2'], true)) throw new RyeInputError(404, 'Photo unavailable.');
    $column = $portrait ? 'p.portrait_jpeg' : 'p.jpeg';
    $condition = ($user['role'] ?? '') === 'admin' ? '' : " AND s.status = 'approved'";
    if ($portrait) $condition .= ' AND s.use_photo_as_portrait = 1';
    $bytes = runQuery($db, "SELECT $column FROM story_photos p JOIN stories s ON s.id = p.story_id
        WHERE s.id = ? AND p.slot = ? $condition", [$id, $portrait ? 0 : (int)$slot])->fetchColumn();
    if (!is_string($bytes)) throw new RyeInputError(404, 'Photo unavailable.');
    return $bytes;
}
