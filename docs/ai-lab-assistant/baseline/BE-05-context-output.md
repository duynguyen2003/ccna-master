# BE-05 — Lọc dữ liệu lab và kiểm câu trả lời trước khi lưu

**Ngày nghiệm thu:** 26/10/2026. **Trạng thái:** hoàn thành BE-05 local/fake. **Phạm vi:** Node worker và API biên nhận trên môi trường thử riêng, tiếp tục dùng AI giả. Chưa bật provider thật hoặc dịch vụ Python.

BE-04 đã có đường xử lý câu hỏi. **BE-05 quyết định dữ liệu nào được đi qua đường đó và câu trả lời nào được giữ lại.**

Ví dụ, bạn hỏi “Vì sao PC1 không ping được PC2?”. Worker lấy trạng thái lab đã lưu lúc hỏi, bỏ đáp án chấm điểm và thông tin tài khoản, tạo danh sách quan sát/lệnh được phép rồi mới gửi cho bên xử lý. Nếu câu trả lời dùng ID bằng chứng không tồn tại hoặc tự viết lệnh ngoài danh sách, Node loại câu trả lời trước khi lưu text.

## 1. Phần đã triển khai

| File                                                                                                           | Làm gì?                                                                                              |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [context.js](../../../src/agent/node/context.js)                                                           | Dựng dữ liệu công khai từ bản chụp, đọc lịch sử đúng chủ/phiên và kiểm kích thước/ngân sách đầu vào. |
| [redaction.js](../../../src/agent/node/redaction.js)                                                       | Che các mẫu thông tin nhạy cảm và giá trị bí mật đã biết trước khi cắt độ dài.                       |
| [evidence.js](../../../src/agent/node/evidence.js)                                                         | Tạo bằng chứng quan sát có nguồn/revision và danh sách lệnh đọc qua parser thật.                     |
| [outputVerifier.js](../../../src/agent/node/outputVerifier.js)                                             | Kiểm liên kết, bằng chứng, lệnh, mức gợi ý và nội dung câu trả lời.                                  |
| [aiWorker.js](../../../src/agent/workers/aiWorker.js)                                                    | Mặc định dùng bộ dựng context BE-05; phần giao tiếp thực thi vẫn là fake.                            |
| [dispatch.js](../../../src/agent/node/dispatch.js), [receipts.js](../../../src/agent/node/receipts.js) | Chặn đầu vào trước lưu kế hoạch gọi; kiểm đầu ra trước giữ text và kiểm lại trước tạo tin nhắn.      |

Không đổi schema/migration, contract v1.0.0, cấu hình DB ứng dụng hoặc ngân sách của nhánh Gemini local.

## 2. Dữ liệu nào được gửi?

Chỉ dựng từng trường được phép, không chuyển nguyên snapshot hay object database sang JSON:

- Thông tin công khai: tên/mục tiêu lab, profile, phiên bản simulator và nguồn ghi nhận.
- Trạng thái đã chụp: thiết bị, interface, IPv4/mask, shutdown, access/trunk, VLAN, static route và link.
- Tiến độ công khai theo task. Hint từ bộ chấm để null, chờ chính sách gợi ý AI-01.
- Câu hỏi và mục tiêu đã qua contract, không lấy các trường tự khai như tools, quyền hoặc model.
- Tối đa sáu tin nhắn lịch sử đã lọc; mỗi phần text lịch sử tối đa 1.000 ký tự. Tin nhắn assistant chỉ lấy phần summary.

Không gửi gradingSpec, expected/actual của bộ chấm, lời giải/sửa mẫu, tài khoản, ownerKey, attemptId hoặc conversationId. Trường `lab.id` dùng mã profile công khai, không dùng ID bản ghi nội bộ. requestId/callId/contextHash/fence vẫn có trong contract nội bộ để ràng buộc lần gọi; chúng không cấp quyền đọc dữ liệu người dùng.

