/*
 * הנגן שלי – שירים מגוגל דרייב
 * ------------------------------------------------------------
 * Cloudflare Worker שמשמיע לנגן קבצי שמע מתיקיות דרייב מאושרות.
 * רק מי שמחובר לנגן עם חשבון ספוטיפיי שהמייל שלו ברשימה ALLOWED_EMAILS יקבל גישה.
 * הקבצים עצמם נשארים פרטיים בדרייב: הגישה אליהם היא רק דרך חשבון שירות (service account)
 * שאיתו שיתפת את התיקיות, בהרשאת צפייה בלבד.
 *
 * הגדרות (Settings → Variables and Secrets ב-Cloudflare):
 *   GOOGLE_SA_KEY   (Secret)  – כל התוכן של קובץ ה-JSON של חשבון השירות
 *   SIGN_SECRET     (Secret)  – מחרוזת אקראית ארוכה כלשהי
 *   ALLOWED_EMAILS  (Text)    – מיילים של חשבונות הספוטיפיי המורשים, מופרדים בפסיקים
 *   DRIVE_FOLDERS   (Text)    – מזהי תיקיות הדרייב המאושרות, מופרדים בפסיקים
 *   DRIVE_FILES     (Text, לא חובה) – מזהי קבצים בודדים מאושרים (צריך לשתף כל קובץ עם חשבון השירות)
 *   EXCLUDE_FILES   (Text, לא חובה) – מזהי קבצים להסתרה, מופרדים בפסיקים
 */

const ORIGINS = ['https://litalgozlan-coder.github.io', 'http://127.0.0.1:8080'];
const AUDIO_EXT = { mp3:'audio/mpeg', m4a:'audio/mp4', mp4:'audio/mp4', aac:'audio/aac', wav:'audio/wav', ogg:'audio/ogg', oga:'audio/ogg', opus:'audio/ogg', flac:'audio/flac', webm:'audio/webm' };
const TICKET_HOURS = 12;
const LIB_TTL = 10 * 60 * 1000;
const ME_TTL = 10 * 60 * 1000;

const list = s => String(s || '').split(/[\s,]+/).map(x => x.trim()).filter(Boolean);

function cors(req, h = {}){
  const o = req.headers.get('Origin');
  const out = new Headers(h);
  if (o && ORIGINS.includes(o)){ out.set('Access-Control-Allow-Origin', o); out.set('Vary', 'Origin'); }
  out.set('Access-Control-Allow-Headers', 'Authorization, Range');
  out.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  out.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  return out;
}
const json = (req, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: cors(req, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }) });

