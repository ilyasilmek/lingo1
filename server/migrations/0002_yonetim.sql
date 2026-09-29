-- Yönetici girişinde yanlış anahtar denemeleri (kaba kuvvet denemelerini yavaşlatmak için)
CREATE TABLE IF NOT EXISTS admin_fails (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL -- Unix zamanı (saniye)
);
CREATE INDEX IF NOT EXISTS admin_fails_ip ON admin_fails(ip, at);
