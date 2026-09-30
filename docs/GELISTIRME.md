# Lingo: geliştirici notları

Oyunun tanıtımı için [README](../README.md) dosyasına bakın. Bu belge çalıştırma, veri üretimi ve Android derlemesiyle ilgili ayrıntıları toplar.

## Çalıştırma

Build adımı yok. Tarayıcıda ES modülleriyle çalışır, ama `file://` üzerinden açılamaz (modüller HTTP ister).

```bash
npm start          # http://localhost:5173
npm test           # oyun mantığı ve kelime listesi testleri (node:test)
```

Herhangi bir statik sunucu da olur (`python3 -m http.server`, GitHub Pages vb.).

## Dosyalar

| Yol | İçerik |
| --- | --- |
| `js/game.js` | DOM'suz oyun mantığı: tahmin değerlendirme, puanlama, günlük kelime seçimi |
| `js/app.js` | Ekranlar, yönlendirme (`#/`, `#/oyna/...`, `#/sonuc`), oyun döngüsü |
| `js/storage.js` | Profil, seri ve istatistiklerin kalıcı tutulması |
| `js/wordlist.js` | `data/` altındaki listeleri gerektiğinde yükler |
| `data/valid-N.txt` | N harfli tüm TDK maddeleri (tahmin doğrulaması) |
| `data/answers-N.txt` | Cevap olarak sorulan N harfli kelimeler |
| `data/meanings-N.json` | Cevap kelimelerinin anlamları (KeNet, GPL-3.0) |
| `js/icons.js` | Kullanılan Material Symbols ikonlarının SVG yolları |
| `assets/fonts/` | Inter (OFL-1.1), yerel olarak sunulur |

## Kelime listeleri

