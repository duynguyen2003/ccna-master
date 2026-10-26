const { createHash } = require('node:crypto');
const { VERSION, LIMITS, CATALOG } = require('./catalog');
const { resolveTarget, physicalPaths, probe } = require('./probe');
const { findingsFor } = require('./rules');
const id = (value) =>
  `diag_${createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24)}`;
const rules = new Map(CATALOG.map((rule) => [rule.id, rule]));

function diagnose(context, request) {
  if (request?.intent !== 'DIAGNOSE')
    return { status: 'INSUFFICIENT_CONTEXT', facts: [], findings: [] };
  let status = 'INSUFFICIENT_CONTEXT';
  let summary = 'Cần một thiết bị nguồn và một địa chỉ đích IPv4 xác định để kiểm tra kết nối.';
  let findings = [];
  let target;
  let trace;
  const types = new Set(context.devices.map((device) => device.deviceType));
  if (
    context.contextTruncated ||
    context.lab.simulatorVersion !== '2.1.0' ||
    context.devices.length > LIMITS.devices ||
    context.links.length > LIMITS.links ||
    (types.has('ROUTER') && types.has('SWITCH')) ||
    context.devices.some(
      (device) =>
        device.routes.length > LIMITS.routes ||
        device.routes.some((route) => route.protocol !== 'S' || !route.nextHop) ||
        device.interfaces.some((port) => port.name.startsWith('Loopback'))
    )
  ) {
    status = 'UNSUPPORTED';
    summary =
      'Dữ liệu bị lược bớt hoặc cấu hình nằm ngoài phạm vi IPv4/static route/VLAN cơ bản đã hỗ trợ; chưa kết luận nguyên nhân.';
  } else {
    target = resolveTarget(context, request);
    if (target?.ambiguous) {
      status = 'HYPOTHESIS';
      summary =
        'Địa chỉ đích chưa duy nhất hoặc thiết bị có nhiều địa chỉ; cần chọn đúng IPv4 trước khi kết luận.';
    } else if (target?.destination) {
      const paths = physicalPaths(context, target.sourceId, target.targetId);
      if (paths.length > 1) {
        status = 'HYPOTHESIS';
        summary =
          'Có nhiều đường vật lý khả dĩ; chưa đủ căn cứ gán lỗi cho một cổng hoặc VLAN cụ thể.';
      } else if (paths.length === 1 && paths[0].length) {
        const result = probe(context, target);
        trace = result.trace;
        findings = findingsFor(context, target, paths[0], result.state, trace);
        if (trace.success) {
          status = 'NO_ISSUE_OBSERVED';
          findings = [];
          summary = `Kết nối ${target.sourceId} tới ${target.destination} đã chuyển được gói đi và gói trả lời trong phạm vi mô phỏng đang xét; không kết luận toàn bài lab đúng.`;
        } else if (findings.length === 1) {
          status = 'SUPPORTED_FINDING';
          summary = findings[0].observation;
        } else if (findings.length > 1) {
          status = 'HYPOTHESIS';
          summary =
            'Có nhiều điểm chặn kết nối được quan sát; cần kiểm từng điểm, chưa quy về một nguyên nhân duy nhất.';
        } else {
          status = 'HYPOTHESIS';
          summary =
            'Gói tin chưa đi và về được, nhưng các quy tắc hiện có chưa xác định được nguyên nhân.';
        }
      } else
        summary = 'Chưa có đường vật lý xác định giữa nguồn và đích trong dữ liệu được cung cấp.';
    }
  }
  const scope = target?.destination
    ? `probe:${target.sourceId}->${target.destination}`
    : 'requested-connectivity';
  const makeFact = (ruleId, observation, key, extra = {}) => ({
    evidenceId: id([VERSION, context.sourceRevision, scope, ruleId, key, observation]),
    kind: rules.get(ruleId)?.kind || 'TRACE',
    ...extra,
    sourceRevision: context.sourceRevision,
    observation,
    confidenceClass: rules.get(ruleId)?.confidence || 'INFERRED',
    scope,
    provenance: {
      source: 'DIAGNOSTIC',
      reference: `${ruleId}:${key}`.slice(0, 200),
      version: VERSION,
    },
  });
  const facts = findings.map((finding) =>
    makeFact(finding.ruleId, finding.observation, finding.key, {
      ...(finding.deviceId ? { deviceId: finding.deviceId } : {}),
      ...(finding.interface ? { interface: finding.interface } : {}),
    })
  );
  const conclusion = makeFact('CONNECTIVITY_RESULT', summary, status);
  facts.push(conclusion);
  return {
    version: VERSION,
    status,
    summary,
    facts,
    findings,
    conclusion,
    probe: target?.destination
      ? {
          ...target,
          success: trace?.success ?? null,
          requestDelivered: trace?.events.some((event) => event.type === 'DELIVERED') || false,
          replyDelivered: trace?.events.some((event) => event.type === 'REPLY_DELIVERED') || false,
        }
      : null,
  };
}

function diagnosticAnswer(input) {
  const result = diagnose(input.context, input.request);
  if (!result.conclusion) return null;
  return {
    summary: result.summary,
    claimType: result.status,
    evidenceIds: result.facts.map((fact) => fact.evidenceId),
    nextSteps: [],
    verification:
      'Kiểm tra lại cùng nguồn và đích sau mỗi thay đổi; câu trả lời này chỉ xét kết nối đã chọn.',
    hintLevel: 1,
  };
}
module.exports = { diagnose, diagnosticAnswer, VERSION, CATALOG };
