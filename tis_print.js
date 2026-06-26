// ==========================================
// FILE 3: tis_print.js - XỬ LÝ TRANG IN ĐƠN
// ==========================================

async function onPrintPage() {
  const floatPhoneBox = document.getElementById("tis-floating-phone");
  if (floatPhoneBox) floatPhoneBox.remove();

  await ensureCreatorName();

  waitForTables(async () => {
    const orderCodes = getOrderCodesFromQuery();
    const receiverMap = await getReceiversByOrderCodes(orderCodes);
    const storageData = await getFromLocal(["TIS:lastReceiverDraft", KEY_CREATOR]);
    const draft = storageData["TIS:lastReceiverDraft"];
    const creatorName = storageData[KEY_CREATOR] || "";
    
    renderFooterBoxMulti(receiverMap, orderCodes, draft, creatorName);
  });
}

function waitForTables(cb, retries = 40) {
  if ($$("table").length) cb();
  else if (retries > 0) setTimeout(() => waitForTables(cb, retries - 1), 300);
  else console.warn("Không tìm thấy bảng để in.");
}

function getOrderCodesFromQuery() {
  const pk = new URLSearchParams(location.search).get("packages") || "";
  return pk.split(",").map(s => s.trim()).filter(Boolean);
}

function getReceiversByOrderCodes(codes) {
  return new Promise((resolve) => {
    if (!codes.length) return resolve({});
    const keys = codes.map(c => `TIS:orderCache:${c}`);
    chrome.storage.local.get(keys, (g) => {
      const map = {};
      codes.forEach((c) => { const v = g[`TIS:orderCache:${c}`]; if (v && v.receiver) map[c] = v.receiver; });
      resolve(map);
    });
  });
}

function extractOrderCodeFromText(text) {
  const m = (text || "").match(/[A-Z]{3,}\d{6,}/); return m ? m[0] : null;
}

function extractNearReceiver(text) {
  const lines = splitLines(text);
  let start = lines.findIndex(l => /người\s*nhận/i.test(l)); if (start === -1) start = 0;
  let name = "Không xác định", nameIndex = -1;

  for (let i = start; i < Math.min(lines.length, start + 20); i++) {
    const lc = (lines[i] || "").toLowerCase();
    if (lc.startsWith("chị") || lc.startsWith("anh") || lc.includes("(ms.") || lc.includes("(mr.)") || (lines[i] || "").includes(" - ")) { 
      name = lines[i]; nameIndex = i; break; 
    }
  }

  const address = (() => {
    for (let i = nameIndex; i < Math.min(lines.length, nameIndex + 4); i++) {
      const curr = lines[i] || "", next = lines[i + 1] || "", next2 = lines[i + 2] || "";
      if (curr.toLowerCase().startsWith("chị") || curr.includes(" - ") && next) {
        let addr = next;
        if (/số\s*điện\s*thoại/i.test(addr)) addr = next2;
        else if (next2 && next2.length > 10 && !/số\s*điện\s*thoại/i.test(next2)) addr += ", " + next2;
        if (addr && !/số\s*điện\s*thoại/i.test(addr) && !BAD_ADDR_PAT.test(addr)) return addr;
      }
    }
    return "Không xác định";
  })();
  return { name, address, _nameIndex: nameIndex };
}

function fillPhoneNumberToTable(tbl, phone) {
  if (!phone) return; 
  const walker = document.createTreeWalker(tbl, NodeFilter.SHOW_TEXT, null, false);
  const nodesToModify = []; let n;
  while (n = walker.nextNode()) if (/Số\s*điện\s*thoại\s*:/i.test(n.nodeValue)) nodesToModify.push(n);
  
  nodesToModify.forEach(node => {
      if (!node.nodeValue.includes(phone)) {
         node.nodeValue = node.nodeValue.replace(/(Số\s*điện\s*thoại\s*:).*$/i, `$1 ${phone}`);
      }
  });
}

