# AI Lab Assistant — Kế hoạch triển khai sản phẩm dài hạn

**Ngày lập:** 16/10/2026 · **Phiên bản tài liệu:** 1.0 · **Trạng thái:** đang triển khai, PY-02 đã kiểm kỹ thuật local và một lượt Gemini thật; chưa mở pilot.

**Nguồn lực đã xác nhận:** một người phát triển, có AI hỗ trợ. Kế hoạch không giả định ba lập trình viên làm đồng thời. Các vai trò PM, SO và SE dưới đây là ba trách nhiệm do cùng một người đảm nhiệm; trong tài liệu này, **SO được hiểu là Solution Owner**, chịu trách nhiệm chất lượng giải pháp, chi phí và khả năng vận hành.

**Kết quả cần tạo:** trợ lý học lab hiểu trạng thái simulator, giúp học viên tự tìm và sửa lỗi, có lịch sử, bằng chứng, hạn mức chi phí và khả năng vận hành lâu dài. Bước tiếp theo là agent lựa chọn công cụ chẩn đoán chỉ đọc, khi đã chứng minh được giá trị so với luồng trợ lý cố định.

**Vị trí code từ 26/10/2026:** toàn bộ triển khai task AI/agent nằm trong
[`src/agent`](../../src/agent/README.md), cùng cấp với backend/frontend. BE-01…05,
SIM-01, worker, routes, contracts, công cụ và evals đã được chuyển về đây; các task
PY tiếp theo triển khai trong `src/agent/python`. Báo cáo task vẫn ở bộ tài liệu này.

## 1. Cách sử dụng bộ kế hoạch

**Cập nhật PY-02 ngày 26/10/2026:** [worker và Python đã gọi Gemini thật](baseline/PY-02-provider.md)
trên DB thử riêng bằng một câu hỏi tổng hợp. Có preflight token đầy đủ, Pydantic
giữ schema chung, receipt retry riêng và ledger chi phí dùng chung. 250 Python,
274 hồi quy Node, 34 storage và 42 HTTP/DB đạt. [ADR-010](adr/ADR-010-python-local-gemini.md)
giới hạn phần gọi thật ở local; worker/Python mặc định tắt, UI hội thoại và pilot
vẫn theo các task còn lại.

**Cập nhật PY-01 ngày 26/10/2026:** [dịch vụ Python nội bộ](baseline/PY-01-service.md)
đã có môi trường khóa phiên bản, health, xác thực Node, giới hạn dữ liệu/deadline
và nhánh fake. Đã kiểm HTTP thật bằng dữ liệu giả; worker transport/provider đầy
đủ được bổ sung ở PY-02 theo cập nhật bên trên. Đây là kết quả tại mốc PY-01.

| Tài liệu                                                       | Trả lời câu hỏi                                                   | Đầu ra sử dụng khi triển khai                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [01 — Sản phẩm và trải nghiệm học](01-product-and-learning.md) | Làm cho ai, giải quyết vấn đề nào, thành công nghĩa là gì?        | PRD, user stories, chính sách gợi ý, tiêu chí nghiệm thu sản phẩm      |
| [02 — Kiến trúc và hợp đồng](02-architecture-and-contracts.md) | Xây thế nào, dữ liệu và quyền đi qua đâu?                         | ADR, mô hình dữ liệu, API, request state machine, quota, tool contract |
| [03 — Backlog và lịch triển khai](03-delivery-backlog.md)      | Làm việc nào trước, mất bao nhiêu công, hoàn thành bằng cách nào? | Issue có phụ thuộc, giờ công, file dự kiến và điều kiện nghiệm thu     |
| [04 — Chất lượng và vận hành](04-quality-and-operations.md)    | Chứng minh đúng, phát hành, giám sát và xử lý sự cố ra sao?       | Test matrix, AI eval, SLO, capacity, ngân sách, release gates, runbook |

