# Hướng Dẫn Sửa: Theo Dõi Tiến Độ Video YouTube

---

## Mục Lục

1. [Tổng quan luồng hoạt động](#1-tổng-quan-luồng-hoạt-động)
2. [Cấu trúc file cần sửa](#2-cấu-trúc-file-cần-sửa)
3. [Frontend — Component Video](#3-frontend--component-video)
4. [Frontend — Service API](#4-frontend--service-api)
5. [Backend — Route](#5-backend--route)
6. [Backend — Controller](#6-backend--controller)
7. [Backend — Model / Schema](#7-backend--model--schema)
8. [Kiểm tra & Debug](#8-kiểm-tra--debug)

---

## 1. Tổng Quan Luồng Hoạt Động

```
[User xem video]
      │
      ▼
[YouTube IFrame API] ──onStateChange──▶ [PLAYING]
      │                                      │
      │                               setInterval(1s)
      │                                      │
      │                               getCurrentTime()
      │                                      │
      │                          updateProgressUI() ◀── cập nhật UI ngay lập tức
      │                                      │
      │                              mỗi 10 giây
      │                                      │
      ▼                                      ▼
[PAUSED / ENDED]                  POST /api/progress/video
      │                                      │
      └──────────────┬───────────────────────┘
                     ▼
              saveProgress() ──▶ DB lưu: watchedTime, percentage, status
```

---

## 2. Cấu Trúc File Cần Sửa

```
src/
├── components/
│   └── VideoPlayer/
│       └── VideoPlayer.jsx          ← [SỬA] Thêm YouTube IFrame API
│
├── services/
│   └── Api.js                       ← [SỬA] Thêm hàm gọi API progress
│
├── Backend/
│   ├── routes/
│   │   └── progress.js              ← [TẠO MỚI hoặc SỬA] Thêm route video
│   │
│   ├── controllers/
│   │   └── progressController.js    ← [SỬA] Thêm hàm updateVideoProgress
│   │
│   └── models/
│       └── VideoProgress.js         ← [TẠO MỚI] Model lưu tiến độ video
```

---

## 3. Frontend — Component Video

### 3.1 Thêm YouTube IFrame API Script

Trong file `index.html` hoặc `public/index.html`, thêm vào thẻ `<head>`:

```html
<!-- index.html -->
<script src="https://www.youtube.com/iframe_api"></script>
```

---

### 3.2 Sửa `VideoPlayer.jsx`

Thay toàn bộ nội dung component bằng code sau:

```jsx
// src/components/VideoPlayer/VideoPlayer.jsx

import React, { useEffect, useRef, useState } from 'react';
import { updateVideoProgress, getVideoProgress } from '../../services/Api';

// ─── Hàm helper: Lấy YouTube Video ID từ URL ───────────────────────────────
function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ─── Hàm helper: Format giây → "Xm Ys" ────────────────────────────────────
function formatTime(seconds) {
  if (!seconds || seconds < 0) return '0m 0s';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

// ─── Component chính ────────────────────────────────────────────────────────
const VideoPlayer = ({ videoUrl, lessonId }) => {
  const playerRef        = useRef(null);   // YouTube Player instance
  const intervalRef      = useRef(null);   // setInterval reference
  const lastSavedRef     = useRef(0);      // Tránh save trùng lặp
  const maxWatchedRef    = useRef(0);      // Thời điểm xem xa nhất (xử lý tua)

  const [progress, setProgress] = useState({
    percentage:  0,
    watchedTime: 0,
    status:      'Chưa học',
  });

  const videoId = extractYouTubeId(videoUrl);

  // ── Bước 1: Load tiến độ đã lưu từ DB khi mount ──────────────────────────
  useEffect(() => {
    if (!lessonId) return;
    getVideoProgress(lessonId)
      .then((data) => {
        if (data) {
          maxWatchedRef.current = data.watchedTime || 0;
          setProgress({
            percentage:  data.percentage  || 0,
            watchedTime: data.watchedTime || 0,
            status:      data.status      || 'Chưa học',
          });
        }
      })
      .catch(console.error);
  }, [lessonId]);

  // ── Bước 2: Khởi tạo YouTube Player ──────────────────────────────────────
  useEffect(() => {
    if (!videoId) return;

    // window.YT có thể chưa load xong → chờ callback onYouTubeIframeAPIReady
    const initPlayer = () => {
      playerRef.current = new window.YT.Player('yt-player-container', {
        videoId,
        playerVars: {
          rel:            0,
          modestbranding: 1,
        },
        events: {
          onReady:       onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      // API chưa load xong, gắn vào callback toàn cục
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    // Cleanup khi component unmount
    return () => {
      stopTracking();
      if (playerRef.current) {
        saveProgressToDB();          // Lưu lần cuối trước khi rời
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId]);

  // ── Bước 3: Khi player sẵn sàng → seek đến chỗ đã xem trước ─────────────
  function onPlayerReady() {
    if (maxWatchedRef.current > 0) {
      playerRef.current.seekTo(maxWatchedRef.current, true);
    }
  }

  // ── Bước 4: Xử lý thay đổi trạng thái video ──────────────────────────────
  function onPlayerStateChange(event) {
    switch (event.data) {
      case window.YT.PlayerState.PLAYING:
        startTracking();
        break;
      case window.YT.PlayerState.PAUSED:
      case window.YT.PlayerState.ENDED:
        stopTracking();
        saveProgressToDB();
        break;
      default:
        break;
    }
  }

  // ── Bước 5: Bắt đầu theo dõi mỗi 1 giây ─────────────────────────────────
  function startTracking() {
    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      if (!playerRef.current) return;

      const currentTime = playerRef.current.getCurrentTime() || 0;
      const duration    = playerRef.current.getDuration()    || 1;
      const percent     = Math.min((currentTime / duration) * 100, 100);

      // Cập nhật maxWatched nếu user không tua lùi
      if (currentTime > maxWatchedRef.current) {
        maxWatchedRef.current = currentTime;
      }

      // Cập nhật UI ngay lập tức
      const status =
        percent >= 90 ? 'Hoàn thành' :
        percent > 0   ? 'Đang học'   : 'Chưa học';

      setProgress({
        percentage:  Math.round(percent),
        watchedTime: Math.floor(currentTime),
        status,
      });

      // Lưu DB mỗi 10 giây (tránh gọi API quá nhiều)
      const floorTime = Math.floor(currentTime);
      if (floorTime % 10 === 0 && floorTime !== lastSavedRef.current) {
        lastSavedRef.current = floorTime;
        saveProgressToDB(currentTime, percent, status);
      }
    }, 1000);
  }

  // ── Bước 6: Dừng tracking ─────────────────────────────────────────────────
  function stopTracking() {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }

  // ── Bước 7: Gọi API lưu lên server ───────────────────────────────────────
  async function saveProgressToDB(
    time    = maxWatchedRef.current,
    percent = progress.percentage,
    status  = progress.status,
  ) {
    if (!lessonId) return;
    try {
      await updateVideoProgress({
        lessonId,
        watchedTime: Math.floor(time),
        percentage:  Math.round(percent),
        status,
      });
    } catch (err) {
      console.error('[VideoPlayer] Lỗi lưu tiến độ:', err);
    }
  }

  // ── Lưu khi user thoát trang ──────────────────────────────────────────────
  useEffect(() => {
    const handleUnload = () => saveProgressToDB();
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="video-player-wrapper">
      {/* YouTube Player sẽ được inject vào đây */}
      <div id="yt-player-container" style={{ width: '100%', aspectRatio: '16/9' }} />

      {/* Thanh tiến độ */}
      <div className="progress-bar-container" style={{ marginTop: 8 }}>
        <div
          className="progress-bar-fill"
          style={{
            height:          6,
            width:           `${progress.percentage}%`,
            backgroundColor: '#2563eb',
            borderRadius:    4,
            transition:      'width 0.5s ease',
          }}
        />
      </div>

      {/* Thông tin tiến độ */}
      <div className="progress-info" style={{ marginTop: 8, fontSize: 14, color: '#555' }}>
        <span>⏱ Đã xem: <strong>{progress.percentage}%</strong></span>
        &nbsp;|&nbsp;
        <span>🕐 Thời gian xem: <strong>{formatTime(progress.watchedTime)}</strong></span>
        &nbsp;|&nbsp;
        <span>📌 Trạng thái: <strong>{progress.status}</strong></span>
      </div>
    </div>
  );
};

export default VideoPlayer;
```

---

## 4. Frontend — Service API

Mở file `src/services/Api.js`, thêm 2 hàm sau vào cuối file:

```javascript
// src/services/Api.js  — THÊM VÀO CUỐI FILE

/**
 * Lưu / cập nhật tiến độ xem video
 * @param {{ lessonId, watchedTime, percentage, status }} data
 */
export const updateVideoProgress = async (data) => {
  const response = await axiosInstance.post('/progress/video', data);
  return response.data;
};

/**
 * Lấy tiến độ xem video đã lưu theo lessonId
 * @param {string} lessonId
 */
export const getVideoProgress = async (lessonId) => {
  const response = await axiosInstance.get(`/progress/video/${lessonId}`);
  return response.data;
};
```

> **Lưu ý:** Đảm bảo `axiosInstance` đã có `baseURL` và header `Authorization` được gắn sẵn.

---

## 5. Backend — Route

### Nếu đã có file `routes/progress.js`, thêm 2 route sau:

```javascript
// src/Backend/routes/progress.js  — THÊM VÀO

const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/authMiddleware');   // middleware xác thực
const {
  updateVideoProgress,
  getVideoProgress,
} = require('../controllers/progressController');

// POST  /api/progress/video        — Lưu tiến độ
router.post('/video',          auth, updateVideoProgress);

// GET   /api/progress/video/:id    — Lấy tiến độ theo lessonId
router.get('/video/:lessonId', auth, getVideoProgress);

module.exports = router;
```

### Đăng ký route trong `app.js` / `server.js` (nếu chưa có):

```javascript
// app.js hoặc server.js
const progressRoutes = require('./routes/progress');
app.use('/api/progress', progressRoutes);
```

---

## 6. Backend — Controller

Mở file `src/Backend/controllers/progressController.js`, thêm 2 hàm:

```javascript
// src/Backend/controllers/progressController.js  — THÊM VÀO

const VideoProgress = require('../models/VideoProgress');

/**
 * POST /api/progress/video
 * Body: { lessonId, watchedTime, percentage, status }
 */
const updateVideoProgress = async (req, res) => {
  try {
    const userId = req.user._id;   // từ authMiddleware
    const { lessonId, watchedTime, percentage, status } = req.body;

    if (!lessonId) {
      return res.status(400).json({ message: 'lessonId là bắt buộc' });
    }

    // Upsert: tạo mới nếu chưa có, cập nhật nếu đã có
    const updated = await VideoProgress.findOneAndUpdate(
      { userId, lessonId },
      {
        $set: {
          watchedTime,
          percentage,
          status,
          updatedAt: new Date(),
        },
        // Chỉ set createdAt lần đầu
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true },
    );

    return res.status(200).json(updated);
  } catch (error) {
    console.error('[updateVideoProgress]', error);
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

/**
 * GET /api/progress/video/:lessonId
 */
const getVideoProgress = async (req, res) => {
  try {
    const userId   = req.user._id;
    const { lessonId } = req.params;

    const record = await VideoProgress.findOne({ userId, lessonId });

    // Trả về object rỗng nếu chưa có — frontend xử lý được
    return res.status(200).json(record || {
      percentage:  0,
      watchedTime: 0,
      status:      'Chưa học',
    });
  } catch (error) {
    console.error('[getVideoProgress]', error);
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

module.exports = {
  // ...các export cũ giữ nguyên
  updateVideoProgress,
  getVideoProgress,
};
```

---

## 7. Backend — Model / Schema

Tạo file mới `src/Backend/models/VideoProgress.js`:

```javascript
// src/Backend/models/VideoProgress.js  — TẠO MỚI

const mongoose = require('mongoose');

const VideoProgressSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    lessonId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Lesson',
      required: true,
    },
    watchedTime: {
      type:    Number,
      default: 0,           // đơn vị: giây
    },
    percentage: {
      type:    Number,
      default: 0,           // 0 → 100
      min:     0,
      max:     100,
    },
    status: {
      type:    String,
      enum:    ['Chưa học', 'Đang học', 'Hoàn thành'],
      default: 'Chưa học',
    },
  },
  {
    timestamps: true,        // tự động thêm createdAt, updatedAt
  },
);

// Index để query nhanh theo userId + lessonId
VideoProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

module.exports = mongoose.model('VideoProgress', VideoProgressSchema);
```

---

## 8. Kiểm Tra & Debug

### 8.1 Checklist trước khi test

- [ ] `youtube_api` script đã được thêm vào `index.html`
- [ ] `axiosInstance` có header `Authorization: Bearer <token>`
- [ ] Route `/api/progress/video` đã được đăng ký trong `app.js`
- [ ] `authMiddleware` đã được áp dụng trên route progress
- [ ] Model `VideoProgress` đã được import đúng đường dẫn

### 8.2 Test bằng Postman

```
POST http://localhost:5000/api/progress/video
Headers: Authorization: Bearer <your_token>
         Content-Type: application/json
Body:
{
  "lessonId": "64a1b2c3d4e5f6a7b8c9d0e1",
  "watchedTime": 120,
  "percentage": 40,
  "status": "Đang học"
}

→ Kỳ vọng: 200 OK + object VideoProgress
```

```
GET http://localhost:5000/api/progress/video/64a1b2c3d4e5f6a7b8c9d0e1
Headers: Authorization: Bearer <your_token>

→ Kỳ vọng: 200 OK + { percentage: 40, watchedTime: 120, status: "Đang học" }
```

### 8.3 Các lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| `YT is not defined` | Script YouTube chưa load | Thêm script vào `index.html` |
| `401 Unauthorized` | Thiếu token | Kiểm tra `axiosInstance` interceptor |
| `Cannot read getCurrentTime` | Player chưa ready | Đảm bảo chỉ gọi sau `onPlayerReady` |
| UI không cập nhật | setInterval bị clear sớm | Kiểm tra cleanup trong `useEffect` |
| Tiến độ reset khi tua | Không dùng `maxWatchedRef` | Dùng `Math.max` khi update `maxWatchedRef` |

### 8.4 Debug nhanh trong Console

```javascript
// Dán vào Console của trình duyệt khi đang xem video
// Kiểm tra player có hoạt động không
const player = document.querySelector('iframe');
console.log('Player:', player);

// Kiểm tra API call trong Network tab
// → Filter: /api/progress/video
// → Xem Request Payload và Response
```

---

## Tóm Tắt Thứ Tự Thực Hiện

```
Bước 1  →  Tạo Model:      VideoProgress.js
Bước 2  →  Sửa Controller: thêm updateVideoProgress, getVideoProgress
Bước 3  →  Sửa Route:      thêm POST /video và GET /video/:lessonId
Bước 4  →  Sửa Api.js:     thêm updateVideoProgress, getVideoProgress
Bước 5  →  Sửa Component:  VideoPlayer.jsx (thay toàn bộ)
Bước 6  →  Thêm script:    YouTube IFrame API vào index.html
Bước 7  →  Test Postman →  Test UI
```
