# AI Lab wire contract v1.0.0

[Thiết kế](../../../../../docs/ai-lab-assistant/02-architecture-and-contracts.md) · [ADR-001](../../../../../docs/ai-lab-assistant/adr/ADR-001-async-api.md) · [Threat review](./threat-scenarios.md) · [Schema index](./schema-index.json) · [State machine](./state-machine.json) · [Error/HTTP map](./error-statuses.json)

Ngày chốt: **19/10/2026**. Contract đã chạy kiểm tra; **BE-01…04 đã có migration, admission và worker/permit/receipt local-fake**. [Bằng chứng BE-04](../../../../../docs/ai-lab-assistant/baseline/BE-04-worker.md). Python, context/output policy đầy đủ và provider thật tiếp tục ở BE-05/PY. Scope R1: async public API, một call provider, Node sở hữu quyền/snapshot/simulator/quota/accounting, Python sinh diễn giải từ dữ liệu đã lọc. Ghi chú sync trong UI/task dễ hiểu cũ đã được thay bởi ADR-001.

**Cập nhật 26/10/2026:** [BE-05](../../../../../docs/ai-lab-assistant/baseline/BE-05-context-output.md) đã có public projection, lịch sử đúng chủ/epoch, nguồn bằng chứng, catalog lệnh đọc và verifier Node trên luồng fake. Giữ nguyên contract v1.0.0; tokenizer/prompt/provider thật thuộc PY-01/PY-02, quy tắc chẩn đoán nguyên nhân thuộc SIM-01. Budget token fake không thay số đếm của provider thực.

**Bổ sung SIM-01 cùng ngày:** [bộ chẩn đoán Node](../../../../../docs/ai-lab-assistant/baseline/SIM-01-diagnostics.md) đã dùng facts hiện có với `provenance.source=DIAGNOSTIC`, version `sim01-r1-v1` và scope nguồn–đích. Không đổi 17 schema hay wire version. Kết luận mạnh trong DIAGNOSE phải khớp mẫu/bằng chứng Node; model thật và tokenizer vẫn chưa bật.

| Quyết định | Hồ sơ đã chốt |
|---|---|
| Async API, ownership và idempotency | [ADR-001](../../../../../docs/ai-lab-assistant/adr/ADR-001-async-api.md) |
| PostgreSQL queue, quota và fencing | [ADR-002](../../../../../docs/ai-lab-assistant/adr/ADR-002-postgres-queue-quota.md) |
| Một provider config, fallback và usage | [ADR-003](../../../../../docs/ai-lab-assistant/adr/ADR-003-provider-policy.md) |
| Node domain, facts và data boundary | [ADR-004](../../../../../docs/ai-lab-assistant/adr/ADR-004-node-facts-ownership.md) |
| Orchestration và nguồn schema | [ADR-005](../../../../../docs/ai-lab-assistant/adr/ADR-005-orchestration-contract-source.md) |
| Output đã validate, không stream token | [ADR-006](../../../../../docs/ai-lab-assistant/adr/ADR-006-validated-output.md) |
| Receipt/accounting độc lập kết quả | [ADR-007](../../../../../docs/ai-lab-assistant/adr/ADR-007-receipts-accounting.md) |

## Nguồn và cách dùng

Nguồn duy nhất: [aiLabContract.js](../../aiLabContract.js), export `@ccna/shared/aiLabContract`. Không sửa tay JSON Schema/examples: generator xuất Draft 7 từ Zod đang dùng; Node/frontend parse trực tiếp cùng module, Python kiểm các JSON Schema sinh ra. Builder [build-cases.cjs](./fixtures/build-cases.cjs) chỉ tạo dữ liệu tổng hợp, không có secrets thật.

```text
node src/agent/scripts/generate-ai-lab-contracts.cjs
pnpm check:ai:contracts
pnpm test:ai:contracts
python -m pip install -r src/agent/contracts/ai-lab/v1/requirements-test.txt
python src/agent/contracts/ai-lab/v1/check_python.py
pnpm test --watchAll=false --runInBand --runTestsByPath src/features/labs/utils/aiLabContract.test.js
```

Trên PowerShell bị chặn `pnpm.ps1`, dùng `pnpm.cmd`. Generator tự tìm repository root, không đọc `.env`, kết nối DB hoặc gọi model. CI kiểm generated artifacts, Node tests, Python parity và frontend suite hiện có. Python requirements ở đây chỉ phục vụ contract validation; service lockfile thuộc PY-01.

## Public API

Base `/api/lab-attempts/:attemptId/ai`; Bearer header, kiểm account/session/attempt/conversation owner/cohort, `Cache-Control: private, no-store`. `X-AI-Contract-Version: 1.0.0` phải khớp contractVersion trong body/envelope; body version không thay quyền. Tất cả path IDs là UUID; device/task IDs thuộc snapshot. By-client-id phải khai báo trước route requestId động.

| Method/path tương đối | Input schema | Success schema / HTTP |
|---|---|---|
| POST `/requests` | `CreateRequest` | `RequestResponse`: 202 pending, 200 replay terminal |
| GET `/requests/by-client-id/:clientRequestId` | UUID params | `RequestResponse`, 200; không dispatch |
| GET `/requests/:requestId` | UUID params | `RequestResponse`, 200 kể cả terminal failure |
| POST `/requests/:requestId/cancel` | Không body | `RequestResponse`, 200 idempotent; không đảo terminal đã có |
| GET `/messages?cursor=...&limit=20` | Cursor opaque, limit 1-50 | `HistoryResponse`, 200 |
| GET `/capabilities` | Không body | `CapabilitiesResponse`, 200 |
| GET `/quota` | Không body | `QuotaResponse`, 200; không có ngân sách global |
| POST `/messages/:messageId/feedback` | `FeedbackRequest` | `FeedbackResponse`, 200 upsert owner |
| DELETE `/conversation` | Không body | `DeleteConversationResponse`, 202; epoch mới, purgeBy |

