#!/usr/bin/env node
const fs = require('node:fs');
const { Client } = require('pg');
const { runtimeConfig } = require('../node/workerConfig');
const {
  productionPlan,
  inspectProduction,
  previewProduction,
  applyProduction,
} = require('../node/productionPolicy');

function parseArgs(args) {
  const parsed = { apply: false, disable: false, config: null, actorId: null };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (seen.has(key)) throw new Error('AI_PRODUCTION_ARGUMENTS');
    seen.add(key);
    if (key === '--apply') parsed.apply = true;
    else if (key === '--disable') parsed.disable = true;
    else if (key === '--config' && args[i + 1]) parsed.config = args[++i];
    else if (key === '--actor' && /^[1-9][0-9]*$/.test(args[i + 1] || ''))
      parsed.actorId = Number(args[++i]);
    else if (key !== '--status') throw new Error('AI_PRODUCTION_ARGUMENTS');
  }
  if (
    (parsed.disable && (!parsed.actorId || parsed.config)) ||
    (parsed.actorId && !parsed.disable) ||
    (parsed.apply && !parsed.disable && !parsed.config) ||
    (seen.has('--status') && args.length !== 1)
  )
    throw new Error('AI_PRODUCTION_ARGUMENTS');
  return parsed;
}

async function checkProvider(env) {
  const model = env.GEMINI_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
    {
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY },
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    }
  );
  if (!response.ok) throw new Error('AI_PRODUCTION_PROVIDER_UNAVAILABLE');
  const data = await response.json();
  if (
    data.name !== `models/${model}` ||
    !data.supportedGenerationMethods?.includes('generateContent')
  )
    throw new Error('AI_PRODUCTION_MODEL_UNAVAILABLE');
}

async function main(args = process.argv.slice(2)) {
  require('../../backend/src/config/env');
  const options = parseArgs(args);
  const config = runtimeConfig();
  let plan;
  if (options.disable) {
    if (process.env.NODE_ENV !== 'production' || process.env.AI_ENVIRONMENT !== 'production')
      throw new Error('AI_PRODUCTION_NOT_CONFIGURED');
    plan = { actorId: options.actorId };
  } else if (options.config) {
    if (fs.statSync(options.config).size > 65536) throw new Error('AI_PRODUCTION_INVALID_PLAN');
    plan = productionPlan(process.env, JSON.parse(fs.readFileSync(options.config, 'utf8')));
  }
  if (plan && !options.disable) await checkProvider(process.env);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 15000,
  });
  await client.connect();
  try {
    if (options.apply) {
      const result = await applyProduction(client, plan, { disable: options.disable });
      console.log(
        JSON.stringify({ mode: 'apply', ...result, ...(await inspectProduction(client)) })
      );
    } else {
      await client.query('BEGIN READ ONLY');
      const status = await inspectProduction(client);
      console.log(
        JSON.stringify({
          mode: 'dry-run',
          runtimeEnvironment: config.environment,
          productionRuntimeEnabled: config.providers['gemini-production-v1'].dispatchEnabled,
          ...status,
          ...(plan
            ? { targetChecks: await previewProduction(client, plan, { disable: options.disable }) }
            : {}),
          ...(plan ? { plannedAction: options.disable ? 'disable' : 'enable', plan } : {}),
        })
      );
      await client.query('ROLLBACK');
    }
  } finally {
    await client.end();
  }
}

if (require.main === module)
  main().catch((error) => {
    const code = /^AI_PRODUCTION_[A-Z_]+$/.test(error.message)
      ? error.message
      : error.code || 'AI_PRODUCTION_SETUP_FAILED';
    console.error(JSON.stringify({ error: code }));
    process.exitCode = 1;
  });
module.exports = { parseArgs, checkProvider, main };