Đọc theo thứ tự 01 → 02 → 03 → 04. Khi bắt đầu một task, cập nhật `todo.md` theo [Agent.md](../../Agent.md), chọn đúng issue trong backlog, ghi bằng chứng nghiệm thu và cập nhật quyết định nếu khác kế hoạch. Những file, endpoint, biến môi trường mới được nhắc trong bộ tài liệu đều là **đề xuất sẽ tạo**, trừ khi ghi rõ “hiện có”.

**Tiến độ 22/10/2026:** DISC-01 hoàn thành kiểm kê; DISC-02 bỏ qua theo yêu cầu; DISC-03 hoàn thành [chứng nhận kỹ thuật local](labs/DISC-03-certified-labs.md). ADR-01 đã chốt bảy ADR và [contract v1.0.0](../../src/agent/contracts/ai-lab/v1/README.md), có kiểm frontend/Node/Python và gate CI. [OPS-00](ops/OPS-00-local-fake.md) hoàn thành nhánh local/fake theo lựa chọn **0 USD**, có DB thử riêng được kiểm restart/ghi/rollback; Gemini là ứng viên tương lai, chưa có quota tài khoản hoặc quyền gọi thật. [ADR-008](adr/ADR-008-local-fake-deployment.md) cho phép tiếp tục **BE-01** bằng fake; G0 đầy đủ, staging ứng dụng, AI runtime và pilot chưa nghiệm thu.

**Tiến độ 23/10/2026:** [BE-01 hoàn thành local](baseline/BE-01-storage.md): 11 model AI, metadata nullable, migration mới/nâng cấp giữ nguyên dữ liệu 25 bảng cũ; 34 kiểm thử DB đạt và client cũ đọc/ghi được. Đã thêm gate CI, chưa áp migration DB ứng dụng/production. **Task tiếp theo: BE-02 — quyền và snapshot attempt.**

## 2. Các quyết định định hướng

**Mốc SIM-01 ngày 26/10/2026:** [SIM-01 hoàn thành bộ chẩn đoán ba lab local/fake](baseline/SIM-01-diagnostics.md). Dùng simulator thật trên bản sao để kiểm cổng/link, subnet, route đi/về và VLAN. Kết luận mạnh phải đúng mẫu và bằng chứng nguồn–đích Node đã tính. Tại mốc SIM-01: 36/36; tổng unit/contract 158/158, storage 34/34 và HTTP/DB 36/36 đạt. PY-01/PY-02 được bổ sung sau theo cập nhật bên trên.

**Mốc BE-05 cùng ngày:** [đã hoàn thành lọc dữ liệu và kiểm câu trả lời local/fake](baseline/BE-05-context-output.md). Worker dùng bản chụp lab đã lọc, lịch sử đúng chủ/epoch, bằng chứng quan sát và catalog lệnh đọc. Đầu ra sai không được giữ text, chi phí vẫn được theo dõi. Kết quả tại mốc này: 121 unit/contract, 34 storage và 35 HTTP/DB đạt; SIM-01 bổ sung sau theo cập nhật ở trên.

**Tiến độ 23/10/2026:** [BE-04 hoàn thành worker local/fake](baseline/BE-04-worker.md), có lease/fence/reaper, service-authenticated permit/receipt, shared slots, settlement/reconcile và cancel. Kiểm crash/race/CLI bằng hai process cùng PostgreSQL riêng. BE-05 được bổ sung sau theo cập nhật ở trên.

**Tiến độ BE-03 23/10/2026:** [Admission local](baseline/BE-03-admission.md) có request/status/capabilities/quota API và kiểm đồng thời qua hai Node process.

**Tiến độ mới 23/10/2026:** [BE-02 hoàn thành nền local](baseline/BE-02-access-snapshot.md), có guard và snapshot/provenance, kiểm HTTP/DB trên ba lab mẫu. Tiếp theo **BE-03**. Endpoint giải thích hiện có đã qua HTTP test deterministic; UI hội thoại R1 chưa nối API.

