<?php
declare(strict_types=1);
require __DIR__ . '/../connection.php';
require __DIR__ . '/../accounts.php';
require __DIR__ . '/../stories.php';
require __DIR__ . '/../photo-files.php';

function queryValue(string $name): ?string {
    $value = $_GET[$name] ?? null;
    if ($value !== null && !is_string($value)) throw new RyeInputError(400, 'Invalid query parameter.');
    return $value;
}

function requestJson(int $limit): array {
    $type = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($type !== 'application/json') throw new RyeInputError(415, 'Use the form on RYE.');
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > $limit) {
        throw new RyeInputError(413, 'The submission is too large.');
    }
    $raw = file_get_contents('php://input', false, null, 0, $limit + 1);
    if ($raw === false) throw new RyeInputError(400, 'The submission could not be read.');
    if (strlen($raw) > $limit) throw new RyeInputError(413, 'The submission is too large.');
    $value = json_decode($raw, true, 16);
    if (!is_array($value)) throw new RyeInputError(400, 'Invalid submission.');
    return $value;
}

function sessionCookie(string $token, bool $secure): void {
    setcookie('rye_session', $token, [
        'expires' => $token === '' ? time() - 3600 : time() + 7 * 86400,
        'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax',
    ]);
}

ini_set('display_errors', '0');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
header('Content-Type: application/json; charset=utf-8');
try {
    $path = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '', '/');
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    $routes = [
        '/api/session' => ['GET', 'POST', 'DELETE'],
        '/api/stories' => ['GET', 'POST', 'DELETE'],
        '/api/stories/photo' => ['GET'],
        '/api/admin/stories' => ['GET', 'PATCH'],
    ];
    if (!isset($routes[$path])) throw new RyeInputError(404, 'Unknown endpoint.');
    if (!in_array($method, $routes[$path], true)) {
        header('Allow: ' . implode(', ', $routes[$path]));
        throw new RyeInputError(405, 'Method not allowed.');
    }
    $settings = ryeSettings();
    $https = in_array(strtolower($_SERVER['HTTPS'] ?? ''), ['on', '1'], true);
    $origin = $settings['APP_ORIGIN'] ?: ($https ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? '');
    $secure = $https || str_starts_with($origin, 'https://');
    if ($method !== 'GET' && (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site' ||
        (isset($_SERVER['HTTP_ORIGIN']) && $_SERVER['HTTP_ORIGIN'] !== $origin))) {
        throw new RyeInputError(403, 'Please use the form on RYE.');
    }
    $cookie = $_COOKIE['rye_session'] ?? '';
    $token = is_string($cookie) && preg_match('/^[0-9a-f]{64}$/D', $cookie) ? $cookie : '';
    if ($path === '/api/session' && $method === 'GET' && $token === '') {
        echo '{"loggedIn":false,"canReview":false}';
        return;
    }
    $db = ryeDb($settings);
    $user = sessionUser($db, $token);

    switch ("$method $path") {
        case 'GET /api/session':
            $result = ['loggedIn' => $user !== null, 'canReview' => ($user['role'] ?? '') === 'admin'];
            break;
        case 'POST /api/session':
            $share = queryValue('share') === '1';
            $data = requestJson(8192);
            $data['client'] = $_SERVER['REMOTE_ADDR'] ?? 'local';
            $account = authenticate($db, $data, $token);
            sessionCookie($account['token'], $secure);
            $intent = [];
            if ($share) $intent['share'] = '1';
            if ($data['mode'] === 'signup') $intent['welcome'] = '1';
            $result = ['path' => $account['canReview'] ? '/admin/' : ($intent ? '/?' . http_build_query($intent) : '/')];
            break;
        case 'DELETE /api/session':
            if ($user) runQuery($db, 'DELETE FROM sessions WHERE token_hash = ?', [hash('sha256', $token, true)]);
            sessionCookie('', $secure);
            $result = ['path' => '/login/'];
            break;
        case 'GET /api/stories':
            $result = storyPage($db, $user, ['id' => queryValue('id'), 'cursor' => queryValue('cursor')], false);
            break;
        case 'POST /api/stories':
            requireUser($user);
            $result = submitStory($db, $user, requestJson(3670016));
            if (isset($result['created'])) {
                http_response_code(201);
                unset($result['created']);
            }
            break;
        case 'DELETE /api/stories':
            $result = deleteStory($db, $user, ['id' => queryValue('id')]);
            break;
        case 'GET /api/admin/stories':
            if (!$user) throw new RyeInputError(401, 'Log in to open the review desk.');
            $result = storyPage($db, $user, [
                'status' => queryValue('status') ?? 'pending', 'query' => queryValue('q') ?? '', 'cursor' => queryValue('cursor'),
            ], true);
            break;
        case 'PATCH /api/admin/stories':
            requireReviewer($user);
            $result = reviewStory($db, $user, requestJson(4096));
            break;
        case 'GET /api/stories/photo':
            $file = getPhoto($db, $user, ['id' => queryValue('id'), 'index' => queryValue('index')]);
            header('Content-Type: image/jpeg');
            fpassthru($file);
            fclose($file);
            return;
    }
    echo json_encode($result, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) {
        try { $db->rollBack(); } catch (PDOException $ignored) {}
    }
    if ($error instanceof RyeInputError) {
        http_response_code($error->getCode());
        echo json_encode(['error' => $error->getMessage(), 'field' => $error->field]);
    } else {
        error_log('RYE API failed (' . get_class($error) . ' ' . $error->getCode() . ').');
        http_response_code(503);
        echo '{"error":"The story service is unavailable. Please try again."}';
    }
}
