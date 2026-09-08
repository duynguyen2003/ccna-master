const base = require('./commandProfiles/ccna-basic.json');
const kw = (keyword) => ({ keyword });
const arg = (parameter, type = 'word', extra = {}) => ({ parameter, type, ...extra });
const command = (id, modes, tokens, handler, extra = {}) => ({ id, modes, tokens, handler, ...extra });
const global = ['GLOBAL_CONFIG']; const priv = ['PRIVILEGED_EXEC']; const iface = ['INTERFACE_CONFIG'];
const commands = [
  command('static-route', global, [kw('ip'), kw('route'), arg('network', 'ipv4'), arg('mask', 'subnetMask'), arg('nextHop', 'ipv4')], 'static_route', { negatable: true }),
  command('default-gateway', global, [kw('ip'), kw('default-gateway'), arg('gateway', 'ipv4')], 'default_gateway', { negatable: true }),
  command('router-ospf', global, [kw('router'), kw('ospf'), arg('process', 'integer')], 'router_ospf', { negatable: true, deviceTypes: ['ROUTER'] }),
  command('ospf-network', ['ROUTER_CONFIG'], [kw('network'), arg('network', 'ipv4'), arg('wildcard', 'ipv4'), kw('area'), kw('0')], 'ospf_network', { negatable: true }),
  command('router-id', ['ROUTER_CONFIG'], [kw('router-id'), arg('routerId', 'ipv4')], 'router_id'),
  command('ospf-cost', iface, [kw('ip'), kw('ospf'), kw('cost'), arg('cost', 'integer')], 'ospf_cost'),
  command('stp-priority', global, [kw('spanning-tree'), kw('vlan'), arg('vlanId', 'vlanId'), kw('priority'), arg('priority', 'integer')], 'stp_priority', { deviceTypes: ['SWITCH'] }),
  command('trunk', iface, [kw('switchport'), kw('mode'), kw('trunk')], 'trunk', { deviceTypes: ['SWITCH'] }),
  command('acl', global, [kw('ip'), kw('access-list'), kw('extended'), arg('name')], 'acl'),
  ...['permit', 'deny'].map((action) => command(`acl-${action}`, ['ACL_CONFIG'], [kw(action), arg('rule', 'rest')], `acl_${action}`)),
  command('acl-delete', global, [kw('ip'), kw('access-list'), kw('extended'), arg('name')], 'acl_delete', { negatable: true }),
  command('acl-bind', iface, [kw('ip'), kw('access-group'), arg('name'), arg('direction')], 'acl_bind', { negatable: true }),
  command('nat-inside', iface, [kw('ip'), kw('nat'), kw('inside')], 'nat_inside', { negatable: true }),
  command('nat-outside', iface, [kw('ip'), kw('nat'), kw('outside')], 'nat_outside', { negatable: true }),
  command('nat-static', global, [kw('ip'), kw('nat'), kw('inside'), kw('source'), kw('static'), arg('local', 'ipv4'), arg('global', 'ipv4')], 'nat_static', { negatable: true }),
  command('nat-overload', global, [kw('ip'), kw('nat'), kw('inside'), kw('source'), kw('list'), arg('name'), kw('interface'), arg('interface', 'interface'), kw('overload')], 'nat_overload', { negatable: true }),
  ...[['route', ['ip', 'route']], ['arp', ['arp']], ['mac', ['mac', 'address-table']], ['ospf', ['ip', 'ospf', 'neighbor']], ['stp', ['spanning-tree']], ['acl', ['access-lists']], ['nat', ['ip', 'nat', 'translations']]].map(([id, tokens]) => command(`show-${id}`, priv, [kw('show'), ...tokens.map(kw)], `network_show_${id}`)),
  ...['ping', 'traceroute'].map((id) => command(id, ['USER_EXEC', ...priv], [kw(id), arg('destination', 'ipv4')], id)),
];
// One declaration for positive and negative forms avoids an ambiguous duplicate branch.
const filtered = commands.filter((c) => c.id !== 'acl-delete').map((c) => c.id === 'acl' ? { ...c, negatable: true } : c);
const extendedBase = base.commands.map((c) => ['exit', 'end'].includes(c.id) ? { ...c, modes: [...c.modes, 'ROUTER_CONFIG', 'ACL_CONFIG'] } : c);
module.exports = { id: 'ccna-network-v2', version: '2.0.0', commands: [...extendedBase, ...filtered] };