Nguồn trong DB `CAPTURED_AT_ATTEMPT_START` được đổi sang tên tương ứng của contract là `ATTEMPT_SNAPSHOT`. Mục tiêu lab để trống có lời mô tả chung, tránh tạo context sai khuôn.

### Vì sao chưa gửi lịch sử lệnh CLI?

LabCommand hiện có `action.actorId` trong JSON nhưng chưa có cặp thông tin actor/revision đầy đủ để ràng buộc mỗi đoạn command/output với đúng người và trạng thái lúc hỏi. Đây còn là nhật ký dùng chung của bài nhóm. BE-05 để `recentCommands=[]`, không đọc toàn transcript rồi đưa sang AI. Nội dung CLI nếu được dán vào câu hỏi vẫn chỉ là text không đáng tin cậy.

### Lịch sử hội thoại được lấy thế nào?

Query database đồng thời giới hạn user, ownerKey, attempt, conversation, epoch và hội thoại chưa xóa. Chỉ lấy yêu cầu trước đó đã `COMPLETED`, không lấy chính câu hỏi đang xử lý. Sắp xếp có thứ tự ổn định rồi lấy tối đa sáu tin nhắn.

Ví dụ, hai người làm chung một lab vẫn có hội thoại riêng. Tăng epoch thì tin nhắn epoch cũ không được đưa vào context mới. Revision trong tin nhắn cũ được giữ nguyên; lịch sử không trở thành bằng chứng cho trạng thái mạng hiện tại.

## 3. Che thông tin nhạy cảm và giới hạn đầu vào

Text được chuẩn hóa Unicode, bỏ ký tự điều khiển/escape terminal, che giá trị server đã biết như secret và các mã định danh nội bộ. Bộ lọc cũng nhận các mẫu key, JWT/Bearer/Basic, email, URL có mật khẩu, khai báo password/secret/token, một số lệnh cấu hình mật khẩu và nhãn userId/actorId/rubric/expected/actual.

Che trước rồi mới cắt độ dài để không giữ lại đầu của một secret bị cắt ngang. ID thiết bị/task/link chứa giá trị nhạy cảm thì bị từ chối thay vì sửa thành một ID khác có thể trỏ nhầm.

Đây là lớp bảo vệ cho các mẫu và giá trị đã biết. Nó không thể hiểu mọi bí mật hoặc đáp án được viết tùy ý trong văn xuôi. Vì vậy vẫn cần chọn trường từ nguồn đáng tin cậy; bộ lọc regex không thay cho chính sách dữ liệu hoặc đánh giá nội dung.

Các giới hạn của contract vẫn được kiểm: tối đa 24 thiết bị, 24 interface mỗi thiết bị, 64 VLAN/128 route mỗi thiết bị, 96 link, 64 task, 64 bằng chứng và 32 lệnh được cấp. Toàn bộ request nội bộ không vượt **64 KiB theo UTF-8**.

Ngân sách input được kiểm bằng hàm đếm do adapter server cung cấp; thiếu hàm hoặc số đếm sai thì không cho đi tiếp. Khi vượt trần, có thể bỏ lịch sử tùy chọn từ cũ nhất. Không âm thầm bỏ topology hoặc câu hỏi để làm vừa trần; không vừa thì thất bại trước permit và hoàn phần giữ chỗ.

**Bộ đếm fake chỉ là quy ước thử nội bộ:** một nhóm chữ/số ASCII liên tiếp hoặc một ký tự không trắng khác được tính một đơn vị, tối đa 6.000 đơn vị. Đây không phải tokenizer/ước lượng usage của Gemini hay hãng nào. PY-02 phải đếm toàn bộ prompt/schema của provider thực; BE-05 không mở model thật nhờ bộ đếm fake.

Khi cắt text, bỏ lịch sử hoặc contract không biểu diễn đủ gateway/native VLAN/allowed VLAN/route distance, đặt `contextTruncated=true` để không coi dữ liệu là đầy đủ.