**Yêu cầu mới 22/10/2026:** đã cấu hình và gọi thử **Gemini thật** cho nút Giải thích kết quả local theo [ADR-009](adr/ADR-009-local-live-gemini.md), có cap ngày/tháng/toàn ledger và 20 lần thử. Quyết định này thay fake-only cho chức năng đó; chưa triển khai trợ lý hội thoại async hoặc mở production/pilot. Key chỉ ở server env bị ignore. Tiến độ task nền xem cập nhật BE-01 ngày 23/10 ở trên.

| ID  | Quyết định                                                                          | Lý do / điều kiện xem lại                                                                       |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| D01 | Giữ React + Express + Prisma/PostgreSQL; thêm Python + FastAPI cho AI               | Phù hợp định hướng AI lâu dài, vẫn tái sử dụng domain hiện có                                   |
| D02 | Node sở hữu quyền, snapshot, simulator, diagnostics và grading                      | Một nguồn sự thật cho trạng thái mạng; Python không viết lại network engine                     |
| D03 | Python sở hữu prompt, provider adapter, output schema và orchestration              | Có thể thay model và phát triển agent mà không thay quyền/domain của Node                       |
| D04 | Request AI được lưu bền vững trước khi gọi provider; public API bất đồng bộ         | Reload, timeout và retry không làm mất trạng thái hoặc gọi model tùy tiện                       |
| D05 | PostgreSQL quản lý queue, quota và cost reservation ban đầu                         | Dùng hạ tầng đã có; hoạt động qua nhiều replica. Chỉ thêm Redis/queue riêng khi đo được nhu cầu |
| D06 | Hội thoại riêng theo người học + attempt                                            | Làm lab nhóm không tự động chia sẻ câu hỏi, lịch sử hay phản hồi cá nhân                        |
| D07 | R1 dùng luồng chẩn đoán xác định + AI giải thích; R2 thêm lựa chọn tool có giới hạn | Có nền đo chất lượng trước khi tăng số bước, quyền và chi phí                                   |
| D08 | Model/provider chọn bằng bộ eval và ngân sách                                       | Chưa có ngân sách/model được người dùng chốt; không mặc định mua một dịch vụ                    |
| D09 | Phát hành theo lab được chứng nhận và nhóm học viên                                 | Có thể sửa nội dung, prompt và vận hành trước khi mở rộng                                       |
| D10 | Hạ tầng bảo mật, dữ liệu và quota nằm trong luồng đầu tiên                          | Tính năng pilot dùng lại nền tảng production, tránh phải thay toàn bộ sau pilot                 |

## 3. Hiện trạng đã đối chiếu trong workspace

**Cập nhật 19/10/2026 — DISC-01 đã hoàn thành kiểm kê:** xem [baseline local/main/staging/production](baseline/DISC-01-platform-baseline.md), [sổ issue nền tảng](baseline/DISC-01-blockers.md) và [ADR-000](adr/ADR-000-platform-baseline.md). PR #9 đã merge; source main có cùng tree với local HEAD. Frontend production và API readiness đã được kiểm tra, còn revision backend, staging cách ly và một số bằng chứng vận hành chưa xác minh. Đây chưa phải nghiệm thu pilot AI. Bảng dưới giữ nguyên bối cảnh khảo sát ngày 16/10; dùng baseline mới khi bắt đầu task tiếp theo.

Đây là kết quả đọc **working tree local ngày 16/10/2026**. Nhiều thay đổi còn chưa commit; tài liệu này không khẳng định chúng đã merge, chạy trên GitHub hay triển khai production. Phiên soạn kế hoạch không truy cập dữ liệu người học production.

