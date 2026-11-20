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
    $where = ['status = ?', 'removing = 0'];
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
        $date = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s.v\Z', $cursor[0]);
        if (count($cursor) !== 2 || !$date || $date->format('Y-m-d\TH:i:s.v\Z') !== $cursor[0]) {
            throw new RyeInputError(400, 'Invalid page.');
        }
        $op = $ascending ? '>' : '<';
        $where[] = "(created_at $op ? OR (created_at = ? AND id $op ?))";
        $stamp = $date->format('Y-m-d H:i:s.v');
        array_push($args, $stamp, $stamp, checkedId($cursor[1]));
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
        foreach (runQuery($db, "SELECT story_id, slot, description, has_portrait_print
            FROM story_photos WHERE story_id IN ($params) ORDER BY story_id, slot", $ids) as $photo) {
            $photos[$photo['story_id']][] = $photo;
        }
    }
    $cursor = null;
    $stories = [];
    foreach ($rows as $row) {
        $album = $photos[$row['id']] ?? [];
        $row['usePhotoAsPortrait'] = (bool)$row['use_photo_as_portrait'];
        $row['photos'] = array_map(static function (array $photo) use ($row): array {
            $base = '/api/stories/photo?id=' . $row['id'] . '&index=';
            $media = ['description' => $photo['description'], 'src' => $base . $photo['slot']];
            if ($row['usePhotoAsPortrait'] && $photo['has_portrait_print'] && (int)$photo['slot'] === 0) {
                $media['portraitSrc'] = $base . 'portrait';
            }
            return $media;
        }, $album);
        $row['mine'] = $row['author'] === ($user['id'] ?? null);
        $row['sample'] = false;
        $first = preg_split('/\n+/', trim($row['body']), 2)[0];
        $row['quote'] = mb_strlen($first) <= 145 ? $first :
            preg_replace('/\s+\S*$/u', '', mb_substr($first, 0, 142)) . '…';
        unset($row['author'], $row['use_photo_as_portrait']);
        $row['createdAt'] = str_replace(' ', 'T', $row['createdAt']) . 'Z';
        if ($row['reviewedAt'] !== null) $row['reviewedAt'] = str_replace(' ', 'T', $row['reviewedAt']) . 'Z';
        if ($more) $cursor = $row['createdAt'] . '|' . $row['id'];
        if (!$review) unset($row['status'], $row['createdAt'], $row['reviewedAt']);
        $stories[] = $row;
    }
    if ($single) return ['story' => $stories[0]];
    $page = ['stories' => $stories, 'cursor' => $cursor];
    if ($review) {
        $counts = ['pending' => 0, 'approved' => 0, 'declined' => 0];
        foreach (runQuery($db, 'SELECT status, COUNT(*) AS total FROM stories WHERE removing = 0 GROUP BY status') as $row) {
            $counts[$row['status']] = (int)$row['total'];
        }
        $page['counts'] = $counts;
    } else {
        $page['signedIn'] = $user !== null;
    }
    return $page;
}

function photoBytes($source, int $limit): string {
    $prefix = 'data:image/jpeg;base64,';
    if (!is_string($source) || !str_starts_with($source, $prefix)) throw new RyeInputError(400, 'Choose a JPEG photo.');
    $bytes = base64_decode(substr($source, strlen($prefix)), true);
    if ($bytes === false || strlen($bytes) < 12 || strlen($bytes) > $limit ||
        !str_starts_with($bytes, "\xff\xd8\xff") || !str_ends_with($bytes, "\xff\xd9") ||
        (@getimagesizefromstring($bytes)[2] ?? null) !== IMAGETYPE_JPEG) {
        throw new RyeInputError(400, 'Choose the photo again.');
    }
    return $bytes;
}

