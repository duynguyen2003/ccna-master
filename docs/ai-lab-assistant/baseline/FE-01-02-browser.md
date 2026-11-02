# FE-01/FE-02 — Ngăn trợ lý lab và kết nối bất đồng bộ

Ngày28/10/2026. Trạng thái: hoàn thành triển khai và kiểm local/fake; chưa mở
provider/cohort hoặc nghiệm thu pilot. UX-01 làm trước, xem
[wireframe/copy/walkthrough](UX-01-assistant-design.md).

## Thay đổi cho học viên

- Mở **Trợ lý lab** trên thanh phiên hoặc **Hỏi trợ lý** trong gợi ý. Mobile có
  **Mở trợ lý lab** ở thông báo dùng máy tính; CLI vẫn giữ điều kiện laptop.
- Ngăn desktop phủ đúng vùng nhiệm vụ370/320px, không đổi grid hoặc kích thước
  terminal. Phần nhiệm vụ bên dưới inert, terminal tiếp tục gõ được khi chờ AI.
  Mobile dùng Dialog chung, Tab/Escape và trả focus. Có loading riêng khi tải ngăn.
- Ba ý định, mức gợi ý do người học đề nghị, trường nguồn/đích khi chẩn đoán,
  nội dung câu hỏi có giới hạn. Không có chat tự do ngoài các ý định R1.
- Trả lời là plain text do React escape; nguồn AI/hệ thống, độ chắc chắn,
  bằng chứng/thiết bị, tối đa hai bước, lệnh đọc có Sao chép và cách kiểm tra lại.
  Không render HTML, link tự sinh, ảnh từ xa hoặc nút Chạy lệnh AI.
- Hiện revision cũ theo phiên bản nguồn và live/server hiện tại; thay đổi lab
  không tự gọi model. Bấm Kiểm tra lại mới tạo câu hỏi theo cấu hình hiện tại.
- Đánh giá hữu ích/chưa hữu ích có lý do, lưu qua server. Disclosure dữ liệu mở
  lần đầu khi chưa có hội thoại, có thể đọc lại. Không gọi AI là nguồn chấm điểm.
- Đang đọc lịch sử thì không tự cuộn theo response; có Tin mới. Tải trang cũ
  giữ vị trí đọc, có retry lịch sử riêng. Offline giữ draft trong tab.

## Vị trí code và điểm nối

Theo Agent.md, triển khai AI nằm trong `src/agent`, không đặt logic AI ở frontend:

| Phần                    | File                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| Package browser-only    | `src/agent/browser`, tên `@ccna/agent-ui`                        |
| UI/renderer/CSS         | `components/AiLabPanel.jsx`, `AiMessage.jsx`, `styles/AiLab.css` |
| HTTP client             | `api/aiLabApi.js`                                                |
| State/lifecycle         | `state/assistantController.js`, `hooks/useAiLabAssistant.js`     |
| Ghép ứng dụng           | `CliLabWorkspace.js`, bridge `AiLabAssistant.jsx`                |
| History/feedback        | `src/agent/node/conversation.js`, `routes/aiLab.js`              |
| Biên dịch JSX workspace | `src/agent/scripts/frontend-browser.cjs`, wrapper CRA            |
| CORS ứng dụng           | `Server.js`: expose contract version/Retry-After/Location        |

Browser package chỉ dùng React và contract browser-safe. Boundary checker chặn
import Node/backend/frontend implementation và các package máy chủ từ UI này.
CRA chỉ thêm đúng thư mục browser vào Babel/ModuleScope, không mở toàn agent.
Không eject, không sửa code thư viện trong node_modules hoặc mang provider/DB/key vào bundle.
Hai entrypoint JS mỏng tương thích Jest27; source JSX vẫn ở browser package.

Lockfile chỉ thêm liên kết workspace, không thêm thư viện bên ngoài. Đã kiểm
frozen lockfile bằng `--lockfile-only`; không tuyên bố đã clean-install toàn repo.
CI thêm kiểm controller/API và lint browser package; các frontend tests mới tự
được chọn bởi suite hiện hữu. Chưa chạy workflow mới trên GitHub.

## Vòng đời câu hỏi và quyền riêng tư

1. Tải capabilities/quota, history đúng hội thoại/epoch. Không tạo hội thoại qua GET.
2. Tạo clientRequestId bằng UUID trước POST, lưu metadata ID theo user/attempt
   vào sessionStorage; không lưu token, câu hỏi hoặc câu trả lời ở đó/localStorage.
3. POST nhận202 hoặc200; pending poll theo2/3/5/8giây với jitter và pollAfterMs,
   tôn trọng Retry-After dài hơn. GET không tạo model call.
4. Mất response hoặc reload: tìm theo by-client-id. Chỉ retry POST cùng body/ID
   khi người học bấm retry và lookup chưa tìm thấy; không tự tạo ID mới. Mất cả
   payload sau reload thì chỉ tìm ID cũ hoặc yêu cầu xác nhận câu hỏi mới.
5. Close/hidden/offline/unmount abort IO và dừng timer; mở lại chỉ có một vòng
   poll. Hủy trước khi ACK được giữ trong memory và gửi cancel ngay khi có ID.
6. Auth/attempt scope mới có snapshot và local draft mới ngay từ render;
   response muộn bị bỏ theo generation. Conversation/history epoch lệch hoặc
   thu hồi quyền xóa nội dung đang hiển thị và vô hiệu hóa response cũ.
7. Trạng thái terminal không bị GET cũ đưa về RUNNING. OUTCOME_UNKNOWN không
   tự gọi model lại. Lỗi quota/503 xác định không bị coi nhầm là đã nhận câu hỏi.

