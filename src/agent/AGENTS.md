# Vị trí triển khai các task agent

Code của AI Lab Assistant và các task agent tiếp theo phải nằm trong `src/agent`.
Đọc [README.md](README.md) để chọn thư mục. Sửa báo cáo trực tiếp trong file task ở
`docs/ai-lab-assistant`, dùng tiếng Việt dễ hiểu và ghi rõ phần đã chạy kiểm thử.

- Node/backend AI, hàng đợi, quota, context, output, diagnostics: `node/`.
- Tiến trình worker: `workers/`; router HTTP của agent: `routes/`.
- Python service, orchestration và evals của PY-01/PY-02 trở đi: `python/`.
- Schema nguồn dùng chung cho browser/Node và artifacts Python: `contracts/`.
- Giao diện, hook và HTTP client AI chạy trong browser: `browser/`, package
  `@ccna/agent-ui`; không import Node/backend hoặc code ứng dụng frontend.
- Dữ liệu lab dùng riêng cho agent: `fixtures/labs/`; test chứng nhận: `tests/`.
- Công cụ DB local, kiểm hợp đồng, ngân sách và storage: `scripts/`.

Backend ứng dụng gọi qua `@ccna/agent/...`; frontend được dùng contract và
`@ccna/agent-ui` an toàn cho browser; shared chỉ được dùng contract.
Không đưa code Node, DB, provider hoặc secrets vào contract/giao diện browser.
Schema Prisma, migration đã áp dụng và domain simulator dùng chung vẫn do backend/shared
quản lý. Nếu task cần sửa điểm nối ở đó thì sửa trực tiếp, giữ phần triển khai agent
ở thư mục này; không tạo bản sao logic hoặc migration.

Giữ các yêu cầu kế hoạch, kiểm tra và ghi kết quả trong `Agent.md` ở gốc repo.
