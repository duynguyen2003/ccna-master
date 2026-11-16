const labels = {
  FRAME: 'Chuyển frame',
  ARP_REQUEST: 'Tìm địa chỉ MAC',
  ARP_REPLY: 'Trả lời ARP',
  ARP_TIMEOUT: 'Không tìm được MAC',
  ROUTE: 'Chọn đường đi',
  ACL_IN: 'Kiểm tra ACL vào',
  ACL_OUT: 'Kiểm tra ACL ra',
  NAT_SOURCE: 'Dịch địa chỉ nguồn',
  NAT_DESTINATION: 'Dịch địa chỉ đích',
  TTL_EXCEEDED: 'TTL đã hết',
  DELIVERED: 'Đã tới đích',
  REPLY_DELIVERED: 'Đã nhận phản hồi',
  DROP: 'Gói tin bị chặn',
};
const facts = (pairs) =>
  pairs.filter(([, value]) => value !== undefined && value !== null && value !== '');

function decisionExplanation(raw, fallback) {
  if (raw.type?.startsWith('ACL_')) {
    if (raw.detail === 'unfiltered')
      return 'Interface không gắn ACL ở chiều đang kiểm tra; gói tin được phép tiếp tục.';
    if (raw.detail === 'implicit deny')
      return 'Không có dòng ACL nào cho phép gói tin; luật deny ngầm ở cuối ACL đã chặn nó.';
    if (/\bdeny\b/i.test(raw.detail || ''))
      return 'Gói tin khớp dòng deny trong ACL bên dưới và bị chặn tại thiết bị này.';
    if (/\bpermit\b/i.test(raw.detail || ''))
      return 'Gói tin khớp dòng permit trong ACL bên dưới và được tiếp tục xử lý.';
  }
  if (raw.type === 'DROP' && /No route to /i.test(raw.detail || ''))
    return 'Thiết bị không tìm được tuyến phù hợp đến đích. Kiểm tra bảng định tuyến và tuyến mặc định; nếu đây là chiều phản hồi, kiểm tra đường về nguồn.';
  if (raw.type === 'DROP' && /Return path failed/i.test(raw.detail || ''))
    return 'Yêu cầu đã đến đích nhưng phản hồi không quay lại đúng nguồn. Kết quả hai chiều chưa thành công; xem sự kiện lỗi trước đó.';
  return fallback;
}

export function observationKey(packet, identity = '') {
  return packet ? `${identity}:${JSON.stringify(packet)}` : '';
}

