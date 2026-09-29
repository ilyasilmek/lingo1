-- Lingo skor tablosu şeması (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,               -- uygulamanın ürettiği 32 karakterlik rastgele kimlik
  secret_hash TEXT NOT NULL,         -- cihazdaki gizli anahtarın SHA-256 özeti
  name TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0, -- 1: yönetici tarafından listeden gizlendi
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scores (
  player_id TEXT NOT NULL REFERENCES players(id),
  day TEXT NOT NULL,                 -- 'YYYY-MM-DD'
  won INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  seconds INTEGER NOT NULL,
  hints INTEGER NOT NULL,
  points INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (player_id, day)       -- her oyuncu her gün için tek skor
);

CREATE INDEX IF NOT EXISTS scores_day ON scores(day);
