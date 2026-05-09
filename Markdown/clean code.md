# Hướng Dẫn Tối Ưu Code — Backend & Frontend API

> Tài liệu này tổng hợp các vấn đề phát hiện được qua review và hướng dẫn cách sửa chi tiết, kèm ví dụ code cụ thể.

---

## Mục lục

2. [Backend — examController.js](#2-backend--examcontrollerjs)
3. [Checklist tổng hợp](#3-checklist-tổng-hợp)

---


## 2. Backend — `examController.js`

### 2.1 `deleteExam` — Thiếu Validate ID (Bug tiềm ẩn)

**Vấn đề:** Nếu `id = "abc"` hoặc bị bỏ trống, `parseInt` trả về `NaN`, Prisma sẽ crash với lỗi không rõ ràng.

```js
// ❌ Trước — không validate
module.exports.deleteExam = async (req, res, next) => {
  const { id } = req.params;
  await prisma.exam.update({
    where: { id: parseInt(id, 10) }, // NaN nếu id không hợp lệ
    data: { deletedAt: new Date() }
  });
  res.json({ message: 'Xóa bài thi thành công' });
};
```

**Cách sửa:**

```js
// ✅ Sau — validate như getExamById
module.exports.deleteExam = async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id, 10);
    if (Number.isNaN(examId)) {
      return res.status(400).json({ message: 'ID bài thi không hợp lệ' });
    }

    const existing = await prisma.exam.findFirst({
      where: { id: examId, deletedAt: null }
    });
    if (!existing) {
      return res.status(404).json({ message: 'Không tìm thấy bài thi' });
    }

    await prisma.exam.update({
      where: { id: examId },
      data: { deletedAt: new Date() }
    });

    res.json({ message: 'Xóa bài thi thành công' });
  } catch (error) {
    next(error);
  }
};
```

---

### 2.2 `updateExam` — Không Xử Lý Lỗi Prisma P2025

**Vấn đề:** Nếu `examId` không tồn tại, Prisma ném lỗi `P2025` nhưng controller không bắt, dẫn đến response lỗi 500 mà không có thông báo rõ ràng.

```js
// ❌ Trước — Prisma P2025 không được xử lý
const exam = await prisma.exam.update({
  where: { id: examId },
  // ...
});
```

**Cách sửa:**

```js
// ✅ Sau — bắt lỗi P2025 riêng
module.exports.updateExam = async (req, res, next) => {
  try {
    const examId = parseInt(req.params.id, 10);
    if (Number.isNaN(examId)) {
      return res.status(400).json({ message: 'ID bài thi không hợp lệ' });
    }

    // ... (sanitize questions như cũ)

    const exam = await prisma.exam.update({
      where: { id: examId },
      data: { /* ... */ }
    });

    res.json({ message: 'Cập nhật bài thi thành công', exam });
  } catch (error) {
    // Bắt lỗi Prisma record not found
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Không tìm thấy bài thi' });
    }
    next(error);
  }
};
```

> **Lưu ý:** Các Prisma error code thường gặp:
> - `P2025` — Record not found
> - `P2002` — Unique constraint violation
> - `P2003` — Foreign key constraint violation

---

### 2.3 `createExam` — Logic `totalQuestions` Mâu Thuẫn

**Vấn đề:** `totalQuestions` từ client có thể khác với số câu hỏi thực tế được tạo:

```js
// ❌ Trước — dữ liệu không nhất quán
totalQuestions: sanitizedQuestions.length || parseInt(totalQuestions, 10),
// Nếu client gửi totalQuestions=20 nhưng chỉ có 15 câu hỏi hợp lệ
// → lưu vào DB sẽ là 15 (đúng) nhưng logic này dễ gây nhầm lẫn
```

**Cách sửa:** Luôn dùng số câu hỏi thực tế, bỏ `totalQuestions` từ client:

```js
// ✅ Sau — dùng số câu thực tế, nhất quán
const exam = await prisma.exam.create({
  data: {
    title,
    examCode: examCode || null,
    totalQuestions: sanitizedQuestions.length, // ← luôn dùng cái này
    durationMinutes: parseInt(durationMinutes, 10),
    passingScore: parseInt(passingScore, 10) || 70,
    difficulty: difficulty || null,
    courseId: courseId || null,
    moduleId: moduleId || null,
    questions: { create: sanitizedQuestions }
  },
  include: { questions: true }
});
```

---

### 2.4 `sanitizeQuestionsInput` — Result Pattern Không Nhất Quán

**Vấn đề:** Hàm trả về `{ error }` hoặc `{ data }` — không phải JavaScript convention, dễ quên check:

```js
// ❌ Trước — custom result pattern dễ gây bug nếu quên check
const questionsResult = sanitizeQuestionsInput(questions || []);
if (questionsResult.error) { /* ... */ }
const sanitizedQuestions = questionsResult.data;
```

**Cách sửa:** Dùng custom Error class, throw thẳng, bắt ở controller:

```js
// validation-error.js
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

module.exports = { ValidationError };
```

```js
// ✅ Sau — sanitize throw thẳng
const { ValidationError } = require('../errors/validation-error');

const sanitizeQuestionsInput = (questions) => {
  if (!Array.isArray(questions)) {
    throw new ValidationError('Danh sách câu hỏi không hợp lệ');
  }
  if (questions.length === 0) {
    throw new ValidationError('Cần ít nhất 1 câu hỏi cho bài thi');
  }

  return questions.map((questionItem, index) => {
    const rawOptions = Array.isArray(questionItem.options) ? questionItem.options : [];
    const normalizedOptions = [0, 1, 2, 3].map((i) => `${rawOptions[i] || ''}`.trim());
    const questionText = `${questionItem.question || ''}`.trim();
    const correctAnswer = parseInt(questionItem.correctAnswer, 10);
    const imageUrl = `${questionItem.imageUrl || ''}`.trim() || null;

    if (!questionText) throw new ValidationError(`Câu hỏi ${index + 1} không được để trống`);
    if (normalizedOptions.some((o) => !o)) throw new ValidationError(`Câu hỏi ${index + 1} cần đủ 4 đáp án`);
    if (Number.isNaN(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
      throw new ValidationError(`Câu hỏi ${index + 1} có đáp án đúng không hợp lệ`);
    }

    return {
      question: questionText,
      options: normalizedOptions,
      correctAnswer,
      explanation: `${questionItem.explanation || ''}`.trim() || null,
      imageUrl,
      orderIndex: index + 1
    };
  });
};
```

```js
// ✅ Controller — bắt lỗi gọn hơn
module.exports.createExam = async (req, res, next) => {
  try {
    // ...
    const sanitizedQuestions = sanitizeQuestionsInput(questions || []);
    // ...
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};
```

---

### 2.5 `uploadQuestionImage` — Check Mimetype Thừa

**Vấn đề:** Kiểm tra mimetype trong controller là thừa nếu multer đã lọc ở middleware:

```js
// ❌ Trước — check trùng lặp
if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
  return res.status(400).json({ message: 'File tải lên phải là hình ảnh.' });
}
```

**Cách sửa:** Xử lý filter ở tầng middleware multer:

```js
// multer.config.js
const multer = require('multer');

const imageFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new ValidationError('File tải lên phải là hình ảnh'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter
});

module.exports = { upload };
```

```js
// ✅ Controller — gọn lại, không check lại
module.exports.uploadQuestionImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn ảnh để tải lên.' });
    }

    const uploadResult = await uploadBufferToCloudinary(req.file, {
      folder: 'ccna/exams/questions',
      resourceType: 'image'
    });

    res.status(201).json({
      message: 'Tải ảnh câu hỏi thành công',
      imageUrl: uploadResult.secure_url
    });
  } catch (error) {
    next(error);
  }
};
```

---

### 2.6 `prisma` Khởi Tạo Ngoài Module

**Vấn đề:** `const prisma = getPrisma()` ở top-level có thể gây vấn đề nếu `getPrisma()` không phải singleton thuần túy.

```js
// ❌ Trước — khởi tạo khi module load
const prisma = getPrisma();
```

**Cách sửa:** Đảm bảo `getPrisma()` là singleton thực sự:

```js
// config/database.js — pattern chuẩn Prisma singleton
const { PrismaClient } = require('@prisma/client');

let prisma;

const getPrisma = () => {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
};

module.exports = { getPrisma };
```

```js
// examController.js — nếu getPrisma đã là singleton thì giữ nguyên cách dùng là được
const prisma = getPrisma(); // ✅ OK nếu singleton đúng cách
```

---


### Backend (`examController.js`)

| # | Vấn đề | Trạng thái | Ưu tiên |
|---|--------|------------|---------|
| 1 | `deleteExam` thiếu validate ID | ☐ Chưa sửa | 🔴 Bug |
| 2 | `updateExam` không xử lý Prisma P2025 | ☐ Chưa sửa | 🔴 Bug |
| 3 | `totalQuestions` logic mâu thuẫn | ☐ Chưa sửa | 🟡 Trung bình |
| 4 | `sanitizeQuestionsInput` result pattern không nhất quán | ☐ Chưa sửa | 🟡 Trung bình |
| 5 | Check mimetype thừa trong controller | ☐ Chưa sửa | 🟢 Thấp |
| 6 | Xác nhận `getPrisma()` đã là singleton | ☐ Cần kiểm tra | 🟡 Trung bình |

---

> **Gợi ý thứ tự thực hiện:**
> 1. Sửa bug trước (validate ID, xử lý P2025)
> 3. Refactor `request()` và `sanitizeQuestionsInput`
> 4. Dọn các vấn đề nhỏ còn lại