## 4. Bằng chứng và lệnh được cấp từ đâu?

Bằng chứng chỉ được Node tạo từ quan sát snapshot: interface, route, VLAN và link. Mỗi mục có ID, revision, vị trí nguồn, nội dung quan sát, `OBSERVED` và phiên bản `be05-observations-v1`. ID được tính ổn định từ giá trị dữ liệu, không phụ thuộc thứ tự key JSON sau khi PostgreSQL lưu lại.

Ví dụ, “R1 GigabitEthernet0/0: shutdown” là điều quan sát được. Nó chưa đủ chứng minh cổng đó là nguyên nhân mất kết nối; SIM-01 còn phải kiểm đường đi và các quy tắc chẩn đoán.

Danh sách lệnh chỉ có các lệnh đọc đã chọn: `show ip interface brief`, `show ip route` cho router và `show vlan brief` cho switch. Mỗi lệnh đi kèm thiết bị/mode/ID, được kiểm bằng parser profile `ccna-network-v2`. Không cấp lệnh cấu hình hoặc công cụ thực thi; PC không được gán lệnh switch/router.

Câu hỏi hoặc text CLI không được dùng để tạo evidence, thay provenance, thêm command hay mở quyền tool. Khi kiểm đầu vào/đầu ra, Node dựng lại danh sách từ context để phát hiện ID có vẻ hợp lệ nhưng nội dung/nguồn/lệnh đã bị thay.

## 5. Câu trả lời bị chặn khi nào?

- Sai schema, request/call/context/fence/version, revision hoặc ID tham chiếu.
- Evidence trùng/không có thật, nguồn quan sát bị thay hoặc command khác catalog/thiết bị/mode.
- Mức gợi ý vượt `effectiveHintLevel`.
- Text có secret/mã nội bộ đã biết, HTML/link/code hoặc lệnh viết trực tiếp để bỏ qua commandId. Parser cũng kiểm các dòng CLI và lệnh viết tắt.
- Kết luận chắc chắn chưa có quy tắc chẩn đoán hỗ trợ.

Trước SIM-01, `SUPPORTED_FINDING` chỉ nhận một quan sát được trích chính xác và tham chiếu đúng bằng chứng. Kết luận `NO_ISSUE_OBSERVED` bị từ chối, vì chưa có bộ quy tắc đủ để chứng minh không thấy lỗi. Các kiểu thiếu dữ liệu/chưa hỗ trợ/giả thuyết vẫn là nhãn theo contract, không bảo đảm mọi câu văn do model sinh đều đúng về ngữ nghĩa.

Đầu ra không đạt bị bỏ **trước khi ghi receipt text**. Hệ thống vẫn giữ hash của receipt gốc, usage, giá và thông tin tối thiểu để đối soát; ghi sự kiện `AI_OUTPUT_REJECTED` không chứa text. Finalizer không tạo câu trả lời, yêu cầu kết thúc `FAILED`/`NONE` và hoàn lượt. Nếu provider đã phát sinh phí thì vẫn chốt phí hoặc giữ khoản chưa rõ, không tự coi là 0.

## 6. Kiểm thử và cách chạy lại

```powershell
# Không gọi model hoặc database.
pnpm.cmd test:ai:context

# Kiểm cả BE-01…05 trên DB tạm do runner tạo rồi dọn.
pnpm.cmd ai:db:start
pnpm.cmd test:ai:storage
pnpm.cmd ai:db:stop
```

[Test từng phần](../../../src/agent/node/context.test.js) kiểm ba lab, canary dữ liệu ẩn/secret/actor, prompt injection, lệnh/bằng chứng giả, cap, revision, output và JSON sau lưu DB. [Test tích hợp](../../../src/agent/node/context.integration.test.js) dùng worker thật, HTTP claim/receipt thật và PostgreSQL riêng; không gọi mạng AI.

