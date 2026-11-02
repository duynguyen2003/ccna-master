# EIGRP01 — lab 3, grading policy 3

EIGRP01 là lab thí điểm cho `schemaVersion: 2`, `labVersion: 3`, `simulatorVersion: 3.0.0` và `policyVersion: 3`. Code đã bao gồm cả năm bước: grader, nguồn dữ liệu, classic metric, chấm quá trình và chính sách thành thạo. Sửa repo **không tự cập nhật lab trong DB**.

## Nguồn dữ liệu và tương thích

- `src/shared/labs/eigrp01.js` giữ topology; `eigrp01Definition.js` sinh bảng địa chỉ, network statements, unicast neighbors, rubric và giai đoạn lời giải.
- `stages[].actions` là lời giải có thứ tự toàn mạng. `solutionActions` và `steps[].commands: { deviceId, command }[]` sinh từ đó. Không chạy bằng cách nhóm hết lệnh theo router: quan sát cần các router khác đã cấu hình.
- `labDefinition.js` đọc cả object mới và chuỗi cũ, kể cả `R1/R2: ...`. UI hiển thị thiết bị riêng và chỉ chép phần lệnh; admin giữ được dữ liệu cũ.
- `durationMinutes` là số, `topics` là mảng, `tools` chỉ chứa công cụ. Guide dùng Markdown qua `MarkdownRenderer` có sanitize; HTML cũ vẫn được hỗ trợ.
- Lab `contentSource: REPOSITORY` lấy repo làm nguồn sự thật. Import theo `(labKey, labVersion)` và SHA-256 nội dung: cùng revision/hash là no-op, khác hash bị từ chối. Không tìm theo tiêu đề để ghi đè. Admin tạo bản nháp ADMIN thay vì sửa bản repo đã phát hành.

## Grader

`route_exists.protocol` lọc C/S/D/O. `source: learned` đọc route học từ EIGRP/OSPF; `source: selected` đọc route được chọn theo prefix/AD/metric. Mặc định `available` giữ hành vi cũ. Static AD 1 đè EIGRP AD 90 không làm mất điểm học route, nhưng không được điểm chọn EIGRP để chuyển tiếp.

`reachable.protocol: D` kiểm sự kiện chuyển tiếp cả request và reply. Hop connected được phép; hop static không được tính, kể cả ở router trung gian. Ping phụ thuộc check chọn route R1/R4; chọn route phụ thuộc học route. Check bị chặn có `status: blocked`, `blockedBy`, nhận 0 điểm và không chạy; UI nêu nhiệm vụ cần sửa trước. Schema từ chối tham chiếu thiếu, ID trùng và chu trình.

`startup_config_saved.matchesRunning` so mô hình cấu hình chuẩn hóa, không so văn bản. Loại context CLI, route học và cache; chuẩn hóa thứ tự network/neighbor. Thứ tự ACL và static route vẫn có ý nghĩa. Startup-config và snapshot EIGRP01 ban đầu đều `null`; lưu rồi sửa phải lưu lại. Check cũ không có `matchesRunning` giữ nghĩa “đã có bản lưu”.

Grader kiểm trạng thái interface tham gia EIGRP, không so chuỗi `network`. Classful, wildcard subnet và wildcard host `0.0.0.0` đều có test đạt.

## Classic metric và phiên bản engine

Engine 3 dùng K1=K3=1:

```text
metric = 256 × (floor(10^7 / minBandwidthKbps) + floor(sumDelayMicroseconds / 10))
```

| Interface | Bandwidth kbps | Delay µs |
| --- | ---: | ---: |
| GigabitEthernet | 1000000 | 10 |
| FastEthernet | 100000 | 100 |
| Serial T1 | 1544 | 20000 |
| Loopback | 8000000 | 5000 |

Mặc định khóa trong `eigrpClassic.js`. Engine kết hợp bandwidth nhỏ nhất và tổng delay, gồm interface đích; không cộng scalar metric từng cạnh. `bandwidth` nhận kbps, `delay` nhận đơn vị 10 µs; `no` khôi phục mặc định. Admin hỗ trợ các trường này qua form và JSON. `show ip eigrp topology` hiện FD/RD tại trạng thái hội tụ.

| Ca trước khi chỉnh delay | FD hoặc RD |
| --- | ---: |
| R3 → 4.0.0.0/8 | 130816 |
| R2 → 4.0.0.0/8 | 131072 |
| R1 → 4.0.0.0/8 | 131328 |
| R1 → 192.1.23.0/24 | 3072 |
| R1 → 192.1.34.0/24 | 3328 |
| R4 quảng bá loopback, RD tại R3 | 128256 |
| Một chặng Serial T1 tới loopback | 2297856 |
| T1 thuần không loopback | 2169856 |

Có test tính tay và cắt phần thập phân. Replay version cũ vẫn dùng metric cũ; lệnh mới không thay tập lệnh cũ. **Chưa đối chiếu trực tiếp trên router/CML.** Engine tính trạng thái hội tụ, không mô phỏng đầy đủ lịch sử feasible distance/state machine DUAL, wide metrics, K tùy chỉnh hoặc khác biệt mặc định giữa các dòng IOS.

## Chấm hành động và quá trình

