# Alias Game – Technická dokumentace pro pokračování vývoje

> Tento dokument je určen primárně pro Claude Code nebo jiného AI asistenta, který bude pokračovat ve vývoji projektu přímo na disku. Popisuje kompletní architekturu, herní logiku, datové modely a seznam otevřených vylepšení.

---

## 1. Přehled projektu

**Alias Game** je webová týmová slovní hra inspirovaná Alias/Aktivity. Hráči v týmech střídavě prezentují pojmy třemi způsoby (slovní popis, kresba, pantomima) a ostatní hádají. Hra běží jako **PWA** na jednom sdíleném zařízení (tablet, TV).

### Stack
| Vrstva | Technologie |
|--------|-------------|
| Frontend | Vanilla JS (ES2020+), žádný framework ani build step |
| Backend | PHP 8.0+, REST-like JSON API |
| Databáze | MySQL 5.7+ / MariaDB 10.4+ |
| Hosting | Apache s mod_rewrite |
| Zvuky | Web Audio API (generované tóny, žádné soubory) |
| PWA | `manifest.json` + `sw.js` Service Worker |

---

## 2. Struktura souborů

```
alias-game/
├── index.html              ← Jediný HTML soubor; všechny obrazovky (SPA)
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service Worker (cache-first statika, network-first API)
├── karticky.json           ← Exportovaná DB kartiček (pro import/zálohu)
├── .htaccess               ← Apache: rewrite pravidla, cache, GZIP
├── database.sql            ← Schéma DB + ukázková data
├── README.md               ← Instalační příručka pro uživatele
├── CLAUDE.md               ← Tento soubor (technická dokumentace)
│
├── css/
│   └── style.css           ← Kompletní CSS; tmavý herní motiv; CSS proměnné; témata
│
├── js/                     ← ES moduly (žádný build systém, přímý import v browseru)
│   ├── main.js             ← Vstupní bod; aplikace tématu; popstate + DOMContentLoaded
│   ├── api.js              ← API konstanty + apiFetch
│   ├── state.js            ← State objekt + persistence (joker, nápovědy)
│   ├── sounds.js           ← Web Audio engine (Sounds objekt)
│   ├── helpers.js          ← toast, showConfirm, getCategoryIcon/Label, getDiffLabel
│   ├── navigation.js       ← showScreen (odděleno kvůli zamezení cirkulárních závislostí)
│   ├── screen-home.js      ← initHomeScreen, initRulesScreen
│   ├── screen-setup.js     ← setup logika + startGame
│   ├── screen-game.js      ← celý herní flow
│   └── screen-cards.js     ← editor kartiček + swipe gesta + správa skupin
│
├── icons/
│   ├── icon-192.png        ← PWA ikona 192×192 (emoji 🎭, tmavé pozadí, 11% padding)
│   └── icon-512.png        ← PWA ikona 512×512
│
├── etc/
│   ├── themes/             ← Zdrojové obrázky s barevnými paletami témat
│   └── data/               ← Připravené JSON soubory karet k importu
│
└── api/
    ├── config.php          ← DB přihlašovací údaje + sdílené helper funkce (není v gitu)
    ├── config.example.php  ← Šablona konfigurace (zkopíruj jako config.php)
    ├── cards.php           ← CRUD pro kartičky + bulk import/export + správa skupin
    └── game.php            ← Herní session: vytvoření, tahy, skóre, vítěz
```

> **Žádný build systém.** Soubory se editují přímo. `index.html` načítá pouze `js/main.js` přes `<script type="module">` – prohlížeč si sám stáhne importované moduly. `type="module"` je automaticky defer.

---

## 3. Databázový model

### Tabulka `cards` – kartičky (obsah hry)
```sql
id          INT AUTO_INCREMENT PK
term        VARCHAR(255)        -- výraz k hádání (povinný)
emoji       VARCHAR(20) NULL    -- volitelné emoji pro děti (nechtěnce čtení)
hint        TEXT                -- nápověda / vysvětlení (volitelný)
category    ENUM('describe','draw','mime')  -- typ prezentace
group_name  VARCHAR(100)        -- tematická skupina (IT, zeměpis, emoji, ...)
difficulty  TINYINT 1-3         -- 1=lehká, 2=střední, 3=těžká
points      SMALLINT            -- bodová hodnota karty (obvykle = difficulty)
active      TINYINT(1)          -- soft delete (0 = smazáno)
created_at  TIMESTAMP
```

