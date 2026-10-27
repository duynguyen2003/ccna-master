# Kết quả cải thiện giao diện học viên

Cập nhật **27/10/2026**. Phạm vi: trang chủ, khóa học, bài học, lab, kiểm tra, hồ sơ, tài liệu, công cụ và các màn tài khoản.

**Đã triển khai các hạng mục P1, P2 và P3 trong bản audit:** hiệu năng, lỗi thao tác, bàn phím, bố cục học tập, token/icon, sáng–tối, URL mới và terminal minh họa. Tài liệu này thay cho danh sách đề xuất cũ: mỗi mục dưới đây ghi thay đổi đã làm và mức kiểm chứng. Phần nghiệm thu cần môi trường thật được ghi riêng ở cuối.

## Điều chỉnh theo yêu cầu giữ lại hiệu ứng cũ — 27/10/2026

- Khôi phục hiệu ứng gõ/xóa lần lượt các câu trên banner từ bản trước audit; vẫn tắt khi người dùng chọn giảm chuyển động.
- Khôi phục sidebar gooey dùng spring và SVG nối giữa các mục, gồm bố cục dọc trên desktop và ngang trên mobile. Giữ Motion 13.2.0 cùng các phiên bản phụ thuộc đã dùng trước đó.
- Ô tìm kiếm về nền trung tính, bỏ viền màu mới; giữ dấu focus khi dùng bàn phím.
- Sửa xung đột CSS làm thẻ CLI nền trắng trong khi chữ sáng. Thẻ có nền tối riêng trong cả hai theme; đã thử show version và thấy kết quả.

Sau lần khôi phục animation, JS/CSS ban đầu tăng từ 154.921 lên 196.889 byte gzip do dùng lại Motion cho sidebar. Số đo hiện tại đã gồm cả cập nhật font/thanh học tiếp ở mục tiếp theo. Không bỏ hiệu ứng người dùng muốn giữ chỉ để giảm chỉ số bundle.

## Font và thanh học tiếp tham khảo F8 — 27/10/2026

- Đã xác minh bằng REA và computed style: nội dung lộ trình F8 dùng **Be Vietnam Pro**. Áp dụng font này cho phần học viên và hộp thoại; giữ monospace cho CLI/code và font admin hiện có.
- Thêm thanh tiến độ gọn dưới header cho người đã đăng nhập: phần trăm khóa học, bài tiếp, số khóa hoàn thành, chuỗi ngày và nút **Tiếp tục học**. Dùng learning path/API hiện có và query cache chung với Roadmap; mở đúng ID bài học. Đã bỏ card học tiếp lớn cũ trên Home.
- Có trạng thái chưa học, hoàn thành, tải và lỗi/thử lại. Không hiện thanh trên màn tài khoản/bài học/làm thi/kết quả/chữa bài. Bố cục nhỏ xuống hàng, hai theme cùng dùng token màu.
- Mũi tên chỉ lùi 1px, không co ngang; cùng selector phục vụ hover và focus bàn phím. Không đổi typewriter, gooey sidebar hoặc nền trung tính của ô tìm kiếm.

Phân tích nguồn, giới hạn suy luận về cách F8 lưu tiến độ và ánh xạ dữ liệu của dự án nằm trong [Font chữ và thanh học tiếp tham khảo F8](f8-typography-progress.md). Thanh trong ảnh người dùng chưa xuất hiện ở lần mở trang F8 hiện tại; không coi phân tích bundle cũ là kiểm chứng backend F8.

Riêng đợt thêm thanh học tiếp đưa JS/CSS ban đầu từ 196.889 lên 202.030 byte gzip (+5.141 byte). Số đo hiện tại bên dưới còn gồm lần khôi phục nút xóa ở mục kế tiếp. Font tải riêng qua Google Fonts, có display=swap và fallback; dung lượng font không nằm trong bảng bundle này. Không công bố mức tăng tốc tải trang từ số đo byte.

## Khôi phục nút xóa và sửa hàng bài học — 27/10/2026

