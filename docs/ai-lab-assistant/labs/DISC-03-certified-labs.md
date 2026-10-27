# DISC-03 - Chuẩn bị và kiểm tra ba bài lab mẫu

[Kế hoạch](../README.md) · [Backlog](../03-delivery-backlog.md) · [Vấn đề nguồn](DISC-03-source-issues.md) · [Fixtures public](../../../src/agent/python/evals/fixtures/disc-03/README.md)

**Ngày nghiệm thu:** 19/10/2026. **Trạng thái:** đã kiểm kỹ thuật ba lab mẫu dựng riêng trên máy, dùng profile `ccna-network-v2`, simulator `2.1.0`. Các ID dưới đây thuộc dữ liệu kiểm thử (`fixtures`), chưa là bài lab trong database và chưa phát hành cho học viên.

Task này tạo **ba bài lab có kết quả đã biết trước**, để sau đó kiểm hệ thống chẩn đoán và AI. Mỗi bài có hai cấu hình đúng, sáu tình huống lỗi và cách sửa đã chạy qua simulator/bộ chấm thật. “Golden actions” bên dưới là chuỗi lệnh giải mẫu; “grader” là bộ chấm; “probe” là thao tác kiểm kết nối/trạng thái.

Ví dụ, ping thất bại vì thiếu đường về phải được nhận ra là lỗi. Ngược lại, cổng không dùng đang shutdown hoặc default route hợp lệ không được chấm sai. Bộ lab có các ca này để kiểm tra.

DISC-02 đã bỏ qua theo yêu cầu, nên việc chọn lab dựa trên phạm vi R1 và khả năng simulator hiện có. Chưa nghiên cứu học viên hoặc có reviewer CCNA độc lập; kết quả kỹ thuật dưới đây chưa đánh giá chất lượng câu trả lời AI.

**Cập nhật 26/10/2026:** [SIM-01](../baseline/SIM-01-diagnostics.md) đã dùng cả 24 ca đúng/lỗi bên dưới để kiểm bộ chẩn đoán Node; ca lỗi sau sửa trở lại kết nối thành công. Có thêm kiểm mơ hồ/unsupported và không mutate state/điểm. Đây vẫn là dữ liệu phát triển chung, chưa là bộ đánh giá độc lập hoặc bằng chứng chất lượng model thật.

## 1. Ba lab được chọn

