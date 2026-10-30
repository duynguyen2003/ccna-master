# UX-01 — Thiết kế trợ lý lab

Ngày:28/10/2026; cập nhật29/10/2026. Phạm vi:R1, phục vụ FE-01/FE-02; dùng contract v1 và token lab hiện có.

Cập nhật hiện hành: tên UI thống nhất **Trợ lý AI**, panel mặc định440px,
resize320–680px có giới hạn theo viewport, grid chừa đúng chiều rộng panel để
không che CLI. Kéo mép trái, phím mũi tên/Home/End hoặc các nút trong Tùy chọn
hội thoại đều dùng được; mobile giữ Dialog. Nội dung15px/line-height1.7,
input mobile16px; tùy chọn thiết bị/mức gợi ý thu gọn. Câu hỏi hiện ngay khi gửi,
đổi sang bản server theo requestId; log có aria-live và nút có aria-busy.

Phạm vi workspace cập nhật29/10: đã bỏ UI “Cùng thực hành” và “Ưu tiên CLI” để
ổn định luồng cá nhân. Thanh phiên giữ Thành tích/Trợ lý AI; không dựng lại các
điểm vào cộng tác trong wireframe cũ bên dưới. Topology/terminal dùng bố cục mặc định.

Thiếu dữ liệu có hành động Bổ sung thông tin; lựa chọn từ bằng chứng làm nổi bật
thiết bị trên topology, có Sao chép/Gợi ý chi tiết hơn/Kiểm tra lại. Đặt lại hội
thoại có xác nhận, purges nội dung và đổi epoch nhưng giữ accounting. Chỉ Gemini
được dùng ở runtime; nguồn hệ thống chỉ còn cho lịch sử cũ, không có fallback mới.
Mục A và tab quản trị đã bổ sung trong
[checklist UI hiện hành](../ui-ai-lab-assistant.md). Phần dưới lưu thiết kế ban đầu
28/10; các quyết định mới ở đoạn cập nhật này được ưu tiên.

## Bố cục và điểm vào

Desktop: nút **Trợ lý lab** trên thanh phiên và **Hỏi trợ lý** dưới gợi ý tĩnh.
Ngăn bên phải rộng370px (320px ở màn hình hẹp), phủ đúng vùng nhiệm vụ, không thêm cột grid hoặc
đổi kích thước xterm/topology. Có nút Đóng; Escape đóng ngăn và trả focus về
điểm mở. Terminal vẫn dùng được khi đang phân tích. Nội dung cuộn trong ngăn,
composer ở cuối. Mở ngăn chỉ tải code trợ lý khi cần.

```text
┌──────────── Phòng thực hành ──────────────┐
│ Phiên…  Cùng thực hành  [Trợ lý lab]       │
├──────────────────────┬───────────────────┤
│ Topology             │ Trợ lý lab    [×] │
│                      │ Riêng tư · quota  │
│                      │ [Câu hỏi trước]   │
│ Terminal giữ nguyên  │ Trả lời           │
│ kích thước và quyền  │ Bằng chứng/lệnh   │
│ gõ lệnh              │ [Sao chép] [Đánh giá]
│                      │ Ý định + câu hỏi  │
│                      │ [Gửi] / [Hủy]     │
└──────────────────────┴───────────────────┘
```

Mobile: ngăn dạng Dialog chung, đầy chiều ngang, có tiêu đề và nút đóng, Tab
giới hạn trong dialog và trả focus khi đóng. Hình thức này kế thừa điều kiện
hỗ trợ mobile của màn lab: thêm **Mở trợ lý lab** trên thông báo dùng máy tính;
không mở terminal CLI trên điện thoại. Kiểm riêng ngăn ở320/375px.
Chữ nội dung13px, tiêu đề16px, cặp màu/token lab sáng và tối, nút tối thiểu40px
(nút gửi/đóng44px). Dùng SVG có nhãn chữ, không dùng emoji hoặc nhãn kỹ thuật thừa.

## Thứ tự nội dung

1. Tiêu đề/đóng, dòng “Hội thoại riêng của bạn” và lượt còn lại từ server.
2. “Câu hỏi trước” tải trang cursor; lịch sử theo thứ tự thời gian.
3. Tin người học, thẻ trả lời có nguồn, nhãn độ chắc chắn và revision khi cũ.
4. Bằng chứng có thiết bị/quan sát; chọn thiết bị chỉ đổi lựa chọn UI.
5. Tối đa hai bước, lệnh đọc đã được Node cấp và nút Sao chép; không có Chạy.
6. Cách kiểm tra lại, mức gợi ý, đánh giá hữu ích/chưa hữu ích kèm lý do.
7. Composer gồm ba ý định, thiết bị/đích khi phân tích kết nối, câu hỏi khi
   giải thích khái niệm. Mức1/2/3 là đề nghị; server quyết định mức thực tế.

Lần đầu có mục mở rộng **Dữ liệu dùng để trợ giúp**: “Câu hỏi, nhiệm vụ công
khai, thiết bị và trạng thái cấu hình đã lọc có thể được gửi tới dịch vụ AI.
Hội thoại riêng từng học viên, kể cả lab nhóm. AI không chấm điểm và không tự
chạy lệnh; hãy kiểm tra lại trong terminal.” Không yêu cầu đồng ý giả nếu policy
hiện tại chưa yêu cầu consent. Không đưa model/provider, rubric ẩn hoặc secrets
vào request browser. Thông báo có thể đọc lại bất cứ lúc nào.

