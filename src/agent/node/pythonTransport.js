const { VERSION, schemas } = require('@ccna/shared/aiLabContract');
function pythonAnalyze(base, fetcher = fetch) {
  const url = new URL(base);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/internal/v1/lab-assistant/analyze'
  )
    throw new Error('Python analyze URL must be an explicit loopback endpoint');
  return async (value, tokens) => {
    const input = schemas.InternalAnalyzeRequest.parse(value);
    const body = JSON.stringify(input);
    if (Buffer.byteLength(body) > 65536) throw new Error('AI_CONTEXT_TOO_LARGE');
    const generationRemaining = +new Date(input.deadlineAt) - Date.now();
    if (generationRemaining <= 0 || !tokens.analyzeToken) throw new Error('AI_LEASE_LOST');
    const remaining = generationRemaining + 4500;
    const response = await fetcher(url, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: `Bearer ${tokens.analyzeToken}`,
        'X-AI-Claim-Token': tokens.claimToken,
        'X-AI-Receipt-Token': tokens.receiptToken,
        'X-AI-Contract-Version': VERSION,
        'Content-Type': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(Math.min(remaining, 65000)),
    });
    if (!response.ok || response.headers.get('x-ai-contract-version') !== VERSION)
      throw new Error('AI_PYTHON_UNAVAILABLE');
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > 65536) throw new Error('AI_CONTEXT_TOO_LARGE');
      chunks.push(Buffer.from(chunk));
    }
    const ack = schemas.InternalAnalyzeResponse.parse(
      JSON.parse(Buffer.concat(chunks).toString('utf8'))
    );
    if (ack.callId !== input.callId || ack.contextHash !== input.contextHash)
      throw new Error('AI_LEASE_LOST');
    return ack;
  };
}
module.exports = { pythonAnalyze };