- Bản tối ưu trước đã thay animation nút xóa bằng nút tĩnh. Đã khôi phục chuyển động gốc bằng Motion đang có: mở nắp thùng rác, co thân, mở rộng khay xác nhận, nút xác nhận/hủy và dấu tick. Giữ chế độ giảm chuyển động, focus/Escape, xác nhận hai bước và khóa thao tác khi đang gửi yêu cầu.
- Mép trắng ló ra bên phải các bài tên dài là nút xóa bị đẩy ra ngoài hàng rồi bị article cắt. Sửa flex/min-width của phần tên và giữ kích thước nút. Panel xác nhận mở ra vẫn nằm trong hàng. Khung lớn bên phải là vùng soạn bài; được giữ để chọn/xem/sửa nội dung.
- Sửa thêm min-width của hai cột và cột đơn minmax(0,1fr), cho header trình soạn bài xuống hàng. Danh sách bài trong trình soạn co lại theo chiều rộng sẵn có để không kéo cả sidebar rộng quá màn hình nhỏ.
- Hai callback xóa bài/chương trả lỗi về DeleteButton để không hiện trạng thái Đã xóa khi API thất bại. Kiểm browser bằng API giả lập: lỗi giữ nguyên 3 bài, thử lại thành công còn 2 bài; không xóa nội dung thật.

Đã kiểm hàng tên dài ở 1440px và màn hình hẹp, cùng lúc panel đóng/mở, Enter/Escape và focus. Có 7 test cho DeleteButton, gồm async pending, lỗi/thử lại và reduced motion. Bằng chứng nằm tại .tmp/ui-delete-restore-20261027/.

Sau đợt khôi phục nút xóa, JS/CSS ban đầu là **206.883 byte gzip**, tăng **4.853 byte** so với bản đã thêm thanh học tiếp. Không thêm dependency; Motion 13.2.0 được tái sử dụng.

## Khôi phục banner, chuyển động và màu sơ đồ — 27/10/2026

- Banner Home trở lại với cả khách và người đã đăng nhập. Dòng **Lộ trình học CCNA** thêm dưới thanh tiến độ đã được bỏ; h1 thật của banner tiếp tục làm tiêu đề trang.
- Trên Home: banner → thanh học tiếp → nội dung bên dưới. Các trang học viên khác giữ thanh học tiếp dưới header. Layout và Home chỉ có một nơi render thanh, giữ nguyên API/cache và link mở đúng bài.
- Thanh học tiếp có fade khi xuất hiện, hover/focus nâng 2px, đổi viền/bóng; nút có phản hồi riêng. Animation cuộn chạy trên wrapper để không ghi đè transform hover của thẻ. Reduced motion bỏ chuyển động nhưng giữ dấu focus/phản hồi màu.
- Sơ đồ dùng lại viền tiến độ/đường khóa màu xám nhạt, icon khóa xám và gradient xanh/green của bản trước audit. Không gán màu chữ tối cho mọi stroke hoặc dùng màu nền muted cho icon khóa; có biến riêng cho theme tối. Không đổi tiến độ hoặc quyền mở khóa.

| Chuyển động được đối chiếu                               | Kết quả                                                                                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chữ chạy banner                                          | Khôi phục cả khi đã đăng nhập; trước đó bị return sớm theo isAuthenticated                                                                               |
| Hero, thẻ giới thiệu, FAQ, khóa học và công cụ khi cuộn  | Bỏ guard chặn người đã đăng nhập; giữ GSAP reveal/stagger và cleanup                                                                                     |
| Card học tiếp cũ                                         | Giữ thanh gọn hiện có, phục hồi reveal trên wrapper và thêm hover/focus như yêu cầu                                                                      |
| Vẽ đường, pulse node hiện tại, sequence mở khóa/confetti | Vẫn có trong mã trước lượt này; giữ nguyên, sửa palette khiến chúng hiển thị sai                                                                         |
| Sidebar gooey và nút xóa                                 | Giữ animation đã khôi phục. Nút xóa còn được sửa chuyển hướng animation khi mở lại nhanh, để panel không biến mất và focus vào nút xác nhận khi sẵn sàng |
| Fade màn lỗi bài học                                     | Không bị bỏ: đã chuyển sang LearningError.css, tên learning-error-enter. Không thêm lại keyframes fadeIn toàn cục                                        |
| Spinner/tương tác trang tài liệu                         | Không có animation bị bỏ trong diff; không sửa lại CSS này                                                                                               |
| Mũi tên CTA                                              | Giữ biên độ -1px theo yêu cầu trước, không khôi phục lỗi lùi sâu/co ngang                                                                                |

Đã kiểm bằng test guest/auth, thứ tự banner–tiến độ, h1 và reduced motion; browser API tổng hợp kiểm bản sáng/tối, màu sơ đồ, hover thực tế và màn hình hẹp. Không dùng số đo bundle làm lý do bỏ chuyển động người dùng đã chọn. Bằng chứng: .tmp/ui-motion-restore-20261027/.