Envelope `{contractVersion,data}` và `{contractVersion,error}`. Error code map là artifact dùng chung; request accepted gặp provider failure vẫn trả GET 200 với trạng thái trong data. 502/504/proxy body khác schema có thể là POST đã nhận nhưng mất response: reconcile by-client-id, không tự tạo ID mới. Auth legacy `{message}` nhận diện bằng status 401 trong client adapter đến khi route integration chuẩn hóa.

Capabilities có thể trả conversationId null khi chưa có conversation; không cần tạo hội thoại bằng GET. Eligible=false không cấp quyền gửi; các request AI vẫn kiểm policy lại. Cursor phải gắn owner/conversation epoch và thứ tự `(createdAt,id)`; schema string bounded không chứng minh cursor có quyền.

Ví dụ sinh tự động: [create-request.json](./examples/create-request.json), [completed-response.json](./examples/completed-response.json). JSON không phải kết quả model thật.

## Internal API

| Endpoint | Schema input → output |
|---|---|
| Python POST `/internal/v1/lab-assistant/analyze` | `InternalAnalyzeRequest` → `InternalAnalyzeResponse` (ACK receipt) |
| Node POST `/internal/v1/ai/provider-calls/:callId/claim` | `ClaimRequest` → `ClaimResponse` |
| Node PUT `/internal/v1/ai/provider-calls/:callId/receipt` | `ProviderReceipt` → `ReceiptResponse` |

`ServiceClaims` mô tả claim JSON cho service token, không phải credential fixture hoặc JWT signer/verify implementation. Body/path/header phải cùng call binding; Node kiểm chữ ký, audience/operation, expiry, current lease/quyền/budget. Mạng private; TLS khi đi qua network boundary. R2 tool endpoints chưa nằm trong contract v1 R1.

Ví dụ: [internal-analyze.json](./examples/internal-analyze.json), [provider-receipt.json](./examples/provider-receipt.json). Python ACK chỉ tham chiếu receipt đã lưu; không có đường response trực tiếp để UI render raw model output.

## Invariant có thể kiểm ngay và phần runtime còn thiếu

- Unknown fields bị từ chối ở mọi object. Public request không nhận user/model/state; context không có raw gradingSpec/User/Attempt. String có giới hạn theo Unicode code point ở cả JS/Python; 2.000 emoji vẫn là 2.000 ký tự, byte cap UTF-8 riêng.
- `parseAnalyzeInput` kiểm byte cap 64 KiB, các ID tham chiếu trong snapshot, IP/mask đi cặp, evidence revision, duplicate device/evidence/command. `assertBindings` kiểm call/hash/fence/version, command/evidence refs, hint escalation và tổng summary/steps/verification tối đa 6.000 code point. Đây là các kiểm tra bổ sung cho schema, Node phải gọi trước dispatch/finalize; không thay chính sách redaction/domain evidence.
- `parseRequestResource` kiểm stale và legacy provenance, evidence revision và command refs đã resolve. Legacy feedback không có revision chỉ dùng deterministic, stale=null; không gắn revision live giả.
- `canonicalAdmissionPayload` trả chuỗi canonical để backend hash SHA-256: attemptId + body validate, bỏ clientRequestId, NFC/newlines/optional null và sort keys. Lookup DB theo userId/clientRequestId phải diễn ra trước kiểm stale/recovery mới.
- Request terminal không reopen. RUNNING → QUEUED có guard chưa dispatch; provider unknown có thể reconcile nhưng request terminal không thay. Unit state graph không chứng minh các cập nhật DB là atomic.
- Usage UNRESOLVED không bị mặc định bằng 0. Price/accounting là Node, không do model. Schema non-negative không chứng minh quota/settlement qua nhiều replica: cần constraint/transaction tests ở BE-01/03/04/QA-01/04.
- Schema không chứng minh quyền truy cập, chữ ký JWT, không lộ secret trong allowed text, prompt injection/XSS hoặc độ đúng chẩn đoán. Không mở cohort/model thật dựa trên contract tests.

## Version và tương thích

Hiện chỉ có 1.0.0. Một bản minor thêm optional field chỉ tương thích qua version negotiation/encoder không phát field mới cho client cũ; strict parser không tự bỏ unknown fields. Khi có version mới cần current+previous schema/adapter và fixtures trong cửa sổ rollout; đổi nghĩa hoặc required field dùng major mới. Body/header lệch hoặc version không hỗ trợ là AI_INVALID_REQUEST, không ép kiểu về bản mới.

## Kết quả kiểm tra local ngày 19/10/2026

- Node: **100/100** test gồm 76 fixture wire (32 hợp lệ, 44 không hợp lệ), 16 ca binding bị từ chối và các kiểm fingerprint/state/revision/usage/size/drift.
- Frontend Jest: **77/77**; Python JSON Schema: **76/76** cùng wire fixtures. Đây là parity cấu trúc; quyền và DB race còn cần integration tests theo threat review.
- CLI hồi quy: **76 qua, 1 tích hợp DB bỏ qua** với `LAB_INTEGRATION=0`. Generated artifact check, ESLint/Prettier và source boundaries đạt; đã thêm các bước kiểm contract vào workflow, chưa chạy workflow mới trên GitHub trong task này.
