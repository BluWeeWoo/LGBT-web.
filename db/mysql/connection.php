<?php
declare(strict_types=1);

function ryeSettings(): array {
    $path = dirname(__DIR__, 2) . '/.env.mysql.json';
    $local = is_file($path) ? json_decode(file_get_contents($path), true, 16, JSON_THROW_ON_ERROR) : [];
    $options = [];
    foreach (['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'API_TOKEN', 'DB_CA'] as $key) {
        $value = getenv('RYE_MYSQL_' . $key);
        $options[$key] = $value !== false ? $value : ($local[$key] ?? '');
    }
    return $options;
}

function ryeDb(array $settings): PDO {
    $host = $settings['DB_HOST'];
    $port = $settings['DB_PORT'] ?: '3306';
    $name = $settings['DB_NAME'];
    if (!preg_match('/^[a-zA-Z0-9_.:-]+$/D', $host) || !ctype_digit((string)$port) ||
        !preg_match('/^[a-zA-Z0-9_]+$/D', $name) || !$settings['DB_USER']) {
        throw new RuntimeException('Missing database settings.');
    }
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_TIMEOUT => 4,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '+00:00'",
    ];
    if ($settings['DB_CA']) {
        $options[PDO::MYSQL_ATTR_SSL_CA] = $settings['DB_CA'];
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = true;
    }
    return new PDO("mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4",
        $settings['DB_USER'], $settings['DB_PASSWORD'], $options);
}

function runQuery(PDO $db, string $sql, array $args = []): PDOStatement {
    $statement = $db->prepare($sql);
    $statement->execute($args);
    return $statement;
}

function ryeUuid(): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 15) | 64);
    $bytes[8] = chr((ord($bytes[8]) & 63) | 128);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

class RyeInputError extends RuntimeException {
    public ?string $field;
    public function __construct(int $status, string $message, ?string $field = null) {
        parent::__construct($message, $status);
        $this->field = $field;
    }
}
