# Rà soát bản tích hợp mô phỏng, lab và AI

Ngày kiểm tra: 16/11/2026. Nhánh `feat/network-sim-lab-ai` được tạo từ `origin/main`
(`59e0c37`); các thay đổi được chia commit theo chức năng để review trước khi merge.

## Phạm vi bản thay đổi

- SVG thiết bị dùng chung, căn tâm hình vẽ và thanh cuộn tùy chỉnh.
- Thư viện 39 mô phỏng React, gồm 231 giai đoạn và 694 sự kiện; tích hợp vào bài học,
  Home và hành trình gói tin của lab. Runtime website tham khảo không được đóng gói.
- Editor lab/admin dùng dropdown thống nhất, xem trước mô phỏng trong bài học.
- Lab ưu tiên sơ đồ/terminal, sidebar mục tiêu/AI, hành trình thu gọn/xem nhanh/chi tiết;
  avatar động theo trạng thái xử lý thật và giữ trạng thái khi đổi panel.
- Home có demo HTTP, CLI và trang giới thiệu AI. Chat độc lập vẫn đang phát triển.
- Runtime, policy và Docker/CI cho AI production; mặc định chưa mở quyền học viên thật.
  Vẫn giữ Vercel + Render và ngân sách đã chốt. Xem
  [hướng dẫn phát hành AI](../ai-lab-assistant/ops/production-student-rollout.md).

## Dọn và giữ file

Đã lần theo import tĩnh, import động của catalog, public entry của package và liên kết
trong báo cáo. Hai file chưa commit sau đây được loại khỏi source vì không còn tham chiếu:

- `features/protocols/data/reference-inventory.json`: danh sách tham khảo cũ, đã được
  thay bằng catalog và dữ liệu đầy đủ của 39 kịch bản.
- `features/protocols/data/source-provenance.json`: metadata bản nguồn cũ và mô tả
  số giai đoạn đã lỗi thời. Tác giả, nguồn, hash và cách trích xuất hiện có trong
  `data/lessons/provenance.json` và `public/network-devices/provenance.json`.

Các đường dẫn trên tính từ `src/frontend/src/`, trừ đường dẫn `public/` tính từ
`src/frontend/`. Manifest hiện tại, scene, dữ liệu bài học, SVG và test đều được giữ.
JSON bài học được sinh bằng công cụ trích xuất; `check:protocol-lessons` kiểm dữ liệu,
catalog và hash thay cho việc đổi định dạng tự động các file sinh ra.

Chỉ đưa ảnh/JSON nghiệm thu được các báo cáo trong PR tham chiếu vào Git; ảnh nháp
và `.tmp` tiếp tục được ignore. Đã kiểm các liên kết mới không bị thiếu file khi clone.
Đã rà mẫu key/token/private key và credential; URL DB trong test production là fixture
tổng hợp `database.invalid`, không phải thông tin kết nối thật.

Lệnh dọn 18 file tạm và 6 thư mục fixture Docker cũ bị kiểm duyệt tự động từ chối với
lý do `blocked by policy`, nên các file đó được giữ local và không xuất hiện trong PR.
Công cụ smoke chính thức đã được sửa để xóa đúng hai env fixture do lần chạy đó tạo ra,
đồng thời chỉ gỡ container/network có danh tính QA tương ứng. Lần kiểm mới không để
thêm thư mục fixture hoặc container QA.

## Kiểm chứng trước PR

| Kiểm tra                       | Kết quả                                                                |
| ------------------------------ | ---------------------------------------------------------------------- |
| Frontend React                 | 75 suite / 517 test đạt                                                |
| AI Node                        | 274 test đạt                                                           |
| Simulator CLI                  | 109 đạt, 3 integration test để CI chạy                                 |
| Account/exam/runtime           | 9 đạt, 3 integration test để CI chạy                                   |
| Learning path                  | 24 đạt, 2 integration test để CI chạy                                  |
| Python                         | 322 đạt; một cảnh báo deprecation từ dependency test                   |
| ESLint                         | 100 file JS/JSX/CJS thay đổi đạt                                       |
| Format, boundaries             | Đạt; 2310 imports/assets trên 542 source files                         |
| Catalog, SVG, contract/fixture | 39/231/694; 16 SVG; 18 schema; 3 bộ / 24 case đạt                      |
| Production React build         | `CI=true pnpm build` và kiểm asset sau build đạt                       |
| Compose và Docker              | Config hợp lệ; API/Python/worker/inline sweeper healthy tại PORT 10000 |

Smoke Docker dùng PostgreSQL cách ly và dữ liệu tổng hợp, policy chưa mở, không gọi
generation thật; RAM idle lần kiểm này khoảng 401 MiB. Kết quả không thay cho benchmark
tải lớp học hoặc kiểm thử tài khoản thật trên Render. Kiểm quyền/rollout PostgreSQL thật
đã được xác minh trong đợt triển khai production trước đó; CI chạy lại integration trên
database test riêng.

CI được bổ sung kiểm catalog/SVG, test và lint production AI, kiểm asset sau build.
Artifact Docker chỉ upload file JSON đã lọc; bật rõ tùy chọn cho đường dẫn `.tmp`
theo [hướng dẫn upload artifact](https://github.com/actions/upload-artifact#uploading-hidden-files).
Lỗi không tìm thấy artifact sẽ làm bước upload thất bại.

## Ảnh nghiệm thu

- [Catalog desktop](../ui-ux/evidence/protocol-catalog/catalog-39-desktop.png).
- [Trình tự gói tin](../ui-ux/evidence/protocol-workspace/desktop-sequence.png).
- [Mô phỏng mobile](../ui-ux/evidence/protocol-workspace/mobile-network.png).
- [Home và AI](../ui-ux/home-simulation-ai.md).
- [Bố cục lab và hành trình](../ui-ux/lab-workspace.md).
- [Trợ lý AI và avatar](../ai-lab-assistant/baseline/FE-01-02-browser.md).

Ảnh được chụp ở các đợt UI đã ghi trong báo cáo, không phải ảnh nghiệm thu lại trong
đợt dọn file/đóng gói PR. Chưa merge, deploy Render hoặc bật AI cho học viên.
