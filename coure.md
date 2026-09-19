# SPECIFICATION: Xây dựng Learning Game Path cho CCNA Master – CCNA 200-301

## 1. Vai trò

Bạn là **Senior Full-stack Engineer + Senior Front-end Engineer + UI/UX Designer**, có kinh nghiệm xây dựng:

* Educational Platform
* Gamification System
* Learning Progress System
* React SPA
* Node.js REST API
* PostgreSQL / Prisma
* GSAP animation
* Responsive SVG visualization
* Accessibility
* Production architecture

Bạn đang làm việc trực tiếp trên repository của dự án **CCNA Master**.

Nhiệm vụ của bạn là xây dựng hoặc nâng cấp trang **Roadmap / Learning Path** thành một **Game Path – Bản đồ hành trình học CCNA 200-301**, lấy cảm hứng từ cách Duolingo, Codecademy và Khan Academy thể hiện tiến trình học tập.

Đây **không phải UI demo độc lập**.

Feature phải được tích hợp trực tiếp vào kiến trúc, routing, API, authentication, database và design system hiện tại của CCNA Master.

---

# 2. Tech Stack thực tế của CCNA Master

Dự án là một ứng dụng **Full-stack PERN-style architecture** với frontend và backend triển khai độc lập.

## Frontend

```text
React 18
TypeScript / JavaScript theo cấu trúc repository hiện tại
Create React App
react-scripts / Webpack
React Router v7
HashRouter
TanStack React Query v5
Axios
Context API / AuthContext
Motion / Framer Motion
GSAP
@gsap/react
Recharts
TanStack Table
Lucide React
Material Icons Round
clsx
tailwind-merge
Xterm.js
SVG Network Topology
React Player
React YouTube
Marked
```

React version hiện tại:

```text
react: ^18.3.1
```

Router:

```text
react-router-dom: ^7.18.3
```

Server state:

```text
@tanstack/react-query
```

Animation:

```text
motion: ^12.38.0
gsap: ^3.15.0
@gsap/react
```

## Backend

```text
Node.js
Express 5
Prisma ORM v7
PostgreSQL
Zod
JWT
Google OAuth
bcrypt
Helmet
express-rate-limit
Multer
Cloudinary
Nodemailer
```

Express:

```text
express: ^5.2.1
```

Prisma:

```text
@prisma/client
@prisma/adapter-pg
prisma
```

Zod:

```text
zod: ^4.3.6
```

## Deployment

Frontend:

```text
Vercel
```

Backend API:

```text
Render
https://ccna-master.onrender.com
```

Database:

```text
Supabase PostgreSQL
Serverless Pooler
Region: Singapore
```

Backend source hiện nằm trong:

```text
src/Backend/
```

---

# 3. Các giả định TUYỆT ĐỐI KHÔNG được tự tạo

Không được mặc định dự án sử dụng:

```text
Vite
Next.js
Remix
NestJS
MongoDB
Firebase
Supabase Auth
Next.js API Routes
Server Components
SSR
```

Dự án hiện tại là:

```text
React SPA
       ↓
Axios
       ↓
Express REST API trên Render
       ↓
Prisma
       ↓
Supabase PostgreSQL
```

Phải giữ nguyên architecture này trừ khi repository thực tế chứng minh điều khác.

---

# 4. Quy tắc bắt buộc trước khi code

Trước khi sửa bất kỳ file nào, hãy inspect repository.

Xác định chính xác:

```text
src structure
Roadmap page hiện tại
routing configuration
HashRouter setup
AuthContext
Axios instance
React Query configuration
QueryClient configuration
API service layer
Course models
Module models
User progress models
Prisma schema
Express routes
Express controllers
Express services
Zod schemas
authentication middleware
authorization middleware
design tokens
CSS/Tailwind setup
existing GSAP utilities
existing Motion components
```

Không tạo component hoặc abstraction duplicate nếu project đã có equivalent.

Ưu tiên:

```text
adapt existing architecture
```

thay vì:

```text
rewrite existing architecture
```

Không refactor toàn bộ project chỉ để triển khai Learning Path.

---

# 5. Lưu ý đặc biệt: Create React App, KHÔNG phải Vite

Frontend đang chạy bằng:

```text
Create React App
react-scripts
Webpack
```

Do đó không được viết:

```typescript
import.meta.env.VITE_API_URL
```

Nếu cần environment variable frontend, sử dụng convention hiện tại của CRA, ví dụ:

```typescript
process.env.REACT_APP_API_URL
```

Nhưng trước tiên phải tìm xem project đã có Axios baseURL hoặc env abstraction hay chưa.

Nếu đã có:

```typescript
apiClient
axiosInstance
API_BASE_URL
```

thì tái sử dụng.

Không tạo Axios instance thứ hai nếu không cần thiết.

---

# 6. Routing

Project sử dụng:

```text
React Router v7
HashRouter
```

Phải dùng routing mechanism hiện tại.

Ví dụ:

```typescript
useNavigate()
```

Không sử dụng:

```javascript
window.location.href = ...
```

trừ trường hợp điều hướng ra external website.

Không chuyển từ:

```text
HashRouter
```

sang:

```text
BrowserRouter
```

chỉ vì feature mới.

Không thay đổi routing strategy đang giúp Vercel tránh lỗi refresh 404.

---

# 7. Server State: TanStack React Query v5

Dữ liệu Learning Path là **server state**.

Không quản lý API data chính bằng:

```typescript
useEffect(() => {
  fetch(...)
}, [])
```

