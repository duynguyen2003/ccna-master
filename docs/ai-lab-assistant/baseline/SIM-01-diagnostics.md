# SIM-01 — Chẩn đoán kết nối cho ba lab IPv4, route và VLAN

**Ngày nghiệm thu:** 26/10/2026. **Trạng thái:** hoàn thành kiểm kỹ thuật SIM-01 local/fake. **Phạm vi:** chẩn đoán xác định phía Node, dùng simulator thật trên bản sao. Worker và API tiếp tục chạy local/fake; chưa gọi model thật.

BE-05 đã lọc dữ liệu trước khi gửi AI. **SIM-01 bổ sung phần tự kiểm tra kết nối bằng quy tắc**, để câu trả lời có căn cứ từ simulator.

Ví dụ, bạn hỏi từ PC1 đến PC2. Hệ thống xem đúng đường kết nối, tính route có dùng được không, rồi thử cả gói đi và gói trả lời trên bản sao. Nếu R2 thiếu route về thì ghi rõ chiều về bị chặn. Cổng R1 không cắm cáp đang shutdown không bị coi là nguyên nhân.

## 1. Những phần đã làm

| File                                                                               | Công việc                                                                                    |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [catalog.js](../../../src/agent/node/diagnostics/catalog.js)                   | Danh sách bảy quy tắc, ID/phiên bản, dữ liệu cần có, mức chắc chắn và giới hạn tính toán.    |
| [capabilities.js](../../../src/agent/node/diagnostics/capabilities.js)         | Nhận biết cấu hình ngoài phạm vi trước khi snapshot bỏ các trường nâng cao.                  |
| [probe.js](../../../src/agent/node/diagnostics/probe.js)                       | Xác định nguồn/đích và đường vật lý, dựng bản sao rồi gọi simulator.                         |
| [rules.js](../../../src/agent/node/diagnostics/rules.js)                       | Kiểm cổng/link, địa chỉ/subnet, route và VLAN trên đường đang xét.                           |
| [index.js](../../../src/agent/node/diagnostics/index.js)                       | Ghép kết quả thành bằng chứng và mẫu kết luận theo phạm vi kết nối.                          |
| [diagnostics.test.js](../../../src/agent/node/diagnostics/diagnostics.test.js) | Kiểm ba lab, các ca mơ hồ/ngoài phạm vi, không làm đổi trạng thái/điểm và kiểm kết luận giả. |

Phiên bản quy tắc là **`sim01-r1-v1`**. Không đổi engine, bộ chấm điểm, schema database hoặc contract v1.0.0 để làm test đạt.

## 2. Một lần chẩn đoán chạy thế nào?

1. **Chụp trạng thái lúc hỏi:** BE-02 giữ thêm dấu `diagnosticSupport`, chỉ gồm phiên bản và cờ được hỗ trợ. Dấu này được tính từ trạng thái đầy đủ trước khi lọc bỏ OSPF/ACL/NAT và các trường nâng cao.
2. **Lọc dữ liệu bằng BE-05:** bỏ trường ẩn, thông tin tài khoản và secret. PC có gateway thì route mặc định đã có trong snapshot biểu diễn đường ra đó. Không đưa nguyên engine state hoặc rubric sang bên xử lý AI.
3. **Chọn đúng nguồn và đích:** dùng `selectedDeviceId` và `target` theo contract. Không dò địa chỉ từ câu hỏi tự do hoặc đáp án bộ chấm. Đích không rõ, có nhiều IP hoặc IP trùng thì không tự đoán.
4. **Xác định đường vật lý:** xét cả link đang ngắt/cổng đang tắt để nhận ra điểm chặn. Không dùng mọi cổng trong lab làm danh sách nguyên nhân. Có nhiều đường khả dĩ thì báo chưa đủ căn cứ chọn một đường.
5. **Thử trên bản sao:** dựng state tách rời từ context, dùng lại `routeTable`, `layer2Path`, `converge` và `transmit` của simulator. `transmit` có ghi ARP/MAC cache nhưng chỉ ghi vào bản sao này.
6. **Tạo kết luận có nguồn:** thêm facts với `provenance.source=DIAGNOSTIC`, version, revision và phạm vi nguồn–đích. Fake worker có thể trả mẫu kết luận này; Node kiểm lại trước lưu text/tạo tin nhắn.

Mỗi lần phân tích dùng tối đa một probe hai chiều, topology tối đa sáu thiết bị/năm link, 24 interface và 32 static route mỗi thiết bị, tối đa tám điểm chặn. Đây là giới hạn cho nhóm lab R1 đã kiểm, chưa phải chẩn đoán tổng quát mọi topology Cisco.

## 3. Các quy tắc cụ thể

