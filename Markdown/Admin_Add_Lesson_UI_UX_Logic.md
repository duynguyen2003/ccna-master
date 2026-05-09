# Logic Hoạt Động UI/UX - Admin Thêm Bài Học

## 1) Mục tiêu
- Biến luồng thêm bài học từ thao tác rời rạc sang luồng có định hướng, ít sai, phản hồi rõ.
- Giữ nguyên API/backend hiện có, ưu tiên cải tiến ở UI state và trải nghiệm thao tác.

## 2) Vấn đề hiện tại (đang thấy trong code)
- Luồng thêm bài học phụ thuộc modal đơn, mất ngữ cảnh chương khi nhập nhiều field.
- Một biến `error` dùng chung cho cả tạo chương và tạo bài học, dễ hiển thị sai ngữ cảnh.
- Mỗi thao tác tạo/xóa đều `fetchData()` toàn trang, gây giật và làm mất nhịp làm việc.
- Validate quá mỏng (chủ yếu chỉ kiểm tra tên bài), thiếu kiểm tra URL/video và nội dung.
- Phong cách UI dùng nhiều inline style nên khó đồng bộ visual system.

## 3) Luồng UX đề xuất (Happy Path)
1. Admin vào Course Detail.
2. Chọn 1 chương trong danh sách.
3. Nhấn `+ Thêm bài học` ngay trong chương đó.
4. Mở `Lesson Composer` (khuyến nghị dạng side panel hoặc modal lớn 2 cột).
5. Điền theo 3 bước:
- Bước 1: Cơ bản (tên bài, section).
- Bước 2: Nội dung (video URL, HTML/markdown nội dung).
- Bước 3: Rà soát (preview tóm tắt + cảnh báo thiếu).
6. Nhấn `Lưu bài học`.
7. UI thêm lesson mới ngay trong danh sách chương (optimistic), hiển thị trạng thái `Đã lưu`.
8. Cho phép `Lưu & Thêm bài khác` để nhập hàng loạt nhanh.

## 4) Kiến trúc thông tin màn hình
- Cột trái: `Module Navigator`
- Danh sách chương + số bài + trạng thái expand/collapse.
- CTA rõ ràng: `+ Bài học` trên từng chương.

- Cột phải: `Lesson Composer`
- Header: Tên chương đang thêm bài + stepper 1/2/3.
- Body: form theo step.
- Footer cố định: `Hủy` `Lưu nháp` `Lưu bài học` `Lưu & thêm mới`.

## 5) State model (frontend)
```js
pageState = {
  selectedModuleId: null,
  expandedModules: {},
  isComposerOpen: false,
  isSaving: false,
  saveError: '',
  notice: ''
}

lessonDraft = {
  moduleId: '',
  title: '',
  sectionNumber: '',
  videoUrl: '',
  contentHtml: '',
  step: 1,
  touched: {},
  dirty: false
}
```

Khuyến nghị thêm:
- `draftByModule[moduleId]`: giữ nháp riêng theo từng chương.
- `pendingRequestId`: tránh race condition khi bấm lưu liên tục.

## 6) State machine (đơn giản, đủ dùng)
- `idle` -> chưa mở composer.
- `editing` -> đang nhập form.
- `validating` -> bấm lưu, chạy validate.
- `saving` -> gọi API `createLesson`.
- `success` -> insert lesson mới + reset/đóng theo hành động.
- `error` -> giữ dữ liệu form, highlight field lỗi.

Transition:
- `OPEN_COMPOSER`: `idle -> editing`
- `SUBMIT`: `editing -> validating`
- `VALID`: `validating -> saving`
- `SAVE_OK`: `saving -> success -> editing/idle`
- `SAVE_FAIL`: `saving -> error -> editing`
- `CLOSE_WITH_DIRTY`: confirm `discard | continue editing`

## 7) Validate rule (UX rule + kỹ thuật)
Bắt buộc:
- `title` không rỗng, 3-200 ký tự.

Tuỳ chọn nhưng có chuẩn:
- `sectionNumber`: regex gợi ý `^\d+(\.\d+){0,3}$` (vd: `1`, `1.2`, `1.2.3`).
- `videoUrl`: nếu có thì phải là URL hợp lệ (`http/https`).
- `contentHtml`: cảnh báo nếu trống (không block), nhưng gợi ý nên có tối thiểu 30 ký tự.

Thông báo lỗi:
- Lỗi đặt ngay dưới field + summary lỗi ở đầu composer.
- Không dùng popup alert cho lỗi nhập liệu.

## 8) Hành vi tự động giúp giảm thao tác
- Tự gợi ý `sectionNumber` dựa trên lesson cuối cùng trong module (vd sau `1.2.3` -> gợi ý `1.2.4`).
- Tự focus vào `title` khi mở composer.
- `Ctrl/Cmd + Enter` để lưu nhanh.
- Khi lưu thành công: giữ module đang mở và scroll tới lesson mới.

## 9) API mapping (không đổi backend)
- Lấy chương + bài: `GET /learning/courses/:courseId/modules`
- Tạo bài học: `POST /learning/modules/:moduleId/lessons`
- Xóa bài học: `DELETE /learning/lessons/:id`

Payload tạo bài học:
```json
{
  "title": "...",
  "sectionNumber": "1.2.1",
  "contentHtml": "<p>...</p>",
  "videoUrl": "https://..."
}
```

## 10) Feedback matrix
- Saving: disable nút lưu, hiển thị spinner + text `Đang lưu...`.
- Save success: toast xanh `Đã tạo bài học`.
- Save fail network: toast đỏ + giữ nguyên draft.
- Unsaved close: confirm `Bạn có thay đổi chưa lưu`.
- Empty state module: CTA nổi bật `Tạo bài học đầu tiên`.

## 11) Thiết kế visual để hết rời rạc
- Dùng chung token/button/input từ `AdminCommon.css`, hạn chế inline style.
- Áp dụng pattern card/section + stepper giống Exam Builder để đồng bộ admin UX.
- Dùng 1 ngôn ngữ icon nhất quán: `BookOpen` (chương), `FileText` (bài text), `Video` (bài có video).

## 12) Lộ trình triển khai ngắn
1. Tách state lỗi: `moduleError` và `lessonError`.
2. Đổi modal thêm bài học thành composer có stepper 3 bước.
3. Bổ sung validate chuẩn cho `sectionNumber` + `videoUrl`.
4. Thêm optimistic update cho danh sách lesson sau khi lưu.
5. Chuẩn hóa CSS class (giảm inline style) để đồng bộ UI/UX.

## 13) Acceptance criteria
- Thêm liên tiếp 5 bài trong cùng module không bị mất ngữ cảnh.
- Không reload toàn bộ trang khi tạo 1 bài học.
- Lỗi nhập liệu hiển thị đúng field, không hiện sai modal.
- Thời gian thao tác tạo 1 bài < 20 giây (khi có sẵn nội dung).
- UI cùng ngôn ngữ thiết kế với trang Exams Builder.