nếu React Query đã được cấu hình.

Ưu tiên architecture:

```text
Axios
   ↓
learningPathApi
   ↓
useQuery / useMutation
   ↓
React components
```

Ví dụ conceptual:

```typescript
const learningPathQuery = useQuery({
  queryKey: ["learning-path"],
  queryFn: getLearningPath,
});
```

Course/module completion nên sử dụng:

```typescript
useMutation()
```

Sau mutation thành công:

```text
update query cache
hoặc
invalidateQueries
```

tùy architecture hiện tại.

Tránh refetch toàn bộ app nếu không cần thiết.

---

# 8. Phân chia State

Phân biệt rõ:

## Server State

Sử dụng React Query:

```text
courses
modules
progress
XP
badges
streak
learning statistics
```

## Authentication State

Tiếp tục dùng:

```text
AuthContext
```

Không chuyển authentication sang React Query.

## UI State

Có thể dùng local React state:

```text
selectedCourse
modalOpen
toast
hover
temporary unlock animation
```

Không đưa mọi thứ vào Context.

---

# 9. Authentication

Project đang sử dụng:

```text
JWT
Google OAuth
AuthContext
```

Learning Path API phải tái sử dụng authentication flow hiện tại.

Không tự phát minh cách lưu token mới.

Nếu Axios interceptor hiện đang tự attach token:

```http
Authorization: Bearer <token>
```

thì tiếp tục sử dụng interceptor đó.

Không duplicate token logic trong:

```text
LearningPathMap
CourseNodeItem
CourseDetailModal
```

Backend phải lấy user identity từ authentication middleware hiện tại.

Frontend không được gửi:

```json
{
  "userId": "..."
}
```

để backend tin tưởng trực tiếp nếu user đã được nhận diện từ JWT.

---

# 10. Core UX Concept

Thay cách hiển thị roadmap kiểu card/list truyền thống bằng một:

# Learning Journey / Game Path

Mỗi course/chặng học là một **Node**.

Các node được đặt trên một đường hành trình zigzag.

Desktop:

```text
START

 ● ITN
      ╲
       ╲
          ● SRWE
        ╱
      ╱
 ● ENSA
      ╲
        ...
```

Mobile:

```text
        ● ITN
          │
     ● SRWE
          │
        ● ENSA
          │
     ● Security
```

Mục tiêu là người học có thể nhìn UI và ngay lập tức biết:

```text
Tôi đang ở đâu?
Tôi đã học xong gì?
Tôi cần học gì tiếp?
Course nào đang khóa?
Tại sao nó khóa?
Tôi đã tiến được bao xa?
```

---

# 11. Data Model

Nếu repository chưa có types tương đương, sử dụng hoặc adapt cấu trúc:

```typescript
export type CourseStatus =
  | "completed"
  | "current"
  | "locked";

export interface CourseModule {
  id: string;
  title: string;
  duration: string;
  completed: boolean;
}

export interface CourseNode {
  id: string;

  code?: string;

  title: string;

  description: string;

  progressPercent: number;

  totalModules: number;

  completedModules: number;

  status: CourseStatus;

  prerequisiteId: string | null;

  iconType?:
    | "network"
    | "switching"
    | "enterprise"
    | "security"
    | "automation";

  modules?: CourseModule[];

  skills?: string[];

  estimatedHours?: number;

  badgeName?: string;

  examCode?: string;
}

export interface RawCourse {
  id: string;

  title: string;

  description: string;

  progressPercent: number;

  totalModules: number;

  completedModules: number;

  prerequisiteId: string | null;

  code?: string;

  iconType?:
    | "network"
    | "switching"
    | "enterprise"
    | "security"
    | "automation";

  modules?: CourseModule[];

  skills?: string[];

  estimatedHours?: number;

  badgeName?: string;

  examCode?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface PositionedNode {
  node: CourseNode;

  index: number;

  point: Point;

  labelPosition:
    | "top"
    | "bottom"
    | "left"
    | "right";
}

export interface PathSegment {
  fromIndex: number;

  toIndex: number;

  startPoint: Point;

  endPoint: Point;

  pathData: string;

  isCompleted: boolean;

  isCurrentNext: boolean;
}

export interface ZigzagConfig {
  isMobile: boolean;

  nodeSize: number;

  horizontalSpacing: number;

  verticalAmplitude: number;

  verticalSpacing: number;

  horizontalAmplitude: number;

  paddingX: number;

  paddingY: number;
}
```

Nếu Prisma/API hiện tại sử dụng naming khác:

**không thay database chỉ để khớp interface frontend.**

Tạo adapter:

```text
Backend DTO
    ↓
learningPathAdapter
    ↓
RawCourse[]
    ↓
computeCourseStatuses()
    ↓
CourseNode[]
```

---

# 12. Business Logic

Component UI không được tự suy luận nghiệp vụ lung tung.

Tách pure function:

```typescript
computeCourseStatuses(
  rawCourses: RawCourse[]
): CourseNode[]
```

Quy tắc cơ bản:

```text
progress >= 100
→ completed

course chưa hoàn thành đầu tiên
+ prerequisite đã đạt
→ current

các course còn lại
→ locked
```

Progress phải clamp:

```text
0 <= progress <= 100
```

Ví dụ:

