# UI cần thêm cho tích hợp AI — CCNA Master

**Triển khai28/10/2026 — UX-01/FE-01/FE-02:** ngăn Trợ lý lab đã chạy với contract
async v1, history/cancel/quota/feedback, recovery và scope tài khoản. Xem
[thiết kế](baseline/UX-01-assistant-design.md) và [báo cáo kiểm](baseline/FE-01-02-browser.md).
Phần triển khai ở `src/agent/browser` theo Agent.md, frontend chỉ có bridge.
**Hoàn thiện29/10/2026:** mục A, đặt lại hội thoại và tab quản trị AI đã được
triển khai thêm. Các checkbox dưới đây phản ánh code hiện tại; bằng chứng kiểm
được ghi ở cuối tài liệu. Runtime chỉ gọi Gemini bằng key server, không có fallback giả.

**Tinh gọn workspace29/10/2026:** đã hoãn “Cùng thực hành” (mời/gỡ/vào phiên)
và bỏ nút “Ưu tiên CLI” để tập trung ổn định thực hành cá nhân. Thanh phiên còn
Thành tích và Trợ lý AI; terminal/topology giữ một bố cục. Các thiết kế tiếp theo
không đưa hai mục đã hoãn trở lại nếu chưa có yêu cầu mới.

Tài liệu này liệt kê phần giao diện cần bổ sung khi tích hợp AI vào lab, dựa trên cấu trúc hiện tại của `src/frontend/src/features/labs/components/CliLabWorkspace.js` (1.254 dòng).

**Cập nhật ADR-01 ngày 19/10/2026:** R1 đã chốt API bất đồng bộ, lịch sử/cancel/delete và recovery theo [ADR-001](adr/ADR-001-async-api.md), sử dụng [contract v1](../../src/agent/contracts/ai-lab/v1/README.md). Dùng báo cáo28/10 để phân biệt phần đã chạy với backlog còn lại.

## 0. Hiện trạng UI có thể tái dùng

| Thành phần hiện có                       | Vị trí / tên trong code                                   | Dùng cho AI như thế nào                               |
| ---------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| Thanh gợi ý tĩnh                         | `cli-lab-hint-bar`, state `hintOpen`                      | Thêm liên kết "Hỏi trợ lý"                            |
| Panel phụ                                | state `secondaryPanel` ("Thành tích", "Trợ lý AI")        | Mở trợ lý hoặc thành tích, không có panel cộng tác     |
| Checklist nhiệm vụ                       | `cli-lab-checklist`, `focusedTaskId`, `pulseTaskId`       | Gắn câu hỏi với một nhiệm vụ; tái dùng hiệu ứng pulse |
| Khối feedback + nút "Giải thích kết quả" | `cli-lab-feedback`, `api.cliExplain`, state `explanation` | Nâng cấp (mục A)                                      |
| Chế độ preview / replay                  | `isPreview`, `replay`                                     | Vô hiệu hóa AI trong hai chế độ này                   |
| Chọn thiết bị, đích ping                 | `deviceId`, `destination`                                 | Làm ngữ cảnh cho "Phân tích kết nối"                  |
| Khóa thao tác                            | `busy`, `busyRef`, hàm `perform`                          | **Không** dùng cho AI (xem A)                         |

Nguyên tắc: tách phần AI thành component và hook riêng, không thêm trực tiếp vào file workspace hiện có.

---

## A. Sửa nút "Giải thích kết quả" hiện có

Việc cần làm (ưu tiên cao, ít rủi ro):

- [x] **Loading riêng.** `FeedbackExplanation` giữ `aiLoading` độc lập, nút hiện "Đang giải thích…". Không dùng `perform`/`busyRef`; terminal vẫn dùng được.
- [x] **Nhãn nguồn.** "Giải thích từ AI" chỉ khi API trả `provider: gemini`. Không dùng nhánh `configured/deterministic` cũ; lỗi503 hiện "AI tạm thời không khả dụng".
- [x] **Cảnh báo ngắn:** "AI có thể sai, hãy đối chiếu với kết quả chấm điểm".
- [x] **Giữ kết quả theo lần nộp.** Bấm ẩn/xem lại dùng kết quả trong memory, không gọi lại. Scope gồm auth/attempt/feedbackRecordedAt/feedbackRevision; đổi scope hoặc đăng xuất xóa nội dung và bỏ response muộn. Không lưu câu trả lời vào localStorage.
- [x] **Lượt còn lại có điều kiện.** Component đọc quota nếu response có cung cấp. Panel chat dùng quota chung từ backend; endpoint explain chuyển tiếp chưa công bố quota người dùng riêng, UI không suy số lượt từ budget toàn hệ thống.
- [x] **Lỗi429/503/mạng.** Lỗi nằm trong khối feedback; retry do người dùng chủ động. Backend giữ mã phân biệt hết lượt/gửi nhanh; không phát thêm toast lỗi500 chung cho request này.
- [x] **Accessibility.** Nội dung có `aria-live="polite"`, nút có `aria-busy`/`aria-expanded`; khóa click lặp trong lúc chờ.

