# Danh sách task: tích hợp AI vào lab CCNA Master (bản dễ hiểu)

> Viết lại từ `docs/ai-lab-assistant/03-delivery-backlog.md` bằng ngôn ngữ đơn giản. Giữ nguyên mã task (DISC-01, BE-03...) để đối chiếu với tài liệu gốc. Số giờ là ước lượng của kế hoạch gốc, chưa phải số đo thực tế.

**Quyết định cập nhật 19/10/2026:** [ADR-001…007 và contract v1](../../src/agent/contracts/ai-lab/v1/README.md) đã chốt R1 bất đồng bộ, Node worker + Python service, Node giữ quyền/simulator/quota/accounting. Các nhãn ưu tiên trong bản dễ hiểu là gợi ý ban đầu; không được dùng để bỏ durable queue, Python hoặc các gate bắt buộc đã chốt. Tiến độ nghiệm thu theo backlog gốc.

**Nơi viết code:** từ 26/10/2026, các task agent triển khai trong
[`src/agent`](../../src/agent/README.md), cùng cấp `src/backend`. Các phần đã làm đã
được chuyển vào đó; PY-01/PY-02 tiếp tục trong `src/agent/python`. File này và các
báo cáo task vẫn ở `docs/ai-lab-assistant` để theo dõi tiến độ.

## 1. Đọc nhanh

**Cập nhật 22/10/2026:** theo yêu cầu mới dùng model thật, [Gemini đã chạy thử thành công trên nút Giải thích kết quả local](adr/ADR-009-local-live-gemini.md), có giới hạn 20 lần thử và ngân sách 0,10 USD toàn đợt. Trợ lý hội thoại mới vẫn cần các task BE/PY tiếp theo; không tính đây là hoàn thành eval hoặc pilot.

- Có **47 task**, chia thành 5 giai đoạn: chuẩn bị, xây nền, chạy AI thật và thử với nhóm nhỏ, hoàn thiện và phát hành, và cuối cùng là trợ lý tự chọn công cụ để xem.
- Mỗi task có: làm gì, để làm gì, xong khi nào, số giờ ước tính, và task nào cần xong trước.
- Mình gắn thêm một nhãn cho mỗi task. Đây là **ý kiến của mình, không có trong kế hoạch gốc**, dựa trên việc bạn làm một mình:
  - **[Cốt lõi]**: nên làm trong mọi trường hợp.
  - **[Làm bản gọn]**: cần có, nhưng có thể làm đơn giản hơn kế hoạch gốc.
  - **[Hoãn được]**: để sau, khi đã có người dùng thật và thấy cần.
- Giả định của kế hoạch gốc: một người làm, 25 giờ tập trung mỗi tuần, cộng thêm 25% giờ dự phòng.

## 2. Từ hay gặp (giải thích đơn giản)

| Từ | Nghĩa đơn giản |
|---|---|
| Nhà cung cấp AI | Công ty cho dùng model AI qua mạng (ví dụ OpenAI, Anthropic, Google). Mỗi lần gọi đều tốn tiền. |
| Lời dặn cho AI (prompt) | Đoạn chữ viết sẵn để bảo AI nó là ai, được làm gì, không được làm gì. |
| Khuôn câu trả lời (schema) | Mẫu cố định cho câu trả lời của AI (có những ô nào, mỗi ô là gì) để giao diện hiển thị ổn định. Thư viện kiểm tra khuôn: Zod (JavaScript), Pydantic (Python). |
| Câu trả lời dự phòng | Lời giải thích soạn sẵn, không dùng AI, hiện ra khi AI lỗi, hết lượt hoặc đang bị tắt. |
| Hạn mức | Số lượt hỏi AI tối đa của mỗi người mỗi ngày, và số tiền tối đa của cả hệ thống. |
| Bản chụp trạng thái | Bản sao tình trạng bài lab (thiết bị, cấu hình) tại lúc học viên hỏi. AI đọc bản chụp, không động vào bài thật. |
| Tiến trình chạy nền | Chương trình chạy phía sau, nhận việc từ hàng chờ và gọi AI, để giao diện không phải đứng chờ. |
| Biên nhận | Bản ghi một lần gọi AI đã xảy ra, dùng để đối soát chi phí và tránh gọi hai lần. |
| Lời giải mẫu | Chuỗi lệnh đúng hoàn chỉnh của một bài lab, dùng để kiểm tra hệ thống chấm điểm và AI. |
| Bộ câu hỏi thử | Tập tình huống có sẵn để chấm chất lượng AI mỗi khi đổi lời dặn hoặc đổi model. |
| Bản cũ | Câu trả lời của AI dựa trên cấu hình bài lab trước đó, còn bài lab đã thay đổi sau lúc hỏi. |
| Môi trường thử | Bản hệ thống giống thật nhưng dùng dữ liệu và khóa riêng, để thử nghiệm an toàn. |
| Công tắc tắt khẩn cấp | Nút tắt tính năng AI ngay lập tức mà không cần sửa code. |
| Mở dần | Cho một phần nhỏ người dùng dùng trước (5%, rồi 25%...). Có vấn đề thì quay lại. |

## 3. Hiện trạng (theo tài liệu kế hoạch ngày 16/10/2026)

**Đã có:**

- Nút “Giải thích kết quả” gọi AI thẳng từ máy chủ, có câu dự phòng khi AI lỗi.
- Hệ thống chấm bài tự động và trình mô phỏng mạng.
- Lab nhóm, chế độ xem lại, đăng nhập có kiểm tra phiên.
- Giới hạn số lệnh CLI theo người dùng, nhưng đếm trong bộ nhớ của từng máy chủ nên không dùng chung được khi chạy nhiều máy chủ.

**Chưa có:**

- Chương trình riêng cho phần AI viết bằng Python.
- Nơi lưu hội thoại AI, hàng chờ, hạn mức và chi phí.
- Khung trợ lý trên giao diện lab.
- Công tắc tắt khẩn cấp, trần ngân sách, bộ câu hỏi thử chất lượng.

**Lưu ý:** tài liệu gốc ghi rõ đây là kết quả đọc thư mục làm việc trên máy, nhiều thay đổi còn chưa commit. Vì vậy chưa chắc mọi thứ đã lên GitHub hay đang chạy thật. Task DISC-01 có mặt để làm rõ chuyện này.

## 4. Tổng quan

| Giai đoạn | Mục tiêu | Số task | Giờ thấp | Giờ cao |
|---|---|---:|---:|---:|
| 0. Chuẩn bị | Hiểu hiện trạng, chốt bài lab mẫu, quy ước chung, ngân sách | 5 | 29 | 48 |
| 1. Xây nền | Có luồng đầy đủ chạy được nội bộ (dùng AI giả) | 15 | 124 | 188 |
| 2. AI thật và thử nhóm nhỏ | Gắn model thật, đo chất lượng và chi phí, mời 10–20 học viên | 11 | 98 | 152 |
| 3. Hoàn thiện và phát hành | Sửa theo thử nghiệm, kiểm tra kỹ, mở dần | 9 | 70 | 108 |
| **Bản phát hành đầu (giai đoạn 0–3)** | | **40** | **321** | **496** |
| Cộng 25% dự phòng | | | 401 | 620 |
| 4. Trợ lý tự chọn công cụ xem | Làm sau khi bản đầu chạy ổn | 7 | 58 | 92 |

**Lịch tham khảo cho bản phát hành đầu (gồm dự phòng):**

- 15 giờ/tuần: khoảng 27–42 tuần.
- **25 giờ/tuần: khoảng 17–25 tuần** (trung tâm khoảng 21 tuần).
- 35 giờ/tuần: khoảng 12–18 tuần.
- Giai đoạn 0 và 1 (có bản chạy thử nội bộ đầy đủ): 153–236 giờ, khoảng 8–12 tuần.
- Giai đoạn 4 thêm khoảng 3–5 tuần.

**Các cổng kiểm tra:**

- **G0**: xong giai đoạn 0 (có ngân sách và môi trường thử).
- **G1**: demo nội bộ đạt (task GATE-01).
- **G2**: đủ điều kiện mời học viên dùng thử (kiểm tra ở REL-01).
- **Cổng phát hành**: ở REL-03.

**Đường đi chính (không thể bỏ qua):** chốt quy ước → dữ liệu và quyền → nhận câu hỏi và hạn mức → gọi AI → ghép giao diện → đo chất lượng → thử nhóm nhỏ → cổng phát hành. Mỗi lúc chỉ nên làm tối đa một task code chính và một task đang chờ phản hồi hoặc quan sát.

## 5. Bảng toàn bộ 47 task

