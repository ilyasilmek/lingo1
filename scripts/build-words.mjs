// data/ altındaki kelime listelerini üretir.
//
// Kaynaklar:
// 1. TDK Güncel Türkçe Sözlük, 12. baskı dökümü (99.236 madde):
//    https://github.com/ogun/guncel-turkce-sozluk  -> sozluk/v12/v12.gts.json.tar.gz
//    Açılan gts.json dosyasının yolu ilk argüman olarak verilir. Dosya 110 MB olduğu için repoda tutulmaz.
// 2. an-array-of-turkish-words (MIT): metin derleminden çıkarılmış, sıklığa göre sıralı kelimeler.
//    Cevap havuzunu "gündelik dilde geçen" kelimelerle sınırlamak için kullanılır.
// 3. KeNet, Türkçe WordNet (GPL-3.0, https://github.com/StarlangSoftware/TurkishWordNet):
//    kelime anlamları. npm paketi nlptoolkit-wordnet içindeki turkish_wordnet.xml dosyasının yolu
//    ikinci argüman olarak verilir. KeNet'te tanımı olmayan kelimeler cevap olarak seçilmez.
//
// Çıktılar (n = 4..9):
//   data/valid-n.txt   TDK'daki n harfli tüm maddeler. Tahmin doğrulaması için.
//   data/answers-n.txt Bunların derlemde ilk RANK_LIMIT içinde geçen ve KeNet'te tanımı olanları.
//   data/meanings-n.json Cevap kelimelerinin KeNet tanımları (en fazla MAX_SENSES anlam).
//
// Kullanım: node scripts/build-words.mjs /yol/gts.json /yol/turkish_wordnet.xml
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const corpus = require('an-array-of-turkish-words');

const MIN = 4;
const MAX = 9;
const RANK_LIMIT = 60000;
const MAX_SENSES = 2;
const LETTERS = /^[abcçdefgğhıijklmnoöprsştuüvyz]+$/;

// Anlamların tamamı bu etiketlerden birini taşıyorsa kelime cevap olmaz (tahmin olarak yine geçerli).
const ANSWER_EXCLUDE_TAGS = ['argo', 'kaba konuşmada', 'eskimiş', 'hakaret', 'ağızlardan'];
// Etiketi olmayan ama cevap olarak sorulmaması gereken kelimeler.
const ANSWER_BLOCK = new Set([
  'sidik', 'bok', 'boktan', 'sıçmak', 'osurmak', 'osuruk', 'orospu', 'kahpe', 'fahişe', 'pezevenk',
  'ibne', 'kaltak', 'sürtük', 'puşt', 'gavat', 'kancık', 'yarak', 'taşak', 'amcık', 'sikmek',
  'göt', 'götlek', 'meme', 'memeli', 'kızlık', 'döl', 'dölyatağı', 'zina', 'tecavüz', 'intihar',
]);

const [path, wordnetPath] = process.argv.slice(2);
if (!path || !wordnetPath) {
  console.error('Kullanım: node scripts/build-words.mjs /yol/gts.json /yol/turkish_wordnet.xml');
  process.exit(1);
}

const flat = (w) => w.toLocaleLowerCase('tr-TR').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');

// KeNet: her yazılış için anlam numarasına göre sıralı tanımlar.
const decode = (t) => t.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const senses = new Map();
for (const [, block] of readFileSync(wordnetPath, 'utf8').matchAll(/<SYNSET>([\s\S]*?)<\/SYNSET>/g)) {
  const def = decode((block.match(/<DEF>([\s\S]*?)<\/DEF>/) || [])[1]?.trim() || '');
  // "Bir tarih", "Bir yüzde" gibi yer tutucu tanımlar atlanır.
  if (def.length < 8 || /^Bir [^ ]+$/.test(def)) continue;
  for (const [, literal, sense] of block.matchAll(/<LITERAL>([^<]+)<SENSE>(\d+)<\/SENSE>/g)) {
    const w = flat(decode(literal.trim()));
    if (!senses.has(w)) senses.set(w, []);
    senses.get(w).push({ sense: Number(sense), def });
  }
}
// Kelimenin kendisini içeren tanımlar (KeNet'te eş anlamlı birleştirmesinden kalan
// "..., olağan, düzgülü" gibi listeler) başka tanım varsa elenir.
function meaningsOf(w) {
  const list = [...new Set((senses.get(w) || []).sort((a, b) => a.sense - b.sense).map((x) => x.def))];
  const self = new RegExp(`(^|[^a-zçğıöşüâîû])${w}($|[^a-zçğıöşüâîû])`, 'i');
  const clean = list.filter((d) => !self.test(d.toLocaleLowerCase('tr-TR')));
  return (clean.length ? clean : list).slice(0, MAX_SENSES);
}

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
  const answers = sort(all.filter((w) => !words.get(w) && !ANSWER_BLOCK.has(w)
    && (rank.get(w) ?? Infinity) < RANK_LIMIT && meaningsOf(w).length));
  const meanings = Object.fromEntries(answers.map((w) => [up(w), meaningsOf(w)]));
  writeFileSync(new URL(`../data/valid-${n}.txt`, import.meta.url), sort(all.map(up)).join('\n') + '\n');
  writeFileSync(new URL(`../data/answers-${n}.txt`, import.meta.url), answers.map(up).join('\n') + '\n');
  writeFileSync(new URL(`../data/meanings-${n}.json`, import.meta.url), JSON.stringify(meanings, null, 0) + '\n');
  console.log(`${n} harf: ${all.length} geçerli, ${answers.length} cevap`);
}
