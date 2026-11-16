# FE-01/FE-02 — Ngăn trợ lý lab và kết nối bất đồng bộ

## Avatar chuyển động dễ nhận thấy — 16/11/2026

Avatar cũ có canvas/RAF hoạt động nhưng speed0.55, turn0.2 và jumpEvery0 làm
chuyển động quá nhẹ. Bổ sung prop `greeting` cho droid trong Home và trang
giới thiệu AI: speed1, turn1, nhún khoảng4giây/lần, vật liệu plastic để góc
quay rõ hơn. Avatar lab/chat giữ cấu hình nhẹ cũ và working theo request thật.

Bấm avatar trên mobile từng làm focus tự cuộn96,8px, đẩy hình lên sau header.
Đã dùng `focus({ preventScroll: true })`: giữ focus lời chào và scrollY0.
Ảnh động ghi64 khung canvas thật trong khoảng10,4giây:
[xem avatar](../../ui-ux/evidence/avatar-motion/avatar-greeting.gif).

Kiểm4suite/50test, chạy lại App.test sau sửa focus, ESLint/Prettier/boundaries
và CI build đạt. Browser lấy24mẫu thấy đỉnh hình thay đổi48px;18mẫu click/hop
ở320/390px nằm trọn viewport. Enter giữ focus đúng, state vẫn default;
reduced-motion cho1hình duy nhất qua3mẫu, ra khỏi viewport thì pause.
Không gọi provider/DB, không thay API/cohort. [Kết quả QA](../../ui-ux/evidence/avatar-motion/checks.json).

Cleanup ảnh/log tạm trong `.tmp` bị kiểm duyệt tự động từ chối (`blocked by policy`),
nên giữ file scratch; context browser đã đóng. GIF/JSON cuối nằm trong evidence.

## Điểm vào AI từ Home — 15/11/2026

Nút **Thực hành cùng AI** mở route công khai `/ai-assistant`. Trang có droid
động cạnh khung lời chào, giải thích AI hiện được tích hợp trong bài lab và
không gian trò chuyện riêng đang phát triển. Các nút dẫn vào lab, lộ trình và
về Home; bấm avatar bằng chuột/Enter đưa focus tới lời giới thiệu.

UI nằm trong `browser/components/AiAssistantIntro.jsx`, CSS và entry `intro.js`
của agent, xuất qua `@ccna/agent-ui/intro`. Host chỉ nối route lazy và truyền
Link. Dùng lại DroidAvatar với idle/interactive, visibility và reduced-motion;
không tạo controller, ô chat, request AI hoặc trạng thái working cho trang này.