JS/CSS ban đầu sau lượt này: **206.963 byte gzip**. Font vẫn tính riêng; bảng dưới dùng production build mới nhất.

## Màu chủ đạo và phạm vi thanh học tiếp — 27/10/2026

- Màu gốc do người dùng chọn: **rgb(56, 98, 152) / #386298**. Token brand-primary giữ đúng màu này; primary/hover/gradient/nền nhạt và ring dùng cùng họ màu. Theme tối dùng tint #abc2df cho phần tử/chữ primary để dễ đọc; admin dùng màu gốc và hover #2d4e7a.
- Đã cập nhật màu chủ đạo viết cứng trong CSS, hằng màu UI/biểu đồ, sidebar/admin, accent của lab và theme-color/manifest. Gradient giữ hai sắc độ. Màu đỏ/lục/vàng biểu thị trạng thái, hình ảnh/logo và toàn bộ animation không bị thay thế.
- Icon đầu trang Cisco CLI trở lại nền navy-50 **#e7e9ef**, nét navy-700 **#152845**, đúng bản trước audit; nền không còn theo primary.
- Trước đây thanh học tiếp xuất hiện ở hầu hết trang sau đăng nhập. Bây giờ **chỉ có trên Home và /roadmap** (mục Khóa học). Công cụ, Lab, Hồ sơ, Tài liệu, chi tiết khóa/bài học và màn thi không hiện thanh, cũng không gọi useLearningPath chỉ để dựng thanh ẩn.
- Theo đính chính của người dùng, thanh có **chiều ngang bằng banner**: width min(1360px, calc(100% - 48px)); dưới 768px dùng min(100% - 28px, 620px) như hero. Giảm padding dọc để chiều cao desktop khoảng 65px, giữ nút cao tối thiểu 44px. Giữ dữ liệu thật, link đúng bài, hover/focus, trạng thái tải/lỗi và reduced motion.

Test allowlist URL (kể cả /roadmap/), query không chạy trên trang ẩn và toàn bộ frontend đều đạt. Tương phản tính trực tiếp: chữ trắng trên #386298 **6.23:1**; chữ tối trên tint primary **10.27:1**. Đây là kiểm cặp màu chính, không phải chứng nhận WCAG toàn trang.

Bằng chứng build/test, danh sách thay màu và ảnh/DOM browser API giả lập: .tmp/ui-brand-20261027/. Lint các file JS liên quan không có lỗi/cảnh báo mới so với bản trước. Không thay backend, lockfile hoặc gọi model.

## Màn học video tham khảo F8 — 27/10/2026

- Đã sửa icon Port còn sót: nền #e7e9ef, nét #152845. Không gắn nền icon này vào primary.
- Video có vùng nền tối rộng, giữ tỉ lệ 16:9 và giới hạn theo chiều cao màn hình. Bỏ thẻ trắng/padding lớn ép player vào giữa hai panel.
- Danh sách bài nằm bên phải, có thể thu gọn; trên điện thoại mở dạng ngăn kéo. Ghi chú mặc định đóng, mở theo yêu cầu bằng Dialog chung có Escape/focus. Giữ autosave, mốc thời gian và bookmark.
- Trước/Tiếp theo nằm ở thanh dưới, độc lập phần nội dung cuộn. Nút disabled giữ opacity 1 và màu chữ muted-foreground; nút mở dùng primary/on-primary. Lý do chưa mở bài tiếp hiện cạnh nút, không chỉ nằm trong tooltip.
- Giữ nguyên điều kiện 70%/hoàn thành và xác nhận lưu bài đọc từ server. Test phát hiện vị trí chèn mốc khi vừa mở lại ghi chú có thể về đầu; đã đặt caret cuối nội dung ở lần mount, không ghi đè vị trí khi đang nhập.
- Điều chỉnh panel theo yêu cầu: tên bài13px, tiêu đề14px, metadata12px; nút nội dung nằm sau Ghi chú trong DOM. Desktop co/trượt/fade hai chiều, giữ DOM để có thể đảo chiều ngay; panel đóng dùng inert/aria-hidden. Drawer có exit opt-in150ms, giữ modal/focus đến khi kết thúc và có fallback/reduced motion.

