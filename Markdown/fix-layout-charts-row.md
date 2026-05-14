# Fix Layout: Charts Row — NetMastery Dashboard

> **Vấn đề:** `charts-row` đang dùng `1fr 1fr` (50/50) thay vì `1fr 280px`  
> **Kết quả lỗi:** Donut chart bị phình to, legend bị cắt, "Nhật ký bảo mật" nằm sai vị trí  
> **File cần sửa:** `AdminDashboard.css` · `Dashboard.js`

---

## 1. Vấn đề hiện tại (Ảnh 2)

```
┌─────────────────────────┬─────────────────────────┐
│   ActivityBarChart      │   Phân bổ khóa học      │
│   (50%)                 │   (50%) — QUÁ RỘNG      │
│                         │   Donut bị to            │
│                         │   Legend bị cắt chữ      │
│                         ├─────────────────────────┤
│                         │   Nhật ký bảo mật       │
│                         │   (nằm sai chỗ)         │
└─────────────────────────┴─────────────────────────┘
```

---

## 2. Layout đúng cần đạt (Ảnh 1)

```
┌──────────────────────────────────┬─────────────┐
│   ActivityBarChart               │  Donut      │
│   (1fr — co giãn theo màn hình)  │  (280px     │
│                                  │   cố định)  │
│                                  ├─────────────┤
│                                  │  Free Limits│
└──────────────────────────────────┴─────────────┘

┌──────────────┬───────────────────────────────────┐
│  Area Chart  │  Recent Students Table            │
│  (320px)     │  (1fr)                            │
└──────────────┴───────────────────────────────────┘
```

---

## 3. Sửa CSS — `AdminDashboard.css`

### 3.1 Charts Row (sửa chính)

```css
/* ❌ XÓA hoặc ghi đè đoạn này */
.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr; /* SAI */
}

/* ✅ THAY BẰNG */
.charts-row {
  display: grid;
  grid-template-columns: 1fr 280px; /* chart lớn + panel phải cố định */
  gap: 16px;
  align-items: start;              /* panel phải không kéo dài bằng chart */
}
```

### 3.2 Charts Right Column

```css
/* ✅ THÊM MỚI — panel phải xếp dọc */
.charts-right {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
```

### 3.3 Bottom Row

```css
/* ✅ THÊM MỚI — hàng dưới: area chart nhỏ + bảng học viên */
.bottom-row {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  align-items: start;
}
```

### 3.4 Donut Chart — giới hạn kích thước

```css
/* ✅ THÊM — tránh donut bị phình khi container rộng */
.donut-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.donut-wrap .recharts-wrapper {
  flex-shrink: 0;   /* không cho recharts tự co giãn */
}

.donut-legend {
  flex: 1;
  min-width: 0;     /* tránh legend bị tràn */
}

.legend-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px; /* cắt chữ dài thay vì tràn ra ngoài */
}
```

### 3.5 Responsive — thu gọn khi màn hình nhỏ

```css
/* Laptop nhỏ < 1280px */
@media (max-width: 1279px) {
  .charts-row {
    grid-template-columns: 1fr 260px; /* thu nhỏ panel phải một chút */
  }
}

/* Tablet < 1024px — xếp dọc */
@media (max-width: 1023px) {
  .charts-row {
    grid-template-columns: 1fr; /* xếp chồng lên nhau */
  }

  .bottom-row {
    grid-template-columns: 1fr;
  }
}

/* Mobile < 768px */
@media (max-width: 767px) {
  .charts-row,
  .bottom-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
```

---

## 4. Sửa JSX — `Dashboard.js`

### 4.1 Cấu trúc đúng