| ID            | Mục tiêu công khai                                                                     | Nguồn tham khảo và điều chỉnh                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AI-IPV4-01`  | Cấu hình IPv4, subnet mask và bật hai interface của router; hai PC liên lạc hai chiều  | Phần cấu hình interface của `LAB-ARP-Proxy-ARP.pdf`, trang 1. Rút thành PC1 - R1 - PC2; dùng interface vật lý, không chứng nhận Proxy ARP                    |
| `AI-ROUTE-01` | Static/default route đúng chiều đi và về, hiểu route cụ thể ưu tiên hơn route bao quát | `LAB-Static-Route-AD.pdf`, trang 1-3; default route tham khảo `LAB-RIP02.pdf`, trang 1. Rút thành hai router, hai LAN; không chứng nhận floating AD hoặc RIP |
| `AI-VLAN-01`  | Access VLAN 10/20 và trunk giữa hai switch; cùng VLAN kết nối, khác VLAN cách ly       | Yêu cầu VLAN/trunk của `LAB-Virtual-HSRP.pdf`, trang 1. Tự dựng hai switch và bốn PC để tách riêng Layer 2; không chứng nhận HSRP/NAT                        |

Ba bài mới phủ ba nhóm P0/R1: IPv4, route và VLAN. `LAB-EIGRP01.pdf` có lab/test riêng trong source nhưng không thay nhóm VLAN hoặc IPv4 của bộ này.

Những phần cần khả năng khác để làm sau: EIGRP03/04 có redistribution, route filtering/authentication; RIP01/02/03 có RIP; Virtual có DHCP/subinterface; Virtual-NAT-ACL có NAT/ACL. Chỉ đưa vào khi đã kiểm simulator hỗ trợ. Đã đọc text của 11 PDF người dùng cung cấp; sáu trang dùng trực tiếp trong bảng đã được dựng ảnh để đọc sơ đồ mạng.

Lệnh trong PDF là tài liệu tham khảo. Bộ thử dùng địa chỉ mẫu `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/30`, không lấy cấu hình/dữ liệu học viên thật. Các chỗ địa chỉ trong hình và hướng dẫn không khớp được ghi ở [danh sách vấn đề nguồn](DISC-03-source-issues.md).

## 2. Nguồn và phiên bản

PDF gốc ở `D:/CCNA` của người dùng, không chép PDF/ảnh vào repo. Dấu kiểm SHA-256 bên dưới giúp xác nhận đúng bản tài liệu đã đọc, tránh nhầm khi file nguồn thay đổi:

| PDF                       | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `LAB-ARP-Proxy-ARP.pdf`   | `229d8d46179c2e09d435cc1f50f049ee1f5cb0979d2608a08a7399c1c6e81c5e` |
| `LAB-Static-Route-AD.pdf` | `19c0bb04c77614e0c75fa4b698535331b3b9ffede4cb0441204f5aa9320430e9` |
| `LAB-RIP02.pdf`           | `57f18cf00e9fc1c1641931056172c4268c84b123a2631822a44ddabd83b89be6` |
| `LAB-Virtual-HSRP.pdf`    | `19de3e01ad96fce1f5708b2ce71c8e4af9f164a2c9c5525077997643ab23a503` |

Định nghĩa lab, điều kiện chấm và lời giải mẫu ở [disc03.js](../../../src/agent/fixtures/labs/disc03.js). [aiLabCertification.test.js](../../../src/agent/tests/aiLabCertification.test.js) chạy engine/bộ chấm thật. Đổi engine, tập lệnh được hỗ trợ, lab hoặc bộ chấm thì phải chạy lại và sinh lại dữ liệu mẫu công khai.

## 3. AI-IPV4-01

```text
PC1 192.0.2.10/24 -- R1 G0/0 192.0.2.1/24
                         G0/1 198.51.100.1/24 -- PC2 198.51.100.10/24
                         G0/3: không cắm cáp
```

Người học cần biết IP/mask/default gateway, chế độ CLI và `show ip interface brief`. PC đã có gateway; R1 ban đầu chưa có IP và hai cổng cần dùng đang shutdown. Mục tiêu là đặt đúng hai IP/mask trên, bật hai cổng, lưu cấu hình và ping hai chiều. G0/3 không nằm trên đường đi nên không bắt buộc bật.

Lời giải mẫu cấu hình hai interface, thoát mode đúng chỗ và lưu R1. Bộ chấm có 7 kiểm tra IP/mask, trạng thái cổng, khả năng kết nối và lưu cấu hình; lời giải đạt 100. Hai cấu hình đúng khác nhau ở trạng thái bật/tắt cổng không cắm cáp, vẫn giữ đường kết nối cần dùng.

| Case ID   | Loại | Điều cần chứng minh                                             |
| --------- | ---- | --------------------------------------------------------------- |
| `ipv4-01` | Đúng | Cổng unused shutdown không cản kết nối và không bị chấm lỗi     |
| `ipv4-02` | Đúng | Cổng unused được bật nhưng không cắm cáp cũng không cản kết nối |
| `ipv4-03` | Lỗi  | Shutdown cổng router phía nguồn làm mất kết nối                 |
| `ipv4-04` | Lỗi  | Shutdown cổng router phía đích làm mất kết nối                  |
| `ipv4-05` | Lỗi  | Địa chỉ router không còn trùng gateway đã cho của PC            |
| `ipv4-06` | Lỗi  | Mask /30 trên router loại PC khỏi connected subnet              |
| `ipv4-07` | Lỗi  | Interface LAN đích chưa có địa chỉ IP                           |
| `ipv4-08` | Lỗi  | Cáp trên đường cần dùng bị ngắt dù cấu hình IP đúng             |

## 4. AI-ROUTE-01

```text
PC1 -- R1 G0/0 192.0.2.1/24
       R1 G0/1 203.0.113.1/30 -- R2 G0/0 203.0.113.2/30
                               R2 G0/1 198.51.100.1/24 -- PC2
