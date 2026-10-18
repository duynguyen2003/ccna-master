# Cấu trúc mã nguồn

Repo dùng pnpm workspace với hai ứng dụng và một package dùng chung. Cài dependencies tại thư mục gốc bằng `pnpm install --frozen-lockfile`.

```text
ccna-master/
├── src/
│   ├── frontend/
│   │   ├── public/
│   │   ├── scripts/react-scripts.cjs
│   │   ├── src/
│   │   │   ├── assets/images/
│   │   │   ├── components/
│   │   │   │   ├── ui/       # Control, loader, toast dùng chung
│   │   │   │   ├── common/   # Ví dụ: MarkdownRenderer
│   │   │   │   └── layout/   # Header, navbar, footer, layout người học
│   │   │   ├── features/
│   │   │   │   ├── admin/    # pages, components, layout, charts, utils, styles
│   │   │   │   ├── auth/
│   │   │   │   ├── courses/
│   │   │   │   ├── lessons/
│   │   │   │   ├── labs/
│   │   │   │   ├── exams/
│   │   │   │   ├── tools/
│   │   │   │   ├── home/
│   │   │   │   ├── profile/
│   │   │   │   └── resources/
│   │   │   ├── context/
│   │   │   ├── data/         # ports.json, cisco-commands.json
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── utils/
│   │   │   ├── App.js
│   │   │   └── index.js
│   │   └── package.json
│   ├── backend/
│   │   ├── src/              # API, controllers, middleware, services, tests Node
│   │   ├── prisma/           # Schema và lịch sử migration hiện có
│   │   └── package.json
│   ├── scripts/              # Kiểm tra kiến trúc/icons, backup/restore, import
│   ├── shared/
│   │   ├── simulation/       # Engine CLI/mạng và grader thuần
│   │   ├── labs/             # Dữ liệu lab và golden solution
│   │   ├── cliLabCatalog.js
│   │   ├── cliLabSchema.js
│   │   ├── sanitizeHtml.js
│   │   └── package.json
│   └── storage/uploads/      # Dữ liệu runtime, phục vụ ở /uploads như trước
├── docs/
├── prisma.config.ts          # CLI Prisma trỏ tới src/backend/prisma
├── pnpm-workspace.yaml
└── package.json              # Các lệnh điều phối chạy từ root
```

## Ranh giới và cách thêm mã

- Code chỉ phục vụ một chức năng đặt trong `src/frontend/src/features/<chức-năng>`, chia `pages`, `components`, `hooks`, `utils`, `data`, `styles` khi cần. Test đặt cạnh file được kiểm thử.
- UI dùng chung đặt trong `src/frontend/src/components`; các hook/utils dùng chung vẫn ở cấp `src/frontend/src`.
- Frontend và backend chỉ dùng chung mã qua `@ccna/shared/<module>`. Không import giữa hai ứng dụng. Shared không phụ thuộc API, React, filesystem, database hay xác thực.
- `src/frontend/src/features/labs/utils/cliLabPreview.js` dùng cùng `@ccna/shared/simulation/networkEngine` và `gradingEngine` với API. Quyền truy cập lượt làm bài, database và xử lý HTTP vẫn thuộc backend.
- Chạy `pnpm check:boundaries` để kiểm tra ranh giới cùng đường dẫn import và asset CSS. CI cũng chạy kiểm tra này.

## Lệnh chạy

Các lệnh hiện có vẫn chạy từ thư mục gốc:

| Lệnh                                     | Tác dụng                                                         |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `pnpm start`                             | Frontend React                                                   |
| `pnpm server`                            | Backend API                                                      |
| `pnpm build`                             | Build frontend ra `src/frontend/build`                           |
| `pnpm test --watchAll=false --runInBand` | Test frontend, không quét test Node của API                      |
| `pnpm test:cli`                          | Test mô phỏng, grader và hợp đồng CLI                            |
| `pnpm test:learning`                     | Test domain/lộ trình học                                         |
| `pnpm test:core`                         | Test tài khoản, thi và runtime                                   |
| `pnpm check:icons`                       | Kiểm tra icon facade của browser                                 |
| `pnpm check:boundaries`                  | Kiểm tra kiến trúc và tham chiếu file                            |
| `pnpm prisma:generate`                   | Generate client từ `src/backend/prisma/schema.prisma`            |
| `pnpm db:deploy`                         | Áp dụng migration đã commit; chỉ chạy khi chủ động triển khai DB |

Các test tích hợp database chỉ bật khi có cờ môi trường tương ứng và database thử nghiệm; xem [operations.md](operations.md).

## Môi trường và triển khai

- Root `.env` hiện có tiếp tục dùng được. Backend đọc biến của môi trường triển khai trước, rồi `src/backend/.env`, sau cùng root `.env`.
- Frontend dùng cấu hình CRA trong `src/frontend/.env*`. Nếu chưa khai báo tại đó, wrapper chỉ lấy các biến `REACT_APP_*` và tùy chọn dev/build được cho phép từ root `.env`; không đọc khóa database/JWT từ file root vào tiến trình React.
- Mẫu cấu hình riêng nằm ở `src/frontend/.env.example` và `src/backend/.env.example`. Compose vẫn đọc file môi trường tại root như trước.
- Vercel dùng repository root, build `pnpm build`, output `src/frontend/build`. Render có thể giữ lệnh root `pnpm server`; không cần trỏ vào đường dẫn `src/Backend` cũ.
- Docker giữ hai target `frontend`/`backend`; volume upload gắn tại `/app/src/storage/uploads`. Dữ liệu bên trong named volume được giữ khi đổi vị trí mount.
- Việc sắp xếp source không đổi nội dung schema/migration, URL API hoặc định dạng dữ liệu. Không cần migration DB chỉ vì đổi thư mục.
