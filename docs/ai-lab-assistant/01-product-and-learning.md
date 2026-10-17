# 01 — Sản phẩm và trải nghiệm học

[Về kế hoạch tổng](README.md) · [Thiết kế kỹ thuật](02-architecture-and-contracts.md) · [Backlog](03-delivery-backlog.md) · [Chất lượng/vận hành](04-quality-and-operations.md)

## 1. Bài toán sản phẩm

Người mới học mạng thường biết một vài lệnh nhưng chưa có quy trình xác định nguyên nhân khi lab không chạy. Gợi ý chung không phản ánh cấu hình hiện tại; đưa ngay lời giải có thể làm tăng tỷ lệ hoàn thành mà không cải thiện kỹ năng. CCNA Master cần trợ giúp đúng lúc, dựa trên trạng thái mô phỏng, để người học thực hiện bước kiểm tra tiếp theo và tự sửa cấu hình.

**Lời hứa với học viên:** “Bạn sẽ hiểu nên kiểm tra gì tiếp theo, dựa vào đâu và tự kiểm chứng việc sửa lỗi.”

**Đơn vị giá trị:** một lần người học thoát khỏi vướng mắc và thực hiện đúng một bước troubleshooting. Số tin nhắn hay số token không phải chỉ số thành công chính.

### 1.1. Giả thuyết cần kiểm chứng

| ID | Giả thuyết | Cách kiểm chứng | Khi không đạt |
|---|---|---|---|
| H1 | Người học nhận biết vấn đề nhanh hơn khi gợi ý có bằng chứng từ lab | So sánh thời gian đến bước kiểm tra hữu ích giữa hai lab tương đương, có/không có trợ giúp | Sửa cách trình bày và loại gợi ý trước khi thêm model lớn |
| H2 | Gợi ý tăng dần giúp người học tự sửa thay vì sao chép | Theo dõi cấp gợi ý, thao tác tiếp theo và bài chuyển giao không có AI | Giảm lộ đáp án, tăng câu hỏi kiểm chứng |
| H3 | Chat theo context tiết kiệm công hỗ trợ của người hướng dẫn | Đếm câu hỏi cần hỗ trợ thủ công trên mỗi phiên lab và phân loại nguyên nhân | Bổ sung nội dung/task hints nếu nguyên nhân thuộc bài lab |
| H4 | Chi phí trợ giúp nằm trong ngân sách sản phẩm | Đo chi phí mỗi người học hoạt động và mỗi phiên sửa lỗi thành công | Điều chỉnh context, quota, model hoặc giá gói trước mở rộng |
| H5 | Trợ giúp không làm giảm trải nghiệm terminal hoặc lab nhóm | Đo latency lệnh và quan sát đồng thời gửi AI/thao tác lab | Tách tải worker, sửa locks/rate policy |

### 1.2. Nhóm người dùng

| Nhóm | Nhu cầu chính | Phạm vi ban đầu |
|---|---|---|
| Người mới học IPv4/router/switch | Biết bắt đầu kiểm tra ở đâu, hiểu output tiếng Anh | Ưu tiên R1; giải thích tiếng Việt, giữ nguyên thuật ngữ CLI |
| Người đã học lý thuyết nhưng lab hay mắc lỗi | Chẩn đoán có bằng chứng, không đọc lại toàn bộ bài | R1: DIAGNOSE và kiểm chứng sau sửa |
| Nhóm học chung một attempt | Cùng thao tác mạng, mỗi người có câu hỏi riêng | Quyền thành viên hiện tại + hội thoại cá nhân |
| Người soạn nội dung/giảng viên | Biết lab nào khiến học viên mắc kẹt, phản hồi nào sai | Báo cáo tổng hợp; không mặc định được đọc chat cá nhân |
| Người vận hành sản phẩm | Biết lỗi, chi phí, model/prompt đang chạy và cách tắt AI | Dashboard vận hành, feature flags, runbook |

## 2. Phạm vi từng bản phát hành