> Existující DB: `ALTER TABLE cards ADD COLUMN emoji VARCHAR(20) NULL AFTER term;`

### Tabulka `games` – herní session
```sql
id                  INT AUTO_INCREMENT PK
win_score           SMALLINT            -- cílový počet bodů pro vítězství
active_groups       JSON                -- pole názvů skupin karet použitých v hře
active_categories   JSON                -- pole kategorií ('describe','draw','mime')
status              ENUM('setup','playing','finished')
current_team_index  TINYINT             -- index aktuálního týmu v poli teams
current_round       SMALLINT            -- číslo kola (zatím jen informativní)
created_at          TIMESTAMP
finished_at         TIMESTAMP NULL
```

### Tabulka `teams` – týmy v herní session
```sql
id          INT AUTO_INCREMENT PK
game_id     INT FK → games.id
name        VARCHAR(100)
color       VARCHAR(20)         -- hex barva (#e94560)
score       SMALLINT            -- aktuální skóre
turn_order  TINYINT             -- pořadí tahu (0, 1, 2, ...)
```

### Tabulka `rounds` – log odehraných kol
```sql
id                  INT AUTO_INCREMENT PK
game_id             INT FK → games.id
team_id             INT FK → teams.id   -- prezentující tým
card_id             INT FK → cards.id
is_public           TINYINT(1)          -- bylo to veřejné kolo?
guessed             TINYINT(1)          -- bylo uhodnuto?
points_awarded      SMALLINT            -- přiznané body (celkem)
guessed_by_team_id  INT NULL            -- v veřejném kole: tým který uhodl
played_at           TIMESTAMP
```

### Tabulka `used_cards` – použité karty v session
```sql
game_id     INT FK → games.id  -- složený PK
card_id     INT FK → cards.id
```
> Slouží k tomu, aby se karty v jedné hře neopakovaly. Při vyčerpání všech karet se tabulka pro danou hru resetuje.

---

## 4. API endpointy

Všechny endpointy jsou v `api/`, přijímají a vracejí `Content-Type: application/json`.

### `api/cards.php`

| Metoda | Parametry | Popis |
|--------|-----------|-------|
| `GET` | *(bez action)* | Výpis karet; volitelné filtry: `?group=IT&category=describe&difficulty=2` |
| `GET` | `?action=groups` | Seznam skupin s počty karet |
| `GET` | `?action=export` | Export karet jako JSON; respektuje filtry `?group=` a `?category=` |
| `GET` | `?id=X` | Detail jedné karty |
| `POST` | *(bez action)* | Vytvoření nové karty; body: `{term, emoji?, hint, category, group_name, difficulty, points}` |
| `POST` | `?action=import` | Hromadný import; body: `{cards: [...]}`; přeskakuje duplicity (stejný term+group); vrátí `{imported, skipped}` |
| `POST` | `?action=rename_group` | Přejmenuje skupinu; body: `{old_name, new_name}`; UPDATE na všech kartách skupiny |
| `PUT` | `?id=X` | Aktualizace karty; stejné body jako POST |
| `DELETE` | `?id=X` | Soft-delete karty (nastaví `active=0`) |
| `DELETE` | `?action=delete_group` | Soft-delete všech karet skupiny; body: `{group_name}` |

### `api/game.php`

| Metoda | Parametry | Popis |
|--------|-----------|-------|
| `GET` | `?action=state&game_id=X` | Kompletní stav hry: game, teams, recent_rounds, **round_count** |
| `POST` | `?action=create` | Vytvoří novou herní session; body: `{teams, active_groups, active_categories, win_score}` |
| `POST` | `?action=next_card&game_id=X` | Náhodná karta (respektuje použité, skupiny, kategorie); vrátí `{card, is_public, turn_time}` |
| `POST` | `?action=submit_round&game_id=X` | Zapíše výsledek tahu; body: `{team_id, card_id, guessed, is_public, guessing_team_id?}`; vrátí `{success, winner?, teams, next_team_index, **round_count**}` |
| `POST` | `?action=score_adjust&game_id=X` | Upraví skóre týmu; body: `{team_id, delta}`; vrátí `{success, teams}` – používá se pro pokuty jokeru/nápověd |
| `POST` | `?action=end&game_id=X` | Manuální ukončení hry |