Kết quả thực chạy ngày 26/10/2026:

| Nhóm kiểm                                                  | Kết quả                                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| Từng phần/contract của access, snapshot, worker và context | **121/121 đạt**, gồm 13 kiểm BE-05.                                    |
| DB mới và DB nâng cấp                                      | **34/34 đạt**, 25 bảng cũ giữ nguyên dữ liệu, client cũ vẫn dùng được. |
| HTTP/PostgreSQL BE-02…05                                   | **35/35 đạt**, gồm BE-05 5 test tính cả test cha.                      |
| CLI/simulator                                              | **76 đạt, 1 DB opt-in bỏ qua**.                                        |
| Account/exam/runtime                                       | **5 đạt, 2 integration opt-in bỏ qua**.                                |
| Provider/budget local offline                              | **15/15 đạt**, không gọi model.                                        |
| Artifact contract                                          | 17 JSON Schema và fixtures khớp nguồn, không đổi contract.             |
| Ranh giới source                                           | 1.337 imports/assets trong 306 file đạt.                               |

Các ca tích hợp xác nhận: dữ liệu gài thử không qua adapter thực thi; lịch sử khác người/attempt/epoch bị loại; vượt trần input không tạo lần gọi/cấp phép; câu trả lời xấu không được lưu text nhưng phí synthetic vẫn ghi đúng và nhận lại receipt không ghi trùng. Hồi quy BE-04 tiếp tục kiểm crash/race/cancel/revoke/purge/rollback và CLI chạy trong lúc AI giả chờ.

ESLint đạt với 0 lỗi/0 cảnh báo; Prettier các file mới/sửa và 103 liên kết local trong tài liệu đã kiểm đều đạt. Đã bổ sung kiểm vào CI nhưng chưa chạy trên GitHub/deploy. Log và bản đối chiếu nằm trong `.tmp/ai-lab-be05/`; runner lưu bằng chứng DB trong `.tmp/ai-lab-be01/<run>/evidence.json` với `contextOutputPassed=true`. DB tạm đã được dọn, cluster thử đã dừng và giữ data nền. Warning pg có sẵn về truy vấn đồng thời vẫn còn; không nâng dependency trong task này.

## 7. Giới hạn và bước tiếp theo

- Chỉ xử lý snapshot `LIVE_SNAPSHOT` có topology và revision phù hợp. Feedback lịch sử/legacy thiếu topology bị từ chối trước gọi; không ghép state live vào kết quả chấm cũ. Phần giải thích bản nộp tiếp tục theo BE-09.
- Chưa có quy tắc xác định nguyên nhân của SIM-01, hint policy AI-01, dịch vụ Python/tokenizer/provider thật ở PY-01/PY-02 hoặc giao diện hội thoại hoàn chỉnh.
- Chưa kiểm toàn luồng trên browser, chất lượng model tiếng Việt hoặc tải cả lớp học.

**Bước tiếp theo tại mốc BE-05:** SIM-01 tạo bộ chẩn đoán cho ba lab; PY-01/PY-02 ghép dịch vụ và model thật theo contract khi đủ điều kiện dữ liệu/ngân sách. [Backlog](../03-delivery-backlog.md).

**Cập nhật sau SIM-01, 26/10/2026:** [bộ chẩn đoán đã hoàn thành kỹ thuật local/fake](SIM-01-diagnostics.md). Snapshot giữ dấu capability trước khi lược trường; gateway PC đã có default route tương ứng không còn tự làm context thiếu dữ liệu. Facts chẩn đoán được ghép với quan sát BE-05. Với `DIAGNOSE`, kết luận mạnh phải khớp mẫu và đầy đủ bằng chứng Node tính cho nguồn–đích; không nhận fact về cổng không liên quan làm nguyên nhân. `diagnosticVersion` fake đổi thành `sim01-r1-v1`. Các số liệu và giới hạn ở phần trên là tại mốc BE-05 trước cập nhật này.
