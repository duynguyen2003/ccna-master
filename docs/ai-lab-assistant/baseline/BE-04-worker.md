# BE-04 — Worker xử lý câu hỏi, giấy phép gọi AI và biên nhận kết quả

**Ngày nghiệm thu:** 23/10/2026. **Trạng thái:** đã làm và kiểm thử worker trên máy bằng AI giả lập. Model thật và dịch vụ Python tiếp tục ở BE-05/PY-01/PY-02. Số liệu trong tài liệu là kết quả của lần nghiệm thu này.

BE-03 đã nhận câu hỏi và đưa vào hàng chờ. **BE-04 lấy câu hỏi ra xử lý, lưu kết quả, chốt hạn mức và xử lý khi có lỗi giữa chừng.**

Ví dụ, bạn hỏi “Vì sao PC1 không ping được PC2?”. Backend nhận câu hỏi xong có thể phản hồi ngay; một chương trình riêng gọi là worker tiếp tục xử lý phía sau. Trong lúc chờ, bạn vẫn dùng terminal lab được. Hiện BE-04 thử đường đi này bằng AI giả; phần chẩn đoán thật sẽ được ghép ở các task tiếp theo.

## Luồng đã có

### 1. Worker nhận một câu hỏi đang chờ

Worker chạy riêng bằng `pnpm.cmd ai:worker`. Nó lấy việc từ PostgreSQL bằng `FOR UPDATE SKIP LOCKED`: bỏ qua việc đang được worker khác giữ. Lần nhận việc được commit ngay, yêu cầu chuyển sang `RUNNING` và tăng số phiên xử lý (`fence`).

Worker giữ việc theo `lease` 15 giây và cứ 5 giây gửi `heartbeat` để báo còn hoạt động. Fence giúp chặn worker cũ quay lại ghi đè sau khi việc đã chuyển cho phiên khác. Tạo dữ liệu đầu vào, gọi HTTP và sinh câu trả lời đều ở ngoài transaction, tránh giữ khóa database trong lúc chờ.

### 2. Lên kế hoạch và kiểm lại điều kiện

`dispatch.plan` lưu một lần gọi `step=0` cùng đầu vào đã qua bộ kiểm contract. Nếu giao lại việc, chỉ cập nhật fence cho lần gọi còn `PLANNED`; không tạo lần gọi thứ hai cho cùng câu hỏi.

Trước khi cấp phép, kiểm lại tài khoản/phiên/thành viên, epoch và dấu xóa hội thoại, recovery epoch, nhóm được bật tính năng, chính sách/các phiên bản, thời hạn và phần hạn mức đã giữ thành công. Như vậy quyền lúc gửi câu hỏi không bị coi là quyền tồn tại mãi.

### 3. Cấp phép gọi AI một lần

Permit là giấy phép thực hiện lần gọi. API nội bộ đổi `PLANNED` → `DISPATCHED` đúng một lần. Giấy phép ngăn việc tự gọi lại khi có sự cố, không phải lời bảo đảm nhà cung cấp bên ngoài luôn chạy chính xác một lần.

Các worker dùng chung bảng chỗ chạy (`execution slots`) theo environment. Giảm `limits.globalConcurrency` vẫn giữ các chỗ đang dùng và dừng cấp chỗ mới khi tổng số đang dùng đã đạt trần mới. Lần gọi chưa rõ kết quả giữ chỗ tới thời hạn sinh câu trả lời cộng 5 giây chờ thêm (`grace`).

### 4. Nhận kết quả và hoàn tất câu hỏi

Receipt là biên nhận kết quả lần gọi, gồm đầu ra và thông tin sử dụng nếu có. Khi đã có receipt, finalizer đọc nó để lưu tin nhắn assistant, trạng thái cuối, chốt hạn mức (`settlement`) và outbox trong cùng một transaction.

Mỗi request/role chỉ có một tin nhắn. Yêu cầu đã kết thúc không mở lại. Worker có fence/lease cũ không được ghi trạng thái mới.

### 5. Dọn việc bỏ dở và cho phép hủy

Reaper là bộ phận tìm yêu cầu bị bỏ dở hoặc hết hạn. POST `requests/:requestId/cancel` đã đi qua kiểm quyền BE-02. Cách xử lý phụ thuộc việc đã cấp phép gọi AI hay chưa:

