export const protocolGroups = {
  core: 'Nền tảng mạng',
  application: 'Ứng dụng',
  security: 'Bảo mật',
};

// Scenario IDs resolve to lesson data; a protocol can own multiple scenarios.
export const protocolCatalog = [
  {
    id: 'http',
    name: 'HTTP',
    group: 'application',
    scenarios: [
      {
        id: 'http',
        title: 'Truy cập một trang web',
        summary: 'Từ tra cứu DNS, bắt tay TCP đến yêu cầu GET và hiển thị trang.',
      },
    ],
  },
  {
    id: 'https',
    name: 'HTTPS',
    group: 'security',
    scenarios: [
      {
        id: 'https',
        title: 'Truy cập web qua kết nối bảo mật',
        summary: 'Theo dõi DNS, TCP, TLS và trao đổi dữ liệu được mã hóa.',
      },
    ],
  },
  {
    id: 'tcp',
    name: 'TCP',
    group: 'core',
    scenarios: [
      {
        id: 'tcp',
        title: 'Truyền tin tin cậy và khôi phục mất gói',
        summary: 'Bắt tay, gửi segment, ACK, SACK và truyền lại dữ liệu.',
      },
    ],
  },
  {
    id: 'udp',
    name: 'UDP',
    group: 'core',
    scenarios: [
      {
        id: 'udp',
        title: 'Gửi datagram và quan sát mất gói',
        summary: 'Theo dõi những datagram độc lập và hành vi khi một gói không đến đích.',
      },
    ],
  },
  {
    id: 'ip',
    name: 'IP',
    group: 'core',
    scenarios: [
      {
        id: 'ip',
        title: 'Hành trình của một gói IP',
        summary: 'Theo dõi địa chỉ, định tuyến và đường đi qua các thiết bị.',
      },
    ],
  },
  {
    id: 'dns',
    name: 'DNS',
    group: 'application',
    scenarios: [
      {
        id: 'dns',
        title: 'Phân giải tên miền',
        summary: 'Từ resolver đến DNS root, TLD và máy chủ có thẩm quyền.',
      },
    ],
  },
  {
    id: 'dhcp',
    name: 'DHCP',
    group: 'application',
    scenarios: [
      {
        id: 'dhcp',
        title: 'Nhận cấu hình mạng tự động',
        summary: 'Khám phá máy chủ, nhận đề nghị và xác nhận cấu hình IP.',
      },
    ],
  },
  {
    id: 'icmp',
    name: 'ICMP',
    group: 'core',
    scenarios: [
      {
        id: 'icmp',
        title: 'Ping và phản hồi ICMP',
        summary: 'Quan sát Echo Request, Echo Reply và thông báo mạng.',
      },
    ],
  },
  {
    id: 'smtp',
    name: 'SMTP',
    group: 'application',
    scenarios: [
      {
        id: 'smtp',
        title: 'Gửi thư điện tử',
        summary: 'Theo dõi các lệnh và phản hồi trong phiên gửi thư.',
      },
    ],
  },
  {
    id: 'pop3',
    name: 'POP3',
    group: 'application',
    scenarios: [
      {
        id: 'pop3',
        title: 'Nhận thư qua POP3',
        summary: 'Kết nối máy chủ, xem danh sách và tải thư về máy khách.',
      },
    ],
  },
  {
    id: 'imap',
    name: 'IMAP',
    group: 'application',
    scenarios: [
      {
        id: 'imap',
        title: 'Đồng bộ hộp thư',
        summary: 'Đọc và quản lý thư được lưu trên máy chủ IMAP.',
      },
    ],
  },
  {
    id: 'ftp',
    name: 'FTP',
    group: 'application',
    scenarios: [
      {
        id: 'ftp',
        title: 'Truyền tệp qua FTP',
        summary: 'Quan sát kênh điều khiển và luồng truyền dữ liệu tệp.',
      },
    ],
  },
  {
    id: 'ssh',
    name: 'SSH',
    group: 'security',
    scenarios: [
      {
        id: 'ssh',
        title: 'Mở phiên truy cập từ xa an toàn',
        summary: 'Trao đổi khóa, xác thực và mở phiên SSH được mã hóa.',
      },
    ],
  },
  {
    id: 'tls',
    name: 'TLS',
    group: 'security',
    scenarios: [
      {
        id: 'tls',
        title: 'Thiết lập phiên TLS',
        summary: 'Theo dõi Client Hello, chứng chỉ, trao đổi khóa và dữ liệu ứng dụng.',
      },
    ],
  },
  {
    id: 'websocket',
    name: 'WebSocket',
    group: 'application',
    scenarios: [
      {
        id: 'websocket',
        title: 'Mở kết nối WebSocket',
        summary: 'Nâng cấp HTTP, trao đổi hai chiều, ping/pong và đóng kết nối.',
      },
    ],
  },
  {
    id: 'webrtc',
    name: 'WebRTC',
    group: 'application',
    scenarios: [
      {
        id: 'webrtc',
        title: 'Gọi video qua WebRTC',
        summary: 'Theo dõi signaling, STUN, ICE, DTLS và luồng media giữa hai máy.',
      },
    ],
  },
  {
    id: 'sip',
    name: 'SIP',
    group: 'application',
    scenarios: [
      {
        id: 'sip',
        title: 'Gọi điện qua SIP',
        summary: 'Đăng ký, mời gọi, đổ chuông, truyền âm thanh RTP và kết thúc cuộc gọi.',
      },
    ],
  },
  {
    id: 'rtsp',
    name: 'RTSP',
    group: 'application',
    scenarios: [
      {
        id: 'rtsp',
        title: 'Xem luồng video từ camera IP',
        summary: 'Điều khiển camera bằng RTSP và nhận video bằng RTP.',
      },
    ],
  },
  {
    id: 'rtmp',
    name: 'RTMP',
    group: 'application',
    scenarios: [
      {
        id: 'rtmp',
        title: 'Phát trực tiếp qua RTMP',
        summary: 'Bắt tay, mở stream và gửi âm thanh, hình ảnh từ OBS tới máy chủ.',
      },
    ],
  },
  {
    id: 'quic',
    name: 'QUIC',
    group: 'core',
    scenarios: [
      {
        id: 'quic',
        title: 'Truy cập HTTP/3 qua QUIC',
        summary: 'Kết hợp thiết lập mã hóa với truyền dữ liệu trên UDP và chuyển mạng.',
      },
    ],
  },
  {
    id: 'bgp',
    name: 'BGP',
    group: 'core',
    scenarios: [
      {
        id: 'bgp',
        title: 'Định tuyến giữa các AS',
        summary: 'Mở phiên BGP, quảng bá, chuyển tiếp và rút tuyến giữa các mạng.',
      },
    ],
  },
  {
    id: 'ipv6',
    name: 'IPv6',
    group: 'core',
    scenarios: [
      {
        id: 'ipv6',
        title: 'Tự cấu hình địa chỉ IPv6',
        summary: 'Tạo địa chỉ link-local, nhận RA, SLAAC và tìm láng giềng.',
      },
    ],
  },
  {
    id: 'doh',
    name: 'DNS over HTTPS',
    group: 'security',
    scenarios: [
      {
        id: 'doh',
        title: 'Truy vấn DNS qua HTTPS',
        summary: 'So sánh truy vấn DNS thường với câu hỏi và câu trả lời bên trong HTTPS.',
      },
    ],
  },
  {
    id: 'dnssec',
    name: 'DNSSEC',
    group: 'security',
    scenarios: [
      {
        id: 'dnssec',
        title: 'Xác minh câu trả lời DNS',
        summary: 'Theo dõi RRSIG, DNSKEY và chuỗi tin cậy của dữ liệu DNS.',
      },
    ],
  },
  {
    id: 'igmp',
    name: 'IGMP',
    group: 'core',
    scenarios: [
      {
        id: 'igmp',
        title: 'Tham gia nhóm truyền hình multicast',
        summary: 'Quan sát switch, router và các thiết bị tham gia hoặc rời kênh multicast.',
      },
    ],
  },
  {
    id: 'ntp',
    name: 'NTP',
    group: 'application',
    scenarios: [
      {
        id: 'ntp',
        title: 'Đồng bộ thời gian qua NTP',
        summary: 'Trao đổi mốc thời gian, tính độ lệch và điều chỉnh đồng hồ.',
      },
    ],
  },
  {
    id: 'ethernet',
    name: 'Ethernet',
    group: 'core',
    scenarios: [
      {
        id: 'ethernet',
        title: 'Chuyển tiếp frame qua switch',
        summary: 'Theo dõi ARP, học MAC, phát tràn và chuyển frame tới đúng cổng.',
      },
    ],
  },
  {
    id: 'pppoe',
    name: 'PPPoE',
    group: 'core',
    scenarios: [
      {
        id: 'pppoe',
        title: 'Kết nối băng rộng qua PPPoE',
        summary: 'Khám phá máy chủ, thiết lập PPP, xác thực và nhận địa chỉ Internet.',
      },
    ],
  },
  {
    id: 'wifi',
    name: 'Wi-Fi',
    group: 'core',
    scenarios: [
      {
        id: 'wifi',
        title: 'Tham gia mạng Wi-Fi WPA2',
        summary: 'Tìm mạng, xác thực, liên kết và hoàn tất bắt tay bốn bước.',
      },
    ],
  },
  {
    id: 'wpa3',
    name: 'WPA3',
    group: 'security',
    scenarios: [
      {
        id: 'wpa3',
        title: 'Xác thực Wi-Fi bằng WPA3',
        summary: 'Theo dõi SAE Commit, SAE Confirm và quá trình tạo khóa phiên.',
      },
    ],
  },
  {
    id: 'radius',
    name: 'RADIUS',
    group: 'security',
    scenarios: [
      {
        id: 'radius',
        title: 'Đăng nhập mạng Wi-Fi doanh nghiệp',
        summary: 'Điểm truy cập trao đổi EAP và RADIUS với máy chủ xác thực.',
      },
    ],
  },
  {
    id: 'portal',
    name: 'Captive Portal',
    group: 'application',
    scenarios: [
      {
        id: 'portal',
        title: 'Đăng nhập mạng qua captive portal',
        summary: 'Kiểm tra Internet, chuyển hướng đăng nhập và mở quyền truy cập mạng.',
      },
    ],
  },
  {
    id: 'smb',
    name: 'SMB',
    group: 'application',
    scenarios: [
      {
        id: 'smb',
        title: 'Truy cập thư mục chia sẻ qua SMB',
        summary: 'Thương lượng, xác thực, mở thư mục và đọc tệp từ NAS.',
      },
    ],
  },
  {
    id: 'proxy',
    name: 'HTTP Proxy',
    group: 'application',
    scenarios: [
      {
        id: 'proxy',
        title: 'Truy cập web qua HTTP proxy',
        summary: 'Proxy chuyển tiếp yêu cầu HTTP và tạo đường hầm CONNECT cho HTTPS.',
      },
    ],
  },
  {
    id: 'socks',
    name: 'SOCKS5',
    group: 'application',
    scenarios: [
      {
        id: 'socks',
        title: 'Mở đường hầm qua SOCKS5',
        summary: 'Thương lượng phương thức, yêu cầu kết nối và chuyển tiếp dữ liệu.',
      },
    ],
  },
  {
    id: 'reverse',
    name: 'Reverse Proxy',
    group: 'application',
    scenarios: [
      {
        id: 'reverse',
        title: 'Kết thúc TLS tại reverse proxy',
        summary: 'Theo dõi hai kết nối giữa máy khách, reverse proxy và máy chủ ứng dụng.',
      },
    ],
  },
  {
    id: 'wireguard',
    name: 'WireGuard',
    group: 'security',
    scenarios: [
      {
        id: 'wireguard',
        title: 'Thiết lập VPN WireGuard',
        summary: 'Bắt tay, đóng gói vào đường hầm, chuyển tiếp và nhận gói trả về.',
      },
    ],
  },
  {
    id: 'ipsec',
    name: 'IPsec',
    group: 'security',
    scenarios: [
      {
        id: 'ipsec',
        title: 'Thiết lập VPN IPsec với IKEv2',
        summary: 'Thương lượng IKE, phát hiện NAT, xác thực và truyền gói bằng ESP.',
      },
    ],
  },
  {
    id: 'modbus',
    name: 'Modbus',
    group: 'application',
    scenarios: [
      {
        id: 'modbus',
        title: 'Đọc và ghi thanh ghi của PLC',
        summary: 'Đọc thanh ghi, ghi giá trị đặt, điều khiển đầu ra và xử lý phản hồi lỗi.',
      },
    ],
  },
];

