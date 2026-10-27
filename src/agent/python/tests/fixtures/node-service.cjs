// Test-only HTTP peer. Reuses the real Node signer/validator; no DB/provider calls.
const http = require('node:http');
const { createHash } = require('node:crypto');
const { serviceAuth } = require('../../../node/serviceAuth');
const { schemas, VERSION } = require('@ccna/shared/aiLabContract');
const auth = serviceAuth({ secret: process.env.AI_SERVICE_SECRET });
const tokens = (payload) =>
  Object.fromEntries(
    ['ANALYZE', 'CLAIM', 'RECEIPT'].map((operation) => [
      operation,
      auth.sign(operation, payload, payload.deadlineAt),
    ])
  );
if (process.argv[2] === 'sign') {
  let input = '';
  process.stdin.on('data', (chunk) => {
    input += chunk;
  });
  process.stdin.on('end', () => {
    process.stdout.write(JSON.stringify(tokens(JSON.parse(input))));
  });
} else if (process.argv[2] === 'serve') {
  let claimed = false;
  let claimCount = 0;
  let receiptCount = 0;
  let receiptHash = null;
  const server = http.createServer(async (req, res) => {
    const reply = (status, value) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'X-AI-Contract-Version': VERSION,
      });
      res.end(JSON.stringify(value));
    };
    if (req.url === '/test/stats') {
      reply(200, { claimCount, receiptCount, receiptHash });
      return;
    }
    try {
      const operation = req.url.endsWith('/claim') ? 'CLAIM' : 'RECEIPT';
      if (req.method !== (operation === 'CLAIM' ? 'POST' : 'PUT')) throw new Error();
      const claims = auth.verify(req.headers.authorization, operation);
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 65536) throw new Error();
      }
      const body = (operation === 'CLAIM' ? schemas.ClaimRequest : schemas.ProviderReceipt).parse(
        JSON.parse(raw)
      );
      for (const key of ['requestId', 'callId', 'contextHash', 'leaseVersion']) {
        if (body[key] !== claims[key]) throw new Error();
      }
      if (!req.url.includes(`/provider-calls/${body.callId}/`)) throw new Error();
      if (operation === 'CLAIM') {
        claimCount += 1;
        if (claimed) {
          reply(409, {
            contractVersion: VERSION,
            error: { code: 'AI_DISPATCH_ALREADY_CLAIMED', message: 'AI_DISPATCH_ALREADY_CLAIMED' },
          });
          return;
        }
        claimed = true;
        reply(200, {
          contractVersion: VERSION,
          data: {
            callId: body.callId,
            contextHash: body.contextHash,
            leaseVersion: body.leaseVersion,
            dispatchAuthorized: true,
            deadlineAt: process.env.PY01_TEST_DEADLINE,
          },
        });
      } else {
        if (!claimed) throw new Error();
        receiptCount += 1;
        receiptHash = createHash('sha256').update(raw).digest('hex');
        reply(200, {
          contractVersion: VERSION,
          data: { callId: body.callId, receiptHash, recorded: true },
        });
      }
    } catch {
      reply(401, {
        contractVersion: VERSION,
        error: { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' },
      });
    }
  });
  server.listen(0, '127.0.0.1', () => {
    process.stdout.write(JSON.stringify({ port: server.address().port }) + '\n');
  });
} else throw new Error('Use sign or serve');
