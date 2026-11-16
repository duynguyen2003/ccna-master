const tones = new Set(['blue', 'green', 'amber', 'violet', 'teal', 'slate']);

export function packetTone(event) {
  if (event?.failure) return 'danger';
  if (tones.has(event?.raw?.color)) return event.raw.color;
  const type = event?.type || event?.raw?.type || '';
  if (type.startsWith('ARP_')) return 'amber';
  if (type.startsWith('NAT_')) return 'teal';
  return event?.phase === 'arp' ? 'amber' : event?.phase === 'reply' ? 'green' : 'blue';
}

export function packetTitle(event) {
  const type = event?.type || event?.raw?.type;
  if (type?.startsWith('ARP_') || type === 'TTL_EXCEEDED') return type.replaceAll('_', ' ');
  if (type === 'NAT_SOURCE') return 'SNAT';
  if (type === 'NAT_DESTINATION') return 'DNAT';
  const protocol = event?.raw?.packet?.protocol?.toUpperCase();
  if (type === 'FRAME' && protocol)
    return `${protocol} · ${event.phase === 'reply' ? 'Phản hồi' : 'Yêu cầu'}`;
  return event?.label || '';
}

export function packetPayload(event) {
  if (Array.isArray(event?.raw?.payload)) return event.raw.payload.map(String);
  const packet = event?.raw?.packet;
  const type = event?.type || event?.raw?.type || '';
  if (type.startsWith('ARP_'))
    return [event.raw?.detail, event.raw?.srcMac ? `MAC ${event.raw.srcMac}` : ''].filter(Boolean);
  if (!packet) return [];
  const src = packet.src ?? packet.srcIp;
  const dst = packet.dst ?? packet.dstIp;
  return [
    src && dst ? `${src} → ${dst}` : '',
    [packet.protocol?.toUpperCase(), packet.ttl != null ? `TTL ${packet.ttl}` : '']
      .filter(Boolean)
      .join(' · '),
  ].filter(Boolean);
}
