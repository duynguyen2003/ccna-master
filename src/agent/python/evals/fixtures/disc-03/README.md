# DISC-03 - Public eval inputs

Ba dataset synthetic, mỗi dataset tám case: [AI-IPV4-01.json](./AI-IPV4-01.json), [AI-ROUTE-01.json](./AI-ROUTE-01.json), [AI-VLAN-01.json](./AI-VLAN-01.json). Phiên bản fixture: `disc03-v1`; simulator/profile: `2.1.0` / `ccna-network-v2`.

[Hồ sơ lab và nguồn](../../../../../../docs/ai-lab-assistant/labs/DISC-03-certified-labs.md) · [Oracle riêng ở backend](../../../../fixtures/labs/disc03.js)

Mỗi file gồm:

- `lab`: ID, tên, public objective, profile/version và giới hạn chuyển thể.
- `cases[].id`: ID ổn định, không ghi nguyên nhân lỗi vào ID.
- `cases[].request`: ý định DIAGNOSE, nguồn/đích và câu hỏi tiếng Việt trung tính.
- `cases[].context`: revision/tick, interface IPv4/admin/VLAN, VLAN names, static routes và links của snapshot synthetic.

JSON chỉ là **input có thể cấp cho provider khi xây eval sau này**. Không có label đúng/lỗi, expected answer, score, private rubric, lời giải hoặc thao tác sửa. Backend giữ oracle; runner sau này phải tách phần input và chấm kết quả, không nạp cả module private vào prompt. Ngữ cảnh này là subset cho fixtures, chưa phải contract Node/Python production hay state đầy đủ để tái tạo simulator.

```text
node src/agent/scripts/generate-ai-lab-fixtures.cjs
node src/agent/scripts/generate-ai-lab-fixtures.cjs --check
node --test src/agent/tests/aiLabCertification.test.js
```

Chạy lệnh từ repository root; generator cũng tự tìm đúng output khi gọi từ cwd khác. Không sửa tay snapshot JSON: sửa fixture source, chạy generator, rồi chạy test. CLI suite hiện có kiểm JSON khớp kết quả tái sinh, canary không lộ, golden/correct/fault/repair và snapshot không bị mutate.

Đây là bộ phát triển, chưa phải holdout, chưa có provider/model/prompt, kết quả AI hoặc chi phí. Không dùng dữ liệu production và không có lời gọi provider trong quá trình sinh/chứng nhận.
