
# Đặc tả hệ thống Cisco CLI Lab trực tuyến

## 1. Tầm nhìn sản phẩm

Xây dựng một môi trường luyện tập cấu hình mạng theo hướng “LeetCode cho Cisco CLI”:

- Học viên chỉ cần trình duyệt, không phải cài Packet Tracer hoặc IOS image.
- Học viên gõ lệnh trên Router/Switch mô phỏng, nhận phản hồi cú pháp và trạng thái gần với Cisco IOS.
- Backend chấm điểm tự động dựa trên trạng thái cấu hình và hành vi mạng, không tin kết quả do client tự khai báo.
- Hệ thống mở rộng tuần tự từ một thiết bị đến topology nhiều thiết bị, routing, packet visualization và multiplayer.

“Chạy trên trình duyệt” trong tài liệu này nghĩa là trải nghiệm người dùng không cần cài phần mềm. Parser, simulation và grading có thể chạy trên backend.

## 2. Nguyên tắc kiến trúc

1. **Tương thích project hiện tại:** Phase 1 dùng React JavaScript, Express và Prisma/PostgreSQL đang có.
2. **Backend authoritative:** trạng thái attempt và điểm số chính thức nằm ở backend; frontend chỉ hiển thị và gửi lệnh.
3. **Declarative-first:** command profile, initial state và grading rubric dùng JSON để thêm bài/lệnh mà không sửa lõi.
4. **Semantic grading:** chấm theo ý nghĩa trạng thái, không diff nguyên văn toàn bộ running-config.
5. **Tương thích ngược:** Lab hướng dẫn và Lab Packet Tracer hiện tại tiếp tục hoạt động.
6. **Tách presentation:** GSAP chỉ trình diễn dữ liệu simulation, không quyết định state hoặc điểm.
7. **Mở rộng khi có nhu cầu:** chưa thêm FastAPI, Redis hoặc WebSocket vào Phase 1.

## 3. Kiến trúc Phase 1

```text
React hiện tại
├── Trang /labs và modal hướng dẫn hiện có
├── CLI workspace dùng xterm.js cho labType=CLI_SIMULATION
├── Sidebar nhiệm vụ, tiến độ và kết quả chấm
└── Command profile dùng cho Tab và trợ giúp ngữ cảnh
        │ REST /api/lab-attempts
Express hiện tại
├── Session/attempt controller
├── Declarative CLI parser
├── Single-device state engine
└── Deterministic semantic grader
        │ Prisma
PostgreSQL
├── Lab definition
├── LabAttempt
└── LabCommand history
```

REST đủ cho Phase 1: client xử lý phím và hiển thị terminal, backend xử lý mỗi lệnh Enter. WebSocket chỉ được cân nhắc từ Phase 2 khi có nhiều thiết bị hoặc sự kiện topology real-time.

## 4. Phạm vi Phase 1

### 4.1 Thiết bị và mode

- Một thiết bị cho mỗi attempt: `ROUTER` hoặc `SWITCH`.
- Mode bắt buộc:
  - User EXEC: `Router>`
  - Privileged EXEC: `Router#`
  - Global configuration: `Router(config)#`
  - Interface configuration: `Router(config-if)#`
  - VLAN configuration: `Switch(config-vlan)#`
- Hỗ trợ `enable`, `disable`, `configure terminal`, `exit`, `end`.

### 4.2 Hành vi parser

- Command tree khai báo trong JSON, không tạo chuỗi `if/else` riêng cho từng spelling.
- Prefix matching theo từng token: `conf t`, `sh ip int br`.
- Trả về lỗi ambiguous nếu prefix khớp nhiều nhánh.
- Trợ giúp ngữ cảnh bằng `?` và completion candidates cho Tab.
- Chỉ cho phép lệnh đúng mode.
- Trả về vị trí token lỗi để frontend đặt dấu `^`.
- Hỗ trợ `no` cho handler có khai báo `negatable: true`.
- Command profile Phase 1 có version cố định: `ccna-basic-v1`.

### 4.3 Tập lệnh Phase 1