| Tình huống                                             | Cách xử lý đã có                                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Worker mất lease trước khi cấp phép, vẫn còn thời gian | Có thể nhận lại yêu cầu `RUNNING` để xử lý tiếp.                                              |
| Đã cấp phép nhưng mất worker hoặc mất xác nhận (`ACK`) | Không tự gọi model lại: lần trước có thể đã chạy.                                             |
| Receipt đã lưu nhưng câu hỏi chưa hoàn tất             | Finalizer đọc receipt đã có, không cần gọi AI lần nữa.                                        |
| Hết deadline và grace vẫn thiếu kết quả                | Đánh dấu `OUTCOME_UNKNOWN`: chưa xác định được kết quả.                                       |
| Yêu cầu chưa bắt đầu sau thời gian chờ quá 10 giây     | Đánh dấu `EXPIRED`: hết hạn chờ.                                                              |
| Hủy trước khi cấp phép                                 | Hoàn phần hạn mức giữ chỗ (`reservation`).                                                    |
| Hủy sau khi cấp phép                                   | Hoàn lượt hỏi; giữ tiền chưa rõ usage và chỗ chạy tới khi có kết quả hoặc hết deadline/grace. |

## Internal API và dữ liệu

Các API sau dành cho giao tiếp giữa dịch vụ, đặt dưới `/internal/v1/ai/provider-calls/:callId`:

| Method/path    | Quyền                            | Kết quả                                                           |
| -------------- | -------------------------------- | ----------------------------------------------------------------- |
| POST `/claim`  | Token dịch vụ, operation CLAIM   | Cấp permit một lần hoặc trả 409.                                  |
| PUT `/receipt` | Token dịch vụ, operation RECEIPT | Trả hash biên nhận đã ghi; gửi lại giống hệt thì không ghi trùng. |

### Quyền gọi API nội bộ

Token HS256 dùng khóa riêng `AI_SERVICE_SECRET`, ít nhất 32 ký tự. Thiếu thì không tự sinh và không dùng JWT người dùng thay thế. Server kiểm bên cấp `ccna-node`, danh tính `ai-python`, audience/operation, keyId `local-v1`, chữ ký, iat/exp và liên kết request/call/context/fence.

Token sống tối đa 60 giây; token cấp phép không vượt thời hạn thực thi. Mọi request nội bộ gửi `X-AI-Contract-Version: 1.0.0`. Receipt muộn cần token RECEIPT mới từ danh tính dịch vụ tin cậy. Không có API công khai cấp token này; JWT người dùng không có quyền đó.

Bộ đọc JSON nội bộ giới hạn 64 KiB, trả lỗi contract khi JSON sai/quá lớn. Claim/receipt không nhận URL/provider/key từ browser. Mạng riêng/TLS và cấp mới khóa dịch vụ cho Python thuộc phần triển khai PY/OPS; local hiện chỉ có giao tiếp giả lập qua loopback.

### Nhận trùng, tính usage và giữ nội dung

Hash là dấu nhận diện nội dung biên nhận. Khi tính hash, sắp key theo thứ tự chung nhưng giữ null và nguyên văn text. Cùng call/hash thì trả bản đã nhận; nội dung khác thì ghi `AI_RECEIPT_CONFLICT`, trả 409 và không ghi đè.

Usage là số tài nguyên/token đã dùng. Trạng thái `FINAL` phải có đủ counts. Node tính tiền bằng BigInt từ bảng giá server theo priceVersion, làm tròn lên micro-USD. Chưa có usage thì để null/`UNRESOLVED`, không coi là 0.

Trước khi giữ đầu ra, kiểm quyền hiện tại và trạng thái câu hỏi. Sau khi hoàn tất, hủy, thu hồi quyền hoặc đánh dấu unknown, xóa input và biên nhận thô tạm của lần gọi; giữ hash, liên kết, usage, provider ID và metadata chi phí. Kết quả đã duyệt nằm trong tin nhắn assistant.

Receipt đến sau khi yêu cầu kết thúc/nội dung đã xóa chỉ cập nhật sổ chi phí, không giữ text hoặc thêm câu trả lời. Bảng giá theo provider/model/priceVersion vẫn cần giữ để đối soát sau khi xóa nội dung.

