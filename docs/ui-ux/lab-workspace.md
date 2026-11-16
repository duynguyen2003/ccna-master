# Phòng thực hành và trợ lý AI — 15/11/2026

## Bỏ điều hướng lặp, ẩn hành trình và đọc trình tự — 15/11/2026

Desktop chỉ có một dải Mục tiêu/AI trong sidebar. Header chính chỉ hiện một nút
mở lại khi sidebar đóng; checklist không lặp tiêu đề và bộ đếm Mục tiêu. Mobile
dùng thanh Sơ đồ/Terminal/Mục tiêu/AI, ẩn dải tab thứ hai. AI embedded bỏ header
tên/avatar/đóng ở cả trạng thái tải, lỗi và hội thoại; Tùy chọn chuyển xuống cạnh
composer. Bấm tab/avatar AI focus ô hỏi, giữ controller, bản nháp và hội thoại.
Khung chat vẫn rộng380–480px theo quyết định trước đó.

Ping thử nay mở pane **Kiểm tra kết nối**, ghi rõ thiết bị gửi, có một nút đóng và
nút về mục tiêu. Nó không còn nằm dưới nhãn Mục tiêu. IP/protocol/port giữ nguyên
khi đổi pane; trace và lịch sử dùng tiêu đề đúng ngữ cảnh.

Hành trình thay dãy thẻ cuộn ngang bằng cách đọc sau:

- **Thu gọn**: chỉ còn tóm tắt nguồn → đích, giao thức, kết quả, số sự kiện; không
  giữ thanh phát chiếm chỗ. Chiều cao đo được42px ở laptop.
- **Ẩn** bằng nút X: bỏ toàn bộ khung; nút Hành trình trên thanh sơ đồ mở lại đúng
  sự kiện, không reset playback.
- **Xem nhanh**: trao đổi nhiều thiết bị dùng lifeline và mũi tên như trang mô
  phỏng. Hai sự kiện liền kề tự theo index; tiến/lùi hoặc dropdown chọn trực tiếp
  bất kỳ sự kiện nào, không phải kéo qua dãy thẻ. Ping nội bộ vẫn dùng timeline
  hai dòng và giải thích không đi qua liên kết.
- **Chi tiết**: mặc định trình tự đầy đủ với hành trình nhiều thiết bị, có thể
  chuyển sang danh sách sự kiện. Cột tự vừa sidebar của lab bốn router; sự kiện
  đang chọn tự vào vùng nhìn thấy. Trở về bản xem nhanh giữ index/tốc độ.

Mũi tên chỉ được vẽ cho FRAME có from/to thật. Quyết định ROUTE/ACL/ARP được đặt
tại thiết bị xử lý; không biến chúng thành hop mạng. Quick và detail dùng lại
PacketSequenceView, observation và clock hiện hữu; không thay engine/API/chấm lab.
Escape trong quick thu gọn, trong detail về quick, trả focus đúng nút. Đã sửa
capture Escape của workspace vốn chặn handler trong trace; menu dropdown đang
mở vẫn được quyền xử lý Escape trước.

### Kiểm chứng đợt này

11 suite/98 test đạt; ESLint, Prettier, boundary2222 imports/assets,129 icon exports
và production build `CI=true` đạt. Kiểm browser Chromium với auth/API fixture cô
lập; trace do engine EIGRP01 phiên bản3.0.0 tạo trong bộ nhớ:38 sự kiện multi-hop,
2 sự kiện self-ping. Bộ đếm0/17 là fixture kiểm bố cục, không phải kết quả chấm.

| Viewport, quick mở |  Sơ đồ | Terminal | Hành trình |
| ------------------ | -----: | -------: | ---------: |
| 1920×900           | ~268px |   ~278px |     ~207px |
| 1366×768           | ~190px |   ~228px |     ~209px |
| 1024×768           | ~191px |   ~228px |     ~209px |

- Phát38/38 ở2×, phát lại1/38; quick luôn hai dòng, scrollLeft/scrollTop bằng0.
  Bản đầy đủ vừa531px/604px sidebar trên laptop/desktop, không cuộn ngang.
- Ẩn/mở lại giữ5/38; Escape/Enter và chuyển detail/list/quick giữ index. Đổi
  thiết bị giữ lệnh đang soạn; mở AI/probe giữ sự kiện và các bản nháp.
- Ping R1→192.1.12.1 chỉ tô R1 và0 liên kết, kể cả khi terminal đang chọn R3.
- Một nhãn AI ở dải chọn,0 header bên trong,0 heading Mục tiêu lặp. Probe có
  đúng tiêu đề/nguồn/một nút đóng, không hiển thị tab Mục tiêu cho form này.
- AI RUNNING→COMPLETED và HTTP503 dùng trạng thái thật của controller qua API
  fixture. Thu gọn khi đang xử lý vẫn cập nhật avatar header; lỗi đưa về default.
  Idle có8 ảnh canvas khác nhau/8 mẫu; reduced motion đóng băng canvas.
- Mobile390×844 và320×740: không tràn ngang/cắt bốn thiết bị; AI chỉ dùng nav
  mobile và ô hỏi nằm trong viewport. Kiểm cả light/dark và menu Tùy chọn mở lên
  trên composer. Context QA mới có guard origin:0 page errors; chi tiết một lỗi
  storage từ harness cũ được giữ trong JSON để phân biệt với lỗi sản phẩm.

Ảnh: [xem nhanh desktop](evidence/lab-workspace-v2/lab-journey-quick.png),
[trình tự đầy đủ](evidence/lab-workspace-v2/lab-journey-detail.png),
[mobile](evidence/lab-workspace-v2/lab-journey-mobile.png),
[chat AI](evidence/lab-workspace-v2/lab-navigation-ai.png),
[kiểm tra kết nối](evidence/lab-workspace-v2/lab-navigation-probe.png).
[Số đo và phạm vi QA](evidence/lab-workspace-v2/lab-navigation-journey-checks.json).

File sửa: `CliLabWorkspace.js`, `PacketTracePanel.jsx`, `PacketTracePanel.css`,
`LabWorkspaceLayout.css`, `PacketSequenceView.jsx`; agent/browser gồm
`AiLabPanel.jsx`, `AssistantLoader.jsx`, `AiLab.css`; năm file test tương ứng,
báo cáo, todo và lessons. Không sửa Footer, dependency, engine hoặc API.

Giới hạn: chưa nghiệm thu tài khoản/DB/provider hoặc thiết bị cảm ứng thật.
Probe submit được kiểm bằng API mock trong unit test, không gửi thật từ browser.
Mobile rất thấp vẫn có thể cuộn dọc để giữ kích thước đọc; trace rất nhiều actor
có thể cuộn ở chế độ chi tiết, nút tiến/lùi vẫn tự đưa sự kiện vào vùng nhìn.
Phần này thay các mô tả timeline ngang/ba tab phụ/header AI embedded trong lịch sử
bên dưới.

Đã dọn artifact15/11/2026: giữ ảnh được liên kết trực tiếp, JSON kết quả/receipt,
trạng thái dịch vụ và backup cần thiết; xóa fixture/build cũ, log lặp và ảnh thử.
Các đường dẫn `.tmp` trong phần lịch sử ghi vị trí tại thời điểm kiểm.
Danh mục file local còn giữ nằm trong `.tmp/README.md`, không publish cùng source.

## Căn tab và nới chat AI — 15/11/2026

Đã bỏ phần nền dư của dải Mục tiêu/AI. Trước sửa, bar flex1 kéo nền dài hơn nút
cuối khoảng55px; hai nút cao30/38px và header sidebar cao hơn header sơ đồ12px.
CSS chung của SlidingTabs cũng ghi đè token của selector sidebar yếu hơn.

Sidebar nay dùng selector đúng phạm vi: nền bar trong suốt, bề rộng theo nút,
button desktop cùng32px và hai header cùng44px. Giữ pill trượt của component
chung; nút đóng nằm riêng bên phải. Khi có tab thứ ba Lịch sử/Gói tin, bộ đếm
Mục tiêu được giấu thị giác nhưng giữ cho screen reader, tránh scrollbar ngang
làm header cao lên. Tab lịch sử dùng aria-pressed boolean để pill nhận đúng.

Chat AI có cột riêng theo data-side-view: clamp380px/32vw/480px. Ở1366×768,
vùng chat tăng từ327 lên436px; desktop1920 sidebar480px. Mục tiêu vẫn310–360px,
trace giữ quy tắc riêng; collapse dùng toàn vùng làm lab. Mobile dùng đủ bề rộng
màn hình, tab44px và không áp min380px thành overflow.

