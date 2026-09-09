# Cisco Lab UI: thiết kế, dữ liệu và nghiệm thu

Tài liệu cho `prompt-thiet-ke-lai-ui-lab-cisco.md`. Checklist triển khai, bằng chứng kiểm thử và điểm review nằm ở phần “Thiết kế lại UI lab Cisco” đầu `todo.md`.

## Ranh giới component và state

| Thành phần | Đầu vào chính | Trách nhiệm |
| --- | --- | --- |
| `CliLabWorkspace` | `lab`, `onClose`, `onPassed`, `onNotify`, tùy chọn `preview` | Điều phối phiên, device đang chọn, snapshot replay, tiến độ, hint, công cụ và các panel phụ. |
| `NetworkTopology` | `devices`, `links`, `selected`, `onSelect`, `packet`, tùy chọn callback link/drag | Render sơ đồ; sự kiện chọn node/dây; animation theo hop. Không tự sửa state phiên. |
| `CliTerminal` | `prompt`, `history`, `disabled`, `onCommand`, `onComplete` | Quản lý xterm và input; gửi lệnh thông qua callback của workspace. |
| `CliLabConfigEditor` | Draft initial-state/grading-spec, command profile và callback thay đổi | Chọn chế độ form/JSON, validate draft, chọn template và theme cho trình soạn lab. |
| `GradingSpecBuilder` | `value`, `initialState`, `onChange` | Card tiêu chí, field theo check type, tham chiếu thiết bị/cổng, tổng điểm. |
| `InitialStateBuilder` | Initial state và callback thay đổi | Form thiết bị/interface, topology và các liên kết. |
| Shared schema/catalog | JSON và profile | Cùng quy tắc ở browser và API; chỉ liệt kê khả năng engine thực sự hỗ trợ. |

`attempt.state` là snapshot server mới nhất. `replay.state` thay thế dữ liệu hiển thị khi xem lịch sử, không ghi đè snapshot trực tiếp. `deviceId` là nguồn chung để chọn node, lấy hostname/mode tạo prompt, lọc history và tìm nhiệm vụ chưa hoàn thành gần nhất trên thiết bị đó. Nhiệm vụ của thiết bị khác phải nêu rõ thiết bị cần chuyển tới.

Sau một action hợp lệ, client nhận state/revision và `progress` cùng phản hồi. Refresh phiên và replay cũng nhận progress tính theo đúng snapshot. Progress không tự ghi điểm, hoàn thành khóa học hay thành tích; các quyền này vẫn thuộc endpoint submit của chủ phiên.

`src/css/CliLabTokens.css` định nghĩa chung `--surface-*`, `--text-*`, `--border-*`, `--bg-accent`, spacing và radius. `LabWorkspace.css` và `Admin/CliLabEditor.css` dùng alias theo component; cả sơ đồ admin lẫn preview đổi màu theo cùng palette. Theme chỉ áp dụng trong hai vùng lab, không đổi giao diện các trang khác.

## Hợp đồng TypeScript minh họa

Repository dùng React JavaScript. Ví dụ dưới đây biểu diễn kiểu dữ liệu/props để tích hợp hoặc chuyển từng component sang TypeScript sau này; không yêu cầu đổi CRA/toolchain cho task UI này.