BE-04 đã gọi các hàm kiểm liên kết của contract và bộ kiểm do adapter server cung cấp. Hiện chỉ chạy fake với dữ liệu tổng hợp, không gửi trạng thái lab ra provider. BE-05 còn phải làm phần lọc context thực tế, che dữ liệu nhạy cảm, kiểm bằng chứng và lệnh. Bộ lọc/kiểm giả không đủ điều kiện để mở model thật.

## Quota và reconcile

Phần này giải quyết câu hỏi: **người dùng được hoàn lượt thì tiền gọi AI có được hoàn ngay không?** Hai việc phải tính riêng. Yêu cầu hỏng có thể hoàn lượt, nhưng provider vẫn có thể tính phí nếu đã nhận việc.

Migration `20261023000000_ai_worker` chỉ thêm trường: `AiProviderCall.analyzeInput` có thể null và `AiReservation.unitUsed` có thể null, kèm ràng buộc kiểm tra. `unitUsed` cho phép chốt lượt tách khỏi tiền:

- Fallback/thất bại/hủy/unknown: hoàn lượt ngay, tiền chưa rõ vẫn giữ reservation.
- Câu LLM dùng được: dùng một lượt, kể cả dựa trên bản lab cũ (`stale`).
- Fake: ghi `DETERMINISTIC`, không tiêu thụ lượt LLM.

Chốt hạn mức về đúng bucket ID đã giữ từ đầu, dù đã qua ngày UTC mới. Mỗi reservation có settlement key duy nhất; khóa request/environment ngăn gửi lại hoặc các chương trình chạy đồng thời chốt trùng.

`UNKNOWN` giữ tiền tối đa 24 giờ để kiểm tra tiếp (`reconcile`). Sau đó reaper ghi phần đã giữ thành `ESTIMATED`, tức chi phí ước tính. Hàm nội bộ `receipts.reconcile` nhận usage tin cậy và khóa chống trùng, ghi adjustment riêng khi tiền thực khác ước tính. Giữ nguyên settlement/receipt hash cũ và trạng thái cuối của câu hỏi. Chưa tự động nối hóa đơn provider hoặc công cụ vận hành OPS-06.

Nếu usage thực vượt trần, ghi số usage/tiền quan sát được, tắt nhận câu hỏi/cấp phép và giữ reservation chưa quyết toán. Không coi phí là 0 hoặc tự tăng bucket. Cần đối soát vận hành trước khi mở lại. Có số usage mới thì điều chỉnh sổ riêng, không thay nội dung/hash receipt đã ghi.

Đã sửa lỗi múi giờ phát hiện khi thử PostgreSQL ở Asia/Bangkok: adapter-pg hiện tại ghi DateTime như giờ UTC nhưng khi đọc lại bỏ offset timestamptz, có thể làm JavaScript và SQL hiểu khác thời điểm. Các kết nối ứng dụng được đặt session UTC; quota/lease lấy số mili giây tính từ mốc Unix (`epoch milliseconds`) bằng `clock_timestamp()`, không đổi timezone toàn database. Đã kiểm deadline 60 giây và điều kiện SQL claim chỉ cùng một thời điểm với cả Asia/Bangkok/America/Los_Angeles.

## Cấu hình local và rollback

- **Chế độ chạy:** mặc định `AI_WORKER_MODE=off`. Chỉ bật fake khi chọn `fake`, NODE_ENV không phải production và DATABASE_URL trỏ DB AI riêng ở loopback (`ai_lab_local` hoặc DB tạm do runner tạo). Worker này chưa có nhánh Gemini/provider thật.
- **Chính sách fake:** cần cấu hình nhận câu hỏi BE-03 và khóa dịch vụ riêng. Đặt `providerConfigId=local-fake-v1`, `dispatchEnabled=true`, `limits.globalConcurrency` là số nguyên 1–128; maxCostMicros=0 và giá fake bằng 0. Phiên bản diagnostic/prompt/model=`fake-be04`, price=`fake-zero-v1`; context schema 1.0.0, simulator/policy/appCommit vẫn phải hợp lệ. Đây chỉ là giá trị cho fake.
- **Hai chương trình dùng cùng cấu hình:** API và worker cùng DB/environment/epoch/secrets. `AI_INTERNAL_URL` do server đặt, mặc định `http://127.0.0.1:5500/internal/v1/ai`; giao tiếp fake chỉ chấp nhận loopback và path này.
- **Dừng rồi chạy lại:** đặt `dispatchEnabled=false` để ngừng cấp phép. Dừng worker có thể để yêu cầu ở `QUEUED`/`RUNNING`; chạy reaper trên DB đã migrate để hoàn tất receipt, đưa việc chưa cấp phép về hàng chờ hoặc đánh dấu unknown. Không đổi `DISPATCHED` về `PLANNED` hay xóa sổ chi phí để gọi lại.
- **Quay về code cũ:** có thể dừng worker và dùng API cũ, giữ schema đã thêm. Không drop cột/bảng để rollback. Chi phí chưa rõ vẫn phải giữ/đối soát trước khi xóa dữ liệu vận hành.