```

PC1/PC2 giữ địa chỉ/gateway như bài IPv4. Các interface ban đầu đúng cấu hình và đang up; router chưa có static route. Người học cần biết connected route, next hop, quy tắc ưu tiên route khớp dài nhất và đường về. Có thể dùng route cụ thể hoặc default route miễn gói đi/về được; không bắt buộc một chuỗi lệnh duy nhất.

Lời giải mẫu thêm static route tới LAN xa trên mỗi router. Bộ chấm có 4 kiểm tra route/kết nối hai chiều; đạt 100. Cấu hình đúng thứ hai bỏ route cụ thể, dùng default route ở cả hai router. Test kiểm mỗi bảng thực sự chỉ có một static default và dấu vết đường đi có dùng default đó.

| Case ID    | Loại | Điều cần chứng minh                                              |
| ---------- | ---- | ---------------------------------------------------------------- |
| `route-01` | Đúng | Hai static route cụ thể cho đường đi/về                          |
| `route-02` | Đúng | Hai default route hợp lệ, không bị chấm thiếu route              |
| `route-03` | Lỗi  | Thiếu route phía đi                                              |
| `route-04` | Lỗi  | Request tới đích nhưng thiếu route về; không báo ping thành công |
| `route-05` | Lỗi  | Next hop ngoài connected subnet không tạo đường dùng được        |
| `route-06` | Lỗi  | Route /32 sai đè route /24 đúng; chỉ có route tồn tại chưa đủ    |
| `route-07` | Lỗi  | Transit interface shutdown làm mất route dùng được               |
| `route-08` | Lỗi  | Transit interface bị đặt sang subnet /30 khác                    |

## 5. AI-VLAN-01

```text
PC1 VLAN10 -- S1 G0/1                 S2 G0/1 -- PC2 VLAN10
PC3 VLAN20 -- S1 G0/2                 S2 G0/2 -- PC4 VLAN20
              S1 G0/24 === trunk === S2 G0/24