| Mã | Tên | Giờ | Cần xong trước | Nhãn |
|---|---|---|---|---|
| DISC-01 | Kiểm tra hiện trạng hệ thống | 4–6 | không | Làm bản gọn |
| DISC-02 | Hỏi học viên, chốt yêu cầu | 5–8 | DISC-01 | Làm bản gọn |
| DISC-03 | Chọn 3 bài lab mẫu và lời giải mẫu | 10–16 | DISC-02 | Cốt lõi |
| ADR-01 | Chốt các quy ước chung | 6–10 | DISC-01, DISC-03 | Làm bản gọn |
| OPS-00 | Chốt ngân sách và nơi chạy | 4–8 | DISC-01, ADR-01 | Cốt lõi |
| BE-01 | Thêm bảng dữ liệu mới | 8–12 | ADR-01 | Làm bản gọn |
| BE-02 | Kiểm tra quyền và chụp trạng thái bài lab | 8–12 | BE-01, DISC-03 | Cốt lõi |
| BE-03 | Nhận câu hỏi, chống gửi trùng, giới hạn lượt | 12–18 | BE-01, BE-02, OPS-00 | Làm bản gọn |
| BE-04 | Tiến trình chạy nền gọi AI | 12–18 | BE-03 | Hoãn được |
| BE-05 | Lọc dữ liệu gửi AI và kiểm tra câu trả lời | 10–14 | BE-02, ADR-01 | Cốt lõi |
| SIM-01 | Bộ tự chẩn đoán lỗi cho 3 lab | 12–18 | DISC-03, BE-05 | Cốt lõi |
| PY-01 | Dựng chương trình Python cho phần AI | 5–8 | ADR-01 | Hoãn được |
| PY-02 | Nối nhà cung cấp AI và khuôn câu trả lời | 8–12 | PY-01, BE-04, BE-05 | Hoãn được |
| UX-01 | Phác giao diện và viết chữ cho các trạng thái | 5–8 | DISC-02, ADR-01 | Làm bản gọn |
| FE-01 | Làm khung trợ lý trên giao diện | 8–12 | UX-01 | Cốt lõi |
| FE-02 | Nối giao diện với máy chủ | 10–16 | FE-01, BE-03, PY-02 | Làm bản gọn |
| BE-06 | Khóa đường gọi AI cũ, làm câu dự phòng chung | 4–6 | BE-03, BE-05 | Cốt lõi |
| QA-01 | Kiểm thử quyền, dữ liệu, nhiều người cùng lúc | 10–16 | BE-04, BE-05, SIM-01, PY-02, FE-02, BE-06 | Làm bản gọn |
| OPS-01 | Tự động kiểm thử và đóng gói | 8–12 | BE-04, PY-01, QA-01 | Làm bản gọn |
| GATE-01 | Demo nội bộ | 4–6 | OPS-01, FE-02, SIM-01 | Làm bản gọn |
| AI-01 | Viết lời dặn AI và 3 mức gợi ý | 8–12 | GATE-01, DISC-03 | Cốt lõi |
| AI-02 | Chọn model bằng cách đo, tính chi phí | 12–18 | AI-01, PY-02, OPS-00 | Cốt lõi |
| FE-03 | Hoàn thiện lỗi, bản cũ, gợi ý | 8–12 | FE-02, AI-01 | Làm bản gọn |
| BE-07 | Đánh giá của học viên và số liệu đầu tiên | 8–12 | BE-01, GATE-01 | Làm bản gọn |
| BE-08 | Xóa hội thoại và thời hạn lưu | 10–16 | BE-04, FE-02 | Làm bản gọn |
| OPS-02 | Trần ngân sách, công tắc tắt, theo dõi | 8–12 | BE-04, BE-07, AI-02 | Cốt lõi |
| QA-02 | Kiểm thử trọn luồng trên trình duyệt thật | 8–12 | FE-03, BE-07, BE-08, OPS-02 | Làm bản gọn |
| OPS-04 | Thử tải nhiều người cùng lúc | 12–18 | QA-02, OPS-01, OPS-02 | Hoãn được |
| OPS-03 | Môi trường thử, sao lưu, diễn tập | 6–10 | OPS-01, BE-08, OPS-02, OPS-04 | Làm bản gọn |
| REL-01 | Mở thử nghiệm kín | 6–10 | AI-02, QA-02, OPS-03 | Cốt lõi |
| REL-02 | Quan sát và sửa lỗi sau thử nghiệm | 12–20 | REL-01 | Cốt lõi |
| SIM-02 | Sửa nội dung lab theo thử nghiệm | 8–12 | REL-02 | Cốt lõi |
| BE-09 | Giải thích kết quả đúng với bản nộp | 8–12 | BE-06, BE-08, AI-01 | Làm bản gọn |
| QA-03 | Chấm chất lượng bản phát hành đầu | 10–16 | AI-02, SIM-02, BE-09 | Làm bản gọn |
| QA-04 | Cố ý làm hỏng để thử độ bền | 12–18 | QA-01, BE-08, BE-09, OPS-02 | Hoãn được |
| OPS-05 | Đóng gói bản chạy thật, cảnh báo, phát hành tự động | 8–12 | OPS-04, OPS-02 | Hoãn được |
| OPS-06 | Khôi phục, thời hạn lưu, đối soát chi phí | 8–12 | OPS-03, BE-08, QA-04 | Hoãn được |
| FE-04 | Dễ dùng, vừa mọi màn hình, nhanh | 6–10 | FE-03, BE-09 | Làm bản gọn |
| DOC-01 | Tài liệu hỗ trợ và vận hành cho một người | 4–6 | REL-02, OPS-05, OPS-06 | Làm bản gọn |
| REL-03 | Cổng phát hành, mở dần | 6–10 | QA-03, QA-04, OPS-05, OPS-06, FE-04, DOC-01 | Làm bản gọn |
| R2-01 | Quyết định có đáng làm giai đoạn 4 không | 4–6 | REL-03 | Hoãn được |
| R2-02 | Bộ công cụ chỉ đọc cho AI | 10–16 | R2-01 | Hoãn được |
| R2-03 | Quyền cho từng công cụ | 8–12 | R2-02 | Hoãn được |
| R2-04 | AI tự chọn công cụ, có giới hạn | 12–20 | R2-03 | Hoãn được |
| R2-05 | Tính chi phí từng bước, hiện tiến trình | 8–12 | R2-04 | Hoãn được |
| R2-06 | Chấm chất lượng và thử tấn công | 10–16 | R2-05 | Hoãn được |
| R2-07 | Thử nhóm nhỏ, quyết định mở rộng | 6–10 | R2-06 | Hoãn được |

Tổng cộng theo nhãn: 13 task Cốt lõi, 20 task Làm bản gọn, 14 task Hoãn được.

## 6. Chi tiết từng task

### Giai đoạn 0: Chuẩn bị (29–48 giờ)

Mục tiêu: hiểu hiện trạng, chốt bài lab mẫu, quy ước chung và ngân sách. Chưa viết code tính năng.

#### DISC-01 · Kiểm tra hiện trạng hệ thống

**Nhãn:** Làm bản gọn · **Giờ:** 4–6 · **Cần xong trước:** không có

- **Làm gì:** Ghi lại hệ thống đang chạy ở đâu và ở phiên bản nào: máy của bạn, nhánh `main` trên GitHub, môi trường thử, môi trường thật. Ghi cả commit đang chạy, cơ sở dữ liệu đã cập nhật đến đâu, sơ đồ máy chủ trung gian (Nginx) và danh sách “chìa khóa bí mật” (chỉ ghi tên, không ghi giá trị).
- **Để làm gì:** Biết chính xác mình đang đứng ở đâu trước khi thêm AI, tránh nhầm “chạy được trên máy mình” với “đang chạy thật”.
- **Xong khi:** Có bảng so sánh các môi trường. Phân biệt rõ thay đổi nào mới có trên máy bạn, chưa đưa lên. Mỗi vấn đề cản trở (đăng nhập, cập nhật cơ sở dữ liệu, sao lưu, máy chủ trung gian) có một mục ghi lại. Không dùng câu “CI trên main từng xanh” làm bằng chứng rằng mọi thứ đã sẵn sàng. Task này không tự triển khai gì lên môi trường thật.
- **File chính:** README kế hoạch, ghi chú quyết định về nền tảng, `.github/workflows/ci-cd.yml`, `compose*.yaml`, `docs/operations.md`.

#### DISC-02 · Hỏi học viên, chốt yêu cầu

**Nhãn:** Làm bản gọn · **Giờ:** 5–8 · **Cần xong trước:** DISC-01

- **Làm gì:** Quan sát hoặc nói chuyện ngắn với 3–5 học viên khi họ làm lab. Tìm ra 3 chỗ họ hay bí nhất. Chốt trợ lý AI giúp ai, giúp việc gì, đo thành công bằng cách nào, và lên lịch chạy thử.
- **Để làm gì:** Làm đúng thứ học viên cần thay vì đoán.
- **Xong khi:** Có danh sách đối tượng dùng, 3 vướng mắc hàng đầu, cách đo kết quả và lịch thử. Điều chưa có số liệu phải ghi rõ là “giả định”, không viết như sự thật.
- **File chính:** `docs/ai-lab-assistant/01-product-and-learning.md`, thư mục `research/` (tạo khi làm).

#### DISC-03 · Chọn 3 bài lab mẫu và lời giải mẫu

**Nhãn:** Cốt lõi · **Giờ:** 10–16 · **Cần xong trước:** DISC-02

- **Làm gì:** Chọn 3 bài lab đại diện: địa chỉ IP và cổng mạng, định tuyến (đường đi), VLAN. Mỗi bài chuẩn bị một lời giải mẫu đúng hoàn chỉnh, ít nhất 5 kiểu lỗi hay gặp và 2 cấu hình đúng khác nhau. Đáp án bí mật của phần chấm điểm giữ riêng, không đưa cho AI.
- **Để làm gì:** Có “đề thi mẫu” để kiểm tra hệ thống chấm điểm và AI làm việc đúng.
- **Xong khi:** Chạy lời giải mẫu trong trình mô phỏng thì bộ chấm điểm cho kết quả đúng. Có các ca khó như “cổng không dùng bị tắt (không phải lỗi)” và “đường mặc định hợp lệ”.
- **File chính:** dữ liệu mẫu mới trong `src/agent/python/evals/` và dữ liệu test của Node; đối chiếu với `networkEngine`, `gradingEngine` và danh sách lệnh. Nội dung lab cần sửa thì mở issue riêng.