```tsx
type TaskStatus = 'not_started' | 'in_progress' | 'completed';
type Task = {
  id: string;
  title: string;
  points: number;
  deviceId?: string;
  type?: string;
  interface?: string;
  hint?: string;
};
type Progress = {
  completed: number;
  total: number;
  nextTaskId: string | null;
  checks: Array<{ id: string; passed: boolean; status: TaskStatus }>;
};
type LinkEndpoint = { deviceId: string; interface: string };
type Link = {
  id: string;
  a: LinkEndpoint;
  b: LinkEndpoint;
  enabled?: boolean;
};
type Port = string | {
  name: string;
  shutdown?: boolean;
  ipAddress?: string | null;
  subnetMask?: string | null;
  description?: string;
  switchportMode?: 'access' | 'trunk' | null;
  accessVlan?: number | null;
};
type DeviceDefinition = {
  deviceType: 'ROUTER' | 'SWITCH' | 'PC';
  hostname?: string;
  interfaces: Port[];
};
type InitialState = DeviceDefinition | {
  devices: Array<DeviceDefinition & { id: string; position?: { x: number; y: number } }>;
  links: Link[];
};
type CheckMeta = {
  id: string; points: number; title?: string;
  hint?: string; message?: string; successMessage?: string;
};
// Hai ví dụ của discriminated union đầy đủ trong shared Zod schema.
type ExampleCheck = CheckMeta & (
  | { type: 'reachable'; deviceId: string; destination: string }
  | { type: 'interface_ip_equals'; deviceId?: string; interface: string;
      expectedIp: string; expectedMask: string }
);
type ExampleGradingSpec = { passingScore?: number; checks: ExampleCheck[] };

function PreviewExample({ initialState, gradingSpec, close }: {
  initialState: InitialState;
  gradingSpec: ExampleGradingSpec;
  close: () => void;
}) {
  return <CliLabWorkspace
    lab={{ title: 'Kiểm tra kết nối', objective: 'Cấu hình theo nhiệm vụ' }}
    preview={{ initialState, gradingSpec }}
    onClose={close}
  />;
}
```

Trong phiên học viên, API tasks/progress không gửi `expected`, `expectedIp`, `expectedMask`, `actual` hoặc toàn bộ grading spec. Hint do admin viết là nội dung hướng dẫn được phép hiển thị. Feedback sau lần nộp vẫn theo cơ chế chấm hiện hữu.

## Ánh xạ Grading Spec hai chiều

Mỗi card giữ nguyên `id` và các field chung `title`, `points`, `hint`, `message`, `successMessage`. `passingScore` là ngưỡng phần trăm; tổng điểm card là tổng trọng số, không bắt buộc bằng 100. Điểm chuẩn hóa = làm tròn `100 × điểm đạt / tổng trọng số`.

| Loại check | Field riêng |
| --- | --- |
| `hostname_equals` | `expected` |
| `interface_exists`, `interface_enabled` | `interface` |
| `interface_ip_equals` | `interface`, `expectedIp`, `expectedMask` |
| `interface_description_equals` | `interface`, `expected` |
| `vlan_exists` | `vlanId` |
| `vlan_name_equals` | `vlanId`, `expected` |
| `switchport_mode_equals` | `interface`, `expected` = access/trunk |
| `switchport_access_vlan_equals` | `interface`, `expected` = VLAN ID |
| `startup_config_saved` | Không có field riêng |
| `reachable`, `route_exists` | `destination` |
| `ospf_neighbor_full` | `neighborId` |
| `stp_root` | `vlanId` |
| `acl_exists` | `name` |
| `nat_static_exists` | `expectedIp` = local, `destination` = global |

Topology bắt buộc `deviceId` hợp lệ trên mọi check. Lab một thiết bị không cần ID giả trong JSON. Dropdown thiết bị/interface/neighbor lấy danh sách từ draft initial-state; schema vẫn kiểm tra lại mọi tham chiếu trước khi lưu.

## Ánh xạ Initial State và JSON nâng cao

