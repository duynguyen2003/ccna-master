# Lab theo kiến thức tiên quyết

Cập nhật 28/10/2026. Học viên có thể thực hành trong lúc học; lab có điều kiện
mở riêng, thay vì phải hoàn thành toàn bộ khóa học chứa lab.

## Cấu hình quản trị

Vào **Quản lý thực hành → Tạo/Sửa → Thông tin cơ bản → Điều kiện mở lab**.

| Chế độ              | Điều kiện                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Tự luyện            | Đăng nhập; không yêu cầu hoàn thành khóa/chương dùng để xếp lab.                                                       |
| Theo bài tiên quyết | Mọi bài đã chọn đạt điều kiện: video ít nhất70% tiến độ đã lưu, bài đọc hoàn thành. Đây là mặc định của form tạo mới.  |
| Tổng hợp            | Hoàn thành toàn bộ lý thuyết trong chương đã chọn, hoặc toàn khóa nếu không chọn chương. Không yêu cầu hoàn thành lab. |

Khóa học/chương phải tồn tại trong nội dung đã xuất bản. Bài tiên quyết chọn
trong cùng khóa, thu hẹp theo chương nếu đã chọn chương. Tìm kiếm và checkbox
hỗ trợ danh sách dài. Thay khóa/chương sẽ xóa lựa chọn bài cũ để tránh sai phạm
vi. Không xuất bản lab theo bài khi danh sách tiên quyết rỗng; bài đã xóa hoặc
khác phạm vi bị từ chối ở API. Lab cấu hình mới cần chọn khóa khi xuất bản để
sắp xếp và lưu kết quả; đây không phải điều kiện hoàn thành khóa đó.

Tùy chọn **Tính vào hoàn thành chương/khóa học** độc lập với quyền mở lab.
Tự luyện mặc định tắt tùy chọn này; Theo bài/Tổng hợp mặc định bật. Lab tùy chọn
vẫn ghi kết quả thực hành nhưng không làm giảm phần trăm hoặc khóa tiến độ
chương/khóa. Chương chỉ chứa lab tùy chọn không chặn chương bắt buộc phía sau.
Lab tùy chọn không tạo XP hoàn thành học phần từ việc không làm gì.

Lab cũ có accessPolicy=null giữ quyền theo lộ trình trước đây. Mở form sửa
không tự chuyển chế độ; quản trị chọn và lưu khi muốn áp dụng policy mới.
Quyền test ADMIN trong môi trường admin-test được giữ như trước. Dùng tài khoản
học viên để kiểm điều kiện học thông thường.

## Thực thi

- `labs.access_policy` là JSON nullable, có mode, lessonIds và
  requiredForCompletion. Migration chỉ thêm cột/check; không backfill lab cũ.
- Domain `labAccess` dùng bằng chứng UserProgress hiện tại và metadata bài còn
  được xuất bản. Không dùng tổng phần trăm khóa để quyết định mở lab có policy.
  Thiếu/sai policy hoặc bài tiên quyết bị xóa thì khóa; cấu hình sai cũng không
  được dùng để loại lab bắt buộc khỏi tiêu chí hoàn thành.
- API create/update kiểm scope và payload. Learner list trả quyền, lý do, bài
  còn thiếu; không trả gradingSpec/initialState. Lab bị khóa không có guide,
  bước làm hoặc fileUrl trong response. ADMIN ở màn học dùng view=learning;
  màn quản trị giữ editor view.
- Cùng rule được áp dụng khi bắt đầu CLI, nộp bài và ghi tiến độ Packet Tracer.
  Nộp CLI kiểm lại quyền trước khi chấm, cả kết quả trượt. Lab tổng hợp không
  phụ thuộc chính kết quả lab nên không tạo vòng khóa.
- URL bị khóa không mở workspace; thẻ hiện bài cần học. Đổi auth xóa ngăn cũ,
  response tài khoản cũ không ghi đè list mới. URL mở lab hợp lệ được giữ qua
  tải ban đầu; đóng ngăn xóa query labId.
