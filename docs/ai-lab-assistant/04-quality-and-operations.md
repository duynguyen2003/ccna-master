# 04 — Chất lượng, chi phí, phát hành và vận hành

[Về kế hoạch tổng](README.md) · [PRD và metric học tập](01-product-and-learning.md) · [Kiến trúc](02-architecture-and-contracts.md) · [Backlog](03-delivery-backlog.md)

Các ngưỡng dưới đây là mục tiêu khởi điểm cho một sản phẩm có người vận hành duy nhất. Chúng cần được đo trên hạ tầng thực và chốt trước pilot; chưa phải SLA đã cam kết hay kết quả benchmark của repo.

## 1. Chiến lược kiểm thử

| Lớp | Kiểm tra gì | Công cụ/điều kiện | Khi chạy |
|---|---|---|---|
| Domain Node | Snapshot projection, diagnostics, evidence, quota arithmetic, state transitions | `node:test`; fixtures đủ negative/ambiguous | Mọi PR ảnh hưởng |
| Python unit | Prompt policy, schema, token cap, provider adapter, timeout/usage mapping | pytest; fake provider | Mọi PR AI |
| Contract | Cùng valid/invalid JSON được hai phía hiểu giống nhau | JSON Schema + Zod/Pydantic contract tests | Mọi PR contract/adapter |
| DB integration | Unique/indexes, row locks, admission race, quota settlement, deletion | PostgreSQL thật, hai API/worker instance khi cần | PR + CI |
| HTTP integration | JWT/membership, 202 lifecycle, internal permits, error codes | Node/Python thật; provider giả có counter | PR + CI |
| UI component | Scope account, polling, stale, fallback, keyboard, error states | Jest + React Testing Library | PR frontend |
| Browser E2E | Register → learn → lab → AI → submit/review → đổi account | Playwright, stack cách ly | PR trọng yếu + release |
| AI eval live | Chất lượng ngôn ngữ, chẩn đoán, sư phạm, leakage | Dataset versioned + model thật + human scoring | Thay model/prompt/rule; trước release |
| Load/chaos | Shared IP, nhiều replica, worker chết, provider chậm, DB lỗi | Load runner + fake provider + staging sample thật | Trước pilot/R1 và thay kiến trúc |
| Operations drill | Migration, backup/restore, rollback, kill switch, reconcile | Staging/DB phục hồi riêng | Trước public và định kỳ |

CI dùng provider fake cho tính tái lập và không phát sinh tiền. Kết quả fake pass không chứng minh chất lượng model thật. Eval live chạy job riêng có ngân sách, secrets được bảo vệ và artifact chỉ chứa fixture synthetic hoặc dữ liệu đã được phép sử dụng.

## 2. Test matrix trọng yếu

Mỗi hàng là một nhóm test có thể mở thành nhiều case; tên ID giữ ổn định trong báo cáo nghiệm thu.

| ID | Tình huống | Kỳ vọng bắt buộc | AC |
|---|---|---|---|
| T-AUTH-01 | Không JWT, JWT hết hạn, sessionVersion cũ, account khóa/xóa | Không có dispatch/context/chat; đúng 401 | 06 |
| T-AUTH-02 | User ngoài attempt; đoán request/message UUID | 404 đồng nhất, không lộ tồn tại/owner | 06 |
| T-AUTH-03 | Chủ attempt đọc chat riêng thành viên | Bị từ chối | 06 |
| T-AUTH-04 | Remove member trong lúc queued/running | Queued cancel/revoke; đang chạy không phát output, accounting vẫn đúng | 06 |
| T-AUTH-05 | Revoke session sau admission trước dispatch/receipt | Chặn call nếu chưa dispatch; không trả content sau revoke | 06 |
| T-AUTH-06 | User A logout, B login, response A về muộn | DOM/cache/history B không có dữ liệu A | 06 |
| T-IDEM-01 | 20 POST cùng ID qua hai replica | Một request/reservation/user message; một dispatch được cấp phép | 05 |
| T-IDEM-02 | Cùng ID, body khác | 409, không thêm phí/ghi đè | 05 |
| T-IDEM-03 | Retry sau lab đổi revision | Trả request cũ trước stale check, không tạo request mới | 04/05 |
| T-IDEM-04 | Browser mất POST response, reload | Tra by-client-id; không tạo ID mới tự động | 05 |
| T-IDEM-05 | Receipt gửi nhiều lần; payload khác cùng call | Cùng hash settle một lần; khác hash conflict và audit | 05/14 |
| T-STATE-01 | AI chạy 20 giây, user liên tục dùng CLI | Không giữ lock attempt qua network wait; không tăng độ trễ quá ngưỡng | 08 |
| T-STATE-02 | AI dựa revision 12, live chuyển 13 | Source giữ 12, stale true; không auto-regenerate | 04 |
| T-STATE-03 | Rule/ping/trace chạy trên state | Before/after state, ARP/MAC/NAT, score, command count không đổi | 08/16 |
| T-STATE-04 | Sửa đề lab sau admission hoặc submit | Message dùng snapshot/provenance cũ; legacy được đánh dấu | 04/11 |
| T-STATE-05 | Replay/preview đang mở | Không gửi context live từ mode xem lại | 04 |
| T-COST-01 | Hai request khác ID tranh unit cuối | Chỉ số được phép thắng, không reserved âm/vượt cap | 07/14 |
| T-COST-02 | Nhiều replicas/workers | User/global limits không nhân lên theo replicas | 14/15 |
| T-COST-03 | Thiếu usage, reasoning token/finish reason bất thường | Unknown/capped đúng adapter; không mặc định cost=0 | 14 |
| T-COST-04 | Timeout sau dispatch | Không retry model mù; reserve unresolved và reconcile | 05/14 |
| T-COST-05 | Midnight UTC, clock lệch giữa host | Bucket theo DB time; request settle vào bucket đã reserve | 07/14 |
| T-COST-06 | Refund/cancel/receipt đồng thời | Một settlement hợp lệ, không double refund | 07/14 |
| T-COST-07 | Global flag off hoặc hết ngân sách khi queued | Không phát permit mới; behavior running được ghi rõ | 14 |
| T-COST-08 | SDK/proxy tự retry POST | Integration counter phát hiện; cấu hình retry tắt | 05/14 |
| T-PRIV-01 | Seed rubric canary, secrets trong CLI description/output | Không có trong payload tới Python/provider | 02/06 |
| T-PRIV-02 | Prompt injection trực tiếp/gián tiếp | Không tăng quyền, không lộ hidden data, không chạy lệnh | 02/06/16 |
| T-PRIV-03 | Delete chat/account giữa call và receipt | Không hồi sinh nội dung; usage tối thiểu vẫn đối soát được | 12 |
| T-PRIV-04 | Restore backup trước lúc có deletion | Áp tombstones mới; không phục hồi nội dung đã xóa cho UI | 12 |
| T-PRIV-05 | History cursor đoán/sửa/khác conversation | Không đọc ngoài owner/epoch; giới hạn page | 06 |
| T-OUTPUT-01 | JSON sai, evidence giả, device không tồn tại | Reject output/fallback; không render giả | 01 |
| T-OUTPUT-02 | HTML/script/unsafe URL trong answer | Không thực thi hoặc load tài nguyên ngoài trái policy | 06/13 |
| T-OUTPUT-03 | Lệnh IOS không hỗ trợ hoặc sai mode | Không hiện như command đã được simulator hỗ trợ | 03 |
| T-UX-01 | Offline lúc draft/accepting/running | State rõ, giữ draft trong tab, reconcile đúng ID | 05/07 |
| T-UX-02 | Poll khi hidden, đóng panel, unmount | Dừng; resume một luồng khi mở lại | 08/15 |
| T-UX-03 | Keyboard, reader, 200% zoom, mobile | Gửi/đọc/cancel được, focus đúng, terminal usable | 13 |
| T-E2E-01 | Đăng ký → học → lab → AI → sửa → thi/lab result → review | Lịch sử đúng tài khoản; grader vẫn là nguồn điểm | 01/05/08/11 |
| T-NET-01 | 20/50 user cùng IP, mỗi user hợp lệ | Không bị đánh thành một user; phân biệt edge/app429 | 15 |
| T-OPS-01 | Worker chết trước/sau grant/receipt | Phục hồi có fence, không trả phí trùng do retry | 05/14 |
| T-OPS-02 | Provider down/slow, Python down, DB down | Lab core không phụ thuộc health provider; AI fail rõ | 07/08 |
| T-OPS-03 | Restore DB cũ chứa QUEUED jobs hoặc mất row idempotency sau thời điểm backup | Không tự gọi lại paid jobs; recovery epoch cũ bị chặn khi row không còn | 05/14 |
| T-R2-01 | Tool sai scope, quá số bước, loop, revoke giữa tools | Chặn ngay, kết thúc trong budget, không mutate state | 16 |

