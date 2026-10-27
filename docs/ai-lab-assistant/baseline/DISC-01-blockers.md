# DISC-01 — Những việc còn cần kiểm tra hoặc xử lý

[Baseline và bằng chứng](DISC-01-platform-baseline.md) · [Backlog](../03-delivery-backlog.md)

Ngày tạo: **19/10/2026**. DISC-01 đã xong kiểm kê, còn các việc dưới đây vẫn **OPEN** trong hồ sơ này. “Issue” là một việc cần theo dõi; chưa đăng các mục này lên GitHub. “Owner” là vai trò chịu trách nhiệm theo kế hoạch một người.

Ví dụ, chưa biết backend đang chạy commit nào thì cần lấy bằng chứng từ host; chưa thể kết luận backend lỗi. Cột “Phải đóng trước” chỉ mốc phải xử lý xong trước khi nghiệm thu bước tiếp theo. Phần nghiên cứu hoặc bản giả lập không phụ thuộc vấn đề đó vẫn có thể tiếp tục.

| ID       | Vấn đề                                                                     | Owner | Phải đóng trước                                                |
| -------- | -------------------------------------------------------------------------- | ----- | -------------------------------------------------------------- |
| DISC-B01 | Local dùng DB được báo cáo là production; staging cách ly chưa xác minh    | SO/SE | Test có ghi dữ liệu ngoài CI; staging rehearsal ở OPS-03       |
| DISC-B02 | Chưa biết revision backend đang chạy và thiếu xác minh auth runtime đầy đủ | SO/SE | GATE-01 trên stack đích; QA-02/REL-01 trên staging             |
| DISC-B03 | Chưa đối chiếu DB trên Render; schema drift hiện tại chưa chạy được        | SE    | BE-01 áp migration trên môi trường đích                        |
| DISC-B04 | Backup mới xác minh DB; thiếu bằng chứng uploads/offsite/restore đầy đủ    | SO/SE | OPS-03 / REL-01                                                |
| DISC-B05 | Chưa xác minh proxy trust và tải lớp chung IP                              | SO/SE | OPS-04 / REL-01                                                |
| DISC-B06 | Chưa đọc được inventory secret trên dịch vụ                                | SO    | Chốt cấu hình OPS-00; cấp secrets theo môi trường trước OPS-03 |
| DISC-B07 | Đường provider cũ chưa đi qua durable quota/accounting                     | SE    | Bật provider thật của hệ thống mới; BE-06 / REL-01             |

## DISC-B01 — DB local và staging cách ly

**Cập nhật 22/10/2026:** [OPS-00 local/fake](../ops/OPS-00-local-fake.md) đã có PostgreSQL thử riêng cổng 55432, kiểm đúng đích kết nối, khởi động lại, ghi/rollback và xác thực SCRAM bằng dữ liệu mẫu. Helper không dùng root `.env`. Đã có DB thử cho BE-01, nhưng chưa kiểm toàn ứng dụng với uploads/khóa riêng nên issue vẫn mở.

**Bằng chứng ở mốc kiểm kê:** `.env` local trỏ Supabase từ xa; báo cáo nâng cấp cũ gọi đó là DB production. Frontend local trả 200 nhưng API cổng 5500 chưa chạy. Có bản frontend preview, chưa xác minh DB/API/uploads/key riêng.

**Vì sao cần xử lý:** test theo cấu hình mặc định có thể ghi vào dữ liệu thật. Có trang frontend preview chưa đủ để thử toàn bộ luồng AI.

**Xong khi:** phân biệt được đích local/CI/staging/production; có DB, uploads, khóa và dữ liệu mẫu riêng cho thử nghiệm. Kiểm API readiness và các thao tác cơ bản trên staging, ghi commit cả frontend/backend. Không test tạo/sửa bằng production URL. Việc dựng môi trường thuộc OPS-00/OPS-03; phiên kiểm kê không tự khởi động hoặc đổi `.env`.

## DISC-B02 — Revision backend và xác minh auth runtime

**Bằng chứng:** Vercel frontend có SHA từ GitHub; API readiness của Render chưa trả phiên bản phát hành. Test auth từng phần 2/2 đạt; GET lab không token trên production trả 401. Chưa kiểm tài khoản bị khóa, phiên cũ, đổi vai trò, bị xóa khỏi nhóm và đổi tài khoản trên staging.

**Vì sao cần xử lý:** code đã merge chưa chứng minh backend đang chạy đúng phần kiểm phiên/quyền hoặc khớp frontend.

**Xong khi:** lấy commit/image từ thông tin triển khai backend hoặc danh sách phiên bản phát hành đã đối chiếu host. Frontend, backend và migration phải thuộc cùng bản phát hành. Dùng tài khoản mẫu trên staging để kiểm các ca đăng nhập/phiên/thành viên, lưu HTTP và SHA. Không tạo tài khoản/token thử hoặc thu hồi phiên người thật trên production để lấy bằng chứng.

## DISC-B03 — Đối chiếu DB runtime và schema drift

**Bằng chứng:** ba migration trên DB trong `.env` đã hoàn tất, không bị rollback, checksum khớp. Có các cột session và bảng exam attempts. Chưa đọc cấu hình Render để biết có dùng cùng DB hay không. Prisma `migrate diff` lỗi TLS `P1011`; kết quả không lệch của lần trước chỉ là lịch sử.

