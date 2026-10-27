# DISC-03 - Chỗ chưa khớp trong PDF và phần simulator chưa hỗ trợ

[Hồ sơ chứng nhận](DISC-03-certified-labs.md) · [Backlog](../03-delivery-backlog.md)

Ngày ghi nhận: 19/10/2026. Người phụ trách nội dung giữ vai trò PM/SE; cần người chuyên môn CCNA duyệt trước khi dùng nguyên bài PDF để giảng dạy. Các việc dưới đây được ghi trong repo, chưa đăng ra dịch vụ ngoài và không chỉnh PDF gốc.

Khi đọc PDF để làm ba lab mẫu, có chỗ địa chỉ trong sơ đồ và câu lệnh không khớp nhau. Dự án dựng lab mới với địa chỉ/mục tiêu rõ ràng thay vì mang nguyên chỗ mâu thuẫn vào bộ chấm. Ví dụ, sơ đồ ghi một subnet nhưng lệnh dùng subnet khác thì phải chốt lại trước khi dùng nguyên đề.

| ID     | Bằng chứng trong PDF                                                                                                                                                                                      | Xử lý trong ba lab mới                                                                                                              | Điều kiện đóng khi tái dùng nguyên bài                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| SRC-01 | `LAB-ARP-Proxy-ARP.pdf` trang 1: danh sách ghi VLAN 34 là `192.168.23.0/24`, nhưng IP interface và route dùng `192.168.34.x`; yêu cầu nêu R3/R4 định tuyến nhưng phần hướng dẫn cấu hình route trên R2/R3 | Dùng bài IPv4 synthetic riêng, địa chỉ/mục tiêu tường minh; không mang yêu cầu Proxy ARP hoặc danh sách router mâu thuẫn vào rubric | Reviewer chốt subnet và router được định tuyến; chạy lại cả chiều đi/về trên nền hỗ trợ Proxy ARP |
| SRC-02 | `LAB-Static-Route-AD.pdf` trang 1: VLAN 24 ghi `192.168.23.0/24`, nhưng G1.24 và next hop ở trang 1-2 dùng `192.168.24.x`                                                                                 | Thay topology bằng hai router với transit /30; không nhập nguyên địa chỉ mâu thuẫn                                                  | Đồng bộ sơ đồ/address table/commands và kiểm đường chính/dự phòng theo AD trên nền hỗ trợ         |
| SRC-03 | `LAB-RIP02.pdf` trang 1: nhãn link có IPv4 năm octet như `192.168.1.12.0/24`, trong khi phần lệnh dùng `192.1.12.x`                                                                                       | Chỉ tham khảo vai trò static/default route, dùng địa chỉ synthetic hợp lệ đã qua schema                                             | Sửa nhãn link theo kế hoạch địa chỉ đã duyệt; đối chiếu cả ba link và lệnh RIP                    |

Các vấn đề nguồn vẫn **OPEN cho nguyên bài PDF**. Ba bài dựng lại có địa chỉ/phạm vi riêng đã qua test nên không bị chặn bởi việc sửa PDF gốc.

## CAP-01 - Không chứng nhận vượt capability

**Simulator đang làm được gì:** profile `ccna-network-v2` có static route ba tham số, interface vật lý, access/trunk cơ bản và tập lệnh mô phỏng định tuyến hiện có. Chưa có lệnh cho floating AD, RIP, Proxy ARP, HSRP, DHCP, `encapsulation dot1q`, native VLAN hoặc lọc allowed-VLAN. EIGRP01 có bộ thử riêng nhưng chưa chứng minh redistribution/MD5 của EIGRP03/04 được hỗ trợ.

**Đã làm trong ba lab:** dùng ID mới, giữ ba nhóm R1 và ghi rõ phần rút gọn. Bài HSRP chỉ được tham khảo yêu cầu VLAN/trunk, chưa được chứng nhận HSRP. Interface `g1.12` trong PDF được đổi thành interface vật lý đúng schema, không giả lập một subinterface chưa hỗ trợ. Các bước quản trị/xóa/khởi động lại thiết bị trong PDF không đưa vào dữ liệu thử.

**Muốn hỗ trợ thêm:** tạo task riêng cho engine/nội dung, bổ sung cấu trúc dữ liệu, lệnh, cách mô phỏng hành vi và bộ thử; có người đọc chuyên môn rồi kiểm lại. Không bỏ qua lệnh lỗi hoặc sửa engine tùy tiện chỉ để lời giải mẫu đạt điểm.
