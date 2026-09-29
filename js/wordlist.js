// data/ altındaki kelime listelerini gerektiğinde yükler. Kaynak ve üretim: scripts/build-words.mjs
const cache = new Map();

function loadList(name) {
  if (!cache.has(name)) {
    const p = fetch(`data/${name}.txt`)
      .then((r) => {
        if (!r.ok) throw new Error(`${name} yüklenemedi (${r.status})`);
        return r.text();
      })
      .then((t) => t.split('\n').filter(Boolean));
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return cache.get(name);
}

export async function loadWords(length) {
  const [answers, valid] = await Promise.all([loadList(`answers-${length}`), loadList(`valid-${length}`)]);
  return { answers, valid: new Set(valid) };
}
