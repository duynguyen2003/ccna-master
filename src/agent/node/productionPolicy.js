const { isDeepStrictEqual } = require('node:util');
const { runtimeConfig } = require('./workerConfig');
const { costOf } = require('./settlement');

const fail = (code) => Object.assign(new Error(code), { code });
const environment = 'production';
const positiveId = (id) => Number.isSafeInteger(id) && id > 0 && id <= 2147483647;
function ids(values) {
  if (!Array.isArray(values) || values.length > 200 || values.some((id) => !positiveId(id)))
    throw fail('AI_PRODUCTION_INVALID_IDS');
  if (new Set(values).size !== values.length) throw fail('AI_PRODUCTION_DUPLICATE_IDS');
  return [...values].sort((a, b) => a - b);
}

function productionPlan(env, proposal) {
  const config = runtimeConfig(env);
  if (!config.enabled || config.environment !== environment || env.NODE_ENV !== 'production')
    throw fail('AI_PRODUCTION_NOT_CONFIGURED');
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal))
    throw fail('AI_PRODUCTION_INVALID_PLAN');
  const keys = ['actorId', 'studentAccess', 'userIds', 'labIds', 'limits'];
  if (Object.keys(proposal).some((key) => !keys.includes(key)) || !positiveId(proposal.actorId))
    throw fail('AI_PRODUCTION_INVALID_PLAN');
  const labIds = ids(proposal.labIds);
  const userIds = ids(proposal.userIds || []);
  if (!labIds.length || typeof proposal.studentAccess !== 'boolean')
    throw fail('AI_PRODUCTION_SELECT_LABS');
  if (!proposal.studentAccess && !userIds.length) throw fail('AI_PRODUCTION_SELECT_STUDENTS');
  const l = proposal.limits;
  const limitKeys = [
    'userMinute',
    'userDay',
    'globalDayMicros',
    'globalMonthMicros',
    'globalConcurrency',
  ];
  if (
    !l ||
    Object.keys(l).some((key) => !limitKeys.includes(key)) ||
    limitKeys.some((key) => !Number.isSafeInteger(l[key]) || l[key] < 1) ||
    l.userMinute > 60 ||
    l.userDay > 1000 ||
    l.globalConcurrency > 8 ||
    l.globalMonthMicros < l.globalDayMicros
  )
    throw fail('AI_PRODUCTION_INVALID_LIMITS');
  const provider = config.providers['gemini-production-v1'];
  const maxCostMicros = Number(
    costOf(provider, {
      status: 'FINAL',
      inputTokens: provider.caps.maxInputTokens,
      outputTokens: provider.caps.maxOutputTokens,
      reasoningTokens: provider.caps.maxReasoningTokens,
    })
  );
  if (l.globalDayMicros < maxCostMicros) throw fail('AI_PRODUCTION_BUDGET_TOO_SMALL');
  return {
    actorId: proposal.actorId,
    environment,
    providerConfigId: 'gemini-production-v1',
    admissionEnabled: true,
    dispatchEnabled: true,
    eligibilityRules: {
      adminAccess: false,
      studentAccess: proposal.studentAccess,
      userIds,
      labIds,
    },
    limits: { ...l, maxCostMicros, versions: provider.versions },
  };
}

async function inspectProduction(client) {
  const exists = await client.query(
    "SELECT to_regclass('public.ai_runtime_policies') IS NOT NULL AS ready"
  );
  if (!exists.rows[0].ready) return { schemaReady: false, policy: null };
  const { rows } = await client.query(
    'SELECT environment, version, admission_enabled, dispatch_enabled, provider_config_id, eligibility_rules, limits FROM ai_runtime_policies WHERE environment=$1',
    [environment]
  );
  const p = rows[0];
  return {
    schemaReady: true,
    policy: p
      ? {
          environment: p.environment,
          version: p.version,
          admissionEnabled: p.admission_enabled,
          dispatchEnabled: p.dispatch_enabled,
          providerConfigId: p.provider_config_id,
          studentAccess: p.eligibility_rules.studentAccess === true,
          userAllowlistCount: p.eligibility_rules.userIds?.length || 0,
          labAllowlistCount: p.eligibility_rules.labIds?.length || 0,
          limits: p.limits,
        }
      : null,
  };
}