```typescript
export function computeCourseStatuses(
  rawCourses: RawCourse[]
): CourseNode[] {
  const completedIds = new Set<string>();

  let hasSetCurrent = false;

  return rawCourses.map((course) => {
    let status: CourseStatus = "locked";

    const progressPercent = Math.min(
      100,
      Math.max(0, course.progressPercent)
    );

    const prerequisiteMet =
      course.prerequisiteId === null ||
      completedIds.has(course.prerequisiteId);

    if (progressPercent >= 100) {
      status = "completed";
      completedIds.add(course.id);
    } else if (prerequisiteMet && !hasSetCurrent) {
      status = "current";
      hasSetCurrent = true;
    }

    return {
      ...course,
      progressPercent,
      status,
    };
  });
}
```

---

# 13. Backend vẫn là Source of Truth

Frontend có thể derive:

```text
completed
current
locked
```

để render UI.

Nhưng frontend KHÔNG được là lớp bảo mật.

Backend phải kiểm tra prerequisite lại.

Ví dụ user manually gọi:

```http
PATCH /api/modules/xxx/progress
```

cho một course bị khóa:

backend phải tự kiểm tra xem user có đủ điều kiện hay chưa.

Không được tin:

```json
{
  "status": "current"
}
```

gửi từ frontend.

---

# 14. Path Geometry Architecture

Toàn bộ tính toán geometry phải được tách khỏi DOM và React.

Tạo pure utilities tương đương:

```text
pathGeometry.ts
```

Bao gồm:

```typescript
calculateZigzagPositions()
generatePathSegments()
```

Không tính path bằng cách query DOM của từng node.

Geometry phải được xác định từ:

```text
container dimensions
course count
responsive config
node size
spacing
amplitude
```

---

# 15. Desktop Layout

Desktop sử dụng:

```text
Left → Right
```

Node chẵn:

```typescript
y = centerY + verticalAmplitude;
```

Node lẻ:

```typescript
y = centerY - verticalAmplitude;
```

Position label:

```text
node phía trên
→ label bottom

node phía dưới
→ label top
```

Path phải có đủ horizontal spacing để label không overlap.

---

# 16. Mobile Layout

Mobile không được chỉ scale nhỏ desktop.

Mobile chuyển sang:

```text
Top → Bottom
```

Node chẵn:

```typescript
x = centerX - horizontalAmplitude;
```

Node lẻ:

```typescript
x = centerX + horizontalAmplitude;
```

Label:

```text
node bên trái → label right
node bên phải → label left
```

Thiết kế phải dùng được từ khoảng:

```text
320px
```

trở lên.

---

# 17. Responsive Detection

Không đọc:

```typescript
window.innerWidth
```

trực tiếp trong render.

Ưu tiên:

```text
ResizeObserver
```

hoặc responsive hook hiện có của project.

Geometry nên phản ứng theo kích thước **container**, không chỉ toàn bộ viewport.

Target:

```text
320px+
768px+
1024px+
1440px+
```

---

# 18. SVG Cubic Bezier

Nối các node liền kề bằng:

```text
M x1 y1
C cp1x cp1y,
  cp2x cp2y,
  x2 y2
```

Tạo hai layer.

## Track bed

Ví dụ:

```text
stroke-width: 12-14px
stroke-linecap: round
```

Màu neutral nhẹ.

## Progress path

Completed:

```text
solid
brand blue
5-6px
```

Locked/future:

```text
gray/slate
4px
stroke-dasharray="7 7"
```

SVG path không được chặn tương tác:

```css
pointer-events: none;
```

khi phù hợp.

---

# 19. Node States

Có ba trạng thái.

## Completed

Visual:

```text
primary background
white Check icon
subtle bright ring
badge
```

Interaction:

```text
click → review
```

ARIA example:

```text
Đã hoàn thành Introduction to Networks, tiến độ 100%
```

---

## Current

Đây phải là visual anchor mạnh nhất.

Visual:

```text
brand background
course icon
outer glow
subtle pulse
progress
```

Text có thể gồm:

```text
Bạn đang ở đây
```

và:

```text
45% hoàn thành
```

CTA:

```text
Tiếp tục học
```

---

## Locked

Visual:

```text
neutral background
gray border
Lock icon
reduced emphasis
```

Không giảm opacity quá thấp.

Click không điều hướng vào course.

Hiển thị:

```text
Hoàn thành [Prerequisite Course]
để mở khóa chặng này.
```

ARIA:

```tsx
aria-disabled="true"
```

---

# 20. Icons

Tái sử dụng:

```text
lucide-react
```

Ví dụ mapping:

```typescript
const COURSE_ICON_MAP = {
  network: Network,
  switching: Route,
  enterprise: Building2,
  security: ShieldCheck,
  automation: Bot,
};
```

Nếu project đã có Material Icons cho một phần giao diện:

không cần migration toàn bộ icon system.

Learning Path có thể sử dụng Lucide nếu phù hợp với visual system hiện tại.

---

# 21. LearningPathMap

Component chính có trách nhiệm:

```text
receive CourseNode[]
calculate geometry
generate path segments
render SVG
render nodes
manage viewport
auto-scroll current node
coordinate animations
```

Không chịu trách nhiệm:

```text
Axios request trực tiếp
Prisma query
JWT decoding
business authorization
database update
```

---

# 22. CourseNodeItem

Component node chỉ tập trung vào presentation và interaction.

Ví dụ:

```typescript
interface CourseNodeItemProps {
  positionedNode: PositionedNode;

  onOpen: (
    course: CourseNode
  ) => void;

  onLockedClick?: (
    course: CourseNode
  ) => void;
}
```

Ưu tiên:

```tsx
<button>
```

không phải:

```tsx
<div onClick={...}>
```

---

# 23. Course Detail Modal

Completed và current node có thể mở modal.

Modal hiển thị:

```text
Course code
Course title
Description
Progress
Modules completed
Total modules
Estimated hours
Skills
Badge
Exam code
Modules
```

Current CTA:

```text
Tiếp tục học
```

Completed CTA:

```text
Ôn tập lại
```

Navigation phải dùng React Router.

---

# 24. Gamification Summary

Phía trên Learning Path có thể hiển thị:

```text
🔥 7
Chuỗi ngày học

⚡ 2450 XP
Điểm kinh nghiệm

🏆 4
Huy hiệu

📈 58%
Tiến độ CCNA
```

Data model:

```typescript
interface LearningStats {
  streakDays: number;
  xp: number;
  badges: number;
  overallProgress: number;
}
```

Không hardcode giá trị nếu server đã cung cấp.

---

# 25. Motion và GSAP: phân chia trách nhiệm

Project đang dùng đồng thời:

```text
Motion
GSAP
```

Không được để cả hai animate cùng một CSS property trên cùng element tại cùng thời điểm.

Điều này có thể gây:

```text
animation conflict
transform overwrite
jitter
unexpected state
```

## Motion

Tiếp tục ưu tiên cho các component đã sử dụng Motion, ví dụ:

```text
GooeyNav
DeleteButton
simple enter/exit
layout animation
spring-based UI
```

Không rewrite chúng sang GSAP.

## GSAP

Learning Path ưu tiên GSAP cho:

```text
SVG path reveal
timeline sequencing
unlock animation
node pulse
stagger
camera-like animations
complex coordinated transitions
```

Đặc biệt:

```text
GSAP timeline
```

nên dùng cho animation unlock course.

---

# 26. GSAP Architecture

Animation logic không được rải trong component JSX.

Tách:

```text
animations/
├── pathReveal
├── glowPulse
├── nodeUnlock
└── cardHover
```

Sử dụng:

```typescript
useGSAP()
```

và scope animation theo component.

Cleanup đúng khi unmount.

Không tạo duplicate infinite tween mỗi lần React rerender.

---

# 27. Path Reveal

Khi map load:

SVG path có thể được vẽ dần.

Sử dụng:

```typescript
path.getTotalLength()
```

và:

```text
strokeDasharray
strokeDashoffset
```

Timeline giữa các path segment overlap nhẹ để tạo cảm giác một hành trình liên tục.

Không animate quá lâu.

---

# 28. Current Node Glow

Current node:

```text
scale 1
→ 1.08
→ 1
```

Duration khoảng:

```text
1.4-1.6s
```

Sử dụng:

```text
repeat: -1
yoyo: true
ease: sine.inOut
```

Animation phải cleanup khi node không còn current.

---

# 29. Summary Card Hover

Summary card có micro-interaction:

```text
y: -3
scale: 1.02-1.025
```

Shadow nhẹ.

Dùng:

```text
overwrite: auto
```

để tránh animation queue.

Không tạo card hover quá exaggerated.

---

# 30. Unlock Timeline

Khi user hoàn thành course thật sự:

```text
current
→ completed
```

và:

```text
next locked
→ current
```

Animation:

```text
completed node burst
        ↓
switch icon → Check
        ↓
confetti
        ↓
connection path highlight
        ↓
unlock next node
        ↓
next node becomes current
        ↓
glow pulse
```

Confetti có thể sử dụng:

```text
canvas-confetti
```

Nhưng chỉ chạy khi có **state transition thật**.

Không chạy confetti khi:

```text
page refresh
query refetch
initial API load
```

chỉ vì server trả về course đã completed.

Có thể detect:

```text
previousProgress < 100
AND
nextProgress >= 100
```

hoặc sử dụng metadata từ mutation response.

---

# 31. React Query Mutation Flow

Khi user hoàn thành module:

```text
CourseDetail
     ↓
useMutation
     ↓
Axios
     ↓
Express API
     ↓
Prisma transaction/update
     ↓
response
     ↓
React Query cache
     ↓
LearningPath state transition
     ↓
GSAP unlock timeline
```

Không dùng fake local state làm source of truth sau khi mutation thất bại.

Có thể dùng optimistic update **chỉ nếu architecture hiện tại phù hợp** và rollback đúng.

Nếu không cần thiết, ưu tiên server-confirmed update.

---

# 32. REST API

Trước tiên inspect API hiện có.

Nếu đã có API phù hợp:

hãy reuse.

Không tạo endpoint duplicate chỉ vì prompt có ví dụ.

Nếu chưa có, có thể thiết kế tương đương:

```http
GET /api/learning-path
```

Response:

```json
{
  "courses": [],
  "stats": {
    "streakDays": 7,
    "xp": 2450,
    "badges": 4,
    "overallProgress": 58
  }
}
```

Route phải nằm trong backend architecture hiện tại:

```text
src/Backend/
```

---

# 33. Module Progress API

Conceptual endpoint:

```http
PATCH /api/modules/:moduleId/progress
```

Body:

```json
{
  "completed": true
}
```

Backend flow:

```text
authenticate
     ↓
Zod validate
     ↓
find module
     ↓
check user permissions
     ↓
check prerequisite
     ↓
update progress
     ↓
recalculate course progress
     ↓
detect course completion
     ↓
calculate next unlock
     ↓
return normalized response
```

Example:

```json
{
  "courseProgress": 100,
  "courseCompleted": true,
  "unlockedCourseId": "SRWE"
}
```

---

# 34. Express 5

Backend sử dụng:

```text
Express 5
```

Phải follow conventions hiện tại của Express 5 project.

Không viết code dựa trên boilerplate Express version cũ nếu repository đã sử dụng async handlers theo Express 5.

Tái sử dụng:

```text
routes
controllers
services
middleware
```

hiện tại.

Controller nên mỏng.

Business logic nên nằm ở service/domain layer nếu architecture hiện tại có pattern đó.

---

# 35. Zod Validation

Mọi mutation liên quan đến progress phải được validate phía server.

Ví dụ conceptual:

```typescript
const updateModuleProgressSchema = z.object({
  completed: z.boolean(),
});
```

Không dựa duy nhất vào TypeScript frontend.

TypeScript biến mất ở runtime.

Zod là validation boundary của API.

---

# 36. Security

Phải duy trì các middleware hiện có:

```text
JWT authentication
Helmet
Rate limiting
Zod validation
authorization
```

Learning Path không được mở lỗ hổng kiểu:

```text
user A cập nhật progress user B
```

Không lấy userId từ body nếu backend đã có:

```text
req.user
```

hoặc authentication context tương đương.

Không expose:

```text
passwordHash
JWT secret
database URL
internal Prisma error
stack trace
```

ra frontend.

---

# 37. Prisma ORM v7

Project đang sử dụng:

```text
Prisma v7
@prisma/client
@prisma/adapter-pg
```

Trước khi sửa schema:

đọc:

```text
schema.prisma
Prisma client initialization
adapter-pg configuration
database service
```

Không copy boilerplate Prisma v5/v6 nếu project đã sử dụng pattern Prisma v7.

Không tạo PrismaClient mới trong mỗi request.

Tái sử dụng database client/pool abstraction hiện có.

---

# 38. PostgreSQL / Supabase

Database nằm trên:

```text
Supabase PostgreSQL
Serverless Pooler
Singapore
```

Không được:

```text
connect trực tiếp từ browser
expose DATABASE_URL
query Supabase PostgreSQL từ React
```

Luồng đúng:

```text
React
 ↓
Render API
 ↓
Prisma
 ↓
Supabase PostgreSQL
```

Không đưa Supabase database credentials vào:

```text
REACT_APP_*
```

vì biến CRA frontend sẽ được bundle ra browser.

---

# 39. Prisma Data Model

Không tạo duplicate model nếu schema hiện tại đã có:

```text
User
Course
Module
Progress
Lab
Exam
```

Trước tiên map chúng vào Learning Path.

Chỉ đề xuất schema migration nếu model hiện tại không thể biểu diễn:

```text
course order
prerequisite
module progress
course progress
XP
streak
badge
```

Không reset database.

Không chạy destructive migration nếu không cần thiết.

---

# 40. Vercel Frontend + Render Backend

Frontend và backend chạy ở hai origin khác nhau.

Phải tôn trọng cấu hình:

```text
Vercel
   ↓ HTTP
Render
```

Không viết API path tương đối kiểu:

```typescript
axios.get("/api/learning-path")
```

nếu architecture hiện tại yêu cầu Render base URL.

Tái sử dụng existing baseURL configuration.

Kiểm tra CORS hiện tại.

Không tự mở:

```text
Access-Control-Allow-Origin: *
```

nếu project đang sử dụng whitelist domain.

Production frontend phải gọi đúng Render API.

Development vẫn phải hoạt động với local backend nếu project hiện hỗ trợ.

---

# 41. Render Cold Start

Backend hiện chạy trên Render.

Frontend cần có loading state tốt vì API có thể không phản hồi tức thì trong một số tình huống deployment.

Không để user thấy màn trắng.

Learning Path cần:

```text
skeleton
loading feedback
retry behavior
```

React Query nên xử lý loading/error state thay vì tự viết polling không cần thiết.

---

# 42. Loading State

Trong lúc API load:

hiển thị skeleton cho:

```text
gamification stats
roadmap path
course nodes
```

Không render path với:

```text
undefined
NaN
0x0 dimensions
```

---

# 43. Error State

Nếu API thất bại:

hiển thị:

```text
Không thể tải lộ trình học tập.

[Vui lòng thử lại]
```

Nút retry có thể gọi:

```text
refetch()
```

Không expose raw Prisma/Express errors.

---

# 44. Empty State

Nếu chưa có course:

```text
Lộ trình CCNA đang được cập nhật.
```

Không render SVG lỗi.

---

# 45. Auto-scroll Current Node

Sau khi map đã có:

```text
data
geometry
DOM
```

auto-scroll current node vào viewport.

Ví dụ:

```typescript
element.scrollIntoView({
  behavior: reducedMotion
    ? "auto"
    : "smooth",
  block: "center",
  inline: "center",
});
```

Chỉ chạy khi phù hợp.

Không auto-scroll lại mỗi khi React Query background refetch.

---

# 46. prefers-reduced-motion

Bắt buộc hỗ trợ:

```css
prefers-reduced-motion: reduce
```

Nếu bật:

```text
disable infinite glow
disable complex path reveal
disable burst
disable hoặc giảm confetti
avoid forced smooth scrolling
```

Functional behavior phải giữ nguyên.

---

# 47. Accessibility

Node tương tác phải dùng semantic HTML.

Ưu tiên:

```tsx
<button>
```

Keyboard:

```text
Tab
Shift+Tab
Enter
Space
Escape
```

