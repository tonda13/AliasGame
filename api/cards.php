<?php
// ==============================================
// api/cards.php – Cards CRUD + Import/Export
// ==============================================
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;
$action = $_GET['action'] ?? null;

// ---- GET ----
if ($method === 'GET') {
    $db = getDB();

    // Export all cards as JSON (respects group/category filters)
    if ($action === 'export') {
        $where  = ['active=1'];
        $params = [];
        if (!empty($_GET['group']))    { $where[] = 'group_name=?'; $params[] = $_GET['group']; }
        if (!empty($_GET['category'])) { $where[] = 'category=?';   $params[] = $_GET['category']; }
        $sql   = 'SELECT term,hint,category,group_name,difficulty,points FROM cards WHERE ' . implode(' AND ', $where) . ' ORDER BY group_name,category,difficulty';
        $stmt  = $db->prepare($sql);
        $stmt->execute($params);
        $cards = $stmt->fetchAll();
        header('Content-Disposition: attachment; filename="cards_export.json"');
        jsonResponse(['version' => APP_VERSION, 'cards' => $cards]);
    }

    // List groups
    if ($action === 'groups') {
        $groups = $db->query("SELECT DISTINCT group_name, COUNT(*) as card_count FROM cards WHERE active=1 GROUP BY group_name ORDER BY group_name")->fetchAll();
        jsonResponse($groups);
    }

    // Single card
    if ($id) {
        $stmt = $db->prepare("SELECT * FROM cards WHERE id=? AND active=1");
        $stmt->execute([$id]);
        $card = $stmt->fetch();
        if (!$card) jsonError('Card not found', 404);
        jsonResponse($card);
    }

    // List with optional filters
    $where  = ['active=1'];
    $params = [];
    if (!empty($_GET['group']))      { $where[] = 'group_name=?';   $params[] = $_GET['group']; }
    if (!empty($_GET['category']))   { $where[] = 'category=?';     $params[] = $_GET['category']; }
    if (!empty($_GET['difficulty'])) { $where[] = 'difficulty=?';   $params[] = (int)$_GET['difficulty']; }

    $sql  = 'SELECT * FROM cards WHERE ' . implode(' AND ', $where) . ' ORDER BY group_name, term';
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    jsonResponse($stmt->fetchAll());
}

// ---- POST ----
if ($method === 'POST') {
    $db   = getDB();
    $body = getBody();

    // Bulk import
    if ($action === 'import') {
        if (empty($body['cards']) || !is_array($body['cards'])) {
            jsonError('Invalid import format – expected {"cards":[...]}');
        }

        // Načti existující kartičky (term + group) pro detekci duplikátů
        $existing = [];
        foreach ($db->query("SELECT term, group_name FROM cards WHERE active=1")->fetchAll() as $row) {
            $existing[mb_strtolower($row['term'], 'UTF-8') . '|' . $row['group_name']] = true;
        }

        $stmt     = $db->prepare("INSERT INTO cards (term,hint,category,group_name,difficulty,points) VALUES (?,?,?,?,?,?)");
        $imported = 0;
        $skipped  = 0;
        $db->beginTransaction();
        try {
            foreach ($body['cards'] as $c) {
                $term  = trim($c['term'] ?? '');
                $group = trim($c['group_name'] ?? 'general');
                $key   = mb_strtolower($term, 'UTF-8') . '|' . $group;
                if (!$term || isset($existing[$key])) {
                    $skipped++;
                    continue;
                }
                $stmt->execute([
                    $term,
                    trim($c['hint']         ?? ''),
                    in_array($c['category'] ?? '', ['describe','draw','mime']) ? $c['category'] : 'describe',
                    $group,
                    max(1, min(3, (int)($c['difficulty'] ?? 2))),
                    max(1, (int)($c['points'] ?? 1)),
                ]);
                $imported++;
                $existing[$key] = true; // zabrání duplikátům i uvnitř jednoho importního souboru
            }
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            jsonError('Import failed: ' . $e->getMessage(), 500);
        }
        jsonResponse(['imported' => $imported, 'skipped' => $skipped]);
    }

    // Rename group
    if ($action === 'rename_group') {
        $old = trim($body['old_name'] ?? '');
        $new = trim($body['new_name'] ?? '');
        if (!$old || !$new) jsonError('old_name and new_name required');
        $stmt = $db->prepare("UPDATE cards SET group_name=? WHERE group_name=? AND active=1");
        $stmt->execute([$new, $old]);
        jsonResponse(['updated' => $stmt->rowCount()]);
    }

    // Create single card
    $required = ['term', 'category', 'group_name'];
    foreach ($required as $f) {
        if (empty($body[$f])) jsonError("Field '$f' is required");
    }
    $stmt = $db->prepare("INSERT INTO cards (term,hint,category,group_name,difficulty,points) VALUES (?,?,?,?,?,?)");
    $stmt->execute([
        trim($body['term']),
        trim($body['hint']         ?? ''),
        in_array($body['category'], ['describe','draw','mime']) ? $body['category'] : 'describe',
        trim($body['group_name']),
        max(1, min(3, (int)($body['difficulty'] ?? 2))),
        max(1, (int)($body['points'] ?? 1)),
    ]);
    jsonResponse(['id' => (int)$db->lastInsertId()], 201);
}

// ---- PUT ----
if ($method === 'PUT') {
    if (!$id) jsonError('ID required');
    $db   = getDB();
    $body = getBody();
    $stmt = $db->prepare("UPDATE cards SET term=?,hint=?,category=?,group_name=?,difficulty=?,points=? WHERE id=?");
    $stmt->execute([
        trim($body['term']        ?? ''),
        trim($body['hint']        ?? ''),
        in_array($body['category'] ?? '', ['describe','draw','mime']) ? $body['category'] : 'describe',
        trim($body['group_name']  ?? 'general'),
        max(1, min(3, (int)($body['difficulty'] ?? 2))),
        max(1, (int)($body['points'] ?? 1)),
        $id,
    ]);
    jsonResponse(['updated' => $stmt->rowCount()]);
}

// ---- DELETE ----
if ($method === 'DELETE') {
    $db   = getDB();

    // Delete entire group (soft-delete all cards in group)
    if ($action === 'delete_group') {
        $body = getBody();
        $name = trim($body['group_name'] ?? '');
        if (!$name) jsonError('group_name required');
        $stmt = $db->prepare("UPDATE cards SET active=0 WHERE group_name=?");
        $stmt->execute([$name]);
        jsonResponse(['deleted' => $stmt->rowCount()]);
    }

    if (!$id) jsonError('ID required');
    $stmt = $db->prepare("UPDATE cards SET active=0 WHERE id=?");
    $stmt->execute([$id]);
    jsonResponse(['deleted' => $stmt->rowCount()]);
}

jsonError('Method not allowed', 405);