async function previewProduction(client, plan, { disable = false } = {}) {
  if (!positiveId(plan?.actorId)) throw fail('AI_PRODUCTION_ADMIN_REQUIRED');
  const actor = await client.query(
    "SELECT id FROM users WHERE id=$1 AND role='ADMIN' AND is_active=true AND deleted_at IS NULL",
    [plan.actorId]
  );
  if (!actor.rows.length) throw fail('AI_PRODUCTION_ADMIN_REQUIRED');
  if (disable) return { actorVerified: true };
  const labs = await client.query(
    "SELECT id FROM labs WHERE id=ANY($1::int[]) AND status='PUBLISHED' AND deleted_at IS NULL",
    [plan.eligibilityRules.labIds]
  );
  if (labs.rows.length !== plan.eligibilityRules.labIds.length)
    throw fail('AI_PRODUCTION_LABS_UNAVAILABLE');
  if (plan.eligibilityRules.userIds.length) {
    const students = await client.query(
      "SELECT id FROM users WHERE id=ANY($1::int[]) AND role='STUDENT' AND is_active=true AND deleted_at IS NULL",
      [plan.eligibilityRules.userIds]
    );
    if (students.rows.length !== plan.eligibilityRules.userIds.length)
      throw fail('AI_PRODUCTION_STUDENTS_UNAVAILABLE');
  }
  return { actorVerified: true, publishedLabCount: labs.rows.length };
}