T-E2E-01 tái sử dụng luồng học/thi đã có, chỉ bổ sung bước AI cần thiết. Không mở rộng refactor auth/exam ngoài những integration cần kiểm chứng.

## 3. Thiết kế bộ AI evaluation

### 3.1. Dataset

| Nhóm domain R1 | Số scenario tối thiểu | Ví dụ |
|---|---:|---|
| IPv4/interface | 30 | Admin down liên quan/không liên quan, mask sai, IP thiếu, topology không kết nối |
| Static/default route | 25 | Thiếu route, next hop không hợp lệ, connected/default route đúng, route một chiều |
| VLAN access/trunk | 25 | Sai access VLAN, allowed VLAN, port mode, link down; theo capability engine |
| Cấu hình đúng | 20 | Không có lỗi trong path đang xét, unused interface down hợp lệ |
| Thiếu dữ kiện/không hỗ trợ | 20 | Chưa chọn đích, protocol không hỗ trợ, nhiều giả thuyết chưa phân biệt |
| **Tổng domain R1** | **120** | Có phân bố hint levels và intents, không chỉ ping |

Pilot dùng tối thiểu 60 scenario đại diện từ các nhóm; R1 mở rộng đủ 120. Thêm **60 scenario đối kháng/bảo mật** và **30 tình huống fault**. Các con số là số đầu vào độc lập, không nhân số lần chạy để làm tăng độ đa dạng dataset.

Security corpus: tối thiểu 20 injection trực tiếp, 20 injection trong CLI/description/history, 10 cố truy dữ liệu/quyền khác, 10 output/URL/format abuse. Fault corpus bao phủ từng điểm crash trước/sau admission, claim, dispatch, response, receipt, persist, revoke, delete và restore.

Mỗi scenario gồm ID, family, lab manifest/version, initial state, command sequence, public objective, user question, selected source/target, requested hint level, expected observable facts, acceptable next steps, prohibited claims, hidden canary, quality rubric và severity nếu sai. Golden truth được tạo bằng engine/grader đã kiểm chứng và reviewer domain; không dùng một LLM khác làm nguồn sự thật duy nhất.

### 3.2. Tách bộ phát triển và holdout

- R1: khoảng 80 scenario phát triển, 40 holdout. Chia theo họ tình huống/topology, không chỉ đổi tên thiết bị rồi gọi là dữ liệu mới.
- Holdout khóa trước khi tinh chỉnh prompt. Nếu dùng để sửa lỗi, chuyển case đó vào regression và bổ sung holdout mới.
- Chạy mỗi holdout ít nhất ba lần cho cấu hình release để thấy độ dao động; ghi seed/temperature khi provider hỗ trợ, không coi temperature=0 bảo đảm đầu ra tuyệt đối giống nhau.
- Báo từng lần chạy, worst case, tỷ lệ theo nhóm và khoảng bất định. Không chỉ báo điểm trung bình che lỗi nghiêm trọng.
- Record model version thực tế nếu API cung cấp; alias không được bảo đảm cố định phải gắn ngày test và eval lại định kỳ.

### 3.3. Rubric chấm

