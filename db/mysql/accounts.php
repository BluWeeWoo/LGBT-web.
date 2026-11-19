<?php
declare(strict_types=1);

function sessionUser(PDO $db, string $token): ?array {
    if (!preg_match('/^[0-9a-f]{64}$/D', $token)) return null;
    $row = runQuery($db, 'SELECT u.id, u.role FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3)', [hash('sha256', $token, true)])->fetch();
    return $row ?: null;
}

function requireUser(?array $user): array {
    if (!$user) throw new RyeInputError(401, 'Please sign in to share or manage your story.');
    return $user;
}

function requireReviewer(?array $user): void {
    if (($user['role'] ?? '') !== 'admin') throw new RyeInputError(403, 'Sign in with an authorized reviewer account.');
}

function rateLimit(PDO $db, string $bucket, int $limit): void {
    $key = hash('sha256', $bucket, true);
    runQuery($db, 'INSERT INTO auth_throttles (bucket, attempts, expires_at)
        VALUES (?, 1, UTC_TIMESTAMP() + INTERVAL 15 MINUTE)
        ON DUPLICATE KEY UPDATE attempts = IF(expires_at <= UTC_TIMESTAMP(), 1, attempts + 1),
        expires_at = IF(expires_at <= UTC_TIMESTAMP(), UTC_TIMESTAMP() + INTERVAL 15 MINUTE, expires_at)', [$key]);
    if ((int)runQuery($db, 'SELECT attempts FROM auth_throttles WHERE bucket = ?', [$key])->fetchColumn() > $limit) {
        throw new RyeInputError(429, 'Too many attempts. Please try again in 15 minutes.');
    }
}

function authenticate(PDO $db, array $data, string $oldToken): array {
    $mode = $data['mode'] ?? '';
    $email = is_string($data['email'] ?? null) ? strtolower(trim($data['email'])) : '';
    $password = $data['password'] ?? null;
    if (!in_array($mode, ['signup', 'login'], true) || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new RyeInputError(400, 'Enter a valid email address.', 'email');
    }
    if (!is_string($password) || $password === '' || strlen($password) > 1024) {
        throw new RyeInputError(400, 'Enter a password of up to 1024 bytes.', 'password');
    }
    $name = is_string($data['name'] ?? null) ? trim($data['name']) : '';
    if ($mode === 'signup' && ($name === '' || mb_strlen($name) > 55)) {
        throw new RyeInputError(400, 'Enter a display name of up to 55 characters.', 'name');
    }
    if ($mode === 'signup' && mb_strlen($password) < 8) {
        throw new RyeInputError(400, 'Use at least 8 characters.', 'password');
    }
    rateLimit($db, $mode . '/ip/' . ($data['client'] ?? 'local'), $mode === 'signup' ? 20 : 120);
    rateLimit($db, $mode . '/email/' . $email, 12);
    runQuery($db, 'DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP() LIMIT 100');
    runQuery($db, 'DELETE FROM auth_throttles WHERE expires_at <= UTC_TIMESTAMP() LIMIT 100');
    $db->beginTransaction();
    if ($mode === 'signup') {
        $id = ryeUuid();
        try {
            runQuery($db, 'INSERT INTO users (id, email, display_name, password_hash) VALUES (?, ?, ?, ?)',
                [$id, $email, $name, password_hash($password, PASSWORD_ARGON2ID)]);
        } catch (PDOException $e) {
            if (($e->errorInfo[1] ?? 0) == 1062) throw new RyeInputError(409, 'This email already has an account. Log in to continue.', 'email');
            throw $e;
        }
        $role = 'member';
    } else {
        $account = runQuery($db, 'SELECT id, role, password_hash FROM users WHERE email = ? FOR UPDATE', [$email])->fetch();
        // Also perform a hash check for unknown and reserved accounts.
        $dummy = '$argon2id$v=19$m=65536,t=4,p=1$MDEyMzQ1Njc4OWFiY2RlZg$NQmQ7IUpA1m97aWWUcbhD9KNBvxF1L80R6mMCjV3ylA';
        if (!password_verify($password, $account['password_hash'] ?? $dummy) || empty($account['password_hash'])) {
            throw new RyeInputError(401, 'The email or password is incorrect.', 'password');
        }
        $id = $account['id'];
        $role = $account['role'];
    }
    $token = bin2hex(random_bytes(32));
    if ($oldToken !== '') runQuery($db, 'DELETE FROM sessions WHERE token_hash = ?', [hash('sha256', $oldToken, true)]);
    runQuery($db, 'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 7 DAY)',
        [hash('sha256', $token, true), $id]);
    $db->commit();
    return ['token' => $token, 'canReview' => $role === 'admin'];
}
