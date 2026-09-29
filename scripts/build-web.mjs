// Capacitor'ın paketleyeceği web dosyalarını www/ klasörüne kopyalar.
// Uygulamanın kendisinde build adımı yok; bu yalnızca Android derlemesi için.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const out = new URL('../www/', import.meta.url);
const include = ['index.html', 'manifest.webmanifest', 'css', 'js', 'data', 'assets'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const item of include) {
  cpSync(new URL(item, root), new URL(item, out), {
    recursive: true,
    filter: (src) => !src.endsWith('LICENSE-KeNet.txt'),
  });
}
console.log(`www/ hazır: ${include.join(', ')}`);