/* ---------- חתימות (HMAC) ---------- */
const enc = new TextEncoder();
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
let hmacKey = null;
async function hmac(env, msg){
  if (!hmacKey) hmacKey = await crypto.subtle.importKey('raw', enc.encode(env.SIGN_SECRET), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', hmacKey, enc.encode(msg)));
}
async function sha(s){ return b64url(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
function same(a, b){ if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

/* ---------- זיהוי המשתמש דרך ספוטיפיי ---------- */
const meCache = new Map();
async function spotifyUser(req, env){
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') || '');
  if (!m) return { error:'missing token', status:401 };
  const key = await sha(m[1]);
  const c = meCache.get(key);
  if (c && Date.now() - c.t < ME_TTL) return c.v;
  const r = await fetch('https://api.spotify.com/v1/me', { headers:{ Authorization:'Bearer ' + m[1] } });
  if (!r.ok) return { error:'spotify ' + r.status, status: r.status === 401 ? 401 : 403 };
  const me = await r.json();
  const email = String(me.email || '').toLowerCase();
  const allowed = list(env.ALLOWED_EMAILS).map(x => x.toLowerCase());
  const v = allowed.includes(email) ? { email } : { error:'not allowed: ' + email, status:403 };
  meCache.set(key, { t: Date.now(), v });
  if (meCache.size > 200) meCache.delete(meCache.keys().next().value);
  return v;
}

/* ---------- גוגל: טוקן של חשבון השירות ---------- */
let gTok = null;
async function googleToken(env){
  if (gTok && Date.now() < gTok.exp) return gTok.access;
  const sa = JSON.parse(env.GOOGLE_SA_KEY);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(enc.encode(JSON.stringify({ alg:'RS256', typ:'JWT' })));
  const claim = b64url(enc.encode(JSON.stringify({ iss: sa.client_email, scope:'https://www.googleapis.com/auth/drive.readonly',
    aud:'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['sign']);
  const sig = b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(head + '.' + claim)));
  const r = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claim + '.' + sig }) });
  const j = await r.json();
  if (!r.ok) throw new Error('google token: ' + (j.error_description || j.error || r.status));
  gTok = { access: j.access_token, exp: Date.now() + (j.expires_in - 120) * 1000 };
  return gTok.access;
}
async function drive(env, path, query){
  const t = await googleToken(env);
  const u = 'https://www.googleapis.com/drive/v3/' + path + (query ? '?' + new URLSearchParams(query) : '');
  const r = await fetch(u, { headers:{ Authorization:'Bearer ' + t } });
  if (!r.ok) throw new Error('drive ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

/* ---------- הספרייה: התיקיות המאושרות ותתי-התיקיות שלהן ---------- */
const extOf = f => (f.fileExtension || (/\.([a-z0-9]+)$/i.exec(f.name || '') || [])[1] || '').toLowerCase();
const isAudio = f => !!AUDIO_EXT[extOf(f)] || /^audio\//.test(f.mimeType || '');
const clean = n => String(n || '').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
async function children(env, id){
  const out = []; let pageToken;
  do {
    const j = await drive(env, 'files', { q:`'${id}' in parents and trashed=false`, pageSize:'1000', orderBy:'name_natural',
      fields:'nextPageToken,files(id,name,mimeType,size,fileExtension)', supportsAllDrives:'true', includeItemsFromAllDrives:'true',
      ...(pageToken ? { pageToken } : {}) });
    out.push(...(j.files || [])); pageToken = j.nextPageToken;
  } while (pageToken);
  return out;
}
let lib = null, libAt = 0, libLoading = null;
async function library(env){
  if (lib && Date.now() - libAt < LIB_TTL) return lib;
  if (libLoading) return libLoading;
  libLoading = (async () => {
    const skip = new Set(list(env.EXCLUDE_FILES));
    const folders = [], files = new Map();
    const walk = async (id, name, depth) => {
      const kids = await children(env, id);
      const tracks = kids.filter(f => isAudio(f) && !skip.has(f.id)).map(f => {
        const t = { id: f.id, name: clean(f.name), size: +f.size || 0, type: AUDIO_EXT[extOf(f)] || f.mimeType };
        files.set(f.id, t); return t;
      });
      if (tracks.length) folders.push({ id, name, tracks });
      if (depth < 2) for (const sub of kids.filter(f => f.mimeType === 'application/vnd.google-apps.folder')) await walk(sub.id, name + ' / ' + sub.name, depth + 1);
    };
    for (const id of list(env.DRIVE_FOLDERS)){
      try{ const f = await drive(env, 'files/' + id, { fields:'id,name', supportsAllDrives:'true' }); await walk(id, f.name, 0); }
      catch(e){ folders.push({ id, name:'(תיקייה לא נגישה – צריך לשתף אותה עם חשבון השירות)', tracks:[], error: String(e.message || e) }); }
    }
    const singles = [];
    for (const id of list(env.DRIVE_FILES)){
      try{
        const f = await drive(env, 'files/' + id, { fields:'id,name,mimeType,size,fileExtension', supportsAllDrives:'true' });
        if (!isAudio(f) || skip.has(f.id)) continue;
        const t = { id: f.id, name: clean(f.name), size: +f.size || 0, type: AUDIO_EXT[extOf(f)] || f.mimeType };
        files.set(f.id, t); singles.push(t);
      }catch(e){}
    }
    if (singles.length) folders.push({ id:'singles', name:'שירים בודדים', tracks: singles });
    lib = { folders, files }; libAt = Date.now();
    return lib;
  })().finally(() => { libLoading = null; });
  return libLoading;
}

/* ---------- ניתוב ---------- */
export default {
  async fetch(req, env){
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status:204, headers: cors(req) });
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(req, { error:'method' }, 405);
    try{
      if (url.pathname === '/' ) return json(req, { ok:true, service:'my-player-drive' });

      /* רשימת השירים + כרטיס כניסה חתום לשמיעה */
      if (url.pathname === '/library'){
        const u = await spotifyUser(req, env);
        if (u.error) return json(req, { error: u.error }, u.status);
        const L = await library(env);
        const exp = Date.now() + TICKET_HOURS * 3600 * 1000;
        const who = (await sha(u.email)).slice(0, 16);
        const sig = await hmac(env, who + '.' + exp);
        return json(req, { folders: L.folders.map(f => ({ id: f.id, name: f.name, tracks: f.tracks, error: f.error })), ticket: `w=${who}&e=${exp}&k=${sig}`, exp });
      }

      /* השמעה של קובץ (תומך בדילוג בתוך השיר) */
      const m = /^\/f\/([A-Za-z0-9_-]{10,})$/.exec(url.pathname);
      if (m){
        const who = url.searchParams.get('w') || '', exp = +url.searchParams.get('e') || 0, k = url.searchParams.get('k') || '';
        if (!exp || Date.now() > exp || !same(k, await hmac(env, who + '.' + exp))) return json(req, { error:'ticket expired' }, 403);
        const L = await library(env);
        const t = L.files.get(m[1]);
        if (!t) return json(req, { error:'not in approved folders' }, 404);
        const h = { Authorization:'Bearer ' + await googleToken(env) };
        const range = req.headers.get('Range'); if (range) h.Range = range;
        const r = await fetch(`https://www.googleapis.com/drive/v3/files/${m[1]}?alt=media&supportsAllDrives=true`, { headers: h });
        if (!r.ok && r.status !== 206) return json(req, { error:'drive ' + r.status }, r.status === 416 ? 416 : 502);
        const out = cors(req, { 'Content-Type': t.type || 'audio/mpeg', 'Accept-Ranges':'bytes', 'Cache-Control':'private, max-age=3600' });
        for (const n of ['Content-Length', 'Content-Range']) if (r.headers.get(n)) out.set(n, r.headers.get(n));
        return new Response(req.method === 'HEAD' ? null : r.body, { status: r.status, headers: out });
      }
      return json(req, { error:'not found' }, 404);
    }catch(e){
      return json(req, { error: String(e && e.message || e) }, 500);
    }
  }
};
