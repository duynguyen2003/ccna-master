// Vietnamese teaching copy adapted from the pinned source; wire values stay verbatim.
export const lessonVietnamese = {
  http: [
    [
      'Chuẩn bị yêu cầu',
      'Trình duyệt chuẩn bị GET cho www.example.com. Trước khi kết nối, nó cần biết địa chỉ IP của máy chủ.',
    ],
    [
      'Phân giải DNS',
      'Máy khách hỏi resolver 8.8.8.8 qua UDP cổng 53 và nhận bản ghi A trỏ đến 203.0.113.10.',
    ],
    ['Kết nối TCP', 'Hai đầu bắt tay SYN → SYN-ACK → ACK tới cổng 80 trước khi truyền HTTP.'],
    [
      'Trao đổi HTTP',
      'GET kèm Host được gửi đi; máy chủ trả 200 OK và HTML. Phản hồi mẫu gồm 9 segment TCP, được gộp thành một lượt truyền trên sơ đồ.',
    ],
    [
      'Hiển thị trang',
      'Trình duyệt phân tích HTML và hiển thị nội dung. CSS, ảnh và script liên quan có thể cần các yêu cầu tiếp theo.',
    ],
  ],
  https: [
    [
      'Yêu cầu HTTPS',
      'HTTPS dùng TLS để bảo vệ kết nối, mặc định tại cổng 443. Trình duyệt vẫn cần tìm địa chỉ IP trước.',
    ],
    [
      'Tra cứu DNS',
      'Kịch bản dùng DNS thường qua UDP cổng 53; truy vấn tên miền ở bước này chưa được mã hóa.',
    ],
    [
      'Bắt tay TCP',
      'SYN, SYN-ACK và ACK mở kết nối đến cổng 443. Bắt tay TCP chưa cung cấp mã hóa.',
    ],
    [
      'Bắt tay TLS',
      'Hai đầu chọn thuật toán, trao đổi key share và kiểm tra chứng chỉ. Kịch bản sử dụng TLS 1.3 và trao đổi khóa lai.',
    ],
    [
      'Trao đổi được mã hóa',
      'GET và 200 OK nằm trong TLS records. Session ticket hỗ trợ nối lại phiên trong lần truy cập sau.',
    ],
    [
      'Giải mã và hiển thị',
      'Trình duyệt giải mã phản hồi rồi dựng trang. Header HSTS yêu cầu các lần truy cập tiếp theo sử dụng HTTPS.',
    ],
  ],
  tcp: [
    [
      'Mở kết nối',
      'SYN → SYN-ACK → ACK xác nhận số thứ tự ban đầu. Các số trong ví dụ là số tương đối.',
    ],
    [
      'Gửi dữ liệu',
      'Yêu cầu HTTP có 78 byte. ACK 79 nghĩa là bên nhận đang chờ byte 79 và đã nhận liên tục các byte trước đó.',
    ],
    [
      'Hai segment phản hồi',
      'Máy chủ gửi hai segment, mỗi segment 1.460 byte. Segment đầu bị mất, segment sau vẫn đến nơi.',
    ],
    [
      'Phát hiện khoảng trống',
      'Máy khách lặp ACK 1 và gửi SACK cho vùng 1461–2920 đã nhận, vì vùng đầu còn thiếu.',
    ],
    [
      'Truyền lại phần thiếu',
      'Máy chủ truyền lại segment đầu. Khi dữ liệu đã liên tục, máy khách xác nhận toàn bộ; nếu không có phản hồi, bộ định thời sẽ xử lý truyền lại.',
    ],
    [
      'Đóng kết nối',
      'Mỗi chiều đóng riêng bằng FIN và ACK. Máy khách giữ trạng thái TIME-WAIT sau khi hoàn tất.',
    ],
  ],
  udp: [
    [
      'Gửi ngay',
      'Ứng dụng gửi datagram chứa 20 ms âm thanh mà không bắt tay. Header UDP dài 8 byte.',
    ],
    [
      'Luồng datagram',
      'Mỗi 20 ms có một datagram độc lập. UDP không đánh số thứ tự hoặc xác nhận nhận dữ liệu.',
    ],
    [
      'Mất dữ liệu trên đường',
      'Khung âm thanh số 7 bị mất. UDP không yêu cầu truyền lại; các datagram sau tiếp tục đến.',
    ],
    [
      'Âm thanh chiều về',
      'Datagram từ bên kia quay về cổng 50000 nhờ ánh xạ NAT được tạo khi gửi đi.',
    ],
    [
      'Ứng dụng xử lý',
      'RTP cung cấp số thứ tự để ứng dụng phát hiện mất khung và bù khoảng trống 20 ms thay vì chờ truyền lại.',
    ],
  ],
  ip: [
    [
      'Đích có cùng mạng?',
      '192.168.1.10/24 và 203.0.113.10 khác mạng. Máy khách chọn default gateway 192.168.1.1.',
    ],
    [
      'Tìm MAC của router',
      'Nếu chưa có trong cache, ARP hỏi ai sở hữu 192.168.1.1. Router trả lời bằng địa chỉ MAC của nó.',
    ],
    [
      'Gửi gói IP',
      'Header IP chứa địa chỉ nguồn, đích, TTL và giao thức bên trong. Gói minh họa mang TCP SYN đến cổng 443, TTL ban đầu 128.',
    ],
    [
      'NAT và chuyển tiếp',
      'Router đổi nguồn sang 198.51.100.7:40112 và giảm TTL. Các router tiếp theo tiếp tục chọn next hop và giảm TTL.',
    ],
    [
      'Phản hồi quay về',
      'Máy chủ trả lời địa chỉ công cộng. Router dùng bảng NAT để đổi đích về 192.168.1.10:52344 và chuyển cho máy khách.',
    ],
  ],
  dns: [
    [
      'Hỏi resolver',
      'Máy khách chưa có cache nên yêu cầu resolver 8.8.8.8 phân giải www.example.com theo chế độ đệ quy.',
    ],
    [
      'Máy chủ gốc',
      'Resolver chưa có cache hỏi máy chủ root và nhận chỉ dẫn đến máy chủ quản lý .com.',
    ],
    [
      'Máy chủ .com',
      'Máy chủ TLD trả chỉ dẫn đến máy chủ tên miền example.com, kèm địa chỉ glue trong ví dụ.',
    ],
    [
      'Máy chủ có thẩm quyền',
      'Máy chủ quản lý example.com trả bản ghi A với TTL cache 3.600 giây và đánh dấu câu trả lời có thẩm quyền.',
    ],
    [
      'Trả lời và lưu cache',
      'Resolver trả kết quả cho máy khách, đồng thời lưu cache theo TTL. Những truy vấn sau có thể dùng lại kết quả.',
    ],
  ],
  dhcp: [
    [
      'Chưa có địa chỉ',
      'Máy mới kết nối đã có MAC nhưng chưa có IP, gateway hoặc DNS. DHCP cung cấp cấu hình này.',
    ],
    [
      'Discover',
      'Máy khách gửi từ 0.0.0.0 đến 255.255.255.255 để tìm DHCP server trên mạng cục bộ.',
    ],
    [
      'Offer',
      'Server đề nghị một IP còn trống cùng cấu hình mạng. Trong ví dụ, phản hồi được gửi tới MAC của máy khách.',
    ],
    [
      'Request',
      'Máy khách broadcast yêu cầu địa chỉ đã chọn, đồng thời cho các DHCP server khác biết đề nghị nào được chấp nhận.',
    ],
    [
      'Acknowledge',
      'Server xác nhận lease; máy khách cấu hình IP, mask, gateway và DNS. Hệ thống có thể kiểm tra trùng IP bằng ARP trước khi dùng.',
    ],
    [
      'Gia hạn',
      'Sau nửa lease 24 giờ, máy khách gửi yêu cầu gia hạn trực tiếp. Nếu không được trả lời, nó có thể broadcast ở mốc 87,5% lease.',
    ],
  ],
  icmp: [
    [
      'Gửi ping',
      'Echo Request dùng ICMP type 8, code 0, kèm identifier, sequence và dữ liệu. Máy đích có thể trả lời mà không cần ứng dụng riêng.',
    ],
    [
      'Echo Reply',
      'Echo Reply type 0 giữ identifier, sequence và dữ liệu. RTT và TTL hiển thị ở đây là giá trị của kịch bản minh họa.',
    ],
    ['TTL bằng 1', 'Router đầu giảm TTL xuống 0, hủy gói và gửi ICMP Time Exceeded về nguồn.'],
    [
      'TTL bằng 2',
      'Gói vượt router đầu nhưng hết TTL tại router kế tiếp. Thông báo lỗi cho biết địa chỉ hop đó.',
    ],
    [
      'Nguyên lý traceroute',
      'Tăng TTL qua từng lần gửi giúp tìm các hop. Khi tới đích, Echo Reply thay cho Time Exceeded.',
    ],
    [
      'Không tới được cổng',
      'UDP gửi tới cổng 9999 không có dịch vụ có thể nhận ICMP Destination Unreachable, code 3. Firewall cũng có thể im lặng loại bỏ gói.',
    ],
  ],
  smtp: [
    [
      'Kết nối bảo mật',
      'Ứng dụng thư kết nối máy chủ gửi thư tại cổng 465. TLS bắt đầu ngay trước hội thoại SMTP.',
    ],
    [
      'Chào và đăng nhập',
      'Server gửi 220; EHLO liệt kê khả năng. AUTH PLAIN mang thông tin đăng nhập dạng base64 bên trong TLS.',
    ],
    [
      'Gửi thư',
      'MAIL FROM và RCPT TO xác định phong bì thư. Sau DATA và mã 354 là nội dung, kết thúc bằng một dòng chỉ có dấu chấm.',
    ],
    [
      'Tìm máy chủ nhận',
      'Máy chủ gửi tra bản ghi MX của miền người nhận rồi tìm địa chỉ của máy chủ thư đó.',
    ],
    [
      'Giữa hai máy chủ',
      'Kết nối cổng 25 bắt đầu bằng văn bản thường. STARTTLS cho phép hai bên chuyển sang TLS khi được hỗ trợ.',
    ],
    [
      'Chuyển thư tới hộp thư',
      'Sau TLS, server gửi lại EHLO, phong bì và nội dung. Máy chủ nhận kiểm tra chính sách như SPF, DKIM, DMARC trong kịch bản.',
    ],
  ],
  pop3: [
    [
      'Kết nối bảo mật',
      'Ứng dụng kết nối cổng 995 với TLS ngay từ đầu. Lời chào POP3 bên trong là +OK.',
    ],
    ['Đăng nhập', 'USER và PASS gửi thông tin đăng nhập. TLS bảo vệ chúng trên đường truyền.'],
    [
      'Kiểm tra hộp thư',
      'STAT trả số lượng và tổng kích thước; LIST liệt kê số thứ tự và kích thước từng thư.',
    ],
    [
      'Tải thư',
      'RETR 1 yêu cầu thư đầu tiên. Server gửi nội dung rồi kết thúc bằng dòng dấu chấm.',
    ],
    [
      'Xóa và thoát',
      'DELE chỉ đánh dấu xóa; QUIT mới chốt việc xóa. Tùy chọn giữ bản sao trên server bỏ qua DELE.',
    ],
  ],
  imap: [
    [
      'Kết nối bảo mật',
      'Ứng dụng kết nối cổng 993 với TLS. Server chào bằng dòng * OK và công bố các khả năng như IDLE.',
    ],
    [
      'Đăng nhập',
      'Mỗi lệnh có tag riêng; phản hồi kết thúc dùng cùng tag. Các dòng bắt đầu bằng * là dữ liệu không gắn tag.',
    ],
    [
      'Mở hộp thư',
      'SELECT INBOX mở hộp thư. Server trả số thư, các cờ hỗ trợ và trạng thái truy cập.',
    ],
    [
      'Đọc thư',
      'FETCH 2 BODY[] tải thư thứ hai và đặt cờ \\Seen. Thư vẫn ở server để đồng bộ với thiết bị khác.',
    ],
    [
      'Chờ thư mới',
      'IDLE yêu cầu server thông báo thay đổi. Khi có thư mới, server gửi EXISTS; máy khách dùng DONE để kết thúc chờ.',
    ],
  ],
  ftp: [
    [
      'Kết nối điều khiển',
      'FTP mở TCP cổng 21 cho lệnh và phản hồi suốt phiên. Server chào bằng mã 220.',
    ],
    [
      'Đăng nhập',
      'USER và PASS truyền tên và mật khẩu dưới dạng văn bản thường trong FTP của ví dụ.',
    ],
    [
      'Chế độ thụ động',
      'TYPE I chọn dữ liệu nhị phân. PASV trả địa chỉ và cổng dữ liệu: 195 × 256 + 149 = 50069.',
    ],
    [
      'Kết nối dữ liệu',
      'Máy khách mở kết nối TCP thứ hai tới cổng 50069, gửi RETR trên kênh điều khiển và nhận mã 150.',
    ],
    [
      'Nhận tệp',
      'Tệp 4.000 byte được truyền qua 3 segment. Đóng kênh dữ liệu đánh dấu hết tệp; mã 226 xác nhận trên kênh điều khiển.',
    ],
    [
      'Kết thúc phiên',
      'QUIT nhận mã 221. SFTP chạy trên SSH và FTPS dùng TLS là các cách truyền tệp có mã hóa khác với FTP thường.',
    ],
  ],
  ssh: [
    [
      'Chào phiên SSH',
      'Sau bắt tay TCP cổng 22, hai đầu trao đổi dòng phiên bản SSH. Phần còn lại của giao thức dùng định dạng nhị phân.',
    ],
    [
      'Chọn thuật toán',
      'KEXINIT liệt kê thuật toán trao đổi khóa, host key, mã hóa, kiểm tra toàn vẹn và nén; hai bên chọn thuật toán chung.',
    ],
    [
      'Trao đổi khóa',
      'Ví dụ dùng trao đổi khóa lai với X25519. Máy khách kiểm host key; NEWKEYS bật mã hóa.',
    ],
    [
      'Đăng nhập bằng khóa',
      'Máy khách chứng minh sở hữu private key bằng chữ ký của phiên. Private key không rời thiết bị; server kiểm với authorized_keys.',
    ],
    [
      'Mở session',
      'Một kết nối SSH có thể mang nhiều channel. Session channel mở terminal và shell để nhận prompt.',
    ],
    [
      'Gõ lệnh',
      'Các ký tự của pwd được gửi trong gói mã hóa và được echo về. Kịch bản minh họa cả cơ chế che nhịp gõ của OpenSSH.',
    ],
  ],
  tls: [
    [
      'Client Hello',
      'Máy khách đề xuất phiên bản TLS, cipher suite, key share, tên miền SNI và giao thức ALPN.',
    ],
    [
      'Server Hello',
      'Server chọn TLS 1.3 và thuật toán chung, gửi key share để hai đầu tạo bí mật dùng chung.',
    ],
    [
      'Chứng chỉ',
      'Các thông điệp sau Server Hello được mã hóa, gồm chuỗi chứng chỉ, chữ ký xác minh và Finished của server.',
    ],
    [
      'Finished',
      'Máy khách gửi giá trị kiểm tra toàn bộ bắt tay bằng khóa mới, giúp phát hiện thông điệp bị thay đổi.',
    ],
    [
      'Dữ liệu được mã hóa',
      'HTTP đi trong TLS records có kiểm tra toàn vẹn. Session ticket hỗ trợ nối lại phiên mà không lặp toàn bộ trao đổi chứng chỉ.',
    ],
    [
      'Đóng phiên',
      'close_notify được mã hóa thông báo kết thúc TLS có chủ ý; sau đó kết nối TCP đóng.',
    ],
  ],
};