Nguồn quan sát, giới hạn của REA capture không có tài khoản, đối chiếu mã tĩnh và áp dụng chi tiết: [phân tích UI bài học F8](f8-lesson-ui.md). Browser API tổng hợp kiểm video/player thực, panel phải 320px, các màu nút, ghi chú tự lưu/chèn mốc/Escape; mobile không tràn ngang và hai ngăn kéo hỗ trợ bàn phím. Không ghi dữ liệu học tập thật để kiểm thử.

## Banner networking — 27/10/2026

- Thêm sơ đồ SVG minh họa PC–Switch–Router–Cloud và các packet chuyển động nhẹ. Sơ đồ tự thu gọn trên điện thoại; khi chọn giảm chuyển động, packet đứng yên. Sơ đồ không mô tả kết nối thực.
- Terminal có thanh tiêu đề ba chấm trang trí và màu riêng cho prompt, địa chỉ IP, up/down. Trên màn nhỏ, bản xem trước rút gọn tên cổng để vẫn thấy trạng thái; kết quả lệnh tương tác giữ nguyên tên đầy đủ và vùng cuộn có thể nhận focus bàn phím.
- Badge Luyện thi CCNA liên kết đến /exam/testing-center, không che nút hoặc nội dung terminal. Nút và badge cao tối thiểu 44px. Giữ hiệu ứng chữ, màu thương hiệu, các lệnh minh họa và lazy-load phần CLI tương tác.
- Browser đã kiểm desktop/mobile320px, tương phản màu và bố cục; ảnh chụp trong chế độ giảm chuyển động không thay đổi giữa hai lần cách nhau một giây. Kiểm kỹ thuật này không đại diện cho mọi thiết bị hoặc trình duyệt.
- Đã sửa banner co giãn khi chữ chạy xuống dòng: cỡ chữ tối đa44px desktop/32px mobile, grid chừa chiều cao theo cả bốn câu đầy đủ. Qua90 mẫu ở1536px và90 mẫu ở320px, chiều cao banner và vị trí phần sau không đổi trong lúc gõ/xóa đủ bốn câu. Các lớp đo ẩn nằm ngoài h1 và không được đọc bởi screen reader. Lần sửa này chạy9 test Home đạt, lint/build đạt; không chạy lại toàn bộ frontend vì chỉ thay bố cục tiêu đề.

## Ẩn thanh học tiếp cho tài khoản mới — 27/10/2026

- Chỉ hiện thanh khi ít nhất một khóa có `isStarted`, `completed` hoặc phần trăm lớn hơn 0 từ backend. Tài khoản mới chưa học và lần tải đầu chưa có dữ liệu không hiện thanh 0%.
- Vẫn hiện khi đã bắt đầu nhưng phần trăm làm tròn về 0%, hoặc đã xong khóa trước và chuẩn bị học khóa tiếp theo. Không đổi cách tính tiến độ, API hay animation.
- Test dùng query cache thật kiểm cả trạng thái ẩn và việc thanh xuất hiện sau khi dữ liệu học được cập nhật. Toàn bộ frontend hiện có **33 bộ, 269 test đạt**, có kiểm trường hợp tài khoản mới.

## 1. Hiệu năng đã thay đổi thế nào?

| JavaScript/CSS tải ban đầu, gzip | Trước khi sửa |    Sau đợt 1 |         Hiện tại |
| -------------------------------- | ------------: | -----------: | ---------------: |
| JavaScript                       |  625.157 byte | 189.758 byte | **192.885 byte** |
| CSS                              |   60.874 byte |  13.128 byte |  **16.136 byte** |
| Tổng                             |  686.031 byte | 202.886 byte | **209.021 byte** |
| Số chunk webpack                 |             2 |           27 |               27 |

Tổng JS/CSS ban đầu giảm **69,5%** so với bản trước audit; tăng **3,0%** so với đợt 1. Motion được giữ để chạy đúng animation sidebar cũ theo yêu cầu.

Đo bằng production build, Node 24.12.0, không source map, cùng biến public tổng hợp, cùng cách gzip của Node. Chỉ cộng các file JS/CSS trong entrypoints của manifest. **Đây là mức giảm byte, không phải phần trăm tăng tốc trang hoặc điểm Lighthouse.** Không cộng ảnh, request API và dịch vụ bên ngoài vào bảng này.

### Các thay đổi về tải tài nguyên