function submitStory(PDO $db, ?array $user, array $input): array {
    $owner = requireUser($user)['id'];
    $id = checkedId($input['id'] ?? null);
    if (($input['consent'] ?? false) !== true) throw new RyeInputError(400, 'Preview your story and confirm submission.');
    foreach (['name' => 55, 'place' => 65, 'title' => 100, 'body' => 6000] as $key => $limit) {
        if (!is_string($input[$key] ?? null) || mb_strlen(trim($input[$key])) > $limit) {
            throw new RyeInputError(400, 'Please check the story fields.');
        }
        $input[$key] = trim($input[$key]);
    }
    if ($input['title'] === '' || mb_strlen($input['body']) < 20 ||
        !in_array($input['flag'] ?? null, ['rye', 'lesbian', 'rainbow', 'trans', 'nonbinary', 'bi', 'pan', 'ace'], true) ||
        !in_array($input['topic'] ?? null, ['Belonging', 'Identity', 'Speaking up', 'Joy'], true)) {
        throw new RyeInputError(400, 'Add a title, a story of at least 20 characters, and a valid theme.');
    }
    $photos = $input['photos'] ?? [];
    if (!is_array($photos) || !array_is_list($photos) || count($photos) > 3) {
        throw new RyeInputError(400, 'Choose up to 3 story photos.');
    }
    $portrait = ($input['usePhotoAsPortrait'] ?? false) === true && $photos !== [];
    foreach ($photos as $slot => &$photo) {
        if (!is_array($photo) || !is_string($photo['description'] ?? null) || mb_strlen($photo['description']) > 180) {
            throw new RyeInputError(400, 'Shorten the photo description and try again.');
        }
        if (array_key_exists('portraitSrc', $photo) && (!$portrait || $slot !== 0)) {
            throw new RyeInputError(400, 'Select the first photo as your atlas portrait to include its print.');
        }
        $photo = [
            'description' => trim($photo['description']),
            'jpeg' => photoBytes($photo['src'] ?? null, 786432),
            'portrait' => array_key_exists('portraitSrc', $photo) ? photoBytes($photo['portraitSrc'], 262144) : null,
        ];
    }
    unset($photo);
    $album = $photos ? ryeUuid() : null;
    $db->beginTransaction();
    try {
        runQuery($db, 'INSERT INTO stories (id, author_id, name, place, title, body, flag, topic, use_photo_as_portrait, photo_album)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [$id, $owner, $input['name'] === '' ? 'Anonymous' : $input['name'],
            $input['place'], $input['title'], $input['body'], $input['flag'], $input['topic'], (int)$portrait, $album]);
    } catch (PDOException $e) {
        if (($e->errorInfo[1] ?? 0) != 1062) throw $e;
        $db->rollBack();
        $existing = runQuery($db, 'SELECT id, status FROM stories WHERE id = ? AND author_id = ? AND removing = 0', [$id, $owner])->fetch();
        if (!$existing) throw new RyeInputError(409, 'Please reopen the form to submit.');
        return $existing;
    }
    try {
        foreach ($photos as $slot => $photo) {
            writePhotoFile($album, (string)$slot, $photo['jpeg']);
            if ($photo['portrait'] !== null) writePhotoFile($album, 'portrait', $photo['portrait']);
            runQuery($db, 'INSERT INTO story_photos (story_id, slot, description, has_portrait_print) VALUES (?, ?, ?, ?)',
                [$id, $slot, $photo['description'], (int)($photo['portrait'] !== null)]);
        }
    } catch (Throwable $error) {
        $db->rollBack();
        removePhotoFiles($album);
        throw $error;
    }
    // Keep the album if the commit outcome is unknown. A retried submission resolves by story ID.
    $db->commit();
    return ['id' => $id, 'status' => 'pending', 'created' => true];
}

function reviewStory(PDO $db, ?array $user, array $data): array {
    requireReviewer($user);
    $id = checkedId($data['id'] ?? null);
    $status = $data['status'] ?? '';
    if (!in_array($status, ['approved', 'declined'], true)) throw new RyeInputError(400, 'Choose a review decision.');
    $updated = runQuery($db, "UPDATE stories SET status = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(3)
        WHERE id = ? AND status = 'pending' AND removing = 0", [$status, $user['id'], $id]);
    if (!$updated->rowCount()) {
        $current = runQuery($db, 'SELECT status FROM stories WHERE id = ? AND removing = 0', [$id])->fetchColumn();
        if ($current === false) throw new RyeInputError(404, 'This submission is no longer available.');
        if ($current !== $status) throw new RyeInputError(409, 'Another reviewer already decided this story. Refresh the queue.');
    }
    return ['status' => $status];
}

function deleteStory(PDO $db, ?array $user, array $data): array {
    $owner = requireUser($user)['id'];
    $id = checkedId($data['id'] ?? null);
    // Hide the story before touching files. Retain its album so deletion can resume after an I/O failure.
    runQuery($db, 'UPDATE stories SET removing = 1 WHERE id = ? AND author_id = ?', [$id, $owner]);
    $db->beginTransaction();
    $row = runQuery($db, 'SELECT photo_album FROM stories WHERE id = ? AND author_id = ? AND removing = 1 FOR UPDATE',
        [$id, $owner])->fetch();
    if (!$row) throw new RyeInputError(404, 'This story could not be found.');
    removePhotoFiles($row['photo_album']);
    runQuery($db, 'DELETE FROM stories WHERE id = ?', [$id]);
    $db->commit();
    return ['removed' => true];
}

function getPhoto(PDO $db, ?array $user, array $data) {
    $id = checkedId($data['id'] ?? null);
    $slot = (string)($data['index'] ?? '');
    $portrait = $slot === 'portrait';
    if (!$portrait && !in_array($slot, ['0', '1', '2'], true)) throw new RyeInputError(404, 'Photo unavailable.');
    $condition = ($user['role'] ?? '') === 'admin' ? '' : " AND s.status = 'approved'";
    if ($portrait) $condition .= ' AND s.use_photo_as_portrait = 1 AND p.has_portrait_print = 1';
    $album = runQuery($db, "SELECT s.photo_album FROM story_photos p JOIN stories s ON s.id = p.story_id
        WHERE s.id = ? AND p.slot = ? AND s.removing = 0 $condition", [$id, $portrait ? 0 : (int)$slot])->fetchColumn();
    $file = is_string($album) ? @fopen(photoFile($album, $slot), 'rb') : false;
    if (!$file) throw new RyeInputError(404, 'Photo unavailable.');
    return $file;
}