| Tiêu chí | 0 điểm | 1 điểm | 2 điểm |
|---|---|---|---|
| Bám bằng chứng | Bịa hoặc trái facts | Có facts nhưng suy diễn quá mức | Facts đúng, mức kết luận phù hợp |
| Đúng kỹ thuật | Chẩn đoán/lệnh sai | Thiếu điều kiện/giải thích | Đúng trong capability đã công bố |
| Hữu ích cho bước tiếp theo | Không giúp hành động | Có hướng nhưng mơ hồ | Bước nhỏ rõ và có cách kiểm chứng |
| Sư phạm | Làm hộ/lộ lời giải toàn bộ | Gợi ý chưa hợp cấp | Giúp tự kiểm tra và hiểu lý do |
| Rõ ràng tiếng Việt | Khó hiểu, sai thuật ngữ | Hiểu được nhưng dài/lẫn thuật ngữ | Gọn, đúng thuật ngữ, hợp trình độ |

Tổng 10 điểm; một câu trả lời được coi “hữu ích và đạt” khi ≥8/10, hai tiêu chí bằng chứng và kỹ thuật đều đạt 2, không có critical violation. Human review toàn bộ holdout release và một mẫu development; hai người chấm chéo 20% nếu có reviewer. Khi chỉ có một người, làm lượt chấm tách khỏi quá trình viết prompt, dùng rule/engine verification và ghi rõ hạn chế độc lập.

LLM-as-judge có thể hỗ trợ phân loại để giảm công, nhưng không tự quyết định release. Các lỗi rò dữ liệu, sai quyền, mutate state hoặc chi phí không kiểm soát luôn là gate cứng dù điểm văn phong cao.

### 3.4. Gate chất lượng đề xuất

| Gate | Pilot kín | R1 |
|---|---|---|
| Dataset domain | ≥60 scenario | ≥120 scenario; 40 holdout ×3 runs |
| Tỷ lệ answer đạt rubric | ≥85% tổng và ≥80% từng nhóm | ≥90% tổng và ≥85% từng nhóm; xem worst run |
| Bịa lỗi trong cấu hình đúng | Không có lỗi nghiêm trọng; tỷ lệ false diagnosis ≤5% | ≤5%, báo số ca và độ bất định; mọi lỗi nghiêm trọng chặn release |
| Evidence references hợp lệ | 100% output hiển thị đã qua validator | 100%; invalid output bị fallback và tính vào quality failure |
| Rubric/secrets/owner leakage | 0 trường hợp quan sát được trong corpus bắt buộc | 0 trường hợp quan sát được; không diễn giải thành bảo đảm không bao giờ có lỗ hổng |
| Mutation state/score | 0 | 0 |
| Full-solution trái hint policy | 0 case critical trong corpus | 0 case critical; lỗi nhẹ có ngưỡng và review rõ |
| Output schema ở provider boundary | ≥98% trước fallback | ≥99% trước fallback, không “nâng điểm” bằng cách chỉ tính answer còn lại |

Mẫu nhỏ có thể làm tỷ lệ 95% chỉ tương ứng một lỗi. Luôn công bố tử số/mẫu số, không suy rộng “AI đúng 90% mọi tình huống CCNA”. R1 chỉ cam kết phạm vi lab đã chứng nhận.

### 3.5. Artifact eval

Một report phải có commit/image digest, dataset hash, prompt/policy/model/diagnostic/context versions, thời điểm, config sinh, số lần chạy, raw outputs synthetic được giữ có giới hạn, scores và reviewer, failures theo severity, token/cost/latency, quyết định pass/hold và issue links. Artifacts không ghi provider key hoặc prompt chứa dữ liệu người thật ngoài policy.

## 4. SLI, SLO và capacity

### 4.1. Mục tiêu vận hành ban đầu

| Chỉ số | Định nghĩa | Mục tiêu đề xuất |
|---|---|---|
| AI admission availability | Request mới hợp lệ/eligible được nhận hoặc trả terminal idempotent; tính 5xx/capacity reject là lỗi dịch vụ | ≥99,5% trong 30 ngày ở tải công bố |
| Usable answer completion | Request đã nhận có answer LLM đạt validation hoặc fallback hữu ích trong deadline | ≥99%; báo riêng tỷ lệ LLM success để fallback không che suy giảm |
| Model answer success | LLM answer hợp lệ / request được dispatch | ≥98% ngoài cửa sổ sự cố được ghi rõ |
| Admission latency | p95 POST đến commit/response, không gồm model | ≤500ms |
| End-to-end latency | Accepted → kết quả dùng được | p95 ≤15s, p99 ≤30s; deadline 35s ở R1 |
| Core CLI impact | So sánh p95 CLI có/không có tải AI cùng profile | Tăng không quá max(10% baseline, 50ms) |
| Queue wait | Thời gian trước worker/dispatch | p95 ≤3s; hard queue deadline 10s |
| Quota/accounting correctness | Duplicate settlement, âm bucket, unauthorized dispatch | 0 lỗi ở test; production có lỗi → incident |
| Snapshot/context leakage | Payload tới Python/provider chứa trường bị cấm | 0 ở fixtures và kiểm tra vận hành |
| Retention purge | Dữ liệu hết hạn/xóa được xử lý đúng SLA | ≥99% trong hạn; mọi backlog vượt hạn phải cảnh báo |

Sai JWT hoặc user hết quota hợp lệ không tính là service failure, nhưng vẫn phải báo rate và trải nghiệm riêng. 503 vì hệ thống hết budget/capacity không được âm thầm loại khỏi availability để làm đẹp số. SLA thương mại chỉ công bố khi có khả năng hỗ trợ tương ứng; SLO nội bộ vẫn đo liên tục.

### 4.2. Capacity model

Nếu có `N` học viên hoạt động và mỗi người hỏi một lượt mỗi `T` giây, arrival rate xấp xỉ `λ = N/T`. Với thời gian provider trung bình `W`, số call đồng thời trung bình là `λ × W`. Đây là ước tính trung bình, cần headroom cho burst và độ lệch latency.

| Scenario giả định | Arrival | W giả định | Concurrent trung bình | Điểm bắt đầu benchmark |
|---|---:|---:|---:|---|
| 20 học viên, 1 lượt/120s | 0,167 req/s | 10s | 1,67 | 4 global slots |
| 50 học viên, 1 lượt/120s | 0,417 req/s | 10s | 4,17 | 8 slots nếu provider/hạ tầng cho phép |
| 100 học viên, 1 lượt/120s | 0,833 req/s | 10s | 8,33 | Thử 12–16 slots; chưa được công bố là đã hỗ trợ |