#### ADR-01 · Chốt các quy ước chung

**Nhãn:** Làm bản gọn · **Giờ:** 6–10 · **Cần xong trước:** DISC-01, DISC-03

- **Làm gì:** Viết ra quy ước chung cho ba phần (giao diện, máy chủ Node, phần AI): dữ liệu giữa các phần có dạng gì; một câu hỏi AI đi qua những trạng thái nào (đang chờ, đang xử lý, xong, lỗi, bị hủy); các tình huống xấu cần tính trước (bấm gửi hai lần, bị xóa khỏi nhóm giữa chừng, đổi tài khoản, AI trả lời quá muộn).
- **Để làm gì:** Cả ba phần dùng chung một bản mô tả, không hiểu mỗi nơi một kiểu.
- **Xong khi:** Không còn quyết định mâu thuẫn (ví dụ trả lời ngay hay trả lời sau, phần nào sở hữu dữ liệu gì). Đã rà từng tình huống xấu ở trên.
- **File chính:** `src/agent/contracts/ai-lab/v1/`, tài liệu 02, dữ liệu mẫu hợp lệ và không hợp lệ.

#### OPS-00 · Chốt ngân sách và nơi chạy

**Nhãn:** Cốt lõi · **Giờ:** 4–8 · **Cần xong trước:** DISC-01, ADR-01

- **Tiến độ 22/10/2026:** xong nhánh **local/fake, 0 USD** theo lựa chọn của bạn; có [ADR-008](adr/ADR-008-local-fake-deployment.md), [bảng ngân sách và DB thử riêng](ops/OPS-00-local-fake.md), đã kiểm restart/ghi/rollback và mật khẩu. Gemini sẽ xem xét sau; chưa xác minh quota hay gọi thật. Được tiếp tục BE-01 bằng fake; G0 đầy đủ và staging ứng dụng vẫn chưa đạt.
- **Làm gì:** Chọn nơi đặt máy chủ, vài nhà cung cấp AI để so sánh, ngân sách tối đa cho một ngày và một tháng của giai đoạn thử, giờ hỗ trợ và người nhận cảnh báo.
- **Để làm gì:** AI tính tiền theo lượt, nên phải có mức trần trước khi gọi AI thật.
- **Xong khi:** Có mức trần chi phí cụ thể trước khi gọi AI thật. Biết giới hạn số lượt gọi của tài khoản sẽ dùng. Có môi trường thử tách biệt khỏi dữ liệu và khóa thật. Xong task này là qua cổng G0.
- **File chính:** ghi chú quyết định về triển khai và bảng tính ngân sách (chỉ lưu tên khóa, không ghi giá trị vào Git).

### Giai đoạn 1: Xây nền (124–188 giờ)

Mục tiêu: có một luồng đầy đủ chạy được nội bộ. Học viên mở lab, hỏi, vẫn gõ lệnh trong lúc chờ, tải lại trang vẫn thấy kết quả. Dùng AI giả, chưa cần AI thật.

#### BE-01 · Thêm bảng dữ liệu mới

**Nhãn:** Làm bản gọn · **Giờ:** 8–12 · **Cần xong trước:** ADR-01

- **Tiến độ 23/10/2026:** hoàn thành local. Đã thêm 11 bảng AI và metadata nullable; 34 kiểm thử DB đạt, nâng cấp giữ nguyên dữ liệu ở 25 bảng cũ, client cũ và backup/restore vẫn hoạt động. [Bằng chứng và cách chạy lại](baseline/BE-01-storage.md). Migration mới được kiểm trên DB tạm riêng, chưa áp lên DB ứng dụng/production. Task tiếp theo **BE-02: kiểm quyền và chụp trạng thái lab**.
- **Làm gì:** Thêm các bảng mới trong cơ sở dữ liệu để lưu cuộc hội thoại, từng câu hỏi, từng tin nhắn, từng lần gọi AI, hạn mức, tiền giữ chỗ, đánh giá của học viên và vài bảng phụ. Đảm bảo mỗi học viên chỉ có một câu hỏi đang chạy. Cập nhật cơ sở dữ liệu đang có mà không làm mất dữ liệu cũ.
- **Để làm gì:** Có chỗ lưu bền vững. Tải lại trang hay khởi động lại máy chủ không làm mất trạng thái.
- **Xong khi:** Cơ sở dữ liệu mới và cơ sở dữ liệu cũ (đang có dữ liệu) đều cập nhật thành công. Dữ liệu cũ còn nguyên. Cơ sở dữ liệu tự chặn dữ liệu trùng. Chạy lại bản code cũ vẫn bình thường.
- **File chính:** `src/backend/prisma/schema.prisma`, file cập nhật cơ sở dữ liệu mới, dữ liệu test của Node.

#### BE-02 · Kiểm tra quyền và chụp trạng thái bài lab

- **Tiến độ 23/10/2026:** hoàn thành nền local; 7 kiểm integration DB/HTTP và 6 unit đạt. Đã nối metadata vào start/submit và guard vào namespace AI. [Bằng chứng](baseline/BE-02-access-snapshot.md). API nhận câu hỏi và kết nối UI hội thoại tiếp tục ở BE-03/FE-02.
**Nhãn:** Cốt lõi · **Giờ:** 8–12 · **Cần xong trước:** BE-01, DISC-03

- **Làm gì:** Trước khi trả lời, kiểm tra người hỏi: còn đăng nhập hợp lệ, tài khoản chưa bị khóa, còn là thành viên của bài lab, thuộc nhóm được dùng thử. Sau đó chụp lại trạng thái bài lab tại lúc hỏi (bỏ bớt thông tin nhạy cảm) để AI dựa vào bản chụp, không dựa vào thứ có thể đã thay đổi. Mỗi người chỉ đọc được hội thoại của chính mình, kể cả trong lab nhóm.
- **Để làm gì:** Không ai xem được hội thoại của người khác. AI không đọc nhầm trạng thái đã cũ.
- **Xong khi:** Người ngoài hoặc người đã bị xóa khỏi nhóm nhận “không tìm thấy”. Tài khoản bị khóa bị từ chối. Chủ bài lab không đọc được chat của thành viên. Bản chụp không đổi dù bài lab sau đó thay đổi. Việc chụp diễn ra nhanh, không giữ khóa bài lâu.
- **File chính:** `src/agent/node/access.js`, `snapshot.js`, nối với `attemptAccess.js` và controller.

#### BE-03 · Nhận câu hỏi, chống gửi trùng, giới hạn lượt

- **Tiến độ 23/10/2026:** hoàn thành admission local, kiểm 20 retries qua hai tiến trình backend và tranh quota/rollback DB. [Hồ sơ BE-03](baseline/BE-03-admission.md). API nhận/lấy trạng thái request đã có; xử lý queue và gọi model tiếp tục ở BE-04.
**Nhãn:** Làm bản gọn · **Giờ:** 12–18 · **Cần xong trước:** BE-01, BE-02, OPS-00

- **Làm gì:** Khi nhận một câu hỏi: kiểm tra trùng (bấm nhiều lần chỉ tính một lần), giữ chỗ chi phí trước khi gọi AI, giới hạn theo ngày cho từng người và cho cả hệ thống, mỗi người chỉ có một câu hỏi đang xử lý, báo lỗi theo một khuôn thống nhất. Xử lý đúng cả trường hợp dữ liệu hạn mức bị mất khi khôi phục từ bản sao lưu.
- **Để làm gì:** Chặn việc tốn tiền ngoài ý muốn (bấm liên tục, mở nhiều tab, chạy nhiều máy chủ).
- **Xong khi:** 20 lần gửi cùng một câu hỏi qua hai máy chủ chỉ tạo một yêu cầu. Gửi câu hỏi khác khi đã vượt hạn mức thì bị từ chối. Cùng mã nhưng nội dung khác thì báo xung đột (mã 409). Hạn mức không bao giờ bị âm. Nếu nơi lưu hạn mức lỗi thì không gọi AI.
- **File chính:** `ai/requests.js`, `quota.js`, `reservations.js`, `routes/aiLab.js`, controller.

#### BE-04 · Tiến trình chạy nền gọi AI

- **Tiến độ 23/10/2026:** hoàn thành local/fake. Worker có lease/fence/reaper, permit/receipt được xác thực, quyết toán một lần và xử lý usage chưa rõ. Kiểm bằng hai process cùng DB, CLI không chờ model giả. [Hồ sơ BE-04](baseline/BE-04-worker.md). Tiếp theo **BE-05**; Python/provider thật và UI hội thoại chưa bật.
**Nhãn:** Hoãn được · **Giờ:** 12–18 · **Cần xong trước:** BE-03