Đã kiểm 6 suite/31 test, ESLint/Prettier/diff check, boundaries2271 imports/assets
và CI build. Browser guest/auth với fixture, desktop/mobile hai theme: CTA đúng,
0 page errors, avatar3/3 mẫu idle khác nhau và reduced-motion đứng yên. Không
thay cohort/quota/provider và chưa kiểm gọi AI bằng tài khoản thật trong lab.
Xem [báo cáo và ảnh](../../ui-ux/home-simulation-ai.md#cập-nhật-banner-và-trang-giới-thiệu-ai--15112026)
và [QA JSON](../../ui-ux/evidence/home-ai-entry/checks.json).

## Avatar xanh trong chat streaming — 15/11/2026

Dòng đang xử lý dùng avatar flower xanh, chất liệu fabric, từ bot-avatars0.2.2
đã có trong dự án, theo ảnh tham khảo. Thay chấm pulse bằng avatar30px cạnh nhãn
tiến độ; tin trả lời dùng cùng hình26px tĩnh. Header/tab vẫn giữ droid hiện hữu.
Không thêm dependency hoặc tạo luồng animation riêng cho từng tin nhắn cũ.

DroidAvatar có thêm appearance với mặc định droid, tái dùng toàn bộ gating
visible/document-hidden/IntersectionObserver/reduced-motion và fallback SVG.
AiLabPanel dùng assistantIsWorking cho cả avatar và shimmer, chỉ chạy khi đang
gửi hoặc request QUEUED/RUNNING thật, có kết nối và không lỗi. Avatar không được
key theo progress phase nên giữ instance khi PREPARING_CONTEXT→ANALYZING→FINALIZING.
COMPLETED/hủy/lỗi bỏ avatar khỏi dòng xử lý; avatar của câu trả lời luôn paused.
Icon là trang trí aria-hidden, trạng thái vẫn có chữ và vùng live đặt tên rõ.

SSE hiện truyền tiến độ/request resource; nội dung câu trả lời xuất hiện khi
server hoàn tất. Đợt này chỉ tích hợp hình biểu diễn vào luồng đó, giữ nguyên
controller, parser, API, nội dung trả lời và các quy tắc chấm lab.

4 suite/74 test đạt, gồm SSE progress, giữ instance, ẩn/mở, hoàn tất/lỗi/hủy và
mặc định droid. ESLint/Prettier, boundary2222 imports/assets/525 files, diff check
và CI production build đạt. Browser1366×768,390×844,320×740 kiểm light/dark:

- SSE fixture dạng ReadableStream đi qua parser/controller thật; không gọi
  provider/DB. PREPARING/ANALYZING/FINALIZING có avatar working đúng dữ liệu.
- Canvas working đổi8/8 mẫu; ẩn panel hoặc reduced-motion giữ nguyên ảnh,
  shimmer và text entrance cũng dừng khi giảm chuyển động.
- Hoàn tất có0 avatar working, avatar câu trả lời là flower/default/paused và
  ảnh giữ nguyên. Hủy hoặc HTTP503 cũng có0 avatar working, header về default.
- Icon30px, ô hỏi và nhãn nằm trong viewport mobile; không tràn ngang. 0 page errors.

File sửa: `src/agent/browser/components/DroidAvatar.jsx`, `AiLabPanel.jsx`,
`AiMessage.jsx`, `styles/AiLab.css`; regression tests `AiLabAssistant.test.jsx`
và `DroidAvatar.test.jsx` trong frontend. Không sửa Footer, dữ liệu bài IP,
engine, API hoặc dependency. Giới hạn: chưa nghiệm thu provider/tài khoản thật.

Ảnh [desktop](../../ui-ux/evidence/lab-workspace-v2/streaming-avatar-desktop.png),
[mobile](../../ui-ux/evidence/lab-workspace-v2/streaming-avatar-mobile.png),
[kết quả browser/test](../../ui-ux/evidence/lab-workspace-v2/streaming-avatar-checks.json).

## Một nơi điều hướng AI trong lab — 15/11/2026

Host sidebar sở hữu dải Mục tiêu/AI và nút thu gọn. Header chính chỉ có một nút
mở lại khi sidebar đóng; mobile dùng nav thực hành. Embedded AiLabPanel và
AssistantLoader bỏ hàng tên/avatar/đóng bên trong ở cả loading/error/ready.
Giữ aria-label Trợ lý AI cho vùng chat, avatar ở tab và cạnh tin nhắn.

Tùy chọn đặt dưới composer, mở lên trên và có fallback khi composer bị khóa.
Mức gợi ý vẫn dùng điều kiện canAsk; menu reset/privacy không bị fieldset đang
pending vô hiệu hóa. Escape đóng menu trước, lần tiếp theo thu gọn panel. Chọn
AI tăng focusRequest để focus lại ô hỏi sau khi load xong; không tự gửi request,
không reload capabilities hoặc remount controller khi đổi pane. Bỏ effect khôi
phục focus của standalone trong embedded để không kéo focus khỏi tab mới.

Giữ chiều rộng chat380–480px, avatar tương tác và trạng thái working theo callback
thật. Browser đã kiểm bản nháp qua đóng/mở, options/focus/Escape, RUNNING khi
sidebar đóng, COMPLETED và lỗi503 trở về default, idle canvas động và reduced
motion dừng hình. Metadata tiến độ và phản hồi AI là fixture, không gọi provider
hoặc ghi DB thật. Standalone giữ header và hành vi đóng/focus cũ.

11 suite/98 test liên quan gồm workspace, panel, loader, avatar, sequence và
playback; lint/format/boundaries/icons và CI production build đạt. Source sửa ở
`src/agent/browser/components/AiLabPanel.jsx`, `AssistantLoader.jsx`,
`styles/AiLab.css`; host wiring và regression tests trong frontend.

Ảnh [chat](../../ui-ux/evidence/lab-workspace-v2/lab-navigation-ai.png),
[probe đúng ngữ cảnh](../../ui-ux/evidence/lab-workspace-v2/lab-navigation-probe.png),
[QA và giới hạn](../../ui-ux/evidence/lab-workspace-v2/lab-navigation-journey-checks.json).
Chi tiết bố cục/hành trình: [lab workspace](../../ui-ux/lab-workspace.md).

## Nới khung chat và căn dải tab — 15/11/2026

Host CLI lab tăng sidebar khi chọn AI lên clamp380px/32vw/480px, không sửa width
hook hoặc lifecycle của package. Chat ở1366px tăng327→436px; mobile vẫn full-width.
Dải tab thu theo nội dung, bỏ nền kéo dài, hai nút bằng chiều cao và header44px
ngang với vùng sơ đồ. Khi có ba tab, giấu bộ đếm thị giác để tránh scrollbar đẩy
lệch header; aria vẫn đọc tiến độ. Giữ avatar tương tác và animation SlidingTabs.

3 suite/59 test liên quan, lint/format và CI build đạt. Browser desktop/tablet/
mobile320–390, sáng/tối/giảm chuyển động, bàn phím và animation đều được kiểm.
Giữ lệnh/bản nháp/sự kiện9 khi đổi tab và resize; QA dùng fixture, không gọi model.
Hai source file ở host: `CliLabWorkspace.js`, `LabWorkspaceLayout.css`.
Ảnh và số đo: [báo cáo workspace](../../ui-ux/lab-workspace.md).

## Bổ sung tương tác avatar — 15/11/2026

Trước đó wrapper đặt `interactive=false`, `max-width:100%` lên canvas overscan và
contain paint. Avatar có idle/working nhưng không nhìn theo con trỏ, không phản
ứng khi bấm; khung vẽ cũng bị bó lại. Hiện tại dùng pointer-follow/click-hop của
chính bot-avatars, không viết engine animation mới hoặc giả lập trạng thái AI.

- Rê con trỏ gần avatar: đầu/mắt nhìn theo. Bấm/chạm/Enter/Space trên nút AI:
  nhảy nhẹ và nghiêng; nút mở/đóng chỉ chạy một lần. Forward click qua canvas công
  khai của thư viện, chặn bubble của click được forward để tránh lặp hành động.
- Avatar ở header panel là nút “Đặt câu hỏi cho Trợ lý AI”, vùng bấm44×44; bấm
  đưa focus vào composer. Các avatar nằm trong nút có sẵn vẫn là span, không
  lồng button. Avatar tin nhắn cũ giữ tĩnh.
- Canvas giữ overscan đúng tỷ lệ, pointer-events:none để phần trong suốt không
  chặn tab bên cạnh. Không dùng paint containment cắt cú nhảy. Không thêm timer
  hay loop motion ở ứng dụng; vẫn dùng RAF chung của thư viện.
- Hidden/offscreen/document hidden/reduced-motion tiếp tục dừng canvas và bỏ
  tương tác; nút vẫn thực hiện hành động. Hover/click không đổi busy và không
  gửi câu hỏi. Khi request đang RUNNING, click avatar vẫn giữ working.

3 suite/62 test đạt: pointer và bàn phím không gọi action hai lần, static/hidden/
reduced-motion ngừng phản ứng, dọn listener, focus composer, AI lifecycle và
workspace regression. ESLint/Prettier/boundaries và CI production build đạt.
Browser canvas thật: mắt dịch3.36px khi chuyển con trỏ trái/phải, cú nhảy có9.1px
biên độ qua151 frame. Mobile touch390/320px focus đúng, không tràn/cắt nút và giữ
draft; nhấn sát mép tab Mục tiêu không bị canvas của AI chặn. API/auth dùng fixture,
không gọi provider/DB thật. Các gesture không phát sinh POST AI.

Ảnh [desktop](../../ui-ux/evidence/lab-workspace-v2/avatar-interaction.png),
[mobile](../../ui-ux/evidence/lab-workspace-v2/avatar-interaction-mobile.png),
[số đo và kết quả](../../ui-ux/evidence/lab-workspace-v2/avatar-interaction-checks.json).
File sửa: `DroidAvatar.jsx`, `DroidAvatar.css`, `AiLabPanel.jsx` trong browser
package; `DroidAvatar.test.jsx`, `AiLabAssistant.test.jsx` ở bộ test frontend.

## Cập nhật workspace và avatar — 15/11/2026

AI trong CLI Lab hiện mở bằng tab sidebar dùng chung với Mục tiêu; mobile dùng
tab toàn vùng, không còn yêu cầu dùng laptop. Chế độ standalone của package vẫn
có drawer/dialog như trước. Phần mô tả28/10 bên dưới ghi lịch sử triển khai.

- `AiLabPanel` nhận `embedded`, `visible`, `onActivityChange`. Embedded bỏ resize
  riêng và modal mobile; host quản lý layout. Đổi tab/đóng sidebar giữ component,
  draft, conversation và controller. Document hidden/offline/scope mới vẫn theo
  lifecycle controller cũ; đóng tab nội bộ không giả lập hoàn tất request.
- `assistantIsWorking` lấy online/error/phase/pending/status thật. Callback cho
  header phản ánh yêu cầu còn xử lý khi AI bị thu gọn. COMPLETED hiển thị “Đã trả
  lời.”; lỗi có alert hiện hữu và avatar trở về trạng thái thường.
- `DroidAvatar` xuất qua `@ccna/agent-ui/avatar`. Dùng droid của
  [bot-avatars](https://libraries.dev/bots), pin0.2.2/MIT/React>=18; dự án React18.3.1.
  Có idle/working thật trên canvas, dừng khi giảm chuyển động, document hidden,
  không trong viewport hoặc host báo invisible. Tin nhắn cũ dùng avatar tĩnh.
  Không đưa code agent vào frontend; bridge ứng dụng tiếp tục dùng package entry.
- `package.json` browser và lockfile thêm đúng dependency trên; checker allowlist
  thêm `bot-avatars`, vẫn chặn Node/backend/frontend implementation.
- UI QA dùng response fixture đúng contract để ép RUNNING→COMPLETED và503. Đã đo
  canvas idle/working thay đổi, hidden/reduced-motion đóng băng; hoàn tất khi đóng
  sidebar cập nhật header; mở lại không tải lại capabilities hoặc mất bản nháp.
  NEXT_STEP/DIAGNOSE/EXPLAIN_CONCEPT giữ validation/API/state đang xử lý hiện có.
- 14 suite/110 test frontend đạt, có test activity callback sending→completed/lỗi
  khi embedded bị ẩn, draft/controller giữ nguyên, terminal/probe/replay regression.
  ESLint/format/boundaries và CI production build đạt; không gọi provider hoặc DB.

Ảnh, số đo desktop/mobile, giới hạn kiểm chứng và danh sách file:
[báo cáo workspace](../../ui-ux/lab-workspace.md).

## Bản triển khai ban đầu — 28/10/2026

Ngày28/10/2026. Trạng thái: hoàn thành triển khai và kiểm local/fake; chưa mở
provider/cohort hoặc nghiệm thu pilot. UX-01 làm trước, xem
[wireframe/copy/walkthrough](UX-01-assistant-design.md).

## Thay đổi cho học viên

- Mở **Trợ lý lab** trên thanh phiên hoặc **Hỏi trợ lý** trong gợi ý. Mobile có
  **Mở trợ lý lab** ở thông báo dùng máy tính; CLI vẫn giữ điều kiện laptop.
- Ngăn desktop phủ đúng vùng nhiệm vụ370/320px, không đổi grid hoặc kích thước
  terminal. Phần nhiệm vụ bên dưới inert, terminal tiếp tục gõ được khi chờ AI.
  Mobile dùng Dialog chung, Tab/Escape và trả focus. Có loading riêng khi tải ngăn.
- Ba ý định, mức gợi ý do người học đề nghị, trường nguồn/đích khi chẩn đoán,
  nội dung câu hỏi có giới hạn. Không có chat tự do ngoài các ý định R1.
- Trả lời là plain text do React escape; nguồn AI/hệ thống, độ chắc chắn,
  bằng chứng/thiết bị, tối đa hai bước, lệnh đọc có Sao chép và cách kiểm tra lại.
  Không render HTML, link tự sinh, ảnh từ xa hoặc nút Chạy lệnh AI.
- Hiện revision cũ theo phiên bản nguồn và live/server hiện tại; thay đổi lab
  không tự gọi model. Bấm Kiểm tra lại mới tạo câu hỏi theo cấu hình hiện tại.
- Đánh giá hữu ích/chưa hữu ích có lý do, lưu qua server. Disclosure dữ liệu mở
  lần đầu khi chưa có hội thoại, có thể đọc lại. Không gọi AI là nguồn chấm điểm.
- Đang đọc lịch sử thì không tự cuộn theo response; có Tin mới. Tải trang cũ
  giữ vị trí đọc, có retry lịch sử riêng. Offline giữ draft trong tab.

## Vị trí code và điểm nối

Theo Agent.md, triển khai AI nằm trong `src/agent`, không đặt logic AI ở frontend:

| Phần                    | File                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| Package browser-only    | `src/agent/browser`, tên `@ccna/agent-ui`                        |
| UI/renderer/CSS         | `components/AiLabPanel.jsx`, `AiMessage.jsx`, `styles/AiLab.css` |
| HTTP client             | `api/aiLabApi.js`                                                |
| State/lifecycle         | `state/assistantController.js`, `hooks/useAiLabAssistant.js`     |
| Ghép ứng dụng           | `CliLabWorkspace.js`, bridge `AiLabAssistant.jsx`                |
| History/feedback        | `src/agent/node/conversation.js`, `routes/aiLab.js`              |
| Biên dịch JSX workspace | `src/agent/scripts/frontend-browser.cjs`, wrapper CRA            |
| CORS ứng dụng           | `Server.js`: expose contract version/Retry-After/Location        |

Browser package chỉ dùng React và contract browser-safe. Boundary checker chặn
import Node/backend/frontend implementation và các package máy chủ từ UI này.
CRA chỉ thêm đúng thư mục browser vào Babel/ModuleScope, không mở toàn agent.
Không eject, không sửa code thư viện trong node_modules hoặc mang provider/DB/key vào bundle.
Hai entrypoint JS mỏng tương thích Jest27; source JSX vẫn ở browser package.

Lockfile chỉ thêm liên kết workspace, không thêm thư viện bên ngoài. Đã kiểm
frozen lockfile bằng `--lockfile-only`; không tuyên bố đã clean-install toàn repo.
CI thêm kiểm controller/API và lint browser package; các frontend tests mới tự
được chọn bởi suite hiện hữu. Chưa chạy workflow mới trên GitHub.

## Vòng đời câu hỏi và quyền riêng tư

1. Tải capabilities/quota, history đúng hội thoại/epoch. Không tạo hội thoại qua GET.
2. Tạo clientRequestId bằng UUID trước POST, lưu metadata ID theo user/attempt
   vào sessionStorage; không lưu token, câu hỏi hoặc câu trả lời ở đó/localStorage.
3. POST nhận202 hoặc200; pending poll theo2/3/5/8giây với jitter và pollAfterMs,
   tôn trọng Retry-After dài hơn. GET không tạo model call.
4. Mất response hoặc reload: tìm theo by-client-id. Chỉ retry POST cùng body/ID
   khi người học bấm retry và lookup chưa tìm thấy; không tự tạo ID mới. Mất cả
   payload sau reload thì chỉ tìm ID cũ hoặc yêu cầu xác nhận câu hỏi mới.
5. Close/hidden/offline/unmount abort IO và dừng timer; mở lại chỉ có một vòng
   poll. Hủy trước khi ACK được giữ trong memory và gửi cancel ngay khi có ID.
6. Auth/attempt scope mới có snapshot và local draft mới ngay từ render;
   response muộn bị bỏ theo generation. Conversation/history epoch lệch hoặc
   thu hồi quyền xóa nội dung đang hiển thị và vô hiệu hóa response cũ.
7. Trạng thái terminal không bị GET cũ đưa về RUNNING. OUTCOME_UNKNOWN không
   tự gọi model lại. Lỗi quota/503 xác định không bị coi nhầm là đã nhận câu hỏi.

Client kiểm envelope/header version, schema và binding evidence/command trước
render. Mỗi thao tác server vẫn kiểm JWT/session/current membership/cohort và
conversation owner. Cache trong memory thuộc một scope; lịch sử server là nguồn
phục hồi, chủ lab nhóm không được đọc hội thoại riêng của thành viên.

## Bổ sung backend cần cho FE-02

History và feedback đã có schema nhưng chưa có runtime route. Đã bổ sung:

- `GET /api/lab-attempts/:id/ai/messages`: limit1–50, cursor HMAC gắn môi trường,
  người dùng, attempt, conversation và epoch; thứ tự `(createdAt,id)` ổn định.
- `POST .../messages/:messageId/feedback`: chỉ assistant message đúng chủ/epoch,
  upsert theo user/message, kiểm body bằng schema, lọc nội dung comment.
- CORS expose custom headers để strict client hoạt động khi frontend/API khác
  origin; không thay danh sách origin được phép hoặc đưa token vào query.

Contract FeedbackRequest hiện cho comment1000code point nhưng cột cũ chỉ500.
Thêm migration `20261028123000_ai_feedback_comment_capacity` nâng VARCHAR1000;
không cắt comment âm thầm hoặc thay wire contract1.0.0. Chỉ migrate trên hai DB
thử do runner tạo/xóa đúng OID. Chưa áp migration này lên DB ứng dụng/production.
UI R1 chỉ thu helpful/reasonCode, không mở ô comment tự do.

## Kiểm tra và bằng chứng

- Controller/API:16test, gồm double-submit, mất ACK/reload, retry cùng payload,
  auth/late response, hidden/offline/close, cancel trước ACK và race GET/cancel,
  revoke history, invalid input,503, Retry-After, chặn GET chồng nhau và tái kiểm
  quyền khi lookup404 để không nhầm mất quyền với câu hỏi chưa được nhận.
- Frontend targeted:20test ở2suite (6test trợ lý +14test workspace hiện có),
  gồm HTML/script/URL nguy hiểm inert, copy/feedback, stale, diagnose input,
  đổi auth xóa draft, offline, không cuộn khi đọc và hồi quy replay/preview/CLI.
- Toàn bộ frontend qua wrapper mới:37suite/286test đạt; không chỉ kiểm ngăn mới.
  Dialog thêm một regression test cho summary và vùng lịch sử có tabindex0;
  workspace loại controls inert khỏi vòng Tab khi ngăn phủ vùng nhiệm vụ.
- Node hồi quy `test:ai`:224test đạt. CLI:76đạt/1DB opt-in skip.
- PostgreSQL/HTTP runner:17fresh +17upgrade +37access/admission/context/worker
  test/subtest đạt; gồm private history ở lab nhóm, cursor chéo/tamper, feedback
  owner/upsert/comment1000, remove member và revoke session. Migrate/rollback
  compatibility đã chạy trên DB thử, không dùng DB học viên.
- Contract artifacts:17schema không đổi; source boundaries và lint/format đạt.
- Production build qua wrapper CRA thành công. AI nằm trong chunk lazy riêng;
  bundle Home không nhúng panel. Bản preview tách entry chỉ để QA local.
- Browser dùng fixture tổng hợp: terminal310px cao,1009,2px rộng giữ nguyên trước/
  sau mở; gõ CLI trong lúc chờ vẫn tăng revision, stale hiện và cancel hoạt động.
  Desktop đủ hai theme, panel370px không phủ lên terminal, focus trả điểm mở.
- Browser mất response rồi tải lại: tra by-client-id, phục hồi câu hỏi và đáp án,
  POST delta=1. Đổi tài khoản không hiện câu hỏi trước. Mobile375/320px kiểm
  Dialog, focus trap/Tab/Escape, theme và không tràn ngang. Thử API qua hai cổng
  riêng để kiểm CORS/header version, không chỉ fixture cùng origin.

Runner/log/JSON/ảnh ở `.tmp/ai-ui-20261028/`; DB evidence trong `.tmp/ai-lab-be01/`.
Không có model/provider thật được gọi trong task này. Các log có warning tooling
fs.F_OK/pg hiện hữu; không tính warning là test fail. Chưa kiểm screen reader/
thiết bị touch thật, benchmark nhiều người hoặc chất lượng Gemini tiếng Việt.
Browser fixture không thay kiểm full browser ↔ DB ↔ Python ↔ Gemini; phần đó ở
QA/GATE, không được suy ra từ các test riêng đã đạt.

## Phần giữ ở task khác

BE-06 còn đường legacy `/explain` và loading của nút cũ; không dùng lại đường đó
cho panel mới. BE-08 còn xóa/purge/retention, nên chưa có nút xóa giả. FE-03/QA/OPS
còn hoàn thiện UX/policy/eval/rollout và vận hành. Worker/provider/cohort vẫn mặc
định theo cấu hình hiện có; hoàn thành ba task này không tự bật model hay pilot.

Sau FE-01/02, môi trường dev riêng `admin-test` ban đầu được bật bằng fake
worker cho ADMIN. Theo yêu cầu gọi thật ngày 28/10/2026, app đã chuyển sang
`app-gemini` qua Python; smoke HTTP đạt `COMPLETED/LLM` với usage/chi phí thật.
Xem [cấu hình, cách test, ngân sách và bằng chứng](admin-test-access.md).
Đây là thay đổi sau task giao diện; chưa phải nghiệm thu browser ↔ Gemini
hoặc mở pilot học viên.

Xem [phân tích độ trễ từng chặng](latency-analysis.md) để phân biệt queue,
countTokens, Google generation, receipt và polling; timeout55giây là giới hạn,
không phải thời gian chờ cố định của UI.