### Sdílené helper funkce (`api/config.php`)
```php
getDB()           // Singleton PDO spojení
jsonResponse($data, $status)  // Vrátí JSON + ukončí skript
jsonError($message, $status)  // Vrátí chybový JSON
getBody()         // Dekóduje JSON z php://input
```

### Herní konstanty (`api/config.php`)
```php
PUBLIC_ROUND_MIN   = 4     // minimální interval mezi veřejnými koly
PUBLIC_ROUND_MAX   = 8     // maximální interval mezi veřejnými koly
TURN_TIME_SECONDS  = 60    // délka kola (posílá se klientovi jako turn_time)
STEAL_POINTS_RATIO = 0.5   // podíl bodů pro hádající tým ve veřejném kole
```

---

## 5. Frontend architektura (ES moduly v `js/`)

### Globální stav – objekt `State`
```js
State = {
  gameId,           // ID aktuální herní session
  game,             // raw data ze serveru (games row)
  teams,            // pole teams ze serveru
  currentTeamIndex, // index aktivního týmu
  currentCard,      // aktuálně tahnutá karta (včetně turn_time ze serveru)
  isPublic,         // je toto veřejné kolo?
  timerInterval,    // setInterval reference pro herní časovač
  timerSeconds,     // zbývající sekundy
  timerPaused,      // boolean – je časovač pozastaven?
  roundCount,       // celkový počet odehraných kol (ze serveru)
  cardDrawn,        // boolean – je aktuálně vytažena karta?
  jokerUsedAt,      // { teamId: roundCount } – kdy byl joker naposledy použit
  hintsUsed,        // { teamId: count } – počet použitých nápověd per tým (max 5 per tým)
}
```

### Persistence joker + nápověda (localStorage)
Klíč `alias_game_extras` uchovává `{ gameId, jokerUsedAt, hintsUsed }`. Funkce:
- `saveGameExtras()` – uloží při každé změně jokeru nebo nápovědy
- `loadGameExtras()` – načte při `loadGameState()`, pokud `gameId` souhlasí
- `clearGameExtras()` – zavolá se při `startGame()`, `endGame()`, `showWinner()`

### Navigace mezi obrazovkami
Aplikace je SPA. Přepínání obrazovek probíhá výhradně přes:
```js
showScreen('screenId')            // přidá .active, pushState do history
showScreen('screenId', false)     // přidá .active, BEZ pushState (pro init)
```
Dostupné ID obrazovek: `screenHome`, `screenSetup`, `screenGame`, `screenWinner`, `screenCards`, `screenRules`.

Tlačítka „← Zpět" v setupu a editoru kartiček volají `history.back()`.
Handler `popstate` zachycuje browser back button; pokud je aktivní `screenGame`, zobrazí potvrzovací dialog před ukončením.

### Persistence hry (localStorage)
`alias_game_id` v `localStorage` uchovává `gameId` aktivní hry. Při načtení stránky (F5, zavření browseru) se hra automaticky obnoví. Klíč se maže při výhře nebo manuálním ukončení.

### Témata (localStorage)
`alias_theme` v `localStorage` uchovává název aktivního tématu. Téma se aplikuje jako první řádek `main.js` (před importy) atributem `data-theme` na `<html>` – zabraňuje záblesku výchozích barev. Přepínač je na home screenu (barevné tečky pod verzí).

Dostupná témata (výchozí je Raspberry Red):

| Klíč | Název | Accent | Pozadí |
|------|-------|--------|--------|
| `""` (default) | Raspberry Red | #EE005A | #012641 |
| `celadon` | Celadon | zelená | tmavě hnědá |
| `cherry` | Cherry Blossom | růžová | tmavě modrá |
| `icy` | Icy Blue | modrá | tmavě šedá |
| `lime` | Lime Cream | žluto-zelená | tmavě fialová |
| `shadow` | Shadow Grey | světle šedá | černá |

