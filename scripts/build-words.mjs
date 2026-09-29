// data/ altındaki kelime listelerini üretir.
//
// Kaynaklar:
// 1. TDK Güncel Türkçe Sözlük, 12. baskı dökümü (99.236 madde):
//    https://github.com/ogun/guncel-turkce-sozluk  -> sozluk/v12/v12.gts.json.tar.gz
//    Açılan gts.json dosyasının yolu ilk argüman olarak verilir. Dosya 110 MB olduğu için repoda tutulmaz.
// 2. an-array-of-turkish-words (MIT): metin derleminden çıkarılmış, sıklığa göre sıralı kelimeler.
//    Cevap havuzunu "gündelik dilde geçen" kelimelerle sınırlamak için kullanılır.
//
// Çıktılar (n = 4..9):
//   data/valid-n.txt   TDK'daki n harfli tüm maddeler. Tahmin doğrulaması için.
//   data/answers-n.txt Bunların derlemde ilk RANK_LIMIT içinde geçenleri. Cevaplar buradan seçilir.
//
// Kullanım: node scripts/build-words.mjs /yol/gts.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const corpus = require('an-array-of-turkish-words');

const MIN = 4;
const MAX = 9;
const RANK_LIMIT = 60000;
const LETTERS = /^[abcçdefgğhıijklmnoöprsştuüvyz]+$/;

// Anlamların tamamı bu etiketlerden birini taşıyorsa kelime cevap olmaz (tahmin olarak yine geçerli).
const ANSWER_EXCLUDE_TAGS = ['argo', 'kaba konuşmada', 'eskimiş', 'hakaret', 'ağızlardan'];
// Etiketi olmayan ama cevap olarak sorulmaması gereken kelimeler.
const ANSWER_BLOCK = new Set([
  'sidik', 'bok', 'boktan', 'sıçmak', 'osurmak', 'osuruk', 'orospu', 'kahpe', 'fahişe', 'pezevenk',
  'ibne', 'kaltak', 'sürtük', 'puşt', 'gavat', 'kancık', 'yarak', 'taşak', 'amcık', 'sikmek',
  'göt', 'götlek', 'meme', 'memeli', 'kızlık', 'döl', 'dölyatağı', 'zina', 'tecavüz', 'intihar',
]);

const path = process.argv[2];
if (!path) {
  console.error('Kullanım: node scripts/build-words.mjs /yol/gts.json');
  process.exit(1);
}

const flat = (w) => w.toLocaleLowerCase('tr-TR').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');

const words = new Map(); // kelime -> anlamların hepsi hariç tutulan etiketleri mi taşıyor
for (const line of readFileSync(path, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const entry = JSON.parse(line);
  if (entry.ozel_mi === '1') continue;
  const w = flat(entry.madde);
  if (!LETTERS.test(w)) continue;
  const n = [...w].length;
  if (n < MIN || n > MAX) continue;
  const senses = entry.anlamlarListe || [];
  const excluded = senses.length > 0 && senses.every((s) =>
    (s.ozelliklerListe || []).some((o) => ANSWER_EXCLUDE_TAGS.includes(o.tam_adi)));
  // Aynı yazılışa sahip maddelerden biri bile uygunsa kelime uygun sayılır.
  words.set(w, words.has(w) ? words.get(w) && excluded : excluded);
}

const rank = new Map();
corpus.forEach((w, i) => { if (!rank.has(w)) rank.set(w, i); });

mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
const up = (w) => w.toLocaleUpperCase('tr-TR');
const sort = (a) => a.sort((x, y) => x.localeCompare(y, 'tr'));

for (let n = MIN; n <= MAX; n++) {
  const all = [...words.keys()].filter((w) => [...w].length === n);
  const answers = all.filter((w) => !words.get(w) && !ANSWER_BLOCK.has(w) && (rank.get(w) ?? Infinity) < RANK_LIMIT);
  writeFileSync(new URL(`../data/valid-${n}.txt`, import.meta.url), sort(all.map(up)).join('\n') + '\n');
  writeFileSync(new URL(`../data/answers-${n}.txt`, import.meta.url), sort(answers.map(up)).join('\n') + '\n');
  console.log(`${n} harf: ${all.length} geçerli, ${answers.length} cevap`);
}
