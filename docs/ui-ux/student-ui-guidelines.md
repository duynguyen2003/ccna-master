# Dùng UI UX Pro Max cho giao diện học viên

Tài liệu này hướng dẫn sửa UI trên hệ React/CSS hiện có. Danh sách công việc và bằng chứng nằm ở [báo cáo rà soát](student-ui-audit.md).

## Nền tảng đã triển khai ngày 27/10/2026

- Thương hiệu hiển thị là **NetMaster**. Stack là React 18, CSS theo component, SVG Lucide qua wrapper; video dùng react-youtube. Motion 13.2.0 được giữ cho animation sidebar cũ theo yêu cầu; react-player, tailwind-merge và Tailwind trực tiếp không còn dùng.
- Route mới dùng React.lazy/RouteContent và import CSS tại module sở hữu. Home tải trực tiếp; admin có entry riêng. Giữ trạng thái tải/lỗi và guard trước khi tải module cần quyền.
- Font học viên là **Be Vietnam Pro** (400–900, display=swap, có fallback hệ thống), đã đối chiếu F8 bằng REA và computed style. Dùng var(--system-ui); giữ monospace cho CLI/code và không đổi font admin. Không thêm lại icon font Google hoặc Inter.
- Banner Home giữ typewriter, dùng topology SVG và terminal minh họa trên nền tối; mobile có bản sơ đồ/cổng rút gọn. Giữ Thử CLI lazy-load, trạng thái có chữ bên cạnh màu, kết quả dài cuộn ngang bằng bàn phím và badge đến trang thi thử. Packet dừng khi bật giảm chuyển động.
- Tiêu đề typewriter chừa chỗ bằng các câu đo ẩn trong cùng ô grid, giữ ngoài h1/aria-hidden. Khi đổi câu, font hoặc breakpoint, kiểm chiều cao qua cả chu kỳ để không đẩy nội dung bên dưới; không đặt chiều cao cứng rồi cắt chữ.
- Thanh học tiếp dùng LearningResumeBanner/useLearningPath và cache chung theo user. Home đặt thanh sau hero; Layout chỉ đặt dưới header ở /roadmap, không render hai lần. Ẩn trên các route khác. Chiều ngang bằng hero (tối đa 1360px; cùng gutter/breakpoint), căn giữa; chiều cao desktop khoảng 65px, nút tối thiểu 44px. Hover/focus nâng nhẹ và đổ bóng; animation cuộn thuộc wrapper để không ghi đè transform hover. Lấy phần trăm/quyền truy cập/nextLessonId/streak từ API; không tạo bộ tính tiến độ thứ hai. Link phải chứa cả course và lesson; bài tiếp không hợp lệ thì về khóa học. Xem [phân tích F8 và ánh xạ dữ liệu](f8-typography-progress.md).
- Màu chủ đạo là **rgb(56,98,152) / #386298**. Dùng brand-primary và nhóm token primary/hover/gradient/tint; theme tối dùng tint cùng họ màu cho độ tương phản. Không thêm lại blue #2563eb/#3b82f6 vào nút/viền/link mới. Màu trạng thái vẫn có vai trò riêng.
- Trang bài học ưu tiên video rộng và danh sách bài bên phải; điều hướng ở thanh dưới, ghi chú mở khi cần. Dùng Dialog chung cho ngăn kéo ghi chú và nội dung chương trên mobile. Giữ vùng bấm và cặp màu rõ chữ ngay cả khi nút bị khóa; không bỏ điều kiện 70%/xác nhận hoàn thành để sửa hình thức. Xem [phân tích F8 và thay đổi màn học](f8-lesson-ui.md).
- Bộ màu chung nằm ở [theme.css](../../src/frontend/src/styles/theme.css), có 16 vai trò và hai theme. Dùng primary/on-primary, foreground/surface và các cặp màu phản hồi cùng nhau. ThemeProvider theo hệ thống hoặc lựa chọn đã lưu; lab giữ token scoped, admin giữ theme hiện có.
- Tái dùng [Dialog](../../src/frontend/src/components/ui/Dialog.jsx), DropdownSelect, StatusAlert và Toast. Giữ tên dialog, Tab/Escape và trả focus. Portal cần class phạm vi nếu dùng CSS của tính năng, như exam-dialog.
- Selector của trang phải có phạm vi sở hữu, ví dụ :where(.profile-page), :where(.doc-container). Không tạo .container/.btn/.filter-btn toàn cục trong CSS lazy; không khai báo lại biến chung trong :root của trang. Kiểm điều hướng nhiều trang trong cùng phiên khi CSS cũ còn được giữ.
- Mốc chung là 480/768/1024/1280px. Giữ ngoại lệ 380px cho header và các mốc topology/workspace có lý do riêng. Kiểm min-width:0, flex-wrap và minmax(0,1fr) trước khi thêm breakpoint.
- Chỉ transition thuộc tính cần đổi; không dùng transition:all. Giữ các override focus/reduced motion cần thiết và kiểm thay đổi tùy chọn hệ thống lúc đang mở trang.
- BrowserRouter cần host có SPA fallback. Giữ nâng cấp link hash cũ, query, anchor thường và helper tạo link email frontendLinks. Route mới cần title/description, heading và focus phù hợp. Không giật focus khi chỉ nhập tìm kiếm hoặc đổi bộ lọc.
- Ảnh API chưa biết kích thước cần khung tỷ lệ ổn định/object-fit phù hợp; không cắt sơ đồ. Lazy-load phần dưới trang và kiểm lại nội dung sau đổi WebP. Không suy ra CLS hoặc dung lượng clone Git chỉ từ số thuộc tính ảnh/file đã xóa.