### Herní flow (funkce v pořadí volání)
```
startGame()
  └─ apiFetch POST /api/game.php?action=create
       └─ loadGameState()
            └─ renderGame()
                 └─ renderTurnArea()  ← zobrazí tlačítko "Táhnout kartičku"
                      └─ drawCard()
                           └─ apiFetch POST next_card
                                └─ showPrepPhase()  ← zobrazí kartičku + tlačítko Začít (bez odpočtu)
                                     └─ startTurn(startFrom?)  ← turn_time sekund časovač
                                          └─ showRoundResult()  ← potvrdit/neuhodnout
                                               └─ submitRound()
                                                    └─ renderGame()  nebo  showWinner()
```

`startTurn(startFrom)` přijímá volitelný parametr – počet sekund od kterých pokračovat (používá se při resume po pauze). Délka tahu se bere ze `State.currentCard.turn_time` (přichází ze serveru, fallback 60).

### Sdílené UI utility
```js
showConfirm(message, confirmText, cancelText)  // Promise<bool> – stylizovaný modal místo confirm()
toast(msg, type)                               // dočasná notifikace (info/success/error)
updateScoreboard()                             // překreslí pouze scoreboard bez resetování turnArea
```

### Zvukový engine (`Sounds`)
Generuje tóny přes **Web Audio API** – nevyžaduje žádné zvukové soubory. Dostupné zvuky:
- `start` – fanfára při začátku tahu
- `tick` – tikání při posledních 10 sekundách
- `warning` – varování při 20 sekundách
- `end` – sestupná sekvence při vypršení času
- `correct` – vzestupná melodie při správné odpovědi
- `wrong` – hluboký tón při špatné odpovědi
- `winner` – oslavná sekvence

> **Důležité:** Web Audio Context se inicializuje lazy až při prvním `Sounds.play()`. Prohlížeče blokují audio bez uživatelské interakce – proto se `Sounds.init()` volá až po kliknutí, nikoli při načtení stránky.

### Časovač – implementační detail
Vizuální kruhový časovač je SVG `<circle>` s `stroke-dasharray: 440` a `stroke-dashoffset` řízeným přes CSS proměnnou `--timer-progress`. Progres se mění každou sekundu přes `setInterval`. Barvy se mění:
- plný čas–21s: accent barva
- 20–11s: oranžová (warning class)
- 10–0s: danger barva + pulsující animace (critical class)

### CSS architektura (`css/style.css`)
Celý design je postaven na CSS proměnných v `:root`. Témata přepisují proměnné přes `html[data-theme="xxx"]` selektor. Klíčové proměnné:
```css
--bg, --surface, --surface2     /* vrstvy pozadí */
--border                        /* barva ohraničení */
--accent                        /* primární akcentní barva */
--accent2                       /* sekundární akcentní barva */
--btn-accent-text               /* barva textu na accent tlačítkách (tmavá pro světlé akcenty) */
--gold (#ffd700)                /* zlatá pro výherce */
--text, --text-muted            /* texty */
--success, --danger, --info     /* stavové barvy */
--font-display ('Bebas Neue')   /* display font pro nadpisy/čísla */
--font-body ('Nunito')          /* text font */
--team-color                    /* přepisuje se inline stylem pro každý tým */
```

Layoutové třídy jsou utility-first (podobné Tailwindu): `.flex`, `.grid-2`, `.gap-16`, `.mt-24`, atd. – definovány na konci souboru v sekci `UTILS`.

---

## 6. Herní logika – detaily

### Výběr veřejného kola
V `api/game.php`, funkce `isPublicRound($gameId, $roundCount)`:
```php
// Generuje deterministickou sekvenci prahů seedovanou game_id
// Intervaly jsou náhodné v rozmezí PUBLIC_ROUND_MIN–MAX (4–8)
// Sekvence je stabilní – při každém volání vyjde stejný výsledek
mt_srand($gameId * 10000 + $i);
$threshold += mt_rand(PUBLIC_ROUND_MIN, PUBLIC_ROUND_MAX);
```
Každá hra má jinou sekvenci veřejných kol, ale deterministic – nevyžaduje ukládání do DB.

