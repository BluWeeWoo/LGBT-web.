<?php
declare(strict_types=1);

function chatId($value): string {
    if (!is_string($value) || !preg_match('/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/iD', $value)) {
        throw new RyeInputError(404, 'This connection is unavailable.');
    }
    return strtolower($value);
}

function chatRows(PDO $db, string $user, ?string $id = null): array {
    $filter = $id === null ? 'ORDER BY c.updated_at DESC, c.id DESC' : 'AND c.id = ?';
    $args = $id === null ? [$user, $user] : [$user, $user, $id];
    return runQuery($db, "SELECT c.id, c.requester_id, c.requester_name, c.recipient_name, c.status,
        s.id AS story_id, s.title, s.place, s.flag, s.name AS story_name, LEFT(s.body, 146) AS excerpt,
        p.has_portrait_print AS portrait
        FROM chat_connections c
        LEFT JOIN stories s ON s.id = c.story_id AND s.status = 'approved' AND s.removing = 0
        LEFT JOIN story_photos p ON p.story_id = s.id AND p.slot = 0 AND s.use_photo_as_portrait = 1
        WHERE (c.requester_id = ? OR c.recipient_id = ?)
            AND c.status IN ('pending', 'accepted', 'ended') $filter", $args)->fetchAll();
}

function chatSummary(array $row, string $user): array {
    $outgoing = $row['requester_id'] === $user;
    $portrait = $row['portrait'] === null ? null :
        '/api/stories/photo?id=' . $row['story_id'] . '&index=' . ($row['portrait'] ? 'portrait' : '0');
    $excerpt = trim(explode("\n", $row['excerpt'] ?? '', 2)[0]);
    return [
        'id' => $row['id'], 'status' => $row['status'], 'outgoing' => $outgoing,
        'name' => $outgoing ? $row['recipient_name'] : $row['requester_name'],
        'portrait' => $outgoing ? $portrait : null,
        'story' => $row['story_id'] === null ? null : [
            'id' => $row['story_id'], 'title' => $row['title'], 'flag' => $row['flag'],
            'place' => $row['place'], 'name' => $row['story_name'], 'portrait' => $portrait,
            'excerpt' => mb_strlen($excerpt) > 145 ? mb_substr($excerpt, 0, 145) . '…' : $excerpt,
        ],
    ];
}

function chatInbox(PDO $db, string $user): array {
    $allowed = runQuery($db, 'SELECT accepts_requests FROM chat_preferences WHERE user_id = ?', [$user])->fetchColumn();
    return ['acceptsRequests' => (bool)$allowed, 'connections' => array_map(
        static fn(array $row) => chatSummary($row, $user), chatRows($db, $user))];
}

function chatMessage(array $row, string $user): array {
    return [
        'id' => (string)$row['id'], 'text' => $row['body'], 'mine' => $row['sender_id'] === $user,
        'createdAt' => str_replace(' ', 'T', $row['created_at']) . 'Z',
    ];
}

function chatThread(PDO $db, string $user, string $id, ?string $before, ?string $after): array {
    $cursor = $before ?? $after;
    if (($before !== null && $after !== null) ||
        ($cursor !== null && !preg_match('/^(0|[1-9]\d{0,19})$/D', $cursor))) {
        throw new RyeInputError(400, 'Invalid message page.');
    }
    $db->beginTransaction();
    $row = chatRows($db, $user, $id)[0] ?? null;
    if (!$row) throw new RyeInputError(404, 'This connection is unavailable.');
    $messages = [];
    if ($row['status'] !== 'pending') {
        $filters = ['m.connection_id = ?', "(c.requester_id = ? OR c.recipient_id = ?)",
            "c.status IN ('accepted', 'ended')"];
        $args = [$id, $user, $user];
        if ($cursor !== null) {
            $filters[] = $before !== null ? 'm.id < CAST(? AS UNSIGNED)' : 'm.id > CAST(? AS UNSIGNED)';
            $args[] = $cursor;
        }
        $direction = $after === null ? 'DESC' : 'ASC';
        $messages = runQuery($db, 'SELECT m.id, m.sender_id, m.body, m.created_at FROM chat_messages m
            JOIN chat_connections c ON c.id = m.connection_id
            WHERE ' . implode(' AND ', $filters) . " ORDER BY m.id $direction LIMIT 51", $args)->fetchAll();
    }
    $db->commit();
    $more = count($messages) > 50;
    if ($more) array_pop($messages);
    if ($after === null) $messages = array_reverse($messages);
    return ['connection' => chatSummary($row, $user), 'messages' => array_map(
        static fn(array $message) => chatMessage($message, $user), $messages), 'hasMore' => $more];
}

function requestConnection(PDO $db, string $user, array $data): array {
    $story = checkedId($data['story'] ?? null);
    rateLimit($db, 'chat/request/' . $user, 15);
    $db->beginTransaction();
    $author = runQuery($db, "SELECT s.author_id, s.name FROM stories s
        JOIN chat_preferences p ON p.user_id = s.author_id AND p.accepts_requests = 1
        WHERE s.id = ? AND s.status = 'approved' AND s.removing = 0 FOR UPDATE", [$story])->fetch();
    if (!$author || $author['author_id'] === $user) throw new RyeInputError(409, 'This story isn’t taking connection requests.');
    $recipient = $author['author_id'];
    $name = runQuery($db, 'SELECT display_name FROM users WHERE id = ?', [$user])->fetchColumn();
    $pair = [$user, $recipient];
    sort($pair, SORT_STRING);
    $id = ryeUuid();
    runQuery($db, 'INSERT INTO chat_connections (id, pair_low, pair_high, requester_id, recipient_id, story_id,
        requester_name, recipient_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id = id', [$id, ...$pair, $user, $recipient, $story, $name, $author['name']]);
    $existing = runQuery($db, 'SELECT id, status, recipient_id FROM chat_connections WHERE pair_low = ? AND pair_high = ? FOR UPDATE',
        $pair)->fetch();
    if ($existing['status'] === 'withdrawn' ||
        ($existing['status'] === 'declined' && $existing['recipient_id'] === $user)) {
        runQuery($db, "UPDATE chat_connections SET requester_id = ?, recipient_id = ?, story_id = ?,
            requester_name = ?, recipient_name = ?, status = 'pending', updated_at = UTC_TIMESTAMP(3) WHERE id = ?",
            [$user, $recipient, $story, $name, $author['name'], $existing['id']]);
    } elseif (!in_array($existing['status'], ['pending', 'accepted'], true)) {
        throw new RyeInputError(409, 'A new connection request isn’t available for this story.');
    }
    $db->commit();
    return ['id' => $existing['id']];
}

function lockedChat(PDO $db, string $user, string $id): array {
    $row = runQuery($db, "SELECT requester_id, recipient_id, status FROM chat_connections
        WHERE id = ? AND (requester_id = ? OR recipient_id = ?)
            AND status IN ('pending', 'accepted', 'ended') FOR UPDATE", [$id, $user, $user])->fetch();
    if (!$row) throw new RyeInputError(404, 'This connection is unavailable.');
    return $row;
}

function updateConnection(PDO $db, string $user, array $data): array {
    $action = $data['action'] ?? null;
    if ($action === 'preferences') {
        $allowed = $data['acceptsRequests'] ?? null;
        if (!is_bool($allowed)) throw new RyeInputError(400, 'Choose whether to receive requests.');
        runQuery($db, 'INSERT INTO chat_preferences (user_id, accepts_requests) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE accepts_requests = VALUES(accepts_requests)', [$user, (int)$allowed]);
        return ['acceptsRequests' => $allowed];
    }
    $id = chatId($data['id'] ?? null);
    $db->beginTransaction();
    $row = lockedChat($db, $user, $id);
    $pending = $row['status'] === 'pending';
    $incoming = $row['recipient_id'] === $user;
    $next = match ($action) {
        'accept' => $pending && $incoming ? 'accepted' : null,
        'decline' => $pending && $incoming ? 'declined' : null,
        'withdraw' => $pending && !$incoming ? 'withdrawn' : null,
        'end' => $row['status'] === 'accepted' ? 'ended' : null,
        'block' => 'blocked',
        default => null,
    };
    if (!$next) throw new RyeInputError(409, 'This connection has changed. Open it again to see its current status.');
    runQuery($db, 'UPDATE chat_connections SET status = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [$next, $id]);
    $db->commit();
    return ['status' => $next];
}

function sendChatMessage(PDO $db, string $user, array $data): array {
    $id = chatId($data['id'] ?? null);
    $clientId = chatId($data['clientId'] ?? null);
    $text = is_string($data['text'] ?? null) ? trim($data['text']) : '';
    if ($text === '' || mb_strlen($text) > 1000) throw new RyeInputError(400, 'Write a message of up to 1,000 characters.');
    $db->beginTransaction();
    $row = lockedChat($db, $user, $id);
    if ($row['status'] !== 'accepted') throw new RyeInputError(409, 'Messages are available after the request is accepted.');
    $existing = runQuery($db, 'SELECT id, sender_id, body, created_at FROM chat_messages
        WHERE connection_id = ? AND sender_id = ? AND client_id = ?', [$id, $user, $clientId])->fetch();
    if ($existing) {
        if ($existing['body'] !== $text) throw new RyeInputError(409, 'This message was already sent.');
        $db->commit();
        return ['message' => chatMessage($existing, $user)];
    }
    rateLimit($db, 'chat/send/' . $user, 180);
    runQuery($db, 'INSERT INTO chat_messages (connection_id, sender_id, client_id, body) VALUES (?, ?, ?, ?)',
        [$id, $user, $clientId, $text]);
    $message = runQuery($db, 'SELECT id, sender_id, body, created_at FROM chat_messages WHERE id = ?',
        [$db->lastInsertId()])->fetch();
    runQuery($db, 'UPDATE chat_connections SET updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [$id]);
    $db->commit();
    return ['message' => chatMessage($message, $user)];
}