Các con số nghiệm thu hiện tại và phần cần kiểm với backend/thiết bị thật được ghi trong audit; không dùng fixture thay cho các bước đó.

## Giữ hiệu ứng đã được người dùng chọn

Banner dùng lại typewriter với các câu cũ cho cả khách và người đã đăng nhập; giữ reveal/stagger khi cuộn ở cả hai trạng thái. Sidebar giữ animation gooey/spring. DeleteButton giữ animation mở nắp/co thân/trượt khay xác nhận bằng Motion đã có; không thay bằng nút tĩnh chỉ để giảm bundle. Không tự bỏ các hiệu ứng này trong lần tối ưu tiếp theo. Khi giảm chuyển động được bật, hiện đầy đủ tiêu đề và dừng animation. Mũi tên CTA chỉ dịch -1px và không co ngang để giữ khoảng cách với chữ. Hàng chứa tên dài và nút xóa cần min-width:0/flex:1 cho tên, flex-shrink:0 cho điều khiển; kiểm cả lúc khay xác nhận mở. Callback xóa phải trả promise lỗi để UI không báo thành công giả.

Thẻ CLI có selector riêng .landing-hero__journey.hero-terminal-card để nền tối không bị style thẻ chung ghi đè. Header search dùng nền trung tính, không có viền thường trực; focus bàn phím vẫn phải nhận biết được.

Sơ đồ lộ trình dùng palette riêng cho stroke, icon khóa và gradient; không thay mọi màu vẽ bằng màu foreground/muted chung. Giữ vẽ đường, pulse, mở khóa/confetti; kiểm cả theme tối. Fade lỗi học tập đã dùng chung LearningError.css, không thêm lại keyframes toàn cục.

## Skill nằm ở đâu?

Đã dùng skill `skill-installer` để cài [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/28b3b8dee8c976df4fa3e94aed4e092ad43fcb03), thư mục nguồn `.claude/skills/ui-ux-pro-max`, commit `28b3b8dee8c976df4fa3e94aed4e092ad43fcb03`.

Trên máy hiện tại: `C:/Users/duyxt/.codex/skills/ui-ux-pro-max/SKILL.md`. Codex có thể nhận diện skill ở lượt tiếp theo. Lượt audit này đã đọc hướng dẫn và chạy script trực tiếp.

Skill phục vụ công việc thiết kế/review của agent. Không cần thêm nó vào bundle frontend, requirements của Python service hoặc system prompt của model dạy CCNA. Dự án chưa có dependency mới do việc cài skill này.

Máy khác cần cài skill riêng; repo dự án chỉ giữ các quyết định và báo cáo có ích. Khi nâng phiên bản skill, kiểm lại nguồn và hướng dẫn trước khi dùng.

## Định hướng cho sản phẩm

- Đối tượng là người học CCNA, thường cần đọc kiến thức, thao tác CLI và theo dõi tiến độ.
- Mỗi màn có một hành động chính rõ: học tiếp, tính toán, bắt đầu làm bài hoặc hoàn thành nhiệm vụ.
- Nội dung học và việc đang làm xuất hiện trước phần giới thiệu, lời quảng bá và giải thích dài.
- Trang chủ, công cụ, bài học và workspace lab có nhu cầu bố cục khác nhau. Giữ chung màu vai trò, font, focus và cách phản hồi.
- Giữ mô phỏng, tiến độ, quyền truy cập và dữ liệu do hệ thống cấp. Chỉnh trình bày không được tự đổi trạng thái nghiệp vụ.

## Dùng hệ giao diện đang có