- `eigrp_passive_observed`: thực sự mất neighbor do passive → show neighbors khi down → khôi phục do no passive → show neighbors khi up. Event neighbor_down/up có router, interface và handler gây ra. Shutdown, mất dây hoặc nhập passive khi chưa có adjacency không thay được bước này.
- `eigrp_metric_exercise`: phải chỉnh metric trên cổng R1, đặt delay 110 µs (`delay 11`) và đạt FD 133888 tới loopback R4. Chỉ đọc metric engine tính sẵn không đạt.
- Backend lưu action/event trong `lab_commands`. Nộp attempt schema 2 sẽ replay nhật ký theo snapshot và simulatorVersion của attempt, không tin state/evidence/điểm client gửi. Giới hạn 500 thao tác, sequence phải liên tục, version không hỗ trợ bị từ chối. Hint cũng được ghi vào nhật ký.

## Điểm, mục tiêu bắt buộc và gợi ý

Khi bật cả hai cờ tính năng:

| Nhóm | Điểm | Bắt buộc |
| --- | ---: | --- |
| EIGRP AS trên 4 router | 11.2 | Có |
| 3 adjacency | 16.8 | Có |
| Unicast neighbor hai đầu R1–R2 | 11.2 | Có |
| Học và chọn route hai đầu | 11.2 | Có |
| Ping hai chiều qua EIGRP | 11.2 | Có |
| Lưu cấu hình hiện tại trên 4 router | 8.4 | Có |
| Quan sát passive R1 và R2 | 10 | Có |
| Bài metric | 20 | Không; cần để thành thạo |

Đạt khi điểm ≥80 **và mọi check required đạt**. Bỏ metric: 80 và đạt; bỏ unicast neighbor: 89 nhưng không đạt. Mỗi check có objective/skill; feedback gom theo cấu hình, kiểm chứng, quan sát và tính toán.

Hints mở ba mức: khái niệm → hướng kiểm tra → lệnh. Server chỉ mở mức kế tiếp, không trừ điểm; kết quả có `withoutHints`. Progressive hints yêu cầu engine 3.

Attempt chuyển IN_PROGRESS → PASSED → MASTERED. Sau khi đạt vẫn thực hành/chấm tiếp; lỗi mới hiện trong feedback nhưng không hạ mốc. `score/bestScore` giữ điểm tốt nhất, `firstPassedAt/masteredAt` giữ mốc đầu tiên. Hoàn thành khóa/hoạt động chỉ ghi lần đạt đầu. Attempt legacy giữ cơ chế cũ. Giới hạn 500 vẫn áp dụng sau khi đạt; không tự xóa journal để tiếp tục.

## Triển khai và rollback

1. Backup/kiểm trên bản sao theo `operations.md`. Áp dụng migration `20261101000000_versioned_learning_labs`, regenerate Prisma rồi triển khai backend/frontend. Migration chỉ thêm cột/index/enum, không sửa feedback/điểm/snapshot/trạng thái cũ.
2. Kiểm không ghi DB: `pnpm import:lab:eigrp01 --verify-only`.
3. Bật trên backend staging trước khi mở attempt mới:

   ```dotenv
   LAB_LEARNING_OBSERVATIONS_ENABLED=1
   LAB_MASTERY_ENABLED=1
   ```

   Mặc định cả hai là 0. Tắt observations bỏ hai loại check quá trình/metric. Tắt mastery dùng ngưỡng 100 và không luyện tiếp sau khi đạt. Điểm chuẩn hóa trên các check còn lại. Cờ không đổi lab thông thường không khai báo chính sách này. Cờ được **chụp lúc bắt đầu attempt**.
4. Import `pnpm import:lab:eigrp01` khi khóa SRW tồn tại. Lệnh kiểm scenarios rồi tạo revision mới, giữ bản cũ. Thay đổi này không tự import production.
5. Đổi nội dung/rubric/trọng số thì tăng labVersion; đổi chính sách thì tăng policyVersion; đổi engine cần version mới và giữ replay cũ. Attempt đang làm giữ đề, guide, steps, rubric, flags và engine đã chụp.

Rollback: tắt cờ cho attempt **mới** hoặc ngừng phát hành revision có vấn đề. Không xóa enum/cột, không SQL sửa điểm hàng loạt, không thay version attempt đang làm. Phải giữ backend đọc MASTERED và engine 3 cho phiên đã tạo; tắt cờ không chấm lại phiên đang chạy.

## Kiểm thử

`pnpm test:cli` chạy mọi scenarios của module lab, từng action theo thứ tự và đòi lệnh thành công. Kỳ vọng gồm pass/score, check tự fail, check bị chặn và ping thô để chứng minh static route vẫn kết nối. Runner tuần tự để các test HTTP không ảnh hưởng điều kiện mở khóa học của nhau trong cùng DB thử nghiệm.

EIGRP01 có lời giải 100, bỏ metric 80, thiếu static neighbor, static-only, passive chưa gỡ, lưu trước khi sửa, không lưu, shutdown thay passive và host wildcard. Test grader bổ sung subnet/classful wildcard, static đè đầu/giữa đường, chuẩn hóa snapshot, ACL ordering, dependency DAG, replay cũ và đổi IP topology không lệch nội dung.

PostgreSQL/HTTP (`LAB_INTEGRATION=1`, chỉ dùng DB thử nghiệm) kiểm import idempotent, revision bất biến, hint tuần tự, snapshot flags/rubric, event có nguyên nhân, 80 → 100 → làm sai vẫn giữ MASTERED, chống state giả, replay và hoàn thành đúng một lần. Test UI kiểm editor, checklist blocked và adapter; browser kiểm Markdown/hint/copy. Không chạy integration trên DB học viên thật.

Kết quả kiểm tra local 01/11/2026: 122/122 test CLI/API có PostgreSQL; 43 suites và 316/316 test frontend; build production với CI=true, lint, kiểm ranh giới module và import --verify-only đạt. Migration chỉ chạy trên DB thử nghiệm, không chấm lại lịch sử hay import vào DB đang sử dụng.
