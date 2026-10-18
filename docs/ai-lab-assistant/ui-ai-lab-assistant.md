# UI cần thêm cho tích hợp AI — CCNA Master

Tài liệu này liệt kê phần giao diện cần bổ sung khi tích hợp AI vào lab, dựa trên cấu trúc hiện tại của `src/frontend/src/features/labs/components/CliLabWorkspace.js` (1.254 dòng).

## 0. Hiện trạng UI có thể tái dùng

| Thành phần hiện có | Vị trí / tên trong code | Dùng cho AI như thế nào |
|---|---|---|
| Thanh gợi ý tĩnh | `cli-lab-hint-bar`, state `hintOpen` | Thêm liên kết "Hỏi trợ lý" |
| Panel phụ | state `secondaryPanel` ("Cùng thực hành", "Thành tích") | Thêm panel "Trợ lý lab" |
| Checklist nhiệm vụ | `cli-lab-checklist`, `focusedTaskId`, `pulseTaskId` | Gắn câu hỏi với một nhiệm vụ; tái dùng hiệu ứng pulse |
| Khối feedback + nút "Giải thích kết quả" | `cli-lab-feedback`, `api.cliExplain`, state `explanation` | Nâng cấp (mục A) |
| Chế độ preview / replay | `isPreview`, `replay` | Vô hiệu hóa AI trong hai chế độ này |
| Chọn thiết bị, đích ping | `deviceId`, `destination` | Làm ngữ cảnh cho "Phân tích kết nối" |
| Khóa thao tác | `busy`, `busyRef`, hàm `perform` | **Không** dùng cho AI (xem A) |

Nguyên tắc: tách phần AI thành component và hook riêng, không thêm trực tiếp vào file workspace hiện có.

---

## A. Sửa nút "Giải thích kết quả" hiện có

Việc cần làm (ưu tiên cao, ít rủi ro):

- [ ] **Loading riêng.** Hiện nút gọi qua `perform` nên bật `busy` và khóa cả terminal trong lúc chờ tối đa 12 giây. Dùng state `aiLoading` riêng; nút hiện "Đang giải thích…", terminal vẫn dùng được.
- [ ] **Nhãn nguồn nội dung.** API trả `provider` là `deterministic` hoặc `configured`, và có thể kèm `unavailable`. Hiển thị:
  - "Giải thích từ AI" khi `configured`
  - "Giải thích từ hệ thống chấm bài" khi `deterministic`
  - Thông báo "AI tạm thời không khả dụng" khi `unavailable`
- [ ] **Cảnh báo ngắn:** "AI có thể sai, hãy đối chiếu với kết quả chấm điểm".
- [ ] **Giữ kết quả theo attempt.** Không gọi lại model khi bấm lại cùng một lần nộp; reset khi đổi attempt hoặc đăng xuất.
- [ ] **Hiển thị lượt còn lại** (khi backend có quota).
- [ ] **Trạng thái lỗi:** 429 (hết lượt / gửi quá nhanh), 503 (AI đang tắt), lỗi mạng. Dùng toast hoặc dòng lỗi trong khối feedback, giữ nút bấm lại được khi phù hợp.
- [ ] **Accessibility:** vùng hiển thị nội dung có `aria-live="polite"`; nút có trạng thái `aria-busy`.

---

## B. Panel "Trợ lý lab" (gợi ý trong lúc đang làm bài)

> Phần này cần endpoint backend mới (hiện chưa có). Tài liệu `docs/ai-lab-assistant/02-architecture-and-contracts.md` đề xuất base path `/api/lab-attempts/:attemptId/ai`. Có thể dựng UI trước với dữ liệu giả.

### B.1. Điểm vào

- Nút **"Trợ lý lab"** ở thanh session, cạnh hai nút hiện có, mở bằng `secondaryPanel`.
- Liên kết **"Hỏi trợ lý"** trong thanh gợi ý tĩnh.

### B.2. Nội dung panel

| Thành phần | Mô tả |
|---|---|
| 3 nút ý định | "Gợi ý bước tiếp theo", "Phân tích kết nối", "Giải thích khái niệm". Chưa cần ô chat tự do ở bản đầu |
| Chọn thiết bị và đích | Tái dùng `deviceId`, `destination`; bắt buộc chọn đích khi phân tích kết nối |
| Cấp gợi ý 1 → 2 → 3 | Học viên chủ động bấm "Gợi ý chi tiết hơn"; không tự động lộ đáp án |
| Thẻ trả lời | Tóm tắt, danh sách bằng chứng (thiết bị, interface, quan sát), bước kiểm tra tiếp theo |
| Lệnh gợi ý | Hiển thị dạng code kèm nút **Sao chép**; không có nút "Chạy" |
| Badge "Dựa trên cấu hình trước đó" | Hiện khi state lab đã đổi sau lúc hỏi; kèm nút "Kiểm tra lại" tạo yêu cầu mới |
| Trạng thái chờ | State riêng của panel, không đụng `busyRef` |
| Lượt còn lại hôm nay | Lấy từ API quota |
| Đánh giá 👍 / 👎 | Kèm lý do ngắn (sai, không hữu ích, lộ đáp án, khó hiểu) |
| Thông báo lần đầu | Nêu dữ liệu nào được gửi tới AI, AI không chấm điểm, học viên tự kiểm tra bằng terminal |