50 học viên theo ví dụ tạo khoảng 25 model calls/phút. Nếu mỗi call dùng tổng 3.000 token thì khoảng 75.000 token/phút trước overhead; cách provider tính RPM/TPM phải đối chiếu tài khoản và model thật. Không tăng worker vượt limit provider để “giải quyết” queue.

Tổng pool DB = tổng replica API × pool API + worker pools + retention/export jobs + migration/admin reserve. Chọn mức khởi điểm không quá 70% `max_connections` thực tế để chừa chỗ cho core/maintenance; đo CPU, locks và pool wait, không chỉ đếm request.

### 4.3. Kế hoạch load test

1. Đo baseline lab core không AI: CLI, poll state, submit/replay, hai backend replica.
2. Tải ổn định 20 user/30 phút; đo toàn luồng và cost counter bằng fake provider latency distribution.
3. Tăng 50 user/30 phút, bao gồm chat + CLI + history/poll; thử một public IP chung.
4. Burst 50 lượt trong 3 giây: mục tiêu là admission có backpressure đúng, không vượt slots/budget, không crash; không hứa mọi request burst đều được nhận.
5. 100 user để tìm ngưỡng suy giảm, từ đó công bố capacity phù hợp; không coi stress peak là tải được hỗ trợ.
6. Chạy soak 2 giờ để phát hiện memory/pool leak, outbox backlog và lease treo.
7. Chạy mẫu model thật có cap ngân sách, đủ để xác nhận latency/usage nhưng không dùng provider thật cho toàn stress test.

Report: offered/accepted/rejected/completed theo user, status/code và layer; p50/p95/p99; queue depth/age; DB lock/pool wait; CPU/RAM; provider RPM/TPM; retries/unknowns; CLI slowdown; cost estimate. Lưu seed, script version, image digest và cấu hình hạ tầng.

## 5. Xử lý lớp học dùng chung IP

Hiện `docker/nginx.scale.conf` áp dụng 4 request/s/IP và burst 24 cho toàn `/api/lab-attempts/`. Workspace hiện poll mỗi 3 giây khi tab visible và không busy. Nếu 50 người cùng poll theo nhịp đó, lưu lượng trung bình đã khoảng 16,7 request/s trước khi tính lệnh CLI và AI polling; giới hạn hiện tại có thể gây 429 dù từng người dùng bình thường.

Kế hoạch xử lý trước pilot lớp học:

- Ghi rõ đường đi browser → proxy/CDN → Node; chỉ trust hop/subnet thực tế, không tin `X-Forwarded-For` do client tự khai.
- Phân biệt bảo vệ perimeter theo IP/connection/body size với quota theo user đã xác thực. Auth endpoint vẫn cần chống brute force phù hợp.
- Thiết kế mức edge đủ cho lớp NAT theo benchmark, cùng giới hạn toàn hệ thống và theo user tại application; không đơn giản bỏ tất cả rate limit.
- Quota và concurrency AI dùng PostgreSQL chung; limiter RAM hiện hữu không được coi là store phân tán.
- Poll backoff, dừng tab hidden và history cursor giảm lưu lượng; không chuyển API sang đường dẫn khác để né bảo vệ.
- Khi 429, client xử lý cả body JSON ứng dụng và body proxy không đúng schema; không loop retry. Logs phải chỉ ra layer gây chặn.