- Roadmap và phần trăm thẻ khóa học cùng loại lab tùy chọn khỏi mẫu số. Quyền
  lab không nới khóa bài học/chương/khóa học và không mở cohort/model AI.

Phạm vi này không thay hệ thống chống gian lận tiến độ video hoặc cơ chế phát
file/video tĩnh. Điều kiện học không thu hồi được URL hoặc tệp đã tải trước đó.

## Hai lab ITN đã bổ sung

| Lab trên app                                         | Điều kiện                                                      | Tính vào hoàn thành khóa |
| ---------------------------------------------------- | -------------------------------------------------------------- | ------------------------ |
| ITN 01 - Nhận diện thiết bị và bật cổng kết nối, id3 | Bài giới thiệu mạng id14 đạt điều kiện; thuộc chương m2392089. | Không                    |
| ITN 02 - Cấu hình IPv4 và kiểm tra ping, id4         | Tự luyện, mở sau đăng nhập.                                    | Không                    |

Cả hai có topology PC1–R1, hướng dẫn, tiêu chí chấm và lời giải kiểm bằng engine
thật. Trạng thái đầu0điểm, cấu hình đúng100điểm; mất liên kết thì không đạt.
Không thêm lab bắt buộc vào lộ trình cũ để tránh khóa lại tiến độ đã có. Lab
EIGRP giữ nguyên dữ liệu/điều kiện cũ.

```sh
pnpm labs:foundation:add
pnpm labs:foundation:add --apply
```

Lệnh đầu dry-run. Lệnh apply chỉ thêm lab khi chưa có tên được nhận diện; không
ghi đè hoặc khôi phục lab đã có, kể cả lab đã xóa mềm. Có khóa DB để hai lần chạy
đồng thời không thêm trùng. Cần migrate/generate Prisma trước. Nếu quản trị đổi
tên lab, kiểm dữ liệu trước khi chạy lại công cụ; tên là định danh của seed này.

## Kiểm chứng

- 39 suite/296 test frontend đạt. Bao gồm chọn bài/tìm kiếm/lỗi tải, legacy giữ
  nguyên, thẻ khóa/link đúng bài và URL mở/khóa qua tải ban đầu.
- 24 unit learning đạt; 2 integration opt-in được chạy riêng. HTTP PostgreSQL
  trên DB tạm:25hồi quy lộ trình +5policy lab test/subtest đạt.
- CLI: 78 đạt/1 opt-in skip, gồm 2 lab mới. AI: 229 offline và storage/HTTP 17 fresh +
  17upgrade +39test/subtest đạt. Các DB tạm được xóa; không gọi model.
- Lint, Prettier, boundaries và production build đạt. Tooling vẫn có warning
  fs.F_OK/Prisma preview cũ.
- Browser dùng build production và API fixture riêng: learner deep link khóa
  không mở ngăn, lab tự luyện mở workspace; thẻ có lý do/link. Kiểm layout
  1536px và iframe cùng origin rộng375px với hai theme; Tab tới link tiên quyết
  trong khung375px. Đây không phải thiết bị touch thật hoặc mobile emulation.
- Browser admin chọn thêm bài15 và lưu PUT; payload đúng LESSONS/[14,15]/false.
  Ba option đúng và checkbox tìm/chọn bài sử dụng label/bàn phím.
- Migration đã áp lên DB app; seed tạo id3/4, chạy lại giữ nguyên IDs. So sánh
  EIGRP trước/sau trùng toàn bộ record. Dùng cùng bằng chứng tiến độ trước seed
  để tính với catalog mới: phần trăm/status/stats không đổi. API learner trên
  app thật trả id3 khóa theo bài và id4 mở; không trả rubric/state riêng.

Evidence: `.tmp/lab-access-20261028/`, trong đó có live-check.json,
browser-checks.json, admin-save.json, log tests/build/migration và ảnh.
Backend5500 đã restart; frontend3001/worker fake giữ chạy. Không commit/push
hoặc đẩy code lên hosting; không đổi role, mật khẩu, dữ liệu tiến độ cũ hay
policy/cohort AI. Server fixture và tab kiểm thử được dừng/đóng sau QA.
