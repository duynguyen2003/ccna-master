# Phát hành AI Lab cho học viên

Ngày kiểm tra: 16/11/2026. Người dùng chọn giữ **Vercel + Render** và đồng ý giữ trần Gemini đề xuất **$0,05/ngày, $0,10/tháng**.

## Tình trạng thực tế

**Học viên chưa được bật AI trong cấu hình/DB ứng dụng đã kiểm tra.** Policy đang có là `admin-test`, admission/dispatch bật cho ADMIN, danh sách user/lab thông thường rỗng. Tài khoản học viên trong DB dùng role `STUDENT`; “USER” trong yêu cầu là nhóm này. Không có policy `production`.

Đã kiểm tra DB bằng transaction chỉ đọc, chỉ lấy policy và số lượng tài khoản theo role. Không đọc hội thoại, mật khẩu hoặc tiến độ cá nhân. Hai endpoint công khai [frontend](https://ccna-master.vercel.app/) và [API readiness](https://ccna-master.onrender.com/api/health/ready) trả 200; điều này không chứng minh quyền AI của tài khoản hay revision backend. Cấu hình Render chưa được thay đổi trong phiên triển khai này.

Trước thay đổi, worker từ chối `NODE_ENV=production`, Python chỉ nhận môi trường local, launcher chỉ phục vụ admin-test. Hiện đã có mã nguồn và công cụ phát hành production, **chưa áp dụng policy lên DB ứng dụng hoặc bật feature trên Render**.

## Những phần đã triển khai

| Phần                                                        | Hành vi                                                                                                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node/eligibility.js`                                       | `studentAccess=true` chỉ nhận role STUDENT hiện tại và lab nằm trong `labIds`; giữ chặn lab bị tắt. Các kiểm tra tài khoản, session, quyền attempt và lộ trình vẫn chạy.                                     |
| `node/workerConfig.js`                                      | Mode `production-gemini`, provider `gemini-production-v1`, bật bằng cờ rõ ràng, pin model/prompt/pricing/release SHA. Không dùng ledger20 lượt của test local.                                               |
| `python/app/config.py`, `gemini.py`, `main.py`              | Danh tính service production riêng, provider đúng môi trường, callback loopback, token/cost/deadline và một lần generation như pipeline hiện có.                                                             |
| `scripts/start-production-ai.cjs`, `production-entry.cjs`   | Khởi động API → Python → worker; sweeper chạy cùng worker. Python chạy trực tiếp, không qua tiến trình Node trung gian. Một dịch vụ lỗi thì dừng các dịch vụ cùng phiên. API-only là mặc định khi cờ AI tắt. |
| `node/productionPolicy.js`, `scripts/production-policy.cjs` | Status/dry-run chỉ đọc; bật/tắt có actor ADMIN, kiểm lab đã publish và học viên đang hoạt động. Apply có transaction/lock, idempotent, yêu cầu drain trước đổi cấu hình, giữ counters/spend/reservations.    |
| `Dockerfile`, `compose.ai.yaml`                             | Image `backend-ai` có Python3.11 và dependencies frozen. Một container giữ giao tiếp loopback; healthcheck theo PORT thực tế của host. Bổ sung các browser workspace còn thiếu khi build frontend Docker.    |
| CI                                                          | Build cả image API/AI và frontend, smoke PostgreSQL/API/Python/worker không gọi model thật; deploy Vercel chờ gate này. Bài PostgreSQL hiện có chạy thêm kiểm tra policy production.                         |

Các đường dẫn Node/Python/script trong bảng tính từ `src/agent`. Không thay API contract, engine mô phỏng, chấm lab hoặc bật đường `/explain` có phí.

## Cấu hình server

Dùng [production.env.example](../../../src/agent/production.env.example) làm danh sách biến. Secrets chỉ đặt trên backend/Render, không đặt trong `REACT_APP_*` hoặc Docker build arguments.

- `NODE_ENV=production`, `AI_ENVIRONMENT=production`, `AI_WORKER_MODE=production-gemini`.
- `AI_PRODUCTION_ENABLED=false` cho lần deploy chuẩn bị; đổi `true` khi đã có đủ cấu hình để khởi động runtime.
- `GEMINI_API_KEY` phía server; `GEMINI_MODEL=gemini-3.5-flash-lite`.
- `AI_SERVICE_SECRET`, `AI_OWNER_SECRET`, `JWT_SECRET` ít nhất 32 ký tự, tách biệt. Giữ secrets và `AI_RECOVERY_EPOCH` ổn định qua restart.
- Release dùng `RENDER_GIT_COMMIT`, hoặc `AI_RELEASE_SHA` 40 ký tự. Nếu khai báo cả hai phải trùng. Render cung cấp [commit SHA và PORT](https://render.com/docs/environment-variables); launcher dùng đúng PORT, callback/Python chỉ loopback.
- Giữ `LAB_AI_MODE=deterministic` hoặc `off`; không bật đường gọi cũ ngoài quota.

Model đang cấu hình có trong metadata Google trả 200. Đơn giá pin hiện có vẫn khớp [bảng Standard Gemini 3.5 Flash-Lite](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite): $0,30/triệu input token và $2,50/triệu output gồm thinking. DB dự phòng bảo thủ 5800 micro-USD/lượt rồi đối soát usage; không tự tăng trần ngân sách.

## Các bước phát hành trên Render

1. Đưa thay đổi đã kiểm thử vào revision phát hành. Xác minh schema AI đã migrate và backup theo quy trình vận hành hiện có; task này không thêm migration.
2. Dùng [Docker runtime trên Render](https://render.com/docs/docker) với Dockerfile ở gốc repo, context `.` và CMD mặc định. Nếu service hiện là Native Node, cần chuẩn bị Docker service phù hợp rồi kiểm tra URL/CORS; không giả định có thể đổi runtime đang chạy tại chỗ. Giữ frontend Vercel hiện có.
3. Đặt biến server ở trên. Không cố định callback 5500 của máy dev trên Render. Lần đầu giữ policy chưa bật để kiểm runtime mà chưa nhận câu hỏi học viên.
4. Xác minh `/api/health/ready` và Python `/health/ready` trong container; kiểm worker và log `ai.sweeper.started`. Readiness Python chỉ xác nhận cấu hình, không thay cho một generation thật.
5. Sao chép [production-policy.example.json](../../../src/agent/production-policy.example.json) sang file vận hành. Thay `actorId` bằng ADMIN thật, điền **lab đã kiểm chứng AI** vào `labIds`. Mẫu cố ý để lab rỗng để tránh mở toàn bộ ngoài ý muốn. Giữ `studentAccess=true` để nhận STUDENT ở các lab đó; hoặc `false` và điền `userIds` cho nhóm nhỏ.
6. Chạy dry-run, xem actor/lab, release và ngân sách, sau đó mới apply:

```sh
pnpm ai:production:policy --status
pnpm ai:production:policy --config /run/reviewed-ai-policy.json
pnpm ai:production:policy --config /run/reviewed-ai-policy.json --apply
```

Dry-run kiểm schema/actor/lab và metadata model, không ghi DB, không generate. Apply chỉ sửa policy `production` và các trần quota/slot của nó; không sửa role hay xóa lịch sử. Nếu có job/slot đang chạy, công cụ từ chối thay đổi để người vận hành drain trước.

7. Dùng một tài khoản học viên được phép vào lab: capabilities/quota phải trả 200, gửi một câu hỏi và theo dõi QUEUED → RUNNING → kết quả/LLM. Kiểm usage thực, quota, cancel và reload. Sau khi smoke đạt mới mở thêm lab/cohort. Câu trả lời không được fallback giả khi Gemini lỗi.

Ngân sách mẫu: 2 câu/phút, 20 câu/ngày/người, 1 slot toàn môi trường; 50.000 micro-USD/ngày và 100.000 micro-USD/tháng. Các bucket DB dùng chung giữa replica và không reset khi chạy lại công cụ.

## Rollback

Tắt admission/dispatch bằng ADMIN vận hành, không cần key Google còn hoạt động:

```sh
pnpm ai:production:policy --disable --actor ADMIN_ID
pnpm ai:production:policy --disable --actor ADMIN_ID --apply
```

Giữ worker/sweeper đủ lâu để xử lý receipt muộn và job hết hạn; rồi mới tắt `AI_PRODUCTION_ENABLED` hoặc quay về image trước. Danh tính production vẫn xác thực receipt khi dispatch tắt. Không reset recovery epoch/counters, không xóa slot đang có request để ép vượt drain.

## Kiểm chứng và giới hạn

- 274 test Node, 322 test Python đạt; lint/format/contracts/boundaries đạt.
- PostgreSQL cách ly: HTTP học viên 403 trước bật → 200 sau bật; role thay đổi bị chặn; actor/lab sai rollback; apply đồng thời/idempotent không làm tăng version; giữ spend; job pending chặn đổi plan; disable chặn lại truy cập.
- Image frontend và backend-ai build thành công; smoke container dùng PostgreSQL 16, PORT 10000, API/Python ready và worker/sweeper sống. Dữ liệu tổng hợp, không có policy mở cho học viên thật hoặc lượt generation thật trong kiểm tra Docker.
- Đã giảm số tiến trình Node bằng Python trực tiếp, sweeper cùng worker và tải validator khi cần. RAM fixture lúc rảnh giảm từ khoảng 638 xuống 351,5 MiB. Đây không phải cam kết đủ cho tải lớp học; cần theo dõi peak/RAM trên gói Render thực tế.
- Source được chuẩn bị trong nhánh PR vào `main`; chưa deploy revision này hoặc có kết nối quản trị Render trong phiên. Plugin Render đã được tìm thấy và đề xuất, nhưng chưa cài/kết nối. Do đó không đánh dấu USER đã dùng được trên production. Cần hoàn tất cấu hình host, phát hành và smoke tài khoản thật ở bước 7.

Bằng chứng tổng hợp: [production-readiness.json](production-readiness.json), ghi lại trạng thái trước khi publish source qua PR. Không lưu key/URL DB có credential trong báo cáo.

## Kiểm thử trên Render ngày 21/11/2026

Render chạy Docker trên gói Free ở Oregon với PostgreSQL Supabase tại Singapore. Đã xác nhận đủ 9 migration và kiểm archive của bản sao lưu PostgreSQL mã hóa. API, Python, worker và sweeper cùng khởi động từ bản `4ae2bde`. Vercel tiếp tục gọi URL API hiện có.

Pilot dùng một tài khoản STUDENT kiểm thử trên ITN 02. Capabilities trả 403 trước khi áp policy và 200 sau khi áp. API nhận câu hỏi vào hàng đợi, sau đó job hết hạn trước khi worker lấy và API đọc trạng thái gặp timeout DB. Kiểm receipt xác nhận 0 lượt Gemini, rồi đã tắt admission/dispatch của pilot.

Bản vá ưu tiên lấy job khi sweeper chạy cùng tiến trình, kiểm receipt và expiry trong cùng transaction, đồng thời khởi động API bằng lệnh mặc định của image khi cờ AI tắt. CI kiểm readiness ở cả hai chế độ. Hạn hàng đợi vẫn là 10 giây và ngân sách pilot giữ nguyên. Chỉ mở pilot sau khi bản vá chạy trên Render và dùng lượt thử có receipt thực để xác minh.

Lần thử bản `d408779` lấy job sau 5,6 giây và ghi permit. Timeout DB làm worker và API khởi động lại trước khi có receipt. Lượt này giữ trạng thái `OUTCOME_UNKNOWN` cùng dự phòng chi phí và policy thử nghiệm đã tắt.

Bản vá tiếp theo đọc trạng thái và quota trong snapshot PostgreSQL, giảm tranh khóa với callback. Sweeper chỉ lấy khóa cho job có thể cần cập nhật hoặc đã nhận receipt và chỉ dự toán usage sau cửa sổ 24 giờ. Mô phỏng DB trễ 176 ms cho thấy callback claim cần hơn 5 giây. Callback loopback production được chờ tối đa 10 giây trong deadline chung. Worker chờ vòng kế tiếp khi gặp timeout DB tạm thời, giữ bảo đảm mỗi permit chỉ dùng một lần.
