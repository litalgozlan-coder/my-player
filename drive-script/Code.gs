/**
 * הנגן שלי – שירים מגוגל דרייב (Google Apps Script)
 * ------------------------------------------------------------
 * הסקריפט רץ בחשבון הגוגל שלך ונותן לנגן את קבצי השמע מהתיקיות המאושרות.
 * הקבצים נשארים פרטיים בדרייב. רק מי שמחובר לנגן עם חשבון ספוטיפיי שהמייל שלו ברשימה למטה מקבל אותם.
 *
 * כדי לשנות תוכן: לעדכן את הרשימות כאן, לשמור, ואז Deploy → Manage deployments → ✏️ → Version: New version → Deploy.
 */

/* חשבונות ספוטיפיי מורשים */
const ALLOWED_EMAILS = [
  'lital.gozlan@gmail.com',
  'naama.samara@gmail.com',
  'daniel.haim.samara@gmail.com',
  'guligulsamara@gmail.com'
];

/* תיקיות מאושרות: דוידוני, סיפורים, בחצי הלילה, כוכבים, מתנות, משפחת שאבעס */
const FOLDERS = [
  '1o34W17PkLRAxIV3ncsEfyZ-VJcTotQqu',
  '126lFye1e4vhScpxwZQDb641z_jug3E0m',
  '1BswZ-kIycg4vLwyhu1MD7SkGOvfs0bGb',
  '1QX4soz8M2aA_oBquqmypZadg7ws08hBd',
  '1yfjckklec03YVXiif9LE_PJURlyqT_hC',
  '1fn6nYZVfRRr1_x0J5zTIiph_1QQ13Qy4'
];

/* שירים בודדים מאושרים: יסמין מועלם - יחפים */
const FILES = [
  '1WkcjFTvcXu8afLdgRpV0plj-ajOHPf9-'
];

/* קבצים להסתרה (לא חובה) */
const EXCLUDE = [];

/* ------------------------------------------------------------ */
const AUDIO_EXT = { mp3:'audio/mpeg', m4a:'audio/mp4', mp4:'audio/mp4', aac:'audio/aac', wav:'audio/wav', ogg:'audio/ogg', opus:'audio/ogg', flac:'audio/flac', webm:'audio/webm' };

function out_(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function ext_(name){ const m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
function isAudio_(f){ return !!AUDIO_EXT[ext_(f.getName())] || /^audio\//.test(f.getMimeType() || ''); }
function clean_(n){ return String(n || '').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim(); }
function type_(f){ return AUDIO_EXT[ext_(f.getName())] || f.getMimeType(); }

/* בדיקה מול ספוטיפיי מי מחובר לנגן */
function user_(token){
  if (!token) return { error:'missing token' };
  const cache = CacheService.getScriptCache();
  const key = 'me_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  const c = cache.get(key); if (c) return JSON.parse(c);
  const r = UrlFetchApp.fetch('https://api.spotify.com/v1/me', { headers:{ Authorization:'Bearer ' + token }, muteHttpExceptions:true });
  let v;
  if (r.getResponseCode() !== 200) v = { error:'spotify ' + r.getResponseCode() };
  else {
    const email = String(JSON.parse(r.getContentText()).email || '').toLowerCase();
    v = ALLOWED_EMAILS.map(x => x.toLowerCase()).indexOf(email) >= 0 ? { email: email } : { error:'not allowed: ' + email };
  }
  if (!v.error || /^not allowed/.test(v.error)) cache.put(key, JSON.stringify(v), 600);
  return v;
}

/* רשימת השירים (נשמרת 10 דקות) */
function library_(){
  const cache = CacheService.getScriptCache();
  const c = cache.get('lib'); if (c) return JSON.parse(c);
  const skip = {}; EXCLUDE.forEach(id => skip[id] = 1);
  const folders = [];
  const walk = (folder, name, depth) => {
    const tracks = [];
    const it = folder.getFiles();
    while (it.hasNext()){ const f = it.next(); if (isAudio_(f) && !skip[f.getId()]) tracks.push({ id: f.getId(), name: clean_(f.getName()), type: type_(f) }); }
    tracks.sort((a, b) => a.name.localeCompare(b.name, 'he', { numeric:true }));
    if (tracks.length) folders.push({ id: folder.getId(), name: name, tracks: tracks });
    if (depth < 2){ const subs = folder.getFolders(); while (subs.hasNext()){ const s = subs.next(); walk(s, name + ' / ' + s.getName(), depth + 1); } }
  };
  FOLDERS.forEach(id => {
    try{ const f = DriveApp.getFolderById(id); walk(f, f.getName(), 0); }
    catch(e){ folders.push({ id: id, name:'(תיקייה לא נמצאה)', tracks:[], error: String(e) }); }
  });
  const singles = [];
  FILES.forEach(id => { try{ const f = DriveApp.getFileById(id); if (isAudio_(f) && !skip[id]) singles.push({ id: id, name: clean_(f.getName()), type: type_(f) }); }catch(e){} });
  if (singles.length) folders.push({ id:'singles', name:'שירים בודדים', tracks: singles });
  const lib = { folders: folders };
  try{ cache.put('lib', JSON.stringify(lib), 600); }catch(e){}
  return lib;
}

function doGet(e){
  const p = (e && e.parameter) || {};
  try{
    const u = user_(p.t);
    if (u.error) return out_({ error: u.error });
    const lib = library_();
    if (p.a === 'library') return out_(lib);
    if (p.a === 'file'){
      const ok = lib.folders.some(f => f.tracks.some(t => t.id === p.id));
      if (!ok) return out_({ error:'not approved' });
      const f = DriveApp.getFileById(p.id);
      return out_({ type: type_(f), data: Utilities.base64Encode(f.getBlob().getBytes()) });
    }
    return out_({ ok:true });
  }catch(err){
    return out_({ error: String(err && err.message || err) });
  }
}

/* להרצה פעם אחת מהעורך: מאשר את ההרשאות ומראה כמה קבצים נמצאו */
function test(){
  CacheService.getScriptCache().remove('lib');
  const lib = library_();
  lib.folders.forEach(f => Logger.log(f.name + ': ' + f.tracks.length + (f.error ? ' ' + f.error : '')));
  UrlFetchApp.fetch('https://api.spotify.com/v1/', { muteHttpExceptions:true });
}
