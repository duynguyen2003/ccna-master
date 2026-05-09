# Hướng Dẫn Bổ Sung: Tính Năng User Notes (PostgreSQL)

> **Phiên bản:** 1.0  
> **Ngày:** 08/05/2026  
> **Dự án:** CCNA Master  

---

## Mục Lục

1. [Tổng quan](#1-tổng-quan)
2. [Chuẩn bị Database](#2-chuẩn-bị-database)
3. [Backend](#3-backend)
4. [Frontend](#4-frontend)
5. [Xử lý lỗi & Edge Cases](#5-xử-lý-lỗi--edge-cases)
6. [Kiểm thử](#6-kiểm-thử)
7. [Checklist triển khai](#7-checklist-triển-khai)

---

## 1. Tổng quan

Tính năng này cho phép mỗi user lưu ghi chú riêng cho từng bài học. Ghi chú tự động lưu khi user gõ (debounce), không cần bấm nút Save.

**Luồng hoạt động:**

```
User mở lesson
    → Frontend fetch note theo lessonId
    → Hiển thị content vào textarea
    → User gõ → debounce 700ms → POST lên API
    → API upsert vào PostgreSQL
    → Hiện indicator "Đã lưu ✓"
```

---

## 2. Chuẩn bị Database

### 2.1 Tạo bảng `user_notes`

```sql
CREATE TABLE user_notes (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id   INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    content     TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),

    UNIQUE (user_id, lesson_id)
);
```

> **Lưu ý:**
> - `UNIQUE (user_id, lesson_id)` — đảm bảo mỗi user chỉ có đúng 1 note cho mỗi lesson. Constraint này cũng tự tạo index, không cần tạo thêm.
> - `ON DELETE CASCADE` — khi xóa user hoặc lesson, note tự động bị xóa theo, tránh dữ liệu rác (orphan data).
> - `TEXT` không giới hạn độ dài trong PostgreSQL — cần validate thủ công ở tầng controller (xem mục 3.2).

### 2.2 Migration

Không chạy SQL thủ công. Tạo file migration để dễ rollback:

**Tên file:** `migrations/YYYYMMDD_create_user_notes.sql`

```sql
-- UP
CREATE TABLE IF NOT EXISTS user_notes (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id   INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    content     TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, lesson_id)
);

-- DOWN
DROP TABLE IF EXISTS user_notes;
```

---

## 3. Backend

### 3.1 Route — `users.js`

Thêm 2 route mới, **đặt sau auth middleware**:

```js
const { getUserNote, upsertUserNote } = require('../controllers/userController');
const { authenticate } = require('../middleware/auth'); // middleware hiện có

// Ghi chú: authenticate đảm bảo req.user.id luôn tồn tại
router.get('/notes/:lessonId', authenticate, getUserNote);
router.post('/notes', authenticate, upsertUserNote);
```

> ⚠️ Cả hai route đều phải có `authenticate`. Không để public.

### 3.2 Controller — `userController.js`

```js
const { pool } = require('../config/db'); // pool PostgreSQL hiện có

const MAX_NOTE_LENGTH = 10000; // giới hạn 10.000 ký tự

/**
 * GET /api/users/notes/:lessonId
 * Lấy note của user hiện tại cho một lesson cụ thể.
 * Trả về content rỗng nếu chưa có note.
 */
const getUserNote = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const userId = req.user.id;

        // Validate lessonId là số nguyên
        if (!Number.isInteger(Number(lessonId))) {
            return res.status(400).json({ message: 'lessonId không hợp lệ.' });
        }

        const result = await pool.query(
            `SELECT content FROM user_notes
             WHERE user_id = $1 AND lesson_id = $2`,
            [userId, Number(lessonId)]
        );

        res.json({ content: result.rows[0]?.content ?? '' });
    } catch (error) {
        console.error('[getUserNote] Lỗi:', error);
        res.status(500).json({ message: 'Lỗi server khi lấy ghi chú.' });
    }
};

/**
 * POST /api/users/notes
 * Tạo mới hoặc cập nhật note (upsert).
 * Body: { lessonId: number, content: string }
 */
const upsertUserNote = async (req, res) => {
    try {
        const { lessonId, content } = req.body;
        const userId = req.user.id;

        // Validate
        if (!lessonId || !Number.isInteger(Number(lessonId))) {
            return res.status(400).json({ message: 'lessonId không hợp lệ.' });
        }
        if (typeof content !== 'string') {
            return res.status(400).json({ message: 'content phải là chuỗi.' });
        }
        if (content.length > MAX_NOTE_LENGTH) {
            return res.status(400).json({
                message: `Ghi chú không được vượt quá ${MAX_NOTE_LENGTH} ký tự.`
            });
        }

        await pool.query(
            `INSERT INTO user_notes (user_id, lesson_id, content)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, lesson_id)
             DO UPDATE SET
                 content    = EXCLUDED.content,
                 updated_at = NOW()`,
            [userId, Number(lessonId), content]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('[upsertUserNote] Lỗi:', error);
        res.status(500).json({ message: 'Lỗi server khi lưu ghi chú.' });
    }
};

module.exports = { getUserNote, upsertUserNote };
```

---

## 4. Frontend

### 4.1 API Service — `Api.js`

```js
/**
 * Lấy note của user cho một lesson.
 * @param {string} token - JWT token
 * @param {number} lessonId
 * @returns {Promise<string>} content của note
 */
const getUserNote = async (token, lessonId) => {
    const res = await fetch(`/api/users/notes/${lessonId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Không thể tải ghi chú.');
    const data = await res.json();
    return data.content;
};

/**
 * Lưu hoặc cập nhật note.
 * @param {string} token - JWT token
 * @param {{ lessonId: number, content: string }} noteData
 */
const updateUserNote = async (token, noteData) => {
    const res = await fetch('/api/users/notes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(noteData)
    });
    if (!res.ok) throw new Error('Không thể lưu ghi chú.');
    return res.json();
};
```

### 4.2 Component — `Lesson.js`

Bổ sung các phần sau vào component hiện có:

```js
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/Api';

// --- Thêm vào trong component ---

const [noteContent, setNoteContent]   = useState('');
const [saveStatus, setSaveStatus]     = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
const debounceTimer                   = useRef(null);
const currentLessonRef                = useRef(selectedLessonId); // chống race condition

// 1. Fetch note mỗi khi đổi lesson
useEffect(() => {
    if (!selectedLessonId) return;

    currentLessonRef.current = selectedLessonId;
    setNoteContent('');
    setSaveStatus('idle');

    // Hủy debounce đang pending của lesson cũ
    if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
    }

    const fetchNote = async () => {
        try {
            const content = await api.getUserNote(token, selectedLessonId);
            // Chỉ set nếu user chưa chuyển sang lesson khác
            if (currentLessonRef.current === selectedLessonId) {
                setNoteContent(content);
            }
        } catch {
            // Không hiện lỗi ồn ào khi fetch, để textarea trống
        }
    };

    fetchNote();
}, [selectedLessonId]);

// 2. Auto-save với debounce 700ms
const handleNoteChange = useCallback((e) => {
    const value = e.target.value;
    setNoteContent(value);
    setSaveStatus('saving');

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
        // Chỉ save nếu vẫn đang ở đúng lesson
        if (currentLessonRef.current !== selectedLessonId) return;

        try {
            await api.updateUserNote(token, {
                lessonId: selectedLessonId,
                content:  value
            });
            setSaveStatus('saved');
        } catch {
            setSaveStatus('error');
        }
    }, 700);
}, [selectedLessonId, token]);

// 3. Cleanup khi unmount
useEffect(() => {
    return () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
}, []);
```

**JSX — phần textarea:**

```jsx
<div className="note-container">
    <textarea
        value={noteContent}
        onChange={handleNoteChange}
        placeholder="Ghi chú của bạn cho bài học này..."
        maxLength={10000}
    />
    <div className="note-status">
        {saveStatus === 'saving' && <span className="status-saving">Đang lưu...</span>}
        {saveStatus === 'saved'  && <span className="status-saved">Đã lưu ✓</span>}
        {saveStatus === 'error'  && <span className="status-error">Lưu thất bại, thử lại.</span>}
    </div>
</div>
```

---

## 5. Xử lý lỗi & Edge Cases

| Tình huống | Cách xử lý |
|---|---|
| Chuyển lesson nhanh liên tiếp | `currentLessonRef` + `clearTimeout` hủy debounce của lesson cũ |
| Token hết hạn khi đang gõ | `updateUserNote` throw error → `setSaveStatus('error')` |
| Mất mạng khi save | Tương tự — hiện "Lưu thất bại" |
| Note chưa tồn tại | API trả `content: ''`, textarea hiện trống |
| Content vượt 10.000 ký tự | `maxLength` trên textarea + validate server |
| Xóa user/lesson | `ON DELETE CASCADE` tự dọn DB |

---

## 6. Kiểm thử

### 6.1 API (Postman)

| # | Method | URL | Body | Kết quả mong đợi |
|---|---|---|---|---|
| 1 | GET | `/api/users/notes/1` | — | `{ content: "" }` (lần đầu) |
| 2 | POST | `/api/users/notes` | `{ lessonId: 1, content: "test" }` | `{ success: true }` |
| 3 | GET | `/api/users/notes/1` | — | `{ content: "test" }` |
| 4 | POST | `/api/users/notes` | `{ lessonId: 1, content: "updated" }` | `{ success: true }` (upsert) |
| 5 | GET | `/api/users/notes/1` | — | `{ content: "updated" }` |
| 6 | GET | `/api/users/notes/abc` | — | `400` — lessonId không hợp lệ |
| 7 | GET | `/api/users/notes/1` | *(không có token)* | `401` Unauthorized |

### 6.2 Manual

- [ ] Mở lesson → gõ note → refresh trang → note vẫn còn
- [ ] Chuyển sang lesson khác → note khác (hoặc trống)
- [ ] Quay lại lesson ban đầu → note cũ vẫn đúng
- [ ] Chuyển lesson liên tục nhanh → không bị lưu nhầm chéo
- [ ] Đăng nhập tài khoản khác → không thấy note của user trước
- [ ] Gõ đến 10.000 ký tự → textarea chặn, không gõ thêm được

---

## 7. Checklist triển khai

```
[x] Chạy migration tạo bảng user_notes
[x] Thêm getUserNote, upsertUserNote vào userController.js
[x] Đăng ký 2 route mới trong users.js (có authenticate)
[x] Thêm getUserNote, updateUserNote vào Api.js
[x] Cập nhật Lesson.js: state, useEffect, handleNoteChange, JSX
[ ] Test Postman toàn bộ 7 case
[ ] Test manual toàn bộ 6 case
[x] Review code trước khi merge
```