- **Làm gì:** Xây phần xử lý chạy nền: lấy việc từ hàng chờ, báo “còn sống” định kỳ, thu hồi việc bị bỏ dở. Chỉ gọi AI khi có “giấy phép”, ghi biên nhận sau mỗi lần gọi. Việc gọi AI đặt ngoài giao dịch dữ liệu để không giữ khóa lâu.
- **Để làm gì:** Học viên không phải đứng chờ AI. Nếu máy chủ sập giữa chừng thì không gọi AI hai lần và không tính tiền hai lần.
- **Xong khi:** Tiến trình chết trước khi gọi AI thì phục hồi an toàn. Chết sau khi gọi thì không gọi lại. Tiến trình chạy chậm đến muộn không ghi đè kết quả mới. Biên nhận trùng chỉ tính tiền một lần. Gõ lệnh trong terminal không bị chờ khi AI giả “ngủ”.
- **File chính:** `workers/aiWorker.js`, `ai/dispatch.js`, `receipts.js`, `leases.js`, `routes/aiInternal.js`.
- **Quyết định đã chốt ADR-001/002:** R1 dùng request bền vững và worker; không bỏ BE-04 để chuyển sang một HTTP đồng bộ.

#### BE-05 · Lọc dữ liệu gửi AI và kiểm tra câu trả lời

**Nhãn:** Cốt lõi · **Giờ:** 10–14 · **Cần xong trước:** BE-02, ADR-01

- **Tiến độ 26/10/2026:** hoàn thành local/fake. Worker đã lấy trạng thái lab thật qua bộ lọc; lịch sử chat chỉ đúng người/attempt/epoch. Bằng chứng/lệnh giả và đầu ra sai bị chặn trước lưu text, phí đã phát sinh vẫn theo dõi riêng. 121 unit/contract, 34 storage, 35 HTTP/DB đạt. [Chi tiết BE-05](baseline/BE-05-context-output.md). Vẫn dùng AI giả; chẩn đoán nguyên nhân và tokenizer/model thật tiếp tục ở SIM-01/PY. Chưa gửi nhật ký CLI vì thiếu ràng buộc actor/revision đầy đủ.
- **Làm gì:** Chỉ gửi cho AI phần được phép: tên và mục tiêu công khai của bài, trạng thái thiết bị, kết quả chấm đã lọc. Giới hạn độ dài. Lịch sử chat chỉ lấy của chính người hỏi. Kiểm tra câu trả lời của AI: đúng khuôn, bằng chứng có thật và ghi rõ lấy từ đâu, lệnh gợi ý nằm trong danh sách lệnh cho phép.
- **Để làm gì:** AI không bao giờ thấy đáp án ẩn. Câu trả lời bất thường bị chặn trước khi đến học viên.
- **Xong khi:** Dùng các “mã gài thử” (bí mật giả, đáp án giả, mã người dùng) và chúng không bao giờ xuất hiện ở chỗ gửi sang nhà cung cấp AI. Lệnh hoặc bằng chứng lạ bị chặn. Nội dung câu hỏi hay lệnh CLI không thể “ra lệnh” để thêm quyền cho AI.
- **File chính:** `ai/context.js`, `redaction.js`, `evidence.js`, dữ liệu mẫu theo quy ước.

#### SIM-01 · Bộ tự chẩn đoán lỗi cho 3 lab

**Nhãn:** Cốt lõi · **Giờ:** 12–18 · **Cần xong trước:** DISC-03, BE-05

- **Tiến độ 26/10/2026:** hoàn thành kỹ thuật local/fake. Node đã tự kiểm kết nối trên bản sao bằng simulator, có căn cứ cho lỗi cổng/link, IP/subnet, route chiều đi/về và VLAN. Không quy lỗi cho cổng không dùng hoặc mặc định thiếu route khi default route hợp lệ. SIM-01 36/36; tổng 158 unit/contract, 34 storage, 36 HTTP/DB đạt. [Bản giải thích SIM-01](baseline/SIM-01-diagnostics.md). Chưa có model thật/review CCNA độc lập; tiếp theo PY-01/PY-02.
- **Làm gì:** Viết các quy tắc tự kiểm tra (không dùng AI) cho bốn nhóm lỗi: cổng mạng (interface), mạng con (subnet), đường đi (route), VLAN. Mọi phân tích chạy trên bản sao, không đụng vào bài thật. Mỗi kết luận ghi rõ là “đã quan sát”, “suy ra” hay “chưa hỗ trợ”.
- **Để làm gì:** AI giải thích dựa trên kết luận đã chắc chắn, bớt đoán mò, bớt bịa.
- **Xong khi:** Đúng trên các ca đúng, sai và mơ hồ. Cổng không dùng bị tắt không bị coi là nguyên nhân. Có xét đường mặc định. Trước và sau khi phân tích, trạng thái bài và điểm số giống hệt nhau.
- **File chính:** `ai/diagnostics/`, dữ liệu test của trình mô phỏng; dùng lại network engine có sẵn.

#### PY-01 · Dựng chương trình Python cho phần AI

**Nhãn:** Hoãn được · **Giờ:** 5–8 · **Cần xong trước:** ADR-01

- **Làm gì:** Tạo một chương trình Python riêng (dùng FastAPI) lo phần nói chuyện với AI: cài đặt lặp lại được, có kiểm tra “còn sống / sẵn sàng”, chỉ nhận lời gọi nội bộ có xác thực, giới hạn kích thước dữ liệu, có chế độ AI giả.
- **Để làm gì:** Tách phần AI khỏi phần mô phỏng mạng, để sau này đổi model hay thêm tính năng mà không động vào phần chấm điểm.
- **Xong khi:** Cài mới từ file khóa phiên bản chạy được. Không có khóa AI thì báo “AI đang tắt” đúng cách. Không ghi khóa bí mật vào log. Không mở cổng ra ngoài ngoài ý muốn.
- **File chính:** `src/agent/python/pyproject.toml`, file khóa phiên bản, `app/main.py`, cấu hình và bảo mật, Dockerfile.
- **Quyết định đã chốt ADR-004/005:** Python xử lý prompt/provider; Node giữ domain/quyền/accounting. PY-01 nằm trong nền tảng R1.

#### PY-02 · Nối nhà cung cấp AI và khuôn câu trả lời

**Nhãn:** Hoãn được · **Giờ:** 8–12 · **Cần xong trước:** PY-01, BE-04, BE-05

- **Làm gì:** Viết lớp nối với nhà cung cấp AI theo kiểu dùng chung (đổi nhà cung cấp dễ), có bản giả để kiểm thử. Phải xin “giấy phép” trước khi gọi, không tự thử lại khi lỗi (tránh tính tiền hai lần), đặt thời hạn chờ, ghi biên nhận riêng. Cấu hình model nằm ở máy chủ, không nhận từ người dùng.
- **Để làm gì:** Chỉ có một chỗ duy nhất gọi AI, và chỗ đó được kiểm soát chặt.
- **Xong khi:** Câu trả lời đúng khuôn và sai khuôn đều được kiểm tra bằng Zod hoặc Pydantic. Hết thời gian, quá tải, nhà cung cấp trả lỗi, thiếu số liệu sử dụng đều có cách xử lý rõ. Cùng một giấy phép không gọi AI hai lần. Không nhận địa chỉ AI từ người dùng.
- **File chính:** `app/adapters/`, `schemas/`, phần gửi biên nhận, test.
- **Quyết định đã chốt ADR-003/007:** adapter Python phải claim permit và ghi receipt qua Node; không thay bằng đường provider trực tiếp bỏ qua lifecycle/ledger chung.

#### UX-01 · Phác giao diện và viết chữ cho các trạng thái

**Nhãn:** Làm bản gọn · **Giờ:** 5–8 · **Cần xong trước:** DISC-02, ADR-01

- **Làm gì:** Phác màn hình cho máy tính và điện thoại, kèm câu chữ cho từng trạng thái: trống, đang chờ, “bản cũ”, mất mạng, hết lượt, dùng câu dự phòng. Viết chính sách gợi ý, thông báo cho học viên biết dữ liệu nào được gửi đi, và ô đánh giá.
- **Để làm gì:** Nghĩ kỹ trải nghiệm trước khi code để ít phải sửa.
- **Xong khi:** Duyệt thử 5 tình huống (lần đầu dùng, mất mạng, lab nhóm, đổi tài khoản, AI hỏng) và người đọc hiểu được khi nào một câu trả lời dựa trên cấu hình cũ.
- **File chính:** ghi chú thiết kế và mock giao diện chạy trên máy.

#### FE-01 · Làm khung trợ lý trên giao diện

**Nhãn:** Cốt lõi · **Giờ:** 8–12 · **Cần xong trước:** UX-01

- **Làm gì:** Làm khung trợ lý (chỉ tải khi mở): thẻ tin nhắn kèm bằng chứng, thẻ chọn mức gợi ý, nút sao chép lệnh, nút đánh giá. Dùng HTML đúng nghĩa, dùng được bằng bàn phím.
- **Để làm gì:** Có phần giao diện để học viên dùng.
- **Xong khi:** Chạy được với câu trả lời giả. Nội dung Markdown không chạy được HTML hay script. Mở khung không làm vỡ kích thước terminal. Có trạng thái chờ riêng. Không tự cuộn khi đang đọc lịch sử.
- **File chính:** `src/frontend/src/features/ai-lab/`, CSS theo bộ màu của lab.

#### FE-02 · Nối giao diện với máy chủ

**Nhãn:** Làm bản gọn · **Giờ:** 10–16 · **Cần xong trước:** FE-01, BE-03, PY-02

