// Server-only text boundary. Shape allowlists are still required: redaction
// cannot determine whether arbitrary prose contains a private grading answer.
/* eslint-disable no-control-regex -- Terminal/control characters must be stripped at this boundary. */
const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(?:AIza[\w-]{20,}|AQ\.[\w-]{20,}|sk-[\w-]{16,})\b/g,
  /\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@[^\s]+/gi,
  /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,
  /\b(?:enable\s+(?:secret|password)|username\s+\S+\s+(?:secret|password)|snmp-server\s+community)\s+[^\r\n]+/gi,
  /["']?\b(?:password|passwd|secret|token|api[_ -]?key|credential|ownerKey|actor[_ -]?id|user[_ -]?id|attempt[_ -]?id|conversation[_ -]?id|gradingSpec|rubric|expected|actual)\b["']?\s*[:=]\s*(?:"[^"\n]*"|'[^'\n]*'|[^\r\n,;}]+)/gi,
];
const normalized = (value) =>
  String(value)
    .normalize('NFKC')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(
      /[\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,
      ''
    );
function redactor(values = []) {
  // Numeric user IDs are removed structurally or as labelled assignments;
  // replacing every occurrence of e.g. "1" would corrupt IPs and revisions.
  const known = [
    ...new Set(values.filter((v) => typeof v === 'string' && v.length >= 4).map(normalized)),
  ].sort((a, b) => b.length - a.length);
  const clean = (value) => {
    let text = normalized(value);
    for (const secret of known) text = text.split(secret).join('[REDACTED]');
    for (const pattern of secretPatterns) text = text.replace(pattern, '[REDACTED]');
    return text;
  };
  return {
    clean,
    text(value, max, fallback = '') {
      return [...clean(typeof value === 'string' ? value : fallback)].slice(0, max).join('');
    },
    safe(value) {
      return typeof value === 'string' && clean(value) === value;
    },
  };
}
const identityValues = (row) => [row?.ownerKey, row?.attemptId, row?.conversationId];
module.exports = { redactor, identityValues };
