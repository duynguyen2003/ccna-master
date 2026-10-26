# OPS-00 — Chuẩn bị database thử riêng và ngân sách AI

**Ngày quyết định:** 22/10/2026. **Owner:** chủ repo (SO/SE). **Phạm vi được chọn:** local/fake, 0 USD; người dùng có tài khoản Gemini. [ADR-008](../adr/ADR-008-local-fake-deployment.md) · [Backlog](../03-delivery-backlog.md).

**Cập nhật sau đó cùng ngày:** người dùng cấp key và yêu cầu thử model thật. [ADR-009 — Gemini local](../adr/ADR-009-local-live-gemini.md) và [cấu hình giới hạn được chương trình thực thi](OPS-00-live.json) cho phép nút giải thích kết quả local dùng Gemini: tối đa 20 lần thử, 0,05 USD/ngày, 0,10 USD/tháng/toàn sổ. Đã có một lần thử thật thành công. Phần còn lại ghi quyết định local/fake ban đầu; môi trường thử toàn ứng dụng và mốc cho học viên dùng vẫn chưa nghiệm thu.

OPS-00 lo hai câu hỏi: **thử ở đâu để không đụng dữ liệu thật** và **được phép tốn bao nhiêu tiền**. Kết quả chính là có PostgreSQL thử riêng trên máy, dùng AI giả để tiếp tục xây phần nền với ngân sách gọi model 0 USD.

Ví dụ, BE-01 có thể tạo DB tạm trong PostgreSQL riêng, thử nâng cấp/lỗi rồi xóa đúng DB tạm đó. Việc này chưa có nghĩa là toàn bộ frontend, API, worker và Python đã chạy chung trong một môi trường thử.

## 1. Kết quả và giới hạn

Các dòng “chưa có” trong bảng là tại thời điểm quyết định nhánh fake ngày 22/10. Phần worker được bổ sung sau ở [BE-04](../baseline/BE-04-worker.md); thử Gemini riêng theo cập nhật đầu tài liệu.

| Hạng mục                     | Quyết định / bằng chứng                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| Host/region                  | Máy Windows hiện tại, loopback; không thuê region cloud                                     |
| Provider hiện tại            | Fake/offline fixtures; 0 lần gọi Gemini hoặc hãng khác                                      |
| Budget pilot/ngày/tháng/eval | Tất cả **0 USD**, áp dụng cả gọi free tier                                                  |
| DB thử                       | PostgreSQL 17.9, cluster/data/user mới; `ai_lab_local` tại `127.0.0.1:55432`                |
| DB hiện hữu / root `.env`    | Không dùng để tạo/sửa dữ liệu thử                                                           |
| Model tham khảo              | Hai cấu hình Gemini; chưa chọn bằng eval, chưa có quyền gọi thật                            |
| Quota tài khoản              | Chưa xác minh model/project/tier/RPM/input TPM/RPD; không coi `null` là 0 hoặc unlimited    |
| Hỗ trợ local                 | Chủ repo; dự kiến 20:00–21:00 T3/T5, giờ Việt Nam, 2 giờ/tuần; xem console/log khi làm việc |
| Staging ứng dụng             | Chưa có Node worker/Python/AI API; DB cách ly không thay thế staging toàn hệ thống          |

**OPS-00 xong nhánh local/fake theo yêu cầu người dùng.** Có thể tiếp tục BE-01 và P1 bằng AI giả. G0 là mốc chuẩn bị đầy đủ trước các bước sau, vẫn còn mở: DISC-02 chưa làm, staging ứng dụng và các điều kiện model thật/pilot chưa nghiệm thu. DISC-B01…B07 giữ điều kiện đóng ban đầu; có DB thử giúp B01 tiến thêm nhưng chưa đủ để đóng việc tách toàn môi trường thử.

## 2. Worksheet ngân sách

Đây là bảng ngân sách đã quyết định, lấy từ [OPS-00-budget.json](OPS-00-budget.json). Chạy `pnpm check:ai:budget` để kiểm phép tính offline. Bảng này chưa tự kết nối với luồng nhận câu hỏi/sổ chi phí/chính sách đang chạy để chặn chi tiêu.

| Khoản tăng thêm được phép               | Ngân sách tháng |
| --------------------------------------- | --------------: |
| Model và live evaluation                |           0 USD |
| Compute và DB local                     |           0 USD |
| Backup, monitoring, network dịch vụ mới |           0 USD |
| Dự phòng                                |           0 USD |
| **Tổng**                                |       **0 USD** |

0 USD là trần chi phí dịch vụ **tăng thêm** trong nhánh này. Máy tính, điện, Internet, host hiện có và thời gian làm việc vẫn có chi phí. Dùng dữ liệu mẫu và log local, chưa mua dịch vụ backup/giám sát ngoài máy. DB tạm có thể bị hệ điều hành dọn nên chỉ lưu dữ liệu tổng hợp tạo lại được, không lưu dữ liệu học viên thật.

