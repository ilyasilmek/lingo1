// data/ altındaki kelime listelerini ve anlamları gerektiğinde yükler.
// Kaynak ve üretim: scripts/build-words.mjs
const cache = new Map();

function load(file, parse) {
  if (!cache.has(file)) {
    const p = fetch(`data/${file}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${file} yüklenemedi (${r.status})`);
        return r.text();
      })
      .then(parse);
    p.catch(() => cache.delete(file));
    cache.set(file, p);
  }
  return cache.get(file);
}

const lines = (t) => t.split('\n').filter(Boolean);

export async function loadWords(length) {
  const [answers, valid, meanings] = await Promise.all([
    load(`answers-${length}.txt`, lines),
    load(`valid-${length}.txt`, lines),
    load(`meanings-${length}.json`, JSON.parse),
  ]);
  return { answers, valid: new Set(valid), meanings };
}