export function createObservation(packet, key = '') {
  let phase = 'request';
  const events = (Array.isArray(packet?.events) ? packet.events : [])
    .filter(Boolean)
    .map((raw, index) => {
      const type = raw.type || 'EVENT';
      const isArp = type.startsWith('ARP_');
      const currentPhase = raw.reply === true ? 'reply' : phase;
      const hasPorts = ['tcp', 'udp'].includes(raw.packet?.protocol?.toLowerCase());
      const actors = [
        ...new Set([raw.deviceId, raw.from?.deviceId, raw.to?.deviceId].filter(Boolean)),
      ];
      const linkFacts = facts([
        ['Thiết bị', raw.deviceId],
        ['Cổng gửi', raw.from?.interface],
        ['Cổng nhận', raw.to?.interface],
        ['MAC nguồn', raw.srcMac],
        ['MAC đích', raw.dstMac],
        ['VLAN', raw.vlan],
        ['Giao thức định tuyến', raw.routeProtocol],
      ]);
      const packetFacts = facts([
        ['IP nguồn', raw.packet?.src],
        ['IP đích', raw.packet?.dst],
        ['Giao thức', raw.packet?.protocol?.toUpperCase()],
        ['Cổng nguồn', hasPorts ? raw.packet?.srcPort : undefined],
        ['Cổng đích', hasPorts ? raw.packet?.dstPort : undefined],
        ['TTL', raw.packet?.ttl],
      ]);
      const descriptions = {
        FRAME: `Frame đi từ ${raw.from?.deviceId || '?'} đến ${raw.to?.deviceId || '?'}. MAC thuộc liên kết đang truyền; IP mô tả hai đầu của gói tin.`,
        ARP_REQUEST:
          'Thiết bị tìm địa chỉ MAC của next hop trước khi gửi frame. Thông tin IP bên dưới thuộc probe đang chờ ARP.',
        ARP_REPLY: 'Next hop trả về địa chỉ MAC để thiết bị gửi có thể đóng frame.',
        ROUTE: 'Thiết bị tra bảng định tuyến để chọn next hop và cổng ra.',
        ACL_IN: 'Gói tin được đối chiếu với ACL ở chiều vào interface.',
        ACL_OUT: 'Gói tin được đối chiếu với ACL ở chiều ra interface.',
        NAT_SOURCE:
          'Engine đã dịch địa chỉ hoặc cổng nguồn. Các trường bên dưới là snapshot ghi tại sự kiện này.',
        NAT_DESTINATION:
          'Engine đã dịch địa chỉ hoặc cổng đích. Các trường bên dưới là snapshot ghi tại sự kiện này.',
        TTL_EXCEEDED: 'TTL đã về 0 tại thiết bị này; gói tin không được chuyển tiếp.',
        ARP_TIMEOUT:
          'Không có láng giềng L2 trả lời cho next hop; kiểm tra địa chỉ, VLAN và liên kết.',
        DELIVERED:
          'Gói yêu cầu đã đến đích. Cần nhận được phản hồi để xác nhận probe hai chiều thành công.',
        REPLY_DELIVERED: 'Gói phản hồi đã quay lại thiết bị nguồn.',
        DROP: 'Engine dừng chuyển tiếp tại đây. Snapshot gói của DROP có thể là dữ liệu đầu vào của probe.',
      };
      const failure =
        ['DROP', 'TTL_EXCEEDED', 'ARP_TIMEOUT'].includes(type) ||
        (type.startsWith('ACL_') && /\bdeny\b/i.test(raw.detail || ''));
      const event = {
        id: `event-${index}`,
        index,
        type,
        raw,
        phase: currentPhase,
        actors,
        label: labels[type] || type,
        description: decisionExplanation(
          raw,
          descriptions[type] || raw.detail || 'Sự kiện do simulator ghi nhận.'
        ),
        detail:
          raw.detail === 'Packet delivered'
            ? type === 'REPLY_DELIVERED'
              ? 'Đã nhận gói phản hồi.'
              : 'Gói tin đã tới địa chỉ đích.'
            : raw.detail || '',
        from: raw.from,
        to: raw.to,
        deviceId: raw.deviceId,
        kind: type === 'FRAME' ? 'frame' : failure ? 'drop' : 'signal',
        failure,
        duration: type === 'FRAME' ? 1.5 : failure ? 1.2 : 0.8,
        groups: [
          { title: 'Thiết bị và liên kết', fields: linkFacts },
          {
            title: isArp
              ? 'Probe liên quan đến ARP'
              : type === 'DROP'
                ? 'Snapshot do engine ghi ở DROP'
                : 'Thông tin gói tin',
            fields: packetFacts,
          },
        ].filter((group) => group.fields.length),
      };
      if (type === 'DELIVERED') phase = 'reply';
      return event;
    });
  return {
    key,
    events,
    success: packet?.success === true,
    reason: packet?.reason || '',
    firstFailure: events.findIndex((e) => e.failure),
  };
}

export function observationWire(wires, event) {
  if (event?.type !== 'FRAME' || !event.from?.deviceId || !event.to?.deviceId) return null;
  const matches = wires.filter(({ link }) => {
    const [a, b] = link.a.deviceId === event.from.deviceId ? [link.a, link.b] : [link.b, link.a];
    return (
      a.deviceId === event.from.deviceId &&
      b.deviceId === event.to.deviceId &&
      (!event.from.interface || a.interface === event.from.interface) &&
      (!event.to.interface || b.interface === event.to.interface)
    );
  });
  return matches.length === 1 ? matches[0] : null;
}