### Distribuce bodů ve veřejném kole
```php
$presentingTeamPts = ceil($points * STEAL_POINTS_RATIO);   // 50% → prezentující
$guessingTeamPts   = floor($points * STEAL_POINTS_RATIO);  // 50% → hádající
```
Pokud nikdo neuhodl (`guessing_team_id = null` nebo `0`), body se nepřipisují nikomu.

### Joker – placený fallback
`jokerAvailable(teamId)` vrací `true` pokud nebyl použit nebo uplynulo ≥ 7 kol.
- Joker dostupný → přeskočí zdarma, zavolá `submitRound(false, null, true)`
- Joker na cooldownu + karta vytažena → tlačítko zobrazí `🃏 Joker (-1b)`, po potvrzení zavolá `score_adjust(-1)` a pak `submitRound`

### Nápovědy – placený fallback
`hintsUsed[teamId]` počítá použité nápovědy (max 5 zdarma per tým).
- Zbývají nápovědy → standardní tlačítko `💡 Nápověda (X zbývá)`
- Vyčerpány → tlačítko `💡 Koupit 2 nápovědy (-1b)`, po potvrzení `score_adjust(-1)` a `hintsUsed[teamId] -= 2`

### Deduplikace karet
Tabulka `used_cards` ukládá `(game_id, card_id)` páry. Při `next_card` se vybírají karty `WHERE id NOT IN (použité)`. Pokud jsou všechny karty vyčerpány, tabulka se resetuje pro danou hru a začíná znovu.

### Detekce vítěze
Po každém `submit_round` se prochází všechny týmy. Pokud `score >= win_score`, hra přechází do stavu `finished` a vrátí objekt vítěze. Frontend pak zavolá `showWinner()`.

### Emoji na kartičkách
Pole `emoji` (VARCHAR 20, NULL) na tabulce `cards`. Pokud je vyplněno:
- V přípravné fázi se emoji zobrazí velké (`clamp` 4–7rem), název pod ním malý muted textem
- Bez emoji → zobrazí se název normálně jako dříve
- Slouží pro děti, které neumí číst – vizuálně identifikují pojem

---

## 7. Implementované funkce (přehled)

- [x] **Joker** – každý tým může 1× přeskočit kartičku zdarma; dobíjí se po 7 kolech; persistuje přes F5; po vypršení cooldownu lze přeskočit za −1 bod (`🃏 Joker (-1b)`)
- [x] **Limit nápověd** – max 5× per tým zdarma; po vyčerpání lze dokoupit 2 nápovědy za −1 bod; persistuje přes F5
- [x] **Přípravná obrazovka** – zobrazí kartičku bez odpočtu; tah začne až stiskem tlačítka Začít
- [x] **Animace skóre** – `.score-bump` float animace při připsání bodů
- [x] **datalist pro skupiny** – `#groupSuggestions` se naplňuje ze serveru při načtení editoru kartiček
- [x] **Vlastní confirm dialog** – `showConfirm()` místo nativního `confirm()`
- [x] **Persistence hry přes F5** – `alias_game_id` v localStorage, obnova při načtení
- [x] **SPA history** – `pushState`/`popstate`; back button ze hry zobrazí potvrzení
- [x] **Správa skupin karet** – přejmenování, smazání (s type-confirm ochranou), nová skupina otevře editor karet s předvyplněnou skupinou
- [x] **Filtrovaný export** – export respektuje aktivní filtry skupiny a kategorie
- [x] **6 barevných témat** – CSS proměnné + `data-theme`; přepínač na home screenu; persistuje přes F5; výchozí Raspberry Red
- [x] **Toggle všech skupin** – tlačítko „Označit vše / Zrušit vše" v nastavení hry
- [x] **Randomizovaná veřejná kola** – interval 4–8 kol, deterministický per game_id, bez DB sloupce
- [x] **score_adjust API** – endpoint pro penalizaci/bonus mimo herní kolo
- [x] **Emoji na kartičkách** – volitelné pole; velké emoji v přípravě pro děti co neumí číst
- [x] **Emoji sada karet** – 80 karet ve skupině `emoji` (`etc/data/alias_emoji_karticky.json`)

## 8. Chybějící funkce (plánované)

- [ ] **Herní log / timeline** – scrollovatelný přehled všech tahů v průběhu hry
- [ ] **Statistiky** – kdo byl nejlepší hádač / prezentátor

