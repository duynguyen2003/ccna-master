# Banner, Home và lịch hoạt động hồ sơ

Bản thay đổi này thu gọn banner và thay card chào mừng hồ sơ bằng lịch hoạt
động học tập. Các phần hiển thị giữ font, màu thương hiệu và animation hiện có.

- Banner dùng cùng vùng terminal cho preview và CLI; lịch sử cuộn nội bộ,
  tự cuộn tới kết quả mới và trả focus về ô nhập. Nút thi thử cách hàng nhập
  16px. Thu gọn chữ banner và thanh học tiếp; giữ responsive.
- Home dùng màu chữ theo nền sáng/tối, chữ sáng trên thẻ ảnh và footer tối.
  CSS sở hữu lớp phủ ảnh; component chỉ truyền ảnh bằng custom property.
  Alias slate dùng nguồn chung trong theme.css.
- Hồ sơ có heatmap 365 ngày/năm, lọc bài học/lab, giữ palette xanh F8 ở cả
  hai theme. Có điều hướng bàn phím, lịch chọn ngày riêng, accordion và danh
  sách phân trang 5 ngày. Mobile xếp metric thành 2 cột và thu gọn section.
- API `GET /api/users/stats/activity-calendar` yêu cầu phiên đăng nhập,
  chỉ trả dữ liệu của chủ phiên và đặt cache private/no-store. Đếm lần hoàn
  thành đầu tiên theo loại/tham chiếu, tổng hợp theo ngày Việt Nam. Lịch sử
  thiếu được ghi rõ; không suy ra từ tổng tiến độ. Không thêm migration.
- Menu DropdownSelect mang typography đã resolve từ trigger sang portal,
  hỗ trợ minimum width để nhãn lọc heatmap không bị bó.

Chi tiết dữ liệu và tương tác: [phân tích heatmap](../rea/f8-profile-activity-heatmap.md).

## Kiểm chứng bản đã tách

- Tập file đã tách: frontend **36 suites / 279 tests đạt**; production build đạt.
- `pnpm test:core`: **9 đạt, 3 integration opt-in skip** khi không bật DB test.
  API lịch có ca integration PostgreSQL/HTTP riêng và được thêm vào lệnh core.
- Boundaries: **1609 imports/assets / 367 source files**, không vi phạm lớp.
- Browser đã kiểm Home/terminal nhiều lệnh/clear và profile heatmap trên
  desktop/mobile, sáng/tối; lịch năm nhuận, lọc loại, date picker và retry.
  Các lần kiểm trước khi tách dùng dữ liệu tổng hợp trong preview riêng.

Không coi kiểm UI bằng dữ liệu tổng hợp là xác nhận toàn bộ dữ liệu lịch sử
production hoặc kiểm thiết bị touch/screen reader thật. Bản này không thay
đổi quyền mở bài/lab hoặc cấu hình triển khai.
