# Home: mô phỏng giao thức và Trợ lý AI

Ngày nghiệm thu: 15/11/2026. Triển khai trực tiếp trên Home React hiện có.

Cập nhật16/11: avatar ở Home và trang AI dùng chế độ `greeting` để quay/nhún
dễ thấy hơn; mặc định lab/chat giữ nhẹ. Bấm avatar trên mobile giữ nguyên
vị trí cuộn khi focus lời chào. Đã kiểm4suite/50test và build; xem
[ảnh động từ64 khung canvas thật](evidence/avatar-motion/avatar-greeting.gif)
và [QA](evidence/avatar-motion/checks.json). Reduced-motion và pause ngoài
viewport vẫn hoạt động; không dùng trạng thái working để giả chuyển động.

## Kết quả

Phần đầu Home trình chiếu hành trình **mở một trang web bằng HTTP**, dùng chính dữ liệu bài học và bộ phát hiện có. Người học thấy thiết bị, gói tin DNS/TCP/HTTP, hướng truyền, giai đoạn và giải thích ngay khi vào trang. Có phát/tạm dừng, tiến/lùi, về đầu, chọn giai đoạn và đường vào thư viện đầy đủ.

Tab **Thử CLI** giữ terminal thực hành cũ. Chuyển tab không mất câu lệnh đang soạn, kết quả terminal hoặc sự kiện demo. Typewriter, nội dung lộ trình/khóa học và banner học tiếp của tài khoản đã đăng nhập vẫn được giữ.

Khối **Trợ lý AI trong từng bài lab** có avatar droid, ba khả năng chính và nút vào trang giới thiệu `/ai-assistant`. Trang này hướng dẫn chọn bài lab để sử dụng AI. Câu giải thích DNS trên Home được ghi rõ là ví dụ; Home không gửi yêu cầu AI hoặc giả trạng thái đang trả lời. Avatar dùng public browser entry hiện có, không thêm thư viện.

Catalog thực tế hiện có **39 giao thức / 39 kịch bản**, tổng 231 giai đoạn và 694 sự kiện. Số trên Home lấy từ catalog, không ghi cứng 34 hoặc 39. Demo HTTP có 5 giai đoạn, 13 sự kiện.

## Thiết kế Google Stitch

Đã gọi Google Stitch tạo thiết kế theo brief, tải và xem cả ảnh lẫn HTML:

