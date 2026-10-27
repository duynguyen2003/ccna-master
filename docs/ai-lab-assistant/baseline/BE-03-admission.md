# BE-03 — Nhận câu hỏi, chống gửi trùng và giữ hạn mức

**Ngày:** 23/10/2026. **Trạng thái:** hoàn thành admission local; [BE-04 đã bổ sung worker/dispatch local-fake](BE-04-worker.md), UI FE-02 chưa nối.

BE-03 là cửa nhận câu hỏi. Nó kiểm điều kiện, lưu câu hỏi vào hàng chờ và tạm giữ lượt/tiền cần thiết. Việc lấy câu hỏi ra chạy thuộc BE-04.

Ví dụ, bạn bấm gửi hai lần vì mạng chậm. Nếu cả hai lần dùng cùng mã và nội dung, backend phải trả về cùng một câu hỏi. Đây là ý nghĩa của “idempotency”: gửi lại không tạo thêm tác dụng.

## API và transaction

Các route dưới `/api/lab-attempts/:attemptId/ai` đều đi qua kiểm quyền BE-02, chỉ nhận token ở Bearer header:

- POST `/requests`: kiểm dữ liệu theo contract v1, trả 202 cho câu hỏi mới/đang chờ; gửi lại câu hỏi đã kết thúc thì trả 200.
- GET `/requests/by-client-id/:id` và `/requests/:id`: tìm lại câu hỏi/xem trạng thái sau khi kiểm quyền hiện tại, không gọi AI.
- GET `/capabilities`, `/quota`: trả phạm vi được dùng, epoch và hạn mức công khai theo contract; không lộ ngân sách toàn hệ thống.

Response dùng `{contractVersion,data}` hoặc `{contractVersion,error}`, kèm `X-AI-Contract-Version` và cache private/no-store. Yêu cầu đang chờ có Location chỉ tới tài nguyên để xem tiếp. Route by-client-id đứng trước requestId để không bị nhận nhầm; ID trên path được kiểm đúng UUID.

### Một lần nhận câu hỏi diễn ra thế nào?

1. **Kiểm lại quyền:** `ai/requests.js` chạy kiểm BE-02 trong transaction theo attempt. Khóa đọc account/policy và khóa dùng chung theo environment giúp các backend không cùng quyết định dựa trên một hạn mức cũ. Chưa đo tốc độ xử lý hoặc p95 cho pilot; không giữ khóa trong lúc gọi HTTP/provider.
2. **Tìm yêu cầu cũ:** dấu nhận diện nội dung (`canonical hash`) dùng helper chung, gồm phạm vi attempt. Tìm theo ownerKey/clientRequestId trước khi kiểm độ cũ/phục hồi. Nội dung giống thì trả yêu cầu cũ; khác nội dung cùng mã thì trả 409.
3. **Kiểm câu hỏi mới:** recovery epoch bên ngoài DB, conversation epoch, revision và thiết bị/task phải khớp. Bản chụp kèm yêu cầu tối đa 64 KiB. Mức gợi ý hiệu lực hiện là 1; chính sách gợi ý đầy đủ thuộc AI-01.
4. **Lưu các phần cùng nhau:** tạo conversation nếu cần, request `QUEUED`, user message, reservation và outbox trong một transaction. Reservation là hạn mức giữ chỗ; outbox là sự kiện đã lưu để xử lý tiếp. Lỗi thì cả lần ghi bị hủy.

Trước khi ghi, backend kiểm mỗi người chỉ có một câu hỏi đang chờ/chạy; database cũng có partial unique để chặn cuộc đua giữa các chương trình. Context hash, source revision và các phiên bản được lưu cùng yêu cầu. Chính sách phải cung cấp phiên bản model/price/prompt/diagnostic đúng schema; simulatorVersion lấy từ attempt, policyVersion lấy từ chính sách hiện tại.

### Giữ hạn mức thế nào?

`ai/quota.js` dùng giờ database từ `clock_timestamp()` và chia ngày/tháng theo UTC. Bucket là một ô theo dõi hạn mức cho từng phạm vi và khoảng thời gian:

| Bucket       | Khi nhận câu hỏi mới                            |
| ------------ | ----------------------------------------------- |
| user/phút    | Đếm lần nhận câu hỏi mới, chặn gửi quá dồn dập. |
| user/ngày    | Giữ một lượt và chi phí tối đa `maxCost`.       |
| global/ngày  | Giữ chi phí tối đa trong ngân sách chung ngày.  |
| global/tháng | Giữ chi phí tối đa trong ngân sách chung tháng. |

Một yêu cầu có ba reservation gắn với user/day, global/day và global/month. Tiền dùng micro-USD với BigInt. Khóa environment và cập nhật trong transaction tránh hai người cùng chiếm phần ngân sách chỉ đủ cho một câu hỏi. Cả mức đang cấu hình lẫn mức đã lưu trên bucket đều phải đủ. Giảm limit có tác dụng ngay; tăng limit chưa tự cập nhật bucket đã tồn tại.