| Thành phần hiện có                                                 | Bằng chứng code                                                                                                                               | Tác động đến kế hoạch                                                                                                |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Lab có `definition`, `deviceState`, `simulatorVersion`, members    | [schema.prisma](../../src/backend/prisma/schema.prisma), [labAttemptController.js](../../src/backend/src/controllers/labAttemptController.js) | Tái sử dụng snapshot `initialState/gradingSpec`; bổ sung ngữ cảnh AI đã lọc, không sao chép cả definition vào prompt |
| Snapshot definition chưa chứa đầy đủ title/objective công khai     | `startAttempt` lưu initialState và gradingSpec; DTO đọc title/objective từ Lab                                                                | Lưu public metadata/version dùng cho AI; đánh dấu provenance cho attempt cũ, không dựng lịch sử giả                  |
| Có revision và khóa attempt khi ghi                                | [attemptAccess.js](../../src/backend/src/simulation/attemptAccess.js), `executeAttemptCommand`                                                | Chụp snapshot trong transaction ngắn; gọi AI sau khi thả khóa                                                        |
| Có lab nhóm và replay                                              | Routes/controller/workspace                                                                                                                   | Mỗi lần đọc AI vẫn kiểm quyền hiện tại; replay không được gửi nhầm trạng thái live                                   |
| Progress đã loại `expected/actual`                                 | [labProgress.js](../../src/backend/src/simulation/labProgress.js)                                                                             | Dùng DTO này làm cơ sở, thêm allowlist và kiểm thử độc lập                                                           |
| Chấm điểm và truyền gói thuộc Node                                 | [gradingEngine.js](../../src/shared/simulation/gradingEngine.js), [networkEngine.js](../../src/shared/simulation/networkEngine.js)            | AI không sửa điểm; mô phỏng đọc phải chạy trên bản sao                                                               |
| AI `/explain` có gọi provider trực tiếp                            | [labFeedback.js](../../src/backend/src/simulation/labFeedback.js)                                                                             | Cần đóng đường gọi tốn phí bỏ qua quota mới; giữ fallback tương thích trong quá trình chuyển                         |
| CLI UI dùng `busy`, có preview/replay                              | [CliLabWorkspace.js](../../src/frontend/src/features/labs/components/CliLabWorkspace.js)                                                      | AI có state riêng; không khóa terminal khi chờ                                                                       |
| Xác thực đọc trạng thái tài khoản và session version               | [auth.js](../../src/backend/src/middleware/auth.js)                                                                                           | Tái kiểm ở lúc nhận, trước dispatch và lúc đọc kết quả; job không chỉ tin JWT cũ                                     |
| Local đã có migration + migrate service + restore script           | [compose.yaml](../../compose.yaml), [operations.md](../operations.md)                                                                         | Mở rộng migration/backup hiện hữu; xác minh rollout nền tảng trước pilot                                             |
| CI local đã tách preview/production Vercel                         | [ci-cd.yml](../../.github/workflows/ci-cd.yml)                                                                                                | Còn phải có pipeline container cho Node worker/Python và smoke test cả stack                                         |
| Backend CLI limit theo user, store mặc định trong process          | [rateLimiter.js](../../src/backend/src/middleware/rateLimiter.js)                                                                             | Quota AI phải dùng store chung; không coi limiter RAM là hạn mức toàn cụm                                            |
| Nginx scale giới hạn `/api/lab-attempts/` 4 request/s/IP, burst 24 | [nginx.scale.conf](../../docker/nginx.scale.conf)                                                                                             | Polling AI tăng tải chung NAT. Kiểm thử và quyết định chính sách edge là điều kiện trước pilot lớp học               |
| Chưa có service Python, bảng hội thoại AI, durable request/quota   | Đối chiếu file và schema hiện tại                                                                                                             | Phải xây mới, không đánh dấu hoàn thành vì đã có AI feedback                                                         |

## 4. Trách nhiệm của ba vai trò

| Vai trò                | Quyết định phải chịu trách nhiệm                                    | Bằng chứng cần lưu                                                                          |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| PM — Product Manager   | Vấn đề người học, ưu tiên, phạm vi mỗi bản, pilot, mục tiêu học tập | PRD, phỏng vấn/quan sát, dashboard cohort, release decision                                 |
| SO — Solution Owner    | Ranh giới hệ thống, quyền, ngân sách, SLO, release/rollback, rủi ro | ADR, budget cap, threat model, readiness checklist, incident report                         |
| SE — Software Engineer | Contract, code, migrations, test, quan sát hệ thống, bảo trì        | PR nhỏ, test artifacts, schema diff, eval report, runbook đã diễn tập                       |
| AI hỗ trợ              | Soạn code/test/tài liệu, gợi ý ca biên, đọc diff theo checklist     | Kết quả phải chạy và kiểm chứng; AI không tự nghiệm thu chất lượng giáo dục hoặc production |