- Điều hướng: `enable`, `disable`, `configure terminal`, `exit`, `end`.
- Cấu hình chung: `hostname`.
- Interface: `interface`, `ip address`, `shutdown`, `no shutdown`, `description`.
- VLAN/switchport: `vlan`, `name`, `switchport mode access`, `switchport access vlan`.
- Kiểm tra: `show running-config`, `show startup-config`, `show ip interface brief`, `show vlan brief`.
- Lưu cấu hình: `copy running-config startup-config`, `write memory`.
- Tiện ích terminal phía client: lịch sử Up/Down, Tab, `?`, Ctrl+L.

Phase 1 chưa mô phỏng packet, ping, static routing, OSPF, STP, ACL hoặc NAT.

## 5. Dữ liệu khai báo

### 5.1 Lab definition

Model `Lab` hiện tại được mở rộng, không tạo kho nội dung lab thứ hai:

```json
{
  "labType": "CLI_SIMULATION",
  "simulatorVersion": "1.0.0",
  "commandProfile": "ccna-basic-v1",
  "initialState": {
    "deviceType": "ROUTER",
    "hostname": "Router",
    "interfaces": ["GigabitEthernet0/0", "GigabitEthernet0/1"]
  },
  "gradingSpec": {
    "passingScore": 70,
    "checks": [
      {
        "id": "hostname",
        "type": "hostname_equals",
        "expected": "R1",
        "points": 20,
        "hint": "Dùng lệnh hostname trong global configuration mode."
      },
      {
        "id": "g0_0_ip",
        "type": "interface_ip_equals",
        "interface": "GigabitEthernet0/0",
        "expectedIp": "192.168.1.1",
        "expectedMask": "255.255.255.0",
        "points": 50
      },
      {
        "id": "g0_0_up",
        "type": "interface_enabled",
        "interface": "GigabitEthernet0/0",
        "points": 30
      }
    ]
  }
}
```

### 5.2 Attempt và command history

- `LabAttempt` lưu user, lab, status, device state, score, feedback, thời gian bắt đầu/nộp bài và version.
- `LabCommand` lưu tuần tự lệnh, mode/prompt trước khi chạy, output và trạng thái lỗi.
- Chỉ cho phép một attempt `IN_PROGRESS` đang hoạt động cho mỗi user/lab ở Phase 1.
- Command history là nền tảng cho Resume và Time Travel; Phase 1 mới cung cấp Resume.

## 6. API Phase 1

Tất cả endpoint attempt yêu cầu JWT:

```text
POST /api/lab-attempts/labs/:labId/start
GET  /api/lab-attempts/:attemptId
POST /api/lab-attempts/:attemptId/commands
GET  /api/lab-attempts/:attemptId/completions?input=...
POST /api/lab-attempts/:attemptId/submit
```

Quy tắc:

- `start` tạo attempt hoặc trả lại attempt `IN_PROGRESS` hiện có.
- `commands` validate input, khóa attempt theo user, cập nhật state và ghi history theo transaction.
- `completions` không thay đổi state.
- `submit` chạy deterministic grader trên state được lưu trong DB.
- Chỉ backend được đánh dấu `UserProgress` hoàn thành sau khi attempt đạt passing score.
- Giới hạn chiều dài lệnh, số lệnh mỗi attempt và rate limit theo user/IP.

## 7. Grading Engine

Phase 1 hỗ trợ các semantic check:

- `hostname_equals`
- `interface_exists`
- `interface_ip_equals`
- `interface_enabled`
- `interface_description_equals`
- `vlan_exists`
- `vlan_name_equals`
- `switchport_mode_equals`
- `switchport_access_vlan_equals`
- `startup_config_saved`

Mỗi check trả về `passed`, `pointsAwarded`, `expected`, `actual`, `message` và `hint`. Tổng điểm được chuẩn hóa về 100.

LLM không tham gia quyết định đúng/sai. Nếu thêm ở Phase 4, LLM chỉ diễn giải feedback deterministic; API key chỉ tồn tại ở backend và provider được cấu hình bằng biến môi trường trung lập.

## 8. UI/UX Phase 1

