// ==========================================
// FILE 3: tis_main.js - ĐIỀU HƯỚNG CHỨC NĂNG
// ==========================================

console.log("[TIS VIP PRO] Hệ thống lõi đã khởi động!");

// Chờ toàn bộ cấu trúc web tải xong rồi mới nạp script để tránh lỗi DOM
window.addEventListener("load", () => {
    const currentUrl = location.href.toLowerCase();
    
    // Nếu URL có chứa chữ "in-don-hang", gọi tính năng dành cho trang In
    if (currentUrl.includes("in-don-hang")) {
        console.log("[TIS VIP PRO] Phát hiện trang In Đơn. Kích hoạt module In...");
        if (typeof onPrintPage === "function") {
            onPrintPage();
        } else {
            console.error("Thiếu file tis_print.js hoặc hàm onPrintPage chưa được định nghĩa.");
        }
    } 
    // Các trang còn lại (như tạo đơn), gọi tính năng Tạo
    else {
        if (typeof onCreatePage === "function") {
            onCreatePage();
        }
    }
});