| Mốc | Người dùng | Tính năng | Điều kiện trước khi mở |
|---|---|---|---|
| G0 — Thiết kế chốt | Nội bộ | PRD, contract, ba lab mẫu, ADR, budget | Đã xác minh nền tảng repo/hạ tầng, tiêu chí test rõ |
| G1 — Alpha nội bộ | Chủ sản phẩm | Một lab chạy trọn UI → API → durable request → Python fake → lịch sử | Quyền, quota, idempotency, không làm đổi simulator đều có test |
| G2 — Pilot kín | 10–20 học viên được mời | Ba lab đã duyệt; model thật; chẩn đoán, ba cấp gợi ý, hỏi khái niệm, feedback, lịch sử | Đạt gate pilot trong tài liệu 04; tối thiểu hai tuần quan sát và đo D7 |
| R1 — Mở theo cohort | Người học thuộc lab được hỗ trợ | Luồng ổn định, giải thích kết quả có provenance, retention/xóa dữ liệu, hỗ trợ và cost dashboard | Gate R1, thử tải shared IP, phục hồi dữ liệu và rollback đạt |
| R2 — Agent chỉ đọc | Cohort thử nghiệm riêng | AI chọn công cụ topology/interface/route/trace, nhiều bước có giới hạn | Đạt eval so sánh với R1, quyền tool và ngân sách theo request |
| R3 — Mở rộng theo bằng chứng | Theo kết quả R1/R2 | RAG tài liệu được duyệt, review dài hạn, lab OSPF/ACL, cá nhân hóa | Mỗi phần có PRD/eval và ước lượng riêng; không tự gộp vào R1 |

Ba lab R1 nên bao phủ: **IPv4 + trạng thái interface**, **static/default route**, **VLAN access/trunk** theo capability simulator đã kiểm chứng. Chọn ID lab thực tế ở G0. Nếu một loại lệnh chưa hỗ trợ đúng, sửa nội dung/engine trong issue riêng rồi chứng nhận lại; không để AI giả định simulator là toàn bộ Cisco IOS.

### 2.1. Chức năng bắt buộc trước pilot

- Hỏi theo attempt, task, thiết bị; server tự lấy context, không tin state do trình duyệt gửi.
- Phân tích dựa trên bằng chứng hiện tại; phân biệt dữ kiện, khả năng và thiếu dữ liệu.
- Gợi ý ba cấp; học viên chủ động xin cấp tiếp theo.
- Giải thích khái niệm CCNA gắn với lab; nói rõ khi kiến thức vượt capability mô phỏng.
- Hội thoại lưu trên server; reload tiếp tục request đang chạy; lỗi mạng không tạo thêm lượt vô ý.
- Kiểm quyền tài khoản/attempt/conversation, quota và budget; phản hồi sai không đổi điểm.
- Fallback đọc được khi AI/provider gặp lỗi; terminal vẫn hoạt động.
- Người học có thể đánh dấu phản hồi không hữu ích và lý do; người vận hành có request ID để điều tra.
- Thông báo dữ liệu nào được gửi tới AI, thời hạn lưu và cách yêu cầu/xóa hội thoại.

### 2.2. Phạm vi để sau R1

AI tự cấu hình router, chạy command tùy ý, sửa điểm, chấm thay grader, mở Internet tùy ý, upload tài liệu bất kỳ, voice, sinh lab tự publish và phối hợp nhiều agent chưa nằm trong R1. Thêm chức năng nào phải có threat model, budget và tiêu chí chất lượng tương ứng. Điều này không thay đổi mục tiêu kiến trúc dài hạn.

## 3. Hành trình người học

### 3.1. Người mới lần đầu dùng

1. Mở một lab được hỗ trợ; thấy nút “Trợ lý lab” cạnh workspace.
2. Lần đầu mở panel, nhận giới thiệu ngắn: trợ lý dùng trạng thái lab và lệnh gần đây, gợi ý theo từng bước; học viên tự kiểm tra bằng terminal.
3. Chọn một trong ba thao tác “Gợi ý bước tiếp theo”, “Phân tích kết nối”, “Giải thích khái niệm”.
4. Nếu chưa chọn nguồn/đích cho chẩn đoán ping, UI yêu cầu chọn hai thiết bị hoặc đích IPv4 hợp lệ; không suy diễn đích từ rubric ẩn.
5. AI trả một nhận xét có bằng chứng, một bước kiểm tra và một câu hỏi ngắn giúp người học hiểu output.
6. Học viên thao tác terminal. Phản hồi cũ được ghi rõ là dựa trên cấu hình trước đó nếu revision thay đổi.
7. Người học chủ động bấm “Kiểm tra lại” để tạo một request mới; hệ thống không tự gọi model mỗi lệnh.