| Thành phần  | Hiện có                                                              | Cách cải thiện khi sửa                                                                                               |
| ----------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Màu chính   | Xanh ở `App.css`, gồm `--blue-primary` và các tên vai trò khác       | Ưu tiên token trong scope đang sửa; kiểm các biến trùng rồi gom dần                                                  |
| Chữ         | HTML đã tải Be Vietnam Pro/Inter; body toàn cục vẫn dùng system font | Chọn một font thân bài phù hợp tiếng Việt, áp dụng có kiểm tra xuống dòng; monospace cho CLI/IP cần căn cột          |
| Nền và thẻ  | Token ngữ nghĩa cho cả sáng/tối, thẻ có border                       | Giữ phân cấp bằng khoảng cách/cỡ chữ, kiểm cả hai theme                                                              |
| Icon        | SVG Lucide qua wrapper/AppIcon; không còn icon font                  | Icon trang trí có aria-hidden, nút icon có tên hành động                                                             |
| Sáng/tối    | ThemeProvider toàn khu học viên; lab có token scoped riêng           | Đo chữ, biểu đồ, form và focus trong từng theme                                                                      |
| Trạng thái  | Loading, toast, khóa bài, nhãn tiến độ ở nhiều màn                   | Chuẩn hóa theo hành vi: đang tải, rỗng, lỗi có thể thử lại, thành công; không dùng cùng thông báo cho mọi trường hợp |
| Chuyển động | GSAP/CSS và reduced motion đã có ở một số phần                       | Chuyển động giải thích thay đổi trạng thái; kiểm reduced motion trước khi thêm hiệu ứng                              |

Không tạo thêm một theme song song chỉ vì kết quả tìm kiếm đưa ra palette mới. React hiện tại là 18.3.1; tài liệu tìm kiếm cho React 19 cần được kiểm tính tương thích từng hướng dẫn.

## Tìm hướng dẫn đúng vấn đề

Chạy script bằng đường dẫn tuyệt đối của skill. Ví dụ PowerShell dưới đây dùng Python đã có trong repo, không cài thêm thư viện:

```powershell
$uiSkillSearch = Join-Path $env:USERPROFILE '.codex/skills/ui-ux-pro-max/scripts/search.py'
$uiPython = '.\src\agent\python\.venv\Scripts\python.exe'
& $uiPython $uiSkillSearch 'keyboard focus modal' --domain ux -n 3 --json
& $uiPython $uiSkillSearch 'LMS technical certification dashboard' --design-system -p 'NetMaster Student' --json
```

Thay đường dẫn Python nếu môi trường local khác. Truy vấn chỉ chứa loại sản phẩm hoặc vấn đề chung; không gửi dữ liệu học viên, token hay nội dung `.env`.

1. Đọc component/CSS và xác định lỗi hoặc mục tiêu cụ thể.
2. Chọn truy vấn ngắn đúng mục tiêu: bàn phím, form, mobile hay độ tương phản.
3. Kiểm kết quả có đúng web, đúng đối tượng và đúng stack không. Nếu lệch hoặc rỗng, thử lại một lần bằng truy vấn hẹp hơn.
4. Chọn phần phù hợp với giao diện đang có. Không biến kết quả tìm kiếm thành yêu cầu bắt buộc.
5. Thực hiện một nhóm thay đổi có thể kiểm riêng; ghi kết quả và phần chưa kiểm.

Lượt audit đầu tiên đã loại gợi ý font cho trẻ em. Kết quả phù hợp hơn là LMS với phân cấp nội dung gọn; chưa chép palette, font hoặc bố cục landing vào ứng dụng. Không dùng `--persist` để tạo một bộ design system chưa được đối chiếu.

## Kiểm trước khi hoàn thành một đợt sửa

- Đường đi chính vẫn hoạt động: vào khóa học → mở bài → ghi chú/xác nhận → sang bài tiếp theo theo quyền hiện có.
- Có trạng thái tải, dữ liệu rỗng và lỗi mạng phù hợp. Nút thử lại dùng được và không làm mất dữ liệu đang nhập.
- Tab/Shift+Tab tới được mọi hành động; Enter/Space dùng được theo loại điều khiển. Focus nhìn thấy, dialog đóng bằng Escape và trả focus về nơi mở.
- Kiểm 375, 768, 1024 và 1440px theo màn bị ảnh hưởng; tên dài, chữ Việt, zoom 200%, bàn phím ảo và thanh điều hướng cố định không che nội dung.
- Không tràn ngang toàn trang. Sơ đồ mạng hoặc bảng rộng có thể có vùng cuộn riêng, nhận biết và dùng được bằng bàn phím.
- Nhãn form vẫn tồn tại sau khi nhập; nhãn/lỗi gắn với input. Mỗi dòng dữ liệu lặp có tên phân biệt được.
- Đo tương phản chữ thường với nền: tối thiểu 4.5:1; chữ lớn 3:1 theo các điều kiện của W3C. Kiểm light/dark riêng, không đánh giá bằng cảm giác hoặc màu screenshot.
- Với web, kiểm mục tiêu 24 × 24 CSS px hoặc ngoại lệ/khoảng cách hợp lệ. Có thể chọn vùng bấm 44px cho tiện dùng cảm ứng; không nhầm thành quy định bắt buộc cho mọi link web.
- Chạy kiểm tra phù hợp phần thay đổi. Sửa docs không cần chạy lại backend; sửa semantics/luồng cần kiểm tương tác; sửa cách tải tài nguyên cần đo trước/sau.
- Khi cần xem UI bằng fixture, giữ API/auth giả trong harness riêng; không thêm đường bỏ qua đăng nhập vào sản phẩm.

Tham chiếu: [W3C Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html), [W3C Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