- **Làm gì:** Mỗi câu hỏi có một mã ổn định. Luồng: gửi, nhận “đã nhận”, hỏi lại định kỳ để lấy kết quả. Tải lại trang vẫn tìm lại được câu hỏi theo mã. Lưu tạm kết quả riêng cho từng người, từng lần làm bài. Có nút hủy và xem lịch sử theo trang.
- **Để làm gì:** Chạy ổn khi mạng chậm, tải lại trang hay đổi tài khoản.
- **Xong khi:** Tải lại trang vẫn nhận lại kết quả. Gửi lại cùng mã không tạo thêm yêu cầu. Câu trả lời của người A đến muộn không hiện cho người B. Đóng khung thì ngừng hỏi lại. Terminal vẫn dùng bình thường.
- **File chính:** `useAiLabAssistant.js`, `Api.js`, `CliLabWorkspace.js`, test component.

#### BE-06 · Khóa đường gọi AI cũ, làm câu dự phòng chung

**Nhãn:** Cốt lõi · **Giờ:** 4–6 · **Cần xong trước:** BE-03, BE-05

- **Làm gì:** Nút “Giải thích kết quả” hiện gọi AI thẳng từ máy chủ và không bị giới hạn. Chuyển tạm sang dùng lời giải thích soạn sẵn (không dùng AI) trong lúc chuyển đổi. Soạn mẫu câu dự phòng từ thông tin công khai. Dùng chung luật nội dung với phần mới.
- **Để làm gì:** Đóng đường gọi AI tốn tiền mà không bị quản lý hạn mức.
- **Xong khi:** Không còn đường cũ gọi AI có phí mà bỏ qua hạn mức. Giao diện hiện tại vẫn đọc được lời giải thích. Câu dự phòng không chứa dữ liệu ẩn và không giả làm câu trả lời của AI.
- **File chính:** `labFeedback.js`, `labAttemptController.js`, cấu hình cũ.
- **Ghi chú của mình:** trong kế hoạch gốc task này nằm sau BE-03 và BE-05, nhưng hai việc nhỏ có thể làm ngay, không cần chờ. Một là lưu kết quả giải thích theo lần nộp để bấm lại không gọi AI nữa. Hai là lọc dữ liệu gửi cho AI. Khi lọc cần cẩn thận: mỗi kết quả kiểm tra hiện có cả `expected` và `actual` (đáp án mong đợi). Còn `message` nếu tác giả bài lab không tự viết thì câu mặc định ghi sẵn “Mong đợi …, hiện tại …” kèm giá trị đáp án (trong `gradingEngine.js`). Vì vậy chỉ bỏ `expected` và `actual` là chưa đủ, phải dùng thông điệp đã được viết hoặc lọc riêng.

#### QA-01 · Kiểm thử quyền, dữ liệu, nhiều người cùng lúc

**Nhãn:** Làm bản gọn · **Giờ:** 10–16 · **Cần xong trước:** BE-04, BE-05, SIM-01, PY-02, FE-02, BE-06

- **Làm gì:** Thử với hai máy chủ chạy song song, bấm gửi hai lần, tranh nhau hạn mức, thành viên bị xóa giữa chừng, phiên đăng nhập bị thu hồi, trạng thái bài đổi giữa chừng, đảm bảo không làm đổi bài, và câu trả lời của AI bị hỏng.
- **Để làm gì:** Tìm lỗi nguy hiểm (lộ dữ liệu, tính tiền trùng) trước khi có người dùng thật.
- **Xong khi:** Các nhóm test cơ bản về quyền, gửi trùng, trạng thái và chi phí đạt trên PostgreSQL thật. Có bộ đếm số lần gọi AI giả để chứng minh số lần gọi, không chỉ đếm số tin nhắn trong cơ sở dữ liệu.
- **File chính:** bộ test tích hợp cho Node và Python.

#### OPS-01 · Tự động kiểm thử và đóng gói

**Nhãn:** Làm bản gọn · **Giờ:** 8–12 · **Cần xong trước:** BE-04, PY-01, QA-01

- **Làm gì:** Tự động chạy kiểm thử (Node, Python, quy ước dữ liệu). Đóng gói thành container. Sắp xếp thứ tự khởi động, mạng riêng giữa các phần, giới hạn CPU/RAM/số kết nối cơ sở dữ liệu. Chạy cập nhật cơ sở dữ liệu một lần.
- **Để làm gì:** Dựng lại cả hệ thống nhanh và giống nhau mỗi lần.
- **Xong khi:** Dựng từ trắng trên môi trường thử thành công. Khởi động lại phần AI không làm mất yêu cầu. Phần giao diện và Node hiện tại vẫn build được. Khóa AI không lọt vào bản build hay ảnh đóng gói.
- **File chính:** file CI, phần bổ sung trong `compose`, lệnh chạy tiến trình nền, file mẫu biến môi trường.

#### GATE-01 · Demo nội bộ

**Nhãn:** Làm bản gọn · **Giờ:** 4–6 · **Cần xong trước:** OPS-01, FE-02, SIM-01

- **Làm gì:** Đóng vai học viên: mở lab, hỏi, vẫn gõ lệnh trong lúc chờ, tải lại trang, xem kết quả, đổi tài khoản, thu hồi thành viên. Chưa dùng AI thật.
- **Để làm gì:** Xem cả luồng có chạy trọn vẹn không trước khi tốn tiền gọi AI thật.
- **Xong khi:** Một luồng đầy đủ chạy được mà không phụ thuộc AI thật. Không còn vấn đề lớn về quyền, chi phí hay khóa. Cập nhật lại giờ công và phạm vi sau khi dùng thử. Qua task này là qua cổng G1.
- **File chính:** báo cáo G1 và ghi chép hoặc clip demo.

### Giai đoạn 2: AI thật và thử với nhóm nhỏ (98–152 giờ)

Mục tiêu: gắn model AI thật, đo chất lượng và chi phí, rồi mời 10–20 học viên dùng thử kín.

#### AI-01 · Viết lời dặn AI và 3 mức gợi ý

**Nhãn:** Cốt lõi · **Giờ:** 8–12 · **Cần xong trước:** GATE-01, DISC-03

- **Làm gì:** Viết lời dặn bằng tiếng Việt, đúng thuật ngữ lệnh mạng. Chia gợi ý thành 3 mức (nhẹ, chi tiết hơn, gần đáp án nhưng không đưa cấu hình đầy đủ). Dạy AI phân biệt “điều đã thấy” với “điều đoán”, biết hỏi thêm khi thiếu thông tin, và không đưa đáp án. Chuẩn bị ghi chú khái niệm đã được duyệt.
- **Để làm gì:** Quyết định AI nói thế nào, giúp ra sao và dừng ở đâu.
- **Xong khi:** Câu trả lời ngắn, có bước kiểm tra. AI dùng được giá trị công khai, giá trị ẩn không lọt vào. Có ca người dùng cố đòi cấu hình đầy đủ để thử. Người hiểu CCNA đã đọc mẫu.
- **File chính:** lời dặn có đánh số phiên bản, dữ liệu chính sách gợi ý, bản kê nội dung.

#### AI-02 · Chọn model bằng cách đo, tính chi phí

**Nhãn:** Cốt lõi · **Giờ:** 12–18 · **Cần xong trước:** AI-01, PY-02, OPS-00

- **Làm gì:** Tạo ít nhất 60 tình huống thử riêng cho lab, cộng thêm bộ thử an toàn và bộ thử khi có lỗi. Chạy ít nhất 2 cấu hình model. Ghi lại lượng chữ đã dùng, độ trễ, điểm chấm và phiên bản.
- **Để làm gì:** Chọn model dựa trên số liệu, không dựa vào cảm giác.
- **Xong khi:** Đạt ngưỡng để mở thử nghiệm. Chọn model vì chất lượng, giá, tốc độ và chính sách dữ liệu có bằng chứng. Đã nhập bảng giá và mức trần. Không sửa bộ thử để điểm đẹp hơn.
- **File chính:** chương trình chạy bộ thử, bản kê dữ liệu thử, báo cáo so sánh model.
- **Ghi chú của mình:** bắt đầu với 20–30 tình huống thử cũng đã có ích. Tăng dần lên 60 và 120 khi gần mở thử nghiệm và phát hành.

#### FE-03 · Hoàn thiện lỗi, bản cũ, gợi ý

**Nhãn:** Làm bản gọn · **Giờ:** 8–12 · **Cần xong trước:** FE-02, AI-01

- **Làm gì:** Thêm nút nhanh chọn nguồn và đích. Tăng dần mức gợi ý. Cập nhật nhãn “bản cũ” theo thay đổi của lab. Xử lý các lỗi: máy chủ trung gian trả lỗi không đúng khuôn, mất mạng, không rõ kết quả, chế độ xem trước và xem lại.
- **Để làm gì:** Giao diện vẫn dễ hiểu ngay cả khi có sự cố.
- **Xong khi:** Không tự thử lại gây tốn thêm tiền. Người dùng hiểu hạn mức và câu dự phòng. Nhãn “bản cũ” không biến mất sau lần hỏi lại. Không khóa terminal.
- **File chính:** khung, hook và workspace cùng test.

#### BE-07 · Đánh giá của học viên và số liệu đầu tiên

**Nhãn:** Làm bản gọn · **Giờ:** 8–12 · **Cần xong trước:** BE-01, GATE-01

- **Làm gì:** Học viên chấm 👍/👎 kèm lý do (chỉ chủ nhân xem được). Ghi sự kiện không bị trùng. Theo dõi đường đi: mở khung, gửi câu hỏi, xem câu trả lời, bài chuyển từ chưa đạt sang đạt. Số liệu ẩn danh.
- **Để làm gì:** Biết trợ lý có thật sự giúp ích không, và câu trả lời nào kém.
- **Xong khi:** Nếu ghi cơ sở dữ liệu lỗi thì không có sự kiện “thành công”. Gửi lại không đếm đôi. Số liệu không chứa nội dung câu hỏi hay kết quả CLI. Có ghi cỡ mẫu và dữ liệu còn thiếu.
- **File chính:** endpoint đánh giá, phần xuất sự kiện, truy vấn và bảng theo dõi.