| Mục tiêu                    | Đã làm                                                                                                                                  | Kiểm chứng                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Tách code/CSS theo trang    | Các route dùng React.lazy; admin có entry riêng; CSS nằm ở module sử dụng. Trang chủ vẫn tải trực tiếp.                                 | Build/module graph xác nhận entry ban đầu không chứa trang/layout admin hoặc xterm; guard kiểm quyền và Motion cho sidebar vẫn cần tải. |
| Trạng thái chờ và lỗi chunk | Chỉ thay phần nội dung khi chờ; giữ header/điều hướng. Có tải lại và đường về trang chủ khi tải chunk lỗi.                              | Test Suspense, boundary và quyền truy cập đạt.                                                                                          |
| Không chặn trang công khai  | Khôi phục phiên từ localStorage ngay lúc khởi tạo; bỏ loader chặn cả App. Guard vẫn chờ xác định phiên.                                 | Test phiên hợp lệ, hết hạn và storage bị chặn; không gọi backend trong bước khởi tạo này.                                               |
| YouTube                     | Bỏ script iframe_api khỏi index.html; player chỉ tải khi mở bài video.                                                                  | Đã phát video thật ở production local, quan sát thời gian/tiến độ tăng.                                                                 |
| Font/icon thừa              | Bỏ Inter và hai icon font Google. Be Vietnam Pro đã được áp dụng thực sự theo yêu cầu tham khảo F8.                                     | Không còn import Google icon font; 109 vị trí Round chuyển sang SVG Lucide.                                                             |
| Dependency                  | Giữ Motion 13.2.0 cho sidebar cũ; bỏ react-player, tailwind-merge, Tailwind trực tiếp không dùng và components.json trỏ cấu hình thiếu. | Kiểm import, build và lockfile. Giữ react-youtube cho video; GSAP còn dùng ở home/lab/admin.                                            |

Không kết luận loader cũ chờ backend “thức dậy”: AuthContext chỉ kiểm phiên lưu tại máy. Backend chậm vẫn có thể ảnh hưởng dữ liệu của từng trang và cần đo riêng.

### Ảnh

| Ảnh                   |        Trước |        Sau WebP |
| --------------------- | -----------: | --------------: |
| Nền đăng nhập login1  | 391.455 byte |     31.342 byte |
| Minh họa báo lỗi fix1 | 295.955 byte |     13.894 byte |
| Tổng                  | 687.410 byte | **45.236 byte** |

Đã xem lại hai ảnh sau chuyển đổi; giữ kích thước 512 × 512 và nội dung. Thay import rồi bỏ PNG cũ. Bốn ảnh A1/A2/A4/A5 cùng barrel export không có nơi dùng đã được bỏ khỏi source sau khi kiểm tham chiếu và lưu bản đối chiếu local.

Ảnh trong các trang học viên đã có kích thước/tỷ lệ giữ chỗ; ảnh danh sách và phần dưới trang dùng lazy loading. Ảnh/diagram từ API được giữ tỷ lệ hiển thị bằng CSS, không cắt nội dung quan trọng. Logo đã có aspect-ratio từ trước, không coi thiếu width/height cũ là bằng chứng duy nhất về CLS.

Xóa ảnh không được tải giúp dọn source; **không suy ra dung lượng clone Git giảm tương ứng** và không viết lại lịch sử Git.

## 2. Các lỗi thao tác đã sửa

