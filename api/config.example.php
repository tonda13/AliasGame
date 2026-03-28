<?php
// ==============================================
// config.php – Database & App Configuration
// ==============================================
// Zkopíruj tento soubor jako config.php a vyplň přihlašovací údaje k DB.

define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'alias_game');
define('DB_USER', getenv('DB_USER') ?: 'db_user');
define('DB_PASS', getenv('DB_PASS') ?: 'db_password');
define('DB_CHARSET', 'utf8mb4');

define('APP_VERSION', '1.2.12');
define('PUBLIC_ROUND_MIN', 4);     // Minimum rounds between public rounds
define('PUBLIC_ROUND_MAX', 8);     // Maximum rounds between public rounds
define('TURN_TIME_SECONDS', 60);   // Time to present the card
define('PREP_TIME_SECONDS', 30);   // Preparation time before turn
define('STEAL_POINTS_RATIO', 0.5); // Fraction of points for stealing team

// CORS headers for local dev
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// DB connection
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, DB_NAME, DB_CHARSET);
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

function jsonResponse(mixed $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function jsonError(string $message, int $status = 400): void {
    jsonResponse(['error' => $message], $status);
}

function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}
