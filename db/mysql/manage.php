<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
require __DIR__ . '/connection.php';
require __DIR__ . '/stories.php';
require __DIR__ . '/photo-files.php';
require __DIR__ . '/migrate.php';

function reportDatabaseError(PDOException $error, array $settings, bool $setupLogin): string {
    $number = (int)($error->errorInfo[1] ?? 0);
    $port = $settings['DB_PORT'] ?: '3306';
    $host = $setupLogin ? '127.0.0.1' : $settings['DB_HOST'];
    $where = "$host on port $port";
    switch ($number) {
        case 2002: case 2003: case 2006: case 2013:
            return "Could not reach MySQL at $where (MySQL $number). Check which database instance is running and its port.";
        case 1045: case 1130: case 1698:
            $account = $setupLogin ? 'the setup account' : 'the RYE application account';
            return "MySQL at $where rejected $account (MySQL $number). Check the database login used for this instance.";
        case 1044: case 1142: case 1143:
            return "MySQL at $where denied access to a RYE table (MySQL $number). Check the RYE account grants.";
        case 1049: case 1146:
            return "The RYE database or a required table is missing at $where (MySQL $number). Check the installed schema.";
        case 1030: case 1812: case 1932:
            return "MySQL reported a storage error at $where (MySQL $number). Check its error log before retrying a write.";
        default:
            return "The database operation failed at $where (MySQL $number). Check the MySQL error log.";
    }
}

$setupLogin = false;
try {
    $root = dirname(__DIR__, 2);
    $settings = ryeSettings();
    $command = $argv[1] ?? '';
    if (in_array($command, ['install', 'migrate-local'], true)) {
        $setupLogin = true;
        $setupUser = getenv('RYE_MYSQL_SETUP_USER') ?: 'root';
        $setupPassword = getenv('RYE_MYSQL_SETUP_PASSWORD') ?: '';
        if ($command === 'install') {
            $db = new PDO('mysql:host=127.0.0.1;port=' . $settings['DB_PORT'] . ';charset=utf8mb4',
                $setupUser, $setupPassword, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 4]);
            $script = file_get_contents($root . '/.env.rye-bootstrap.sql');
            if ($script === false) throw new RuntimeException('Missing local setup SQL.');
            foreach (preg_split('/;\h*(?:\R|$)/', $script) as $statement) {
                if (trim($statement) !== '') $db->exec($statement);
            }
        }
        $db = ryeDb(array_replace($settings, ['DB_USER' => $setupUser, 'DB_PASSWORD' => $setupPassword]));
        migrateDatabase($db);
        // Verify that the limited application account can use the installed schema.
        $setupLogin = false;
        runQuery(ryeDb($settings), 'SELECT id FROM users LIMIT 1');
    } elseif ($command === 'migrate') {
        $db = ryeDb($settings);
        migrateDatabase($db);
        echo "RYE database migrations are up to date.\n";
    } elseif (in_array($command, ['admin', 'init-admin'], true)) {
        $email = strtolower(trim(getenv('RYE_ADMIN_EMAIL') ?: $settings['ADMIN_EMAIL']));
        if (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('Set ADMIN_EMAIL to the reviewer address.');
        }
        $db = ryeDb($settings);
        $db->beginTransaction();
        $reviewer = runQuery($db, 'SELECT id, password_hash, role FROM users WHERE email = ? FOR UPDATE', [$email])->fetch();
        if (!$reviewer) {
            $reviewer = ['id' => ryeUuid(), 'role' => 'admin', 'password_hash' => null];
            runQuery($db, "INSERT INTO users (id, email, display_name, role) VALUES (?, ?, 'RYE reviewer', 'admin')",
                [$reviewer['id'], $email]);
        }
        if ($reviewer['role'] !== 'admin') throw new RuntimeException('This email belongs to a member account. Use a separate reviewer address.');
        if ($command === 'init-admin' && $reviewer['password_hash'] !== null) {
            $db->commit();
            echo "Sign in with the existing RYE reviewer password for $email.\n";
            return;
        }
        $id = $reviewer['id'];
        $chosen = getenv('RYE_ADMIN_PASSWORD');
        $password = $chosen !== false && $chosen !== '' ? $chosen : bin2hex(random_bytes(16));
        if (mb_strlen($password) < 8 || strlen($password) > 1024) throw new RuntimeException('Use 8 or more characters, up to 1024 bytes.');
        runQuery($db, 'UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($password, PASSWORD_ARGON2ID), $id]);
        runQuery($db, 'DELETE FROM sessions WHERE user_id = ?', [$id]);
        $db->commit();
        echo "Reviewer password set for $email.\n";
        if (!$chosen) echo "Generated password (shown once): $password\n";
    } else throw new RuntimeException('Unknown setup command.');
} catch (Throwable $e) {
    if (isset($db) && $db->inTransaction()) {
        try { $db->rollBack(); } catch (PDOException $ignored) {}
    }
    fwrite(STDERR, ($e instanceof PDOException ? reportDatabaseError($e, $settings, $setupLogin) : $e->getMessage()) . PHP_EOL);
    exit(1);
}
