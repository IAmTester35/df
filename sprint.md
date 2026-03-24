# 📅 Development Roadmap: Edge-based Auto-Redeem

Kế hoạch phát triển dự án được chia thành 5 Sprint chính, tập trung vào việc xây dựng hạ tầng ổn định, logic xác thực mã tại Edge và trải nghiệm người dùng tối ưu.

---

## 🏃 Sprint 1: Core Foundation & Identity 
**Mục tiêu:** Thiết lập cấu trúc dự án và cơ chế định danh người dùng.

*   **Setup Project:** Khởi tạo ReactJS (Vite) và cấu hình CI/CD tự động lên Cloudflare Pages.
*   **Firebase Configuration:** Thiết lập Project Firebase, kích hoạt Real-time Database (RLDB) và Firebase Auth.
*   **Identity Layer:** Triển khai cơ chế Anonymous Authentication để gán định danh duy nhất (UID) cho thiết bị mà không cần đăng ký.
*   **Secure Rules:** Thiết lập Security Rules cơ bản cho RLDB để bảo vệ dữ liệu.

---

## 🏃 Sprint 2: The Edge Gateway 
**Mục tiêu:** Xây dựng lớp Proxy trung gian để xử lý CORS và xác thực mã.

*   **Cloudflare Workers Setup:** Triển khai Worker cơ bản để nhận yêu cầu từ Frontend.
*   **Proxy Logic:** Chuyển tiếp (Forwarding) yêu cầu từ Worker đến External Game API của Garena.
*   **Atomic Verification:** Phát triển logic kiểm tra mã tại Edge. Chỉ cho phép các mã có phản hồi `success` từ Game API tiến vào luồng dữ liệu của hệ thống.
*   **Secret Management:** Cấu hình biến môi trường và Key bảo mật cho Firebase Admin SDK trên Cloudflare.

---

## 🏃 Sprint 3: Data Core & Real-time Sync 
**Mục tiêu:** Kết nối logic xử lý tại Edge với cơ sở dữ liệu đồng bộ.

*   **Verified Write Logic:** Hoàn thiện việc tự động ghi mã thành công từ Cloudflare Workers vào `Global Registry` trên Firebase RLDB.
*   **Real-time Listener:** Phát triển cơ chế lắng nghe sự kiện (Event Listener) tại Frontend để tự động cập nhật danh sách mã mới mà không cần F5.
*   **Database Schema:** Chuẩn hóa cấu trúc JSON cho mã Global và dữ liệu người dùng cá nhân.

---

## 🏃 Sprint 4: Client Logic & UI Experience 
**Mục tiêu:** Tập trung vào trải nghiệm người dùng và tối ưu hóa việc nhập mã số lượng lớn.

*   **Batch Processing:** Xây dựng UI nhập mã theo lô (textarea) và logic thực thi tuần tự với độ trễ (delay) hợp lý.
*   **Delta-Sync Implementation:** Phát triển cơ chế so trừ (Difference) giữa danh sách mã Global và LocalStorage của người dùng để lọc ra "Mã chưa nhập".
*   **Progress Tracking:** Hiển thị tiến độ xử lý thời gian thực (Success/Failure/Duplicate) cho người dùng.

---

## 🏃 Sprint 5: Stability & Community Outreach
**Mục tiêu:** Hoàn thiện tính năng cộng đồng và bảo mật nâng cao.

*   **Rate Limiting:** Cấu hình giới hạn tần suất yêu cầu trên Cloudflare Workers để chống spam/DDoS.
*   **Global Success Board:** Hiển thị thống kê tổng số mã cộng đồng đã đóng góp được.
*   **Performance Audit:** Tối ưu hóa kích thước bundle JS và cấu hình Cache trên Edge CDN.
*   **Final Release:** Triển khai phiên bản Production chính thức.