Focus state phải rõ.

Không remove outline nếu không có replacement.

Progress:

```tsx
role="progressbar"
aria-valuemin={0}
aria-valuemax={100}
aria-valuenow={progress}
```

Toast:

```tsx
aria-live="polite"
```

Modal:

```text
dialog semantics
keyboard accessible
Escape close
focus management
return focus to trigger
```

Không dùng màu sắc làm tín hiệu trạng thái duy nhất.

---

# 48. Visual Direction

Phong cách cần hướng tới:

```text
Cisco-inspired
Networking
Professional
Modern SaaS
Gamified education
Premium learning platform
```

Ưu tiên:

```text
blue/cyan brand accents
slate neutrals
subtle gradients
soft glow
moderate rounded corners
clean typography
clear hierarchy
good whitespace
```

Không:

```text
excessive neon
excessive glassmorphism
huge shadows
constant animation everywhere
childish game style
too much confetti
```

Đối tượng là sinh viên/người học CCNA, vì vậy Gamification phải trưởng thành.

---

# 49. Existing UI System

Project đang có:

```text
Material Icons Round
Lucide
Motion
GSAP
Rare UI / shadcn-inspired components
cn()
clsx
tailwind-merge
```

Không tạo một design system mới.

Tận dụng:

```typescript
cn()
```

nếu project đang dùng helper này.

Nếu có component:

```text
Button
Modal
Card
Toast
Badge
```

hiện tại thì tái sử dụng.

Không tạo duplicate component chỉ khác tên.

---

# 50. Existing Specialized Features

CCNA Master đã có:

```text
Xterm.js terminal
interactive SVG topology
React Player
React YouTube
Markdown lesson content
Labs
Exams
Dashboard
```

Learning Path phải đóng vai trò entry point để đi vào các feature này.

Ví dụ:

```text
Learning Node
   ↓
Course
   ↓
Module
   ↓
Theory / Video / Lab / Quiz
```

Không duplicate terminal hoặc topology simulator bên trong Roadmap.

Node chỉ nên điều hướng tới experience tương ứng.

---

# 51. Future Integration với Labs

Data model nên có khả năng mở rộng để sau này hiển thị:

```text
Course
  ↓
Theory
  ↓
Quiz
  ↓
Cisco CLI Lab
  ↓
Topology Lab
  ↓
Course completion
```

Nhưng không over-engineer feature hiện tại nếu backend chưa support.

---

# 52. Performance

Dùng:

```typescript
useMemo()
```

hợp lý cho:

```text
geometry
positioned nodes
path segments
```

Không premature optimization.

GSAP phải được cleanup.

Không duplicate observer/listener.

Không import package khổng lồ nếu chỉ cần một function.

Nếu `canvas-confetti` chưa có:

có thể dynamic import khi unlock xảy ra.

---

# 53. React Query Cache

Thiết kế query key có cấu trúc.

Ví dụ:

```typescript
["learning-path"]
```

hoặc nếu phụ thuộc user:

vẫn ưu tiên user lấy từ authentication server-side thay vì nhét userId do client điều khiển.

Sau mutation:

có thể:

```typescript
queryClient.invalidateQueries({
  queryKey: ["learning-path"],
});
```

hoặc cập nhật cache trực tiếp nếu response backend đủ dữ liệu.

Tránh:

```text
window.location.reload()
```

sau khi hoàn thành module.

---

# 54. Course Completion Transaction

Nếu completion liên quan nhiều record:

```text
module progress
course progress
XP
badge
streak
```

hãy kiểm tra xem có nên dùng:

```typescript
prisma.$transaction()
```

hay transaction mechanism hiện tại.

Không để tình trạng:

```text
module completed
nhưng XP update fail
```

dẫn đến inconsistent state nếu domain yêu cầu atomicity.

---

# 55. Streak

Không tự triển khai thuật toán streak mới nếu backend đã có.

Nếu chưa có:

chỉ thiết kế integration point và đề xuất logic sau khi inspect database.

Timezone cần được xử lý phía server rõ ràng.

Không tính streak chỉ dựa trên clock của browser.

---

# 56. XP

XP là dữ liệu server-side.

Frontend không được tự làm:

```typescript
xp += 100;
```

và coi đó là source of truth.

Backend quyết định XP reward.

Frontend chỉ animate giá trị mới.

---

# 57. Badge

Badge phải gắn với completion/event thật từ backend.

Confetti/Badge popup là presentation layer.

Không được để user giả lập nhận badge chỉ bằng sửa local state.

---

# 58. Suggested Feature Architecture

Nếu phù hợp với structure hiện tại, ưu tiên:

```text
src/
└── features/
    └── learning-path/
        ├── components/
        │   ├── LearningPathMap
        │   ├── CourseNodeItem
        │   ├── CourseDetailModal
        │   ├── LearningStats
        │   └── LearningPathToast
        │
        ├── animations/
        │   ├── pathReveal
        │   ├── glowPulse
        │   ├── nodeUnlock
        │   └── cardHover
        │
        ├── hooks/
        │   ├── useLearningPath
        │   ├── usePathLayout
        │   └── useReducedMotion
        │
        ├── api/
        │   └── learningPathApi
        │
        ├── utils/
        │   ├── courseStatus
        │   └── pathGeometry
        │
        ├── types/
        │   └── learningPath.types
        │
        └── index
```

Nhưng đây chỉ là guideline.

Nếu repository hiện tại sử dụng:

```text
components/
pages/
services/
hooks/
utils/
```

thì follow structure đó.

Không ép repository thành feature-based architecture nếu sẽ gây refactor lớn.

---

# 59. Backend Architecture

Nếu backend hiện sử dụng pattern:

```text
routes
controllers
services
schemas
middleware
```

thì Learning Path cũng phải follow pattern này.

Ví dụ conceptual:

```text
src/Backend/
├── routes/
│   └── learningPath.routes
├── controllers/
│   └── learningPath.controller
├── services/
│   └── learningPath.service
└── schemas/
    └── learningPath.schema
```

Nhưng tên thật phải follow project convention.

---

# 60. Complete Data Flow

Architecture mong muốn:

```text
Supabase PostgreSQL
        ↓
Prisma ORM v7
        ↓
Node.js Service
        ↓
Express 5 Controller
        ↓
Express Route
        ↓
JWT middleware
        ↓
HTTP / JSON
        ↓
Axios instance
        ↓
TanStack React Query
        ↓
useLearningPath
        ↓
Adapter / derived state
        ↓
LearningPathMap
        ↓
CourseNodeItem
```

Không:

```text
React
 ↓
Prisma
```

Không:

```text
CourseNodeItem
 ↓
axios.patch(...)
```

Không:

```text
JSX
 ↓
database business logic
```

---

# 61. Testing

Pure functions phải unit-test được.

## courseStatus

Test:

```text
first unfinished course → current

first completed
→ second current

multiple completed
→ next available current

missing prerequisite
→ locked

progress > 100
→ 100

progress < 0
→ 0
```

## Geometry

Test:

```text
desktop alternates Y

mobile alternates X

positions.length === courses.length

segments.length === courses.length - 1

pathData contains no NaN

empty course list works

single node works
```

Không cài thêm Jest/Vitest nếu repository đã có test framework.

Dùng tooling hiện tại.

---

# 62. API Testing

Kiểm tra ít nhất:

```text
unauthenticated request

invalid payload

non-existing module

locked course

valid module completion

course completion

next course unlock
```

Authorization phải được test nếu project hiện có test infrastructure.

---

# 63. Production Build

Do project sử dụng CRA:

phải verify:

```bash
npm run build
```

hoặc script tương đương trong `package.json`.

Không chạy:

```bash
vite build
```

nếu project không dùng Vite.

Không thêm:

```text
vite.config.ts
```

---

# 64. GitHub Actions

Không phá CI/CD hiện tại.

Sau implementation, chạy các script hiện có tương đương:

```text
install
typecheck
lint
test
build
```

Không rewrite toàn bộ workflow GitHub Actions nếu không cần thiết.

Không upgrade React/Express/Prisma chỉ vì feature này.

---

# 65. Deployment Compatibility

Feature phải hoạt động trong architecture production:

```text
Browser
  ↓
Vercel React SPA
  ↓
HTTPS
  ↓
Render Express API
  ↓
Prisma adapter-pg
  ↓
Supabase PostgreSQL
```

Kiểm tra các vấn đề:

```text
API base URL
CORS
JWT
environment variables
production build
HashRouter
mixed content
network errors
loading states
```

---

# 66. Dependencies

Trước khi install:

```text
inspect package.json
```

Project đã có:

```text
gsap
@gsap/react
motion
lucide-react
```

Không install lại nếu đã tồn tại.

Nếu cần confetti và project chưa có:

```bash
npm install canvas-confetti
npm install -D @types/canvas-confetti
```

Không upgrade dependency không liên quan.

---

# 67. Definition of Done

Feature được xem là hoàn thành khi:

```text
✓ Render từ dữ liệu thật hoặc API abstraction
✓ Không hardcode business data trong JSX
✓ React Query quản lý server state
✓ Axios sử dụng infrastructure hiện tại
✓ Authentication tiếp tục qua AuthContext/JWT
✓ Desktop horizontal zigzag
✓ Mobile vertical zigzag
✓ SVG Bezier path chính xác
✓ Completed/current/locked rõ ràng
✓ Current node pulse
✓ Path reveal animation
✓ Card hover animation
✓ Locked node giải thích prerequisite
✓ Modal hoạt động
✓ Progress chính xác
✓ Current node auto-scroll
✓ Unlock timeline hoạt động
✓ Confetti chỉ chạy khi transition thật
✓ Reduced motion hoạt động
✓ Keyboard navigation hoạt động
✓ Accessibility hợp lý
✓ Không xung đột Motion và GSAP
✓ Không có GSAP memory leak
✓ Không console error
✓ Không TypeScript error
✓ Không phá HashRouter
✓ Không phá AuthContext
✓ Không phá React Query
✓ Express API hoạt động
✓ Zod validation hoạt động
✓ Prisma query hoạt động
✓ PostgreSQL state chính xác
✓ npm run build thành công
✓ GitHub Actions không fail
✓ Vercel frontend hoạt động
✓ Render API hoạt động
```

---

# 68. Acceptance Scenario

Giả sử server trả:

```text
CCNA 1 – ITN
100%

CCNA 2 – SRWE
45%

CCNA 3 – ENSA
0%
```

UI:

```text
ITN
✓ COMPLETED
     ╲
      ╲
       SRWE
       CURRENT
       45%
          ╲
           ╲
            ENSA
            LOCKED
```

User hoàn thành module cuối của SRWE.

Frontend:

```text
useMutation
```

gửi request tới Render.

Express:

```text
JWT validate
Zod validate
business validation
Prisma update
```