- Lab `GUIDED`/`PACKET_TRACER`: giữ nguyên modal và nút tải file.
- Lab `CLI_SIMULATION`: nút “Mở CLI Lab” đưa vào workspace terminal.
- Workspace gồm terminal, mục tiêu, danh sách nhiệm vụ, mode hiện tại và nút Nộp bài.
- Sau submit, hiển thị từng check đạt/chưa đạt và gợi ý; không tiết lộ lệnh đáp án hoàn chỉnh.
- Hỗ trợ bàn phím, focus rõ ràng, screen reader mode và responsive tối thiểu cho tablet; điện thoại được phép hiển thị khuyến nghị xoay ngang.
- Nội dung HTML từ admin phải được sanitize trước khi render.

## 9. Bảo mật và tính đúng đắn

- Không dùng `eval`, không chạy shell và không ánh xạ input đến tiến trình hệ điều hành.
- Parser chỉ thực thi handler đã đăng ký trong command profile.
- Validate `initialState` và `gradingSpec` bằng schema trước khi tạo/publish lab.
- Attempt luôn được truy vấn kèm `userId`; học viên không đọc/chạy attempt của người khác.
- Dùng transaction và sequence unique để tránh ghi trùng command khi client retry.
- Không nhận `score`, `passed` hoặc device state chính thức từ frontend.
- Sanitize rich-text hiện có trước khi dùng chung trong workspace.

## 10. Tiêu chí nghiệm thu Phase 1

1. Admin có thể tạo hoặc cập nhật một Lab `CLI_SIMULATION` với initial state và grading spec hợp lệ.
2. Học viên đăng nhập có thể bắt đầu, reload trang và tiếp tục attempt.
3. Parser vượt qua golden tests cho mode, exact/prefix/ambiguous, `?`, `no` và error position.
4. Ít nhất 20 spelling/câu lệnh trong tập Phase 1 hoạt động qua command tree.
5. `show` phản ánh state đã cấu hình; `copy running-config startup-config` lưu snapshot.
6. Submit cho kết quả deterministic và chỉ hoàn thành tiến độ khi đạt passing score.
7. Học viên không thể giả điểm hoặc thực thi attempt của người khác qua API.
8. Lab cũ, download Packet Tracer và đánh dấu tiến độ cũ không bị hỏng.
9. Backend unit tests, frontend build và Docker build chạy thành công.

## 11. Lộ trình sau Phase 1

| Phase | Phạm vi |
|---|---|
| Phase 2 | Topology nhiều thiết bị, link state, static route, ARP/MAC cơ bản, ping/traceroute theo đồ thị và animation gói tin |
| Phase 3 | OSPF single-area, STP, control-plane convergence và trực quan hóa theo tick |
| Phase 4 | LLM giải thích feedback, gamification, Time Travel UI và multiplayer; thêm WebSocket/Redis khi cần |
| Phase 5 | NAT, ACL nâng cao, packet-level chi tiết, performance/load testing và horizontal scaling |

Python/NetworkX chỉ được tách thành simulation service khi Phase 2/3 chứng minh Express engine không còn phù hợp. Redis chỉ được thêm khi có nhiều backend instance, multiplayer hoặc benchmark cho thấy PostgreSQL không đáp ứng session nóng.

## 12. Trạng thái triển khai

- [x] Đặc tả được điều chỉnh theo project hiện tại.
- [x] Prisma models cho CLI Lab Phase 1.
- [x] Declarative parser, state engine và grading engine.
- [x] Attempt API và authorization.
- [x] xterm.js workspace tích hợp `/labs`.
- [x] Admin input tối thiểu cho simulation/grading JSON.
- [x] Unit test, frontend build và Docker smoke test.

## 13. Bản triển khai Phase 2–5 (2026-09-06)

Các tính năng dưới đây dùng `ccna-network-v2` / simulator `2.0.0`. Lab một thiết bị tiếp tục dùng `ccna-basic-v1`. Đây là mô hình CCNA ở mức giáo dục, với phạm vi cụ thể dưới đây để viết đề phù hợp.

### Phase 2: topology và data plane

