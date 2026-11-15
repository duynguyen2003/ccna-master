// A probe trace is serial, but ARP and DROP snapshots are not forwarding evidence.
// Compare only a local decision with the preceding recorded packet at that actor.
export function compareObservationEvent(events, index) {
  const event = events[index];
  if (!event || !['ROUTE', 'TTL_EXCEEDED', 'NAT_SOURCE', 'NAT_DESTINATION'].includes(event.type))
    return null;
  const previous = events[index - 1];
  if (!previous || previous.phase !== event.phase || previous.deviceId !== event.deviceId)
    return null;
  const allowedPrevious =
    event.type === 'NAT_SOURCE'
      ? ['ROUTE']
      : event.type === 'NAT_DESTINATION'
        ? ['ACL_IN']
        : ['ACL_IN', 'NAT_DESTINATION'];
  if (!allowedPrevious.includes(previous.type)) return null;
  const before = previous.raw.packet;
  const after = event.raw.packet;
  if (!before || !after || !before.protocol || before.protocol !== after.protocol) return null;
  const translated =
    event.type === 'NAT_SOURCE'
      ? ['src', 'srcPort']
      : event.type === 'NAT_DESTINATION'
        ? ['dst', 'dstPort']
        : ['ttl'];
  const identity = ['src', 'dst', 'srcPort', 'dstPort'].filter(
    (field) => !translated.includes(field)
  );
  if (!before.src || !before.dst || identity.some((field) => before[field] !== after[field]))
    return null;
  const names = {
    src: 'IP nguồn',
    dst: 'IP đích',
    srcPort: 'Cổng nguồn',
    dstPort: 'Cổng đích',
    ttl: 'TTL',
  };
  const ports = ['tcp', 'udp'].includes(after.protocol.toLowerCase());
  const fields = translated
    .filter(
      (field) =>
        (ports || !field.endsWith('Port')) &&
        before[field] !== undefined &&
        after[field] !== undefined &&
        before[field] !== after[field]
    )
    .map((field) => ({ label: names[field], before: before[field], after: after[field] }));
  return fields.length ? { from: previous.index, to: event.index, fields } : null;
}