## 3. Hai cấu hình Gemini để eval sau này

Đây là số giá Standard text đã ghi nhận **ngày 22/10/2026**, đơn vị USD/triệu token; cần kiểm lại trước đợt thử mới. Token là đơn vị model dùng để đo đầu vào/đầu ra. Phần output tính cả thinking; chọn `minimal/low` không có nghĩa thinking bằng 0 hoặc đã có trần cứng.

Ở mốc chọn nhánh fake, hai cấu hình đều **chưa đủ điều kiện gọi thật** do chưa xác minh hạn mức, trần chi phí, bộ đếm token và adapter đầu ra. Lần thử local sau đó theo ADR-009. Nguồn giá tại mốc ghi nhận: [giá chính thức](https://ai.google.dev/gemini-api/docs/pricing), [thinking](https://ai.google.dev/gemini-api/docs/thinking).

| Ứng viên                          | Input | Output gồm thinking | Trạng thái giá                                     |
| --------------------------------- | ----: | ------------------: | -------------------------------------------------- |
| `gemini-3.5-flash-lite`, Standard |  0,30 |                2,50 | Kiểm lại trước live eval                           |
| `gemini-3.8-flash`, Standard      |  0,75 |                3,75 | Đến 31/12/2026; công bố từ 01/01/2027: 1,50 / 7,50 |

Theo lần đối chiếu [vòng đời model](https://ai.google.dev/gemini-api/docs/deprecations) ngày 22/10, hai model chưa có ngày ngừng công bố. Ở mốc đó không chọn 2.5 làm mặc định cho project mới vì tài liệu giới hạn nhóm này cho người đã dùng trước. Chưa kiểm model/quyền trên tài khoản thì chưa bảo đảm tài khoản gọi được; đây không phải cập nhật trạng thái model ở ngày đọc tài liệu.

Ví dụ dưới đây **chỉ để thử phép tính**, chưa dự báo ngân sách thật hoặc mức tốn tối đa: 2.500 input + 500 visible output + **giả định 0 thinking**, không cache/tool/audio/image. 20 người × 14 ngày × 8 lượt = 2.240 lần gọi; thêm 400 lần gọi để đánh giá model.

| Ứng viên   |   Ví dụ/lượt | 2.240 calls | 400 eval calls |
| ---------- | -----------: | ----------: | -------------: |
| Flash-Lite | 0,002000 USD |    4,48 USD |       0,80 USD |
| Flash      | 0,003750 USD |    8,40 USD |       1,50 USD |

Các số ví dụ **không được chi** trong giai đoạn 0 USD. Thinking thật, lần gọi lỗi sau khi cấp phép, thuế/tỷ giá và hạ tầng phải tính thêm. Trần reasoning còn `null` thì chưa biết mức tối đa để giữ ngân sách; không dùng giả định 0 thinking làm trần.

AI-02 sẽ so model bằng cùng bộ dữ liệu. BE-03/OPS-02 dùng số nguyên micro-USD, giữ đủ input/output/thinking/phí bắt buộc và tiếp tục giữ khoản chưa rõ theo ADR-007.

Hạn mức provider thuộc project/model, không tách theo từng API key. RPM là request/phút, input TPM là token vào/phút, RPD là request/ngày. RPD provider đặt lại theo Pacific time; hạn mức user nội bộ dùng UTC, nên phải theo dõi riêng.

Trước đánh giá thật, chủ tài khoản ghi bí danh project, tier, model, RPM/input TPM/RPD và ngày thấy số liệu trong AI Studio; không gửi API key. [Giới hạn chính thức](https://ai.google.dev/gemini-api/docs/rate-limits).

## 4. DB thử riêng và cách dùng

Yêu cầu có `initdb`, `pg_ctl` trên PATH và cổng 55432 trống. Trên PowerShell máy này dùng `pnpm.cmd` nếu execution policy chặn `pnpm.ps1`.

```powershell
pnpm.cmd ai:db:start
pnpm.cmd ai:db:status
pnpm.cmd ai:db:stop
```

Công cụ [ai-lab-local-db.cjs](../../../src/agent/scripts/ai-lab-local-db.cjs) có start/status/stop. Nó không nhận URL tùy ý, đọc dotenv hoặc tự migrate/reset/restore. Gọi start lại vẫn dùng đúng cluster; stop chỉ dừng cluster riêng và giữ data. Khóa được sinh local, không in console.

Thông tin kết nối nằm ở `.tmp/ai-lab-local/connection.json`, được `.gitignore` bảo vệ; data/log ở `<os.tmpdir>/ccna-ai-lab-<hash-repo>/`. PostgreSQL Windows không khởi tạo ổn định ở đường dẫn repo có tiếng Việt nên dùng thư mục tạm ASCII. Trong môi trường sandbox của lần thực hiện ngày 22/10, `pg_ctl` cần quyền thực thi ngoài sandbox để tạo chương trình nền; không đổi service hoặc tăng quyền tài khoản PostgreSQL.

Sau khi kiểm `ai:db:status`, BE-01 có thể đọc `databaseUrl` từ file kết nối rồi truyền rõ ràng cho chương trình migration/test, không in URL vào log. OPS-00 chưa chạy migration. Mất data/file kết nối thì kiểm lại và chủ động dựng lại nếu cần; helper không có lệnh xóa đệ quy. Tài khoản này chỉ dùng cho cluster local, không dùng trên staging cloud.

Backend mặc định vẫn có thể đọc root `.env`. Vì vậy, **có DB thử riêng chưa đủ để khởi chạy ứng dụng cách ly**. Khi ghép BE/PY phải truyền DB/uploads/JWT riêng, tắt tích hợp ngoài không dùng và để `LAB_AI_URL/KEY/MODEL` rỗng trước khi chạy backend thử. Ở mốc OPS-00 chưa có toàn luồng AI mới để kiểm việc này từ đầu đến cuối.

## 5. Inventory secret theo nhánh local

Đây là danh sách tên cấu hình cho nhánh fake tại mốc OPS-00. Chỉ ghi tên, không đưa giá trị vào Git/frontend. BE-04 sau đó đã chốt khóa dịch vụ riêng trong báo cáo của task đó.

| Key                                        | Vị trí / trạng thái                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                             | Connection riêng được sinh trong file local bị ignore; chỉ truyền tường minh cho DB tests/migration |
| `JWT_SECRET`                               | Cần sinh riêng lúc ghép backend thử; không lấy từ root `.env`                                       |
| Internal service credential                | Tên env sẽ chốt ở BE-04/PY-01; chưa tạo key hoặc endpoint mới                                       |
| `GEMINI_API_KEY`                           | Chưa nạp vào nhánh local/fake; tài khoản có sẵn không đồng nghĩa được phép gọi                      |
| `LAB_AI_URL`, `LAB_AI_KEY`, `LAB_AI_MODEL` | Phải rỗng trong backend thử; đường cũ vẫn được theo dõi bởi DISC-B07/BE-06                          |
| OAuth, email, Cloudinary                   | Không cần cho smoke DB/fake fixtures; launcher thử phải cấu hình riêng hoặc tắt rõ ràng             |

## 6. Điều kiện chuyển sang model thật

Các điều kiện sau áp dụng cho luồng hội thoại R1; lần thử local riêng thực hiện theo ADR-009.

1. Có quyết định ngân sách thay cho 0 USD: trần ngày/tháng/pilot/đánh giá hữu hạn, hạn mức tài khoản thật; ghi rõ dự phòng, thuế/tỷ giá và chi phí host.
2. Xác minh giá/phiên bản, quyền model, cách xử lý dữ liệu và hạn mức tài khoản. AI-02 đánh giá rồi chọn cấu hình. Free tier vẫn cần quyết định trước khi đưa dữ liệu ra ngoài.
3. Adapter chặn tổng input ≤6.000, visible output ≤800 và có trần phần reasoning tính phí. Phải hiểu đúng giới hạn tổng token của provider; `minimal/low` chưa thay cho trần cứng.
4. BE-06 xử lý đường provider cũ. BE-03/04 + OPS-02 có giữ ngân sách/biên nhận, trần ngày/tháng và công tắc tắt; kiểm lỗi, kết quả chưa rõ và đối soát đạt.
5. Trước REL-01 có staging ứng dụng, khóa/uploads/DB riêng, backup/restore và bằng chứng qua các mốc tương ứng. Chốt lịch hỗ trợ/kênh cảnh báo; task này chưa gửi email hoặc tạo lịch tự động.

## 7. Bằng chứng local ngày 22/10/2026

- `pnpm.cmd check:ai:budget`: hai phép tính model/đánh giá đạt; ngân sách 0 USD, 0 lần gọi ngoài; hạn mức tài khoản còn chưa biết.
- PostgreSQL 17.9: đã kiểm đúng kết nối, DB/user, loopback/port, thư mục data và mã nhận diện cluster riêng. Chưa cập nhật cấu trúc DB ứng dụng.
- Start/stop/start/status/stop đạt. Dữ liệu đánh dấu thử còn nguyên sau khởi động lại và đã được xóa. Tạo/ghi bảng trong transaction rồi rollback không để lại bảng. Sai mật khẩu bị SCRAM từ chối (`28P01`). Kết thúc lần kiểm với cluster **đã dừng**, giữ data/file kết nối cho BE-01.
- ESLint/Prettier đạt cho tooling/worksheet/package/workflow; boundaries đạt 1.120 import/asset trong 268 source file; 157 liên kết local trong 23 tài liệu không có link hỏng; `git diff --check` đạt. Connection record và script smoke local được Git ignore. CI thêm budget check offline, chưa push/chạy GitHub.
- Kết quả kiểm DB cơ bản này chưa chứng minh staging toàn ứng dụng hoặc provider đã chạy. Nhánh fake của task không áp migration, gọi provider, thay root `.env`, commit/push hoặc triển khai production.