```

VLAN 10: PC1 `192.0.2.10/24`, PC2 `192.0.2.11/24`. VLAN 20: PC3 `198.51.100.10/24`, PC4 `198.51.100.11/24`. Không có router/gateway nối giữa VLAN. Người học cần biết broadcast domain, access/trunk và `show vlan brief`. Ban đầu switch chỉ có VLAN 1.

Lời giải mẫu tạo VLAN, gán access port, đặt trunk rồi lưu cả hai switch. Bộ chấm có 18 kiểm tra VLAN/mode/cổng thuộc VLAN nào/trunk/lưu/kết nối; đạt 100. Hai cấu hình đúng khác tên VLAN và cách gán cổng không dùng; mục tiêu không bắt các giá trị tùy chọn này.

| Case ID   | Loại | Điều cần chứng minh                                                 |
| --------- | ---- | ------------------------------------------------------------------- |
| `vlan-01` | Đúng | Hai VLAN đi qua trunk, các cổng unused shutdown                     |
| `vlan-02` | Đúng | Tên VLAN và membership của cổng unused có thể thay đổi              |
| `vlan-03` | Lỗi  | Access port VLAN 10 bị gán sang VLAN 20; VLAN 20 đang đúng vẫn chạy |
| `vlan-04` | Lỗi  | Uplink S1 đặt nhầm access VLAN 1                                    |
| `vlan-05` | Lỗi  | Uplink S2 đặt nhầm access VLAN 1                                    |
| `vlan-06` | Lỗi  | Trunk bị shutdown                                                   |
| `vlan-07` | Lỗi  | Access port VLAN 20 shutdown; câu hỏi trỏ PC3-PC4, VLAN 10 vẫn chạy |
| `vlan-08` | Lỗi  | Cáp trunk bị ngắt                                                   |

Để chắc hai VLAN thực sự cách ly ở Layer 2, test kiểm `layer2Path` giữa VLAN 10/20 là `null`. Sau đó trên bản sao, đổi một host ở VLAN khác sang cùng subnet và kiểm vẫn không kết nối được. Nhờ vậy không kết luận cách ly chỉ vì thiếu route giữa hai subnet.

## 6. Ranh giới public/private và khả năng tái lập

- Đáp án chấm (`rubric`), `goldenActions`, `repairActions`, `failedChecks`, nhãn đúng/lỗi và kết quả dùng đối chiếu (`oracle`) ở **backend fixtures**. Thư mục thử provider chỉ có mục tiêu/giới hạn công khai, ID không nói lộ đáp án, câu hỏi trung tính và các trường interface/VLAN/route/link được chọn trước.
- [publicFixture.js](../../../src/agent/fixtures/labs/publicFixture.js) xuất dữ liệu mẫu DISC-03, chưa thay cho bộ lọc dữ liệu thật BE-05. Các dấu thử (`canary`) trong đáp án ẩn, metadata case, actor/credential không được xuất. Cũng không xuất startup config và chuỗi lệnh giải/sửa mẫu.
- Mỗi tình huống được dựng lại từ trạng thái ban đầu bằng lời giải mẫu, sau đó mới thêm lỗi/biến thể. Test kiểm bản chụp đầu vào không đổi, điểm không đổi sau khi xem trạng thái, thử kết nối trên bản sao và sửa đúng lỗi thì về 100 cùng các kiểm tra kết nối yêu cầu.
- Bộ đúng/lỗi này dùng để phát triển, chưa là bộ kiểm độc lập giữ riêng (`holdout`). Chưa đánh giá chất lượng model, mức gợi ý, tấn công qua nội dung prompt nói chung hoặc quyền production.

```text
node src/agent/scripts/generate-ai-lab-fixtures.cjs
node src/agent/scripts/generate-ai-lab-fixtures.cjs --check
node --test src/agent/tests/aiLabCertification.test.js
```

Lệnh sinh dữ liệu mẫu không đọc `.env`, kết nối DB hoặc gọi provider. JSON được lưu cùng source và so với bản sinh lại khi test; `pnpm test:cli` sẽ phát hiện mẫu cũ không khớp source trong CI.

## 7. Bằng chứng nghiệm thu

| Điều kiện DISC-03                                          | Kết quả local ngày 19/10/2026                                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Ba nhóm IPv4/interface, route, VLAN; profile/schema hợp lệ | Đạt trên ba định nghĩa synthetic bằng `parseCliLabConfig`                                                           |
| Golden actions chạy thật và grader đạt                     | 3/3 đạt 100                                                                                                         |
| Tối thiểu hai cấu hình đúng/lab                            | 6/6 cấu hình đúng đạt                                                                                               |
| Tối thiểu năm lỗi/lab, có targeted repair                  | 18/18 tình huống lỗi được phát hiện và sửa phục hồi                                                                 |
| Unused shutdown và default route hợp lệ                    | Có case riêng, đạt                                                                                                  |
| Không mutate state/score trong inspection                  | Đạt trên golden và các case                                                                                         |
| Private rubric ngoài provider fixtures                     | Canary và kiểm forbidden fields/command strings đạt                                                                 |
| AC-01/AC-03/AC-09                                          | Có input/oracle cho evidence, phạm vi kiến thức và kiểm tra lại sau sửa; phần AI trả lời chưa triển khai/nghiệm thu |

Bộ kiểm ba lab **31/31 test đạt**. Toàn bộ nhóm CLI **76 qua, 1 tích hợp DB bỏ qua** (`LAB_INTEGRATION=0`). ESLint file mới và kiểm ranh giới source đạt. Không build frontend vì không đổi UI/engine đang chạy; không test ghi DB, nhập lab vào DB hoặc triển khai. Đây là kết quả ngày 19/10/2026.

Người kiểm kỹ thuật trong phiên là Codex qua engine/bộ chấm/test. **Chưa có reviewer CCNA độc lập.** Trước khi mời học viên thử cần duyệt nội dung, lời hướng dẫn, mức gợi ý; gắn lab vào khóa học với quyền phù hợp và kiểm toàn luồng trên staging. Các việc đó còn riêng, không làm thay đổi kết quả kiểm kỹ thuật local đã ghi ở đây.
