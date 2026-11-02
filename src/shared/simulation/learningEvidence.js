// Evidence is derived only from successful engine transitions and verification commands.
function recordEvidence(before, state, cause) {
  const events = [];
  state.learningEvidence ||= { passive: {}, metricEdits: {}, hints: {} };
  const evidence = state.learningEvidence;
  const old = before.eigrpNeighbors || {};
  const now = state.eigrpNeighbors || {};
  for (const [key, neighbor] of Object.entries(old)) {
    if (!now[key]) events.push({ type: 'neighbor_down', ...neighbor, state: 'DOWN', cause });
  }
  for (const [key, neighbor] of Object.entries(now)) {
    if (!old[key]) events.push({ type: 'neighbor_up', ...neighbor, cause });
  }
  if (cause?.handler === 'eigrp_passive_interface') {
    const key = `${cause.deviceId}:${cause.interface}`;
    if (
      !cause.negated &&
      events.some(
        (e) =>
          e.type === 'neighbor_down' &&
          e.deviceId === cause.deviceId &&
          e.interface === cause.interface
      )
    ) {
      evidence.passive[key] = { phase: 1 };
    }
    if (
      cause.negated &&
      evidence.passive[key]?.phase === 2 &&
      events.some(
        (e) =>
          e.type === 'neighbor_up' &&
          e.deviceId === cause.deviceId &&
          e.interface === cause.interface
      )
    ) {
      evidence.passive[key].phase = 3;
    }
  }
  if (cause?.handler === 'network_show_eigrp') {
    for (const [key, entry] of Object.entries(evidence.passive)) {
      const [deviceId, interfaceName] = key.split(':');
      if (deviceId !== cause.deviceId) continue;
      const up = Object.values(now).some(
        (n) => n.deviceId === deviceId && n.interface === interfaceName
      );
      if (entry.phase === 1 && !up) entry.phase = 2;
      else if (entry.phase === 3 && up) entry.phase = 4;
    }
  }
  if (['interface_bandwidth', 'interface_delay'].includes(cause?.handler)) {
    evidence.metricEdits[`${cause.deviceId}:${cause.interface}`] = true;
  }
  return events;
}
module.exports = { recordEvidence };
