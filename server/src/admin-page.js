// Yönetici sayfası: /yonetim. Sayfa herkese açık bir kutudan ibarettir; veriler ve işlemler
// yalnızca doğru yönetici anahtarıyla gelir. Anahtar yalnızca bu sekmenin oturumunda tutulur.
export const ADMIN_HTML = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Lingo Yönetim</title>
<style>
  :root { --bg:#f8f9ff; --card:#fff; --text:#0b1c30; --muted:#475569; --line:#e2e8f0; --primary:#ff8a4c; --danger:#ba1a1a; --ok:#006c4b; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0f172a; --card:#1e293b; --text:#f8fafc; --muted:#94a3b8; --line:#334155; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width:760px; margin:0 auto; padding:24px 16px 48px; }
  h1 { margin:0 0 4px; font-size:24px; }
  p { color:var(--muted); margin:0 0 16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; margin-bottom:14px; }
  input { width:100%; height:44px; padding:0 12px; border-radius:10px; border:1.5px solid var(--line); background:var(--card); color:var(--text); font:inherit; }
  button { height:40px; padding:0 16px; border:0; border-radius:999px; font:inherit; font-weight:700; cursor:pointer; background:var(--primary); color:#fff; }
  button.ghost { background:transparent; color:var(--muted); border:1.5px solid var(--line); }
  button.hide { background:var(--danger); }
  button.show { background:var(--ok); }
  .row { display:flex; gap:10px; align-items:center; }
  .row input { flex:1; }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:10px 6px; border-bottom:1px solid var(--line); vertical-align:middle; }
  th { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
  td.num { font-variant-numeric:tabular-nums; }
  tr.hidden td { opacity:.55; }
  .tag { font-size:12px; font-weight:700; padding:2px 8px; border-radius:999px; background:#ffdad6; color:var(--danger); }
  .msg { min-height:20px; margin:8px 0 0; font-weight:600; }
  .msg.err { color:var(--danger); }
  .id { font-family: ui-monospace, monospace; font-size:11px; color:var(--muted); }
  [hidden] { display:none !important; }
</style>
</head>
<body>
<main>
  <h1>Lingo Yönetim</h1>
  <p>Skor tablosundaki uygunsuz adları gizlemek için. Gizlenen oyuncunun skorları silinmez, yalnızca listelerde görünmez.</p>

  <section class="card" id="login">
    <form class="row" id="login-form">
      <input id="key" type="password" autocomplete="current-password" placeholder="Yönetici anahtarı" required>
      <button type="submit">Giriş</button>
    </form>
    <div class="msg err" id="login-msg"></div>
  </section>

  <section id="panel" hidden>
    <div class="card">
      <form class="row" id="search-form">
        <input id="q" placeholder="Ada göre ara (boş bırakılırsa son kayıtlar)">
        <button type="submit">Ara</button>
        <button type="button" class="ghost" id="logout">Çıkış</button>
      </form>
      <div class="msg" id="panel-msg"></div>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Ad</th><th>Oyun</th><th>Puan</th><th>Son oyun</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </section>
</main>
<script>
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  let key = sessionStorage.getItem('lingo-admin-key') || '';

  async function api(path, body) {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || ('Hata ' + res.status)); e.status = res.status; throw e; }
    return data;
  }

  async function load() {
    const q = $('q').value.trim();
    $('panel-msg').textContent = 'Yükleniyor…';
    try {
      const data = await api('/v1/yonetim/oyuncular?ara=' + encodeURIComponent(q));
      $('rows').innerHTML = data.players.map((p) => \`
        <tr class="\${p.hidden ? 'hidden' : ''}">
          <td><strong>\${esc(p.name)}</strong> \${p.hidden ? '<span class="tag">Gizli</span>' : ''}<div class="id">\${p.id}</div></td>
          <td class="num">\${p.games}</td>
          <td class="num">\${p.points}</td>
          <td>\${p.last_day || '-'}</td>
          <td>\${p.hidden
            ? \`<button class="show" data-id="\${p.id}" data-hidden="false">Göster</button>\`
            : \`<button class="hide" data-id="\${p.id}" data-hidden="true">Gizle</button>\`}</td>
        </tr>\`).join('') || '<tr><td colspan="5">Oyuncu bulunamadı.</td></tr>';
      $('panel-msg').textContent = data.players.length + ' oyuncu gösteriliyor (toplam ' + data.total + ').';
    } catch (e) {
      if (e.status === 401 || e.status === 429) return logout(e.message);
      $('panel-msg').textContent = e.message;
    }
  }

  function showPanel() { $('login').hidden = true; $('panel').hidden = false; load(); }
  function logout(message = '') {
    key = ''; sessionStorage.removeItem('lingo-admin-key');
    $('panel').hidden = true; $('login').hidden = false; $('login-msg').textContent = message; $('key').value = '';
  }

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    key = $('key').value.trim();
    $('login-msg').textContent = '';
    try {
      await api('/v1/yonetim/giris');
      sessionStorage.setItem('lingo-admin-key', key);
      showPanel();
    } catch (err) { logout(err.message); }
  });
  $('search-form').addEventListener('submit', (e) => { e.preventDefault(); load(); });
  $('logout').addEventListener('click', () => logout());
  $('rows').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    const hide = b.dataset.hidden === 'true';
    if (hide && !confirm('Bu oyuncu skor tablosundan gizlensin mi?')) return;
    b.disabled = true;
    try { await api('/v1/gizle', { id: b.dataset.id, hidden: hide }); await load(); }
    catch (err) { $('panel-msg').textContent = err.message; b.disabled = false; }
  });
  if (key) showPanel();
</script>
</body>
</html>`;