| Vấn đề cũ                                | Hành vi hiện tại                                                                                      | Bằng chứng                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Hồ sơ trắng khi API lỗi                  | Có thông báo và nút Thử lại. Lỗi biểu đồ có nút thử lại riêng, không xóa phần hồ sơ đã tải.           | Unit test và browser với API lỗi một lần rồi thành công.                             |
| Khóa học tràn ngang ở 375px              | Tiêu đề học phần có min-width:0; số bài/badge xuống hàng riêng; tên bài dài được xuống dòng.          | Browser ở 375/768/1024/1440px không thấy tràn ngang toàn trang trong dữ liệu đã thử. |
| Kết quả tìm kiếm chỉ bấm chuột được      | Kết quả là Link; Tab đi vào kết quả, Enter mở bài, Escape đóng danh sách.                             | Browser: nhập IPv4 → Tab qua nút xóa → kết quả đầu → Enter mở đúng lesson.           |
| Học phần/nhóm đề chỉ có onClick trên div | Header là button với aria-expanded/aria-controls; bài học là Link.                                    | Test CourseDetail; browser mở/đóng nhóm đề bằng Space/Enter.                         |
| Nhãn VLSM và tìm kiếm thiếu liên kết     | Nhãn nối bằng id/htmlFor; mỗi dòng VLSM có tên riêng; nút xóa có tên; lỗi nối với trường nhập.        | Test thêm/xóa dòng, giữ IP sai để sửa; kiểm combobox và tên input.                   |
| Công tắc Port không có tên               | Checkbox và nhãn cùng tham chiếu một id, có tên Chế độ học tập.                                       | Kiểm source/form; tên vẫn tồn tại sau thao tác.                                      |
| Modal lịch sử thi thiếu focus/Escape     | Dùng dialog native có tên, focus ban đầu, giữ Tab và trả focus khi đóng.                              | Unit test và browser: Shift+Tab nằm trong dialog, Escape trả về nút mở.              |
| Xác nhận nộp bài chưa có semantics modal | Dùng cùng Dialog; chặn nộp lặp khi đang gửi; giữ hành vi lưu nháp/thử lại.                            | Test lỗi mạng khi nộp rồi nộp lại cùng attempt.                                      |
| Đóng/phóng sơ đồ lab thiếu bàn phím      | Nút đóng và phóng ảnh là button; hướng dẫn/ảnh phóng là dialog; Escape đóng từng lớp.                 | Browser mở ảnh bằng Enter, đóng bằng Escape.                                         |
| Animation nút xóa bị mất sau audit       | Khôi phục animation gốc bằng Motion; giữ focus/Escape, xác nhận hai bước và khóa gọi lặp khi pending. | 7 test; browser tên bài dài, panel đóng/mở, xóa lỗi rồi thử lại bằng API giả lập.    |

Không đổi thuật toán tính subnet/VLSM, chấm điểm, quy tắc mở khóa bài hoặc quyền truy cập để làm UI dễ kiểm hơn.

## 3. Bố cục ưu tiên việc học

| Màn hình               | Thay đổi đã triển khai                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trang chủ đã đăng nhập | Khôi phục hero cả khi đã đăng nhập; thanh học tiếp nằm sau hero, không còn heading dư, liên kết đúng bài tiếp theo.                                                       |
| Bài học dạng đọc       | Ghi chú/nội dung giảng viên nằm trước khối xác nhận đã đọc. Ghi chú cá nhân và giải thích vì sao Tiếp theo bị khóa vẫn giữ.                                               |
| Làm bài thi mobile     | Thanh thời gian/số câu nằm trên câu hỏi, sticky theo header; bản đồ câu hỏi mở khi cần; vẫn có nộp bài sớm. Đáp án và đánh dấu xem lại công bố trạng thái đang chọn.      |
| Workspace lab          | Giảm chiều cao topology mặc định; có Ưu tiên CLI. Khi bật, topology còn 180px và vùng terminal được đưa vào phần nhìn thấy. Mục tiêu/nhiệm vụ vẫn ở cạnh bên trên laptop. |
| Tài liệu               | Phân biệt thư viện chưa có tài liệu với bộ lọc không có kết quả. Có Xóa bộ lọc, lỗi tải và Thử lại. Nút tải có tên tài liệu.                                              |
| Hồ sơ                  | Chỉ hiện số lab đã hoàn thành, bỏ mẫu số 50 chưa được API xác nhận. Biểu đồ có bảng số liệu mở được bằng bàn phím.                                                        |
| Lộ trình/công cụ       | Rút gọn hướng dẫn lặp; hướng dẫn dài của VLSM mở khi cần. Giữ thông báo khóa và nhãn trường nhập.                                                                         |

Đã thao tác workspace tại 1024 × 768 và 1440 × 900. Ở 1024px, bật ưu tiên CLI giữ được vùng terminal khoảng 292px và cuộn nó vào vùng nhìn; đã chọn R1, nhập enable rồi show ip interface brief và nhận kết quả từ engine xem trước. Đây là kiểm UI/simulator local, không phải nghiệm thu nội dung lab độc lập.

## 4. Design system, bàn phím và sáng–tối