### 3.2. Người quay lại hoặc mất mạng

1. Mở lại cùng attempt → lấy hội thoại của đúng tài khoản và request đang chạy.
2. Nếu POST lần trước chưa rõ đã tới server, tra bằng `clientRequestId` trước; gửi lại cùng ID khi cần.
3. Tin nhắn chưa được server xác nhận giữ trong bộ nhớ tab. Không lưu nội dung chat nhạy cảm vào localStorage mặc định.
4. Bản nháp có thể mất nếu đóng tab trước khi server nhận; UI phân biệt rõ “chưa gửi” với “đã lưu”.
5. Request đã nhận vẫn hoàn thành phía server khi tab đóng; kết quả chỉ hiển thị sau khi kiểm lại quyền.
6. Đổi tài khoản sẽ hủy poll, xóa state và query cache thuộc tài khoản cũ; response muộn không được render.

### 3.3. Lab nhóm

Trạng thái mạng được chia sẻ; hội thoại thuộc từng thành viên. AI chỉ nhận lịch sử chat của người hỏi. Lệnh CLI chia sẻ có thể dùng làm bằng chứng kỹ thuật sau khi bỏ `actorId`, thông tin định danh và dữ liệu nhạy cảm. Chủ attempt không được đọc chat của các thành viên bằng quyền chủ phiên.

Khi thành viên bị loại, API lịch sử, trạng thái request, feedback và tool đều từ chối. Request chưa dispatch được hủy. Nếu provider đã nhận dữ liệu, hệ thống không thể bảo đảm thu hồi dữ liệu đã gửi; phải chặn công cụ tiếp theo, không phát nội dung kết quả và ghi chi phí đã phát sinh.

### 3.4. Nộp bài và xem lại

Grader xác định kết quả. AI giải thích phần feedback được phép xem, đúng revision đã chấm. Hiện code có thể giữ `feedback` trong attempt `IN_PROGRESS` sau lần nộp chưa đạt; vì vậy không suy luận “sau nộp” chỉ từ trạng thái `PASSED`.

R1 bổ sung provenance của feedback mới. Feedback cũ thiếu revision hiển thị giải thích xác định của kết quả đã lưu, không trộn với trạng thái live để khẳng định nguyên nhân hiện tại. Replay/preview R1 không có nút gửi câu hỏi live; vẫn có thể xem lịch sử riêng nếu quyền cho phép, với nhãn “phản hồi từ phiên trực tiếp”.

## 4. User stories và tiêu chí nghiệm thu

Các ID `AC-*` được dùng trong backlog và test matrix để truy vết.

