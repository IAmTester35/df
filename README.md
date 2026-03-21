# Delta Force (DF) CDKey Tool 🚀

Công cụ hỗ trợ quản lý, thống kê và tự động nhập CDKey cho game **Delta Force (Garena)**.

## 🛠 Tính năng chính

- **Tự động nhập mã (Redeem):** Gửi yêu cầu redeem CDKey thông qua API chính thức.
- **BruteForce thông minh:** Tự động thử lại các mã trong lịch sử, bỏ qua các mã đã biết chắc chắn là sai định dạng (`400054`), đã hết hạn (`400070`) hoặc đạt giới hạn nhập (`400068`).
- **Thống kê chuyên sâu:** Công cụ phân tích kết quả, phân loại lỗi và liệt kê các mã thành công/thất bại một cách trực quan.
- **Quản lý dữ liệu:** Lưu trữ kết quả dưới dạng JSON để tiện theo dõi và tái sử dụng.

## 📁 Cấu trúc thư mục

- `config.js`: Cấu hình API, tham số URL và các hàm gọi API cơ bản.
- `bruteforce.js`: Logic thử lại mã từ lịch sử (`success.json`, `failure.json`).
- `stat.js`: Script thống kê và báo cáo kết quả.
- `success.json`: Lưu danh sách các mã đã redeem thành công.
- `failure.json`: Lưu danh sách các mã thất bại kèm lý do cụ thể.
- `code.txt`: File chứa danh sách mã CDKey thô để xử lý.

## 🚀 Hướng dẫn sử dụng

### 1. Cấu hình
Mở file `config.js` và cập nhật `FULL_URL` với các tham số mới nhất (openid, token, s, ...) lấy từ trình duyệt khi bạn login vào trang redeem của Garena.

### 2. Chạy BruteForce
Để thử lại các mã trong lịch sử (đã lọc các mã lỗi vĩnh viễn):
```bash
node bruteforce.js
```

### 3. Xem thống kê
Để xem báo cáo chi tiết về tình trạng các mã:
```bash
node stat.js
```

## 📊 Ví dụ kết quả thống kê
```text
==================================================
            CDKEY REDEMPTION STATISTICS            
==================================================
Summary:
- Total Success: 81
- Total Failure: 683
- Total Attempted: 764

--- SUCCESSFUL CODES ---
  DFclover812, DFEnergy428, TrickOrTreat, ...

--- FAILURE REASONS BREAKDOWN ---
The current cdk does not match: 287 (42.02%)
system error: 204 (29.87%)
...
==================================================
```

## ⚠️ Lưu ý
- Hãy điều chỉnh `CHUNK_SIZE` và `DELAY_BETWEEN_CHUNKS` trong `config.js` để tránh bị hệ thống chặn (Rate Limit).
- Đảm bảo tham số `token` và `s` trong URL vẫn còn hiệu lực.

---
*Phát triển bởi [IAmTester35](https://github.com/IAmTester35)*
