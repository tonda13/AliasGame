# 🎭 Alias Game – Instalační příručka

Týmová hra inspirovaná Alias/Aktivity. Popis, kresba, pantomima.

---

## Požadavky

- PHP 8.0+
- MySQL 5.7+ / MariaDB 10.4+
- Apache s mod_rewrite

---

## Instalace

### 1. Databáze

```sql
CREATE DATABASE alias_game CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Pak spustit:
```bash
mysql -u root -p alias_game < database.sql
```

### 2. Konfigurace

Otevři `api/config.php` a uprav přihlašovací údaje:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'alias_game');
define('DB_USER', 'tvuj_user');
define('DB_PASS', 'tvoje_heslo');
```

### 3. Upload

Nahraj celou složku na webserver (např. do `/var/www/html/alias/`).

### 4. Oprávnění

```bash
chmod 644 api/*.php
chmod 755 .
```

---

## Struktura souborů

```
alias-game/
├── index.html          # Hlavní SPA
├── manifest.json       # PWA manifest
├── .htaccess           # Apache routing
├── database.sql        # DB schéma + ukázková data
├── css/
│   └── style.css       # Stylopis
├── js/
│   └── game.js         # Herní logika
├── api/
│   ├── config.php      # DB konfigurace
│   ├── cards.php       # CRUD kartičky + import/export
│   └── game.php        # Herní session API
└── icons/
    ├── icon-192.png    # PWA ikona (nutno dodat)
    └── icon-512.png    # PWA ikona (nutno dodat)
```

---

## Herní mechaniky

| Funkce | Popis |
|--------|-------|
| **Veřejné kolo** | Každé 5. kolo – hádají všechny týmy, body se dělí |
| **Přípravný čas** | 10 sekund na přečtení kartičky |
| **Herní čas** | 60 sekund na prezentaci |
| **Nápověda** | Rozbalovací vysvětlení pojmu |
| **Timer** | Vizuální + zvukový (Web Audio API) |
| **Import/Export** | JSON formát kartičky |

---

## Formát importu JSON

```json
{
  "version": "1.0.0",
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

**Hodnoty `category`:** `describe` | `draw` | `mime`  
**Hodnoty `difficulty`:** `1` (lehká) | `2` (střední) | `3` (těžká)

---

## Nastavitelné konstanty (`api/config.php`)

| Konstanta | Výchozí | Popis |
|-----------|---------|-------|
| `PUBLIC_ROUND_EVERY` | 5 | Každé Nth kolo je veřejné |
| `TURN_TIME_SECONDS` | 60 | Délka herního kola |
| `PREP_TIME_SECONDS` | 10 | Přípravný čas |
| `STEAL_POINTS_RATIO` | 0.5 | Podíl bodů pro hádající tým |

---

## PWA – instalace na tablet

1. Otevři hru v Chrome/Safari
2. Klikni "Přidat na plochu"
3. Hra se chová jako nativní aplikace (fullscreen, bez adresního řádku)

> ⚠️ Ikony `icons/icon-192.png` a `icons/icon-512.png` si musíš dodat ručně.
