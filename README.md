# 🎭 Alias Game

Týmová slovní hra inspirovaná Alias a Aktivitami – běží jako **PWA** na sdíleném tabletu nebo TV. Hráči v týmech střídavě prezentují pojmy třemi způsoby: **slovním popisem**, **kresbou** nebo **pantomimou**. Ostatní hádají. Vyhraje tým, který jako první dosáhne cílového skóre.

---

## Funkce

- **3 typy úkolů** – popsat, nakreslit, zahrát pantomimu
- **Skupiny karet** – tematicky rozdělené (IT, filmy, detské, obecné, ...), volitelné pro každou hru
- **Veřejná kola** – v náhodném intervalu (4–8 kol) hádají všechny týmy najednou a body se dělí
- **Joker** – každý tým může 1× přeskočit kartičku zdarma; po vypršení cooldownu lze přeskočit za −1 bod
- **Nápovědy** – až 5× per tým zdarma; po vyčerpání lze dokoupit 2 nápovědy za −1 bod
- **Přípravný čas** – 30 s na přečtení kartičky před spuštěním odpočtu
- **SVG časovač** – vizuální kruhový odpočet se zvukovými upozorněními (Web Audio API, žádné soubory)
- **6 barevných témat** – přepínatelná na hlavní obrazovce, výběr se uloží
- **Editor karet** – přidávání, editace, mazání, správa skupin (přejmenování, smazání s ochranou), import/export JSON
- **PWA** – instalovatelná na tablet/telefon, funguje offline (statika cachovaná service workerem)
- **Persistence** – rozehraná hra přežije obnovení stránky

---

## Stack

| Vrstva | Technologie |
|--------|-------------|
| Frontend | Vanilla JS (ES2020+ moduly), žádný build krok |
| Backend | PHP 8.0+, REST JSON API |
| Databáze | MySQL 5.7+ / MariaDB 10.4+ |
| Hosting | Apache s mod_rewrite |
| Zvuky | Web Audio API (generované tóny) |
| PWA | manifest.json + Service Worker |

---

## Instalace

### 1. Databáze

```bash
mysql -u root -p -e "CREATE DATABASE alias_game CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p alias_game < database.sql
```

### 2. Konfigurace

```bash
cp api/config.example.php api/config.php
```

Uprav přihlašovací údaje v `api/config.php`:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'alias_game');
define('DB_USER', 'tvuj_user');
define('DB_PASS', 'tvoje_heslo');
```

### 3. Nahrání na server

Nahraj celou složku na webserver s povoleným `mod_rewrite`. Soubor `.htaccess` zajistí správné routování SPA a cache hlavičky.

### 4. Import karet (volitelné)

V editoru karet (tlačítko **Kartičky** na hlavní obrazovce) klikni na **📥 Import** a nahrát libovolný soubor z `etc/data/`. Duplicity jsou automaticky přeskočeny.

---

## Lokální vývoj (Docker)

```bash
docker-compose up -d
```

Aplikace běží na `http://localhost:8080`. Databáze na portu `3306`. Soubory jsou mountovány přímo, žádný rebuild není potřeba.

---

## Formát importu karet

```json
{
  "cards": [
    {
      "term": "Algoritmus",
      "hint": "Sada instrukcí pro řešení problému",
      "category": "describe",
      "group_name": "IT",
      "difficulty": 2,
      "points": 2
    }
  ]
}
```

| Pole | Hodnoty |
|------|---------|
| `category` | `describe` · `draw` · `mime` |
| `difficulty` | `1` lehká · `2` střední · `3` těžká |
| `hint` | volitelné |

---

## Konfigurace hry (`api/config.php`)

| Konstanta | Výchozí | Popis |
|-----------|---------|-------|
| `PUBLIC_ROUND_MIN` | 4 | Minimální interval mezi veřejnými koly |
| `PUBLIC_ROUND_MAX` | 8 | Maximální interval mezi veřejnými koly |
| `TURN_TIME_SECONDS` | 60 | Délka herního kola |
| `STEAL_POINTS_RATIO` | 0.5 | Podíl bodů pro hádající tým ve veřejném kole |

---

## Struktura projektu

```
alias-game/
├── index.html              # Jediný HTML soubor – všechny obrazovky (SPA)
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── .htaccess               # Apache: rewrite, cache, GZIP
├── database.sql            # Schéma + ukázková data
├── css/
│   └── style.css           # Kompletní CSS; CSS proměnné; 6 témat
├── js/
│   ├── main.js             # Vstupní bod
│   ├── api.js              # apiFetch + URL konstanty
│   ├── state.js            # Globální stav + persistence
│   ├── sounds.js           # Web Audio engine
│   ├── helpers.js          # toast, showConfirm, utility funkce
│   ├── navigation.js       # showScreen (SPA navigace)
│   ├── screen-home.js      # Hlavní obrazovka + pravidla
│   ├── screen-setup.js     # Nastavení hry (týmy, skupiny)
│   ├── screen-game.js      # Herní flow
│   └── screen-cards.js     # Editor karet + správa skupin
├── api/
│   ├── config.example.php  # Šablona konfigurace (zkopíruj jako config.php)
│   ├── cards.php           # CRUD karet + import/export
│   └── game.php            # Herní session API
├── icons/                  # PWA ikony (192 + 512 px)
└── etc/
    ├── data/               # Připravené sady karet k importu (JSON)
    └── themes/             # Zdrojové obrázky barevných témat
```

---

## PWA – instalace na tablet

1. Otevři hru v Chrome nebo Safari
2. **Chrome:** menu → *Přidat na plochu*
   **Safari:** tlačítko sdílení → *Přidat na plochu*
3. Hra se spustí jako fullscreen aplikace bez adresního řádku
