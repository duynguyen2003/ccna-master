# ADR-009 — Gemini thật cho giải thích kết quả local

**Ngày:** 22/10/2026. **Trạng thái:** chấp nhận cho local theo yêu cầu mới của người dùng; chưa phê duyệt pilot/production. Thay phần fake-only của [ADR-008](ADR-008-local-fake-deployment.md) đối với nút giải thích kết quả local.

[Chính sách đang dùng](../ops/OPS-00-live.json) · [Backlog](../03-delivery-backlog.md) · [Thiết kế R1](ADR-003-provider-policy.md)

## Quyết định và phạm vi

Task này cho phép thử **model thật trên nút “Giải thích kết quả” đang có ở local**. Ví dụ, sau khi chấm lab, Node gửi phần feedback công khai đã lọc sang Gemini để viết lời giải thích tiếng Việt.

Người dùng đã cấp key và yêu cầu thử thật. Key ở `.env` server, bị Git ignore; không chép vào tài liệu, mẫu thử hoặc biến `REACT_APP_*`. Model local là **`gemini-3.5-flash-lite`**, endpoint cố định `generativelanguage.googleapis.com`. Browser không chọn URL/model.

Nút gọi `/api/lab-attempts/:attemptId/explain`, vẫn kiểm quyền và giữ nguyên điểm do bộ chấm tính. Node gọi Gemini, kiểm JSON rồi trả kết quả kèm `provider=gemini`/`model`; giao diện ghi nhãn Gemini. Khi provider lỗi hoặc chạm hạn mức, trả lời bằng logic dự phòng và ghi nhãn tương ứng.

Luồng hội thoại R1 theo ADR-001…007 vẫn là nhận câu hỏi trước, xử lý sau bằng Node worker + Python + PostgreSQL. Ở mốc thử ngày 22/10, các task đó chưa triển khai; BE-01…04 được làm sau theo hồ sơ riêng. Lần thử này không dùng để đánh dấu BE-01/BE-03/BE-04/BE-06/PY-01/AI-02/OPS-02 hoặc G0/G1/G2 hoàn thành. Nhánh Node gọi trực tiếp này chỉ dành cho local, chưa được dùng cho pilot/production.

## Kích hoạt và kiểm tra

Các biến server đã cấu hình ở mốc thử: `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-3.5-flash-lite`, `LAB_AI_MODE=local-live`. `.env.example` vẫn mặc định `LAB_AI_MODE=deterministic`. Backend đọc biến khi khởi động, nên đổi cấu hình cần khởi động lại.

Phiên thử dùng feedback tổng hợp với adapter độc lập, không nạp ứng dụng/Prisma hoặc đụng dữ liệu học viên. Không khởi động backend mặc định đang trỏ DB từ xa.

```powershell
# Chỉ tạo một lần; lệnh từ chối ghi đè ledger đang có.
pnpm.cmd ai:live:init

# Gọi thật với feedback tổng hợp, dùng cùng adapter như endpoint hiện có.
pnpm.cmd ai:live:check

# Không gọi model, chỉ xem số lượt và usage/cam kết đã ghi.
pnpm.cmd ai:live:status
```

Sổ ngân sách (`ledger`) đã được tạo, không cần chạy lại `ai:live:init`. Muốn tắt gọi thật, đặt `LAB_AI_MODE=deterministic` rồi khởi động lại backend. Với `NODE_ENV=production` hoặc `test`, nhánh local luôn bị tắt dù có key. Các biến cũ `LAB_AI_URL/KEY/MODEL` không còn gọi trực tiếp; test tích hợp bỏ `LAB_AI_MODE` để không phát sinh lần gọi thật.

## Hạn mức local có thực thi

| Giới hạn                               |                                                               Giá trị |
| -------------------------------------- | --------------------------------------------------------------------: |
| Tổng số reservation/lần thử, kể cả lỗi |                                         20 trong suốt vòng đời ledger |
| Chi phí cam kết/ngày UTC               |                                                              0,05 USD |
| Chi phí cam kết/tháng UTC              |                                                              0,10 USD |
| Chi phí cam kết/toàn ledger            |                                                              0,10 USD |
| Input tối đa                           | 6.000 tokens; tokenizer preflight toàn request, chừa margin 64 tokens |
| Output và thinking cộng lại            |                                                            800 tokens |
| Khoảng cách giữa hai lần thử           |                                                        Ít nhất 6 giây |
| Call đang chờ                          |                                        Một slot chung; cửa sổ 60 giây |
| Tokenizer / generation timeout         |                                                           8 / 45 giây |