export const scenarioCatalog = protocolCatalog.flatMap((protocol) =>
  protocol.scenarios.map((scenario) => ({
    ...scenario,
    protocolId: protocol.id,
    protocolName: protocol.name,
    group: protocol.group,
  }))
);
export const getProtocolScenario = (id) => scenarioCatalog.find((scenario) => scenario.id === id);

// Progress schema version stays stable; source revision belongs to provenance.json.
export const catalogVersion = '2026-11-04-v1';
export const isProtocolId = (id) => scenarioCatalog.some((entry) => entry.id === id);
export const loadProtocolLesson = (id) => {
  if (!isProtocolId(id)) return Promise.reject(new Error('Không tìm thấy mô phỏng.'));
  return import(
    /* webpackChunkName: "protocol-lesson-[request]", webpackExclude: /(?:scene|provenance)\.json$/ */ `./lessons/${id}.json`
  ).then((module) => module.default);
};

// Explicit opt-in stored in existing lesson content. No title guessing or numeric DB IDs.
const marker = /<!--\s*netmaster-protocol:([a-z0-9]+)\s*-->/g;
export function protocolForLesson(content = '') {
  const ids = [...String(content).matchAll(marker)].map((match) => match[1]);
  return ids.length === 1 && isProtocolId(ids[0]) ? ids[0] : null;
}
export function setLessonProtocol(content = '', id = '') {
  const clean = String(content || '')
    .replace(/\n\n(?=<!--\s*netmaster-protocol:[a-z0-9]+\s*-->)/g, '')
    .replace(marker, '');
  return isProtocolId(id) ? `${clean}\n\n<!-- netmaster-protocol:${id} -->` : clean;
}