- [Project NetMaster Home](https://stitch.withgoogle.com/projects/2285210275756823623), screen `8a7bf3e432e542ed80fdf5cb402de21f`.
- [Ảnh concept gốc](evidence/home-simulation-ai/stitch-concept.png).
- Áp dụng hero hai cột, ưu tiên diện tích demo, tab Mô phỏng/CLI và AI spotlight bên dưới. Dùng token màu, font, header/footer và component NetMaster sẵn có.
- Không dùng các trường IP/cổng/VLAN/ASN hoặc tổng khóa học/lab do bản thiết kế sinh ra. Mọi sự kiện hiển thị lấy từ bài HTTP thật; chỉ điều chỉnh bố trí SVG cho bản xem trước.
- Đề xuất tiếp của Stitch gồm terminal CLI, mobile và packet inspector: CLI/mobile đã triển khai; thông tin gói tin đầy đủ nằm trong trang mô phỏng chính. Văn bản đề xuất nguyên gốc được lưu trong [checks.json](evidence/home-simulation-ai/checks.json), phần `stitch`, để phân biệt concept với hành vi đã triển khai.

## Các file thay đổi

Đường dẫn trong bảng tính từ `src/frontend/src/`.

| File                                                    | Thay đổi                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `features/home/pages/Home.js`                           | Hero, CTA, số lượng từ catalog, gắn demo và AI spotlight; giữ CLI và nội dung học cũ.               |
| `features/home/components/HeroNetworkShowcase.jsx`      | Tab, giữ pane mounted, lazy-load HTTP/renderer, trạng thái tải/lỗi/thử lại, theo dõi visibility.    |
| `features/home/components/HomeProtocolDemo.jsx`         | Adapter/renderer/playback có sẵn, điều khiển và giai đoạn, autoplay một lần, không ghi tiến độ học. |
| `features/home/components/HomeAiSpotlight.jsx`          | Giới thiệu AI, avatar từ entry hiện có, ví dụ và CTA lab.                                           |
| `features/home/components/HomeShowcase.css`             | Bố cục responsive, light/dark, focus và kích thước điều khiển.                                      |
| `features/protocols/components/LessonNetworkView.jsx`   | Thêm prop bố trí SVG tùy chọn; mặc định trang mô phỏng giữ nguyên.                                  |
| `features/home/pages/Home.test.jsx`                     | Guest/auth, CTA, số lượng và giữ trạng thái CLI.                                                    |
| `features/home/components/HeroNetworkShowcase.test.jsx` | Lazy-load, retry, giữ pane và pause theo tỷ lệ hiển thị.                                            |
| `features/home/components/HomeProtocolDemo.test.jsx`    | HTTP 13 sự kiện, giai đoạn, replay, visibility/reduced-motion và React StrictMode.                  |

## Hành vi và giới hạn bố cục

Desktop dành khoảng 60% hero cho demo. Sau đợt thu gọn theo góp ý, hero cao khoảng 560 px tại1366×768 (trước đó606 px), tiêu đề tối đa30 px và22 px trên mobile; reserve của typewriter dùng cùng thông số để giữ bố cục. Sơ đồ dùng vị trí thiết bị phù hợp khung ngang, giữ đường truyền, endpoint và thời gian của dữ liệu gốc. Trên mobile, demo đứng trước các CTA để người học sớm thấy mạng đang hoạt động; nút điều khiển và giai đoạn cao 44 px. Chú thích dài có vùng cuộn giới hạn.

Demo tự phát một lần khi đủ diện tích hiện trên màn hình. Dừng khi đổi sang CLI, cuộn ra ngoài vùng nhìn thấy hoặc document bị ẩn. Khi quay lại, giữ sự kiện và trạng thái tạm dừng. Với giảm chuyển động, không tự phát và vẫn dùng được tiến/lùi/chọn giai đoạn. Autoplay dùng RAF có cleanup để chạy đúng trong React StrictMode.

Home cho khách xem demo công khai. Trang `/protocols` vẫn dùng guard đăng nhập hiện có: khách đi qua trang đăng nhập, tài khoản USER vào thư viện. CTA AI mở `/ai-assistant` công khai, từ đó có nút vào thư viện lab hoặc lộ trình. Trợ lý trong bài lab giữ hành vi như trước.

## Kiểm tra nền mô phỏng trước đợt thu gọn

- **7 suite / 32 test đạt**: Home, HeroNetworkShowcase, HomeProtocolDemo, HeroTerminal, ProtocolLessonPlayer, lessonObservation và useObservationPlayback.
- ESLint, Prettier, `git diff --check` đạt. Boundary checker xác minh 2261 imports/assets trong 531 source files. Protocol checker xác minh 39/231/694 và provenance.
- `CI=true pnpm build`: **Compiled successfully**.
- Browser phát HTTP từ đầu đến **13/13**, replay về **1/13**; lấy mẫu 2421 khung hình không phát hiện thẻ gói tin vượt canvas. Chiều cao hero desktop giữ 606 px trong lần phát.
- Giữ sự kiện khi đổi tab; terminal chạy `show ip interface brief`, còn nguyên kết quả và draft `show ver`. Không tạo key tiến độ `netmaster:protocol-view:` từ demo.
- Bàn phím: mũi tên đổi tab, focus có viền rõ, Enter điều khiển tiến sự kiện 4/13 → 5/13. Đã kiểm light/dark, reduced-motion, tải/lỗi/thử lại và guest/auth.

| Viewport                     | Kết quả                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| 1920×900, 1366×768, 1024×768 | Năm thiết bị nằm trong canvas, không tràn ngang.                                                    |
| 768×1024                     | Hai khối xếp dọc, giữ đủ thiết bị và điều khiển.                                                    |
| 390×844, 320×740             | Không tràn ngang; sơ đồ co theo khung, nút 44 px. Màn hình 320×740 cần cuộn nhẹ để thấy đáy canvas. |

QA dùng API fixtures và phiên USER giả trong browser; không nghiệm thu provider AI, cơ sở dữ liệu thật hoặc thiết bị cảm ứng vật lý. Pause ngoài viewport được kiểm bằng IntersectionObserver thật. Vì Chromium headless giữ native visibility là `visible`, nhánh document hidden được kiểm bằng visibility event trong fixture rồi khôi phục. Không có page error trong hai context guest/auth. Chưa đo LCP/FPS trên production.

## Ảnh và bằng chứng

- [Home desktop sáng](evidence/home-simulation-ai/home-desktop.png).
- [Home desktop tối](evidence/home-simulation-ai/home-dark.png).
- [Home mobile](evidence/home-simulation-ai/home-mobile.png) — chụp tới hết khối AI với viewport mobile 390×844.
- [Kết quả QA và đề xuất Stitch](evidence/home-simulation-ai/checks.json).

Ảnh sáng và mobile ở trạng thái tạm dừng tại DNS để dễ đọc; mobile dùng reduced-motion. Scratch của phiên kiểm tra được dọn, chỉ giữ bằng chứng cuối. Dev server 3000 được giữ để xem lại.

## Cập nhật banner và trang giới thiệu AI — 15/11/2026

Nút **Thực hành cùng AI** hiện mở `/ai-assistant`. Avatar droid đứng cạnh khung lời chào: AI đang hỗ trợ trong bài lab, còn không gian trò chuyện riêng đang phát triển. Có ba đường đi rõ ràng: chọn bài lab, xem lộ trình học hoặc về Home. Bấm avatar bằng chuột/Enter đưa focus tới lời chào; avatar chỉ idle/interactive, không giả trạng thái xử lý.

Giao diện AI nằm trong `src/agent/browser/components/AiAssistantIntro.jsx` và `styles/AiAssistantIntro.css`, xuất qua `intro.js` / `@ccna/agent-ui/intro` trong package.json. Wrapper `features/home/pages/AiAssistant.js` chỉ truyền các Link của ứng dụng. `App.js` thêm route lazy công khai, `RouteMetadata.jsx` đặt title và focus theo cơ chế sẵn có. Thêm kiểm tra route guest/auth vào `App.test.jsx`; cập nhật đích CTA trong `Home.test.jsx`.

`HomeShowcase.css` giảm title từ tối đa38 xuống30 px, mô tả13 px, padding20 px và canvas260 px desktop. Năm thiết bị vẫn nằm trọn canvas tại1366/390/320 px. Hero demo560 px và CLI558,4 px; draft `show version` giữ qua đổi tab. Mobile title22 px; trang AI xếp avatar và tên ngang để cả hai CTA nằm trên thanh điều hướng đáy ở390×844.

Kiểm tra đợt cập nhật này: **6 suite / 31 test**, ESLint/Prettier/diff check đạt; boundaries2271 imports/assets/535 source files; CI production build exit0. Browser1920×900,1366×768,768×1024,390×844 và320×740 không tràn ngang, mọi CTA cao ít nhất44 px. Avatar có3/3 mẫu idle khác nhau; reduced-motion có1 mẫu duy nhất qua2 lần chụp, trạng thái vẫn `default` sau tương tác. CTA Home → giới thiệu → labs/roadmap và về Home hoạt động, title đúng, không có page error trong guest/auth context.

Không thay engine, endpoint, quota hoặc cohort/provider. QA dùng API/auth fixture; trang giới thiệu không có ô chat hay gửi request AI. Kết nối Browser extension lỗi thao tác nên lần nghiệm thu này dùng phiên Playwright độc lập. Chưa kiểm provider AI trong lab với tài khoản thật, screen reader hoặc touch vật lý.

Ảnh mới: [Home thu gọn](evidence/home-ai-entry/home-compact.png), [AI desktop](evidence/home-ai-entry/ai-intro-desktop.png), [AI tối](evidence/home-ai-entry/ai-intro-dark.png), [AI mobile](evidence/home-ai-entry/ai-intro-mobile.png). [Kết quả QA](evidence/home-ai-entry/checks.json) ghi riêng số đo trước/sau và phạm vi fixture.