#### BE-08 · Xóa hội thoại và thời hạn lưu

**Nhãn:** Làm bản gọn · **Giờ:** 10–16 · **Cần xong trước:** BE-04, FE-02

- **Làm gì:** Học viên có thể xóa hội thoại. Hủy câu hỏi đang chờ. Không để câu trả lời “sống lại” nếu AI trả lời sau khi đã xóa. Xóa bản chụp và chat. Ẩn danh dữ liệu tính tiền. Ghi nhật ký truy cập ở mức tối thiểu.
- **Để làm gì:** Tôn trọng quyền riêng tư và không giữ dữ liệu lâu hơn cần thiết.
- **Xong khi:** Xóa đúng lúc AI đang trả lời không tạo lại cuộc chat. Khôi phục từ sao lưu thì áp lại danh sách đã xóa. Xóa tài khoản không làm mất khoản chi phí chưa đối soát. Có số đo thời hạn xóa.
- **File chính:** dịch vụ xóa (có dấu “đã xóa”), việc dọn dẹp định kỳ, cài đặt trên giao diện, nội dung quyền riêng tư.

#### OPS-02 · Trần ngân sách, công tắc tắt, theo dõi

**Nhãn:** Cốt lõi · **Giờ:** 8–12 · **Cần xong trước:** BE-04, BE-07, AI-02

- **Làm gì:** Gắn mã theo dõi cho từng yêu cầu, ghi trạng thái từng lần gọi, tính chi phí theo model và theo nhóm, đặt trần theo ngày và theo tháng. Làm công tắc tắt khẩn cấp ở cả máy chủ và ngay lúc gọi AI. Có cảnh báo (đã che khóa bí mật).
- **Để làm gì:** Không để chi phí vượt tầm kiểm soát, và tắt được ngay khi có chuyện.
- **Xong khi:** Chạm trần thì không phát thêm giấy phép gọi AI. Tắt công tắc khi có yêu cầu đang chờ hoặc đang chạy thì kết quả vẫn đúng. Người vận hành tra lỗi theo mã mà không phải mở nguyên văn nội dung hỏi.
- **File chính:** cờ cấu hình, log và số liệu theo dõi, cấu hình cảnh báo.

#### QA-02 · Kiểm thử trọn luồng trên trình duyệt thật

**Nhãn:** Làm bản gọn · **Giờ:** 8–12 · **Cần xong trước:** FE-03, BE-07, BE-08, OPS-02

- **Làm gì:** Chạy tự động cả hành trình: đăng ký/đăng nhập, mở khóa học và lab, hỏi AI, tự sửa, nộp bài, xem lại, tải lại trang, đăng xuất hoặc đổi tài khoản. Thêm lab nhóm, thu hồi thành viên và mất mạng.
- **Để làm gì:** Chứng minh cả luồng hoạt động như người dùng thật.
- **Xong khi:** Chạy với backend và PostgreSQL thật, phần AI giả nối qua HTTP thật. Không thay cả backend bằng đồ giả. Dữ liệu của người A không hiện cho người B.
- **File chính:** test Playwright và dữ liệu thử.

#### OPS-04 · Thử tải nhiều người cùng lúc

**Nhãn:** Hoãn được · **Giờ:** 12–18 · **Cần xong trước:** QA-02, OPS-01, OPS-02

- **Làm gì:** Thử với 20, 50, 100 học viên, cả trường hợp chung một địa chỉ mạng (cả lớp dùng một wifi) và khác địa chỉ. Chạy 2 máy chủ cùng tiến trình nền. Học viên vừa gõ lệnh vừa hỏi AI. Đo xem lời từ chối đến từ máy chủ trung gian hay từ ứng dụng.
- **Để làm gì:** Tránh tình huống cả lớp bị chặn vì máy chủ coi họ là một người.
- **Xong khi:** Tải công bố đạt mức cam kết. Cùng một người qua hai máy chủ không bị nhân hạn mức. Máy chủ trung gian không coi cả lớp là một người. Chỉnh giới hạn của Nginx phải qua xem xét, không chỉ xóa giới hạn đi.
- **File chính:** script tải, chính sách Nginx đề xuất, báo cáo sức chứa.
- **Ghi chú của mình:** chỉ cần làm trước khi mở cho cả lớp dùng. Nhóm thử nhỏ thì chưa cần.

#### OPS-03 · Môi trường thử, sao lưu, diễn tập

**Nhãn:** Làm bản gọn · **Giờ:** 6–10 · **Cần xong trước:** OPS-01, BE-08, OPS-02, OPS-04

- **Làm gì:** Dựng cơ sở dữ liệu và khóa riêng cho môi trường thử. Sao lưu mã hóa ra ngoài máy. Khôi phục cả chat và sổ chi phí. Diễn tập “tắt AI, quay về bản trước, kiểm tra lab”. Thử với một lớp chung địa chỉ mạng.
- **Để làm gì:** Biết chắc có thể khôi phục và quay lui khi có sự cố, trước khi mời người dùng.
- **Xong khi:** Khôi phục vào cơ sở dữ liệu tách biệt mà không chạy lại các việc đã tính tiền. Không cần tắt cả lab khi nhà cung cấp AI lỗi. Nếu chung địa chỉ mạng vẫn bị chặn thì sửa chính sách trước khi mời lớp, không bỏ qua.
- **File chính:** hướng dẫn triển khai, bản kê sao lưu, cấu hình các môi trường.

#### REL-01 · Mở thử nghiệm kín

**Nhãn:** Cốt lõi · **Giờ:** 6–10 · **Cần xong trước:** AI-02, QA-02, OPS-03

- **Làm gì:** Mời 10–20 học viên. Công bố giới hạn và giờ hỗ trợ. Đặt trần ngân sách. Chọn nhóm được dùng ở phía máy chủ. Dựng bảng theo dõi nền. Không đưa danh tính học viên vào Git.
- **Để làm gì:** Thử với người thật ở quy mô nhỏ, rủi ro thấp.
- **Xong khi:** Đạt cổng G2. Người ngoài nhóm không gọi được AI. Đã diễn tập tắt khẩn cấp và quay về bản cũ. Mỗi lab thử đều có bản kê nội dung.
- **File chính:** danh sách thử nghiệm (giữ riêng, không lên Git), hướng dẫn làm quen, báo cáo cổng, form phản hồi.

#### REL-02 · Quan sát và sửa lỗi sau thử nghiệm

**Nhãn:** Cốt lõi · **Giờ:** 12–20 · **Cần xong trước:** REL-01

- **Làm gì:** Quan sát ít nhất 14 ngày. Đọc mẫu câu trả lời. Thống kê chi phí, khả năng phục hồi sau lỗi, đánh giá, tỉ lệ học viên quay lại sau 7 ngày. Cố gắng có ít nhất 100 lượt hoàn thành nếu đủ người. Biến lỗi thật (đã ẩn danh) thành bài test.
- **Để làm gì:** Biết trợ lý có giúp học viên thật sự không, và sửa những chỗ còn yếu.
- **Xong khi:** Ghi rõ số mẫu và hạn chế. Sửa các lỗi lớn về dữ liệu, hạn mức, chẩn đoán. Quyết định giữ, đổi hay mở rộng dựa trên số liệu. Nếu sửa tốn hơn phần giờ dự phòng thì tính lại lịch.
- **File chính:** báo cáo ít nhất 14 ngày và danh sách lỗi đã phân loại.

### Giai đoạn 3: Hoàn thiện và phát hành (70–108 giờ)

Mục tiêu: sửa theo những gì thấy từ thử nghiệm, kiểm tra kỹ rồi mở dần cho học viên.

#### SIM-02 · Sửa nội dung lab theo thử nghiệm

**Nhãn:** Cốt lõi · **Giờ:** 8–12 · **Cần xong trước:** REL-02

- **Làm gì:** Sửa lỗi ở 3 lab. Thêm các biến thể sơ đồ mạng và các trường hợp đúng. Chỉ thêm giao thức mới nếu không làm trượt cổng kiểm tra và có task riêng.
- **Để làm gì:** Cải thiện đúng chỗ học viên thật đang vướng.
- **Xong khi:** Lời giải mẫu và các ca sai đều đạt. Đổi lab hoặc quy tắc đều có đánh số phiên bản. Dữ liệu phản hồi thật đã ẩn danh. Nhóm lỗi đã ghi nhận được cải thiện.
- **File chính:** dữ liệu chẩn đoán, dữ liệu mẫu và bản kê lab.

#### BE-09 · Giải thích kết quả đúng với bản nộp

**Nhãn:** Làm bản gọn · **Giờ:** 8–12 · **Cần xong trước:** BE-06, BE-08, AI-01

- **Làm gì:** Lưu “bản chấm” cùng lúc với việc chấm điểm. Chuẩn bị thông tin an toàn cho phần giải thích kết quả. Giữ phương án cũ cho bài làm trước đây. Chuyển giao diện khỏi đường `/explain` đang tốn phí.
- **Để làm gì:** Lời giải thích luôn khớp với bài đã nộp, dù sau đó lab đổi.
- **Xong khi:** Bài chưa đạt nhưng còn đang làm dở được xử lý đúng. Sửa lab hoặc trạng thái sau khi nộp không làm đổi lời giải thích cũ. Bài làm cũ không bị gán số bản giả.
- **File chính:** thông tin bản chấm khi nộp, màn `LAB_REVIEW`, nút kết quả trên giao diện.