- Một thiết bị giữ dạng `{deviceType, hostname?, interfaces}`; nhiều thiết bị giữ `{devices, links}`. Profile tương ứng là `ccna-basic-v1` hoặc `ccna-network-v2`.
- Checkbox bật cổng ánh xạ đảo với `shutdown`: bật = false, tắt = true. Khi JSON chỉ chứa tên interface hoặc bỏ `shutdown`, form phải phản ánh mặc định engine theo device type, không tự đổi khi chỉnh field khác.
- Giữ tên interface dạng string nếu chưa sửa; khi cần cấu hình riêng, chuyển đúng cổng đó thành object. Không thay đổi các cổng khác hoặc field không được chỉnh.
- Khi sửa form, tuần tự hóa draft thành JSON. Khi sửa JSON, giữ cả văn bản thô và lỗi; chỉ đưa vào builder khi dữ liệu đã parse/validate được. Không khôi phục template hoặc xóa văn bản lỗi tự động.
- Tách lỗi cấu trúc khỏi lỗi field đang nhập: `devices: [null]` không được render thành device card, nhưng IP đã nhập mà mask còn trống phải giữ form để người dùng nhập tiếp. Chỉ chặn save/preview, không tự nhảy sang JSON vì field chưa hoàn tất.
- Schema dùng allowlist field/check type để phát hiện trường lạ và type sai. JSON lỗi, profile sai, reference hỏng phải chặn save/preview; lỗi nêu field/path thay vì chỉ báo “JSON không hợp lệ”.
- Template là thao tác áp dụng initial-state + grading-spec + profile cùng nhau. Preview nhận snapshot độc lập; thao tác CLI trong preview không sửa draft gốc.

## Animation và khả năng tiếp cận

MotionPath chạy theo các hop có trong packet trace của engine, dùng identity của action để phân biệt hai lần ping giống nhau và tránh phát lại khi polling. SVG marker dùng cùng hệ tọa độ với topology. GSAP timeline phải cleanup khi đổi packet/unmount, tôn trọng reduced-motion; lỗi CLI và completion chỉ animate theo sự kiện mới.

Ví dụ React + TypeScript cho một hop SVG, với marker gốc `cx=0`, `cy=0`:

```tsx
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/dist/MotionPathPlugin';
gsap.registerPlugin(MotionPathPlugin);

function PacketHop({ eventId, from, to }: {
  eventId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}) {
  const marker = useRef<SVGCircleElement>(null);
  const path = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  useEffect(() => {
    if (!marker.current) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(marker.current,
        { autoAlpha: 1 },
        { duration: 0.5, motionPath: { path },
          onComplete: () => { gsap.set(marker.current, { autoAlpha: 0 }); } });
    });
    return () => media.revert();
  }, [eventId, path]);
  return <circle ref={marker} cx={0} cy={0} r={8} visibility="hidden" />;
}
```

Tham khảo API: [GSAP MotionPathPlugin](https://gsap.com/docs/v3/Plugins/MotionPathPlugin/). Component thật xử lý cả chuỗi hop, thay đổi phiên và trạng thái reduced-motion.

Node và dây hỗ trợ bàn phím. Replay vẫn cho chọn thiết bị để đọc terminal/history, nhưng chặn thao tác thay đổi mạng. Các control trong accordion đóng không thuộc vòng Tab. Onboarding có bỏ qua và mở lại; tooltip không phải nguồn duy nhất để đọc nhiệm vụ hoặc lỗi.

Escape đóng lớp đang tương tác theo thứ tự onboarding, panel phụ, workspace. Sự kiện Escape được bắt ở capture để xterm không nuốt mất; Tab trong terminal vẫn phục vụ hoàn thành lệnh. Focus trap lọc control không hiển thị và trả focus khi đóng lớp phủ.

## Cách kiểm chứng

Test component xác minh state/API contract và form round-trip. Test Node xác minh schema/progress/grader. Integration chạy PostgreSQL tạm để kiểm tra HTTP, quyền owner/member, concurrency, replay và điểm. Browser review render component thật với fixture cô lập để kiểm tra light/dark, xterm, animation, form và preview; fixture browser không được coi là chứng cứ đăng nhập/OAuth hoặc deploy thật.

Kết quả cuối cùng và mọi tiêu chí chưa kiểm tra phải ghi riêng trong `todo.md`, không suy ra “đạt” chỉ từ build thành công.
