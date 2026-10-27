# ADR-01 - Rà tình huống xấu và invariant

[Contract](./README.md) · [Test matrix vận hành](../../../../../docs/ai-lab-assistant/04-quality-and-operations.md)

Ngày: 19/10/2026. “Đã kiểm” dưới đây chỉ nói phần contract/policy thuần; migration, transaction, HTTP authorization và fault injection **chưa được triển khai/kiểm bởi task ADR-01**.

| Tình huống | Quyết định và kết quả phải có | Bằng chứng hiện có / gate runtime |
|---|---|---|
| 20 retry cùng ID qua hai replica | Lookup cũ trước stale; một request/reservation/message, không dispatch trùng | Fingerprint/shape tests; unique/20-way race ở BE-03, T-IDEM-01 |
| Cùng ID, đổi payload hoặc attempt | 409 AI_IDEMPOTENCY_CONFLICT, không ghi đè | Fingerprint phân biệt body/attempt; DB conflict ở BE-03 |
| Lab đổi revision sau request | Source bất biến, stale từ current; không tự gọi model lại | Resource binding test; T-STATE-02 ở FE-02/QA-01 |
| Hai request tranh unit/budget cuối | Bucket locks/check constraints và user partial unique; chỉ admission hợp lệ thắng | Schema chặn quota âm; T-COST-01/02/06 cần DB thật, chưa coi đã đạt |
| Worker hết lease trước dispatch | Fence mới, chỉ requeue khi chưa claim và deadline còn | Guard/state tests; lease/CAS integration ở BE-04 |
| Claim ACK mất hoặc timeout sau dispatch | OUTCOME_UNKNOWN, giữ budget unresolved, không retry model | State/usage tests; T-OPS-01/T-COST-04 ở BE-04/QA-04 |
| Receipt retry giống/khác body | Cùng hash idempotent, khác hash 409 AI_RECEIPT_CONFLICT + audit | Wire/binding tests; settlement/hash race ở BE-04 |
| Receipt sau cancel/revoke/delete | Không hồi sinh output; accounting tiếp tục độc lập | Schema terminal/no-answer + graph tests; T-PRIV-03/T-AUTH-04/05 ở BE-04/08 |
| Owner attempt đoán conversation của thành viên | 404 đồng nhất, không đọc chat | Input không nhận userId; authorization T-AUTH-02/03 ở BE-02/QA-01 |
| Account switch/response muộn | Hủy poll và cache theo auth/conversation epoch | Envelope/epoch có contract; browser T-AUTH-06/T-UX-02 ở FE-02/QA-02 |
| Đổi recovery epoch sau mất ledger | 409 AI_RECOVERY_RECONFIRM; người học chủ động tạo yêu cầu mới | Request có epoch và ADR-002 chốt policy; restore drill T-OPS-03 ở OPS-06 |
| Model bịa evidence/command/level | Reject trước render, fallback; không chạy lệnh | Shared binding reject fake IDs/revision/fence/hint; parser/domain policy BE-05/SIM-01 còn phải làm |
| Rubric/actor/secret được nhét vào context | Strict fields + projection/redaction trước Python | Shared invalid field cases + DISC-03 canaries; secret trong text và injection T-PRIV-01/02 ở BE-05 |
| Model output chứa HTML/URL xấu | Plain text/Markdown allowlist; không raw HTML/ảnh từ xa | ADR-006; renderer/XSS/browser tests FE-01/QA-02 chưa thay bằng string schema |
| Feedback legacy không có revision | Deterministic với provenance/null, không chẩn đoán state live cho kết quả cũ | Schema và resource binding tests; provenance persistence ở BE-01/09 |
| Provider/Python lỗi | AI degraded/fallback; lab core và terminal còn dùng | One-call/no-stream policy; integration/readiness ở PY-01/02/OPS-01 |

Không có thay đổi DB, khóa thật hoặc lời gọi provider trong các kiểm tra contract này. Các issue nền tảng DISC-01 vẫn giữ gate riêng; chốt ADR không đóng issue auth/migration/backup/proxy hoặc nghiệm thu G0/G1/G2.