Đường explain chuyển tiếp vẫn cần cấu hình `LAB_AI_MODE=local-live` riêng. Không
tự bật nó từ mode worker, không mở thêm cohort hoặc đổi ngân sách. `LAB_REVIEW`
qua queue/context đầy đủ vẫn là hạng mục backend riêng, không được giả lập ở UI.

---

## B. Panel "Trợ lý lab" (gợi ý trong lúc đang làm bài)

> Endpoint R1 đã có ở `/api/lab-attempts/:attemptId/ai`; FE-02 đã nối contract thật,
> bổ sung history/feedback và đặt lại hội thoại. Test doubles chỉ thuộc harness
> kiểm thử; runtime sản phẩm chỉ đăng ký Gemini.

### B.1. Điểm vào

- Nút **"Trợ lý AI"** ở thanh session, cạnh **"Thành tích"**, mở bằng `secondaryPanel`.
- Liên kết **"Hỏi trợ lý"** trong thanh gợi ý tĩnh.

### B.2. Nội dung panel

| Thành phần                         | Mô tả                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Ô câu hỏi và 3 chế độ              | Ô câu hỏi là chính; "Gợi ý", "Kết nối", "Giải thích" chọn intent R1. Thiết bị/mức gợi ý nâng cao thu gọn |
| Chọn thiết bị và đích              | Tái dùng `deviceId`, `destination`; bắt buộc chọn đích khi phân tích kết nối                         |
| Cấp gợi ý 1 → 2 → 3                | Học viên chủ động bấm "Gợi ý chi tiết hơn"; không tự động lộ đáp án                                  |
| Thẻ trả lời                        | Tóm tắt, danh sách bằng chứng (thiết bị, interface, quan sát), bước kiểm tra tiếp theo               |
| Lệnh gợi ý                         | Hiển thị dạng code kèm nút **Sao chép**; không có nút "Chạy"                                         |
| Badge "Dựa trên cấu hình trước đó" | Hiện khi state lab đã đổi sau lúc hỏi; kèm nút "Kiểm tra lại" tạo yêu cầu mới                        |
| Trạng thái chờ                     | State riêng của panel, không đụng `busyRef`                                                          |
| Lượt còn lại hôm nay               | Lấy từ API quota                                                                                     |
| Đánh giá 👍 / 👎                   | Kèm lý do ngắn (sai, không hữu ích, lộ đáp án, khó hiểu)                                             |
| Thông báo dữ liệu                  | Disclosure ngắn, đọc lại được; không chấm điểm hoặc tự chạy lệnh                                   |
| Thiếu dữ liệu / chưa hỗ trợ        | Nhãn kết luận, giải thích và nút "Bổ sung thông tin" chuyển tới chọn nguồn/đích, focus ô câu hỏi      |
| Chỉnh chiều rộng                   | Kéo mép trái, phím mũi tên/Home/End hoặc nút Thu hẹp/Mở rộng/Mặc định; lưu riêng số đo               |

### B.3. Các trạng thái cần thiết kế

| Trạng thái                            | Hiển thị                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Chưa hỏi                              | Ba nút ý định + giới thiệu ngắn                                            |
| Đang chờ                              | Skeleton / "Đang phân tích…", có thể hủy panel mà không ảnh hưởng terminal |
| Thành công                            | Thẻ trả lời + 👍/👎                                                        |
| Cũ (stale)                            | Thẻ trả lời kèm badge "cấu hình trước đó" + nút "Kiểm tra lại"             |
| Lịch sử hệ thống cũ                   | Giữ nhãn nguồn hệ thống; không sinh fallback mới                            |
| Hết lượt (429)                        | Số giờ/phút tới lúc reset; không có nút gửi                                |
| AI tắt hoặc lab chưa hỗ trợ (503/403) | Giải thích ngắn, ẩn ba nút ý định                                          |
| Lỗi mạng                              | Giữ nội dung đã chọn, nút "Thử lại"                                        |

---

## C. Điểm nối với UI cũ

