# PROMPT: Thiết kế lại UI cho hệ thống luyện tập lệnh Cisco CLI

## Vai trò

Bạn là senior UI/UX designer kiêm senior  front-end engineer có kinh nghiệm xây dựng công cụ học tập kỹ thuật (edtech) cho người mới bắt đầu. Nhiệm vụ: thiết kế lại 2 màn hình chính của hệ thống luyện tập Cisco CLI — **màn hình thực hành lab dành cho học viên** và **màn hình tạo/chỉnh sửa lab dành cho admin** — theo hướng dễ tiếp cận hơn cho người mới ôn CCNA, đồng thời an toàn hơn cho người tạo nội dung.

## Bối cảnh hiện trạng

Hệ thống hiện tại có 2 màn hình đang gây khó khăn:

**Màn hình thực hành (học viên)**: gồm sơ đồ topology nhỏ, dropdown chọn thiết bị tách rời khỏi sơ đồ, các nút điều khiển (tiến tick, ngắt dây, gửi gói tin) nằm ngang hàng không phân cấp ưu tiên, danh sách nhiệm vụ dùng radio button gây hiểu nhầm là chọn 1, và không có gợi ý ngữ cảnh nối giữa nhiệm vụ với bước cần làm tiếp theo.

**Màn hình tạo/sửa lab (admin)**: phần cấu hình chấm điểm (Grading Spec) và trạng thái ban đầu (Initial State) được expose trực tiếp dưới dạng JSON thô trong textarea, không có validation cú pháp, không gợi ý trường dữ liệu, dễ gây lỗi khi admin không quen JSON. Trường "Command Profile" là input text tự do, dễ gõ sai tên profile không tồn tại.

## Phần A — Màn hình thực hành lab (học viên)

### A1. Đồng bộ sơ đồ topology với ngữ cảnh đang thao tác

- Loại bỏ dropdown chọn thiết bị tách rời (`R1 · R1`). Thay vào đó, bấm trực tiếp vào thiết bị trên sơ đồ topology để chọn thiết bị đang cấu hình.
- Thiết bị đang được chọn phải có trạng thái highlight rõ ràng trên sơ đồ (đổi màu nền/viền), đồng bộ với terminal đang hiển thị bên dưới (prompt `R1>` phải khớp với thiết bị đang highlight).
- Phóng to khu vực sơ đồ topology so với bản gốc — hiện tại quá nhỏ so với tổng diện tích màn hình.

### A2. Biến thao tác trên dây cáp thành tương tác trực tiếp trên sơ đồ

- Loại bỏ danh sách nút "L1: ngắt dây", "L2: ngắt dây"... nằm rời rạc ngoài sơ đồ.
- Thay bằng: bấm trực tiếp vào đường dây nối 2 thiết bị trên sơ đồ để ngắt/nối. Trạng thái ngắt hiển thị bằng đường nét đứt + màu đỏ (dùng token `--text-danger`/`--border-danger`); trạng thái nối bình thường dùng màu viền mặc định.

### A3. Gom công cụ nâng cao vào khối thu gọn (accordion)

- Các chức năng "Tiến 1 tick", "Gửi gói tin" (ping thủ công tới IP tùy ý) không cần hiển thị mặc định cho người mới.
- Gom vào một khối "Công cụ nâng cao" dạng accordion, mặc định đóng, có icon rõ ràng (VD: `ti-adjustments`), mở ra khi người dùng chủ động bấm.

### A4. Thêm thanh gợi ý ngữ cảnh (contextual hint bar)

- Thêm một thanh nổi bật (dùng nền `--bg-accent`, chữ `--text-accent`) đặt ngay phía trên terminal, luôn hiển thị:
  - Thiết bị đang cấu hình (đồng bộ với lựa chọn ở sơ đồ).
  - Bước tiếp theo cần làm, suy ra từ nhiệm vụ đang "in progress" gần nhất và trạng thái cấu hình hiện tại (VD: "Bước tiếp theo: gán địa chỉ IP cho cổng Gi0/0").
  - Nút "Xem gợi ý" mở rộng hiển thị hint chi tiết hơn (map với trường `hint` trong Grading Spec JSON hiện có).

### A5. Chuyển danh sách nhiệm vụ từ radio button sang checklist có trạng thái

