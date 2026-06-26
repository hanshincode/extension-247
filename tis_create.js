// ==========================================
// FILE 2: tis_create.js - XỬ LÝ TRANG TẠO ĐƠN
// ==========================================

async function onCreatePage() {
  await ensureCreatorName();

  if (document.referrer.includes("/khach-hang/don-hang")) {
      if (!sessionStorage.getItem('TIS_reloaded_from_don_hang')) {
          sessionStorage.setItem('TIS_reloaded_from_don_hang', 'true');
          location.reload();
          return;
      }
  } else {
      sessionStorage.removeItem('TIS_reloaded_from_don_hang');
  }

  const reloadState = sessionStorage.getItem('TIS_AUTO_RELOAD');
  if (reloadState === 'first') {
    sessionStorage.setItem('TIS_AUTO_RELOAD', 'second');
    setTimeout(() => window.location.reload(), 1000);
  } else if (reloadState === 'second') {
    sessionStorage.removeItem('TIS_AUTO_RELOAD');
  }
    
  cleanupOldCache();
  ensureFloatingPhoneInput();
  watchSuccessAny();
  hookCreateOrderNetwork();
  observeDraftInputs();
  observePhoneInputs();
}

function ensureFloatingPhoneInput() {
  if ($("#tis-floating-phone")) return;

  // BƠM CSS HIỆU ỨNG NEON VÀO TRANG
  if (!document.getElementById("tis-neon-style")) {
    const style = document.createElement("style");
    style.id = "tis-neon-style";
    style.innerHTML = `
      @keyframes tisNeonPulse {
        0% { box-shadow: 0 0 5px #E30613, 0 0 10px #E30613; border-color: #E30613; }
        50% { box-shadow: 0 0 15px #ff4d4d, 0 0 25px #ff4d4d, 0 0 35px #ff4d4d; border-color: #ff4d4d; }
        100% { box-shadow: 0 0 5px #E30613, 0 0 10px #E30613; border-color: #E30613; }
      }
      .tis-neon-warning {
        animation: tisNeonPulse 1s infinite alternate !important;
      }
    `;
    document.head.appendChild(style);
  }

  const wrap = document.createElement("div");
  wrap.id = "tis-floating-phone";
  Object.assign(wrap.style, {
    position: "fixed", bottom: "30px", right: "20px", zIndex: "2147483647", 
    background: "#fff", border: "2px solid #ccc", borderRadius: "10px",
    padding: "12px", display: "flex", flexDirection: "column", gap: "8px", 
    fontFamily: "Arial, sans-serif", width: "220px", transition: "all 0.3s ease"
  });

  const label = document.createElement("label");
  label.innerHTML = "<b style='color:#E30613'>📱 SĐT Người Nhận (TIS)</b><br><small style='color:#666'>Nhập SĐT để tự động dán vào phiếu in</small>";
  label.style.fontSize = "12px";

  const input = document.createElement("input");
  input.type = "tel"; input.placeholder = "Ví dụ: 091xxxx";
  Object.assign(input.style, {
    padding: "8px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "14px",
    width: "100%", boxSizing: "border-box", outline: "none", fontWeight: "bold", color: "#333"
  });

  // Xử lý bật/tắt Neon tuỳ thuộc vào việc có chữ hay chưa
  const updateNeonGlow = (val) => {
    if (!val || val.trim() === "") {
      wrap.classList.add("tis-neon-warning");
    } else {
      wrap.classList.remove("tis-neon-warning");
      wrap.style.borderColor = "#ccc"; // Trả lại viền hiền lành
      wrap.style.boxShadow = "0 8px 16px rgba(0,0,0,0.2)";
    }
  };

  input.onfocus = () => { if(input.value.trim() !== "") wrap.style.borderColor = "#E30613"; };
  input.onblur = () => { if(input.value.trim() !== "") wrap.style.borderColor = "#ccc"; };

  chrome.storage.local.get("TIS:lastReceiverDraft", (g) => {
    const d = g["TIS:lastReceiverDraft"];
    const currentPhone = (d && d.receiver && d.receiver.phone) ? d.receiver.phone : "";
    input.value = currentPhone;
    updateNeonGlow(currentPhone); // Khởi động hiệu ứng khi vừa vào trang
  });

  const saveDraft = () => {
    const val = digitsOnly(input.value);
    updateNeonGlow(val); // Cập nhật hiệu ứng chớp mỗi khi gõ phím
    chrome.storage.local.get("TIS:lastReceiverDraft", (g) => {
      const prev = g["TIS:lastReceiverDraft"] || { receiver: { name: "", address: "", phone: "" }, ts: Date.now() };
      prev.receiver.phone = val; prev.ts = Date.now();
      chrome.storage.local.set({ "TIS:lastReceiverDraft": prev });
    });
  };
  
  input.addEventListener("input", saveDraft); input.addEventListener("change", saveDraft);
  wrap.appendChild(label); wrap.appendChild(input); document.body.appendChild(wrap);
}

