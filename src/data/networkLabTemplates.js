const port = (name, ip) => ({ name, shutdown: false, ...(ip ? { ipAddress: ip, subnetMask: '255.255.255.0' } : {}) });
const endpoint = (deviceId, name) => ({ deviceId, interface: name });
export const networkTemplate = {
  devices: [
    { id: 'PC1', hostname: 'PC1', deviceType: 'PC', position: { x: 100, y: 280 }, interfaces: [port('GigabitEthernet0/0', '192.168.1.10')] },
    { id: 'R1', hostname: 'R1', deviceType: 'ROUTER', position: { x: 360, y: 280 }, interfaces: [port('GigabitEthernet0/0', '192.168.1.1'), port('GigabitEthernet0/1', '10.0.0.1')] },
    { id: 'R2', hostname: 'R2', deviceType: 'ROUTER', position: { x: 640, y: 280 }, interfaces: [port('GigabitEthernet0/0', '10.0.0.2'), port('GigabitEthernet0/1', '192.168.2.1')] },
    { id: 'PC2', hostname: 'PC2', deviceType: 'PC', position: { x: 900, y: 280 }, interfaces: [port('GigabitEthernet0/0', '192.168.2.10')] },
  ],
  links: [
    { id: 'LAN1', a: endpoint('PC1', 'GigabitEthernet0/0'), b: endpoint('R1', 'GigabitEthernet0/0'), enabled: true },
    { id: 'WAN', a: endpoint('R1', 'GigabitEthernet0/1'), b: endpoint('R2', 'GigabitEthernet0/0'), enabled: true },
    { id: 'LAN2', a: endpoint('R2', 'GigabitEthernet0/1'), b: endpoint('PC2', 'GigabitEthernet0/0'), enabled: true },
  ],
};
export const networkGradingTemplate = { passingScore: 100, checks: [
  { id: 'forward', type: 'reachable', deviceId: 'PC1', destination: '192.168.2.10', title: 'PC1 ping được PC2', points: 50, hint: 'Kiểm tra gateway trên PC và route trên cả hai router.' },
  { id: 'backward', type: 'reachable', deviceId: 'PC2', destination: '192.168.1.10', title: 'PC2 ping được PC1', points: 50 },
] };
