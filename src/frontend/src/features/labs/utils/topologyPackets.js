// Presentation only: a FRAME is the sole authority for travel between devices.
export function packetAnimationSteps(packet) {
  let reply = false;
  return (packet?.events || []).flatMap((event) => {
    if (event.type === 'DELIVERED') reply = true;
    if (event.type === 'FRAME' && event.from?.deviceId && event.to?.deviceId) {
      const protocol = event.packet?.protocol?.toUpperCase() || '';
      return [
        {
          kind: 'hop',
          from: event.from.deviceId,
          to: event.to.deviceId,
          fromInterface: event.from.interface,
          toInterface: event.to.interface,
          phase: reply ? 'reply' : 'request',
          label:
            protocol === 'ICMP'
              ? `Ping · ${reply ? 'Phản hồi' : 'Yêu cầu'}`
              : `${protocol || 'Gói tin'} · ${reply ? 'Chiều về' : 'Chiều đi'}`,
          detail: Number.isFinite(event.packet?.ttl) ? `TTL ${event.packet.ttl}` : '',
        },
      ];
    }
    if (event.type === 'ARP_REQUEST')
      return [
        {
          kind: 'signal',
          deviceId: event.deviceId,
          phase: 'arp',
          label: 'ARP · Tìm địa chỉ MAC',
          detail: '',
        },
      ];
    if (event.type === 'DROP')
      return [
        {
          kind: 'drop',
          deviceId: event.deviceId,
          phase: 'drop',
          label: 'Gói tin bị chặn',
          detail: event.deviceId,
        },
      ];
    return [];
  });
}

export const packetAnimationKey = (packet) =>
  !packet
    ? ''
    : packet.animationKey ||
      JSON.stringify([
        packet?.success,
        (packet?.events || []).map((event) => [
          event.type,
          event.deviceId,
          event.from,
          event.to,
          event.packet,
        ]),
      ]);