- Admin có editor thêm/xóa/kéo Router, Switch, PC, chọn cổng nối dây. Tối đa 24 thiết bị, 24 cổng/thiết bị và 96 dây; một cổng vật lý chỉ nối một dây.
- `initialState` topology có `devices: [{id, deviceType, hostname, interfaces, position}]` và `links: [{id, a: {deviceId, interface}, b: {deviceId, interface}, enabled}]`. Mẫu có sẵn trong `src/data/networkLabTemplates.js` và nút dùng mẫu trong Admin.
- Chọn từng thiết bị để gõ CLI; state/mode riêng từng thiết bị. PC dùng các lệnh cấu hình IPv4/gateway đơn giản trong CLI mô phỏng.
- Static route chọn longest prefix, rồi administrative distance/cost. Next hop phải trực tiếp reachable; chưa có recursive static route.
- `ping` mô phỏng một request và reply, kiểm tra đủ hai chiều. `traceroute` tăng TTL từng probe và hiển thị router nơi TTL hết; chưa mô phỏng đường về của thông báo ICMP time-exceeded riêng.
- Trace ghi ARP, Ethernet frame, VLAN, MAC, route, TTL, ACL, NAT, điểm drop. ARP/MAC aging sau 30 tick. Switch học source MAC; chuyển frame theo L2 path đã kiểm tra VLAN/STP, chưa mô phỏng toàn bộ quá trình flood frame tới mọi nhánh.
- UI vẽ đường dây, trạng thái và packet animation; có gửi probe ICMP/TCP/UDP, tick và ngắt/nối lại dây.

### Phase 3: control plane

- `router ospf <process>`, `network <ip> <wildcard> area 0`, `router-id`, `ip ospf cost`.
- Adjacency yêu cầu cùng subnet/mask, area 0, L2 reachable và router ID không trùng nếu đã cấu hình. Mỗi tick hiển thị INIT → EXCHANGE → FULL; sau hai tick SPF cài route OSPF và rút route khi mất adjacency.
- SPF dùng cost có trọng số; chưa mô phỏng DR/BDR, LSA wire format, retransmit, authentication, multi-area, ECMP hay thời gian IOS thực.
- STP theo VLAN: bridge priority, tie-break device ID ổn định, root/designated/blocking ports; link cost đồng nhất, tính lại cây khi cấu hình/link thay đổi. Chưa có BPDU timer, RSTP/MST hoặc root-port cost cấu hình riêng.
- `show ip route`, `show ip ospf neighbor`, `show spanning-tree`, `show arp`, `show mac address-table` phản ánh state.

### Phase 4: học tập và cộng tác

- Snapshot đề và rubric ngay khi tạo attempt; chỉnh đề sau đó không làm đổi cách chấm phiên đang làm.
- Replay event log theo sequence, chỉ đọc; không thay đổi state đang làm hoặc điểm. Attempt cũ không có snapshot sẽ báo không hỗ trợ replay.
- Chủ phiên thêm/gỡ ID tài khoản (tối đa 7 bạn học). Thành viên gõ lệnh chung; chỉ chủ phiên nộp bài và nhận tiến độ/điểm. Polling 3 giây, dừng khi tab bị ẩn. Command/action dùng PostgreSQL transaction lock và `expectedRevision` với HTTP 409; submit, member và restart dùng cùng lock rồi kiểm tra trạng thái/quyền.
- Điểm là tổng điểm tốt nhất trên từng lab đã đạt, badge theo số lab, streak theo ngày Asia/Ho_Chi_Minh. Không cộng điểm nhiều lần khi làm lại cùng bài.
- Nút giải thích dùng feedback deterministic. Có thể bật LLM bằng `LAB_AI_URL`, `LAB_AI_KEY`, `LAB_AI_MODEL` ở backend (endpoint tương thích chat-completions). Provider không quyết định điểm; timeout/lỗi tự trả lại giải thích deterministic. Kiểm thử provider bằng mock; chưa gọi provider thật khi chưa có cấu hình.

### Phase 5: ACL, NAT và vận hành

