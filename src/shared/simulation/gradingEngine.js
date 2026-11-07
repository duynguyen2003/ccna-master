const getInterface = (state, name) => state.interfaces?.[name] || null;
const { startupMatchesRunning } = require('./configSnapshot');
const { orderedChecks } = require('./gradingDependencies');

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
    case 'eigrp_passive_observed':
      actual =
        wholeState.learningEvidence?.passive?.[`${check.deviceId}:${check.interface}`]?.phase === 4;
      expected = true;
      passed = actual;
      break;
    case 'eigrp_metric_exercise': {
      const { inSubnet } = require('./networkProtocols');
      const route = (state.eigrpRoutes || []).find((r) =>
        inSubnet(check.destination, r.network, r.mask)
      );
      actual = {
        edited: Boolean(
          wholeState.learningEvidence?.metricEdits?.[`${check.deviceId}:${check.interface}`]
        ),
        metric: route?.cost ?? null,
        delayMicroseconds: networkInterface?.delayMicroseconds ?? null,
      };
      expected = {
        edited: true,
        metric: check.expectedMetric,
        delayMicroseconds: check.expectedDelayMicroseconds,
      };
      passed =
        actual.edited &&
        actual.metric === expected.metric &&
        actual.delayMicroseconds === expected.delayMicroseconds;
      break;
    }
    case 'reachable': {
      const { transmit } = require('./networkPackets');
      const transmission = transmit(
        JSON.parse(JSON.stringify(wholeState)),
        check.deviceId,
        check.destination
      );
      const unexpectedRoutes = check.protocol
        ? transmission.events
            .filter(
              (event) =>
                event.type === 'ROUTE' && !['C', check.protocol].includes(event.routeProtocol)
            )
            .map(({ deviceId, routeProtocol, reply }) => ({
              deviceId,
              protocol: routeProtocol,
              reply,
            }))
        : [];
      actual = check.protocol
        ? { reachable: transmission.success, unexpectedRoutes }
        : transmission.success;
      expected = check.protocol ? { reachable: true, unexpectedRoutes: [] } : true;
      passed = transmission.success && unexpectedRoutes.length === 0;
      break;
    }
    case 'route_exists': {
      const { routeTable, inSubnet } = require('./networkProtocols');
      const matches = (r) => inSubnet(check.destination, r.network, r.mask);
      let routes = routeTable(wholeState, check.deviceId);
      if (check.source === 'learned') {
        routes = check.protocol === 'D' ? state.eigrpRoutes || [] : state.ospfRoutes || [];
      } else if (check.source === 'selected') {
        const selected = routes.find(matches);
        routes = selected ? [selected] : [];
      }
      actual = routes.some((r) => matches(r) && (!check.protocol || r.protocol === check.protocol));
      expected = true;
      passed = actual;
      break;
    }
    case 'ospf_neighbor_full':
      actual = Object.values(wholeState.ospfNeighbors || {}).some(
        (n) =>
          n.deviceId === check.deviceId && n.neighborId === check.neighborId && n.state === 'FULL'
      );
      expected = true;
      passed = actual;
      break;
    case 'eigrp_as_configured':
      actual = state.eigrp?.asNumber ?? null;
      expected = check.asNumber;
      passed = actual === expected;
      break;
    case 'eigrp_neighbor_up':
      actual = Object.values(wholeState.eigrpNeighbors || {}).some(
        (neighbor) =>
          neighbor.deviceId === check.deviceId &&
          neighbor.neighborId === check.neighborId &&
          neighbor.state === 'UP'
      );
      expected = true;
      passed = actual;
      break;
    case 'eigrp_static_neighbor':
      actual = (state.eigrp?.neighbors || []).some(
        (neighbor) =>
          neighbor.interface === check.interface && neighbor.address === check.neighborIp
      );
      expected = { interface: check.interface, neighborIp: check.neighborIp };
      passed = actual;
      break;
    case 'stp_root':
      actual = wholeState.stp?.[check.vlanId]?.roots[check.deviceId];
      expected = check.deviceId;
      passed = actual === expected;
      break;
    case 'acl_exists':
      actual = Boolean(state.acls?.[check.name]?.length);
      expected = true;
      passed = actual;
      break;
    case 'nat_static_exists':
      actual = (state.natStatic || []).some(
        (m) => m.local === check.expectedIp && m.global === check.destination
      );
      expected = true;
      passed = actual;
      break;
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
      passed =
        Boolean(networkInterface) &&
        networkInterface.ipAddress === check.expectedIp &&
        networkInterface.subnetMask === check.expectedMask;
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
      actual = check.matchesRunning ? startupMatchesRunning(state) : Boolean(state.startupConfig);
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
      ? check.successMessage || `Đạt yêu cầu: ${check.id}`
      : check.message ||
        `Chưa đạt ${check.id}. Mong đợi ${describeValue(expected)}, hiện tại ${describeValue(actual)}.`,
    hint: passed ? null : check.hints?.[0] || check.hint || null,
  };
};

const gradeAttempt = (state, gradingSpec = {}) => {
  const checks = Array.isArray(gradingSpec.checks) ? gradingSpec.checks : [];
  if (checks.length === 0) throw new Error('Grading spec must contain at least one check');

  const byId = new Map();
  for (const check of orderedChecks(checks)) {
    const blockedBy = (check.dependsOn || []).filter((id) => !byId.get(id).passed);
    byId.set(
      check.id,
      blockedBy.length
        ? {
            id: check.id,
            type: check.type,
            status: 'blocked',
            passed: false,
            points: Number(check.points) || 0,
            pointsAwarded: 0,
            expected: null,
            actual: null,
            blockedBy,
            message: `Cần hoàn thành trước: ${blockedBy.join(', ')}.`,
            hint: null,
          }
        : evaluateCheck(state, check)
    );
  }
  const results = checks.map((check) => byId.get(check.id));
  const maxPoints = results.reduce((sum, result) => sum + result.points, 0);
  if (maxPoints <= 0) throw new Error('Grading spec total points must be greater than zero');
  const awardedPoints = results.reduce((sum, result) => sum + result.pointsAwarded, 0);
  const score = Math.round((awardedPoints / maxPoints) * 100);
  const passingScore = Number(gradingSpec.passingScore ?? 70);
  const requiredPassed = checks.every((check) => !check.required || byId.get(check.id).passed);
  const passed = score >= passingScore && requiredPassed;
  const skills = Object.create(null);
  checks.forEach((check) => {
    if (!check.skill) return;
    skills[check.skill] ||= { points: 0, awarded: 0 };
    skills[check.skill].points += check.points;
    skills[check.skill].awarded += byId.get(check.id).pointsAwarded;
  });

  return {
    score,
    ...(gradingSpec.policyVersion !== undefined
      ? { policyVersion: gradingSpec.policyVersion }
      : {}),
    passingScore,
    passed,
    ...(gradingSpec.masteryScore
      ? { mastered: passed && score >= gradingSpec.masteryScore, requiredPassed }
      : {}),
    ...(Object.keys(skills).length ? { skills } : {}),
    awardedPoints,
    maxPoints,
    checks: results,
  };
};

module.exports = { evaluateCheck, gradeAttempt };
