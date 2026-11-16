const addressOwner = (devices, address) => {
  if (!address) return undefined;
  const entries = Array.isArray(devices)
    ? devices.map((device) => [device.id, device])
    : Object.entries(devices || {});
  return entries.find(([, device]) =>
    Object.values(device.interfaces || {}).some((port) => port.ipAddress === address)
  )?.[0];
};

export function traceSummary(model, devices) {
  const events = model.events || [];
  const packet = events.find((event) => event.raw?.packet)?.raw.packet;
  const src = packet?.src ?? packet?.srcIp;
  const dst = packet?.dst ?? packet?.dstIp;
  const actors = [...new Set(events.flatMap((event) => event.actors || []))];
  const sourceId = addressOwner(devices, src) || events[0]?.from?.deviceId || events[0]?.deviceId;
  const destinationId = addressOwner(devices, dst);
  const local = Boolean(
    src &&
    dst &&
    sourceId &&
    actors.length === 1 &&
    actors[0] === sourceId &&
    !events.some((event) => event.kind === 'frame') &&
    (destinationId === sourceId || src === dst)
  );
  return {
    src,
    dst,
    sourceId,
    protocol: packet?.protocol?.toUpperCase(),
    actors,
    local,
    notice: local
      ? `${packet?.protocol?.toLowerCase() === 'icmp' ? 'Ping' : 'Xử lý'} nội bộ ${sourceId}: IP ${dst} thuộc chính thiết bị này. Gói được xử lý tại ${sourceId}, không đi qua liên kết mạng.`
      : '',
    sequence:
      actors.length > 2 && events.length > 4 && events.some((event) => event.kind === 'frame'),
  };
}
