# Theme và icon thiết bị mạng

## Hành vi

- Khách mới mở web bằng theme light, kể cả khi hệ điều hành dùng dark. HTML khởi tạo và ThemeProvider cùng dùng quy tắc này; lựa chọn light/dark hợp lệ đã lưu trong `netmaster-theme` được khôi phục. Storage bị chặn hoặc giá trị không hợp lệ vẫn dùng light.
- Nút theme của web và CLI lab dùng vòng tròn mở từ tâm nút, thời lượng 650 ms, easing `cubic-bezier(0.16, 1, 0.3, 1)`. Theo yêu cầu sản phẩm, hiệu ứng theme luôn chạy kể cả khi bật giảm chuyển động. Trình duyệt thiếu View Transition API dùng overlay chuyển động tương đương.
- Lab giữ theme riêng và khởi tạo light. Khi bấm liên tiếp, lựa chọn cuối được giữ; chuyển trang dọn animation đang chạy.
- Topology trong lab, preview quản trị và hình minh họa trang chủ dùng chung `NetworkDeviceGlyph`. Icon lấy theme từ phạm vi gần nhất; lab light vẫn dùng icon light khi theme web là dark. Hero có nền tối cố định nên luôn dùng biến thể dark.

## Tài nguyên và nguồn

SVG laptop/router/cloud/DNS/web có hai biến thể sáng/tối tại `src/frontend/public/network-devices`. Artwork từ [Protocol Explorer của Dilum Sanjaya](https://protocol-explorer-alpha.vercel.app/), trích từ snapshot công khai ngày 04/11/2026. `provenance.json` ghi tác giả, nguồn và SHA-256 của từng file/artwork. Switch dùng SVG riêng vì tham chiếu không có switch.

Theme được chuyển sang React từ hiệu ứng vòng tròn của cùng tham chiếu; xử lý thêm hủy animation, bấm liên tiếp và trình duyệt thiếu API. Các icon dùng chung không phụ thuộc runtime `/protocol-explorer/`.

## Điểm triển khai và kiểm tra

- `ThemeContext.jsx`, `themeTransition.js` và `ThemeTransition.css`: theme web, animation và cleanup.
- `CliLabWorkspace.js`: theme cục bộ của lab.
- `NetworkDeviceGlyph.jsx`/CSS, `HeroTopology` và `NetworkTopology`: hiển thị icon và trạng thái chọn/focus.
- `pnpm check:network-devices`: kiểm hash 10 SVG và hình học gốc, phát hiện dependency vào runtime tạm.
- `ThemeContext.test.jsx`, `themeTransition.test.js`, `NetworkLab.test.js`: light mặc định, persistence/storage lỗi, vòng tròn/fallback, bấm nhanh và cleanup.

Thay đổi này giữ luồng ping hiện có. Observer trace và lesson player được triển khai riêng theo kế hoạch tích hợp.