| ID | User story | Nghiệm thu quan sát được |
|---|---|---|
| AC-01 | Tôi muốn biết bước kiểm tra tiếp theo khi lab không kết nối | Câu trả lời có evidence đúng thiết bị/interface/trace; chưa đủ bằng chứng thì hỏi thêm hoặc nêu giả thuyết |
| AC-02 | Tôi muốn nhận gợi ý tăng dần | Mức đầu không đưa toàn bộ lời giải; tăng mức là hành động chủ động; policy server không tin hintLevel client tùy ý |
| AC-03 | Tôi muốn hiểu một khái niệm liên quan lab | Giải thích tiếng Việt, ví dụ hợp capability, phân biệt khái niệm chung với sự thật đã quan sát trong phiên |
| AC-04 | Tôi muốn biết AI đang nói về cấu hình nào | Message có source revision/thời điểm; khi state đổi, UI cập nhật nhãn cũ; không tự chạy lại và tốn thêm tiền |
| AC-05 | Tôi muốn tiếp tục sau reload/lỗi mạng | Lấy lại message/request đã nhận; 20 retry đồng thời cùng ID chỉ có một request và tối đa một dispatch đã cấp phép |
| AC-06 | Tôi muốn chat của mình được giữ riêng | Thành viên khác/chủ phiên/tài khoản vừa đăng nhập không đọc được nội dung, kể cả response đến muộn |
| AC-07 | Tôi muốn biết hạn mức và xử lý khi AI tạm lỗi | 429 nêu đúng phạm vi hạn mức, có thời điểm thử lại khi biết; fallback không mạo nhận là model trả lời |
| AC-08 | Tôi muốn vẫn dùng terminal khi chờ AI | Gửi AI không bật `busy` chung; lệnh chạy bình thường; kết quả AI không làm thay state/score |
| AC-09 | Tôi muốn biết sau khi tự sửa thì lỗi đã hết chưa | Request mới dùng revision mới; trả “chưa thấy vấn đề trong phạm vi kiểm tra” khi phù hợp; không tự khẳng định toàn lab hoàn tất |
| AC-10 | Tôi muốn báo một gợi ý sai hoặc nguy hiểm | Feedback gắn đúng message/request; cùng user có thể sửa đánh giá; có luồng xử lý và trạng thái hỗ trợ |
| AC-11 | Tôi muốn giải thích kết quả đã nộp | Dùng feedback có provenance; không dùng đề sửa mới hoặc state live để dựng lại quá khứ |
| AC-12 | Tôi muốn biết và xóa dữ liệu hội thoại | Có thông báo dữ liệu, xóa ẩn ngay khỏi UI, purge theo SLA; không khôi phục chat đã xóa khi job cũ trả về |
| AC-13 | Tôi muốn thao tác bằng bàn phím và màn hình nhỏ | Focus hợp lý, đọc được trạng thái, không mất terminal context; 200% zoom vẫn gửi/đọc được |
| AC-14 | Người vận hành muốn dừng AI khi vượt ngân sách | Flag phía server chặn request mới và dispatch; không chỉ ẩn nút UI; hiện fallback phù hợp |
| AC-15 | Người vận hành muốn hỗ trợ lớp dùng chung mạng | Nhiều user chung IP vẫn đạt tải được công bố; phân biệt 429 ở proxy với quota cá nhân |
| AC-16 | Tôi muốn AI chẩn đoán nhiều bước ở R2 | Mỗi tool có quyền, evidence và giới hạn; loop kết thúc đúng budget; state thật và điểm không thay đổi |

### 4.1. Kịch bản Given/When/Then bắt buộc

**Sai đường chẩn đoán:** Given interface không dùng đang shutdown nhưng đường từ PC1 đến PC2 vẫn tốt; When hỏi vì sao ping không được; Then AI không lấy interface này làm nguyên nhân chỉ vì nó shutdown, phải dùng trace liên quan hoặc nói chưa đủ dữ kiện.

**Retry qua hai backend:** Given request đã được nhận nhưng browser mất response; When cùng ID tới hai replica; Then cả hai trả cùng request ID, không nhân đôi user message, reservation hoặc provider call.

**Cấu hình đổi trong lúc chờ:** Given AI dùng revision 12; When đồng đội tạo revision 13 trước khi AI xong; Then câu trả lời vẫn ghi nguồn 12, có nhãn cũ và nút kiểm tra lại; không âm thầm thay context giữa chừng.

**Thu hồi quyền:** Given provider đang xử lý; When thành viên bị loại khỏi attempt; Then không đọc được status/message/feedback hoặc gọi tool mới; accounting vẫn ghi phần chi phí đã phát sinh.

**Xóa hội thoại đang xử lý:** Given người học xóa lịch sử; When response cũ về sau; Then nội dung không được tạo lại; request lưu metadata vận hành theo chính sách retention, quota settle đúng một lần.

## 5. Chính sách hướng dẫn học

### 5.1. Ba cấp gợi ý

| Cấp | Đầu ra nên có | Đầu ra không đáp ứng policy |
|---|---|---|
| 1 — Định hướng | Vùng cần kiểm tra, khái niệm liên quan, một câu hỏi suy nghĩ | Danh sách cấu hình hoàn chỉnh hoặc chỉ ra đáp án ẩn |
| 2 — Quan sát | Thiết bị/interface liên quan, lệnh `show` được hỗ trợ, cách đọc trường quan trọng | Khẳng định nguyên nhân mà không có evidence hoặc gửi lệnh chưa hỗ trợ |
| 3 — Hành động có giải thích | Một bước sửa có giới hạn từ dữ kiện công khai và cách kiểm chứng; có thể có mẫu cú pháp ngắn | Toàn bộ golden solution, giá trị rubric ẩn hoặc tự thi hành lệnh |