function showSuccessOverlay(orderCode, rcv) {
  removeNode("#tis-success-overlay");
  const wrap = document.createElement("div");
  wrap.id = "tis-success-overlay";
  Object.assign(wrap.style, {
    position: "fixed", right: "16px", bottom: "16px", zIndex: "2147483647",
    background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
    boxShadow: "0 10px 20px rgba(0,0,0,0.15)", padding: "14px 16px",
    maxWidth: "480px", fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial", lineHeight: "1.4"
  });

  const title = document.createElement("div");
  Object.assign(title.style, { display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" });
  title.innerHTML = `<div style="font-weight:700">ĐÃ LẤY THÔNG TIN ĐƠN</div>`;
  title.prepend(createLogo());

  const msg = document.createElement("div");
  msg.style.fontSize = "13px"; msg.innerText = `Mã đơn: ${orderCode}`;

  wrap.appendChild(title); wrap.appendChild(msg); document.body.appendChild(wrap);

  const floatInput = $("#tis-floating-phone input");
  if (floatInput) {
      floatInput.value = "";
      floatInput.dispatchEvent(new Event('input')); // Ép nó nháy neon lại báo hiệu cho đơn mới
  }
  chrome.storage.local.get("TIS:lastReceiverDraft", (g) => {
    const d = g["TIS:lastReceiverDraft"];
    if (d && d.receiver) { d.receiver.phone = ""; chrome.storage.local.set({ "TIS:lastReceiverDraft": d }); }
  });

  setTimeout(() => removeNode("#tis-success-overlay"), 20000);
}

function watchSuccessAny() {
  const tryHandleRoot = async (root) => {
    const full = root.innerText || "";
    if (!SUCCESS_RE.test(full) && !/Chúc mừng bạn/i.test(full)) return;
    let code = null;
    const link = root.querySelector('a[href*="/khach-hang"]');
    if (link && ORDER_CODE_RE.test(link.textContent)) code = link.textContent.match(ORDER_CODE_RE)[0];
    if (!code) { const m = full.match(ORDER_CODE_RE); if (m) code = m[0]; }
    if (!code) return;
    await captureAndNotify(code);
  };

  $$('[role="dialog"], .ant-modal, .ant-modal-root, .ant-message, .ant-notification, .swal2-popup, .Toastify__toast, .v-toast, .toast, .notification').forEach(tryHandleRoot);
  new MutationObserver((muts) => {
    muts.forEach(m => m.addedNodes.forEach(n => {
      if (!(n instanceof Element)) return;
      const root = n.matches?.('[role="dialog"], .ant-modal, .swal2-popup') ? n : n.querySelector?.('[role="dialog"], .ant-modal, .swal2-popup');
      if (root) tryHandleRoot(root);
    }));
  }).observe(document.documentElement, { childList:true, subtree:true });
}

function hookCreateOrderNetwork() {
  const _fetch = window.fetch;
  window.fetch = async (...args) => {
    const res = await _fetch(...args);
    try { await maybeCaptureOrder(args, res.clone()); } catch {}
    return res;
  };
  const _open = XMLHttpRequest.prototype.open; const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) { this.__url = url||""; this.__method = method||""; return _open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    this.__body = body; const _onload = this.onload;
    this.onload = async () => {
      try { await maybeCaptureOrder([this.__url, { method: this.__method, body: this.__body }], this); } catch {}
      if (_onload) _onload.call(this);
    };
    return _send.apply(this, arguments);
  };
}

async function maybeCaptureOrder(args, resOrXhr) {
  const reqUrl  = (typeof args[0] === "string" ? args[0] : (args[0] && args[0].url)) || "";
  const reqInit = args[1] || {};
  const method  = (reqInit.method || "GET").toUpperCase();
  if (!/POST|PUT/.test(method)) return;
  if (!/order|create|tao|dat|don/gi.test(reqUrl)) return;

  let json = null;
  try {
    if ("json" in resOrXhr) json = await resOrXhr.json();
    else if ("responseText" in resOrXhr) json = JSON.parse(resOrXhr.responseText || "{}");
  } catch {}
  if (!json) return;

  const code = json.orderCode || json.code || json.OrderCode || (json.data && (json.data.orderCode || json.data.code));
  if (!code) return;
  
  await saveToLocal({ [`TIS:orderFull:${code}`]: { data: json.data || json, ts: Date.now() }, "TIS:lastOrderCode": code });
  await captureAndNotify(code);
}

async function captureAndNotify(orderCode) {
  const doneKey = `TIS:captureDone:${orderCode}`;
  const gDone = await getFromLocal(doneKey);
  if (gDone[doneKey]) return;
  await saveToLocal({ [doneKey]: true });

  const recDom = scrapeReceiverFromCreatePageDOM() || {};
  const draft = await getFromLocal("TIS:lastReceiverDraft");
  
  const draftPhone = digitsOnly(draft?.["TIS:lastReceiverDraft"]?.receiver?.phone || "");

  let receiver = {
    name:    (recDom.name || draft?.["TIS:lastReceiverDraft"]?.receiver?.name || "").trim(),
    phone:   digitsOnly(recDom.phone || draftPhone),
    address: (recDom.address || draft?.["TIS:lastReceiverDraft"]?.receiver?.address || "").trim()
  };

  const fullJson = await getFullOrderByCode(orderCode);
  receiver = mergeReceiverFromFullJson(fullJson, receiver);
  
  if (draftPhone && draftPhone.length >= 8) {
    receiver.phone = draftPhone;
  } else {
    receiver.phone = digitsOnly(receiver.phone);
  }

  await saveOrderToCache(orderCode, receiver);
  
  try { await notifyDiscord(orderCode, receiver, fullJson); } catch(e){ console.warn("notifyDiscord error:", e); }
  showSuccessOverlay(orderCode, receiver);
}

function mergeReceiverFromFullJson(full, fallback = {}) {
  const norm = (s) => (String(s || "").trim().replace(/\s+/g, " ").toLowerCase());
  if (!full) return { name: (fallback.name || "").trim(), phone: digitsOnly(fallback.phone || ""), address: (fallback.address || "").trim() };

  const rx = {
    name: pickFirst(full.receiverName, full.receiverFullName, full.receiverInfo?.name, full.to?.name, full.to?.fullName),
    phone: pickFirst(full.receiverPhone, full.toPhone, full.receiverInfo?.phone, full.to?.phone),
    addrDetail: pickFirst(full.receiverAddress, full.toAddress, full.receiverInfo?.address, full.to?.address),
    ward: pickFirst(full.receiverWardName, full.toWardName, full.receiverInfo?.wardName, full.to?.wardName),
    dist: pickFirst(full.receiverDistrictName, full.toDistrictName, full.receiverInfo?.districtName, full.to?.districtName),
    prov: pickFirst(full.receiverProvinceName, full.toProvinceName, full.receiverInfo?.provinceName, full.to?.provinceName),
    company: pickFirst(full.receiverCompanyName, full.toCompanyName, full.receiverInfo?.companyName, full.to?.companyName),
  };
  const sx = {
    addrDetail: pickFirst(full.senderAddress, full.fromAddress, full.senderInfo?.address, full.from?.address),
    ward: pickFirst(full.senderWardName, full.fromWardName, full.senderInfo?.wardName, full.from?.wardName),
    dist: pickFirst(full.senderDistrictName, full.fromDistrictName, full.senderInfo?.districtName, full.from?.districtName),
    prov: pickFirst(full.senderProvinceName, full.fromProvinceName, full.senderInfo?.provinceName, full.from?.provinceName),
  };

  const buildAddr = (detail, ward, dist, prov) => {
    const admin = [ward, dist, prov].filter(Boolean).join(", ");
    return (detail ? detail.toString().trim() : "") + (admin ? (detail ? ", " : "") + admin : "");
  };

  let rAddr = buildAddr(rx.addrDetail, rx.ward, rx.dist, rx.prov);
  const sAddr = buildAddr(sx.addrDetail, sx.ward, sx.dist, sx.prov);
  if (rAddr && sAddr && norm(rAddr) === norm(sAddr) && !rx.name && !rx.phone) rAddr = "";

  return { name: (rx.name || rx.company || fallback.name || "").trim(), phone: digitsOnly(rx.phone || fallback.phone || ""), address: (rAddr || fallback.address || "").trim() };
}

function scrapeReceiverFromCreatePageDOM() {
  const candidates = Array.from(document.querySelectorAll('section, article, div, [class*="card" i], [class*="panel" i]'));
  let root = null;
  for (const el of candidates) { if ((el.innerText || "").toLowerCase().includes("người nhận")) { root = el; break; } }
  if (!root) return null;

  let name = ""; const nameEl = root.querySelector(".bold-text") || root.querySelector('[class*="name" i]');
  if (nameEl) name = (nameEl.textContent || "").trim();
  
  let phone = ""; const labels = Array.from(root.querySelectorAll("*")).filter(el => /số\s*điện\s*thoại/i.test((el.textContent || "").trim()));
  for (const el of labels) {
    const m = ((el.textContent || "") + " " + (el.nextElementSibling?.textContent || "")).match(/\+?\d[\d\s\-]{7,}\d/);
    if (m) { phone = digitsOnly(m[0]); break; }
  }
  
  let address = ""; const cands = (root.innerText || "").split("\n").map(s=>s.trim()).filter(l => l.length>10 && !/số\s*điện\s*thoại/i.test(l) && !BAD_ADDR_PAT.test(l));
  if (cands.length) address = cands.sort((a,b)=>b.length-a.length)[0];

  return { name, phone, address };
}

function bindInputs(selector, handler){
  $$(selector).forEach(el => { el.addEventListener("input", handler, true); el.addEventListener("change", handler, true); });
  new MutationObserver(()=> $$(selector).forEach(el => {
    if (!el.__tisBind){ el.__tisBind = true; el.addEventListener("input", handler, true); el.addEventListener("change", handler, true); }
  })).observe(document.documentElement,{childList:true,subtree:true});
}
function getVal(sel){ const el=$(sel); return el ? ("value" in el ? (el.value||"").trim() : (el.textContent||"").trim()) : ""; }

function observeDraftInputs() {
  const nameSel = 'input[name*="receiver"][name*="name" i], input[name*="toName" i], input[placeholder*="tên" i]';
  const addrSel = 'textarea[name*="receiver"][name*="address" i], textarea[name*="toAddress" i], input[name*="address" i]';
  const update = () => {
    chrome.storage.local.get("TIS:lastReceiverDraft", (g) => {
      const prev = g["TIS:lastReceiverDraft"] || { receiver: { name: "", address: "", phone: "" }, ts: 0 };
      chrome.storage.local.set({ "TIS:lastReceiverDraft": { receiver: { name: getVal(nameSel) || prev.receiver.name, phone: prev.receiver.phone, address: getVal(addrSel) || prev.receiver.address }, ts: Date.now() }});
    });
  };
  bindInputs(nameSel, update); bindInputs(addrSel, update);
}

function observePhoneInputs() {
  const sel = 'input[type="tel"], input[name*="phone" i], input[name*="sdt" i]';
  const save = (el) => {
    const fn = () => {
      chrome.storage.local.get("TIS:lastReceiverDraft", (g) => {
         const prev = g["TIS:lastReceiverDraft"] || { receiver: { name: "", address: "", phone: "" }, ts: Date.now() };
         prev.receiver.phone = digitsOnly(el.value || ""); prev.ts = Date.now();
         chrome.storage.local.set({ "TIS:lastReceiverDraft": prev });
      });
    };
    el.addEventListener("input", fn, true); el.addEventListener("change", fn, true); el.addEventListener("blur", fn, true);
  };
  $$(sel).forEach(save);
  new MutationObserver(()=> $$(sel).forEach(save)).observe(document.documentElement,{childList:true,subtree:true});
}