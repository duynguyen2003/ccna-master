const { performance } = require('node:perf_hooks');
const engine = require('./networkEngine');
const { transmit } = require('./networkPackets');
const endpoint = (deviceId, name) => ({ deviceId, interface: name });
const devices = Array.from({ length: 24 }, (_, i) => ({ id: `N${i}`, deviceType: i === 0 || i === 23 ? 'PC' : 'SWITCH', interfaces: i === 0 || i === 23 ? [{ name: 'GigabitEthernet0/0', ipAddress: i === 0 ? '10.0.0.1' : '10.0.0.2', subnetMask: '255.255.255.0', shutdown: false }] : ['GigabitEthernet0/0', 'GigabitEthernet0/1'] }));
const links = Array.from({ length: 23 }, (_, i) => ({ id: `L${i}`, a: endpoint(`N${i}`, i === 0 ? 'GigabitEthernet0/0' : 'GigabitEthernet0/1'), b: endpoint(`N${i + 1}`, 'GigabitEthernet0/0'), enabled: true }));
const state = engine.initial({ devices, links });
const samples = []; const start = performance.now();
for (let i = 0; i < 500; i++) {
  const before = performance.now();
  const result = transmit(JSON.parse(JSON.stringify(state)), 'N0', '10.0.0.2');
  if (!result.success) throw new Error(result.reason);
  samples.push(performance.now() - before);
}
samples.sort((a, b) => a - b);
console.log(JSON.stringify({ nodes: 24, links: 23, packets: 500, p50Ms: +samples[250].toFixed(3), p95Ms: +samples[475].toFixed(3), maxMs: +samples[499].toFixed(3), elapsedMs: +(performance.now() - start).toFixed(1), rssMiB: +(process.memoryUsage().rss / 1048576).toFixed(1) }, null, 2));