## Câu chữ theo trạng thái

| Trạng thái                      | Câu chữ và hành động                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| Chưa hỏi                        | “Bạn cần trợ giúp ở bước nào?” + ba ý định                                              |
| Đang mở                         | “Đang tải trợ lý…”; trạng thái riêng với terminal                                       |
| Gửi                             | “Đang gửi câu hỏi…”; khóa gửi lặp, giữ ID trước POST                                    |
| QUEUED                          | “Đã nhận câu hỏi. Đang chờ phân tích…” + Hủy yêu cầu                                    |
| RUNNING                         | “Đang phân tích. Bạn vẫn có thể dùng terminal.” + Hủy                                   |
| Mất phản hồi POST               | “Chưa xác nhận được câu hỏi. Đang tìm yêu cầu đã gửi.”; tra ID cũ                       |
| Offline                         | “Mất kết nối. Câu hỏi đang soạn được giữ trong tab này.”; không gửi/poll                |
| Bản cũ                          | “Dựa trên cấu hình trước đó · revision X → Y”; Kiểm tra lại chỉ tạo câu hỏi mới khi bấm |
| Fallback                        | “Gợi ý từ hệ thống”, không gắn nhãn AI cho deterministic                                |
| LLM                             | “Trợ lý AI”; “AI có thể sai; đối chiếu với terminal và kết quả chấm.”                   |
| Hết lượt                        | “Bạn đã dùng hết lượt trợ giúp.” + giờ reset từ quota, không tự gửi lại                 |
| 503                             | “Trợ lý hiện chưa sẵn sàng. Bạn vẫn có thể thực hành.” + thử tải lại                    |
| 403                             | “Trợ lý chưa được bật cho tài khoản hoặc bài lab này.”; không có nút gửi                |
| 401/thu hồi quyền               | Xóa nội dung đang hiện, yêu cầu đăng nhập/mở lại phiên                                  |
| Context đổi trước nhận          | “Cấu hình đã thay đổi. Kiểm tra lựa chọn rồi gửi lại.”; không tự tạo ID mới             |
| Recovery/conversation epoch đổi | “Phiên trợ lý đã thay đổi. Xác nhận bắt đầu câu hỏi mới.”; không tự gọi AI              |
| FAILED/EXPIRED                  | “Không thể hoàn tất câu hỏi này.”; giữ trạng thái, người dùng chủ động hỏi mới          |
| OUTCOME_UNKNOWN                 | “Chưa xác định được kết quả.”; có thể có lời dự phòng, không tự retry model             |
| CANCELLED                       | “Đã hủy yêu cầu.”; terminal độc lập                                                     |

Nhãn kết luận: Có căn cứ / Giả thuyết / Chưa thấy lỗi trong phép kiểm tra /
Thiếu dữ liệu / Chưa hỗ trợ. Không nói “toàn bộ lab đúng” khi chỉ một probe thành công.

## Scroll, gợi ý và bảo mật hiển thị

- Chỉ tự cuộn khi đang sát cuối. Đang đọc tin cũ thì giữ vị trí và hiện nút
  “Tin mới”; tải thêm trang cũ giữ neo cuộn. Không thay focus theo polling.
- Gợi ý chi tiết hơn cần bấm gửi mới với mức được xin; không tự tăng mức hoặc
  tiết lộ cấu hình chuẩn. Hiện mức trả về thực tế từ server.
- Plain text do React escape, không innerHTML/remote images/link tự sinh;
  mã lệnh trong pre/code và copy nguyên văn. Không chạy lệnh hoặc sửa điểm.
- Nội dung chỉ trong memory; sessionStorage chỉ ID/epoch phục hồi theo
  user/attempt. Đổi auth tạo scope mới ngay từ render, bỏ response muộn;
  đóng ngăn/hidden/offline dừng timer và abort GET/POST đang chờ response.
- Stale tính lại theo revision live, sourceRevision không thay. Việc lab đổi
  không tự tạo request. History/feedback vẫn qua kiểm quyền server.

## Walkthrough năm tình huống trước triển khai

| Tình huống    | Luồng dự kiến và điểm kiểm                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Lần đầu       | Mở → hiểu dữ liệu/riêng tư → chọn ý định → gửi → đọc nguồn/bằng chứng → tự dùng terminal                             |
| Mất mạng      | Soạn không mất; POST có thể đã nhận → tìm bằng ID cũ; reload chỉ phục hồi ID, không phát câu hỏi mới mù              |
| Lab nhóm      | Mọi người cùng cấu hình nhưng history thuộc người đang đăng nhập; thay đổi của bạn học làm câu cũ hiện revision khác |
| Đổi tài khoản | Ngăn không render nội dung A cho B ở lần render đầu; hủy request client, backend kiểm lại quyền từng lần đọc         |
| AI hỏng       | FAILED/503/fallback có chữ rõ; terminal không disabled; fallback ghi nguồn hệ thống; hỏi mới chỉ khi chủ động        |

Mock chạy local dùng chính component và fixture tổng hợp trong harness kiểm
riêng, không thêm chế độ bypass auth hay fake API vào sản phẩm. Kết quả kiểm
thực tế được ghi tại báo cáo FE-01/FE-02 sau triển khai.