```jsx
{/* ── CHARTS ROW: Bar chart + Panel phải ── */}
<div className="charts-row">

  {/* Trái: Bar chart chiếm 1fr */}
  <div className="card chart-main">
    <div className="card-header">
      <div>
        <div className="card-title">Hoạt động học tập</div>
        <div className="card-sub">Số bài học hoàn thành</div>
      </div>
      <div className="tab-group">
        <button
          className={`tab ${activeTab === "week" ? "active" : ""}`}
          onClick={() => setActiveTab("week")}
        >
          Tuần này
        </button>
        <button
          className={`tab ${activeTab === "month" ? "active" : ""}`}
          onClick={() => setActiveTab("month")}
        >
          Tháng này
        </button>
      </div>
    </div>
    <ActivityBarChart data={activityData} />
  </div>

  {/* Phải: Donut + Free Limits xếp dọc — KHÔNG đặt gì khác vào đây */}
  <div className="charts-right">

    {/* Card 1: Donut phân bổ khóa học */}
    <div className="card">
      <div className="card-header">
        <div className="card-title">Phân bổ khóa học</div>
      </div>
      <div className="donut-wrap">
        {/* width và height PHẢI cố định, KHÔNG dùng ResponsiveContainer */}
        <PieChart width={90} height={90}>
          <Pie
            data={courseDistribution}
            cx={40}
            cy={40}
            innerRadius={28}
            outerRadius={42}
            dataKey="value"
            stroke="none"
          >
            {courseDistribution.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v} HV`, n]} />
        </PieChart>
        <div className="donut-legend">
          {courseDistribution.map((c) => (
            <div key={c.name} className="legend-row">
              <span className="legend-dot" style={{ background: c.color }} />
              <span className="legend-name">{c.name}</span>
              <span className="legend-val">{c.value} HV</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Card 2: Giới hạn gói Free */}
    <div className="card">
      <div className="card-header">
        <div className="card-title">Giới hạn gói Free</div>
      </div>
      <FreeLimitsPanel usage={planUsage} />
    </div>

  </div>
  {/* ⚠️ KHÔNG đặt NhậtKýBảoMật hoặc bất kỳ component nào khác ở đây */}
</div>

{/* ── BOTTOM ROW: Area chart + Bảng học viên ── */}
<div className="bottom-row">

  {/* Trái: Xu hướng đăng ký — 320px cố định */}
  <div className="card">
    <div className="card-header">
      <div className="card-title">Xu hướng đăng ký</div>
      <div className="card-sub">6 tháng gần nhất</div>
    </div>
    <RegistrationLineChart data={enrollmentTrend} />
  </div>

  {/* Phải: Bảng học viên gần đây — 1fr */}
  <div className="card">
    <div className="card-header">
      <div className="card-title">Học viên gần đây</div>
      <a href="/admin/students" className="view-all">Xem tất cả →</a>
    </div>
    <RecentStudentsTable data={recentStudents} />
  </div>

</div>

{/* ── Nhật ký bảo mật — hàng riêng, full width ── */}
<div className="card">
  <div className="card-header">
    <div className="card-title">Nhật ký bảo mật</div>
    <a href="/admin/logs" className="view-all">Tất cả →</a>
  </div>
  <SecurityLogTable data={securityLogs} />
</div>
```

### 4.2 Lỗi hay gặp với Donut — KHÔNG dùng ResponsiveContainer

```jsx
{/* ❌ SAI — ResponsiveContainer làm PieChart phình to theo panel */}
<ResponsiveContainer width="100%" height={200}>
  <PieChart>
    <Pie ... />
  </PieChart>
</ResponsiveContainer>

{/* ✅ ĐÚNG — kích thước cố định, cx/cy căn giữa */}
<PieChart width={90} height={90}>
  <Pie
    cx={40}      {/* = width/2 - 5 để có padding */}
    cy={40}
    innerRadius={28}
    outerRadius={42}
    ...
  />
</PieChart>
```

---

## 5. Checklist xác nhận sau khi sửa

- [ ] `charts-row` dùng `grid-template-columns: 1fr 280px`
- [ ] `.charts-right` dùng `flex-direction: column`
- [ ] `PieChart` có `width={90} height={90}` cố định, không dùng `ResponsiveContainer`
- [ ] `.donut-legend` có `flex: 1` và `.legend-name` có `text-overflow: ellipsis`
- [ ] `bottom-row` dùng `grid-template-columns: 320px 1fr`
- [ ] "Nhật ký bảo mật" nằm ngoài `charts-row`, là hàng riêng
- [ ] Test resize: 1280px → 1024px → 768px không bị vỡ layout
- [ ] Donut chart không bị to hơn `90x90px` ở bất kỳ viewport nào