Policy đề xuất: cấp 1 → 2 → 3 theo request chủ động; cho phép nhảy cấp qua hành động rõ “Tôi cần gợi ý cụ thể hơn” sau khi đọc giải thích. Server lưu mức đã cung cấp theo task trong hội thoại, không dùng độ trễ giả để buộc người học chờ. Câu hỏi cố lấy lời giải vẫn áp dụng policy ở cả ba cấp.

Một giá trị IP trong yêu cầu công khai có thể dùng để hướng dẫn. Giá trị chỉ tồn tại trong hidden rubric không được chuyển sang Python. Khả năng model suy đoán một lời giải từ kiến thức và đề công khai cần được đánh giá về sư phạm; nó khác với việc hệ thống làm lộ trường dữ liệu bí mật.

### 5.2. Mẫu phản hồi

1. **Nhận xét:** một hoặc hai câu mô tả dữ kiện/hypothesis.
2. **Bằng chứng:** thiết bị, interface hoặc kết quả trace cụ thể; UI lấy nhãn từ dữ liệu đã xác minh.
3. **Bước tiếp theo:** tối đa hai việc nhỏ; command nếu có phải được kiểm theo command catalog.
4. **Cách kiểm chứng:** kết quả nào cần quan sát sau thao tác.
5. **Câu hỏi học tập:** không bắt buộc mọi lượt, tránh gây phiền khi người học đang cần xử lý nhanh.

Ví dụ: “Trong lần kiểm tra từ PC1 tới PC2 ở cấu hình lúc 14:32, cổng G0/0 trên R1 đang administratively down và thuộc đường kết nối đang xét. Bạn kiểm tra bằng `show ip interface brief`; trạng thái nào cho biết cổng bị tắt bằng cấu hình?”

Nếu chỉ quan sát một cổng shutdown mà chưa biết nó thuộc đường đi, dùng “Một điểm cần kiểm tra…” và nêu thiếu nguồn/đích. Không trình bày điều này như nguyên nhân đã xác nhận.

### 5.3. Kiến thức và nguồn

- R1 sử dụng nội dung lab đã duyệt, các ghi chú khái niệm ngắn có version và kiến thức model; không tạo đường dẫn tài liệu không được cung cấp.
- Câu trả lời về trạng thái phiên phải gắn evidence; câu giải thích khái niệm được đánh dấu riêng và không giả vờ là kết quả simulator.
- Không hỗ trợ được lệnh/protocol thì nói rõ giới hạn của môi trường mô phỏng và đề xuất bài đã có.
- RAG sau này chỉ truy hồi nội dung có quyền sử dụng và quyền xem theo user/course; có source ID/version và dẫn nguồn thật.

## 6. Thiết kế giao diện và trạng thái

Desktop: panel bên phải, có thể thu gọn, chiều rộng ban đầu khoảng 340–420px và không lấn terminal dưới chiều rộng tối thiểu. Tablet/mobile: panel riêng hoặc drawer toàn chiều rộng với nút trở về lab; không tự mở che terminal. Kích thước cuối phải được kiểm trên UI thật.