#### QA-03 · Chấm chất lượng bản phát hành đầu

**Nhãn:** Làm bản gọn · **Giờ:** 10–16 · **Cần xong trước:** AI-02, SIM-02, BE-09

- **Làm gì:** Dùng ít nhất 120 tình huống, chia theo lỗi, đúng và mơ hồ. Chạy bộ giữ riêng 3 lần. Người chấm theo thang điểm. So sánh model và lời dặn định dùng.
- **Để làm gì:** Chứng minh chất lượng đủ tốt trước khi mở rộng.
- **Xong khi:** Đạt ngưỡng của tài liệu 04 ở từng nhóm, không chỉ điểm trung bình. Không có lỗi nghiêm trọng trong các bài test bắt buộc. Ghi rõ giới hạn nếu chưa có người ngoài duyệt.
- **File chính:** ít nhất 120 tình huống, báo cáo và danh sách bộ giữ riêng.

#### QA-04 · Cố ý làm hỏng để thử độ bền

**Nhãn:** Hoãn được · **Giờ:** 12–18 · **Cần xong trước:** QA-01, BE-08, BE-09, OPS-02

- **Làm gì:** Cố ý làm hỏng hệ thống ở từng bước: cắt ngang giữa chừng, biên nhận bị trùng, mất hoặc đến muộn, đồng hồ lệch, đúng nửa đêm khi hạn mức làm mới, cơ sở dữ liệu bị kẹt, xóa hoặc thu hồi quyền giữa chừng.
- **Để làm gì:** Biết hệ thống chịu được sự cố thật.
- **Xong khi:** Ít nhất 30 kịch bản. Không gọi AI trùng do tự thử lại. Không tính tiền hai lần. Không để câu trả lời “sống lại”. Hệ thống hoặc tự phục hồi hoặc báo rõ “chưa biết kết quả”, và có hướng dẫn xử lý.
- **File chính:** công cụ điều khiển AI giả, test tích hợp và test chịu lỗi.
- **Ghi chú của mình:** làm khi đã có người dùng thật và dữ liệu thật. Lúc đầu đủ làm vài kịch bản quan trọng nhất (tính tiền trùng, xóa giữa chừng).

#### OPS-05 · Đóng gói bản chạy thật, cảnh báo, phát hành tự động

**Nhãn:** Hoãn được · **Giờ:** 8–12 · **Cần xong trước:** OPS-04, OPS-02

- **Làm gì:** Build bản không đổi. Chạy cập nhật cơ sở dữ liệu một lần. Mở dần bằng công tắc. Xả hết việc đang chạy trước khi tắt. Tương thích giữa bản hiện tại và bản trước. Kiểm tra “sẵn sàng” từng phần. Có đường gửi cảnh báo.
- **Để làm gì:** Phát hành an toàn, có đường lui.
- **Xong khi:** Môi trường thử và môi trường thật tách biệt cơ sở dữ liệu, khóa và ngân sách. Không chỉ đưa giao diện lên Vercel rồi coi như xong. Quay về bản trước bằng phiên bản đã đóng gói cùng công tắc, không quay lui cơ sở dữ liệu theo cách làm mất dữ liệu.
- **File chính:** file workflow, nơi lưu ảnh container, cấu hình môi trường, hướng dẫn xử lý.
- **Ghi chú của mình:** khi chỉ có nhóm nhỏ, có thể dùng cách triển khai thủ công nhưng có ghi lại từng bước.

#### OPS-06 · Khôi phục, thời hạn lưu, đối soát chi phí

**Nhãn:** Hoãn được · **Giờ:** 8–12 · **Cần xong trước:** OPS-03, BE-08, QA-04

- **Làm gì:** Diễn tập mất cả máy chủ. Áp lại danh sách đã xóa. Chặn gọi AI sau khi khôi phục. Đối chiếu khoản nhà cung cấp AI đã tính tiền nhưng bản sao lưu không có. Đo xem tối đa mất bao nhiêu dữ liệu và mất bao lâu để chạy lại.
- **Để làm gì:** Khôi phục được sau sự cố lớn mà không tính tiền sai.
- **Xong khi:** Có bằng chứng khôi phục và so khớp dữ liệu mẫu. Khoản chưa rõ không bị tính là 0. Không chạy lại việc cũ mà nhà cung cấp đã tính tiền. Đạt mục tiêu đã công bố.
- **File chính:** danh sách việc khi khôi phục, công cụ đối soát và xuất dữ liệu, việc dọn dữ liệu định kỳ.
- **Ghi chú của mình:** cần khi có nhiều người dùng và dữ liệu quan trọng. Giai đoạn đầu, sao lưu đều đặn và thử khôi phục một lần là đủ.

#### FE-04 · Dễ dùng, vừa mọi màn hình, nhanh

**Nhãn:** Làm bản gọn · **Giờ:** 6–10 · **Cần xong trước:** FE-03, BE-09

- **Làm gì:** Dùng được bằng bàn phím và trình đọc màn hình. Phóng to 200% vẫn dùng được. Xoay điện thoại không vỡ. Đổi cỡ terminal vẫn ổn. Tải phần giao diện khi cần. Đo kích thước bản build.
- **Để làm gì:** Mọi học viên đều dùng được, kể cả trên điện thoại hay có khó khăn khi thao tác.
- **Xong khi:** Đạt chuẩn trên các màn hình đã định. Không có khóa AI trong bản build. Mở và đóng khung không làm mất trạng thái terminal. Không hỏi lại định kỳ khi tab bị ẩn.
- **File chính:** style, component và test giao diện.

#### DOC-01 · Tài liệu hỗ trợ và vận hành cho một người

**Nhãn:** Làm bản gọn · **Giờ:** 4–6 · **Cần xong trước:** REL-02, OPS-05, OPS-06

- **Làm gì:** Viết câu hỏi thường gặp (hạn mức, “bản cũ”, quyền riêng tư), giờ hỗ trợ, mức độ sự cố, cách tra mã yêu cầu, lịch bảo trì và checklist hàng tuần.
- **Để làm gì:** Một người cũng vận hành và hỗ trợ được, không phải nhớ hết trong đầu.
- **Xong khi:** Tự diễn tập 3 yêu cầu hỗ trợ mà không cần đọc lại toàn bộ code. Tài liệu cho học viên không lộ hạ tầng hay bí mật. Có người nhận cảnh báo thật.
- **File chính:** hướng dẫn cho học viên, quy trình xử lý yêu cầu hỗ trợ, ghi chú bàn giao vận hành.

#### REL-03 · Cổng phát hành, mở dần

**Nhãn:** Làm bản gọn · **Giờ:** 6–10 · **Cần xong trước:** QA-03, QA-04, OPS-05, OPS-06, FE-04, DOC-01

- **Làm gì:** Chọn một phiên bản không đổi. Mở dần 5%, 25%, 50%, 100% nhóm đủ điều kiện (nếu ít người thì dùng số người cụ thể, tránh phần trăm gây hiểu nhầm). Theo dõi chất lượng, chi phí, tốc độ và có hỗ trợ.
- **Để làm gì:** Mở rộng có kiểm soát, lỗi nghiêm trọng thì quay lại ngay.
- **Xong khi:** Tất cả “cổng cứng” đạt. Chất lượng, chi phí và tốc độ không vượt ngưỡng dừng. Nhóm mới có hỗ trợ. Lỗi nghiêm trọng thì quay về ngay. Chỉ mở 100% với các lab và sức chứa đã được kiểm.
- **File chính:** gói bằng chứng phát hành và quyết định mở rộng.

### Giai đoạn 4: Trợ lý tự chọn công cụ xem (58–92 giờ)

Mục tiêu: để AI tự chọn các công cụ chỉ để **xem** (không sửa gì) khi cần chẩn đoán. Chỉ làm sau khi bản đầu chạy ổn và chứng minh được cách này tốt hơn luồng cố định.

#### R2-01 · Quyết định có đáng làm giai đoạn 4 không

**Nhãn:** Hoãn được · **Giờ:** 4–6 · **Cần xong trước:** REL-03

- **Làm gì:** Liệt kê các trường hợp bản đầu chưa giải quyết tốt, đo chi phí và chất lượng hiện tại, chọn khung làm việc cho AI tự chọn công cụ.
- **Để làm gì:** Chỉ thêm độ phức tạp khi có lợi ích rõ ràng.
- **Xong khi:** Có tiêu chí lợi ích đủ rõ để thêm phần này. Nếu không đủ thì hoãn giai đoạn 4 và ưu tiên cải thiện nội dung bản đầu.

#### R2-02 · Bộ công cụ chỉ đọc cho AI

**Nhãn:** Hoãn được · **Giờ:** 10–16 · **Cần xong trước:** R2-01

- **Làm gì:** Tạo các công cụ “xem” chạy trên bản chụp trạng thái: sơ đồ mạng, cổng, đường đi, VLAN, thử ping, tiến độ công khai. Chạy trên bản sao. Ghi phiên bản của bằng chứng. Nếu chưa hỗ trợ thì trả trạng thái rõ.
- **Để làm gì:** AI có thể tự kiểm tra thay vì chỉ đọc một bản tóm tắt.
- **Xong khi:** Mỗi công cụ chỉ trả đúng phạm vi cho phép và không làm thay đổi bài thật.
- **File chính:** `ai/tools/`, dữ liệu mẫu cho công cụ, bảng lưu lần dùng công cụ.