3 suite/59 test đạt (workspace, AI panel và SlidingTabs), ESLint/Prettier và CI
production build đạt. Browser1366/1920/1024/~901/390/320px: hai header ngang nhau,
không tràn tab/trang hay cắt thiết bị, terminal desktop vẫn từ200px khi quick mở.
Giữ event9, terminal draft và AI draft qua đổi tab/resize; animation có16 frame
trung gian, pill khớp nút dưới1px. Light/dark/reduced-motion và bàn phím đã kiểm;
không POST AI trong QA. Dùng auth/API fixture, không ghi DB/provider thật.

Ảnh [desktop](evidence/lab-workspace-v2/sidebar-chat-width.png),
[mobile](evidence/lab-workspace-v2/sidebar-chat-mobile.png),
[số đo trước/sau](evidence/lab-workspace-v2/sidebar-chat-checks.json).
Source sửa: `CliLabWorkspace.js`, `LabWorkspaceLayout.css`; không sửa Footer,
component tab chung hoặc engine/controller/API.

## Tương tác avatar AI — 15/11/2026

Avatar nay nhìn theo con trỏ, nhảy nhẹ khi click/tap và phản hồi Enter/Space từ
nút AI. Bấm avatar ở header panel đưa focus vào ô hỏi; vùng bấm44px, không thêm
button lồng button. Giữ canvas overscan đúng tỷ lệ, không cắt cú nhảy; phần canvas
trong suốt không chặn nút/tab lân cận. Các thao tác này không gửi câu hỏi hoặc
giả trạng thái working. Avatar cũ trong tin nhắn vẫn tĩnh; hidden/reduced-motion
dừng cả animation lẫn phản ứng, còn hành động của nút vẫn dùng được.

3 suite/62 test liên quan, lint/format/boundaries và CI build đạt. Browser thật
đã kiểm đầu/mắt nhìn theo, click-hop, đóng/mở đúng một lần bằng chuột/bàn phím,
focus composer, reduced motion, hidden, RUNNING→COMPLETED và mobile touch320/390px.
Ảnh [desktop](evidence/lab-workspace-v2/avatar-interaction.png),
[mobile](evidence/lab-workspace-v2/avatar-interaction-mobile.png),
[kết quả](evidence/lab-workspace-v2/avatar-interaction-checks.json).
Chi tiết và file sửa: [báo cáo AI browser](../ai-lab-assistant/baseline/FE-01-02-browser.md).

## Workspace lab, hành trình và avatar AI — 15/11/2026

Trang thực hành dùng một vùng sơ đồ/terminal rộng và một sidebar chung. Mục tiêu,
Trợ lý AI, chi tiết hành trình và lịch sử mở theo tab; không còn hai cột lớn cho
mục tiêu và AI cùng lúc. Sidebar đóng/mở giữ controller AI, hội thoại, bản nháp,
thiết bị, CLI và vị trí playback. Đây là hành vi hiện tại, thay phần guard mobile
và drawer phủ nhiệm vụ trong các mục lịch sử bên dưới.

Đã đọc workspace, hook chiều cao terminal, layout/link geometry, trace engine,
observation/playback và controller AI trước khi sửa. Hai nguyên nhân chính là
panel phụ cùng tranh chiều cao/cột, và SVG có con absolute nên thiếu flex basis.
SVG nay có diện tích ưu tiên theo viewport, fit cả node lẫn nhãn subnet; topology
và cấu hình nguồn không bị sửa. Checklist dùng lại component cũ, hướng dẫn dài
mặc định thu gọn; chọn nhiệm vụ vẫn chọn đúng thiết bị và giữ tiến độ.

Hành trình có ba mức:

- Đóng: nguồn/thiết bị → đích, giao thức, kết quả và số sự kiện từ dữ liệu.
- Xem nhanh: khoảng180px trên laptop,202px ở desktop900px; timeline ngang và
  giải thích ngắn có vùng cuộn khi cần. Terminal vẫn nhập lệnh được.
- Chi tiết: mở trong sidebar rộng hơn, có nút về bản xem nhanh và trả focus.
  Các góc nhìn dùng cùng clock/index/tốc độ. Sequence chỉ xuất hiện khi có trao
  đổi FRAME giữa hơn hai thiết bị; hành trình ngắn dùng thẻ sự kiện.

Ping thử và lịch sử thao tác cũng mở trong sidebar. Trước khi sửa, mở các phần
này ở1366×768 làm form/nút xem lại vượt đáy. Hiện tại chúng không lấy thêm chiều
cao của terminal. Form ghi rõ thiết bị gửi, focus IP đích và giữ nguyên API probe.
Lịch sử giữ slider/replay/read-only cũ, có nút về terminal và hỗ trợ Escape.

R1 ping192.1.12.1 là ping IP thuộc chính interface của R1 trong EIGRP01. Engine
trả hai sự kiện giao/nhận nội bộ, không có FRAME. UI giải thích điều đó và chỉ
tô R1, kể cả khi người học đang chọn terminal R3. Ping4.4.4.4 dùng sáu FRAME thật
R1→R2→R3→R4 rồi chiều về. Không thêm hop, RTT, port ICMP hay payload giả.
Thông báo giao/nhận có nhãn tiếng Việt; có thể mở thông báo kỹ thuật gốc.

