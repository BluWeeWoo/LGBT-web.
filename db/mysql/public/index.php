<?php
declare(strict_types=1);
require __DIR__ . '/../connection.php';
require __DIR__ . '/../accounts.php';
require __DIR__ . '/../stories.php';

header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
header('Content-Type: application/json; charset=utf-8');
try {
    $settings = ryeSettings();
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || strlen($settings['API_TOKEN']) < 32 ||
        !hash_equals($settings['API_TOKEN'], $_SERVER['HTTP_X_RYE_API_KEY'] ?? '')) {
        throw new RyeInputError(403, 'Access denied.');
    }
    $raw = file_get_contents('php://input', false, null, 0, 3670017);
    if (strlen($raw) > 3670016) throw new RyeInputError(413, 'Submission is too large.');
    $data = json_decode($raw, true, 16);
    if (!is_array($data)) throw new RyeInputError(400, 'Invalid request.');
    $token = $_SERVER['HTTP_X_RYE_SESSION'] ?? '';
    $db = ryeDb($settings);
    $user = sessionUser($db, $token);
    switch ($_SERVER['HTTP_X_RYE_ACTION'] ?? '') {
        case 'session': $result = ['loggedIn' => (bool)$user, 'canReview' => ($user['role'] ?? '') === 'admin']; break;
        case 'authenticate': $result = authenticate($db, $data, $token); break;
        case 'logout':
            if ($user) runQuery($db, 'DELETE FROM sessions WHERE token_hash = ?', [hash('sha256', $token, true)]);
            $result = ['ok' => true]; break;
        case 'publicStories': $result = storyPage($db, $user, $data, false); break;
        case 'reviewQueue': $result = storyPage($db, $user, $data, true); break;
        case 'submitStory': $result = submitStory($db, $user, $data); break;
        case 'reviewStory': $result = reviewStory($db, $user, $data); break;
        case 'deleteStory':
            $owner = requireUser($user)['id'];
            if (!runQuery($db, 'DELETE FROM stories WHERE id = ? AND author_id = ?', [checkedId($data['id'] ?? null), $owner])->rowCount()) {
                throw new RyeInputError(404, 'This story could not be found.');
            }
            $result = ['removed' => true]; break;
        case 'photo':
            $bytes = getPhoto($db, $user, $data);
            header('Content-Type: image/jpeg');
            echo $bytes;
            return;
        default: throw new RyeInputError(404, 'Unknown operation.');
    }
    echo json_encode($result, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    if ($e instanceof RyeInputError) {
        http_response_code($e->getCode());
        echo json_encode(['error' => $e->getMessage(), 'field' => $e->field]);
    } else {
        error_log('RYE database operation failed (' . $e->getCode() . ').');
        http_response_code(503);
        echo json_encode(['error' => 'The story database is unavailable. Please try again.']);
    }
}