Gửi lại yêu cầu cũ không giữ hạn mức thêm. Lỗi ở bất kỳ bước nào thì rollback cả quota/request/message/outbox. BE-03 không gọi module provider. Việc chốt/hoàn hạn mức và dọn yêu cầu bỏ dở thuộc BE-04, vì trạng thái “đã kết thúc” chưa chứng minh AI chưa phát sinh phí.

## Cấu hình cần có trước khi bật trên DB ứng dụng đã migrate

- `AI_ENVIRONMENT`: tên môi trường/chính sách, mặc định `local`.
- `AI_RECOVERY_EPOCH`: giá trị quản lý nằm ngoài DB, đúng định dạng ID của contract. Đổi sau khi restore trước khi bật nhận câu hỏi, để không tự chạy lại việc bị mất khỏi backup.
- `AI_OWNER_SECRET`: khóa server ít nhất 32 ký tự, dùng HMAC tạo ownerKey. Giữ cùng giá trị giữa các backend/lần khởi động lại; thiếu thì không tự sinh. Đổi khóa cần kế hoạch chuyển sổ chi phí, chống trùng và hạn mức.
- Bản ghi `AiRuntimePolicy`: `admissionEnabled=true`, eligibilityRules có danh sách userIds/labIds được phép; limits có userMinute, userDay, globalDayMicros, globalMonthMicros, maxCostMicros. Tất cả là số nguyên hữu hạn không âm; số lượt nằm trong miền PostgreSQL Int. Thiếu limits/versions hợp lệ thì từ chối nhận câu hỏi.
- `limits.versions`: contextSchemaVersion=1.0.0, diagnosticVersion, promptVersion, modelVersion, priceVersion, appCommit SHA 40 ký tự. Giá trị phải khớp cấu hình đã kiểm duyệt; ví dụ tổng hợp trong test không dùng làm cấu hình provider thật.

Task chỉ tạo chính sách thử trên DB tạm. Không bật chính sách, ghi khóa hoặc cập nhật cấu trúc DB ứng dụng/production. Trần của nhánh Gemini local riêng không tự trở thành ngân sách R1. Có API nhận câu hỏi chưa cho phép gọi model thật qua luồng mới.

## Bằng chứng

Đã chạy `pnpm.cmd test:ai:storage` trên PostgreSQL local 55432: kiểm DB mới/nâng cấp và BE-01/02/03. Test tạo hai chương trình Node có PID khác nhau, mỗi bên có Express và nhóm kết nối Prisma riêng, dùng chung DB tổng hợp. Các kết quả dưới đây thuộc mốc nghiệm thu BE-03 ngày 23/10.

- 20 POST đồng thời qua hai backend: cùng requestId, đúng một tin nhắn người dùng, một outbox và ba reservation.
- Cùng mã khác nội dung → 409; tạo yêu cầu đang chạy thứ hai → 429. Gửi lại sau khi lab đổi vẫn trả yêu cầu cũ/có nhãn stale; ID mới sai revision hoặc recovery epoch → 409.
- GET by-client-id tìm đúng yêu cầu; gửi lại yêu cầu đã kết thúc → 200.
- Vượt hạn mức người dùng/ngày hoặc phút → 429; vượt ngân sách chung → 503. Câu hỏi bị từ chối không làm thay đổi bucket.
- Hai người tranh phần ngân sách chỉ đủ cho một câu hỏi: một bên 202, bên kia 503; tổng giữ chỗ không vượt trần.
- Cố tình gây lỗi database ở outbox → 500 đúng khuôn lỗi; không còn request, mọi bucket rollback và không tạo provider call. Trigger gây lỗi được gỡ trong finally.
- Response capabilities/quota/request/error đều qua bộ kiểm schema chung.

**Kết quả:** 34/34 storage; 15/15 DB/HTTP (BE-02: 7, BE-03: 8 gồm test cha); 6/6 access/snapshot unit; 100/100 contract Node. ESLint/Prettier và boundaries đạt. CI được bổ sung lint/test, chưa push/chạy GitHub. Có warning pg hiện hữu về truy vấn concurrent trong client; chưa nâng dependency trong task này.

Đây là kiểm backend qua HTTP, chưa phải toàn luồng trên trình duyệt. Ở mốc BE-03, giao diện hội thoại chưa nối; hủy/lịch sử/đánh giá/thời hạn lưu và worker thuộc các task tương ứng. Dev server thường trực và DB ứng dụng giữ nguyên cấu hình.

**Cập nhật sau BE-04:** đã có worker, cấp phép, biên nhận, chốt hạn mức local/fake và POST cancel. Đồng hồ DB dùng epoch milliseconds, kết nối đặt session UTC để tránh lệch múi giờ của adapter-pg. Những phần ghi “chưa có” ở trên là tại mốc BE-03; xem [BE-04](BE-04-worker.md) cho phần đã bổ sung. Tiếp theo BE-05; model thật vẫn cần lọc dữ liệu, chính sách provider và ngân sách đã xác minh.