| Quy tắc                   | Kết luận được phép                                                   | Cách tránh kết luận nhầm                                                                                        |
| ------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `INTERFACE_ADMIN_DOWN`    | Cổng trên đường kết nối đang shutdown.                               | Không gán nguyên nhân cho cổng không dùng/nằm ngoài đường.                                                      |
| `LINK_DOWN`               | Link trên đường đang xét bị ngắt.                                    | Không quy lỗi từ một link ở VLAN hoặc nhánh không liên quan.                                                    |
| `IP_ADDRESS_MISSING`      | Cổng cần dùng trên đường chưa có IPv4/mask.                          | Chỉ xét đầu mút định tuyến trên đường nguồn–đích.                                                               |
| `IP_SUBNET_INCONSISTENCY` | Hai đầu của cùng đoạn kết nối trực tiếp không khớp subnet hai chiều. | Hai interface ở hai phía router thuộc subnet khác nhau vẫn hợp lệ.                                              |
| `NO_USABLE_ROUTE`         | Thiết bị không có route dùng được tới IP cụ thể, ở chiều đi hoặc về. | Dùng bảng route thật của simulator, gồm connected/static/default; không chỉ kiểm có chuỗi route trong cấu hình. |
| `NEXT_HOP_UNRESOLVED`     | Route đã được chọn nhưng next hop không phản hồi Layer 2.            | Xét route thực sự ưu tiên, kể cả route /32 chặn một route /24 đang đúng.                                        |
| `VLAN_PATH_MISMATCH`      | Membership hoặc mode/VLAN trên đường không tạo được kết nối L2.      | Xét hai đầu và đường được hỏi; không mặc định VLAN nào cần sửa nếu chưa có căn cứ.                              |

Khi cổng/link đã chặn đường, không ghi thêm “thiếu route” do connected route biến mất như thể đó là một nguyên nhân độc lập. Khi quan sát nhiều điểm chặn, kết quả ghi rõ cần kiểm từng điểm, không chọn tùy tiện một nguyên nhân duy nhất.

Ví dụ, hai PC ở hai VLAN khác nhau bị cách ly có thể đúng với đề bài. Kết luận chỉ nói hai đầu khác VLAN và không có kết nối L2; không tự bảo học viên đổi VLAN để làm chúng thông nhau.

## 4. Mức chắc chắn và phạm vi kết luận

- **OBSERVED:** quan sát như cổng tắt, link ngắt hoặc cổng thiếu IPv4 trên đường.
- **INFERRED:** kết luận từ dữ liệu và quy tắc, như subnet không khớp, thiếu route dùng được hoặc VLAN chặn đường.
- **SUPPORTED_FINDING:** có một điểm chặn được quy tắc xác nhận cho kết nối đang hỏi.
- **HYPOTHESIS:** nhiều điểm chặn, nhiều đường/IP khả dĩ hoặc probe thất bại mà quy tắc chưa giải thích được.
- **INSUFFICIENT_CONTEXT:** chưa xác định được nguồn/đích/đường từ dữ liệu hiện có.
- **UNSUPPORTED:** dữ liệu bị lược bớt hoặc tính năng/topology ngoài phạm vi đã hỗ trợ.
- **NO_ISSUE_OBSERVED:** probe cụ thể chuyển được cả gói đi và gói trả lời. Câu trả lời luôn nói rõ điều này **không kết luận toàn bài lab đúng**.

Ví dụ, VLAN 10 vẫn chạy nhưng VLAN 20 đang lỗi: hỏi PC1–PC2 ở VLAN 10 vẫn có thể nhận kết quả kết nối thành công, dù điểm bài lab chưa đạt.

## 5. Ghép với worker và bộ kiểm đầu ra

Facts từ snapshot của BE-05 vẫn giữ nguồn `SNAPSHOT`; facts chẩn đoán có nguồn `DIAGNOSTIC`. Tổng cộng không vượt 64 facts; giữ chỗ cho kết luận chẩn đoán thay vì cắt mất nó khi nhiều quan sát.

Verifier dựng lại kết quả từ context và mục tiêu đã lưu. Với `DIAGNOSE`, `SUPPORTED_FINDING` và `NO_ISSUE_OBSERVED` chỉ được giữ khi summary, loại kết luận và tập evidence IDs khớp mẫu Node tính được. Trích đúng một fact về cổng không liên quan vẫn không đủ để trở thành kết luận chẩn đoán. Các kiểm tra secret, lệnh, mức gợi ý, quyền, fence và accounting của BE-05/BE-04 tiếp tục áp dụng.

SIM-01 không cấp lệnh cấu hình, không tự sửa bài, không thay điểm và không thêm tool cho model. Câu hỏi/lịch sử chỉ là bối cảnh; thông tin cũ không được dùng thay cho state hiện tại. Mẫu fake chỉ trả kết luận và cách kiểm tra lại, chưa thay thế chính sách gợi ý AI-01 hoặc chất lượng diễn giải của model thật.

`diagnosticVersion` của cấu hình fake hiện là `sim01-r1-v1`; prompt/model vẫn mang nhãn fake, giá vẫn 0. Chính sách còn ghim phiên bản diagnostic cũ sẽ bị từ chối trước dispatch. Task không tự sửa policy hoặc bật worker trên DB ứng dụng.