### Možná rozšíření (neřešit hned)
- [ ] Obtížnostní handicap – těžší karty pro vedoucí tým
- [ ] Zvuky při připsání bodů
- [ ] Multi-device podpora (každý tým na svém telefonu)

---

## 9. Jak pokračovat ve vývoji

### Přidání nové obrazovky
1. Přidej `<section id="screenXyz" class="screen">` do `index.html`
2. Vytvoř `js/screen-xyz.js` s `export function initXyzScreen() { ... }`
3. Importuj a zavolej `initXyzScreen()` v `js/main.js` uvnitř `DOMContentLoaded`
4. Naviguj přes `showScreen('screenXyz')` (importuj z `./navigation.js`)

### Přidání nového API endpointu
1. Přidej novou `if ($action === 'xxx')` větev do příslušného PHP souboru
2. Vrať data přes `jsonResponse($data)` nebo chybu přes `jsonError('zpráva', $kod)`
3. Na frontendu volej přes `apiFetch('api/xxx.php?action=xxx', { method, body })`

### Přidání nové herní fáze do kola
Flow tahu je lineární řetěz funkcí. Pro vložení nové fáze:
- Najdi místo v řetězu (sekce 5, "Herní flow")
- Uprav volající funkci, aby místo přímého volání další fáze volala novou

### Přidání nového tématu
1. Přidej `html[data-theme="xxx"] { --bg: ...; --accent: ...; ... }` blok do `css/style.css`
2. Přidej `<button class="theme-dot" data-theme="xxx" style="background:HEX">` do `#themePicker` v `index.html`
3. Přidej `theme === 'xxx' ? '#BG_HEX' : ...` do theme-color mapy v `js/main.js`
4. Pokud má téma světlý accent, přidej `--btn-accent-text: #tmavá` do CSS bloku tématu

### Změna délky kola
Edituj konstantu v `api/config.php`:
```php
define('TURN_TIME_SECONDS', 60);
```
Hodnota se posílá klientovi v odpovědi `next_card` (`turn_time`) a frontend ji čte ze `State.currentCard.turn_time`.

### Service Worker a cache
`sw.js` cachuje statické soubory (všech 10 JS modulů + HTML + CSS + manifest). Při každé změně kódu je potřeba zvýšit verzi ve třech souborech najednou:
1. `api/config.php` – `define('APP_VERSION', 'X.X.X')`
2. `sw.js` – `const CACHE_NAME = 'alias-game-vX.X.X'`
3. `index.html` – `<p class="text-muted">vX.X.X</p>`

---

## 10. Kartičky

Připravené soubory k importu jsou v `etc/data/`. Kategorie v JSON souborech musí používat hodnoty `describe`, `draw`, `mime` (ne `pantomima`).

| Soubor | Obsah |
|--------|-------|
| `alias_detske_karticky.json` | Dětské kartičky (obecné) |
| `alias_filmove_a_rceni.json` | Filmy a rčení |
| `alias_IT_karticky.json` | IT témata |
| `alias_obecne_karticky.json` | Obecné kartičky |
| `alias_nove_kategorie.json` | Nové různorodé kategorie |
| `alias_emoji_karticky.json` | 80 karet pro děti co neumí číst – každá má pole `emoji` |

Import karet: tlačítko **📥 Import** v editoru kartiček, formát `{cards: [...]}`. Duplicity (stejný `term` + `group_name`, case-insensitive) jsou automaticky přeskočeny.

Pole `emoji` v JSON je volitelné. Pokud je vyplněno, zobrazí se v přípravné fázi velké emoji místo textu.

---

## 11. Bezpečnostní poznámky

- Všechny SQL dotazy používají **prepared statements** s parametry – žádný SQL injection
- API nemá autentizaci – vhodné pro lokální/intranetové nasazení, ne pro veřejný internet
- Vstupní data jsou validována na straně PHP (povinná pole, enum hodnoty, rozsahy čísel)
- `active=0` je soft-delete – karty se z DB nemažou, pouze skrývají
- Přihlašovací údaje DB jsou v `api/config.php` – tento soubor **nesmí být commitován do veřejného repozitáře** (je v `.gitignore`)

---

*Aktualizováno pro alias-game v1.2.17*