**Vì sao cần xử lý:** chưa biết toàn bộ cấu trúc DB backend đang dùng có khớp schema hay không. Đây là ý nghĩa của việc kiểm “schema drift”.

**Xong khi:** người vận hành xác nhận đúng DB đích mà không chép khóa/URL bí mật vào báo cáo; sửa kết nối TLS/tooling rồi chạy phép so chỉ đọc. Lưu kết quả không lệch hoặc lập migration xử lý khác biệt đã xác nhận. Kiểm lại lịch sử/checksum. Không reset DB, sửa migration đã áp dụng hoặc tắt kiểm chứng TLS.

## DISC-B04 — Backup đầy đủ và restore trên môi trường cách ly

**Bằng chứng:** file `public.dump` local khớp kích thước/hash của manifest; báo cáo cũ ghi restore DB và so 24 dấu nhận diện dữ liệu đạt. Gói đó thiếu uploads và khác định dạng của `pnpm restore`. Chưa kiểm lịch tự động, bản sao khác máy, media cloud, mức dữ liệu có thể mất (RPO) và thời gian khôi phục (RTO).

**Vì sao cần xử lý:** khôi phục được DB mà mất file upload/media thì ứng dụng vẫn thiếu dữ liệu.

**Xong khi:** có gói DB + đúng uploads nguồn, có cách bảo vệ/khôi phục Cloudinary nếu dùng, bản sao độc lập và lịch/cảnh báo. Restore vào DB/uploads trống, cách ly rồi kiểm file mẫu, migration, đăng nhập và dữ liệu học. Ghi thời gian thực tế, giới hạn mất dữ liệu và cách chuyển kết nối. Gói DB cũ cần quy trình riêng, không đưa thẳng vào script yêu cầu `database.dump`/`uploads.tar.gz`.

## DISC-B05 — Proxy trust và tải chung IP

**Bằng chứng:** đã thấy đường Vercel → Render, chưa xác minh số lớp trung gian, `TRUST_PROXY` và firewall Render. Nginx scale trong repo giới hạn lab 4 request/giây/IP, burst 24. Bộ đếm Express nằm trong RAM từng replica; Docker engine local chưa truy cập được.

**Vì sao cần xử lý:** tin sai proxy có thể nhận sai IP và đếm sai lượt. Cả lớp dùng chung IP Internet (NAT), cộng các lần hỏi tiến độ AI, có thể bị chặn 429 tại lớp ngoài. Bộ đếm RAM từng server chưa giữ được hạn mức chung. Cũng chưa có bằng chứng Render dùng Nginx scale này.

**Xong khi:** vẽ đúng đường chạy trên host, cửa nhận truy cập duy nhất và các hop/subnet được tin cậy; kiểm client không giả IP chuyển tiếp qua đường truy cập trực tiếp. Thử chung IP, nhiều tab và nhiều replica trên môi trường thử. Phân biệt 429 do lớp ngoài với hạn mức user, xác nhận hạn mức AI dùng nơi lưu chung theo BE-03. Đổi chính sách phải dựa trên số đo tải và giữ bảo vệ hiện có.

## DISC-B06 — Inventory secrets theo môi trường

**Bằng chứng:** đã liệt kê tên key từ template/local/source. API GitHub secrets cấp repo, `preview`, `production` trả 401; chưa đọc được danh sách cấu hình đang dùng trên Render/Vercel. Deploy thành công chưa chứng minh quyền và cách tách khóa giữa các môi trường.

**Vì sao cần xử lý:** cần biết môi trường thử dùng khóa riêng, ai quản lý khóa và host đã có đủ cấu hình bắt buộc chưa.

**Xong khi:** người có quyền liệt kê **tên key** theo dịch vụ/môi trường, ghi người quản lý và cách cấp/thu hồi. Xác nhận staging/production tách khóa, khóa provider không vào `REACT_APP_*`. Không đưa giá trị, token, `.env` hay URL chứa mật khẩu vào issue/log/Git; người đọc báo cáo không cần xem secret.

## DISC-B07 — Đường gọi AI có phí cũ

**Bằng chứng ở mốc kiểm kê:** `labFeedback.js` gọi provider trực tiếp khi đủ `LAB_AI_URL`, `LAB_AI_KEY`, `LAB_AI_MODEL`; `/explain` chỉ dùng bộ giới hạn CLI hiện tại. Local lúc đó chưa đặt ba key; chưa biết cấu hình production. Hạn mức/sổ chi phí lưu bền vững của hệ thống mới chưa có ở mốc DISC-01.

**Vì sao cần xử lý:** khi có cả hai luồng, đường cũ có thể gọi AI mà bỏ qua hạn mức và sổ chi phí mới. Source cho thấy cần xử lý việc này; chưa có kết luận production đang phát sinh phí.

**Xong khi:** BE-06 giữ câu dự phòng tương thích, khóa nhánh provider cũ hoặc chuyển về chung luồng nhận câu hỏi/hạn mức/biên nhận. Kiểm không còn đường gọi có phí bỏ qua giới hạn. Chỉ bật model thật của luồng mới khi có ngân sách và cơ chế tắt theo backlog.