- Mỗi nhiệm vụ hiển thị 1 trong 3 trạng thái trực quan riêng biệt: chưa bắt đầu (icon vòng tròn rỗng, mờ), đang thực hiện (icon vòng tròn nét đứt, nổi bật, có nền `--bg-accent`), đã hoàn thành (icon check, có thể thêm hiệu ứng ăn mừng nhẹ).
- Không dùng radio button vì gây hiểu nhầm là chọn 1 trong nhiều, trong khi thực tế học viên cần hoàn thành tất cả nhiệm vụ.
- Hiển thị thanh tiến độ tổng (`x/y nhiệm vụ`) ở đầu trang, cạnh breadcrumb tên bài lab.

### A6. Tách các tính năng phụ ra khỏi luồng chính

- "Cùng thực hành" (mời bạn học, chia sẻ mã phiên) và "Thành tích của bạn" (điểm, streak) không đặt ngang hàng ưu tiên với danh sách nhiệm vụ.
- Chuyển thành nút phụ có icon (VD: `ti-users` cho mời bạn học), mở modal/popover khi cần, không chiếm không gian mặc định trong luồng làm bài.
- Khối "OSPF/STP State" giữ dạng thu gọn (accordion) như hiện tại, đặt cuối cùng trong sidebar vì đây là thông tin tham khảo, không phải hành động chính.

### A7. Animation phản hồi bằng GSAP (đồng bộ với phần đã thiết kế trước đó)

- Khi chạy `ping`/`traceroute`, dùng GSAP (`MotionPathPlugin`) để animate một điểm di chuyển từ thiết bị nguồn qua từng hop trên chính sơ đồ topology này, thay vì chỉ hiện kết quả dạng text trong terminal.
- Khi gõ lệnh sai, dùng hiệu ứng rung nhẹ (shake) khung terminal để tăng cảm giác phản hồi tức thì.
- Khi hoàn thành một nhiệm vụ, dùng hiệu ứng pulse/highlight ngắn trên card nhiệm vụ tương ứng trong danh sách.

### A8. Onboarding cho người dùng lần đầu

- Thêm chuỗi tooltip hướng dẫn (3-4 bước) khi học viên vào lab lần đầu tiên: giới thiệu sơ đồ topology, terminal, danh sách nhiệm vụ, và nút "Công cụ nâng cao".
- Thêm tooltip giải thích thuật ngữ khi hover vào các khái niệm mô phỏng đặc thù (VD: hover "ngắt dây" hiện chú thích ngắn "Mô phỏng lỗi đường truyền để luyện chẩn đoán sự cố").

## Phần B — Màn hình tạo/chỉnh sửa lab (admin)

### B1. Command Profile: chuyển từ input tự do sang dropdown

- Thay ô nhập text tự do bằng dropdown liệt kê các profile có sẵn (VD: `ccna-basic-v1`, `ccna-network-v2`, `ccnp-advanced-v1`), mỗi lựa chọn kèm mô tả ngắn về bộ lệnh CLI mà profile đó cho phép.
- Loại bỏ hoàn toàn khả năng gõ sai tên profile không tồn tại.

### B2. Grading Spec: chuyển từ JSON thô sang form builder theo card

- Mỗi tiêu chí chấm điểm (check) trong Grading Spec hiển thị dưới dạng một card riêng biệt, gồm:
  - Badge chọn loại kiểm tra (dropdown, VD: "Có thể ping tới" = `reachable`, "Cấu hình khớp" = `config_match`...), không gõ tay chuỗi type.
  - Input tiêu đề (`title`) và điểm số (`points`).
  - Select chọn thiết bị nguồn (`deviceId`) từ danh sách thiết bị đã có trong topology (không gõ tay ID thiết bị).
  - Input đích cần kiểm tra (`destination`).
  - Input gợi ý (`hint`) hiển thị cho học viên khi bấm "Xem gợi ý".
  - Nút xóa tiêu chí (icon `ti-trash`).
- Nút "Thêm tiêu chí chấm điểm" để thêm card mới, mặc định điền giá trị hợp lệ tối thiểu.
- Hiển thị tổng điểm tự động tính từ tất cả các card, đặt ở footer khu vực Grading Spec.

### B3. Initial State: áp dụng cùng nguyên tắc form hóa

- Phần khai báo liên kết (links) giữa các thiết bị giữ nguyên cách hiển thị dạng dòng + nút "Xóa dây" như hiện tại (đã đủ trực quan).
- Bổ sung thêm form cấu hình trạng thái ban đầu của từng thiết bị (VD: PC1 có sẵn địa chỉ IP gì trước khi học viên bắt đầu, interface nào mặc định `enabled: true/false`) theo cùng kiểu form-per-device, thay vì gộp chung vào JSON.

