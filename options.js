const KEY_CREATOR = "TIS:creatorName";
// Dán cứng URL Webhook
const WEBHOOK_URL = "https://discord.com/api/webhooks/1413457417324204155/VQXpvb7hMWeH7v85Ww8kChXrAX8RnUOLLvtaUANUnEXz_3oBqX6XtCrYvbJ-aGK_Ek3m";

const $ = (id) => document.getElementById(id);
const statusEl = $("status"), crEl = $("creator");

function setStatus(msg, type="") {
  statusEl.className = type === "ok" ? "ok" : type === "err" ? "err" : "hint";
  statusEl.textContent = msg;
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get([KEY_CREATOR], (g) => {
    crEl.value = g[KEY_CREATOR] || "";
    if (!g[KEY_CREATOR]) setStatus("Vui lòng nhập tên để định danh!", "hint");
  });
});

$("save").onclick = () => {
  const creator = (crEl.value || "").trim();
  if (!creator) return setStatus("Vui lòng nhập tên của bạn.", "err");
  chrome.storage.local.set({ [KEY_CREATOR]: creator }, () => setStatus("Đã lưu cài đặt!", "ok"));
};

$("test").onclick = async () => {
  const creator = (crEl.value || "").trim() || "TIS Tester";

  const payload = {
    username: "TIS 247Express Bot",
    embeds: [{
      title: creator,
      description: "**Thông báo thử nghiệm**\nNếu bạn thấy tin nhắn này, webhook đang hoạt động tốt.",
      color: 0xE30613,
      timestamp: new Date().toISOString()
    }]
  };

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Non-2xx");
    setStatus("Đã gửi test THÀNH CÔNG!", "ok");
  } catch {
    setStatus("Gửi test thất bại. Kiểm tra kết nối.", "err");
  }
};