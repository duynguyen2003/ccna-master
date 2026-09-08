const ALLOWED_TAGS = new Set(['a', 'b', 'br', 'code', 'em', 'h2', 'h3', 'h4', 'i', 'li', 'ol', 'p', 'pre', 'strong', 'u', 'ul']);
const ALLOWED_ATTRIBUTES = new Set(['class', 'title', 'target', 'rel', 'href']);

const safeUrl = (value, attribute) => {
  const url = String(value || '').trim();
  if (attribute === 'href') return /^(#|\/|https?:\/\/|mailto:)/i.test(url) ? url : '';
  return '';
};

/**
 * Small, dependency-free allowlist sanitizer for lab guide HTML.
 * Rich text is intentionally limited to formatting and safe links; scripts,
 * event handlers, inline styles and embedded content are discarded.
 */
const sanitizeHtml = (input) => String(input || '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<\s*(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  .replace(/<\s*\/?\s*([a-z][\w:-]*)([^>]*)>/gi, (full, rawTag, rawAttributes) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (full.trim().startsWith('</')) return `</${tag}>`;
    const attributes = [];
    String(rawAttributes || '').replace(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi, (match, rawName, doubleValue, singleValue, bareValue) => {
      const name = rawName.toLowerCase();
      if (!ALLOWED_ATTRIBUTES.has(name)) return match;
      const value = doubleValue ?? singleValue ?? bareValue ?? '';
      if (name === 'href') {
        const url = safeUrl(value, name);
        if (url) attributes.push(`${name}="${url.replace(/"/g, '&quot;')}"`);
      } else if (name !== 'target' || ['_blank', '_self', '_parent', '_top'].includes(value)) {
        attributes.push(`${name}="${String(value).replace(/"/g, '&quot;')}"`);
      }
      return match;
    });
    if (tag === 'a' && attributes.some((attribute) => attribute.startsWith('target="_blank"')) && !attributes.some((attribute) => attribute.startsWith('rel='))) {
      attributes.push('rel="noopener noreferrer"');
    }
    return `<${tag}${attributes.length ? ` ${attributes.join(' ')}` : ''}>`;
  });

module.exports = { sanitizeHtml };
