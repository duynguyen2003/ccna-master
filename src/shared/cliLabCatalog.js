/**
 * Public CLI lab catalog shared by the admin form, student workspace and
 * backend validation. Keep this module browser-safe: it must not import
 * simulation code, filesystem APIs or environment configuration.
 */

const CLI_PROFILE_CATALOG = Object.freeze([
  Object.freeze({
    id: 'ccna-basic-v1',
    label: 'CCNA Basic v1',
    description: 'Một thiết bị: hostname, interface, VLAN và lưu cấu hình.',
    simulatorVersion: '1.0.0',
    topology: false,
  }),
  Object.freeze({
    id: 'ccna-network-v2',
    label: 'CCNA Network v2',
    description: 'Topology nhiều thiết bị: định tuyến, OSPF, STP, ACL và NAT.',
    simulatorVersion: '2.0.0',
    topology: true,
  }),
]);

const CLI_CHECK_CATALOG = Object.freeze([
  Object.freeze({
    type: 'hostname_equals',
    label: 'Hostname khớp',
    description: 'Kiểm tra hostname của thiết bị.',
    fields: Object.freeze(['deviceId', 'expected']),
    supports: 'single-or-topology',
  }),
  Object.freeze({
    type: 'interface_exists',
    label: 'Có interface',
    description: 'Kiểm tra interface tồn tại trên thiết bị.',
    fields: Object.freeze(['deviceId', 'interface']),
    supports: 'single-or-topology',
  }),
  Object.freeze({
    type: 'interface_ip_equals',
    label: 'IP interface khớp',
    description: 'Kiểm tra địa chỉ IP và subnet mask của interface.',
    fields: Object.freeze(['deviceId', 'interface', 'expectedIp', 'expectedMask']),
    supports: 'single-or-topology',
  }),
  Object.freeze({
    type: 'interface_enabled',
    label: 'Interface đang bật',
    description: 'Kiểm tra interface không ở trạng thái shutdown.',
    fields: Object.freeze(['deviceId', 'interface']),
    supports: 'single-or-topology',
  }),
  Object.freeze({
    type: 'interface_description_equals',
    label: 'Mô tả interface khớp',
    description: 'Kiểm tra description của interface.',
    fields: Object.freeze(['deviceId', 'interface', 'expected']),
    supports: 'single-or-topology',
  }),
  Object.freeze({
    type: 'vlan_exists',
    label: 'VLAN tồn tại',
    description: 'Kiểm tra VLAN đã được tạo trên switch.',
    fields: Object.freeze(['deviceId', 'vlanId']),
    supports: 'single-or-topology',
  }),
  Object.freeze({
    type: 'vlan_name_equals',
    label: 'Tên VLAN khớp',
    description: 'Kiểm tra tên VLAN trên switch.',
    fields: Object.freeze(['deviceId', 'vlanId', 'expected']),
    supports: 'single-or-topology',
  }),
  Object.freeze({
    type: 'switchport_mode_equals',
    label: 'Switchport mode khớp',
    description: 'Kiểm tra access hoặc trunk mode của switchport.',
    fields: Object.freeze(['deviceId', 'interface', 'expected']),
    supports: 'single-or-topology',
  }),
  Object.freeze({
    type: 'switchport_access_vlan_equals',
    label: 'Access VLAN khớp',
    description: 'Kiểm tra VLAN access của switchport.',
    fields: Object.freeze(['deviceId', 'interface', 'expected']),
    supports: 'single-or-topology',
  }),
  Object.freeze({
    type: 'startup_config_saved',
    label: 'Đã lưu startup config',
    description: 'Kiểm tra cấu hình đã được lưu vào startup-config.',
    fields: Object.freeze(['deviceId']),
    supports: 'single-or-topology',
  }),
  Object.freeze({
    type: 'reachable',
    label: 'Có thể ping tới',
    description: 'Kiểm tra đường đi hai chiều tới địa chỉ IPv4.',
    fields: Object.freeze(['deviceId', 'destination']),
    supports: 'topology-only',
  }),
  Object.freeze({
    type: 'route_exists',
    label: 'Có route tới',
    description: 'Kiểm tra bảng định tuyến có route bao phủ địa chỉ IPv4.',
    fields: Object.freeze(['deviceId', 'destination']),
    supports: 'topology-only',
  }),
  Object.freeze({
    type: 'ospf_neighbor_full',
    label: 'OSPF neighbor FULL',
    description: 'Kiểm tra adjacency OSPF đã hội tụ tới trạng thái FULL.',
    fields: Object.freeze(['deviceId', 'neighborId']),
    supports: 'topology-only',
  }),
  Object.freeze({
    type: 'stp_root',
    label: 'STP root đúng thiết bị',
    description: 'Kiểm tra thiết bị là root bridge của VLAN.',
    fields: Object.freeze(['deviceId', 'vlanId']),
    supports: 'topology-only',
  }),
  Object.freeze({
    type: 'acl_exists',
    label: 'ACL tồn tại',
    description: 'Kiểm tra named ACL đã có ít nhất một rule.',
    fields: Object.freeze(['deviceId', 'name']),
    supports: 'topology-only',
  }),
  Object.freeze({
    type: 'nat_static_exists',
    label: 'Static NAT tồn tại',
    description: 'Kiểm tra mapping local và global IPv4.',
    fields: Object.freeze(['deviceId', 'expectedIp', 'destination']),
    supports: 'topology-only',
  }),
]);

const SUPPORTED_CLI_PROFILE_IDS = Object.freeze(CLI_PROFILE_CATALOG.map((profile) => profile.id));
const SUPPORTED_CLI_CHECK_TYPES = Object.freeze(CLI_CHECK_CATALOG.map((check) => check.type));

const profileById = (id) => CLI_PROFILE_CATALOG.find((profile) => profile.id === id) || null;
const checkTypeById = (type) => CLI_CHECK_CATALOG.find((check) => check.type === type) || null;

// Aliases keep the catalog discoverable without forcing callers to depend on
// one naming convention while the UI and backend are being migrated together.
module.exports = {
  CLI_PROFILE_CATALOG,
  CLI_CHECK_CATALOG,
  SUPPORTED_CLI_PROFILE_IDS,
  SUPPORTED_CLI_CHECK_TYPES,
  profileById,
  checkTypeById,
  profiles: CLI_PROFILE_CATALOG,
  checkTypes: CLI_CHECK_CATALOG,
  profileCatalog: CLI_PROFILE_CATALOG,
  checkCatalog: CLI_CHECK_CATALOG,
  CLI_LAB_PROFILES: CLI_PROFILE_CATALOG,
  CLI_LAB_CHECK_TYPES: CLI_CHECK_CATALOG,
};