`data/` altındaki dosyalar `scripts/build-words.mjs` ile üretilir. Kaynak, TDK Güncel Türkçe Sözlük 12. baskının [ogun/guncel-turkce-sozluk](https://github.com/ogun/guncel-turkce-sozluk) deposundaki dökümüdür (99.236 madde).

- **Geçerli tahminler:** özel ad olmayan, yalnızca Türk alfabesinden oluşan tüm maddeler. Şapkalı harfler düzleştirilir (â→a, î→i, û→u). Boşluklu ya da tireli maddeler alınmaz. Toplam 37.922 kelime.
- **Cevaplar:** bu maddelerden, bir metin derleminde ([an-array-of-turkish-words](https://github.com/hexapode/an-array-of-turkish-words), MIT) en sık geçen 60.000 kelime arasında yer alanlar. Tüm anlamları argo, kaba, eskimiş ya da yöresel olarak işaretlenmiş kelimeler ve kısa bir engel listesi çıkarılır. KeNet'te tanımı olmayan kelimeler de cevap olmaz, böylece oyun sonunda her kelimenin anlamı gösterilebilir. Toplam 7.265 kelime.
- **Anlamlar:** [KeNet](https://github.com/StarlangSoftware/TurkishWordNet), Işık Üniversitesi'nin hazırladığı Türkçe WordNet. Tanımlar anlam numarasına göre sıralanır, "Bir tarih" gibi yer tutucular ve kelimenin kendisini içeren tanımlar atlanır, en fazla iki anlam alınır.

| Harf | Geçerli | Cevap |
| --- | ---: | ---: |
| 4 | 2.050 | 927 |
| 5 | 5.456 | 1.807 |
| 6 | 6.042 | 1.430 |
| 7 | 7.933 | 1.383 |
| 8 | 8.957 | 1.123 |
| 9 | 7.484 | 595 |

Sözlükteki her madde cevap olarak sorulsaydı "duldalı", "duysal" gibi pek bilinmeyen kelimeler de çıkardı. Derlem süzgeci bunu azaltır ama kusursuz değildir: derlem web metinlerinden çıkarıldığı için cevaplar arasında hâlâ garip kelimeler kalabilir.

### Lisanslar

- TDK dökümünden yalnızca madde başları (kelimelerin kendisi) alınır, TDK tanımları ve örnek cümleleri depoda yoktur.
- `data/meanings-*.json` KeNet'ten türetilmiştir. KeNet'in GitHub deposu GPL-3.0 lisanslıdır (metni `../data/LICENSE-KeNet.txt`), aynı veriyi taşıyan `nlptoolkit-wordnet` npm paketi ise ISC olarak etiketlenmiş. Güvenli taraf GPL-3.0 kabul etmektir: bu dosyalar GPL-3.0 altında dağıtılır, projenin geri kalanı MIT'dir.
- KeNet'in ilk sürümü TDK Güncel Türkçe Sözlük'ün 2011 baskısından derlenmiştir ve tanımların bir kısmı TDK metnine çok yakındır. Uygulama ticari olarak yayınlanacaksa bu konuda hukuki görüş almak doğru olur.

Listeleri yeniden üretmek için:

```bash
curl -LO https://raw.githubusercontent.com/ogun/guncel-turkce-sozluk/master/sozluk/v12/v12.gts.json.tar.gz
tar xzf v12.gts.json.tar.gz
npm pack nlptoolkit-wordnet && tar xzf nlptoolkit-wordnet-*.tgz   # package/turkish_wordnet.xml
npm install
npm run build:words -- ./gts.json ./package/turkish_wordnet.xml
```

## Android (APK / AAB)

Web uygulaması [Capacitor](https://capacitorjs.com/) ile Android'e paketlenir. `android/` klasörü Android Studio'da doğrudan açılabilen bir Gradle projesidir; uygulama kimliği `com.stitchilyas.lingo`, sürüm adı `android/app/build.gradle` içindeki `defaultVersionName` değerinden gelir.

```bash
npm install
npm run android:sync     # web dosyalarını www/ klasörüne kopyalar ve android/ projesine aktarır
```

Web tarafında bir şey değiştiğinde Android Studio'da derlemeden önce `npm run android:sync` çalıştırılmalı.

### GitHub Actions

`.github/workflows/android.yml` her push'ta testleri çalıştırır, ardından debug APK, release APK ve release AAB üretir. Çıktılar iş akışı sayfasındaki **Artifacts** bölümünden indirilir. `versionCode` 1540300 + çalıştırma numarasıdır, yani her çalıştırmada artar ve 1.54.02 sürümünün kodlarından (1540200 + numara) hep büyük kalır. Android Studio'daki yerel derleme 1540300 alır; aynı kodla Play'e ikinci kez yükleme yapılamayacağı için yerelden birden fazla sürüm yüklenecekse `android/app/build.gradle` içindeki varsayılan artırılmalı.

Release çıktılarının imzalanması için şu repository secrets tanımlanmalı:

| Secret | Kabul edilen diğer adlar | İçerik |
| --- | --- | --- |
| `LINGO_KEYSTORE_BASE64` | `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_BASE64` | `.jks` dosyasının base64 hali (`base64 -w0 lingo-upload.jks`) |
| `LINGO_KEYSTORE_PASSWORD` | `ANDROID_KEYSTORE_PASSWORD`, `STORE_PASSWORD` | Keystore parolası |
| `LINGO_KEY_ALIAS` | `ANDROID_KEY_ALIAS`, `KEY_ALIAS` | Anahtar adı |
| `LINGO_KEY_PASSWORD` | `ANDROID_KEY_PASSWORD`, `KEY_PASSWORD` | Anahtar parolası (yoksa keystore parolası kullanılır) |

Secrets yoksa release APK/AAB imzasız üretilir ve iş akışı bir uyarı verir.

### Android Studio'da imzalama

1. `android/` klasörünü Android Studio'da aç.
2. **Build > Generate Signed App Bundle or APK** ile keystore dosyasını ve parolaları gir.

Alternatif olarak `android/keystore.properties.example` dosyasını `android/keystore.properties` adıyla kopyalayıp doldurursan `./gradlew bundleRelease` doğrudan imzalı AAB üretir. `keystore.properties`, `*.jks` ve `*.keystore` git'e girmez.

## Skor tablosu sunucusu

`server/` klasörü, Cloudflare Workers ve D1 (SQLite) üzerinde çalışan küçük bir sunucudur. Cloudflare'in ücretsiz planı yeterlidir.

- `server/src/index.js`: istekleri karşılar. Uç noktalar: `POST /v1/oyuncu`, `POST /v1/skor`, `GET /v1/tablo?donem=gun|hafta|ay|tum`, `POST /v1/gizle` (yönetici).
- `server/migrations/`: veritabanı şeması.
- `js/leaderboard-rules.js`: uygulamayla ortak kurallar. Sunucu, telefondan gelen puana güvenmez; günün kelimesini kendisi hesaplar, tahminleri doğrular ve puanı kendisi verir. Her oyuncu her gün için tek skor gönderebilir, tarih Türkiye saatine göre alınır.
- Oyuncu adları benzersizdir. `nameKey()` adı karşılaştırma anahtarına çevirir (küçük harf, `ı/i`, `ş/s` gibi Türkçe harfler ve şapkalar sadeleşir, boşluk, nokta, tire ve alt çizgi atılır); `players.name_key` üzerinde tekil indeks vardır. Alınmış bir adla kayıt ya da ad değişikliği 409 döner, uygulama da oyuncudan başka bir ad ister. `0003_benzersiz_ad.sql` taşıması eski çift kayıtlardan en çok oyunu olanı bırakır, diğerlerini anahtarsız bırakıp gizler; bu oyuncular yeni bir ad seçince yeniden görünür.
- Profildeki "Tüm verileri sıfırla" oyun verilerini siler ama skor tablosu kimliğini (`playerId`, `playerSecret`) korur. Sunucudaki skorlar silinmez.
- Oyuncu kimliği cihazda üretilen rastgele bir kimlik ve gizli anahtardan oluşur; sunucu yalnızca anahtarın SHA-256 özetini saklar.

### Kurulum

`.github/workflows/skor.yml`, `server/` değiştiğinde ya da elle çalıştırıldığında sunucuyu Cloudflare'e kurar. Veritabanı yoksa oluşturur, şemayı uygular ve sunucu adresini iş akışı özetine yazar. Gereken repository secrets:

| Secret | İçerik |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | "Edit Cloudflare Workers" şablonu + D1 düzenleme yetkisi olan API anahtarı |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare hesap kimliği |
| `LINGO_ADMIN_KEY` | İsteğe bağlı. Uygunsuz adları gizlemek için yönetici anahtarı |

Kurulumdan sonra sunucu adresi `js/config.js` içindeki `LEADERBOARD_URL` değerine yazılır. Bu değer boşken uygulama skor tablosunu "henüz hazır değil" olarak gösterir ve hiçbir veri göndermez.

### Yerelde çalıştırma

```bash
cd server
npx wrangler d1 migrations apply lingo-skor --local
npx wrangler dev --local --port 8787
```

### Uygunsuz bir adı gizlemek

```bash
curl -X POST https://SUNUCU-ADRESİ/v1/gizle \
  -H "authorization: Bearer YÖNETİCİ_ANAHTARI" -H "content-type: application/json" \
  -d '{"id":"OYUNCU_KİMLİĞİ"}'
```
