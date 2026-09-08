const getInterface = (state, name) => state.interfaces?.[name] || null;

const describeValue = (value) => {
  if (value === null || value === undefined || value === '') return 'chưa cấu hình';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const evaluateCheck = (wholeState, check) => {
  const state = wholeState.devices ? wholeState.devices[check.deviceId] || {} : wholeState;
  const networkInterface = check.interface ? getInterface(state, check.interface) : null;
  let passed = false;
  let actual = null;
  let expected = null;

  switch (check.type) {
    case 'reachable': {
      const { transmit } = require('./networkPackets');
      actual = transmit(JSON.parse(JSON.stringify(wholeState)), check.deviceId, check.destination).success; expected = true; passed = actual; break;
    }
    case 'route_exists': {
      const { routeTable, inSubnet } = require('./networkProtocols');
      actual = routeTable(wholeState, check.deviceId).some((r) => inSubnet(check.destination, r.network, r.mask)); expected = true; passed = actual; break;
    }
    case 'ospf_neighbor_full': actual = Object.values(wholeState.ospfNeighbors || {}).some((n) => n.deviceId === check.deviceId && n.neighborId === check.neighborId && n.state === 'FULL'); expected = true; passed = actual; break;
    case 'stp_root': actual = wholeState.stp?.[check.vlanId]?.roots[check.deviceId]; expected = check.deviceId; passed = actual === expected; break;
    case 'acl_exists': actual = Boolean(state.acls?.[check.name]?.length); expected = true; passed = actual; break;
    case 'nat_static_exists': actual = (state.natStatic || []).some((m) => m.local === check.expectedIp && m.global === check.destination); expected = true; passed = actual; break;
    case 'hostname_equals':
      actual = state.hostname;
      expected = check.expected;
      passed = actual === expected;
      break;
    case 'interface_exists':
      actual = Boolean(networkInterface);
      expected = true;
      passed = actual;
      break;
    case 'interface_ip_equals':
      actual = networkInterface
        ? { ipAddress: networkInterface.ipAddress, subnetMask: networkInterface.subnetMask }
        : null;
      expected = { ipAddress: check.expectedIp, subnetMask: check.expectedMask };
      passed = Boolean(networkInterface)
        && networkInterface.ipAddress === check.expectedIp
        && networkInterface.subnetMask === check.expectedMask;
      break;
    case 'interface_enabled':
      actual = networkInterface ? !networkInterface.shutdown : null;
      expected = true;
      passed = actual === true;
      break;
    case 'interface_description_equals':
      actual = networkInterface?.description || '';
      expected = check.expected;
      passed = actual === expected;
      break;
    case 'vlan_exists':
      actual = Boolean(state.vlans?.[check.vlanId]);
      expected = true;
      passed = actual;
      break;
    case 'vlan_name_equals':
      actual = state.vlans?.[check.vlanId]?.name || null;
      expected = check.expected;
      passed = actual === expected;
      break;
    case 'switchport_mode_equals':
      actual = networkInterface?.switchportMode || null;
      expected = check.expected;
      passed = actual === expected;
      break;
    case 'switchport_access_vlan_equals':
      actual = networkInterface?.accessVlan ?? null;
      expected = Number(check.expected);
      passed = Number(actual) === expected;
      break;
    case 'startup_config_saved':
      actual = Boolean(state.startupConfig);
      expected = true;
      passed = actual;
      break;
    default:
      throw new Error(`Unsupported grading check type: ${check.type}`);
  }

  const points = Number(check.points) || 0;
  return {
    id: check.id,
    type: check.type,
    passed,
    points,
    pointsAwarded: passed ? points : 0,
    expected,
    actual,
    message: passed
      ? (check.successMessage || `Đạt yêu cầu: ${check.id}`)
      : (check.message || `Chưa đạt ${check.id}. Mong đợi ${describeValue(expected)}, hiện tại ${describeValue(actual)}.`),
    hint: passed ? null : (check.hint || null),
  };
};

const gradeAttempt = (state, gradingSpec = {}) => {
  const checks = Array.isArray(gradingSpec.checks) ? gradingSpec.checks : [];
  if (checks.length === 0) throw new Error('Grading spec must contain at least one check');

  const results = checks.map((check) => evaluateCheck(state, check));
  const maxPoints = results.reduce((sum, result) => sum + result.points, 0);
  if (maxPoints <= 0) throw new Error('Grading spec total points must be greater than zero');
  const awardedPoints = results.reduce((sum, result) => sum + result.pointsAwarded, 0);
  const score = Math.round((awardedPoints / maxPoints) * 100);
  const passingScore = Number(gradingSpec.passingScore ?? 70);

  return {
    score,
    passingScore,
    passed: score >= passingScore,
    awardedPoints,
    maxPoints,
    checks: results,
  };
};

module.exports = { evaluateCheck, gradeAttempt };