Client kiểm envelope/header version, schema và binding evidence/command trước
render. Mỗi thao tác server vẫn kiểm JWT/session/current membership/cohort và
conversation owner. Cache trong memory thuộc một scope; lịch sử server là nguồn
phục hồi, chủ lab nhóm không được đọc hội thoại riêng của thành viên.

## Bổ sung backend cần cho FE-02

History và feedback đã có schema nhưng chưa có runtime route. Đã bổ sung:

- `GET /api/lab-attempts/:id/ai/messages`: limit1–50, cursor HMAC gắn môi trường,
  người dùng, attempt, conversation và epoch; thứ tự `(createdAt,id)` ổn định.
- `POST .../messages/:messageId/feedback`: chỉ assistant message đúng chủ/epoch,
  upsert theo user/message, kiểm body bằng schema, lọc nội dung comment.
- CORS expose custom headers để strict client hoạt động khi frontend/API khác
  origin; không thay danh sách origin được phép hoặc đưa token vào query.

Contract FeedbackRequest hiện cho comment1000code point nhưng cột cũ chỉ500.
Thêm migration `20261028123000_ai_feedback_comment_capacity` nâng VARCHAR1000;
không cắt comment âm thầm hoặc thay wire contract1.0.0. Chỉ migrate trên hai DB
thử do runner tạo/xóa đúng OID. Chưa áp migration này lên DB ứng dụng/production.
UI R1 chỉ thu helpful/reasonCode, không mở ô comment tự do.

## Kiểm tra và bằng chứng

- Controller/API:16test, gồm double-submit, mất ACK/reload, retry cùng payload,
  auth/late response, hidden/offline/close, cancel trước ACK và race GET/cancel,
  revoke history, invalid input,503, Retry-After, chặn GET chồng nhau và tái kiểm
  quyền khi lookup404 để không nhầm mất quyền với câu hỏi chưa được nhận.
- Frontend targeted:20test ở2suite (6test trợ lý +14test workspace hiện có),
  gồm HTML/script/URL nguy hiểm inert, copy/feedback, stale, diagnose input,
  đổi auth xóa draft, offline, không cuộn khi đọc và hồi quy replay/preview/CLI.
- Toàn bộ frontend qua wrapper mới:37suite/286test đạt; không chỉ kiểm ngăn mới.
  Dialog thêm một regression test cho summary và vùng lịch sử có tabindex0;
  workspace loại controls inert khỏi vòng Tab khi ngăn phủ vùng nhiệm vụ.
- Node hồi quy `test:ai`:224test đạt. CLI:76đạt/1DB opt-in skip.
- PostgreSQL/HTTP runner:17fresh +17upgrade +37access/admission/context/worker
  test/subtest đạt; gồm private history ở lab nhóm, cursor chéo/tamper, feedback
  owner/upsert/comment1000, remove member và revoke session. Migrate/rollback
  compatibility đã chạy trên DB thử, không dùng DB học viên.
- Contract artifacts:17schema không đổi; source boundaries và lint/format đạt.
- Production build qua wrapper CRA thành công. AI nằm trong chunk lazy riêng;
  bundle Home không nhúng panel. Bản preview tách entry chỉ để QA local.
- Browser dùng fixture tổng hợp: terminal310px cao,1009,2px rộng giữ nguyên trước/
  sau mở; gõ CLI trong lúc chờ vẫn tăng revision, stale hiện và cancel hoạt động.
  Desktop đủ hai theme, panel370px không phủ lên terminal, focus trả điểm mở.
- Browser mất response rồi tải lại: tra by-client-id, phục hồi câu hỏi và đáp án,
  POST delta=1. Đổi tài khoản không hiện câu hỏi trước. Mobile375/320px kiểm
  Dialog, focus trap/Tab/Escape, theme và không tràn ngang. Thử API qua hai cổng
  riêng để kiểm CORS/header version, không chỉ fixture cùng origin.

Runner/log/JSON/ảnh ở `.tmp/ai-ui-20261028/`; DB evidence trong `.tmp/ai-lab-be01/`.
Không có model/provider thật được gọi trong task này. Các log có warning tooling
fs.F_OK/pg hiện hữu; không tính warning là test fail. Chưa kiểm screen reader/
thiết bị touch thật, benchmark nhiều người hoặc chất lượng Gemini tiếng Việt.
Browser fixture không thay kiểm full browser ↔ DB ↔ Python ↔ Gemini; phần đó ở
QA/GATE, không được suy ra từ các test riêng đã đạt.

## Phần giữ ở task khác

BE-06 còn đường legacy `/explain` và loading của nút cũ; không dùng lại đường đó
cho panel mới. BE-08 còn xóa/purge/retention, nên chưa có nút xóa giả. FE-03/QA/OPS
còn hoàn thiện UX/policy/eval/rollout và vận hành. Worker/provider/cohort vẫn mặc
định theo cấu hình hiện có; hoàn thành ba task này không tự bật model hay pilot.

Sau FE-01/02, môi trường dev riêng `admin-test` ban đầu được bật bằng fake
worker cho ADMIN. Theo yêu cầu gọi thật ngày 28/10/2026, app đã chuyển sang
`app-gemini` qua Python; smoke HTTP đạt `COMPLETED/LLM` với usage/chi phí thật.
Xem [cấu hình, cách test, ngân sách và bằng chứng](admin-test-access.md).
Đây là thay đổi sau task giao diện; chưa phải nghiệm thu browser ↔ Gemini
hoặc mở pilot học viên.

Xem [phân tích độ trễ từng chặng](latency-analysis.md) để phân biệt queue,
countTokens, Google generation, receipt và polling; timeout55giây là giới hạn,
không phải thời gian chờ cố định của UI.