### B.3. Các trạng thái cần thiết kế

| Trạng thái | Hiển thị |
|---|---|
| Chưa hỏi | Ba nút ý định + giới thiệu ngắn |
| Đang chờ | Skeleton / "Đang phân tích…", có thể hủy panel mà không ảnh hưởng terminal |
| Thành công | Thẻ trả lời + 👍/👎 |
| Cũ (stale) | Thẻ trả lời kèm badge "cấu hình trước đó" + nút "Kiểm tra lại" |
| Dùng nội dung dự phòng | Nhãn "Gợi ý từ hệ thống" thay cho "AI" |
| Hết lượt (429) | Số giờ/phút tới lúc reset; không có nút gửi |
| AI tắt hoặc lab chưa hỗ trợ (503/403) | Giải thích ngắn, ẩn ba nút ý định |
| Lỗi mạng | Giữ nội dung đã chọn, nút "Thử lại" |

---

## C. Điểm nối với UI cũ

- **Làm nổi bật thiết bị:** khi bằng chứng nhắc tới một thiết bị, highlight trên topology bằng cơ chế pulse hiện có. Không sửa dữ liệu topology để highlight.
- **Vô hiệu hóa đúng lúc:** tắt khi `replay` đang bật, `isPreview`, hoặc attempt không còn `IN_PROGRESS`. Với lab nhóm, cần quyết định thành viên có được hỏi không; hội thoại là riêng từng người.
- **Dọn state:** reset panel khi đổi attempt, đổi tài khoản, đăng xuất.
- **Không auto-scroll** khi học viên đang đọc nội dung cũ.
- **Mobile:** panel chạy dạng ngăn kéo hoặc modal vì bố cục lab đã chật.
- **Nội dung do AI sinh:** chỉ render văn bản thường hoặc Markdown giới hạn; không bật raw HTML, không nhúng ảnh từ xa. (Khối giải thích hiện tại đã dùng thẻ `<p>`, giữ nguyên cách này.)

---

## D. Phía admin (có thể để sau)

Trong `src/frontend/src/features/admin/pages/Labs.js`:

- Công tắc bật/tắt trợ lý AI theo từng lab.
- Xem lượt dùng và chi phí (khi backend có số liệu).
- Thống kê 👍/👎 theo lab để biết gợi ý nào kém.

---

## E. Chưa cần làm ở bản đầu

Các mục dưới đây chỉ cần nếu chọn kiến trúc bất đồng bộ đầy đủ trong tài liệu kế hoạch. Nếu giữ luồng đồng bộ gọn thì bỏ qua:

- Lịch sử chat có phân trang cursor
- Xóa hội thoại / đặt lại hội thoại
- Hủy request đang chạy
- Polling nhiều bước và nhiều tab
- Xử lý `recoveryEpoch`, `AI_RECOVERY_RECONFIRM`
- Chat tự do không giới hạn ý định

---

## F. Gợi ý cấu trúc file

```text
src/frontend/src/features/labs/components/ai/
  AiLabPanel.jsx        # panel chính
  AiMessage.jsx         # thẻ trả lời + bằng chứng + copy lệnh
  AiHintCard.jsx        # chọn cấp gợi ý
src/frontend/src/features/labs/hooks/useAiLabAssistant.js # state, gọi API, quota, reset khi đổi attempt
src/frontend/src/services/Api.js              # thêm hàm cạnh cliExplain
src/frontend/src/features/labs/styles/AiLab.css # dùng token trong CliLabTokens.css
```

- Load lazy cho panel để không tăng bundle ban đầu.
- Dùng token màu/khoảng cách của `src/frontend/src/features/labs/styles/CliLabTokens.css` để khớp theme dark/light hiện có.

---

## G. Thứ tự thực hiện đề xuất

1. [ ] Mục A (sửa nút "Giải thích kết quả") — không cần endpoint mới.
2. [ ] Dựng `AiLabPanel` với dữ liệu giả, đủ các trạng thái ở B.3.
3. [ ] Nối API thật khi backend có endpoint gợi ý và quota.
4. [ ] Thêm highlight thiết bị, 👍/👎, thông báo dữ liệu lần đầu.
5. [ ] Test component: các trạng thái, vô hiệu hóa khi replay/preview, reset khi đổi attempt.
6. [ ] Admin: công tắc theo lab (nếu cần).

## H. Tiêu chí nghiệm thu UI

- Bấm "Giải thích kết quả" hoặc hỏi trợ lý không làm terminal bị khóa.
- Người dùng luôn phân biệt được nội dung từ AI với nội dung dự phòng của hệ thống.
- Không có nút nào tự chạy lệnh từ gợi ý của AI.
- Nội dung cũ được đánh dấu rõ khi cấu hình lab đã thay đổi.
- Hết lượt, AI tắt hoặc lỗi mạng đều có thông báo rõ và không làm hỏng phần lab còn lại.
- Đổi attempt hoặc đăng xuất không để lộ nội dung của phiên trước.