- Named extended ACL: `ip access-list extended NAME`, `permit|deny ip|icmp|tcp|udp <source> <destination> [eq port]`; địa chỉ hỗ trợ `any`, `host IP`, `IP wildcard`. Rule chạy theo thứ tự, implicit deny cuối ACL, gắn `ip access-group NAME in|out` vào interface. Chưa có log/counter theo rule, source-port operators, established, time-range hoặc IPv6 ACL.
- Static NAT: `ip nat inside source static LOCAL GLOBAL`; PAT: `ip nat inside source list ACL interface IFACE overload`; interface gắn `ip nat inside|outside`. Reverse mapping kiểm tra tuple và remote IP, PAT aging sau 60 tick, tối đa 256 translations. Không có NAT pool, hairpin hoặc ALG.
- TCP/UDP probe kiểm tra forwarding và port/ACL/NAT, chưa mô phỏng TCP handshake, retransmission, fragmentation hoặc payload byte-level.
- Semantic checks mới: `reachable`, `route_exists`, `ospf_neighbor_full`, `stp_root`, `acl_exists`, `nat_static_exists`; mọi check topology chỉ rõ `deviceId`. Hai check `acl_exists`/`nat_static_exists` kiểm tra cấu hình; nên kết hợp `reachable` khi đề cần kiểm tra hành vi mạng.
- `compose.scale.yaml` chạy hai backend, dùng cùng PostgreSQL và uploads volume; Nginx cân bằng request. Schema đồng bộ một lần trước khi scale; replica khởi động server trực tiếp. Rate limit chung ở Nginx, lock/state/replay dùng DB. Khi đổi số replica cần recreate frontend để Nginx resolve lại danh sách backend.
- Cấu hình scale phục vụ nhiều container trên một Docker host. Triển khai nhiều host cần shared uploads/object storage, TLS, DB backup và benchmark trên hạ tầng đích; không suy ra năng lực production từ benchmark local.

### API bổ sung

```text
GET  /api/lab-attempts/achievements
POST /api/lab-attempts/:id/actions    {action, expectedRevision}
GET  /api/lab-attempts/:id?deviceId=R1&after=SEQUENCE
GET  /api/lab-attempts/:id/replay?sequence=N
POST /api/lab-attempts/:id/members    {userId, remove}
POST /api/lab-attempts/:id/explain
POST /api/lab-attempts/:id/restart
```

Action gồm `command`, `tick`, `link`, `probe`. `command`/`probe` chỉ rõ `deviceId`. Mọi action ghi giới hạn 500 event/attempt, command dài tối đa 500 ký tự; state, score và actor được xác định ở backend. Chủ phiên có thể restart attempt đang `IN_PROGRESS`; phiên cũ chuyển `FAILED`, lịch sử được giữ lại và `start` mở phiên mới. API tiến độ thông thường từ chối cập nhật CLI Lab để không bỏ qua grader.

### Kiểm chứng và tài liệu tham khảo

- `npm run test:cli`: engine, validation, quyền truy cập và adapter feedback; bài integration được bật riêng bằng `LAB_INTEGRATION=1`.
- `npm test -- --watch=false --runInBand --runTestsByPath src/components/Content/NetworkLab.test.js`: editor, chọn node bằng bàn phím, device/revision, replay read-only, Escape.
- `npm run bench:cli`: 24 node/23 link, 500 request/reply; phép đo local ngày 2026-09-08 đạt p50 0,875 ms, p95 1,770 ms, max 8,551 ms, RSS 56 MiB.
- PostgreSQL/HTTP integration trên một backend đạt 46/46; 40 đọc đồng thời có p50 250,1 ms, p95 270,4 ms, max 271,4 ms, 0 lỗi và RSS 169,5 MiB.
- Cùng suite qua hai backend dùng chung DB đạt 46/46; 40 đọc có p50 182,0 ms, p95 205,3 ms, max 207,6 ms, 0 lỗi và RSS test runner 195,6 MiB. Nginx chia 20 probe thành 10/10 và trả 15 HTTP 429 trong burst 40 request vào route được giới hạn.
- Các phép đo trên là benchmark Docker local có warm cache và request logging; dùng làm mốc hồi quy, không suy ra năng lực production.
- Chưa kiểm tra trực quan bằng Browser do môi trường không cung cấp browser; đã có component tests và production build.
- Cơ sở tham khảo: [OSPF v2 RFC 2328](https://www.rfc-editor.org/rfc/rfc2328.html), [Cisco IOS NAT configuration](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/ipaddr_nat/configuration/xe-2/nat-xe-2-book/iadnat-addr-consv.html). Phạm vi mô phỏng ở trên là giới hạn của implementation trong project.
