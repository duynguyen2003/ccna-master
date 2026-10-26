const jwt = require('jsonwebtoken');
const { schemas, VERSION } = require('@ccna/shared/aiLabContract');
const { fail } = require('./quota');
function serviceAuth(config) {
  const { secret, issuer = 'ccna-node', subject = 'ai-python', keyId = 'local-v1' } = config;
  const ready = () => {
    if (typeof secret !== 'string' || secret.length < 32) throw fail('AI_DISABLED');
  };
  return {
    sign(operation, binding, expiresAt) {
      ready();
      const iat = Math.floor(Date.now() / 1000);
      const exp = Math.min(iat + 60, Math.floor(+new Date(expiresAt) / 1000));
      if (exp <= iat) throw fail('AI_LEASE_LOST');
      const claims = schemas.ServiceClaims.parse({
        contractVersion: VERSION,
        requestId: binding.requestId,
        callId: binding.callId || binding.id,
        contextHash: binding.contextHash,
        leaseVersion: binding.leaseVersion,
        operation,
        aud: `ai-${operation.toLowerCase()}`,
        iss: issuer,
        sub: subject,
        keyId,
        iat,
        exp,
      });
      return jwt.sign(claims, secret, { algorithm: 'HS256', header: { kid: keyId } });
    },
    verify(authorization, operation) {
      ready();
      try {
        if (!/^Bearer [^\s]+$/.test(authorization || '')) throw new Error();
        const token = authorization.slice(7);
        const verified = jwt.verify(token, secret, {
          algorithms: ['HS256'],
          issuer,
          subject,
          audience: `ai-${operation.toLowerCase()}`,
          complete: true,
        });
        const claims = schemas.ServiceClaims.parse(verified.payload);
        const now = Math.floor(Date.now() / 1000);
        if (
          verified.header.kid !== keyId ||
          claims.keyId !== keyId ||
          claims.operation !== operation ||
          claims.iat > now ||
          claims.exp <= claims.iat ||
          claims.exp - claims.iat > 60
        )
          throw new Error();
        return claims;
      } catch {
        throw fail('UNAUTHORIZED');
      }
    },
  };
}
module.exports = { serviceAuth };