- Bộ màu chung nằm ở [theme.css](../../src/frontend/src/styles/theme.css): **16 vai trò màu**, gồm màu chính/chữ trên màu chính, nền/thẻ, chữ/chữ phụ, border, focus và các cặp màu phản hồi. Tên biến cũ được ánh xạ để giữ tương thích.
- Có nút đổi sáng–tối ở header. Mặc định theo hệ thống; lựa chọn của học viên được lưu tại máy. Có khởi tạo theme sớm trong HTML để giảm chớp nền. Lab tiếp tục dùng bộ token scoped riêng; admin giữ giao diện hiện có.
- Đã sửa các cặp chữ/nền và trạng thái được phát hiện trên Tools, CourseDetail, Profile, nút thi, nhãn TCP, hero và auth. Kiểm cả hai màu của một cặp; bề mặt terminal/hero tối dùng chữ sáng riêng.
- Thêm Bỏ qua điều hướng, title/description theo route, focus vào heading khi chuyển màn. Không giật focus lúc chỉ nhập tìm kiếm hoặc đổi bộ lọc.
- Icon SVG qua wrapper Lucide; icon trang trí ẩn khỏi tên điều khiển. Nút chỉ có icon được đặt tên theo hành động.
- Chuyển động nhỏ dùng CSS; banner có lại hiệu ứng gõ/xóa cũ và sidebar dùng spring của Motion. Home theo dõi prefers-reduced-motion, các component giữ chế độ giảm chuyển động.
- Mốc bố cục chung: **480, 768, 1024, 1280px**; 1023/1279 là nửa dưới cặp min/max. Giữ ngoại lệ 380px cho header hẹp và các mốc riêng của topology/workspace ở Labs.css/LabWorkspace.css. Không ép terminal vào breakpoint của thẻ nội dung.
- Không còn transition:all trong 33 file CSS học viên được quét. Còn 68 !important, gồm các rule focus/reduced motion và override cũ cần giữ; không xóa cơ học để đạt số lượng bằng 0.
- Đã giới hạn 632 selector của hồ sơ, công cụ, tài liệu và bài thi trong trang sở hữu. Bỏ khai báo biến chung lặp ở Exam.css để việc mở bài thi không đổi nền các trang khác. Đã kiểm điều hướng nhiều trang trong cùng phiên, giữ CSS đã tải.

Kiểm tương phản dùng màu đã render và các cặp token, không chỉ đếm hex trong source. Bộ quét DOM local chỉ hỗ trợ tìm chỗ cần xem: không tự kết luận với gradient, ảnh nền, alpha, trạng thái disabled hoặc màu đang chuyển tiếp. Ví dụ nhãn xem trước khóa học được kiểm với lớp nền tối phía sau, thay vì coi thẻ bên dưới là nền chữ.

Chưa thực hiện một đánh giá tuân thủ WCAG đầy đủ hoặc kiểm bằng screen reader thật; không dùng số aria-* và số rule focus để thay cho nghiệm thu đó.

## 5. Thương hiệu, URL và hero terminal

Tên hiển thị thống nhất là **NetMaster**, theo chữ trên logo hiện có. Đã sửa title, manifest, auth, footer và README. Tên repo/package kỹ thuật giữ nguyên.

Đã chuyển sang **BrowserRouter**. Link cũ dạng /#/lesson?... và /#/reset-password/... được đổi sang URL mới trước khi render; giữ query và không đổi các anchor thông thường như #main-content. Trong app đang mở, link hash cũ cũng được xử lý.

Backend tạo link đặt lại mật khẩu mới bằng helper [frontendLinks.js](../../src/backend/src/auth/frontendLinks.js). Helper xử lý cả FRONTEND_URL cũ có hash và base path con; có test riêng. Không gửi email hoặc đổi mật khẩu thật trong lượt UI này.

Host production phải trả index.html cho đường dẫn của ứng dụng. Vercel đã có rewrite; server kiểm thử local cũng dùng cùng kiểu fallback. Đã mở trực tiếp và tải lại URL con, kiểm link reset cũ/mới bằng browser; Back/Forward có test BrowserRouter với history traversal. Không coi thay router là bằng chứng đủ về SEO hoặc tốc độ.

Hero cho khách có terminal nhỏ, chỉ tải module khi bấm Thử CLI. Demo có bốn lệnh minh họa: show ip interface brief, show version, help, clear; dữ liệu tĩnh, giới hạn lịch sử/độ dài nhập. Không tải xterm, không gọi model/API để chạy demo. Học viên đã đăng nhập vẫn được ưu tiên nút học tiếp.

## 6. Đã kiểm tra những gì?