Theo giá Standard đã ghi nhận ngày 22/10/2026: 0,30 USD/triệu input và 2,50 USD/triệu output gồm thinking. Trước khi gọi mạng, giữ trước mức tối đa **3.800 micro-USD/lần**. Không bật search/tool/cache/audio/image hoặc tự gọi lại/chuyển model khi lỗi. `thinkingLevel=minimal` chỉ giảm suy luận, không tắt thinking; `maxOutputTokens=800` chặn tổng output + thinking nên không cộng thinking lần hai. Đây là giá theo mốc báo cáo, cần kiểm lại trước đợt thử mới. [Bảng giá](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite), [token limits/thinking](https://ai.google.dev/gemini-api/docs/generate-content/thinking).

Sổ `.tmp/ai-lab-live/budget.json` lưu phần giữ chỗ, trạng thái và usage; không lưu key/nội dung chat. Khóa file độc quyền và đổi tên file nguyên tử tránh hai chương trình trên cùng máy ghi chồng nhau.

Luôn giữ **toàn bộ chi phí tối đa đã cam kết**, kể cả kiểm trước gọi bị lỗi, quá hạn chờ hoặc thiếu usage. Không tự hoàn phần dự phòng. Số usage thực được ghi thêm, không làm giảm ngân sách đang giữ. Usage vượt giới hạn thì bật trạng thái chặn và dừng nhận lần gọi mới.

Khởi động lại vẫn giữ sổ. Nếu thiếu/hỏng sổ hoặc còn khóa sau sự cố, chương trình không gọi provider và không tự tạo/reset. Không xóa sổ/khóa để tăng ngân sách khi chưa kiểm các lần gọi chưa rõ kết quả.

Cơ chế file local chưa thay cho sổ PostgreSQL, khôi phục ở máy khác hoặc hạn mức dùng chung nhiều host. Trần chỉ áp dụng cho adapter này trên máy này theo bảng giá đã lưu; không chặn mọi hoạt động khác của cùng tài khoản Google, cũng chưa gồm thuế/chênh lệch tỷ giá.

## Dữ liệu và output

Chỉ gửi tối đa 20 mục `passed/message/hint` công khai từ feedback. Không gửi toàn định nghĩa lab, expected/actual của bộ chấm, đáp án ẩn, trạng thái lab, tài khoản hoặc token đăng nhập. Che các mẫu key/email/password trong text và giới hạn từng chuỗi/tổng dữ liệu. Bộ đếm token nhận cùng system instruction/context/schema với lần sinh câu trả lời; thiếu số token hoặc quá trần thì không gọi sinh output.

Mỗi request gọi `generateContent` một lần. Chỉ nhận candidate `STOP` và JSON đúng khuôn với `explanation` dài 10–6.000 ký tự. JSON sai không dẫn tới lần gọi thứ hai. React hiển thị text, ghi rõ Gemini/dự phòng và bỏ kết quả muộn nếu đã đổi token/attempt. Không sửa trạng thái lab, điểm hoặc tự chạy lệnh. Các kiểm tra liên kết/bằng chứng/mức gợi ý đầy đủ của BE-05/R1 vẫn chưa có trong nhánh này.

## Bằng chứng ngày 22/10/2026

- Key được API chính thức chấp nhận: `GET /v1beta/models` HTTP 200, có model đã chọn. Không ghi giá trị key vào bằng chứng.
- Hai lần generation với timeout 20 giây không nhận được kết quả; giữ cả hai reservation, không tự replay. Sau khi tăng deadline local lên 45 giây, một smoke mới trả giải thích tiếng Việt thật, `provider=gemini`, model đúng và JSON hợp lệ.
- Lần thành công báo 156 input, 129 output, 0 thinking tokens; ước tính làm tròn lên **370 micro-USD**. Tổng ba reservation giữ **11.400 micro-USD**; chi phí tổng thực vẫn chưa xác minh vì hai timeout giữ usage unknown, không báo chúng là 0.
- Catalog/model access và một call thành công không chứng minh RPM/TPM/RPD. Hạn mức tài khoản vẫn `null`; chưa tăng tier, bật billing, thay khóa production hoặc triển khai host.
- Offline provider/budget **15/15**, có case timeout/unknown giữ slot đến hết cửa sổ 60 giây; CLI **76 qua, 1 DB integration bỏ qua**; frontend labs **14/14**, gồm nhãn Gemini/dự phòng và HTML được escape.
- Build production thành công; lint/Prettier/budget/boundaries/diff đạt. Kiểm 169 liên kết local không hỏng; quét 414 source files và 25 build files không có key thực. Không coi kết quả build là nghiệm thu stack đang chạy; chưa khởi động app/Prisma hoặc deploy.

## Điều kiện thay thế

**Cập nhật 26/10/2026:** [PY-02](../baseline/PY-02-provider.md) đã kiểm một lượt
Gemini thật qua worker/Python/PostgreSQL riêng, dùng chung ledger này theo
[ADR-010](ADR-010-python-local-gemini.md). Đường `/explain` cũ chưa bị đóng trong
PY-02; phần thống nhất đường gọi tiếp tục ở BE-06.

Khi ghép R1, thay nhánh local bằng hàng chờ, hạn mức, cấp phép và biên nhận PostgreSQL cùng Python adapter đúng quy ước dữ liệu. Trước pilot cần đánh giá trên ba lab, xác minh hạn mức tài khoản, chính sách dữ liệu, staging/backup, công tắc tắt và các mốc còn mở. Model truy cập được và một câu trả lời hợp lệ chưa chứng minh chất lượng hoặc khả năng chạy production.