- **Làm nổi bật thiết bị:** khi bằng chứng nhắc tới một thiết bị, highlight trên topology bằng cơ chế pulse hiện có. Không sửa dữ liệu topology để highlight.
- **Vô hiệu hóa đúng lúc:** tắt khi `replay` đang bật, `isPreview`, hoặc attempt không còn `IN_PROGRESS`. Luồng hiện tại tập trung thực hành cá nhân; phân quyền server và phạm vi hội thoại riêng từng người vẫn được giữ.
- **Dọn state:** reset panel khi đổi attempt, đổi tài khoản, đăng xuất.
- **Không auto-scroll** khi học viên đang đọc nội dung cũ.
- **Mobile:** panel chạy dạng ngăn kéo hoặc modal vì bố cục lab đã chật.
- **Nội dung do AI sinh:** chỉ render văn bản thường hoặc Markdown giới hạn; không bật raw HTML, không nhúng ảnh từ xa. (Khối giải thích hiện tại đã dùng thẻ `<p>`, giữ nguyên cách này.)
- **Câu hỏi vừa gửi:** hiện trong log ngay, dùng ID client và thay bằng bản server theo requestId; xóa ô soạn sau ACK. Nội dung chưa xác nhận không được ghi xuống storage.
- **Mức gợi ý:** nút "Gợi ý chi tiết hơn" gửi yêu cầu mức kế tiếp; luôn hiển thị mức thực tế server cho phép.

---

## D. Phía admin — đã triển khai

Trong `src/frontend/src/features/admin/pages/Labs.js`:

- [x] Tab **Trợ lý AI** trong trình sửa lab: bật/tắt theo lab và bấm Lưu cấu hình AI để áp dụng.
- [x] Lượt yêu cầu, chi phí đã ghi nhận và số call chưa quyết toán lấy từ PostgreSQL, đúng environment. Không biến usage chưa biết thành chi phí0.
- [x] Số đánh giá Hữu ích/Chưa hữu ích theo lab từ `ai_feedback`.
- [x] Kiểm role ADMIN và session hiện tại từ DB; version settings chặn ghi đè từ tab cũ. Công tắc chỉ sửa `disabledLabIds`, không mở cohort hoặc tăng cap, không đổi version provider policy của request đang chạy ở lab khác.

Lab mới cần lưu trước; lab không phải CLI hoặc chưa có policy sẽ không có toggle
ghi được. Bật lại vẫn cần máy chủ đang bật và tài khoản thuộc cohort hiện hành.

---

## E. Luồng bất đồng bộ bắt buộc ở R1

Các mục dưới đây dùng trong luồng R1 đã chốt; triển khai theo FE-02 và các endpoint backend tương ứng:

- [x] Lịch sử chat phân trang cursor, giữ neo cuộn khi tải câu hỏi trước.
- [x] Đặt lại hội thoại: xác nhận rồi DELETE conversation với epoch hiện tại. Xóa message/feedback/snapshot/provider text trong transaction, tăng epoch; request đang chạy bị đánh dấu DELETED. Giữ ID, usage và reservation để quyết toán receipt muộn. Không xóa hội thoại của thành viên khác.
- [x] Hủy request đang chạy, không chạy lại generation khi mất ACK.
- [x] Polling/recovery theo ID ổn định, mỗi tab đọc request server; đóng/ẩn/offline dừng IO.
- [x] Xử lý `recoveryEpoch`, `AI_RECOVERY_RECONFIRM`, epoch đổi từ tab khác; không hiển thị nội dung cũ trong scope mới.

Chat tự do không giới hạn ý định vẫn ngoài R1. Mục A có thể cải thiện nút cũ trong giai đoạn chuyển tiếp; khi tích hợp `LAB_REVIEW` phải đi qua request/quota chung, không mở thêm đường gọi model có phí trực tiếp.

---

## F. Gợi ý cấu trúc file

```text
src/agent/browser/
  components/AiLabPanel.jsx      # panel, composer, hint level và trạng thái
  components/AiMessage.jsx      # text/bằng chứng/copy/feedback
  hooks/useAiLabAssistant.js     # scope + subscription/lifecycle
  state/assistantController.js  # ID, reconcile, poll, cancel, history
  api/aiLabApi.js               # HTTP + strict contract
  styles/AiLab.css              # token lab, desktop/mobile
  components/FeedbackExplanation.jsx # loading/cache/lỗi riêng cho explain chuyển tiếp
  components/AdminLabAi.jsx     # công tắc và số liệu thật theo lab
  hooks/usePanelWidth.js        # resize bằng kéo/bàn phím/nút
src/frontend/src/features/labs/components/AiLabAssistant.jsx # bridge Dialog/API URL
src/frontend/src/features/labs/components/CliLabWorkspace.js # hai điểm mở/props
src/agent/node/conversation.js   # history cursor + feedback có kiểm quyền
src/agent/node/admin.js          # per-lab policy + thống kê DB, kiểm ADMIN
```