Avatar droid dùng [bot-avatars0.2.2](https://libraries.dev/bots), MIT, peerReact>=18,
tương thích React18.3.1 hiện tại. Wrapper đặt trong `@ccna/agent-ui/avatar`:
28–32px ở header/tab và26px ở tin nhắn. Idle nhẹ; `working` chỉ theo trạng thái
gửi/pending QUEUED/RUNNING thật của controller. COMPLETED/lỗi/offline đưa avatar
về thường. Reduced motion, document hidden, ngoài viewport hoặc panel ẩn đều
dừng canvas; avatar trong tin nhắn cũ là hình tĩnh để tránh nhiều vòng RAF.
Chi tiết ownership và lifecycle: [cập nhật AI browser](../ai-lab-assistant/baseline/FE-01-02-browser.md).

Mobile dùng tab Sơ đồ/Terminal/Mục tiêu/AI, giữ các component đã mở để không mất
nội dung. Chuỗi bốn router xếp hai hàng. Form AI luôn có ô nhập trong vùng nhìn
thấy. Trên màn rất thấp, vùng sơ đồ được cuộn khi chạm kích thước tối thiểu; bản
xem nhanh giới hạn theo chiều cao viewport. Lab CLI cũ không có topology mở
thẳng terminal, không rơi vào tab sơ đồ trống.

### Kiểm chứng và ảnh

Browser Chromium local dùng auth/API fixture cô lập và trace do engine EIGRP01
thật tạo; không ghi DB hoặc gọi provider AI thật. Đo sau layout ổn định:

| Viewport/trạng thái |  Sơ đồ | Terminal | Xem nhanh |
| ------------------- | -----: | -------: | --------: |
| 1920×900, quick     | ~255px |   ~264px |    ~202px |
| 1366×768, đóng      | ~236px |   ~281px |         — |
| 1366×768, quick     | ~190px |   ~226px |    ~180px |
| 1366×768, chi tiết  | ~255px |   ~300px |   sidebar |

- 14 suite/110 test frontend đạt, gồm giữ state khi đổi panel, single-device cũ,
  probe contract, bounds resize, trace local/multi-hop và callback AI hoàn tất/lỗi.
- ESLint/Prettier, boundaries,129 icon exports,16 SVG artwork và catalog39 bài đạt.
  Production build với `CI=true` thành công.
- Ping32/32 sự kiện chạy hết ở2×,894 frame không cắt thẻ; replay về1/32. Đổi
  Sequence/detail/quick giữ sự kiện9 và tiếp tục phát; chọn từng event tô đúng actor.
- Kiểm terminal Enter bằng `show ip route` lấy output engine; giữ draft `show ip `
  khi đổi thiết bị/view; probe và lịch sử không đẩy terminal ra khỏi khung.
- Canvas idle/working có thay đổi hình thật; đóng panel và reduced motion đóng
  băng hình. AI hoàn tất khi panel đang đóng vẫn cập nhật trạng thái header;
  response503 có lỗi rõ ràng và avatar trở về thường. Có avatar cạnh câu trả lời.
- 1920×900,1366×768,1024×768,390×844,320×740 và390×667 không tràn ngang/cắt nhãn.
  390×600 cho cuộn để đọc hết thông tin, không giấu đáy. Light/dark và focus
  khi về nhanh/đóng lịch sử/slider bàn phím đã kiểm.

Ảnh sau sửa: [desktop1920](evidence/lab-workspace-v2/desktop-workspace.png),
[laptop chi tiết](evidence/lab-workspace-v2/laptop-detail.png),
[laptop AI đang xử lý](evidence/lab-workspace-v2/laptop-ai-working.png),
[mobile ping nội bộ](evidence/lab-workspace-v2/mobile-local-ping.png),
[mobile terminal](evidence/lab-workspace-v2/mobile-terminal.png),
[mobile AI](evidence/lab-workspace-v2/mobile-ai.png).
Số đo/kết quả browser: [checks.json](evidence/lab-workspace-v2/checks.json).

Giới hạn: chưa nghiệm thu tài khoản/DB/provider thật hoặc thiết bị cảm ứng thật.
Trên mobile, sơ đồ và terminal chuyển qua tab để giữ kích thước đọc được; không
hiển thị đồng thời hai vùng. Hiệu ứng đổi theme vẫn theo quyết định trước đó;
quy tắc giảm chuyển động ở trên áp dụng cho gói tin và avatar.

### File thay đổi trong lượt này

Các đường dẫn `features/...` bên dưới thuộc `src/frontend/src/`.

| Nhóm                      | File                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace và panel        | `features/labs/components/CliLabWorkspace.js`, `PacketTracePanel.jsx`                                                                          |
| Layout                    | `features/labs/styles/LabWorkspaceLayout.css`, `PacketTracePanel.css`                                                                          |
| Resize                    | `features/labs/hooks/useTerminalHeight.js`, `useTerminalHeight.test.js`                                                                        |
| Sơ đồ                     | `features/labs/components/NetworkTopology.js`, `features/labs/styles/NetworkTopology.css`, `features/labs/utils/topologyLayout.js`             |
| Dữ liệu hiển thị          | `features/protocols/model/traceSummary.js`, `traceSummary.test.js`, `observation.js`, `features/protocols/components/PacketEventInspector.jsx` |
| Regression UI             | `features/labs/components/NetworkLab.test.js`, `AiLabAssistant.test.jsx`, `DroidAvatar.test.jsx`                                               |
| Avatar package            | `src/agent/browser/avatar.js`, `components/DroidAvatar.jsx`, `styles/DroidAvatar.css`                                                          |
| AI embedded               | `src/agent/browser/components/AiLabPanel.jsx`, `AiMessage.jsx`, `AssistantLoader.jsx`, `styles/AiLab.css`                                      |
| Dependency và biên import | `src/agent/browser/package.json`, `pnpm-lock.yaml`, `src/scripts/check-boundaries.cjs`                                                         |
| Báo cáo                   | file này, `docs/ai-lab-assistant/baseline/FE-01-02-browser.md`, `todo.md`, `lessons.md`,6 ảnh và JSON kết quả                                  |

Giữ nguyên simulation engine, chấm lab và HTTP API. Lockfile chỉ thêm dependency
bot-avatars và peerReact, không nâng cả bộ package. Không sửa các thay đổi admin/
protocol khác đang có sẵn, không commit/push. Scratch sinh trong lượt này được
dọn sau kiểm, giữ ảnh/bằng chứng có liên kết.

## Animation áp dụng trực tiếp vào CLI Lab — 15/11/2026

Renderer chung dùng thẻ/asset của trang mô phỏng cho trace thật của engine:
IP hai chiều, ARP tại node, đổi IP sau NAT, trail/pulse nhận và drop tại thiết bị.
Giữ một clock cho sơ đồ, bảng sự kiện và Sequence; polling không khởi động lại,
seek/reset/resize không làm mất vị trí. Dữ liệu thẻ11–12px, tự fit mép; thêm56
đơn vị caption (canvas tuyến4 node266px), stage không co khi mở inspector.
Giảm chuyển động vẫn có thẻ/đường/dấu lỗi tĩnh. Không phóng cả packet marker,
tránh làm điểm neo lệch đường truyền khi SVG tính tâm theo bbox của caption.

265 lượt chọn desktop/light và tablet/dark,38 sự kiện reduced motion,
ping38/38 ở2× và HTTP native/view switch đạt.10 suite/60 test frontend,
5 test engine, lint/format/catalog/boundaries/artwork và CI build đạt.
Browser dùng API/auth fixture với trace do engine thật tạo, không ghi DB.
Điện thoại giữ guard yêu cầu dùng máy tính, đã kiểm390×844 không tràn trang.
Phạm vi tích hợp và kiểm chứng: [bản rà soát PR](../maintenance/network-workspace-review.md).

## Catalog đầy đủ — 15/11/2026

Thư viện native đã có39 mô phỏng/231 giai đoạn/694 sự kiện, chia11 nền tảng,
19 ứng dụng và9 bảo mật. Dữ liệu từng bài tải theo lựa chọn; Sequence/clock/
tiến độ vẫn dùng cơ chế hiện có. Scene có21 node, physical links cho Ethernet/IGMP,
snapshot nhãn cho IPv6/PPPoE/DHCP và thêm hình switch/camera/TV light-dark.
Nguồn và hash: [manifest catalog](../../src/frontend/src/features/protocols/data/lessons/provenance.json).

## Workspace Mô phỏng giao thức — 15/11/2026

Trang `/protocols` có bộ chọn tìm/lọc theo nhóm và hai cấp giao thức/kịch bản,
toolbar thống nhất, điều hướng giai đoạn và giải thích theo sự kiện. Desktop
dùng danh sách giai đoạn, mobile dùng dropdown; SVG fit đủ thiết bị và sắp lại
tọa độ hiển thị trên màn hình hẹp. Giữ clock, dữ liệu thật và tiến độ xem riêng.
Chi tiết và ảnh: [bản rà soát mô phỏng](../maintenance/network-workspace-review.md).
Mục camera/fade trong lịch sử bên dưới đã được thay bằng fit trực tiếp để chọn
sự kiện khi tạm dừng vẫn thấy đủ thiết bị. Animation gói tin vẫn chạy theo clock.

## Network isometric và Sequence — 15/11/2026

Đã dùng REA kiểm lại Protocol Explorer và nâng cách biểu diễn: nền lưới phối cảnh,
packet tag/payload/halo/trail, camera và loss trong bài học; topology lab dùng cùng
PacketGlyph nhưng giữ đường đi và sự kiện từ engine. Sequence có mũi tên nghiêng,
màu theo giao thức/chiều, header tên/IP, timestamp có nguồn và nhóm bước.
Stream bài học giữ spacing gối nhau trong clock GSAP chung; pause/seek/speed/view
không tạo renderer phát độc lập. Reduced motion giữ đường và packet tĩnh.
Chi tiết, bằng chứng và giới hạn: [bản tích hợp trong PR](../maintenance/network-workspace-review.md).

## Hoàn tất G2–G4 — 11/11/2026

Lab có Sequence với header thiết bị giữ khi cuộn, annotation nội bộ và FRAME arrow;
bảng/Sequence/topology/inspector cùng selection. So sánh TTL/NAT chỉ từ snapshot
đã xác minh cùng actor và chiều, loại ARP/DROP. Quan sát không gửi action, đổi draft
hoặc chấm điểm. Link mở runtime tạm trong toolbar đã bỏ.

Bài học có player React 14 giao thức/78 bước, thư viện /protocols và selector trong
admin editor. View Network/Sequence giữ clock, tốc độ và vị trí. Tiến độ xem tách
riêng theo user/lesson/version trên trình duyệt; không tự hoàn thành bài/lab.
Source/scene có manifest hash; page iframe/runtime/vendor script cũ đã gỡ.

UI native dùng token học viên (admin preview light), khung SVG có chiều cao giới hạn,
Sequence cuộn nội bộ với focus/selection, các control44px ở mobile. Packet motion
tuân thủ reduced motion; radial theme giữ yêu cầu luôn animation. Browser kiểm375–1440px,
light/dark,268 sự kiện, bàn phím và TTL32→31 trong fixture. Chi tiết/bằng chứng tại
docs/rea/protocol-explorer.md và .tmp/g2-g4-review. Không gọi DB/model hoặc push.

Các mục cập nhật dưới đây là lịch sử triển khai, không thay trạng thái hiện tại.

## Observer trace native và radial theme — 07/11/2026

G0–G1 đã được đưa vào workspace. Asset gốc dùng chung tại public/network-devices
và được kiểm bằng pnpm check:network-devices; bỏ dependency icon của lab/editor/hero
vào thư mục runtime tạm. Các bộ server/DNS được giữ trong inventory cho scene bài học.

Hành trình gói tin nằm dưới topology, mặc định gọn với controls; mở chi tiết để
đọc bảng sự kiện và inspector. Chọn hàng pause, highlight đúng node/link/interface
và cuộn danh sách nội bộ đến hàng đang xem, không đổi thiết bị terminal. Có tiến/lùi,
về đầu, tốc độ0.5/1/1.5/2 và tới nguyên nhân lỗi. Một timeline GSAP điều khiển con trỏ
và visual track; không có timer quan sát chạy song song với một animation tự phát.
Polling tương đương giữ vị trí; đổi nguồn/attempt/replay dọn timeline cũ. Lịch sử
không tự phát; người dùng có thể chủ động quan sát lại mà không thay snapshot.

Inspector chỉ hiển thị trường engine ghi nhận. ARP tách MAC với IP probe liên quan;
DROP không bị hiểu thành header sau NAT. Port chỉ xuất hiện với TCP/UDP, không lấy
srcPort/dstPort chung của probe để dạy thành port ICMP. Không dựng hex, checksum,
RTT hoặc so sánh snapshot không có bằng chứng. Nội dung/draft CLI, grading và journal
không bị thao tác quan sát ghi lại.

ThemeToggle của web và nút theme lab dùng chung radial reveal trích từ hàm uo của
nguồn: vòng tròn từ tâm nút tới góc viewport xa nhất,650ms, easing0.16/1/0.3/1.
Theme web giữ mặc định light/lựa chọn đã lưu; theme lab vẫn có phạm vi riêng như cũ.
Theo chỉ dẫn mới của người dùng, hiệu ứng theme luôn chạy, kể cả reduced motion.
Trình duyệt thiếu API/pseudo-element animation dùng overlay clip-path650ms rồi
fade150ms. Click liên tiếp commit đúng thứ tự; unmount dọn lớp phủ/timer/transition.
Chính sách reduced motion của animation gói tin vẫn giữ nguyên.

58 suites/444 test đạt, gồm lifecycle/polling, interface song song, dữ liệu thiếu,
ICMP không có port, history readonly, không gọi action khi quan sát, theme rapid-click,
blocked storage và animated fallback. Lint/format/boundaries/icons/hash/build đạt;
đã sửa thứ tự CSS ở workspace để build CI không còn conflict, không tắt cảnh báo.
REA kiểm component/engine trong fixture và full workspace, main theme, mobile390,
ACL và mất đường về;8 scenario/PNG ở .tmp/protocol-native-ui. QA không gọi DB/model;
chưa đo Web Vitals hoặc thiết bị cảm ứng thật. G2 Sequence/G3 lesson player/G4 gỡ
runtime tạm còn theo kế hoạch docs/rea/protocol-explorer.md.

## Dùng nguyên Protocol Explorer — 05/11/2026

Yêu cầu mới “copy y nguyên” thay quyết định tự vẽ/clean-room ở mục cập nhật
04/11 bên dưới. `NetworkDeviceGlyph` hiện dùng hình học SVG laptop, router và
cloud gốc của Protocol Explorer, trong lab, editor và hero. Giữ nguyên các shape,
gradient và bảng màu light/dark; chỉ thêm wrapper/crop cho SVG độc lập. Switch
giữ hình cũ vì tham chiếu không có switch. Các node vẫn giữ tọa độ, nhãn, cổng,
selected/focus và thao tác bàn phím của NetMaster.

Trang `/tools/protocol-explorer` mở nguyên runtime gốc trong iframe tại
`public/protocol-explorer/index.html`. Điểm vào: mục Công cụ trên trang chủ,
footer và liên kết “Mô phỏng giao thức” cạnh Ping thử trong lab. Liên kết từ lab
mở tab mới để giữ terminal/attempt; trang công cụ có lối mở toàn màn hình.
Iframe giữ CSS, animation và state lesson riêng; tiến độ xem bài dùng storage
gốc, không ghi thành tích/chấm điểm hay cấu hình lab. Ping thử của CLI lab tiếp
tục lấy đường đi từ FRAME/DELIVERED/DROP thật như phần dưới.

Giữ đủ14 giao thức/78 bước, Network/Sequence, packet inspector/hex, Play/Step,
tốc độ, bản dịch và theme của bản gốc. 38 tài nguyên được chép từ archive công
khai;34 file nguyên byte,4 file chỉ đổi path HTML/CSS/Vite-preload/manifest để
chạy trong subdirectory. Giữ credit Dilum Sanjaya. Script vendor và
`check-protocol-explorer.cjs`, README/provenance ghi hash nguồn, hash tích hợp và
hash hình học10 SVG variants. Đây là production frontend tải về, không phải
repository phát triển nguyên bản.

Kiểm chứng:55 suites/430 test frontend;2 suites/4 test route/topology chạy lại
sau chỉnh fallback glyph; lint, Prettier, boundaries, icons và production build
đạt. REA mở đủ14 bài, đếm78 bước; TLS chuyển bước/Sequence/tốc độ/theme tối và
Spanish chunk; ICMP Play v? inspector Ethernet/IPv4/ICMP; iframe desktop1440/mobile390;
lab hiển thị router gốc. Sáu capture thành công không có lỗi page/HTTP. Một
capture kết hợp autoplay, pause, Sequence và DOM từng bước bị treo; đã hủy và
đóng riêng browser REA sở hữu, rồi kiểm inspector bằng capture tách thành công.
Chưa chạy hết mọi animation của78 bước hay kiểm cảm ứng vật lý. QA dùng auth/API
tổng hợp, component và simulator thật, không thay DB hoặc gọi model. Artifact:
`.tmp/protocol-original-ui/`.

## Icon thiết bị và chuyển động ping — cập nhật 04/11/2026

Theo yêu cầu thay icon/animation sau khi khảo sát Protocol Explorer, dùng bộ SVG
tự viết `NetworkDeviceGlyph`: laptop, switch nhiều cổng, router và cloud có mặt
trên/hông, đường nét kỹ thuật và bóng nhẹ. Dùng chung trong lab, admin topology
editor và minh họa hero; giữ kích thước bố trí/cổng/nhãn, font và palette hiện có.
Không chép icon, font hoặc code của website tham chiếu. Quyết định mới thay thẻ
vuông glyph phẳng ở phần mô tả Stitch cũ bên dưới.

Ping chạy theo FRAME và đúng interface/link, có đuôi gói, đường truyền sáng và
nhịp nhận tại thiết bị. Caption chiều yêu cầu/phản hồi lấy từ trace; TTL chỉ hiện
khi engine có giá trị. ARP_REQUEST tạo nhịp tại nguồn, không dựng đường broadcast
giả; DROP tạo dấu chặn ở đúng thiết bị. Không có FRAME thì không nối thiết bị từ
metadata ROUTE. Trạng thái đọc bằng chữ trong trace hiện có vẫn được giữ.

Một timeline GSAP sở hữu phần trình bày: polling/chọn router không phát lại;
probe mới có key mới thì chạy lại. Hủy timeline khi đổi trace/unmount và khi bật
reduced motion; SVG hỗ trợ CSS reduced motion ngay lập tức. Replay lịch sử của
workspace vẫn theo guard hiện có. Không thêm API/action/tick, sửa engine/grader
hay remount terminal để chạy hiệu ứng.

Kiểm chứng: **55 suite/429 test frontend đạt**, gồm trace request/reply từ engine
thật, lỗi đường về, không dựng hop từ ARP/ROUTE, signature polling/probe và cleanup
khi đổi reduced motion. ESLint, Prettier, boundaries/icons và CI production build
đạt. REA kiểm trực quan light1440×900, dark1280×900, reply1024×768,
mobile390×844/reduced motion, và workspace thật1440×1000 (bỏ onboarding,
chọn/Enter router, đổi theme, mở Ping thử); không có page error trong các capture.

Harness dùng component/engine thật, cấu hình và API/auth tổng hợp. Đã xác nhận
request xanh cyan, reply xanh lá, ACL deny ở R2 đỏ và reduced motion không hiển
thị layer chuyển động. Chưa kiểm cảm ứng vật lý hoặc gọi backend/DB/model thật.
Ảnh và metadata: `.tmp/protocol-topology-ui/{light-request,dark-drop,reply,
mobile-reduced,lab-dark}.png`, `browser-results.json`; test log tại
`frontend-tests.log`. Không cài dependency hoặc commit/push.

## Mặc định khi vào trang — cập nhật 02/11/2026

- Composer bỏ nền và đường viền của lớp bọc ngoài; giữ mặt ô nhập bo góc,
  trạng thái focus và hàng mức gợi ý/lượt còn lại.
- Website mặc định light khi chưa có lựa chọn hợp lệ, cả trước khi React chạy.
  Lựa chọn light/dark đã lưu được giữ; không tự chuyển theo hệ điều hành.
- Đề bài và hướng dẫn nằm đầu cột mục tiêu, mở mặc định cho mỗi attempt.
  Bật/tắt AI không remount phần đề bài, giữ lựa chọn gập/mở thủ công.
- Replay đổi tên thành Lịch sử thao tác, ẩn khi chưa có log hoặc đang preview.
  Khi mở, giải thích việc chọn mốc để xem trạng thái lab; giữ chỉ đọc và nút
  Quay lại hiện tại. Nền trùng terminal để tránh một dải trắng riêng.

Kiểm chứng: 42 test trong 4 suite liên quan đạt; 5 ca bootstrap first paint
đạt, gồm OS tối, giá trị lưu sai và storage bị chặn. ESLint, boundaries và
production build đạt. Browser dùng component thật với dữ liệu tổng hợp,
kiểm default light, giữ dark sau reload, đề bài mở ở đầu cột, replay chỉ đọc
và composer trong suốt. Không gọi provider AI hay đổi DB.

## Tham chiếu Stitch — cập nhật mới nhất

Theo yêu cầu mới, palette lab/AI dùng mẫu
[Minimal AI Learning Workspace](https://stitch.withgoogle.com/projects/6440388810983970626),
thay quyết định giữ màu chủ đạo trong các phần lịch sử bên dưới. Đã kết nối MCP,
đọc hai screen và tải HTML/screenshot bằng download_file. Báo cáo và đối chiếu
tính năng trong báo cáo local `docs/rea/stitch-lab-workspace.md`.

- Mặc định light: slate/trắng, cyan cho mạng, indigo cho AI, emerald cho Chấm bài.
  Có dark đối ứng. Palette nằm trong LabStitch.css và class scoped của workspace/
  AI/portal; theme của toàn website và form admin không đổi. Giữ chữ13/14px.
- Thiết bị thực hành dùng thẻ SVG vuông bo góc, ký hiệu router/switch/PC tự viết;
  editor giữ glyph/hệ tọa độ cũ. Subnet/cổng/chọn dây và packet paths vẫn từ engine.
  Chỉ hiển thị số thiết bị có thật; không suy diễn Active/AS/Neighbor từ ảnh mẫu.
- Chấm bài xuất hiện đúng một lần ở header, nhìn thấy khi cuộn nhiệm vụ. Tiến độ
  tổng chỉ ở Mục tiêu. Khi mở AI vẫn giữ cột nhiệm vụ theo yêu cầu trước.
- Terminal dùng màu theo theme bằng xterm.options.theme, giữ instance/history và
  lệnh đang soạn. Canvas chiếm phần còn lại của cột, không để khoảng thừa dưới
  Xem lại. SVG không co theo flex khi nhiều hàng; đo fit trong layout effect để
  tránh khung1000px thu nhỏ ở lần vẽ đầu. Nội dung lớn cuộn riêng, chữ giữ tỉ lệ1:1.
- Hội thoại dùng bubble cyan và thẻ phản hồi viền indigo; lệnh đầy đủ có chép và
  đưa vào terminal đúng thiết bị, chờ học viên nhấn Enter. Giữ snapshot tự lấy phía server, không thêm upload snapshot,
  token counter, Deep Lab2.5, serial Connected115200, zoom/fullscreen hoặc status giả.
- Màu chữ nhỏ dùng bậc cyan700/indigo600/emerald700 trong cùng palette tham chiếu
  để đủ tương phản; cyan600 vẫn dùng cho nét và trạng thái chọn. Không nhúng code,
  nội dung mẫu, Tailwind/CDN hoặc ảnh/logo/font bên ngoài vào sản phẩm.

Kiểm chứng cuối:380/380 test frontend, CI build, lint/format/boundaries đạt.
Browser90/90 (15topology ×558/1024/1440 ×2theme), không overlap/page overflow và
tỉ lệ viewBox/render≈1. Kiểm desktop1280×1024/1440×900/tablet1024×768/mobile375×812,
dropdown modal, chọn router/dây và draft CLI qua đổi theme. Ở1024px: header56px,
terminal260px, không khoảng thừa dưới Xem lại; AI vẫn có vùng hội thoại≈234px khi
giữ nhiệm vụ phía trên. Mobile textarea16px, nút gửi bottom802 trong812px.

Harness dùng component/engine thật với API/auth/AI tổng hợp, không gọi Gemini
hoặc đổi DB. JSON ở .tmp/lab-stitch-diagrams.json và .tmp/lab-stitch-hover.json;
log .tmp/lab-stitch-all-tests-final.log và .tmp/lab-stitch-release-build.log.
Chưa kiểm cảm ứng/bàn phím ảo vật lý hoặc thay đổi reduced-motion của hệ điều hành.

Đã đọc `Agent.md`, `skill.md`, UI/UX Pro Max, hướng dẫn UI của dự án và quy tắc
`src/agent`. Yêu cầu mới thay quyết định cũ để AI luôn có thể mở cùng nhiệm vụ.
Giữ màu #386298, Be Vietnam Pro, theme lab, simulator/grader và quyền truy cập.

## Thay đổi

| Vấn đề                    | Hành vi sau sửa                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| Mã phiên/revision nổi bật | Trạng thái Đã lưu/Đang lưu; mã và Chép mã nằm trong menu tùy chọn                        |
| Công cụ chiếm terminal    | Thanh Ping thử/Ngắt dây; IP chỉ hiện khi mở Ping, TCP/UDP mở riêng                       |
| Tick kỹ thuật             | OSPF tự ghi tối đa hai tick cần thiết vào journal server; nút tay ở chế độ gỡ lỗi        |
| Sơ đồ nhỏ, nhãn lặp       | Fit theo node; chuỗi thiết bị trải theo đường đi; tên một lần, subnet trên dây           |
| Nhiều thẻ giống nhau      | Một việc tiếp theo và các nhóm mục tiêu thu gọn; xong nhóm thì tự gập; điểm sau chấm     |
| Hai hành động ngang hàng  | Chấm bài là nút chính; làm lại ở menu và phải xác nhận trong Dialog                      |
| Lỗi CLI                   | Caret tính cả prompt; polling cùng lịch sử không xóa màn hình, lệnh mới được nối tiếp    |
| Replay khó hiểu           | Xem lại có slider và nút Quay lại hiện tại; trạng thái xem lại chỉ đọc                   |
| Đóng nhầm mất ngữ cảnh    | Trang `/labs/:id`, Back về danh sách; Escape không rời trang; link query cũ tự chuyển    |
| AI che nhiệm vụ           | Ba cột từ1280px; dưới1280px hai phần cùng tồn tại ở cột phải; terminal vẫn dùng được     |
| Hội thoại quá thấp        | Form gọn, nút Gửi cạnh ô hỏi, tùy chọn thu gọn, bỏ robot lớn ở trạng thái trống          |
| Không thấy AI xử lý       | Trạng thái chờ nằm ngay sau câu hỏi trong hội thoại; giữ hủy/thử lại/lỗi theo controller |
| Chọn lại nguồn            | Theo thiết bị terminal; chỉ chọn đích khi phân tích kết nối, đổi nguồn trong tùy chọn    |

EIGRP01 mới có năm nhóm mục tiêu. Lab cũ được nhóm từ loại check khi chưa có
`objective`; không tự thêm mục tiêu chấm chưa tồn tại. Admin preview vẫn dùng
hộp thoại chung. Điện thoại giữ thông báo dùng máy tính và có thể mở AI bằng Dialog.

GET `/learning/labs/:id` đọc chính xác bài, không phụ thuộc trang100 kết quả đầu.
Endpoint chỉ trả PUBLISHED, dùng cùng quyền/nội dung công khai với danh sách,
không trả initialState/gradingSpec và ẩn guide/steps khi bị khóa.

## Kiểm chứng

- Frontend: 46 suites, **323/323 test pass**; CLI/API với PostgreSQL riêng:
  **123/123 pass**, không skip. Có test route/khóa/draft/ẩn rubric, xác nhận làm
  lại, page Back/Escape, OSPF ticks theo revision, group tự gập, caret và chống reset
  terminal khi polling, AI chờ/phản hồi/lỗi, thiết bị hiện tại và an toàn nội dung.
- Build production với `CI=true`, lint60 file JavaScript thay đổi, ranh giới import
  và `git diff --check` đạt. Không thêm thư viện hoặc migration cho đợt UX này.
- Browser dùng component/engine thật và API/auth tổng hợp trong harness `.tmp`:
  1440×1000, 1280×900, 1024×768, 768×1024 và 375×812; dark/light.
  Trên1280px, hội thoại đo được531px, form185px, chữ15px; nhiệm vụ vẫn có cột riêng.
  Trên375px, hội thoại512px, nút Gửi trong viewport, không tràn ngang, tùy chọn đóng mặc định.
- Browser xác nhận ICMP một dòng; dòng terminal `R1#invalid` có caret bắt đầu
  sau3 khoảng trắng. Nút Chấm bài light có nền rgb(56,98,152), chữ rgb(247,251,255).
  Contrast cặp này6.0:1. Focus, menu native, Dialog và nút Close được giữ.
- Không gọi provider AI thật hoặc cập nhật DB đang sử dụng. Tương tác AI được
  kiểm bằng phản hồi tổng hợp; HTTP/quyền được kiểm bằng PostgreSQL thật riêng.
  Chưa kiểm bàn phím ảo trên điện thoại vật lý.

Các log cuối nằm trong `.tmp/lab-ux-all-ui-final.log`, `.tmp/lab-ux-all-cli.log`
và `.tmp/lab-ux-build-final.log`. Các thay đổi EIGRP trước đợt này được giữ lại.

## Thiết kế lại sơ đồ và mật độ chữ — sau phản hồi ảnh ngày 01/11

Yêu cầu mới là thu nhỏ chữ và thiết kế lại toàn workspace. Giữ màu xanh
`#386298`, Be Vietnam Pro, các quyền, CLI, gợi ý, replay và cách chấm hiện có.

| Thành phần  | Thiết kế hiện tại                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Header      | Một hàng tối thiểu60px, gộp trạng thái lưu và hành động; Back/Thành tích dùng icon dưới1280px với tên cho screen reader                        |
| Sơ đồ       | Nền chấm nhẹ; router tròn bốn mũi tên, switch và PC có ký hiệu riêng; tên thiết bị13px, subnet12px căn giữa trên dây                           |
| Dây và cổng | Dây1.8px, tương phản3.16:1 sáng/4.97:1 tối; cổng11px chỉ hiện khi đủ chỗ; dây ngắt/STP có chữ và nét đứt                                       |
| Bố trí      | Chuỗi đi theo liên kết vật lý; fit vị trí theo pixel, không kéo giãn chữ/icon; dây dọc đặt nhãn sang bên; sơ đồ rộng cuộn nội bộ bằng bàn phím |
| Toolbar     | Ping thử/Ngắt dây cùng hàng với tên sơ đồ; bỏ dòng hướng dẫn lặp, phần TCP/UDP chỉ hiện khi mở                                                 |
| Terminal    | Nút chuyển thiết bị dưới sơ đồ đồng bộ với router đang chọn; chữ13px, nền terminal liền mạch                                                   |
| Nhiệm vụ    | Cột mặc định320px; chữ13px, nội dung đọc14px; mục đã xong có dấu check; gợi ý mở trong thẻ; Chấm bài nằm cuối cột                              |
| AI          | Hội thoại14px, chữ phụ12px, form gọn; textarea mobile16px để tránh tự zoom; giữ pending và chọn thiết bị theo terminal                         |

`layoutTopology` chỉ thay vị trí hiển thị của màn thực hành. Editor tiếp tục
dùng hệ tọa độ1000×600; kéo thả vẫn đổi đúng tọa độ nguồn. CSS sơ đồ thuộc
component dùng chung, đã bỏ các selector cũ ghi đè hình chữ nhật và màu hover
`aside button`. Import sơ đồ trước CSS workspace để giữ cùng thứ tự CSS ở
chunk học viên và admin; không bỏ qua cảnh báo build.

### Kiểm chứng đợt thiết kế lại

- Browser harness dùng component/engine thật, API/auth/phản hồi AI tổng hợp,
  không gọi provider hoặc sửa dữ liệu DB. Kiểm1440×900,1280×900,1024×768 và375×812,
  theme sáng/tối, tên lab dài, keyboard/menu, chọn router, ngắt/nối dây và Ping/UDP.
- Ở1280px khi AI mở: sơ đồ558px vừa khung, không cuộn ngang; nhãn IP12px,
  tỉ lệ SVG≈1; vùng hội thoại591px, composer182px, cột mục tiêu280px.
- Header thường60px; tên dài ở1024px xuống hai dòng, header62px, không tràn trang.
  Mobile375px không tràn ngang; textarea16px, đáy nút Gửi764px trong viewport812px;
  trạng thái “Đang gửi câu hỏi…” xuất hiện ngay trong hội thoại.
- Editor kéo R1 từ(360,280) tới khoảng(460.4,319.7); thiết bị còn lại không đổi.
  Đã kiểm thêm sơ đồ phân nhánh có router/switch/PC và dây dọc.
- Nút gợi ý sáng có contrast6.23:1, nút Chấm bài5.86:1. Focus menu có outline;
  unit test reduced motion kiểm không chạy tween/timeline, vẫn giữ thiết bị được chọn.
- Log test cuối: `.tmp/lab-design-all-ui-final.log`; build CI:
  `.tmp/lab-design-build-final-colors.log`; ảnh1440px:
  `.tmp/lab-design-after-light.png`, `.tmp/lab-design-after-dark.png`.
- Chưa kiểm bàn phím ảo trên điện thoại vật lý hoặc hội thoại với provider AI thật.
  Không thay grading/engine/schema, không commit/push.

## Nhất quán và khả dụng — 01/11/2026

- Tiến độ tổng chỉ ở cột Mục tiêu, có semantics progressbar. Nhóm có thanh3px,
  số hoàn thành và biểu tượng trạng thái; hoàn thành nhóm tự gập. Nhóm chưa xong
  đầu tiên và yêu cầu bài mở sẵn. Các giai đoạn đóng vẫn hiện số giai đoạn/tên đầu tiên.
- Heading nội dung13px/650 thống nhất; nút primary dành cho Chấm bài, secondary
  cho Ping/Ngắt dây/AI, tertiary cho Thành tích và thao tác phụ. Giữ hover theo
  cặp màu theme. Chip thiết bị nằm trên thẻ nhiệm vụ; bấm thẻ đổi terminal.
- Terminal bắt đầu260px, kéo tay nắm hoặc dùng ↑/↓, Home/End để đổi chiều cao.
  Giới hạn theo viewport, tối thiểu200px. Sơ đồ cuộn riêng và căn giữa khi đủ chỗ;
  nhiều hàng vượt khung vẫn bắt đầu từ trên, không căn giữa gây cắt nội dung.
- Tải mã trợ lý dùng skeleton,12giây chuyển lỗi với Thử lại/Đóng. Retry chỉ tải
  lại giao diện; response cũ bị bỏ qua sau retry/unmount. Render error nằm trong
  boundary riêng. Mobile dùng Dialog trong lúc tải/lỗi; không nằm trong CLI bị ẩn.
  API vẫn giữ timeout15giây và retry/recovery theo controller, không tự gọi lại model.
  -5 dropdown AI dùng DropdownSelect qua adapter UI: cách trợ giúp, đích, nguồn,
  mức gợi ý và lý do đánh giá. Menu có CSS/light-dark/font12px, rộng tối thiểu220px,
  bàn phím/typeahead/disabled. Agent không import frontend.
- Dropdown chung portal vào dialog gần nhất khi có modal; giữ focus ở trigger
  khi bấm option để native dialog không nhận click backdrop. Escape trong menu
  mở chỉ đóng menu; lần Escape sau mới đóng panel. Các caller ngoài modal giữ body portal.

## Rà motion, control và sơ đồ nhiều hàng — 01/11/2026

Đã áp dụng UI/UX Pro Max và transitions-dev trong phạm vi lab/AI, giữ font nhỏ
đã chốt. Token chuyển động thuộc theme lab; không thêm thư viện hoặc biến
`:root` cho toàn website.

- `LabDisclosure` giữ semantics của `details/summary`, thêm mở/đóng hai chiều
  bằng grid, inert/aria-hidden khi đóng, hủy timer khi mở lại hoặc unmount.
  Mục tiêu tự gập khi hoàn tất cũng dùng chuyển động này và trả focus về summary.
  Disclosure native còn lại có progressive enhancement và fallback mở/đóng ngay.
- Menu, Ping, gợi ý, panel, tin nhắn AI có chuyển động xuất hiện; nút có hover/press,
  dấu hoàn thành và trạng thái lưu có phản hồi. AI chờ dùng shimmer, chỉ có một
  bản văn bản cho accessibility. Các hiệu ứng mới có guard reduced motion.
- Checkbox gỡ lỗi, range xem lại, number input, select AI, marker summary và scrollbar
  terminal có skin riêng. Native popup được đặt đúng `color-scheme` theo theme.
  Hover luôn đổi cặp foreground/background tương thích, giữ màu riêng của hành động xóa.
- Hộp làm lại theo theme lab, có enter/exit cho cả hai lựa chọn. `Dialog.returnFocusRef`
  là tùy chọn mới để trả focus về summary menu đang hiển thị; caller cũ vẫn giữ cách cũ.
  Một RAF ở parent không đủ vì cleanup của Dialog có thể chạy sau đó.

### Ma trận sơ đồ

Fixture tại `src/frontend/src/features/labs/fixtures/topologyScenarios.js`, chỉ dùng
cho test/harness, không phải lab để import/chấm bài:

| Nhóm                | Trường hợp                                                    |
| ------------------- | ------------------------------------------------------------- |
| Ít thiết bị         | Rỗng, một thiết bị, chuỗi4                                    |
| Nhiều hàng          | Chuỗi10 tự xuống hàng, chuỗi8 có hai hàng được tác giả bố trí |
| Nhiều liên kết      | Lưới12/17 dây, sao9, vòng8, mesh6/15 dây                      |
| Dữ liệu khác thường | Nhiều nhóm rời nhau,8 vị trí trùng nhau, dây dọc              |
| Nhãn/trạng thái     | ID/hostname/subnet dài,3 dây song song, dây ngắt/STP          |

QA ban đầu tái hiện8 cặp thiết bị chồng và16 nhãn đè thiết bị trong lưới12.
Hiện layout tính đủ chiều cao/khoảng cách theo node và số dòng tên, chuỗi dài
đi nhiều hàng, vị trí trùng nhau có grid dự phòng. Nhãn chọn chỗ tránh node/nhãn
khác; dây song song tách thành đường cong. Animation gói tin dùng đúng cổng
FRAME và hướng đi trên chính đường cong đó. Dữ liệu/tọa độ nguồn không bị sửa.
Canvas lớn cuộn trong vùng sơ đồ có focus để còn chỗ cho terminal.

### Bằng chứng cuối

- **49 suites,367/367 test đạt**: `.tmp/lab-polish-all-verified.log`. Test geometry
  bao gồm bounds/overlap/immutability ở558 và1024px, chiều đi gói tin theo cổng,
  rapid toggle/unmount/reduced motion, hủy restart và focus. Lint/boundaries đạt.
- **90 tổ hợp browser**:15 fixture ×558/1024/1440px ×2 theme; không phát hiện
  node-node, label-label, label-node overlap hoặc tràn ngang trang.
  Dữ liệu: `.tmp/lab-polish-topology-browser-final.json`.
- **63 lượt hover** của các nhóm nút thực sự hiển thị trong workspace, menu,
  hộp xác nhận và AI; tất cả đã xác nhận trạng thái `:hover`, contrast thấp nhất
  **4.92:1**. Phép đo composite alpha và xử lý `color(srgb …)` do `color-mix` tạo.
  Dữ liệu: `.tmp/lab-polish-hover-browser.json`.
- PageDown cuộn riêng lưới12 từ0 tới khoảng120.8px. Mobile375×812 không tràn ngang,
  ô hỏi16px, đáy nút Gửi764px. Có pending ngay trong log hội thoại.
- Build CI cuối: `.tmp/lab-polish-release-build.log`. Ảnh: `.tmp/lab-polish-grid-top.png`,
  `.tmp/lab-polish-grid-bottom.png`, `.tmp/lab-polish-parallel.png`, `.tmp/lab-polish-mobile.png`.
  Header chọn kịch bản trong ảnh là harness riêng, không đưa vào ứng dụng.

Không gọi provider AI thật hoặc thay DB. Chưa kiểm bàn phím ảo trên thiết bị
vật lý; reduced motion được kiểm bằng test và guard CSS/hook, không đổi cài đặt OS.

## Đồng bộ mục tiêu và ba mức gợi ý — 01/11/2026

- NEXT_STEP lấy taskId và thiết bị từ cùng mục tiêu. Đổi terminal xóa nhiệm vụ ghim
  của router trước; chọn nhiệm vụ chuyển đúng router. Server từ chối cặp task/device
  lệch trước khi giữ quota. DIAGNOSE dùng nguồn/đích riêng, không kế thừa taskId.
- Backend lưu mức được yêu cầu (1–3), không cố định1. `taskCoaching.js` tạo recipe
  từ gradingSpec đã chụp trong attempt; không trích lệnh từ title/chat/hint tùy ý.
  Mức1 không cấp command; mức2 chỉ cú pháp đánh dấu template, không chép/chèn;
  mức3 cấp lệnh đầy đủ đã kiểm parser và simulatorVersion. Các loại check EIGRP01,
  route, ping và lưu cấu hình đã có recipe; check khác chỉ có hướng dẫn công khai,
  không tự phát sinh lời giải cấu hình. Đây là nội dung được cho phép ở mức3 theo
  yêu cầu mới, thay giới hạn chỉ quan sát của prompt cũ.
- Context mang taskFocus và thiết bị/loại/objective của progress cho NEXT_STEP;
  giữ trạng thái blocked. Facts của nhiệm vụ chỉ lấy thiết bị và dây liên quan.
  Verifier kiểm mức, command catalog và chặn chỉ dẫn nhầm router; riêng bước bật
  AS chặn lạc sang metric/delay. Prompt v3 dùng đúng focus thay tiêu đề chung.
  Đây không phải bảo đảm mọi câu văn của model đều đúng; model vẫn phải được kiểm
  trong terminal và kết quả chấm.
- Tiêu chí kiểm tra hiển thị lấy từ recipe server, ví dụ routing process R2 dùng
  AS1. Command của recipe được lưu trong kết quả sau khi câu trả lời được xác minh,
  kể cả model không gắn commandId trong nextSteps. Không tạo phản hồi dự phòng
  hoặc tự gọi lại provider khi generation lỗi.
- Khối lệnh hoàn chỉnh chỉ có nút sao chép; đã bỏ chức năng Đưa vào terminal.
  Học viên tự chọn router/mode và Ctrl+V vào CLI. Terminal nhường phím tắt paste
  cho trình duyệt và chỉ nhận text/plain từ thao tác dán; bản nháp riêng từng
  router được giữ, chỉ Enter mới gửi action. Paste không chạy lệnh, không gọi
  completion và không ghi khi chỉ đọc/đang xử lý; xuống dòng/tab thành khoảng trắng.
  Theo lựa chọn người dùng, phím tắt soạn thảo dùng Ctrl+A chọn riêng dòng đang
  gõ, Ctrl+C sao chép vùng chọn (không có vùng chọn thì hủy dòng), Ctrl+Z hoàn tác
  bản nháp; Ctrl+Y/Ctrl+Shift+Z làm lại. Nhập/dán/Backspace sau Ctrl+A thay vùng
  chọn, không gồm prompt hoặc lịch sử. Undo không hoàn tác cấu hình hay lệnh đã
  chạy; readonly/pending chặn chỉnh sửa, copy vẫn được. Theme/polling giữ draft
  và lịch sử undo; Enter/hủy dòng bắt đầu lịch sử soạn mới.
  Tăng mức chỉ cho câu trả lời cùng task/device/revision; đổi nhiệm vụ đặt lại mức1.
- Thẻ “Việc tiếp theo” có chip router, giữ ở đầu vùng cuộn khi AI mở. Gộp đề bài/
  hướng dẫn thành một accordion, tự gập khi mở AI. Heading guide16/14px, bảng12px
  với ô nowrap và cuộn ngang trong bảng. Từ1280px có nút thu gọn cột mục tiêu còn
  44px, mở lại được bằng bàn phím; tablet giữ task và AI trong cột phải, mobile
  dùng Dialog. Quick prompt thành tag; “Giả thuyết” thành “Gợi ý tham khảo”; evidence
  có preview “Dựa trên…” từ observation, không giả nhận đã chạy show. Quota/mức đặt
  ở footer dưới khung nhập, thẻ cũ giữ mức của chính câu trả lời.
- Composer thu gọn02/11: frame96px khi rỗng, tối đa172px; textarea tự giãn24–100px
  rồi cuộn. Thiết bị/loại trợ giúp/gửi cùng một khung, trigger dùng nhãn ngắn nhưng
  menu giữ mô tả đầy đủ. Bỏ Đang hỏi về/Đổi thiết bị trùng lặp; tên task giữ trong
  accessible description. Footer đổi mức trực tiếp, hiển thị lượt còn lại và đếm
  ký tự khi gần giới hạn. Phân tích kết nối vẫn có hàng chọn đích riêng; hủy yêu
  cầu nằm ngoài fieldset disabled. Giữ token sáng/tối, font mobile16px và vùng bấm
  44px trên thiết bị cảm ứng.
- Tinh chỉnh theo ảnh: ô loại trợ giúp vừa nội dung (tối đa116px), căn phải và
  cách nút gửi8px; ô chọn32px/chữ11px, textarea desktop12px, menu chọn tối thiểu184px.
  Bấm Đặt lại hội thoại đóng Tùy chọn, hiện xác nhận và focus Giữ hội thoại; hủy
  xác nhận trả focus về Tùy chọn. Chưa xác nhận thì chưa gọi API xóa hội thoại.

Kiểm thử và giới hạn:

- 385 kiểm thử frontend,249 kiểm thử Node,42 kiểm thử PostgreSQL đạt (bao gồm
  admission–claim–receipt–finalization–read của R2/mức3, trường hợp model không gắn
  commandId và các kịch bản quyền/quota cũ). Log `.tmp/task-coaching-*.log`.
- DB test local cũ lỗi file của template1; đã giữ nguyên dữ liệu và dừng cluster
  do lượt này khởi động. Dùng cluster mới độc lập trên loopback55543, chạy bản sao
  runner với guard port/root tương ứng; migration/schema/test không sửa. Cluster
  test mới dừng sau kiểm tra. Không ghi vào DB ứng dụng, không migration/regrade.
- Browser dùng component/engine thật, API/auth/phản hồi tổng hợp theo đúng recipe
  task/mức; không dùng phản hồi R1/delay cố định nữa. Đã kiểm10 tổ hợp viewport
  1440/1280/1024/768/375 × light/dark, không tràn trang; textarea/nút Gửi trong khung,
  không native select trong AI. Bảng nowrap/header16px; thu gọn rail44px; draft
  R2 chưa làm tăng progress cho tới Enter, draft R1 vẫn được giữ khi đổi router.
  `.tmp/task-coaching-layout.json` lưu số đo. Không gọi Gemini thật hoặc kiểm bàn
  phím ảo vật lý.
- Cần khởi động lại backend, Python và worker để nạp prompt/backend mới. Thao tác
  tự động dừng/khởi động các tiến trình đang chạy bị công cụ chặn `blocked by policy`;
  không có tiến trình nào bị dừng bởi lệnh bị chặn. Dừng bằng Ctrl+C ở terminal đang
  chạy rồi khởi động `node src/backend/src/Server.js` và `node
src/agent/scripts/start-dev-ai.cjs --existing-backend` (hoặc `pnpm dev:ai` khi muốn
  launcher quản lý cả backend). Không chạy thêm bản mới khi cổng cũ còn bận.

Kiểm tra cuối cho đợt này: frontend51 suites/385 test, Node249, Python315,
PostgreSQL42 đều đạt;3 suites/45 test UI liên quan được chạy lại sau chỉnh
assertions. CI build, ESLint source/test, Prettier, boundaries và schemas/fixtures
đạt. Hover nút đưa lệnh nền #334155/chữ trắng; thông báo trong code dùng
#e2e8f0 trên #0f172a. Browser đã trả viewport về mặc định và đóng tab kiểm thử.

## Tab có pill trượt — 02/11/2026

`components/ui/SlidingTabs.jsx` dùng chung cho8 nhóm: menu giới thiệu, tab thiết bị
lab, hình thức luyện thi, các mục sửa lab của admin, hướng hiển thị lộ trình,
khoảng thời gian học của profile, khoảng thời gian hoạt động admin và chế độ
lưới/danh sách bài kiểm tra. Không biến dropdown hay các lưới đáp án thành tab.

- Đọc offsetLeft/offsetWidth của nút được click; selection vẫn do caller giữ.
  Pill chuyển left/width trong400ms với cubic-bezier(0.65,0,0.35,1). Màu nhãn
  fade180ms, bắt đầu sau220ms để theo chuyển động pill.
- Chọn thiết bị từ sơ đồ cũng cập nhật pill. Mount/resize/font load căn ngay,
  không trượt từ tọa độ0. ResizeObserver theo dõi cả container và các nút,
  được dọn khi unmount/đổi danh sách; callback font muộn không chạm DOM đã đóng.
- Giữ native button/link, aria-pressed/aria-current và focus ring. Các nhóm button
  hỗ trợ mũi tên, Home/End, bỏ qua nút disabled. Nội dung dài cuộn trong thanh tab,
  chỉ cuộn ngang control để lộ lựa chọn; không kéo trang/terminal.
- Màu dùng token của từng feature. Tab lab giữ palette Stitch; active/hover không
  tô nền riêng lên từng nút để khỏi che chuyển động pill. Menu guest dùng cùng
  component, bỏ bản CSS/logic đo trùng trong header. Editor admin dùng một hàng
  tab cuộn ngang thay vì grid nhiều hàng để pill không nhảy hàng.
- CSS có prefers-reduced-motion để bỏ transition hoàn toàn; không thêm thư viện.

Kiểm chứng:52 suites/389 test frontend đạt, gồm9 test control/menu và56 test feature
liên quan; CI build, ESLint, Prettier và boundaries1936 imports/450 files đạt.
Browser48 trường hợp (8 nhóm ×1280/768/375px ×sáng/tối) đều khớp left/width dưới1px,
không tràn ngang trang. Đo màu selected có contrast thấp nhất5.56:1. Chọn R4 trên
sơ đồ đổi pill sang R4; ArrowLeft đổi sang R3. Hover tab lab giữ chữ xanh trên pill
sáng/tối, background của button trong suốt. Số đo ở `.tmp/sliding-tabs-browser.json`
và `.tmp/sliding-tabs-hover.json`; log `.tmp/sliding-tabs-*.log`.

Harness dùng component/CSS và engine thật với API/auth tổng hợp, không ghi DB hay
gọi AI. Chưa thay tùy chọn reduced-motion của OS; guard CSS đã giữ, kiểm mount/
resize và cleanup bằng unit test. Không đổi backend, chấm bài hoặc runtime AI.

## Copy icon-only với Motion — 02/11/2026

Đã thay đủ5 vị trí copy của ứng dụng bằng `AnimatedCopyButton`: ví dụ lệnh trong
tra cứu CiscoCLI, lệnh của hướng dẫn lab, mã phiên trong menu workspace, các lệnh
mẫu theo giai đoạn và lệnh trong câu trả lời AI. Không hiển thị chữ/tooltip trên
nút; aria-label và status được giữ cho trình đọc màn hình.

- Nút cố định32×32px, icon Lucide trong khung18px. Copy icon giảm opacity/scale;
  check xanh đi vào bằng spring480/22/mass0.65, có overshoot nhẹ. Sau1400ms từ
  clipboard success, icon cũ trở lại mượt. Chỉ transform/opacity của icon thay đổi,
  nội dung bên cạnh và kích thước nút giữ nguyên. Nút copy hướng dẫn lab luôn
  hiện, không còn chỉ xuất hiện khi hover; ô tra cứu chừa khoảng cho icon.
- `useClipboard` ở agent/browser là một chỗ gọi writeText, quản lý generation và
  timer. Chỉ feedback success khi Promise hoàn tất; click lại reset timer/key
  animation. Kết quả cũ, permission error muộn, đổi value hoặc unmount không đổi
  feedback mới. API thiếu hoặc bị từ chối hiển thị trạng thái lỗi và không báo check
  thành công. Chép nguyên value, giữ newline/whitespace; không thêm tên thiết bị.
- Renderer Motion/Lucide nằm trong frontend. App bridge cấp `CopyButton` cho panel
  AI giống adapter Select/Dialog; agent không import frontend/Motion/Lucide và
  không nới dependency boundary. Renderer dự phòng cho consumer agent độc lập là
  React/icon gọn, dùng cùng hook clipboard. Toàn bộ vị trí AI trong web dùng renderer
  Motion do app cấp. Public subpath `@ccna/agent-ui/clipboard` chỉ export hook/constants.
- Không thêm dependency; dùng Motion13.2/Lucide sẵn có. `useReducedMotion` bỏ scale/
  spring và chuyển trạng thái ngay. Không dùng title hoặc tooltip làm tên nút.

Kiểm chứng:53 suites/397 test frontend đạt;8 test mới bao gồm async success,
permission/unavailable, click liên tục, out-of-order, value change, cleanup và
reduced-motion. Chạy lại8 test sau sửa lint đều đạt. Build CI compiled successfully;
ESLint source/test, Prettier16 file, check:icons và boundaries1957 imports/455 files
đạt. Đã sửa thứ tự import CSS giữa trang lab/admin/AI; không tắt cảnh báo CSS order.

Browser đã xác nhận clipboard thật cho `router eigrp 1`, `enable`, mã phiên tổng hợp,
`delay 11` và `show ip route`; Enter cũng sao chép được. Khi bấm lại trước timeout,
check vẫn hiện sau deadline cũ và trở về idle sau deadline mới.20 tổ hợp
(5 vị trí×2 width1280/375×2 theme) đều giữ32px, không tràn ngang trang; trước/sau
success giữ cả tọa độ. Check xanh trên nền tối có overshoot đo được scale1.00605,
SVG màu rgb(74,222,128). Status bị clip inset(50%) và không có title.
Evidence `.tmp/animated-copy-{browser,values,matrix}.json`, ảnh dark và các log
`.tmp/animated-copy-*.log`. Chưa đổi thiết lập reduced-motion của OS, đã kiểm hook
với preference được mô phỏng trong unit test. Harness dùng dữ liệu tổng hợp,
không đổi backend, DB, grader hoặc gọi provider AI.

Bổ sung cuối: retry copy thành công tự xóa đúng thông báo lỗi copy trước đó,
không xóa lỗi CLI/AI khác. Callback success chỉ chạy cho request hiện hành sau
clipboard resolve; đã kiểm trong test pending/success. Không thêm chữ success
nhìn thấy trong nút hoặc toast.
