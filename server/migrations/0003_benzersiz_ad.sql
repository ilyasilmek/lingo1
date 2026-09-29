-- Oyuncu adları benzersiz olur. name_key, js/leaderboard-rules.js içindeki nameKey() ile
-- aynı kuralla üretilir: küçük harf, Türkçe harfler sadeleşir, boşluk . _ - atılır.
ALTER TABLE players ADD COLUMN name_key TEXT;

-- Var olan adlar için anahtar. Aynı anahtarı paylaşan kayıtlardan en çok oyunu olan
-- (eşitlikte en eski) adı alır; diğerleri anahtarsız kalır ve listeden gizlenir.
-- Gizlenen oyuncu uygulamayı açtığında yeni bir ad seçmesi istenir.
WITH k AS (
  SELECT p.id,
    replace(replace(replace(replace(lower(
      replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
        trim(p.name),
        'İ', 'i'), 'I', 'i'), 'ı', 'i'),
        'Ş', 's'), 'ş', 's'), 'Ğ', 'g'), 'ğ', 'g'),
        'Ü', 'u'), 'ü', 'u'), 'Ö', 'o'), 'ö', 'o'),
        'Ç', 'c'), 'ç', 'c'), 'Â', 'a'), 'â', 'a'), 'î', 'i')
    ), ' ', ''), '.', ''), '_', ''), '-', '') AS key,
    (SELECT COUNT(*) FROM scores s WHERE s.player_id = p.id) AS games,
    p.created_at
  FROM players p
), ranked AS (
  SELECT id, key, ROW_NUMBER() OVER (PARTITION BY key ORDER BY games DESC, created_at ASC, id ASC) AS rn FROM k
)
UPDATE players SET name_key = (SELECT key FROM ranked WHERE ranked.id = players.id AND ranked.rn = 1);

UPDATE players SET hidden = 1, updated_at = datetime('now') WHERE name_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS players_name_key ON players(name_key);
