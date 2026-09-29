# Lingo

Türkçe, beş harfli kelime tahmin oyunu. Arayüz, `design/` klasöründeki Stitch ekranlarına ve `DESIGN.md` tasarım sistemine göre yazıldı.

## Çalıştırma

Build adımı yok. Tarayıcıda ES modülleriyle çalışır, ama `file://` üzerinden açılamaz (modüller HTTP ister).

```bash
npm start          # http://localhost:5173
npm test           # oyun mantığı testleri (node:test)
```

Herhangi bir statik sunucu da olur (`python3 -m http.server`, GitHub Pages vb.).

## Neler var

- **Günün kelimesi**: herkes için aynı kelime, gece yarısı yenilenir. Yarım kalan oyun kaldığı yerden devam eder, ödül iki katıdır.
- **Klasik 5 Harf**: rastgele kelime, süre yok.
- **Zamana Karşı**: 60 saniyede bildiğin kadar kelime. Bilinen ya da kaçan kelimeden sonra yenisine geçilir.
- Çevirme animasyonu, konfeti, ipucu (kelime başına 1 bedava, sonrası 25 coin), paylaşılabilir emoji ızgarası.
- Seri, XP, seviye, lig, tahmin dağılımı ve günlük görevler.
- Açık/koyu tema (sistem ayarını izler, profilden değiştirilebilir).
- Fiziksel klavye desteği. Türkçe klavyede `i`/`ı` doğru eşlenir; İngilizce klavyede `I` yalnızca ekran klavyesinden girilebilir.

## Tasarımdan farklı olanlar

Tasarımdaki bazı öğeler sunucu gerektiriyor ve bu sürümde yok:

- Düello PvP ve Özel Oda kartları "Yakında" olarak duruyor, tıklanmıyor.
- Arkadaşlar listesi, "çevrimiçi oyuncu" sayacı ve liderlik tablosu çıkarıldı. Alt menüdeki "Liderler" yerine yerel **İstatistik** sayfası var.
- Kelime açıklamaları bu proje için yazıldı; tasarımdaki gibi "TDK sözlük kökeni" olarak sunulmuyor.

Tüm veriler tarayıcının `localStorage` alanında (`lingo:v1`) tutulur.

## Dosyalar

| Yol | İçerik |
| --- | --- |
| `js/game.js` | DOM'suz oyun mantığı: tahmin değerlendirme, puanlama, günlük kelime seçimi |
| `js/app.js` | Ekranlar, yönlendirme (`#/`, `#/oyna/...`, `#/sonuc`), oyun döngüsü |
| `js/storage.js` | Profil, seri ve istatistiklerin kalıcı tutulması |
| `js/words.js` | Cevap listesi ve açıklamalar (193 kelime) |
| `js/dictionary.js` | Tahmin doğrulama listesi, `npm run build:dict` ile üretilir |
| `js/icons.js` | Kullanılan Material Symbols ikonlarının SVG yolları |
| `assets/fonts/` | Inter (OFL-1.1), yerel olarak sunulur |

## Sözlük hakkında

`js/dictionary.js`, [an-array-of-turkish-words](https://github.com/hexapode/an-array-of-turkish-words) (MIT) paketindeki en sık 8.000 beş harfli kelimeden üretilir. Paket bir metin derleminden çıkarılmış; kesik özel adlar ve İngilizce kelimeler içeriyor. Bu yüzden liste bazı anlamsız tahminleri kabul eder, bazı gerçek ama seyrek kelimeleri de reddedebilir. Cevaplar yalnızca `js/words.js`'den seçilir, oraya giren her kelime doğrulama listesine de otomatik eklenir.

Cevap eklemek için `js/words.js`'e satır ekleyip `npm run build:dict` çalıştırın. Testler, her cevabın 5 harfli ve Türkçe alfabeden olduğunu kontrol eder.