| State | Người học thấy | Hành vi hệ thống |
|---|---|---|
| Không thuộc cohort/lab chưa hỗ trợ | Thông tin hỗ trợ hiện có hoặc không hiện CTA AI | Server vẫn enforce eligibility |
| Empty | Giới thiệu ngắn + ba quick actions | Chưa gọi provider |
| Draft | Nội dung đang gõ | Không tự gửi theo debounce |
| Accepting | “Đang gửi…” | Giữ clientRequestId, chưa báo đã lưu |
| Queued | “Đã nhận, đang chờ xử lý” | Có request ID; poll có backoff |
| Running | “Đang phân tích cấu hình…” | Cho tiếp tục terminal; không dựng tiến độ phần trăm giả |
| Completed | Answer + bằng chứng + hướng dẫn | Chỉ hiện sau validation và kiểm quyền |
| Stale | “Dựa trên cấu hình trước đó” | Không xóa message, không tự regenerate |
| Unavailable/fallback | Gợi ý có sẵn + thông báo AI tạm không khả dụng | Phân biệt fallback với answer từ model |
| Outcome unknown | “Chưa xác nhận được kết quả; bạn có thể kiểm tra lại trạng thái” | Không tự gửi lại provider; giữ accounting đúng |
| Quota | Hạn mức hiện tại và mốc reset nếu có | 429 có scope USER_RATE/USER_DAILY/CONCURRENCY |
| Offline | Dừng tự retry POST; giữ bản nháp trong tab | Khi online tra request cũ trước |
| Unauthorized/account switch | Dọn ngay nội dung thuộc phiên cũ | Hủy fetch/poll và query cache |
| Replay/preview | Nhãn chế độ xem; không có send live | Không gửi nhầm context lịch sử |

Accessibility: landmark và tên nút rõ; focus quay về nút mở khi đóng panel; `aria-live` thông báo hoàn thành ngắn thay vì đọc lại toàn hội thoại; code block cuộn ngang; không dùng màu làm tín hiệu duy nhất; kiểm bàn phím, reader và zoom 200%.

## 7. Đo hiệu quả học tập

### 7.1. Định nghĩa metric

| Metric | Công thức / cửa sổ | Lưu ý diễn giải |
|---|---|---|
| AI activation | User có request hợp lệ đầu tiên / user eligible đã mở lab trong 7 ngày | Không dùng tổng đăng ký làm mẫu số |
| Useful next step | Phiên trợ giúp có thao tác kiểm tra phù hợp trong 10 phút hoạt động / phiên trợ giúp đánh giá được | Dựa command catalog + reviewer mẫu; không chỉ có message “cảm ơn” |
| Assisted recovery | Lỗi mục tiêu từ fail sang pass trong 15 phút hoạt động sau trợ giúp / phiên fail đủ dữ kiện | Loại stale không liên quan; riêng tư/nhóm được tách; đây là liên hệ, chưa chứng minh nhân quả |
| Independent transfer | Điểm lab tương đương không có AI sau 24h–7 ngày so với baseline | Tránh dùng lại đúng topology/lời giải vừa thấy |
| Hint dependence | Phân bố mức cao nhất + số lượt / lab, theo trình độ và độ khó | Ít hint không luôn là tốt; phải đọc cùng kết quả học |
| D7 lab retention | User quay lại làm lab ngày 7 ± 1 / cohort đủ tuổi quan sát | Không tính user mới chưa đủ 8 ngày là không quay lại |
| Cost per assisted recovery | Tổng provider cost của cohort / số recovery đánh giá được | Báo cả N và phần unknown cost |
| Helpfulness feedback | Positive / tổng feedback hợp lệ | Báo tỷ lệ phản hồi; mẫu tự nguyện có thiên lệch |
| False diagnosis | Answer chẩn đoán sai evidence/root cause / answer được review | Phân tầng lỗi và mức độ; không chỉ điểm trung bình |

Thời gian “hoạt động” loại khoảng bất động dài hơn 2 phút, theo heartbeat/thao tác đã công bố; nếu chưa có đo hoạt động thì dùng thời gian thực và ghi hạn chế. Không sửa telemetry hiện hữu để âm thầm thu thêm nội dung cá nhân.

### 7.2. Event contract tối thiểu

Các event có `eventId`, `eventVersion`, `occurredAt`, pseudonymous actor key, attempt/lab ID nội bộ, cohort, app version. Không gửi prompt, CLI output hoặc câu trả lời vào hệ thống analytics.

| Event | Thời điểm phát | Trường riêng |
|---|---|---|
| `ai_panel_opened` | Mở panel | labId, eligible, entryPoint |
| `ai_request_accepted` | Commit transaction nhận request | requestId, intent, hintLevel, contextRevision |
| `ai_request_finished` | Commit terminal state | requestId, outcome, latency bucket, stale, fallback |
| `ai_answer_viewed` | Message thực sự hiện khi tab visible | messageId, requestId; dedup theo actor/message |
| `ai_feedback_recorded` | Server lưu feedback | messageId, helpful, reasonCode |
| `lab_check_transition` | Backend xác nhận check đổi trạng thái | attemptId, publicTaskId, from/to, revision, actor key nếu có |
| `ai_conversation_deleted` | Server ghi tombstone | conversationId pseudonymous, reason optional |