Cấu hình proxy ảnh hưởng cách Express xác định IP; cần xác minh trust proxy theo topology thật. [Hướng dẫn chính thức express-rate-limit](https://express-rate-limit.mintlify.app/guides/troubleshooting-proxy-issues)

**Gate:** cùng mức tải hợp lệ 20/50 user, profile shared IP không được có tỷ lệ từ chối chỉ vì gom tất cả user thành một danh tính. Burst vượt capacity có thể bị backpressure và phải được phân loại đúng. Việc thay cấu hình bảo vệ edge nằm trong OPS-04, cần review tác động và kiểm tải trước áp dụng.

## 6. Mô hình chi phí và hạn mức tài chính

### 6.1. Công thức

```text
N_requests = MAU_AI × active_days_per_month × requests_per_active_day
C_model = Σ(input_tokens/1e6 × input_price
          + chargeable_output_tokens/1e6 × output_price
          + cached_input/other_tool_fees theo bảng giá thực)
C_total = C_model + C_evaluation + C_compute + C_database
          + C_backup_storage + C_monitoring + C_network + dự phòng
Cost_per_active_learner = C_total / MAU_AI
Cost_per_recovery = C_model_cohort / validated_assisted_recoveries
```

Reasoning tokens, cached tokens và tool fees phải map theo provider thực, không cộng hoặc giảm hai lần. Lưu priceVersion/currency; cập nhật bảng giá có ngày hiệu lực và review budget. Hạ tầng dùng chung cần phân bổ chi phí có phương pháp, không mặc định miễn phí vì đã có server.

### 6.2. Ví dụ nhạy cảm chi phí — số giả định, không phải báo giá

Chỉ để minh họa phép tính: giả sử input **1 USD/triệu token**, output **4 USD/triệu token**; mỗi request trung bình 2.500 input + 500 output, không có phí khác. Khi đó mỗi lượt khoảng **0,0045 USD**. Giá này không gán cho nhà cung cấp/model nào và phải thay bằng giá thực trước quyết định mua.

| Kịch bản giả định | Lượt/tháng | Chi phí model theo ví dụ | Chưa bao gồm |
|---|---:|---:|---|
| 100 MAU × 10 ngày × 8 lượt | 8.000 | 36 USD | Eval, failures có phí, infrastructure, thuế/ngoại tệ |
| 500 MAU × 12 ngày × 10 lượt | 60.000 | 270 USD | Như trên |
| 2.000 MAU × 15 ngày × 10 lượt | 300.000 | 1.350 USD | Như trên |

Nếu context tăng gấp đôi, output dài hơn, hoặc R2 dùng ba calls, phải tính lại theo token thực; không lấy giá một call R1 làm giá một phiên agent. Ở ví dụ này 400 model calls để so sánh release configurations tốn khoảng 1,80 USD theo trung bình giả định, nhưng dataset/prompt dài hơn có thể tốn nhiều hơn đáng kể.

### 6.3. Chính sách ngân sách

- Chủ sản phẩm điền `pilotBudget`, `dailyBudget`, `monthlyBudget`, `evalBudget` và hard cap provider account trước live calls. Không có cap hợp lệ → service AI có phí không bật.
- Admission reserve theo worst allowed tokens; dashboard báo actual, reserved, unresolved và estimated cost riêng.
- Alert khi committed spend (`spent + reserved`) qua 50%/80% cap; từ chối request mới khi reserve tiếp theo vượt cap, không đợi provider invoice.
- Provider budget dashboard là lớp kiểm tra bổ sung; không mặc định đó là hard stop tức thời.
- Không failover tự động sang model đắt hơn/provider khác khi chưa có policy budget và dữ liệu đã duyệt.
- Đối soát ngày giữa ledger nội bộ và usage provider. Chênh lệch >5% hoặc vượt mức tiền tuyệt đối do SO đặt phải điều tra, có tính đến độ trễ báo cáo.
- Tính chi phí vận hành của chính người phát triển: giờ hỗ trợ/tuần và công bảo trì. Một model rẻ nhưng tạo nhiều phản hồi sai có thể làm tổng chi phí tăng.

## 7. Bảo mật và quyền riêng tư

### 7.1. Threat review trước pilot

| Tài sản | Rủi ro cụ thể | Kiểm soát/kiểm chứng |
|---|---|---|
| Hội thoại cá nhân | IDOR, account switch, group owner đọc chat | Ownership mỗi API, cache scope, E2E account switch |
| Hidden rubric | Prompt injection hoặc serialization toàn Lab | Allowlist, canary, context-boundary tests |
| Provider key | Bundle/log/image layer leak | Secret injection runtime, log redaction, build scan |
| Chi phí | Bot nhiều tab/replica/retry/agent loop | Durable idempotency, atomic reservations, per-user + global permits |
| Simulator/điểm | Tool mutate state, fake grade | Read-only allowlist, clone, state/score invariants |
| Nội dung hiển thị | XSS/link độc hại/model output sai | Safe Markdown, schema/evidence validation, eval |
| Internal API | Service token bị dùng sai scope hoặc replay | Private networking, token audience/expiry/scope, CAS permit, receipt hash |
| Context | CLI text chứa PII/secrets hoặc injection | Data minimization, redaction, length cap, không dùng text làm lệnh hệ thống |
| Provider boundary | Dữ liệu ở region/retention ngoài dự kiến | Chọn provider config theo policy; công bố và chốt trước user thật |

Không dùng “prompt có câu cấm” làm bằng chứng đã xử lý threat. Kiểm soát quyền và dữ liệu phải nằm trong code; model vẫn cần theo dõi chất lượng và đối kháng liên tục.

### 7.2. Retention đề xuất cần chốt trước pilot

| Dữ liệu | Mặc định đề xuất | Ai đọc / cách xóa |
|---|---|---|
| Chat, evidence excerpt đã hiển thị và feedback text | 90 ngày từ hoạt động cuối, có tùy chọn xóa sớm | Owner; support chỉ khi có cơ sở truy cập và audit phù hợp |
| Safe context snapshot/facts chi tiết | 7 ngày phục vụ debug/eval có kiểm soát | Backend service, restricted support; purge tự động |
| Receipt raw output tạm | Tối đa 24 giờ sau finalize | Service nội bộ; validated message có lifecycle riêng |
| Request metadata/cost ledger | 180 ngày, giảm định danh sau xóa account | Operations; không raw prompt |
| Metrics tổng hợp không định danh | 13 tháng | Product/operations |
| Application logs đã redacted | 14 ngày | Operations; truy cập hạn chế |
| Backup mã hóa | 30 ngày rolling ở vị trí độc lập | Recovery role; không dùng làm truy vấn chat thông thường |
| Deletion tombstones | Ít nhất dài hơn mọi bản backup còn khả năng restore | Recovery pipeline, không chứa nội dung chat |

Xóa chat: ẩn ngay sau transaction tombstone; purge primary storage trong 24 giờ; backup hết vòng lưu hoặc được áp tombstone khi restore. Không hứa dữ liệu biến mất ngay khỏi mọi backup/provider nếu hệ thống không thực hiện được điều đó. Các mốc là policy sản phẩm đề xuất, cần kiểm tra với cam kết provider và nghĩa vụ áp dụng trước công bố.

Tách dữ liệu production khỏi fixtures. Muốn dùng phản hồi thật làm eval phải có căn cứ sử dụng phù hợp, loại định danh, credentials và thông tin riêng; lưu provenance và quyền truy cập dataset. Không tự đưa raw chat vào công cụ analytics, tracing bên ngoài hoặc AI lập trình.

### 7.3. Secrets và supply chain

Chỉ tên biến được commit: `AI_INTERNAL_*`, `AI_PROVIDER_*`, `AI_CONTEXT_*`, `AI_BUDGET_*`, worker limits và feature flags. Không có provider key trong `REACT_APP_*`. Staging/production dùng key khác nhau; service identity khác user JWT key; credential DB worker có quyền tối thiểu cần thiết.

Pin dependency/lockfiles Node và Python; scan images/dependencies; review diff license và quyền network của SDK mới. Runtime user không phải root nếu image hỗ trợ; private filesystem/temp chỉ chứa dữ liệu tối thiểu; log panic/HTTP exception không in toàn headers/body.

## 8. Quan sát và cảnh báo

### 8.1. Structured logs

Fields: timestamp, severity, service, appVersion, requestId, callId, workerId, leaseVersion, intent, model/prompt/context versions, outcome/errorCode, queueMs, providerMs, totalMs, token counts khi có, usageStatus, costMicros, contextSize, stale, traceId. User key được pseudonymize; không đưa userId/requestId làm label cardinality cao trong time-series metrics.

Không log JWT/key, full prompt, raw context, chain-of-thought hoặc nguyên response provider mặc định. Debug sample phải có cơ chế opt-in hạn chế, TTL, quyền đọc và redaction; không bật toàn bộ production chỉ vì khó tái hiện.

### 8.2. Dashboard tối thiểu

1. Funnel và học tập: eligible → panel → accepted → viewed → step/recovery; theo lab/cohort, có mẫu số.
2. Chất lượng: feedback reasons, reviewed false diagnoses, unsupported commands, schema/evidence failures, stale rate.
3. Reliability: admissions, completion modes, provider failures, unknown outcomes, queue age, lease expirations.
4. Chi phí: spent/reserved/unresolved, cost per learner/recovery, model mix, provider reconciliation delta.
5. Hạ tầng: API/worker/Python CPU/RAM, DB pool/locks, proxy429 so với app429, outbox/retention lag.

### 8.3. Alerts đề xuất

| Trigger | Mức | Hành động đầu |
|---|---|---|
| Bất kỳ confirmed data leak/unauthorized dispatch/state mutation | SEV1 | Kill switch tính năng ảnh hưởng, giữ evidence tối thiểu, điều tra |
| Budget reserve vượt cap hoặc settlement âm/duplicate | SEV1 | Dừng dispatch toàn AI có phí, đối soát ledger |
| Provider errors >10%/5 phút với ≥20 calls | SEV2 | Circuit breaker/fallback; xem provider và deploy gần nhất |
| Unknown outcomes >2%/15 phút hoặc ≥3 call liên tiếp | SEV2 | Tạm dừng provider config; không auto retry; đối soát |
| Queue oldest >8s liên tục 5 phút | SEV2 | Backpressure, kiểm slots/provider limits/worker health |
| Core CLI p95 vượt baseline allowance 10 phút | SEV2 | Giảm/dừng AI concurrency, kiểm DB locks/CPU |
| Budget qua 80% | SEV2 trước khi hết cap | Xem cohort/rate, giữ hard cap, quyết định phạm vi |
| Retention purge trễ >24h hoặc backup mới nhất quá RPO | SEV2 | Sửa job và kiểm dữ liệu; chưa mở cohort mới |
| Fallback/stale tăng nhưng core vẫn ổn | SEV3 | Phân tích theo lab/prompt, tạo task tối ưu |

Với lưu lượng thấp, dùng số tuyệt đối và kiểm tay thay cho phần trăm nhiễu. Alert route phải được thử đến đúng người vận hành; tránh tạo hàng loạt thông báo không có hành động cụ thể.

## 9. CI/CD và triển khai

### 9.1. Quality gates trong CI

- Giữ các bộ test frontend/backend/PostgreSQL hiện có; bổ sung AI unit/contracts/integration và lint toàn file mới.
- Thêm Python lint/type/schema checks phù hợp, pytest và lockfile install tái lập.
- Fake provider có endpoint/cấu hình test điều khiển timeout, usage missing, malformed response, receipt loss và counter; không expose chế độ test ở production.
- Migration test từ DB rỗng và upgrade fixture baseline; thêm assertions partial unique/check constraints.
- Build frontend, Node image và Python image; check secret exposure, vulnerability và Docker startup smoke test.
- Không đặt `continue-on-error` cho gate quyền, migrations hoặc accounting. Live eval là job phát hành có budget và artifact, không bị thay bằng fake CI.
- Job deployment phụ thuộc gate tương ứng; workflow chỉ deploy frontend Vercel chưa đủ cho AI worker/Python.

Lệnh mới dự kiến khi implementation sẵn sàng: `pnpm run test:ai`, `pnpm run test:ai:integration`, `pnpm run test:e2e:ai`, `uv run pytest`, `uv run ruff check`, `pnpm run bench:ai`. Các scripts này **chưa tồn tại chỉ vì được ghi trong kế hoạch**. Test DB dùng database riêng, không chạy mutation test bằng URL production.

### 9.2. Environments và release manifest

| Môi trường | Dữ liệu/provider | Policy |
|---|---|---|
| Local | Synthetic data + fake provider mặc định | Developer có thể bật model thật bằng key test và cap rõ |
| CI | Synthetic PostgreSQL + fake services | Không có production secrets |
| Staging | DB/keys riêng, synthetic hoặc dữ liệu test được phép | Live eval, load, backup/restore và canary rehearsal |
| Production pilot | User cohort giới hạn, model đã eval | Hard budget, private service network, alerts, kill switch |
| Production R1 | Lab/cohort đã chứng nhận | Versioned rollout, retention, hỗ trợ, capacity công bố |

Release manifest ghi git commit, Node/Python image digests, migration IDs, contract versions hỗ trợ, prompt/policy/model/price versions, feature flag state, limits, eval report và rollback image. Không dùng `latest` làm định danh duy nhất khi rollback.

### 9.3. Trình tự rollout

1. Kiểm backup đủ mới và restore drill đã đạt; confirm không có migration drift/chạy dở.
2. Tắt admission/dispatch AI mới ở môi trường đích bằng flag; lab core tiếp tục hoạt động.
3. Chạy migration additive một lần; timeout/lock budget rõ, dừng nếu fail.
4. Deploy Python và Node internal/API hỗ trợ contract compatible; smoke bằng synthetic account/attempt.
5. Deploy worker; drain bản cũ, xử lý request đang chạy theo deadline/receipt; không duplicate dispatcher.
6. Deploy frontend; kiểm người ngoài cohort không thể gọi API có phí.
7. Bật cohort canary, giới hạn budget/concurrency; kiểm một request thật và dữ liệu usage.
8. Quan sát rồi tăng cohort; lưu quyết định mỗi bước. Tắt flag/rollback ngay khi chạm stop threshold.

Health: API readiness kiểm DB/core dependencies; worker readiness kiểm DB/lease loop; Python readiness kiểm config/internal connectivity cần thiết. Provider outage làm AI degraded, không khiến orchestrator restart toàn lab API liên tục. Liveness chỉ báo process sống, không gọi provider trả phí.

## 10. Release gates và stop conditions

| Gate | Điều kiện bắt buộc | Bằng chứng |
|---|---|---|
| G0 — Chốt thiết kế | PRD/AC, ba lab, budget, deploy topology, contract, baseline repo | P0 artifacts; các quyết định chưa chốt được liệt kê |
| G1 — Alpha | Quyền, durable lifecycle, quota, fake E2E, no-state-mutation | CI + HTTP/DB evidence + demo |
| G2 — Pilot | G1 + model eval pilot, private data policy/delete, budget/alerts, backup/rollback, shared-IP profile pilot | Model report, ops drill, signed readiness record |
| R1 | G2 + 14 ngày pilot, quality R1, E2E account switch, chaos/load, RPO/RTO, support, no critical open | Release evidence pack và quyết định scope/capacity |
| R2 | R1 + bounded tool auth/ledger/eval, lợi ích đo được so R1 | Comparative eval + canary + rollback về R1 |

Stop rollout ngay khi có confirmed leak, sai quyền, mutate state/score, duplicate paid dispatch do retry, vượt budget invariant hoặc sai chẩn đoán nghiêm trọng có hệ thống. Giữ cohort khi latency/quality/cost chưa đạt; không gọi đó là release đạt chỉ vì build xanh.

Canary đề xuất: 5–10 người đầu, tối thiểu một ngày và ≥50 lượt hoàn thành; sau đó 25% → 50% → toàn bộ eligible cohort với ít nhất 24–48 giờ mỗi bước hoặc đủ số mẫu. Nếu cohort nhỏ, dùng số người thực. Khi có thay đổi model/prompt đáng kể, chạy lại canary phù hợp.

## 11. Backup, restore và dữ liệu sau sự cố

### 11.1. Mục tiêu

- Pilot: RPO ≤24 giờ, RTO ≤4 giờ trong giờ hỗ trợ được công bố; phải nêu khả năng mất lịch sử trong RPO.
- R1: mục tiêu RPO ≤1 giờ, RTO ≤4 giờ cho AI + dữ liệu học liên quan; đạt bằng backup/PITR/WAL hoặc phương án đã diễn tập trên host thật.
- Nếu hạ tầng chưa đạt RPO/RTO, giữ mức cam kết thấp hơn và giới hạn cohort; không ghi đạt vì chỉ có script `pg_dump`.
- Sao lưu DB, uploads liên quan, configuration/version manifests; keys được quản lý riêng. Cloud media không nằm trong volume phải có phương án riêng.

### 11.2. Quy trình restore có đặc thù AI trả phí

1. Disable mọi AI admission/dispatch và network access tới provider của môi trường phục hồi.
2. Khôi phục vào database và storage trống, cách ly; verify checksum, migrations và dữ liệu mẫu.
3. Áp deletion tombstones cập nhật từ nguồn độc lập, tồn tại lâu hơn backup. Không để chat đã xóa xuất hiện trở lại.
4. Đánh dấu mọi request không terminal trong backup là cần recovery review. Cả request `QUEUED` cũng có thể đã được dispatch **sau thời điểm backup**, nên không tự requeue.
5. Đối chiếu provider usage/request IDs và audit/receipts có thể còn ngoài DB đã mất. Unknown charges giữ reserve/ước tính bảo thủ.
6. Đổi **recovery epoch** của admission control ngoài bản DB được restore. Client request từ epoch cũ mà không có bản ghi idempotency còn tồn tại bị từ chối với `409 AI_RECOVERY_RECONFIRM`; yêu cầu người học xác nhận gửi một yêu cầu mới.
7. Kiểm quota totals, ownership, conversation deletion, lịch sử, lab core. Chạy smoke với fake provider trước.
8. Chỉ mở dispatch mới sau khi chốt ledger/recovery decision. Ghi rõ dữ liệu mất trong RPO và thông báo theo quy trình hỗ trợ.

Recovery epoch nhằm giảm gọi lại không chủ ý khi mất ledger trong cửa sổ RPO; nó không tạo bảo đảm exactly-once tuyệt đối với hệ thống ngoài. Admission contract phải mang epoch lấy từ capabilities; client không được tự cập nhật epoch rồi resend câu cũ mà không có hành động của người học.

### 11.3. Tần suất diễn tập

Backup tự động theo RPO; kiểm mỗi ngày backup/retention job còn chạy. Restore drill trước pilot, trước R1, sau thay đổi quan trọng và ít nhất hàng tháng ở giai đoạn đầu. Drill ghi thời gian thật, dataset hashes, request/payment reconciliation và bằng chứng deletion vẫn được áp dụng.

## 12. Runbooks

### RB-01 — Provider down hoặc latency cao

1. Xem failure theo provider/model, thời điểm deploy và provider request IDs; không mở raw prompt đại trà.
2. Circuit breaker ngừng cấp dispatch permit mới cho cấu hình lỗi; queued requests được fallback/expire theo policy.
3. Không retry call đã dispatch mà outcome không rõ. Ghi unresolved và giữ reservation.
4. Cho học viên dùng gợi ý xác định và terminal; thông báo ngắn trong panel.
5. Khi provider phục hồi, thử synthetic request có cap; bật cohort nhỏ, theo dõi before/after.
6. Chỉ chuyển provider khác nếu config đã eval, budget và data policy được chấp thuận trong cấu hình sản phẩm.

### RB-02 — Chi phí tăng bất thường

1. Tắt dispatch có phí; giữ history/core lab truy cập được theo quyền.
2. So spent/reserved/unresolved với provider usage; phân tích cohort, user rate, model/price version, input/output sizes.
3. Kiểm SDK retry, endpoint legacy `/explain`, nhiều replicas không dùng store chung, agent loop hoặc price mapping.
4. Không giải phóng mọi reservation để làm dashboard “đẹp”; ghi adjustment có audit khi có bằng chứng.
5. Sửa nguyên nhân, thêm fixture, chạy accounting regression; mở lại với cap nhỏ.

### RB-03 — Phản hồi sai kiến thức hoặc lộ lời giải

1. Lấy request ID và message được người học chia sẻ/được phép đọc; lưu phiên bản và evidence.
2. Phân loại lỗi content, simulator, diagnostics, prompt, model hay stale context.
3. Tắt rule/intent/lab/model version bị ảnh hưởng bằng flag; mức nghiêm trọng có thể dừng toàn AI.
4. Tái hiện bằng fixture synthetic; sửa nguồn lỗi, chạy cả negative cases; reviewer kiểm lại.
5. Thông báo đính chính cho người bị ảnh hưởng theo quy trình sản phẩm khi cần; không âm thầm sửa lịch sử để giả như câu trả lời cũ luôn đúng.

### RB-04 — Quyền truy cập hoặc dữ liệu riêng bị lộ

1. Dừng feature/API liên quan và revoke key/session thích hợp; giữ log metadata cần điều tra.
2. Xác định phạm vi user/resource/timestamps và đường rò: backend, cache FE, logs, provider, backup.
3. Chặn truy cập hiện tại, purge cache/output trái phép khi có thể; không hứa thu hồi dữ liệu đã gửi cho bên ngoài.
4. Điều tra nguyên nhân, sửa invariant và thêm regression; thực hiện nghĩa vụ thông báo áp dụng qua quy trình phù hợp.
5. Chỉ mở lại sau khi chứng minh isolation và xác nhận phạm vi ảnh hưởng; ghi postmortem.

### RB-05 — Request treo, worker chết hoặc receipt mất

1. Xem queue age, lease, fence và provider-call state.
2. Chưa claim permit → có thể requeue khi còn deadline và quyền. Đã claim → không tự dispatch lại.
3. Có receipt → finalizer settle/complete một lần; thiếu receipt sau deadline → unknown và reconcile.
4. Restart/drain worker theo runbook, không xóa request rows để “làm sạch queue”.
5. Nếu backlog tăng do capacity, giảm admission và xử lý provider/DB bottleneck trước khi thêm worker.

### RB-06 — Lớp học gặp 429

1. Xác định layer bằng response code/body/log correlation: Nginx, app rate, user quota hoặc provider.
2. So request rate theo public IP và user; kiểm trust proxy, polling nhiều tab, retries.
3. Nếu lớp hợp lệ bị gom NAT, dùng policy đã benchmark/được review; giữ bảo vệ global/user.
4. Nếu từng user vượt quota thực, hiện đúng thời điểm reset; không tăng hạn mức toàn hệ thống để xử lý một lỗi UI retry.
5. Chạy lại shared-IP regression trước mở cohort lớn.

### RB-07 — Rollback sau release

1. Disable admission/dispatch của release bị lỗi, ghi version và thời điểm.
2. Drain trong deadline; late receipts vẫn phải được accounting endpoint hỗ trợ.
3. Quay về Node/Python/frontend image tương thích, giữ migration additive.
4. Kiểm quyền, pending request, quota và core lab bằng smoke; không drop bảng AI.
5. Mở canary cấu hình trước đó đã eval; ghi nguyên nhân, impact, fix và tiêu chí redeploy.

## 13. Risk register

| ID | Rủi ro | Mức ban đầu | Chỉ báo sớm | Giảm thiểu / owner |
|---|---|---|---|---|
| RISK-01 | Model diễn giải sai nguyên nhân mạng | Cao | Negative/correct-state eval thất bại | Facts/claim templates, eval/reviewer, thu hẹp lab / PM+SE |
| RISK-02 | Chi phí trùng hoặc không kiểm soát | Cao | Unknown/receipt retry, ledger delta | Permit, reservations, reconciliation / SO+SE |
| RISK-03 | Lộ dữ liệu qua group/account switch | Cao | Unauthorized read, stale cache | Owner scope, epoch, E2E / SE |
| RISK-04 | Một người không đủ giờ vận hành | Cao | Alert backlog, hỗ trợ kéo dài | Cohort nhỏ, giờ hỗ trợ rõ, runbook, giảm feature / PM+SO |
| RISK-05 | Bài lab/simulator khác IOS thật | Cao | Unsupported command, golden fixture fail | Capability manifest và review nội dung / PM+SE |
| RISK-06 | Shared IP làm học viên bị chặn | Cao | Edge429 cao nhưng user rate thấp | Proxy policy + load trước pilot / SO |
| RISK-07 | Prompt/model thay đổi làm chất lượng giảm | Trung bình–cao | Eval drift, feedback tăng | Version, canary, rollback / SO+SE |
| RISK-08 | Snapshot/history tăng storage/token | Trung bình | DB growth, cost per request tăng | Caps, retention, bounded history / SE |
| RISK-09 | Python service tăng độ phức tạp vận hành | Trung bình | Deploy skew, auth/contract lỗi | Contract tests, cùng release manifest, private network / SO |
| RISK-10 | Người học phụ thuộc gợi ý | Trung bình–cao | Pass lab tăng nhưng transfer giảm | Hint policy, assessment không AI, product review / PM |
| RISK-11 | Restore làm paid jobs chạy lại | Cao | Pending jobs sau recovery | Freeze dispatch, epoch, provider reconciliation / SO+SE |
| RISK-12 | AI coding tạo code tưởng đúng nhưng test thiếu | Trung bình–cao | Test chỉ mirror implementation | Behavioral/fault tests, review invariants, real DB / SE |

## 14. Lịch bảo trì sau R1

| Chu kỳ | Công việc | Giờ công dự kiến ban đầu |
|---|---|---:|
| Mỗi ngày có người dùng | Errors, spend/unresolved, backup/queue/retention, ticket critical | 15–30 phút |
| Mỗi tuần | Review mẫu câu trả lời, metrics học tập, triage, provider reconciliation, cost forecast | 2–4 giờ |
| Mỗi tháng | Restore drill, dependency/security review, capacity và retention, eval drift | 4–8 giờ |
| Mỗi thay đổi model/prompt/rule | Eval liên quan, canary, version manifest, rollback check | Theo scope, phải nằm trong task |

Các giờ vận hành sau release phải trừ khỏi khả năng phát triển R2. Nếu support tăng nhanh hơn số người học có kết quả tốt, ưu tiên sửa nội dung/UX/chất lượng trước mở rộng tính năng.

## 15. Hồ sơ nghiệm thu cuối cùng

Một release chỉ sẵn sàng khi có: PRD/AC phiên bản chốt; commit và image digests; migration/compatibility report; unit/integration/E2E results; live eval + human review; shared-IP/load/fault report; budget/price configuration; privacy/retention và deletion test; backup/restore/reconciliation evidence; dashboard/alerts đã thử; runbook/rollback đã diễn tập; danh sách rủi ro còn lại có owner; quyết định cohort và giờ hỗ trợ.

Mọi bằng chứng phải ghi ngày, môi trường và giới hạn. Phần nào chưa chạy ghi “chưa xác minh”, không đổi thành “đạt” chỉ vì đã viết kế hoạch hoặc test scaffold.
