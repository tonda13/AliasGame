<?php
// ==============================================
// api/game.php – Game Session Management
// ==============================================
require_once __DIR__ . '/config.php';

/**
 * Returns true if ($roundCount + 1) is a public round for this game.
 * Intervals are randomized per game (PUBLIC_ROUND_MIN–MAX) but deterministic
 * – seeded by game_id so the sequence is stable across multiple next_card calls.
 */
function isPublicRound(int $gameId, int $roundCount): bool {
    $threshold = 0;
    $i = 0;
    while (true) {
        mt_srand($gameId * 10000 + $i);
        $threshold += mt_rand(PUBLIC_ROUND_MIN, PUBLIC_ROUND_MAX);
        if ($threshold > $roundCount) {
            return ($roundCount + 1) === $threshold;
        }
        $i++;
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;
$gameId = isset($_GET['game_id']) ? (int)$_GET['game_id'] : null;

// ---- GET /api/game.php?action=state&game_id=X ----
if ($method === 'GET') {
    if (!$gameId) jsonError('game_id required');
    $db = getDB();

    $stmt = $db->prepare("SELECT * FROM games WHERE id=?");
    $stmt->execute([$gameId]);
    $game = $stmt->fetch();
    if (!$game) jsonError('Game not found', 404);

    $game['active_groups']     = json_decode($game['active_groups'],     true);
    $game['active_categories'] = json_decode($game['active_categories'], true);

    $teams = $db->prepare("SELECT * FROM teams WHERE game_id=? ORDER BY turn_order");
    $teams->execute([$gameId]);
    $game['teams'] = $teams->fetchAll();

    // Recent rounds
    $rounds = $db->prepare("
        SELECT r.*, c.term, c.category, t.name as team_name, t.color as team_color
        FROM rounds r
        JOIN cards c ON c.id = r.card_id
        JOIN teams t ON t.id = r.team_id
        WHERE r.game_id=?
        ORDER BY r.played_at DESC LIMIT 20
    ");
    $rounds->execute([$gameId]);
    $game['recent_rounds'] = $rounds->fetchAll();

    $rcStmt = $db->prepare("SELECT COUNT(*) as cnt FROM rounds WHERE game_id=?");
    $rcStmt->execute([$gameId]);
    $game['round_count'] = (int)$rcStmt->fetch()['cnt'];

    jsonResponse($game);
}

if ($method === 'POST') {
    $db   = getDB();
    $body = getBody();

    // ---- Create new game ----
    if ($action === 'create') {
        if (empty($body['teams']) || count($body['teams']) < 2) {
            jsonError('At least 2 teams required');
        }
        if (empty($body['active_groups'])) {
            jsonError('At least one card group must be selected');
        }

        $db->beginTransaction();
        try {
            $stmt = $db->prepare("INSERT INTO games (win_score, active_groups, active_categories, status) VALUES (?,?,?,'playing')");
            $stmt->execute([
                max(5, (int)($body['win_score'] ?? 30)),
                json_encode(array_values($body['active_groups'])),
                json_encode(array_values($body['active_categories'] ?? ['describe','draw','mime'])),
            ]);
            $gameId = (int)$db->lastInsertId();

            $tStmt = $db->prepare("INSERT INTO teams (game_id, name, color, turn_order) VALUES (?,?,?,?)");
            foreach (array_values($body['teams']) as $i => $team) {
                $tStmt->execute([$gameId, trim($team['name']), $team['color'] ?? '#4f46e5', $i]);
            }
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            jsonError('Failed to create game: ' . $e->getMessage(), 500);
        }
        jsonResponse(['game_id' => $gameId], 201);
    }

    // ---- Get next card ----
    if ($action === 'next_card') {
        if (!$gameId) jsonError('game_id required');

        $stmt = $db->prepare("SELECT * FROM games WHERE id=? AND status='playing'");
        $stmt->execute([$gameId]);
        $game = $stmt->fetch();
        if (!$game) jsonError('Game not found or not active', 404);

        $groups     = json_decode($game['active_groups'],     true);
        $categories = json_decode($game['active_categories'], true);

        // Exclude already used cards
        $usedStmt = $db->prepare("SELECT card_id FROM used_cards WHERE game_id=?");
        $usedStmt->execute([$gameId]);
        $usedIds  = array_column($usedStmt->fetchAll(), 'card_id');

        $groupPlaceholders = implode(',', array_fill(0, count($groups), '?'));
        $catPlaceholders   = implode(',', array_fill(0, count($categories), '?'));

        $excludeClause = count($usedIds) > 0
            ? 'AND id NOT IN (' . implode(',', array_fill(0, count($usedIds), '?')) . ')'
            : '';

        $sql = "SELECT * FROM cards
                WHERE active=1
                AND group_name IN ($groupPlaceholders)
                AND category IN ($catPlaceholders)
                $excludeClause
                ORDER BY RAND() LIMIT 1";

        $params = array_merge($groups, $categories, $usedIds);
        $cStmt  = $db->prepare($sql);
        $cStmt->execute($params);
        $card = $cStmt->fetch();

        if (!$card) {
            // All cards used – reset used cards and try again
            $db->prepare("DELETE FROM used_cards WHERE game_id=?")->execute([$gameId]);
            $sql2 = "SELECT * FROM cards WHERE active=1 AND group_name IN ($groupPlaceholders) AND category IN ($catPlaceholders) ORDER BY RAND() LIMIT 1";
            $s2   = $db->prepare($sql2);
            $s2->execute(array_merge($groups, $categories));
            $card = $s2->fetch();
        }

        if (!$card) jsonError('No cards available for selected groups/categories', 404);

        // Determine if public round (randomized interval per game, 4–8 rounds)
        $countStmt = $db->prepare("SELECT COUNT(*) as cnt FROM rounds WHERE game_id=?");
        $countStmt->execute([$gameId]);
        $roundCount = (int)$countStmt->fetch()['cnt'];
        $isPublic   = isPublicRound($gameId, $roundCount);

        jsonResponse([
            'card'      => $card,
            'is_public' => $isPublic,
            'turn_time' => TURN_TIME_SECONDS,
        ]);
    }

    // ---- Submit round result ----
    if ($action === 'submit_round') {
        if (!$gameId) jsonError('game_id required');
        $teamId        = (int)($body['team_id']        ?? 0);
        $cardId        = (int)($body['card_id']        ?? 0);
        $guessed       = (bool)($body['guessed']       ?? false);
        $isPublic      = (bool)($body['is_public']     ?? false);
        $guessingTeam  = isset($body['guessing_team_id']) ? (int)$body['guessing_team_id'] : null;

        if (!$teamId || !$cardId) jsonError('team_id and card_id required');

        $db->beginTransaction();
        try {
            // Get card points
            $cStmt = $db->prepare("SELECT points FROM cards WHERE id=?");
            $cStmt->execute([$cardId]);
            $card   = $cStmt->fetch();
            $points = $card ? (int)$card['points'] : 1;

            $pointsAwarded     = $guessed ? $points : 0;
            $guessingTeamPts   = 0;
            $presentingTeamPts = 0;

            if ($guessed) {
                if ($isPublic && $guessingTeam && $guessingTeam !== $teamId) {
                    // Split points: 50% to presenting team, 50% to guessing team
                    $presentingTeamPts = (int)ceil($points * STEAL_POINTS_RATIO);
                    $guessingTeamPts   = (int)floor($points * STEAL_POINTS_RATIO);
                } else {
                    $presentingTeamPts = $points;
                }

                // Award points to presenting team
                if ($presentingTeamPts > 0) {
                    $db->prepare("UPDATE teams SET score=score+? WHERE id=?")->execute([$presentingTeamPts, $teamId]);
                }
                // Award points to guessing team (public round)
                if ($guessingTeamPts > 0 && $guessingTeam) {
                    $db->prepare("UPDATE teams SET score=score+? WHERE id=?")->execute([$guessingTeamPts, $guessingTeam]);
                }
            }

            // Log round
            $db->prepare("INSERT INTO rounds (game_id,team_id,card_id,is_public,guessed,points_awarded,guessed_by_team_id) VALUES (?,?,?,?,?,?,?)")
               ->execute([$gameId, $teamId, $cardId, $isPublic ? 1 : 0, $guessed ? 1 : 0, $pointsAwarded, $guessingTeam]);

            // Mark card as used
            $db->prepare("INSERT IGNORE INTO used_cards (game_id,card_id) VALUES (?,?)")->execute([$gameId, $cardId]);

            // Advance to next team
            $teamsStmt = $db->prepare("SELECT id,score,turn_order FROM teams WHERE game_id=? ORDER BY turn_order");
            $teamsStmt->execute([$gameId]);
            $teams = $teamsStmt->fetchAll();

            $game = $db->prepare("SELECT current_team_index, win_score FROM games WHERE id=?");
            $game->execute([$gameId]);
            $gameData = $game->fetch();

            $nextIndex = ((int)$gameData['current_team_index'] + 1) % count($teams);
            $winScore  = (int)$gameData['win_score'];

            // Check for winner
            $winner = null;
            foreach ($teams as $t) {
                if ((int)$t['score'] >= $winScore) {
                    $winner = $t;
                    break;
                }
            }

            if ($winner) {
                $db->prepare("UPDATE games SET status='finished', current_team_index=?, finished_at=NOW() WHERE id=?")->execute([$nextIndex, $gameId]);
            } else {
                $db->prepare("UPDATE games SET current_team_index=? WHERE id=?")->execute([$nextIndex, $gameId]);
            }

            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            jsonError('Failed to submit round: ' . $e->getMessage(), 500);
        }

        // Return updated state
        $stStmt = $db->prepare("SELECT * FROM teams WHERE game_id=? ORDER BY turn_order");
        $stStmt->execute([$gameId]);
        $updatedTeams = $stStmt->fetchAll();

        $rcStmt2 = $db->prepare("SELECT COUNT(*) as cnt FROM rounds WHERE game_id=?");
        $rcStmt2->execute([$gameId]);
        $newRoundCount = (int)$rcStmt2->fetch()['cnt'];

        jsonResponse([
            'success'         => true,
            'winner'          => $winner,
            'teams'           => $updatedTeams,
            'next_team_index' => $nextIndex,
            'round_count'     => $newRoundCount,
        ]);
    }

    // ---- Adjust team score (joker/hint penalty) ----
    if ($action === 'score_adjust') {
        if (!$gameId) jsonError('game_id required');
        $teamId = (int)($body['team_id'] ?? 0);
        $delta  = (int)($body['delta']   ?? 0);
        if (!$teamId || $delta === 0) jsonError('team_id and delta required');
        $db->prepare("UPDATE teams SET score=score+? WHERE id=? AND game_id=?")->execute([$delta, $teamId, $gameId]);
        $stStmt = $db->prepare("SELECT * FROM teams WHERE game_id=? ORDER BY turn_order");
        $stStmt->execute([$gameId]);
        jsonResponse(['success' => true, 'teams' => $stStmt->fetchAll()]);
    }

    // ---- End game manually ----
    if ($action === 'end') {
        if (!$gameId) jsonError('game_id required');
        $db->prepare("UPDATE games SET status='finished', finished_at=NOW() WHERE id=?")->execute([$gameId]);
        jsonResponse(['success' => true]);
    }
}

jsonError('Unknown action or method', 405);
