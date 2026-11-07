const port = (name, ipAddress, subnetMask) => ({
  name,
  ipAddress,
  subnetMask,
  shutdown: false,
});

const end = (deviceId, interfaceName) => ({ deviceId, interface: interfaceName });
const link = (id, leftDevice, leftInterface, rightDevice, rightInterface) => ({
  id,
  a: end(leftDevice, leftInterface),
  b: end(rightDevice, rightInterface),
  enabled: true,
});

const initialState = {
  devices: [
    {
      id: 'R1',
      deviceType: 'ROUTER',
      hostname: 'R1',
      position: { x: 140, y: 130 },
      interfaces: [
        port('Loopback0', '1.1.1.1', '255.0.0.0'),
        port('GigabitEthernet1/12', '192.1.12.1', '255.255.255.0'),
      ],
    },
    {
      id: 'R2',
      deviceType: 'ROUTER',
      hostname: 'R2',
      position: { x: 740, y: 130 },
      interfaces: [
        port('Loopback0', '2.2.2.2', '255.0.0.0'),
        port('GigabitEthernet1/12', '192.1.12.2', '255.255.255.0'),
        port('GigabitEthernet1/23', '192.1.23.2', '255.255.255.0'),
      ],
    },
    {
      id: 'R3',
      deviceType: 'ROUTER',
      hostname: 'R3',
      position: { x: 740, y: 450 },
      interfaces: [
        port('Loopback0', '3.3.3.3', '255.0.0.0'),
        port('GigabitEthernet1/23', '192.1.23.3', '255.255.255.0'),
        port('GigabitEthernet1/34', '192.1.34.3', '255.255.255.0'),
      ],
    },
    {
      id: 'R4',
      deviceType: 'ROUTER',
      hostname: 'R4',
      position: { x: 140, y: 450 },
      interfaces: [
        port('Loopback0', '4.4.4.4', '255.0.0.0'),
        port('GigabitEthernet1/34', '192.1.34.4', '255.255.255.0'),
      ],
    },
  ],
  links: [
    link('R1-R2', 'R1', 'GigabitEthernet1/12', 'R2', 'GigabitEthernet1/12'),
    link('R2-R3', 'R2', 'GigabitEthernet1/23', 'R3', 'GigabitEthernet1/23'),
    link('R3-R4', 'R3', 'GigabitEthernet1/34', 'R4', 'GigabitEthernet1/34'),
  ],
};

module.exports = require('./eigrp01Definition').buildEigrpLab(initialState);