Một người có thể đảm nhiệm ba vai trò. Tuy nhiên, đánh giá đáp án mạng nên có ít nhất một người hiểu CCNA đọc mẫu trước khi mở rộng. Nếu chưa có reviewer, ghi rõ giới hạn độ tin cậy và giữ cohort nhỏ cho đến khi có bằng chứng đủ tốt.

## 5. Thứ tự đầu tư

1. Xác minh nền tảng hiện tại, chọn ba lab đại diện và định nghĩa trải nghiệm trợ giúp.
2. Xây một luồng đầy đủ có quyền, snapshot, request bền vững, quota, Python giả lập và UI.
3. Kết nối model thật, đo chất lượng tiếng Việt, hướng dẫn ba cấp và chi phí; mở pilot kín.
4. Củng cố tải, dữ liệu, lỗi nhà cung cấp, retention, hỗ trợ người học; phát hành R1 theo cohort.
5. Đo mức cải thiện của agent chỉ đọc so với R1 rồi mới mở R2.

Chi tiết giờ công, lịch cho một người và các mốc kiểm soát nằm trong [backlog](03-delivery-backlog.md). Ngưỡng kỹ thuật và kinh doanh trong tài liệu là **mục tiêu đề xuất cần benchmark**, không phải số đo hệ thống hiện tại.

## 6. Những đầu vào cần chốt khi bắt đầu

| Đầu vào chưa có                       | Giả định dùng để lập kế hoạch                                       | Hạn chốt / trách nhiệm                          |
| ------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------- |
| Số giờ làm thực tế mỗi tuần           | 25 giờ tập trung/tuần, đã bao gồm code, test, tài liệu và PM        | Tuần đầu / PM                                   |
| Ngân sách provider + hạ tầng          | Dùng công thức và ba kịch bản, chưa cam kết một mức tiền            | Trước test model thật / SO                      |
| Provider, model, vùng xử lý dữ liệu   | So sánh ít nhất hai cấu hình bằng cùng eval; chọn một cấu hình R1   | Trước pilot / SO + SE                           |
| Hạ tầng đang chạy production          | Phải kiểm kê host, proxy, DB, backup, quyền triển khai              | Trước chốt deployment / SO                      |
| Lab production có nội dung đúng và đủ | Chọn, chạy golden solution, kiểm chứng ba lab thực tế               | Trước pilot / PM + reviewer CCNA                |
| Hỗ trợ vận hành ngoài giờ             | Một người trực trong giờ đã công bố; chưa hứa SLA 24/7              | Trước mời học viên / PM                         |
| Retention và thông báo xử lý dữ liệu  | Mặc định kỹ thuật đề xuất trong tài liệu 04; cần chốt theo sản phẩm | Trước gửi dữ liệu người thật sang provider / SO |

Các đầu vào này là công việc trong giai đoạn chuẩn bị, không cản việc xây mock, fixtures, API contract và migration trên môi trường local.

## 7. Nguyên tắc thay đổi kế hoạch

- Thay model, prompt, schema context, diagnostics hoặc công cụ phải có version và chạy bộ eval liên quan.
- Không thêm tính năng vào R1 nếu chưa chỉ ra giá trị, effort, ảnh hưởng critical path và test cần bổ sung.
- Khi thiếu thời gian, giảm số lab hoặc số cohort; giữ quyền truy cập, kiểm soát chi phí, lịch sử, fallback và khả năng rollback.
- Mỗi release có người chịu trách nhiệm, commit/image digest, báo cáo kiểm thử và quyết định mở cohort. Với đội một người, người sở hữu sản phẩm ký nhận cả ba trách nhiệm.