- Load lazy cho panel để không tăng bundle ban đầu.
- Dùng token màu/khoảng cách của `src/frontend/src/features/labs/styles/CliLabTokens.css` để khớp theme dark/light hiện có.

---

## G. Thứ tự thực hiện đề xuất

1. [x] Mục A (sửa nút "Giải thích kết quả") — giữ endpoint chuyển tiếp hiện có.
2. [x] Dựng `AiLabPanel` và các trạng thái R1; dữ liệu tổng hợp chỉ ở test harness.
3. [x] Nối contract HTTP/backend/quota/recovery và Gemini thật; giữ gate cohort hiện hành.
4. [x] Chọn thiết bị từ bằng chứng, đánh giá và thông báo dữ liệu lần đầu.
5. [x] Test component/controller và hồi quy workspace; chặn replay/preview, reset auth/attempt.
6. [x] Admin: công tắc theo lab, thống kê chi phí/lượt/feedback và kiểm quyền.

## H. Tiêu chí nghiệm thu UI

Các tiêu chí được kiểm bằng component/controller, PostgreSQL riêng và browser
harness dùng component thật. UI test không gọi provider có phí; không thêm mock
endpoint vào ứng dụng. Kết quả nghiệm thu được ghi ở mục I sau kiểm cuối.

- Bấm "Giải thích kết quả" hoặc hỏi trợ lý không làm terminal bị khóa.
- Người dùng luôn phân biệt được nội dung từ AI với nội dung dự phòng của hệ thống.
- Không có nút nào tự chạy lệnh từ gợi ý của AI.
- Nội dung cũ được đánh dấu rõ khi cấu hình lab đã thay đổi.
- Hết lượt, AI tắt hoặc lỗi mạng đều có thông báo rõ và không làm hỏng phần lab còn lại.
- Đổi attempt hoặc đăng xuất không để lộ nội dung của phiên trước.
# Cập nhật UI và runtime — 29/10/2026

Panel mặc định440px, điều chỉnh320–680px theo phần màn hình còn lại, nội dung15px/line-height1.7; header gọn
với quota, disclosure dữ liệu đóng mặc định. Hội thoại tách câu hỏi, summary,
bước tiếp theo, CLI có sao chép và kiểm chứng; composer dùng ba nút chọn chế độ
gọn, textarea chính và tùy chọn thiết bị/mức gợi ý thu gọn. Mobile dùng Dialog chung,
control nhập16px, focus/Escape và vùng cuộn độc lập. Giữ màu lab hai theme.

Runtime chỉ chạy Gemini bằng key phía server. Node/Python/launcher/setup từ chối
mode fake cũ; “Giải thích kết quả” trả503 khi provider lỗi thay vì dựng nội dung
thay thế. Test doubles chỉ được import trong kiểm thử. Lịch sử trả lời cũ vẫn
được gắn nguồn hệ thống, không đổi thành câu trả lời AI.

## I. Kiểm chứng đợt hoàn thiện29/10/2026

- 235 test Node AI và35 test frontend (4suite) đạt; gồm loading không khóa CLI,
  cache theo lần nộp, auth/attempt/response muộn, lỗi429/503/network, resize và
  giữ chiều rộng ưa thích khi chuyển sang mobile, thiếu dữ liệu và admin toggle.
- PostgreSQL riêng:17constraint test fresh +17upgrade +47HTTP/lifecycle/Python
  integration đạt. Đặt lại qua DELETE HTTP có kiểm body/epoch/quyền; receipt
  đến muộn vẫn quyết toán5microUSD của provider tổng hợp và không tạo lại text.
  Hội thoại thành viên khác còn nguyên. Công tắc admin kiểm role từ DB, giữ
  cohort/limits/provider policy version và chặn ghi đè từ tab cũ.
- 78 test CLI đạt;1DB integration opt-in skip. Build production, ESLint và kiểm
  boundary đạt. Các bài kiểm đợt này không gọi provider có phí hoặc reset ledger.
- Browser dùng harness riêng với component thật; dữ liệu/endpoint tổng hợp chỉ
  nằm trong `.tmp/ai-complete-20261029`, không được đóng gói vào app. Evidence
  gồm log, ảnh và số đo responsive. Không thay cấu hình quyền/policy DB ứng dụng.

Giới hạn: quota riêng của explain và context LAB_REVIEW đầy đủ vẫn phụ thuộc
backend chuyển tiếp đã nêu ở A; UI không suy đoán số liệu. Chưa kiểm screen reader
hoặc bàn phím ảo trên thiết bị thật; không xem test harness là bằng chứng E2E với
tài khoản production. Gemini thật đã được xác minh ở lượt trước, đợt này giữ
provider/key/model/cap hiện có.