Server events ghi vào outbox cùng transaction nghiệp vụ; exporter gửi lại có dedup `eventId`. Frontend events có thể thiếu vì offline; không dùng chúng để thanh toán hoặc tính quota.

### 7.3. Pilot và đánh giá

1. Mời 10–20 người thuộc hai mức kinh nghiệm, có sự đồng ý tham gia và cơ chế báo lỗi.
2. Quan sát ít nhất 5 phiên có hướng dẫn để phát hiện vấn đề UI/nội dung, sau đó cho tự học.
3. Dùng hai lab tương đương, đảo thứ tự hỗ trợ giữa nhóm; giữ phần kiểm tra chuyển giao không có AI. Đánh giá kết quả bằng grader và rubric quan sát.
4. Thu ít nhất 100 lượt AI đã hoàn thành để phát hiện lỗi sản phẩm phổ biến; không coi mẫu này chứng minh chất lượng toàn bộ CCNA.
5. Sau ít nhất 14 ngày, đọc activation, recovery, D7, feedback, latency, cost cùng số lượng mẫu và khoảng bất định.
6. Nếu không thấy tín hiệu giá trị học tập, sửa gợi ý/nội dung và chạy vòng pilot nữa. Đạt kỹ thuật chưa đủ để mở rộng chi tiêu.

Mục tiêu sản phẩm ban đầu để thảo luận: ≥70% người tham gia đánh giá trải nghiệm hữu ích; recovery tốt hơn baseline với độ khó tương đương; không giảm điểm chuyển giao; tỷ lệ người thấy “AI làm hộ” thấp và được điều tra. Đây là mục tiêu khám phá, không thay các gate kỹ thuật cứng hay được trình bày như kết quả thống kê đã chứng minh.

## 8. Quản trị nội dung và hỗ trợ

Mỗi lab hỗ trợ AI cần một hồ sơ: public objective, prerequisite, command profile, simulatorVersion, golden actions chạy đạt, lỗi chủ đích, trường hợp cấu hình đúng, hints ba cấp, facts không được lộ, reviewer/date, fixture IDs và giới hạn mô phỏng. Sửa lab hoặc engine phải tái chạy các fixtures liên quan.

Feedback reason: `WRONG_FACT`, `WRONG_DEVICE`, `UNSUPPORTED_COMMAND`, `TOO_MUCH_SOLUTION`, `TOO_VAGUE`, `STALE`, `SLOW`, `OTHER`. Góp ý mở giới hạn 1.000 ký tự; sanitize và quyền đọc như dữ liệu người học. UI cho phép người học chủ động đính kèm câu trả lời vào báo cáo; support không mặc định có quyền mở toàn hội thoại.

Ưu tiên xử lý: lộ dữ liệu/sai quyền/tăng chi phí không kiểm soát → dừng tính năng liên quan ngay; chẩn đoán sai có thể dẫn học sai → tắt rule/prompt/lab bị ảnh hưởng và rà các câu tương tự; UX nhỏ → backlog tuần tiếp theo. Công bố giờ hỗ trợ thực tế của người vận hành một mình.

## 9. Ràng buộc sản phẩm cho agent R2

Agent chỉ sử dụng các công cụ đọc được Node cấp. Người học thấy tóm tắt thao tác như “đã kiểm tra interface và đường đi”, cùng bằng chứng đã xác minh; không cần hiển thị chuỗi suy nghĩ nội bộ. Mỗi request có số bước, token, thời gian và ngân sách tối đa.

Thử nghiệm so sánh R1/R2 trên cùng bộ ca khó: R2 chỉ mở rộng khi giải quyết thêm tình huống có ích, không tăng lỗi nghiêm trọng và chi phí tăng nằm trong giới hạn đã duyệt. Nếu agent chỉ tạo thêm lượt gọi mà không cải thiện kết quả, giữ luồng R1 cho intent đó.
