-- ==============================================
-- ALIAS GAME - Database Schema
-- ==============================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Cards table
CREATE TABLE IF NOT EXISTS `cards` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `term` VARCHAR(255) NOT NULL,
  `emoji` VARCHAR(20) NULL COMMENT 'optional emoji for non-readers (kids mode)',
  `hint` TEXT,
  `category` ENUM('describe','draw','mime') NOT NULL DEFAULT 'describe',
  `group_name` VARCHAR(100) NOT NULL DEFAULT 'general',
  `difficulty` TINYINT NOT NULL DEFAULT 2 COMMENT '1=easy,2=medium,3=hard',
  `points` SMALLINT NOT NULL DEFAULT 1,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_group (`group_name`),
  INDEX idx_category (`category`),
  INDEX idx_difficulty (`difficulty`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Game sessions
CREATE TABLE IF NOT EXISTS `games` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `win_score` SMALLINT NOT NULL DEFAULT 30,
  `active_groups` JSON NOT NULL COMMENT 'array of group names used',
  `active_categories` JSON NOT NULL COMMENT 'array of categories used',
  `status` ENUM('setup','playing','finished') NOT NULL DEFAULT 'setup',
  `current_team_index` TINYINT NOT NULL DEFAULT 0,
  `current_round` SMALLINT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `finished_at` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Teams
CREATE TABLE IF NOT EXISTS `teams` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `game_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `color` VARCHAR(20) NOT NULL DEFAULT '#4f46e5',
  `score` SMALLINT NOT NULL DEFAULT 0,
  `turn_order` TINYINT NOT NULL DEFAULT 0,
  FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON DELETE CASCADE,
  INDEX idx_game (`game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rounds / turns log
CREATE TABLE IF NOT EXISTS `rounds` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `game_id` INT NOT NULL,
  `team_id` INT NOT NULL,
  `card_id` INT NOT NULL,
  `is_public` TINYINT(1) NOT NULL DEFAULT 0,
  `guessed` TINYINT(1) NOT NULL DEFAULT 0,
  `points_awarded` SMALLINT NOT NULL DEFAULT 0,
  `guessed_by_team_id` INT NULL COMMENT 'for public rounds - team that guessed',
  `played_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`),
  INDEX idx_game (`game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Used cards per game (to avoid repeats)
CREATE TABLE IF NOT EXISTS `used_cards` (
  `game_id` INT NOT NULL,
  `card_id` INT NOT NULL,
  PRIMARY KEY (`game_id`, `card_id`),
  FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==============================================
-- Sample Data
-- ==============================================

INSERT INTO `cards` (`term`, `hint`, `category`, `group_name`, `difficulty`, `points`) VALUES
-- IT group
('Algoritmus', 'Sada instrukcí pro řešení problému – jako recept v kuchyni', 'describe', 'IT', 1, 1),
('Firewall', 'Ochranná zeď mezi sítěmi – jako hlídač u dveří', 'describe', 'IT', 2, 2),
('Git', 'Systém pro správu verzí kódu', 'describe', 'IT', 2, 2),
('Databáze', 'Organizované úložiště dat', 'describe', 'IT', 1, 1),
('Blockchain', 'Řetěz propojených bloků dat, decentralizovaný', 'describe', 'IT', 3, 3),
('Python', 'Programovací jazyk pojmenovaný po hadovi', 'mime', 'IT', 2, 2),
('Virus', 'Škodlivý program který se šíří sám', 'describe', 'IT', 1, 1),
('Cloud computing', 'Výpočetní výkon dostupný přes internet', 'describe', 'IT', 2, 2),
('API', 'Rozhraní pro komunikaci dvou aplikací', 'describe', 'IT', 3, 3),
('Bug', 'Chyba v programu – pojmenovaná po skutečném hmyzu', 'describe', 'IT', 1, 1),

-- Geography
('Himaláje', 'Nejvyšší pohoří světa, domov Everestu', 'draw', 'zeměpis', 1, 1),
('Amazonka', 'Největší řeka světa podle průtoku', 'describe', 'zeměpis', 1, 1),
('Sahara', 'Největší horká poušť na světě', 'describe', 'zeměpis', 1, 1),
('Norsko', 'Země fjordů na severu Evropy', 'draw', 'zeměpis', 2, 2),
('Kanárské ostrovy', 'Španělské ostrovy u pobřeží Afriky', 'describe', 'zeměpis', 2, 2),
('Machu Picchu', 'Indiánské město na vrcholu And', 'draw', 'zeměpis', 2, 2),
('Černé moře', 'Vnitrozemské moře mezi Evropou a Asií', 'describe', 'zeměpis', 2, 2),
('Island', 'Ostrovní stát na severu Atlantiku, sopky a gejzíry', 'draw', 'zeměpis', 1, 1),

-- Kids
('Slon', 'Největší suchozemský živočich, má chobot', 'mime', 'dětské', 1, 1),
('Duhový jednorožec', 'Magický kůň s rohem', 'draw', 'dětské', 1, 1),
('Spánek', 'Co děláš každou noc v posteli', 'mime', 'dětské', 1, 1),
('Zmrzlina', 'Studená sladká pochoutka', 'describe', 'dětské', 1, 1),
('Fotbal', 'Nejpopulárnější sport na světě', 'mime', 'dětské', 1, 1),
('Robot', 'Stroj který vypadá jako člověk', 'draw', 'dětské', 1, 1),
('Duha', 'Barevný oblouk po dešti', 'draw', 'dětské', 1, 1),

-- General
('Karma', 'Co zaseješ, to sklidíš – hinduistický koncept', 'describe', 'obecné', 2, 2),
('Déjà vu', 'Pocit že jsi tuto situaci již zažil', 'describe', 'obecné', 2, 2),
('Inflace', 'Růst cen zboží a pokles hodnoty peněz', 'describe', 'obecné', 2, 2),
('Karanténa', 'Izolace kvůli nemoci nebo epidemii', 'describe', 'obecné', 2, 2),
('Sarkasmus', 'Ironie s ostrým jazykem – říkáš opak co myslíš', 'mime', 'obecné', 2, 2),
('Empatie', 'Schopnost vžít se do pocitů druhého', 'describe', 'obecné', 3, 3),
('Referendum', 'Přímé hlasování občanů o důležité otázce', 'describe', 'obecné', 3, 3);