Database update thành công.

Backend response:

```json
{
  "courseProgress": 100,
  "courseCompleted": true,
  "unlockedCourseId": "ENSA"
}
```

Frontend cập nhật React Query cache.

Sau đó:

```text
SRWE
current → completed
```

và:

```text
ENSA
locked → current
```

GSAP timeline:

```text
SRWE burst
    ↓
Check icon
    ↓
small confetti
    ↓
path activates
    ↓
ENSA unlock
    ↓
ENSA glow pulse
```

Không refresh browser.

---

# 69. Implementation Order

Thực hiện theo thứ tự sau.

## Phase 1 — Repository Discovery

Inspect:

```text
package.json
src/
src/Backend/
Prisma schema
Roadmap page
routing
Axios
React Query
AuthContext
GSAP code
Motion code
CSS
API conventions
```

Không code trước khi hiểu các phần này.

---

## Phase 2 — Domain Mapping

Xác định:

```text
existing Course model
existing Module model
existing progress model
existing prerequisite logic
existing XP/streak/badge model
```

Map chúng vào Learning Path.

---

## Phase 3 — Pure Logic

Xây dựng hoặc adapt:

```text
types
course adapter
course status
path geometry
```

Pure functions trước.

---

## Phase 4 — Static Learning Path

Xây dựng:

```text
LearningStats
LearningPathMap
CourseNodeItem
CourseDetailModal
Toast
```

Đảm bảo UI hoạt động trước khi animation phức tạp.

---

## Phase 5 — Responsive Geometry

Hoàn thiện:

```text
desktop horizontal
tablet responsive
mobile vertical
```

Test không overlap.

---

## Phase 6 — React Query Integration

Kết nối:

```text
Axios
useQuery
useMutation
query cache
```

Không dùng fake data làm final implementation.

---

## Phase 7 — Backend Integration

Tích hợp:

```text
Express 5
JWT
Zod
Prisma v7
PostgreSQL
```

Đảm bảo prerequisite được validate phía server.

---

## Phase 8 — Animation

Thêm:

```text
GSAP path reveal
GSAP glow
GSAP unlock
GSAP hover
confetti
```

Không conflict với Motion.

---

## Phase 9 — Accessibility

Kiểm tra:

```text
keyboard
focus
screen reader
aria
dialog
progress
reduced motion
```

---

## Phase 10 — Verification

Chạy:

```text
lint
typecheck nếu có
tests
production build
```

Fix lỗi trước khi kết thúc.

---

# 70. Yêu cầu với Agent khi thực thi

Không chỉ đưa code snippet hoặc tutorial.

Hãy trực tiếp chỉnh sửa repository.

Không hỏi lại những thông tin có thể tự xác định bằng cách inspect source code.

Nếu project architecture thực tế khác giả định trong prompt:

**source code hiện tại là nguồn sự thật.**

Điều chỉnh implementation theo repository.

Không phá code đang hoạt động chỉ để làm implementation trông đẹp hơn.

Không đổi technology stack.

Không migrate CRA sang Vite.

Không migrate React 18 sang React 19.

Không đổi HashRouter.

Không đổi Express.

Không đổi PostgreSQL.

Không đổi Prisma.

Không chuyển backend sang Vercel Functions.

Không truy cập Supabase trực tiếp từ frontend.

Không thay React Query bằng Redux.

Không thay AuthContext nếu không có lý do kiến trúc thực sự cần thiết.

---

# 71. Báo cáo sau khi hoàn thành

Sau khi triển khai, trả về báo cáo theo format:

```text
1. Repository architecture discovered

2. Existing components/services reused

3. Files created

4. Files modified

5. Learning Path architecture

6. React Query integration

7. Axios/API integration

8. Express backend changes

9. Zod validation changes

10. Prisma/database changes

11. Authentication/authorization handling

12. GSAP animations implemented

13. Motion/GSAP conflict prevention

14. Responsive behavior

15. Accessibility improvements

16. Tests executed

17. Lint/typecheck result

18. Production build result

19. Remaining limitations or technical debt
```

Mỗi file thay đổi phải giải thích ngắn gọn lý do.

Nếu có command thất bại:

không được nói feature đã hoàn thành hoàn toàn.

Phải báo:

```text
command
error
probable cause
what was fixed
remaining issue
```

---

# 72. Mục tiêu cuối cùng

Biến Roadmap hiện tại của CCNA Master từ một trang hiển thị khóa học thông thường thành một:

# Interactive CCNA Learning Journey

Người học phải có cảm giác:

```text
START
  ↓
Learn Networking Fundamentals
  ↓
Master Switching & Routing
  ↓
Enterprise Networking
  ↓
Security
  ↓
Automation
  ↓
CCNA 200-301 READY
```

Gamification phải tạo động lực học nhưng vẫn giữ hình ảnh:

```text
Professional
Technical
Networking-focused
Modern
Premium
```

Feature cuối cùng phải phù hợp trực tiếp với ecosystem hiện tại:

```text
React 18
Create React App
HashRouter
React Query v5
Axios
AuthContext
Motion
GSAP
Xterm.js
SVG topology
Express 5
Zod
JWT
Prisma 7
PostgreSQL
Supabase
Render
Vercel
GitHub Actions
```

Ưu tiên cuối cùng:

```text
Correctness
→ Maintainability
→ Accessibility
→ Performance
→ Visual polish
→ Animation
```

Không hy sinh kiến trúc và tính đúng đắn chỉ để có animation đẹp.
