// js/dictionary.js dosyasını üretir. Kaynak: an-array-of-turkish-words (MIT).
// Kullanım: npm run build:dict
// Paket sıklığa göre sıralı ve gürültülü (kesik özel adlar, İngilizce kelimeler) olduğu için
// yalnızca en sık geçen ilk N beş harfli kelime alınır. Bu liste tahmin doğrulaması içindir,
// cevaplar js/words.js'den gelir.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { ANSWER_LIST } from '../js/words.js';

const require = createRequire(import.meta.url);
const words = require('an-array-of-turkish-words');

const LIMIT = 8000;
const BLOCK = new Set(['nigga', 'fucks', 'penis', 'money', 'james', 'house', 'world', 'music', 'about', 'there', 'where']);
const re = /^[abcçdefgğhıijklmnoöprsştuüvyz]{5}$/;

const picked = [];
const seen = new Set();
for (const w of words) {
  if (!re.test(w) || seen.has(w) || BLOCK.has(w)) continue;
  seen.add(w);
  picked.push(w.toLocaleUpperCase('tr-TR'));
  if (picked.length >= LIMIT) break;
}
const all = [...new Set([...picked, ...ANSWER_LIST])].sort((a, b) => a.localeCompare(b, 'tr'));

const body = `// Otomatik üretildi: scripts/build-dictionary.mjs. Elle düzenlemeyin.
// Kaynak: an-array-of-turkish-words (MIT, https://github.com/hexapode/an-array-of-turkish-words)
export const VALID_WORDS = new Set(${JSON.stringify(all.join(' '))}.split(' '));
`;
writeFileSync(new URL('../js/dictionary.js', import.meta.url), body);
console.log(`${all.length} kelime yazıldı`);
