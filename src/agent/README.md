# Agent — AI Lab Assistant

Đây là nơi triển khai các task agent, cùng cấp với `src/backend` và `src/frontend`.
Phần đã làm của BE-01…BE-05, SIM-01 và các task chuẩn bị đã được chuyển về đây.

```text
src/
├── backend/                 API ứng dụng, domain, Prisma
├── frontend/                Giao diện
├── shared/                  Simulator và phần dùng chung
└── agent/
    ├── browser/             UI/hook/HTTP client browser-only, package @ccna/agent-ui
    ├── node/                Quyền truy cập, snapshot, request/quota,
    │   │                    worker lifecycle, context, kiểm câu trả lời
    │   ├── diagnostics/     Chẩn đoán SIM-01
    │   └── fixtures/        Dữ liệu và tiến trình hỗ trợ test
    ├── workers/             Tiến trình chạy hàng đợi
    ├── routes/              API công khai và nội bộ của agent
    ├── contracts/           Schema nguồn, JSON Schema và fixtures v1
    ├── fixtures/labs/       Ba lab và các ca lỗi DISC-03
    ├── tests/               Kiểm chứng lab với simulator
    ├── scripts/             Công cụ kiểm thử, DB local, ngân sách
    ├── prisma/              Config chỉ dành cho DB thử của agent
    └── python/              Dịch vụ Python, adapter fake/Gemini, tests và evals
```

`@ccna/agent` là workspace Node. `@ccna/agent-contracts` là workspace riêng chỉ chứa
contract dùng được trong browser. Đường import `@ccna/shared/aiLabContract` được giữ
bằng một file chuyển tiếp, nguồn schema thật nằm ở `contracts/aiLabContract.js`.

`@ccna/agent-ui` chứa source React và controller riêng cho browser. Frontend chỉ
ghép panel vào workspace và truyền adapter UI/token/API URL. CRA biên dịch đúng
thư mục browser qua wrapper; không cấp quyền import phần Node của agent.

Backend nạp router và các hàm agent qua `@ccna/agent/node/...` hoặc
`@ccna/agent/routes/...`. Agent vẫn dùng quyền truy cập lab, session, tiến độ và kết
nối DB của ứng dụng; việc chuyển thư mục chưa tách agent thành một backend độc lập.
Các điểm nối đó ở `src/backend`. Schema và lịch sử migration Prisma cũng ở backend,
để lần triển khai sau tiếp tục nhận đúng lịch sử DB.

Chạy từ gốc repo:

```sh
pnpm install --frozen-lockfile
pnpm test:ai
pnpm check:ai:contracts
pnpm check:ai:fixtures
pnpm check:boundaries
pnpm test:cli
```

`test:ai` chạy test offline; không chạy các file integration cần DB. Để kiểm storage
và HTTP trên cluster local riêng, dùng các lệnh đã có:

```sh
pnpm ai:db:start
pnpm test:ai:storage
pnpm ai:db:stop
```

Các lệnh `ai:worker`, `test:ai:context`, `test:ai:diagnostics`, `test:ai:local`,
`check:ai:budget`, `ai:live:*` và `ai:db:*` vẫn giữ tên. Việc chuyển thư mục không
cấp quyền gọi provider thật. Dữ liệu DB thử, log và ledger chi phí vẫn ở `.tmp/`
tại gốc repo; không tạo ledger mới khi đổi đường dẫn công cụ.

Python dùng [dịch vụ nội bộ Gemini](python/README.md). Cài bằng
`uv sync --project src/agent/python --frozen`, rồi chạy `pnpm test:ai:python` và
`pnpm check:ai:python`. Worker/Python mặc định tắt; chọn
`python-gemini` với key phía server khi chạy với DB thử riêng. Kiểm luồng đầy đủ
bằng `pnpm test:ai:python:integration`; lệnh này giả lập Google, không tốn tiền.
`pnpm ai:python:live:check` chủ động thử một generation thật bằng dữ liệu tổng hợp,
dùng ledger đã có. Xem [PY-02](../../docs/ai-lab-assistant/baseline/PY-02-provider.md).

Báo cáo, tiến độ và giải thích task tiếp tục sửa tại
[docs/ai-lab-assistant](../../docs/ai-lab-assistant/README.md). Xem
[hướng dẫn cho task tiếp theo](AGENTS.md) trước khi thêm code.

Để ADMIN test trực tiếp trên app dev, xem [hướng dẫn admin-test](../../docs/ai-lab-assistant/baseline/admin-test-access.md).
`pnpm ai:admin:enable` kiểm tra cấu hình Gemini; thêm `--apply` để chọn `app-gemini` trên môi trường dev
`admin-test`. Chạy backend, `pnpm ai:python`, rồi `pnpm ai:worker`. Launcher chỉ
truyền service secret/key Gemini cho Python; không truyền DB/JWT/owner secret.
Ngân sách dùng chung ledger đã có, không reset lượt gọi; không mở cohort học viên
hoặc production. Xem [hướng dẫn admin-test](../../docs/ai-lab-assistant/baseline/admin-test-access.md).

Từ 29/10/2026, runtime không còn mode `fake`, `python-fake`, `app-fake` hoặc
adapter trả lời cố định. `--gemini` được giữ như alias tương thích của setup.
Thiếu key/provider lỗi trả trạng thái không khả dụng, không ghép gợi ý thay thế.
Mock chỉ nằm trong test/fixture để kiểm offline; không được launcher ứng dụng nạp.
