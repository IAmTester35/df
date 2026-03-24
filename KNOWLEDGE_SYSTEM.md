# Delta Force Auto-Redeem: Comprehensive Knowledge System

Tài liệu này là nguồn sự thật duy nhất (Single Source of Truth) về kiến trúc, cấu hình, hệ thống thiết kế và quy trình vận hành của dự án **Delta Force Auto-Redeem (2026)**.

---

## 🌉 1. Kiến trúc hệ thống (System Architecture)
Dự án tuân theo mô hình **Serverless Edge Computing** để đạt hiệu suất cao và độ trễ thấp.

-   **Frontend**: ReactJS SPA được xây dựng bằng Vite, hỗ trợ Mobile-first.
-   **Edge Layer**: **Cloudflare Workers** đóng vai trò Gateway proxy để vượt rào cản CORS và thực hiện xác thực nguyên tử (Atomic Verification).
-   **Identity**: **Firebase Auth** quản lý định danh người dùng (hỗ trợ Anonymous và Google Login).
-   **Global State/Sync**: **Firebase Real-time Database (RTDB)** đóng vai trò là Sổ cái toàn cầu (Global Registry) cho các mã đã xác minh, sử dụng WebSocket để đồng bộ hóa thời gian thực tới tất cả máy khách.

### Luồng dữ liệu:
1.  **Auth**: Người dùng đăng nhập ẩn danh hoặc qua Google.
2.  **Observe**: Client đăng ký nhận luồng dữ liệu mã từ Firebase.
3.  **Submit**: Client gửi mã (local hoặc mới) tới Edge Gateway.
4.  **Verify**: Edge Gateway gọi API Game (Garena) Server-to-Server.
5.  **Broadcast**: Mã hợp lệ được ghi vào Firebase, kích hoạt thông báo tới toàn bộ người dùng đang active.

---

## 🌃 2. Hệ thống thiết kế (Design System)
Dự án sử dụng ngôn ngữ thiết kế **Nordic Glass SPA** (Bắc Âu Cực Quang) cao cấp:
-   **Bảng màu**: Midnight Navy (`#0f172a`), Arctic Blue accent (`#60a5fa`).
-   **Aesthetics**: Glassmorphism chuyên sâu với `backdrop-filter: blur(12px)`, viền tinh thể `white/10` và đổ bóng mềm.
-   **Visual Hierarchy**: Bố cục **F-Pattern** giúp tối ưu luồng thao tác từ trên xuống dưới:
    -   *Tầng 1 (Navbar)*: Branding và định danh người dùng.
    -   *Tầng 2 (Hero)*: Ô nhập CDKey tập trung (Centralized Input).
    -   *Tầng 3 (Data)*: Bảng lịch sử lịch sử nhập mã với hiệu ứng hover và trạng thái rõ ràng.

---

## 📂 3. Cấu trúc dữ liệu Firebase (V5.2 Ultra-Compact)
Dữ liệu được nén bit-packing để đạt hiệu quả băng thông tối thượng.

### Cấu trúc Node:
Toàn bộ mã nằm trong node `c/`.
- **Key**: `SAFE_KEY` (CDKey đã được escape).
- **Value**: `Timestamp * 10 + Status` (Loại: Number).
  - `Status = 0`: Thành công (Success).
  - `Status = 1`: Đầy giới hạn (Limit - 400067).

### Cơ chế Đồng bộ:
- **Delta Sync**: Client chỉ tải phần chênh lệch dựa trên `lastSyncTime` sử dụng `query(ref(db, 'c'), orderByValue(), startAfter(lastSync * 10 + 9))`.
- **O(1) Write**: Sử dụng `update()` đích danh vào node con, không dùng Transaction.

---

## 🛠️ 4. Công cụ & Logic vận hành (CLI & Tooling)

### Tự động đồng bộ (`sync_to_rtdb.js`)
Script chuyên dụng để đồng bộ hàng loạt từ tệp JSON lên Cloud.
-   **Cơ chế**: Sử dụng `set()` để ghi đè sạch (Wipe Clean) dữ liệu cũ, đảm bảo cấu trúc V4.0 luôn chuẩn xác.
-   **Thử nghiệm**: Hỗ trợ chế độ `--dry-run` để kiểm tra số lượng và định dạng trước khi đẩy.

### Chạy Bruteforce (`bruteforce.js`)
Công cụ thử lại các mã tiềm năng dựa trên lịch sử.
-   **Chiến lược**: Hiện tại tập trung **chỉ thử lại các mã lỗi 400067** (Đầy giới hạn nhóm) vì đây là các mã có xác suất "hồi sinh" cao nhất.

### Logic xác thực (`config.js` & `index.js`)
-   **Cấu hình API**: Tham số được trích xuất động (`openid`, `token`, `game_id`) từ URL master.
-   **Throttling**: Giới hạn `CHUNK_SIZE` và `DELAY_BETWEEN_CHUNKS` để tránh bị chặn bởi API Garena.
-   **Lọc thông minh**: Sử dụng `Set` để loại bỏ mã trùng lặp và làm sạch ký tự vô hình/khoảng trắng trước khi xử lý.

---

## 📁 5. Các tệp quan trọng
-   [App.tsx](file:///Users/nammaithanh/Desktop/Samset/githubbb/df/DF-RedeemCode/src/App.tsx): Code ứng dụng React chính.
-   [sync_to_rtdb.js](file:///Users/nammaithanh/Desktop/Samset/githubbb/df/sync_to_rtdb.js): Script đồng bộ dữ liệu V4.0.
-   [bruteforce.js](file:///Users/nammaithanh/Desktop/Samset/githubbb/df/bruteforce.js): Script quét lại mã lỗi.
-   [index.js](file:///Users/nammaithanh/Desktop/Samset/githubbb/df/index.js): Script test CDKey mới từ code.txt.
-   [success.json](file:///Users/nammaithanh/Desktop/Samset/githubbb/df/success.json) / [failure.json](file:///Users/nammaithanh/Desktop/Samset/githubbb/df/failure.json): Cơ sở dữ liệu lịch sử Offline.
-   [code.txt](file:///Users/nammaithanh/Desktop/Samset/githubbb/df/code.txt): Nguồn nhập mã CDKey thô.

---
*Cập nhật: 24/03/2026 - Tích hợp phân tích dự án và hệ thống kiến trúc V4.0.*
