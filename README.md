# Lingo

Türkçe kelime tahmin oyunu (4-9 harf). Arayüz, `design/` klasöründeki Stitch ekranlarına ve `DESIGN.md` tasarım sistemine göre yazıldı.

## Çalıştırma

Build adımı yok. Tarayıcıda ES modülleriyle çalışır, ama `file://` üzerinden açılamaz (modüller HTTP ister).

```bash
npm start          # http://localhost:5173
npm test           # oyun mantığı ve kelime listesi testleri (node:test)
```

Herhangi bir statik sunucu da olur (`python3 -m http.server`, GitHub Pages vb.).

## Kurallar

- Kelimenin **ilk harfi baştan açıktır** ve silinemez. Kalan harfler 6 denemede bulunur.
- Doğru yerde bulunan harfler ve ipuçları sonraki satırda soluk olarak gösterilir. Oyuncu yine de kelimenin tamamını yazar.
- Tahmin, seçilen uzunlukta ve TDK Güncel Türkçe Sözlük'te bulunan bir kelime olmalı.

## Neler var

- **Kelime uzunluğu**: ana sayfadan 4-9 arası seçilir. Klasik ve Zamana Karşı modları tahtayı ve kelimeleri bu uzunluğa göre hazırlar.
- **Günün kelimesi**: herkes için aynı 5 harfli kelime, gece yarısı yenilenir. Yarım kalan oyun kaldığı yerden devam eder, ödül iki katıdır.
- **Klasik**: rastgele kelime, süre yok. Yarım kalan oyun saklanır. Klasik tekrar açılınca "Devam / Yeni oyun" sorulur. En az bir tahmin yapılmış oyunu bırakıp yenisini açmak kayıp sayılır. Hiç tahmin yapılmamış oyun, seçili uzunluk değiştiyse sormadan yenisiyle değiştirilir.
- **Zamana Karşı**: 60 saniyede bildiğin kadar kelime. Bilinen ya da kaçan kelimeden sonra yenisine geçilir.
- Çevirme animasyonu, konfeti, ipucu (kelime başına 1 bedava, sonrası 25 coin), paylaşılabilir emoji ızgarası.
- Seri, XP, seviye, lig, tahmin dağılımı ve günlük görevler.
- Açık/koyu tema (sistem ayarını izler, profilden değiştirilebilir).
- Fiziksel klavye desteği. Türkçe klavyede `i`/`ı` doğru eşlenir; İngilizce klavyede `I` yalnızca ekran klavyesinden girilebilir.

## Tasarımdan farklı olanlar

Tasarımdaki bazı öğeler sunucu gerektiriyor ve bu sürümde yok:

- Düello PvP ve Özel Oda kartları "Yakında" olarak duruyor, tıklanmıyor.
- Arkadaşlar listesi, "çevrimiçi oyuncu" sayacı ve liderlik tablosu çıkarıldı. Alt menüdeki "Liderler" yerine yerel **İstatistik** sayfası var.
- Tasarımdaki "TDK sözlük kökeni" kartı yerine "Anlamı" kartı var. 192 yaygın 5 harfli kelimenin açıklamasını bu proje için ayrıca yazdım. Diğer kelimelerde kart TDK sözlüğüne bağlantı verir (aşağıya bakın).

Tüm veriler tarayıcının `localStorage` alanında (`lingo:v1`) tutulur.

## Dosyalar

| Yol | İçerik |
| --- | --- |
| `js/game.js` | DOM'suz oyun mantığı: tahmin değerlendirme, puanlama, günlük kelime seçimi |
| `js/app.js` | Ekranlar, yönlendirme (`#/`, `#/oyna/...`, `#/sonuc`), oyun döngüsü |
| `js/storage.js` | Profil, seri ve istatistiklerin kalıcı tutulması |
| `js/wordlist.js` | `data/` altındaki listeleri gerektiğinde yükler |
| `js/words.js` | 192 kelimenin elle yazılmış açıklaması |
| `data/valid-N.txt` | N harfli tüm TDK maddeleri (tahmin doğrulaması) |
| `data/answers-N.txt` | Cevap olarak sorulan N harfli kelimeler |
| `js/icons.js` | Kullanılan Material Symbols ikonlarının SVG yolları |
| `assets/fonts/` | Inter (OFL-1.1), yerel olarak sunulur |

## Kelime listeleri

`data/` altındaki dosyalar `scripts/build-words.mjs` ile üretilir. Kaynak, TDK Güncel Türkçe Sözlük 12. baskının [ogun/guncel-turkce-sozluk](https://github.com/ogun/guncel-turkce-sozluk) deposundaki dökümüdür (99.236 madde).

- **Geçerli tahminler:** özel ad olmayan, yalnızca Türk alfabesinden oluşan tüm maddeler. Şapkalı harfler düzleştirilir (â→a, î→i, û→u). Boşluklu ya da tireli maddeler alınmaz. Toplam 37.922 kelime.
- **Cevaplar:** bu maddelerden, bir metin derleminde ([an-array-of-turkish-words](https://github.com/hexapode/an-array-of-turkish-words), MIT) en sık geçen 60.000 kelime arasında yer alanlar. Tüm anlamları argo, kaba, eskimiş ya da yöresel olarak işaretlenmiş kelimeler ve kısa bir engel listesi çıkarılır. Toplam 7.572 kelime.

| Harf | Geçerli | Cevap |
| --- | ---: | ---: |
| 4 | 2.050 | 959 |
| 5 | 5.456 | 1.849 |
| 6 | 6.042 | 1.475 |
| 7 | 7.933 | 1.461 |
| 8 | 8.957 | 1.163 |
| 9 | 7.484 | 665 |

Sözlükteki her madde cevap olarak sorulsaydı "duldalı", "duysal" gibi pek bilinmeyen kelimeler de çıkardı. Derlem süzgeci bunu azaltır ama kusursuz değildir: derlem web metinlerinden çıkarıldığı için cevaplar arasında hâlâ garip kelimeler kalabilir.

TDK sözlüğünün içeriği TDK'ya aittir. Depoda yalnızca madde başları tutulur. Tanımlar ve örnek cümleler dağıtılmaz. Kelime anlamlarını uygulamada göstermek istenirse bunun için TDK'dan izin almak gerekir.

Listeleri yeniden üretmek için:

```bash
curl -LO https://raw.githubusercontent.com/ogun/guncel-turkce-sozluk/master/sozluk/v12/v12.gts.json.tar.gz
tar xzf v12.gts.json.tar.gz
npm install
npm run build:words -- ./gts.json
```