function renderFooterBoxMulti(receiverMap, orderCodes, draft, creatorName) {
  // [FIX] Lọc table: Tìm chính xác các table sâu nhất chứa thông tin đơn hàng, bỏ qua table layout bọc ngoài
  const validTables = [];
  $$("table").forEach(tbl => {
    const text = tbl.innerText || "";
    if (!/người\s*nhận/i.test(text) && !/[A-Z]{3,}\d{6,}/.test(text)) return;
    
    // Kiểm tra xem có table con nào bên trong cũng chứa thông tin đơn không
    const childTables = tbl.querySelectorAll("table");
    const hasValidChild = Array.from(childTables).some(c => {
        const cText = c.innerText || "";
        return /người\s*nhận/i.test(cText) || /[A-Z]{3,}\d{6,}/.test(cText);
    });
    
    // Nếu không có table con hợp lệ nào khác, chứng tỏ đây là table tận cùng của 1 đơn hàng
    if (!hasValidChild) {
        validTables.push(tbl);
    }
  });

  if (validTables.length === 0) {
      console.warn("TIS: Không tìm thấy table chứa đơn hàng hợp lệ để in.");
      return;
  }

  let totalImages = 0, loadedImages = 0, didPrint = false;
  const tryPrint = () => { if (!didPrint && loadedImages >= totalImages) { didPrint = true; window.print(); } };

  validTables.forEach((tbl, idx) => {
    if (tbl.dataset.tisPrinted) return; 
    tbl.dataset.tisPrinted = "true";

    const txt = tbl.innerText || "";
    // Ưu tiên cao nhất là tìm mã bill trực tiếp trên text của table đó
    let code = extractOrderCodeFromText(txt) || (idx < orderCodes.length ? orderCodes[idx] : null);
    const near = extractNearReceiver(txt);

    let receiver = code ? receiverMap[code] : null;

    // [FIX] Chỉ sử dụng Draft (bản nháp) cứu cánh khi đang in ĐÚNG 1 ĐƠN DUY NHẤT. 
    // Tránh tình trạng in 5 đơn mà đơn nào miss cache cũng bị lấy số cũ nhét vào.
    if (!receiver && validTables.length === 1 && idx === 0 && draft && Date.now() - (draft.ts || 0) <= FIFTEEN_MIN) {
        receiver = draft.receiver;
    }

    let phoneDisplay = "";
    if (receiver && receiver.phone) {
        phoneDisplay = receiver.phone;
    } else if (validTables.length === 1 && idx === 0 && draft && draft.receiver && draft.receiver.phone && Date.now() - (draft.ts || 0) <= FIFTEEN_MIN) {
        phoneDisplay = draft.receiver.phone;
    }
    phoneDisplay = digitsOnly(phoneDisplay);

    const name    = near.name && near.name !== "Không xác định" ? near.name : (receiver?.name || "Không xác định");
    const address = near.address && near.address !== "Không xác định" ? near.address : (receiver?.address || "Không xác định");

    // Nếu vẫn tịt không ra SĐT, hỏi user
    if (!phoneDisplay) {
       let inputPhone = window.prompt(`[TIS VIP PRO] - Bổ sung SĐT bị thiếu\n\nNgười nhận: ${name}\nMã đơn: ${code || 'Không rõ'}\n\nVui lòng nhập SĐT để in luôn (hoặc nhấn OK/Cancel để bỏ qua và chừa trống):`);
       if (inputPhone && inputPhone.trim()) {
           phoneDisplay = digitsOnly(inputPhone.trim());
       }
    }

    fillPhoneNumberToTable(tbl, phoneDisplay);

    const wrapper = document.createElement("div");
    wrapper.style.position = "relative"; wrapper.style.marginTop = "-8px";

    const box = document.createElement("div");
    Object.assign(box.style, {
      position: "absolute", bottom: "0", left: "0", zIndex: "2147483647", background: "#fff", padding: "8px 15px", 
      borderTop: "1px solid #999", width: "100%", boxShadow: "0 -2px 4px rgba(0,0,0,0.2)", boxSizing: "border-box",
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px"
    });
    
    const leftWrapper = document.createElement("div");
    Object.assign(leftWrapper.style, { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" });
    
    totalImages++;
    leftWrapper.appendChild(createLogo(() => { loadedImages++; tryPrint(); }));

    if (creatorName) {
        const rowCreator = document.createElement("div"); rowCreator.textContent = `${creatorName}`;
        Object.assign(rowCreator.style, { fontWeight: "600", marginTop: "2px", fontSize: "11px", color: "#333", textAlign: "center", width: "100%" });
        leftWrapper.appendChild(rowCreator);
    }

    const right = document.createElement("div");
    Object.assign(right.style, { flex: "1", fontSize: "13px", lineHeight: "1.5" });

    right.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 2px; color: #333;">📦 Thông tin người nhận:</div>
      <div style="margin-bottom: 2px;">👤 Họ tên: ${name}</div>
      <div style="margin-bottom: 2px;">📞 Điện thoại: ${phoneDisplay ? phoneDisplay : "........................"}</div>
      <div style="margin-bottom: 0;">📍 Địa chỉ: ${address}</div>
    `;
    
    box.appendChild(leftWrapper); box.appendChild(right);
    const parent = tbl.parentNode; 
    parent.replaceChild(wrapper, tbl); 
    wrapper.appendChild(tbl); 
    wrapper.appendChild(box);
  });

  if (totalImages === 0) tryPrint();
}