// ==========================================
// FILE 1: tis_shared.js - CẤU HÌNH & TIỆN ÍCH CHUNG
// ==========================================

const ONE_DAY_MS  = 24 * 60 * 60 * 1000;
const FIFTEEN_MIN = 15 * 60 * 1000;

const KEY_CREATOR = "TIS:creatorName";
const WEBHOOK_URL = "https://discord.com/api/webhooks/1413457417324204155/VQXpvb7hMWeH7v85Ww8kChXrAX8RnUOLLvtaUANUnEXz_3oBqX6XtCrYvbJ-aGK_Ek3m";

const ORDER_CODE_RE = /\b[A-Z]{3,}\d{6,}\b/;
const SUCCESS_RE = /(tạo|đặt)\s*đơn(\s*hàng)?\s*thành\s*công/i;
const BAD_ADDR_PAT = /(giấy chứng nhận|sở kế hoạch|đầu tư|cấp ngày)/i;

const LOGO_GITHUB = "https://raw.githubusercontent.com/tisductruongit/extension_TIS/refs/heads/main/qr.png";
const LOGO_EXT = (typeof chrome !== "undefined" && chrome.runtime?.getURL) ? chrome.runtime.getURL("qr.png") : "";
const LOGO_DATAURL = "data:image/svg+xml;utf8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="50%" y="55%" font-size="42" font-weight="700" text-anchor="middle"
        fill="#E30613" font-family="Arial, Helvetica, sans-serif">TIS</text>
</svg>`);

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => root.querySelectorAll(sel);

function saveToLocal(obj) { return new Promise(r => chrome.storage.local.set(obj, r)); }
function getFromLocal(keys) { return new Promise(r => chrome.storage.local.get(keys, r)); }
function removeNode(sel) { const el = $(sel); if (el) el.remove(); }
function digitsOnly(s) { return (s || "").replace(/\D/g, ""); }
function pickFirst(...vals){ for (const v of vals){ if (v==null) continue; const s=String(v).trim(); if (s) return s; } return ""; }
function splitLines(text){ return (text || "").split("\n").map(s=>s.trim()).filter(Boolean); }

function createLogo(onLoaded) {
  const img = document.createElement("img");
  img.alt = "Logo"; img.referrerPolicy = "no-referrer";
  Object.assign(img.style,{width:"80px",height:"80px",objectFit:"contain",flexShrink:"0"});
  const sources = [LOGO_GITHUB, LOGO_EXT, LOGO_DATAURL].filter(Boolean);
  let i=0, done=false;
  const next=()=>{ if(!done){ if(i>=sources.length){ done=true; onLoaded&&onLoaded(); } else { img.src = sources[i++]; }}};
  img.onload=()=>{ if(!done){ done=true; onLoaded&&onLoaded(); }};
  img.onerror=next; next(); return img;
}

// ---- QUẢN LÝ TÊN NHÂN VIÊN ----
async function getCreatorName(){ const g = await getFromLocal(KEY_CREATOR); return (g[KEY_CREATOR] || "").trim(); }

async function ensureCreatorName() {
  let name = await getCreatorName();
  if (!name) {
    name = window.prompt("TIS VIP PRO:\nVui lòng nhập tên để định danh:");
    if (name && name.trim()) await saveToLocal({ [KEY_CREATOR]: name.trim() });
  }
}

// ---- QUẢN LÝ CACHE ĐƠN HÀNG ----
async function saveOrderToCache(orderCode, receiver) {
  await saveToLocal({ [`TIS:orderCache:${orderCode}`]: { receiver, ts: Date.now() } });
}

function cleanupOldCache() {
  chrome.storage.local.get(null, (all) => {
    const now = Date.now();
    for (const k of Object.keys(all)) {
      if (k.startsWith("TIS:orderCache:") || k.startsWith("TIS:orderFull:")) {
        const ts = all[k]?.ts || 0; if (now - ts > ONE_DAY_MS) chrome.storage.local.remove(k);
      }
    }
    const snap = all["TIS:lastReceiverDraft"];
    if (snap && now - (snap.ts || 0) > FIFTEEN_MIN) chrome.storage.local.remove("TIS:lastReceiverDraft");
  });
}

function getFullOrderByCode(code) {
  return new Promise((resolve) => chrome.storage.local.get(`TIS:orderFull:${code}`, (g) => resolve(g[`TIS:orderFull:${code}`]?.data || null)));
}

// ---- GỬI DISCORD ----
async function isDiscordSent(code){ const g = await getFromLocal(`TIS:discordSent:${code}`); return !!g[`TIS:discordSent:${code}`]; }
function markDiscordSent(code){ return saveToLocal({ [`TIS:discordSent:${code}`]: true }); }

async function notifyDiscord(orderCode, receiver, fullJson) {
  if (await isDiscordSent(orderCode)) return;

  const creator = await getCreatorName();
  const title = creator || "TIS";
  let fullJsonString = "—";
  if (fullJson) {
    try { fullJsonString = JSON.stringify(fullJson, null, 2); } catch (e) { fullJsonString = "Lỗi khi parse JSON."; }
  }

  let description = [ `**Mã đơn:** \`${orderCode}\``, "\n--- **Full Data** ---", "```json", fullJsonString, "```" ].join("\n");

  if (description.length > 4050) {
    const overhead = description.length - fullJsonString.length;
    const allowedJsonLength = 4050 - overhead;
    fullJsonString = (allowedJsonLength > 20) ? fullJsonString.substring(0, allowedJsonLength) + "\n... (data truncated)" : "... (Data quá dài để hiển thị)";
    description = [ `**Mã đơn:** \`${orderCode}\``, "\n--- **Full Data (Truncated)** ---", "```json", fullJsonString, "```" ].join("\n");
  }

  const payload = {
    username: "TIS 247Express Bot",
    embeds: [{ title, description, color: 0xE30613, footer: { text: "TIS Extension" }, timestamp: new Date().toISOString() }]
  };

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    if (res.ok) {
      await markDiscordSent(orderCode);
      sessionStorage.setItem('TIS_AUTO_RELOAD', 'first');
      setTimeout(() => { window.location.reload(); }, 1000);
    }
  } catch (e) { console.warn("Gửi Discord thất bại:", e); }
}