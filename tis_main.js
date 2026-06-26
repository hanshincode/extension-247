// ==========================================
// FILE 4: tis_main.js - ROUTER ĐIỀU HƯỚNG
// ==========================================

let lastUrl = location.href;

// Kiểm tra xem đang đứng ở link nào để chạy code của file tương ứng
function checkRoute() {
  const path = location.pathname || "";
  
  if (/\/khach-hang\/(tao-don-hang|dat-don-hang|don-hang)/.test(path)) {
    if (typeof onCreatePage === 'function') onCreatePage();
  }
  
  if (path.includes("/khach-hang/in-don-hang")) {
    if (typeof onPrintPage === 'function') onPrintPage();
  }
}

// Chạy ngay khi vừa load web
checkRoute();

// Liên tục giám sát sự thay đổi của thanh địa chỉ URL (xử lý lỗi bấm chuyển trang không tải lại của 247Express)
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    checkRoute();
  }
}).observe(document.body, { childList: true, subtree: true });