async function applyProduction(client, plan, { disable = false } = {}) {
  if (!positiveId(plan?.actorId)) throw fail('AI_PRODUCTION_ADMIN_REQUIRED');
  await client.query('BEGIN');
  try {
    const actor = await client.query(
      "SELECT id FROM users WHERE id=$1 AND role='ADMIN' AND is_active=true AND deleted_at IS NULL FOR SHARE",
      [plan.actorId]
    );
    if (!actor.rows.length) throw fail('AI_PRODUCTION_ADMIN_REQUIRED');
    // Admission locks the policy before its advisory lock. Use that same order.
    // Seed a disabled row so concurrent first-time setup also has a row to lock.
    await client.query(
      `INSERT INTO ai_runtime_policies (environment,version,admission_enabled,dispatch_enabled,eligibility_rules,limits,updated_by,updated_at)
       VALUES ($1,1,false,false,'{}'::jsonb,'{}'::jsonb,$2,now()) ON CONFLICT DO NOTHING`,
      [environment, plan.actorId]
    );
    const current = await client.query(
      'SELECT * FROM ai_runtime_policies WHERE environment=$1 FOR UPDATE',
      [environment]
    );
    const old = current.rows[0];
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 1))', [
      `ai-admission:${environment}`,
    ]);
    if (disable) {
      await client.query(
        'UPDATE ai_runtime_policies SET admission_enabled=false, dispatch_enabled=false, version=version+1, updated_by=$2, updated_at=now() WHERE environment=$1 AND (admission_enabled OR dispatch_enabled)',
        [environment, plan.actorId]
      );
      await client.query('COMMIT');
      return { disabled: true };
    }
    const labs = await client.query(
      "SELECT id FROM labs WHERE id=ANY($1::int[]) AND status='PUBLISHED' AND deleted_at IS NULL FOR SHARE",
      [plan.eligibilityRules.labIds]
    );
    if (labs.rows.length !== plan.eligibilityRules.labIds.length)
      throw fail('AI_PRODUCTION_LABS_UNAVAILABLE');
    if (plan.eligibilityRules.userIds.length) {
      const users = await client.query(
        "SELECT id FROM users WHERE id=ANY($1::int[]) AND role='STUDENT' AND is_active=true AND deleted_at IS NULL FOR SHARE",
        [plan.eligibilityRules.userIds]
      );
      if (users.rows.length !== plan.eligibilityRules.userIds.length)
        throw fail('AI_PRODUCTION_STUDENTS_UNAVAILABLE');
    }
    const unchanged =
      old?.admission_enabled &&
      old.dispatch_enabled &&
      old.provider_config_id === plan.providerConfigId &&
      isDeepStrictEqual(old.eligibility_rules, plan.eligibilityRules) &&
      isDeepStrictEqual(old.limits, plan.limits);
    if (!unchanged) {
      const pending = await client.query(
        `SELECT count(DISTINCT r.id)::int AS count FROM ai_requests r
         JOIN ai_reservations z ON z.request_id=r.id JOIN ai_quota_buckets b ON b.id=z.bucket_id
         WHERE b.scope_type='GLOBAL_DAY' AND b.scope_key=$1 AND r.status IN ('QUEUED','RUNNING')`,
        [environment]
      );
      if (pending.rows[0].count) throw fail('AI_PRODUCTION_DRAIN_REQUIRED');
      await client.query(
        `INSERT INTO ai_runtime_policies (environment, version, admission_enabled, dispatch_enabled, eligibility_rules, limits, provider_config_id, updated_by, updated_at)
         VALUES ($1,1,true,true,$2::jsonb,$3::jsonb,$4,$5,now())
         ON CONFLICT (environment) DO UPDATE SET version=ai_runtime_policies.version+1,
           admission_enabled=true,dispatch_enabled=true,eligibility_rules=EXCLUDED.eligibility_rules,
           limits=EXCLUDED.limits,provider_config_id=EXCLUDED.provider_config_id,
           updated_by=EXCLUDED.updated_by,updated_at=now()`,
        [
          environment,
          JSON.stringify(plan.eligibilityRules),
          JSON.stringify(plan.limits),
          plan.providerConfigId,
          plan.actorId,
        ]
      );
      // Change ceilings only. Preserve usage, spend and outstanding reservations.
      await client.query(
        `UPDATE ai_quota_buckets SET
         limit_micros=GREATEST(spent_micros+reserved_micros,CASE scope_type WHEN 'GLOBAL_DAY' THEN $2::bigint WHEN 'GLOBAL_MONTH' THEN $3::bigint ELSE limit_micros END),
         limit_units=GREATEST(used_units+reserved_units,CASE scope_type WHEN 'USER_DAY' THEN $4::int WHEN 'USER_MINUTE' THEN $5::int ELSE limit_units END)
         WHERE (scope_type IN ('GLOBAL_DAY','GLOBAL_MONTH') AND scope_key=$1)
            OR (scope_type IN ('USER_DAY','USER_MINUTE') AND starts_with(scope_key,$1||':'))`,
        [
          environment,
          plan.limits.globalDayMicros,
          plan.limits.globalMonthMicros,
          plan.limits.userDay,
          plan.limits.userMinute,
        ]
      );
      const occupied = await client.query(
        'SELECT slot_number FROM ai_execution_slots WHERE environment=$1 AND request_id IS NOT NULL',
        [environment]
      );
      if (occupied.rows.length) throw fail('AI_PRODUCTION_DRAIN_REQUIRED');
      await client.query(
        'DELETE FROM ai_execution_slots WHERE environment=$1 AND slot_number >= $2 AND request_id IS NULL',
        [environment, plan.limits.globalConcurrency]
      );
      for (let slot = 0; slot < plan.limits.globalConcurrency; slot++)
        await client.query(
          'INSERT INTO ai_execution_slots (environment,slot_number,lease_version) VALUES ($1,$2,0) ON CONFLICT DO NOTHING',
          [environment, slot]
        );
    }
    await client.query('COMMIT');
    return { enabled: true, changed: !unchanged };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

module.exports = { productionPlan, inspectProduction, previewProduction, applyProduction };