### B4. Chế độ "Chỉnh sửa JSON nâng cao" — tùy chọn, không phải mặc định

- Thêm một switch/checkbox "Chỉnh sửa JSON nâng cao" ở góc khu vực Grading Spec (và Initial State nếu cần).
- Khi bật: hiển thị lại textarea JSON thô cho admin quen thao tác nhanh (VD: copy-paste giữa các lab).
- Textarea JSON này bắt buộc có **validate cú pháp thời gian thực**: báo lỗi cụ thể (dòng nào, thiếu gì) ngay dưới textarea bằng màu `--text-danger`, thay vì im lặng chấp nhận input sai rồi lỗi lúc học viên vào lab.
- Khi tắt switch, quay lại form builder; dữ liệu giữa 2 chế độ phải đồng bộ 2 chiều (sửa ở form thì JSON cập nhật theo và ngược lại).

### B5. Xem trước trải nghiệm học viên

- Thêm nút "Xem trước như học viên" ở footer màn hình chỉnh sửa lab, mở ra bản xem trước (modal hoặc tab mới) hiển thị đúng layout màn hình thực hành (Phần A) với dữ liệu lab hiện tại — giúp admin phát hiện lỗi hiển thị hoặc thiếu sót trước khi lưu/publish.

### B6. Validate và schema an toàn ở backend

- Dù đã ẩn JSON thô khỏi luồng mặc định, vẫn cần validate chặt chẽ ở backend khi submit (dùng schema, ví dụ Pydantic hoặc JSON Schema) để đảm bảo dữ liệu từ form builder luôn hợp lệ trước khi lưu, phòng trường hợp lỗi phát sinh từ chính UI builder.

### B7. (Đề xuất mở rộng) Template lab có sẵn

- Cho phép admin tạo lab mới từ template có sẵn (VD: "2 router kết nối trực tiếp", "1 switch + 3 PC", "hình sao 4 router") hoặc sao chép từ lab đã có, giảm thao tác dựng topology từ đầu mỗi lần và giảm lỗi cấu hình lặp lại.

## Nguyên tắc thiết kế chung áp dụng cho cả 2 phần

1. **Phân cấp ưu tiên rõ ràng**: chức năng cơ bản luôn hiển thị mặc định; chức năng nâng cao/ít dùng thu gọn vào accordion hoặc modal.
2. **Đồng bộ trạng thái giữa các thành phần UI**: sơ đồ, terminal, danh sách nhiệm vụ phải luôn phản ánh cùng một trạng thái thực tế, không để người dùng tự đối chiếu thủ công.
3. **Không để người dùng (học viên lẫn admin) thao tác trực tiếp với dữ liệu thô (JSON) làm mặc định** — chỉ cung cấp như tùy chọn nâng cao có validation.
4. **Feedback tức thì và cụ thể**: mọi hành động sai (gõ lệnh sai, JSON lỗi cú pháp, thiếu trường bắt buộc) phải có thông báo rõ nguyên nhân và vị trí lỗi, không im lặng hoặc báo chung chung.
5. **Component tái sử dụng nhất quán**: dùng chung bộ token màu/spacing (`--surface-*`, `--text-*`, `--border-*`, `--bg-accent` v.v.) giữa màn hình học viên và màn hình admin để đảm bảo tính nhất quán thị giác toàn hệ thống.

## Yêu cầu đầu ra

Khi thực hiện nhiệm vụ này, hãy:
1. Ưu tiên triển khai Phần A trước (ảnh hưởng trực tiếp đến trải nghiệm học viên — nhóm người dùng đông nhất).
2. Với mỗi mục thay đổi, cung cấp: cấu trúc component/props liên quan, luồng state cần đồng bộ (đặc biệt A1, A4, A5), và code mẫu (React + TypeScript cho UI, kèm GSAP cho phần animation ở A7).
3. Với Phần B, thiết kế schema dữ liệu cho form builder (Grading Spec, Initial State) sao cho ánh xạ 2 chiều chính xác với cấu trúc JSON gốc đã có trong hệ thống hiện tại.
4. Giữ nguyên các thuật ngữ tiếng Việt đã dùng trong hệ thống hiện có (VD: "Xóa dây", "Nối cổng", "Nhiệm vụ") để không gây gián đoạn trải nghiệm cho người dùng đã quen giao diện cũ.
5. Đảm bảo mọi thay đổi UI đều hoạt động tốt ở cả chế độ sáng và tối (light/dark mode).