Trong lần triển khai BE-04 không sửa root `.env`, tạo policy hoặc migrate database ứng dụng/production. Không gọi Gemini/dịch vụ có phí. Nhánh thử Gemini local của ADR-009 có ngân sách và sổ riêng.

## Bằng chứng và giới hạn

Chạy lại: `pnpm.cmd ai:db:start`, `pnpm.cmd test:ai:storage`; runner tạo DB tạm đã migrate rồi xóa đúng DB do nó sở hữu. Unit/contracts: `node --test src/agent/node/access.test.js src/agent/node/snapshot.test.js src/agent/node/worker.test.js src/agent/node/contract.test.js`.

Test tích hợp dùng hai chương trình Node có PID khác nhau, nhóm kết nối riêng, HTTP claim/receipt thật và PostgreSQL local. Đã kiểm: giết worker trước/sau permit; worker mang fence cũ; 20 claim/receipt đồng thời; mất ACK; lỗi DB khi hoàn tất phải rollback; hủy/thu hồi quyền/xóa/loại nội dung; hạn mức qua ngày; hạ số chỗ chạy; usage chưa biết/ước tính/điều chỉnh.

Khi AI giả ngủ 6 giây, lệnh CLI thật vẫn hoàn thành trước khi AI xong và heartbeat tiếp tục cập nhật. Đây là bằng chứng backend không giữ khóa lab suốt thời gian chờ. Chưa phải kiểm toàn luồng trên trình duyệt hoặc chứng nhận model/provider thật.

**Kết quả nghiệm thu:** 34/34 storage trên DB mới/nâng cấp; 30/30 integration (BE-02: 7, BE-03: 8, BE-04: 15, gồm test cha); 108/108 unit/contract. Core regression 5 pass, 2 integration opt-in skip. Lint/Prettier, shared artifact drift, 89 link tài liệu và boundaries 1.283 imports/298 files đạt. Runner giữ evidence JSON trong `.tmp/ai-lab-be01/<run>/evidence.json`, đánh dấu cả hai migration và access/admission/worker đã đạt; database tạm được dọn. CI đã bổ sung, chưa chạy trên GitHub hoặc deploy. Warning pg về query concurrent hiện hữu vẫn còn, chưa nâng dependency trong task này.

Còn cần các task OPS/BE-08 để đo tốc độ và p95, quản lý chương trình chạy nền/triển khai, tự dọn dữ liệu theo thời hạn, đối chiếu hóa đơn provider và hỗ trợ thay khóa. Mỗi process worker hiện xử lý từng việc một; có thể chạy nhiều process. Khóa policy/environment ưu tiên tính đúng, chưa có số đo tải cả lớp học.

**Bước tiếp theo tại mốc BE-04:** BE-05 lọc dữ liệu đầu vào, che thông tin nhạy cảm và kiểm câu trả lời; sau đó SIM-01 và PY-01/PY-02 để ghép chẩn đoán/model thật vào luồng mới.

**Cập nhật 26/10/2026:** [BE-05 đã hoàn thành local/fake](BE-05-context-output.md), thay dữ liệu dựng sẵn bằng bộ lọc snapshot và lịch sử riêng; kiểm bằng chứng/lệnh và loại đầu ra sai trước giữ text. `fakePrepare` chỉ còn là helper kiểm hồi quy dùng chung bộ lọc mới. Transport và model vẫn là fake, chưa mở provider thật.