## 6. Kiểm thử và chạy lại

```powershell
# Không gọi model hoặc database.
pnpm.cmd test:ai:diagnostics

# Kiểm cả luồng nền trên DB tạm do runner tạo và dọn.
pnpm.cmd ai:db:start
pnpm.cmd test:ai:storage
pnpm.cmd ai:db:stop
```

Bộ kiểm dùng các cấu hình đúng/sai và chuỗi sửa lỗi của DISC-03 làm dữ liệu kiểm thử. Runtime không import fixtures, không đọc `gradingSpec`, nhãn ca lỗi, `goldenActions` hoặc `repairActions` để suy ra đáp án.

Kết quả thực chạy ngày 26/10/2026:

| Nhóm kiểm                                                           | Kết quả                                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| SIM-01                                                              | **36/36 đạt**: 24 tình huống DISC-03 và 12 kiểm bổ sung. Các ca lỗi có kiểm sau sửa phục hồi. |
| Từng phần/contract access, snapshot, worker, context và diagnostics | **158/158 đạt**.                                                                              |
| Database mới/nâng cấp                                               | **34/34 đạt**, giữ dữ liệu 25 bảng cũ và tương thích client cũ.                               |
| HTTP/PostgreSQL BE-02…05 cùng SIM-01                                | **36/36 đạt**, gồm luồng worker trả finding rồi no-issue sau khi sửa.                         |
| CLI/simulator                                                       | **76 đạt, 1 DB opt-in bỏ qua**.                                                               |
| Account/exam/runtime                                                | **5 đạt, 2 integration opt-in bỏ qua**.                                                       |
| Provider/budget local offline                                       | **15/15 đạt**, không gọi model.                                                               |
| Contract và ranh giới source                                        | 17 schema/fixtures khớp; 1.367 imports/assets trong 312 file đạt.                             |

Đã kiểm cổng không dùng, default route hợp lệ, route /32 ưu tiên, thiếu chiều về sau khi gói đi đã tới đích, VLAN không liên quan vẫn chạy, nhiều điểm chặn/đường/IP, các tính năng nâng cao, snapshot cũ và JSON sau sắp key. Các kiểm trạng thái/hash/điểm/tick/cache không đổi đều đạt.

Luồng DB/HTTP kiểm thêm rằng lịch sử có kết luận lỗi cũ không làm thay kết quả của revision mới; phân tích không tạo lệnh CLI và không cập nhật điểm. Hồi quy crash/race/cancel/revoke/purge/rollback của BE-04 vẫn đạt. Kiểm đầu ra cũng chặn việc dùng một fact thật về cổng không liên quan làm kết luận chắc chắn cho `DIAGNOSE`.

Log và bản đối chiếu nằm trong `.tmp/ai-lab-sim01/`. Runner lưu bằng chứng DB ở `.tmp/ai-lab-be01/<run>/evidence.json` với `diagnosticsIntegrationPassed=true`. CI đã thêm kiểm nhưng chưa chạy GitHub/deploy. Warning pg truy vấn đồng thời có sẵn vẫn còn; không nâng dependency trong task này.

ESLint đạt với 0 lỗi/0 cảnh báo; Prettier, kiểm Unicode/whitespace và 122 liên kết local trong các tài liệu sửa đều đạt. DB tạm đã được runner dọn, cluster thử đã dừng và giữ data nền. Không sửa root `.env`, DB ứng dụng, ngân sách Gemini hoặc triển khai dịch vụ.

## 7. Phần chưa hỗ trợ

- OSPF/EIGRP, ACL, NAT, STP tùy chỉnh, native/allowed VLAN, route distance nâng cao, loopback, topology trộn router–switch hoặc vượt giới hạn trên. Các tính năng này bị phát hiện trước khi projection bỏ trường, nên không bị hiểu thành cấu hình cơ bản không có lỗi.
- Snapshot cũ thiếu dấu capability hoặc context đã đánh dấu bị lược bớt chỉ cho kết luận chưa hỗ trợ. Khi bỏ lịch sử để vừa trần, context/facts được tính lại nhất quán; không giữ kết luận mạnh từ bản trước đó.
- Không tự đoán mục tiêu cho NEXT_STEP, EXPLAIN_CONCEPT hoặc feedback lịch sử thiếu topology. Các việc đó tiếp tục theo chính sách intent/hint và BE-09.
- Chưa có đánh giá CCNA độc lập, model thật, browser E2E hoặc đo tải cả lớp học. Kiểm kỹ thuật local không thay cho nghiệm thu nội dung/pilot.

**Tiếp theo:** PY-01/PY-02 dựng dịch vụ Python và ghép provider theo contract, sau đó giao diện và các bước đánh giá/triển khai trong [backlog](../03-delivery-backlog.md).