#### R2-03 · Quyền cho từng công cụ

**Nhãn:** Hoãn được · **Giờ:** 8–12 · **Cần xong trước:** R2-02

- **Làm gì:** Mỗi lần dùng công cụ có một “vé” riêng và vé hết hạn. Chặn công cụ ngoài danh sách, công cụ dùng cho bài khác, người đã bị thu hồi quyền hoặc đã xóa. Không cho chạy lệnh tùy ý hay mở địa chỉ tùy ý.
- **Để làm gì:** AI chỉ làm được đúng những gì được phép.
- **Xong khi:** Vé hết hạn, công cụ ngoài danh sách, khác lần làm bài, thu hồi quyền, xóa tài khoản đều bị chặn.
- **File chính:** phần kiểm tra quyền nội bộ và test bảo mật.

#### R2-04 · AI tự chọn công cụ, có giới hạn

**Nhãn:** Hoãn được · **Giờ:** 12–20 · **Cần xong trước:** R2-03

- **Làm gì:** Xây phần điều phối bằng Python. Thử nhanh một khung làm việc rồi mới chọn. Giới hạn: tối đa 3 lần gọi AI, 5 lần dùng công cụ, 45 giây. Lưu điểm dừng. Khi tiếp tục thì không gọi lại bước đã tốn tiền mà chưa rõ kết quả.
- **Để làm gì:** Cho AI tự tìm lỗi nhưng không để chạy vô hạn hay tốn tiền vô ích.
- **Xong khi:** Vòng lặp dừng đúng giới hạn. Điểm dừng không đọc trực tiếp cơ sở dữ liệu nghiệp vụ.
- **File chính:** phần điều phối trong Python, bộ nối với công cụ của Node, quy tắc lưu điểm dừng.

#### R2-05 · Tính chi phí từng bước, hiện tiến trình

**Nhãn:** Hoãn được · **Giờ:** 8–12 · **Cần xong trước:** R2-04

- **Làm gì:** Giữ chỗ tổng ngân sách trước khi bắt đầu. Mỗi bước có một giấy phép riêng. Biên nhận và thử lại không bị tính tiền trùng trong sổ nội bộ. Giao diện chỉ hiện tóm tắt việc đã làm và bằng chứng, không hiện “suy nghĩ bên trong” của AI.
- **Để làm gì:** Kiểm soát chi phí khi AI làm nhiều bước.
- **Xong khi:** Tổng ngân sách được giữ trước. Mỗi bước có giấy phép. Không tính tiền trùng. Giao diện hiển thị đúng.
- **File chính:** mở rộng sổ chi phí, log công cụ, phần hiển thị tiến trình.

#### R2-06 · Chấm chất lượng và thử tấn công

**Nhãn:** Hoãn được · **Giờ:** 10–16 · **Cần xong trước:** R2-05

- **Làm gì:** Tạo bộ thử riêng cho trợ lý tự chọn công cụ (chuỗi công cụ đã dùng) và bộ thử tấn công. So sánh chất lượng và chi phí với bản đầu trên cùng dữ liệu.
- **Để làm gì:** Chứng minh cách mới thật sự tốt hơn, không chỉ phức tạp hơn.
- **Xong khi:** Chọn đúng công cụ, không thay đổi trạng thái bài, xử lý được công cụ lỗi, vòng lặp, hết ngân sách. Không tăng quyền cho AI chỉ để tỉ lệ giải được trông đẹp hơn.
- **File chính:** chuỗi công cụ mẫu, dữ liệu tấn công, báo cáo so sánh.

#### R2-07 · Thử nhóm nhỏ, quyết định mở rộng

**Nhãn:** Hoãn được · **Giờ:** 6–10 · **Cần xong trước:** R2-06

- **Làm gì:** Mở cho một nhóm nhỏ, viết báo cáo, viết hướng dẫn vận hành, quyết định mở rộng hay không.
- **Để làm gì:** Chốt việc đưa vào dùng chính thức dựa trên số liệu thật.
- **Xong khi:** Có cải thiện đáng giá trên nhóm trường hợp mục tiêu. Không vượt trần chi phí và độ chậm. Có cách quay về bản đầu theo từng loại câu hỏi. Thời gian quan sát tính riêng nếu cần.

## 7. Cách làm mỗi task

**Quy trình trong `Agent.md` của repo:**

1. Viết kế hoạch vào `todo.md`: mục tiêu đo được và danh sách file dự kiến sửa. (Repo hiện chưa có `todo.md` và `lessons.md`, hãy tạo mới.)
2. Đọc lại kế hoạch trước khi code.
3. Làm từng mục, xong mục nào đánh `[x]` mục đó. Mỗi thay đổi ghi rõ: đổi gì, vì sao.
4. Xong thì kiểm tra lỗi và ghi kết quả vào `todo.md`. Ghi bài học vào `lessons.md`.
5. Ba nguyên tắc: tối giản (chỉ sửa cái cần), triệt để (tìm nguyên nhân gốc, không vá tạm), vô hình (ít ảnh hưởng chức năng đang chạy).

**Một task “sẵn sàng làm” khi:** đã đọc `Agent.md`; biết rõ kết quả cần đạt hoặc lỗi cần sửa; có tiêu chí “xong khi”; các task cần xong trước đã xong; dữ liệu test không phải dữ liệu thật; biết file sẽ sửa và cách kiểm tra; biết việc này có tốn tiền hay ảnh hưởng hạ tầng không.

**Một task “xong” khi:** code đúng phạm vi; test các hành vi quan trọng đã đạt; không lộ khóa bí mật hay đáp án; có log phù hợp; có mô tả cách quay về bản trước; cập nhật cơ sở dữ liệu tương thích nếu có; tài liệu và dữ liệu mẫu đã cập nhật; đã tự xem lại phần thay đổi; `todo.md` ghi bằng chứng. Task xong về kỹ thuật chưa có nghĩa là được mở cho mọi người dùng.

**Task nào quá 16 giờ:** chia thành nhiều phần nhỏ (quy ước, cập nhật cơ sở dữ liệu, code, test), không đợi cả giai đoạn mới ghép.

**Khi dùng AI hỗ trợ viết code:**

- Giao từng task nhỏ, cho AI đọc code hiện tại trước khi sửa.
- Tự chạy test và tự xem phần thay đổi. “Test đạt” không đáng tin nếu chỉ dùng đồ giả do chính đoạn code đó tạo ra.
- Không đưa khóa thật hay dữ liệu học viên vào lời nhờ AI.
- Dành một lượt xem lại với câu hỏi “nếu người dùng cố làm hỏng thì sao”: gửi trùng, đổi tài khoản, thu hồi quyền giữa chừng, xóa trước khi AI trả lời, nhà cung cấp đã tính tiền nhưng mất phản hồi.

**Mẫu ghi một task (để dán vào issue hoặc `todo.md`):**

```text
Mã / Tên:
Kết quả cho học viên hoặc người vận hành:
Làm gì / Không thuộc task này:
Cần xong trước:
Tiêu chí “xong khi”:
File dự kiến sửa:
Các bước:
Test: trường hợp thành công, lỗi, nhiều người cùng lúc:
Cách quay về bản trước / công tắc tắt:
Giờ ước tính / giờ thực tế:
Bằng chứng đã xong:
Quyết định phát sinh:
```

## 8. Gợi ý của mình nếu làm một mình, thời gian có hạn

Phần này là **ý kiến của mình**, dựa trên việc đọc repo ở các lượt trước. Nó không nằm trong kế hoạch gốc.

**Ý chính:** làm 13 task [Cốt lõi], làm 20 task [Làm bản gọn] ở mức đơn giản, và để 14 task [Hoãn được] cho sau. Bản gọn khác kế hoạch gốc ở 4 điểm:

1. **Gọi AI thẳng từ Node** bằng một hàm nhỏ, bỏ PY-01 và PY-02.
2. **Trả lời ngay trong một lần gọi** (chờ tối đa khoảng 12 giây, có câu dự phòng), chưa cần hàng chờ và tiến trình chạy nền (hoãn BE-04).
3. **Hạn mức đơn giản:** một bảng đếm lượt hỏi theo người theo ngày, cộng một trần chi phí cho cả hệ thống (BE-03 bản gọn và OPS-02).
4. **Thử nhỏ:** bắt đầu với 1–2 lab và khoảng 10 học viên.

**Thứ tự gợi ý:**

1. Phần nhỏ của BE-06: lọc dữ liệu gửi AI và lưu kết quả giải thích theo lần nộp (làm ngay, không phụ thuộc gì).
2. OPS-00: đặt trần chi phí trước khi gọi AI nhiều.
3. DISC-03 (1 lab trước) và SIM-01.
4. BE-02 và BE-05.
5. FE-01 và FE-02 (bản đơn giản).
6. AI-01 và AI-02 (20–30 tình huống thử).
7. OPS-02, rồi REL-01 và REL-02 (thử với khoảng 10 học viên).
8. Chỉ khi thấy thật sự cần: BE-04, OPS-04, QA-04, OPS-05, OPS-06, rồi giai đoạn 4.

Mình chưa ước giờ cho bản gọn. Nếu bạn muốn, mình ước giúp sau khi bạn chọn 1–2 lab đầu tiên.