| Kiểm tra                       | Kết quả                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toàn bộ frontend               | **33 bộ test, 269 test đạt**. Gồm lazy route/guard, history, modal, xác nhận xóa, auth khởi tạo, theme, VLSM, khóa học và hồi quy video/thi/tiến độ hiện có. Thêm kiểm CLI minh họa, badge luyện thi, điều hướng ngưỡng 70%/bài đầu-cuối, ghi chú, exit/fallback/reduced motion và rapid toggle/Tab order của panel. |
| Production build               | **0 lỗi, 0 cảnh báo webpack**. Lượt phát hành đã chạy lại build chuẩn; bảng byte ở mục 1 giữ lần đo cùng điều kiện của đợt banner.                                                                                                                                                                                   |
| ESLint file JS/JSX đã thay đổi | **0 lỗi, 0 cảnh báo** trong các file JS/JSX đã thay đổi. Đây là kiểm phạm vi thay đổi, không phải toàn bộ source cũ.                                                                                                                                                                                                 |
| Icon/import boundary           | Đạt: 127 icon export được kiểm đầu ra SVG; 53 nơi import; kiểm ranh giới frontend/backend/agent/shared đạt.                                                                                                                                                                                                          |
| Link email mới                 | Test Node thuần đạt cho URL gốc, hash cũ, dấu / cuối và base path con; đã đưa vào test:core để CI chạy.                                                                                                                                                                                                              |
| Browser production local       | Đã kiểm các route chính ở 375 × 812, 768 × 1024, 1024 × 768, 1440 × 900; kiểm trạng thái sáng/tối, tìm kiếm, accordion, lỗi/thử lại và modal.                                                                                                                                                                        |
| Video thật                     | Player tải iframe khi mở bài, đã phát và quan sát khoảng 2:25/22:23, tiến độ 11%; request tiến độ đi vào API tổng hợp. Không tự nhận đã lưu với backend thật.                                                                                                                                                        |
| Lab                            | Preview engine thật với topology/tài khoản tổng hợp, hai theme và nút ưu tiên CLI; không tạo attempt trong database.                                                                                                                                                                                                 |
| Phạm vi thay đổi               | Lượt phát hành rà 210 file, chia riêng agent/UI/tài liệu. Không đưa .env, .tmp, cache hay thay đổi .gitignore vào commit; hash .env/.gitignore/sổ chi phí giữ nguyên. Không gọi model hoặc deploy thủ công.                                                                                                          |

Số lượng test và byte ở trên là kết quả local, không phải kết quả CI trên GitHub hoặc hiệu năng của hệ thống đã deploy.

## 7. Phần nghiệm thu cần môi trường thật

Các mục triển khai trong audit đã được xử lý. Những việc dưới đây là **nghiệm thu vận hành**, chưa được thay thế bằng fixture:

- Google OAuth, email reset và đổi mật khẩu với dịch vụ thật; lưu tiến độ/ghi chú, nộp bài và lưu điểm với backend/database thật.
- Trình duyệt mục tiêu khác, điện thoại thật, bàn phím ảo, zoom trình duyệt 200% và screen reader. Các viewport local không đủ chứng minh tất cả trường hợp này.
- Lighthouse/Core Web Vitals (LCP/INP/CLS) và mạng/thiết bị lớp học. Chưa có số đo phù hợp để công bố lợi ích thời gian hoặc điểm số.
- Đánh giá CCNA độc lập, tải dữ liệu lớn và pilot nhiều học viên. Phần UI của trợ lý AI R1 thuộc backlog AI riêng, không được đánh dấu hoàn thành bởi lượt sửa UI này.

Không đưa các bước nghiệm thu này thành tính năng giả trong sản phẩm và không dùng tài khoản/model thật chỉ để làm số kiểm thử đẹp hơn.

## 8. Bằng chứng và cách bảo trì

Lần cập nhật font/thanh học tiếp: .tmp/ui-f8-20261027/ có bằng chứng REA, computed style công khai, build/test, manifest, đo byte và kiểm phạm vi file. Đợt khôi phục hiệu ứng: .tmp/ui-restore-effects-20261027/. Mã kiểm, build, manifest, module graph, log API tổng hợp, quan sát DOM và ảnh local của audit đầy đủ nằm trong .tmp/ui-complete-20261027/. Hai bộ trước nằm trong .tmp/ui-performance-20261027/ và .tmp/ui-ux-audit-20261027/. Các thư mục này đang ignore nên không có trong checkout mới; kết quả quan trọng đã ghi bằng chữ ở tài liệu này.

Hướng dẫn phát triển tiếp: [student-ui-guidelines.md](student-ui-guidelines.md). Đợt này áp dụng [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/28b3b8dee8c976df4fa3e94aed4e092ad43fcb03) cho React/CSS sẵn có và transitions-dev cho các điều khiển CSS. Skill không được đưa vào bundle hay prompt của model CCNA.
