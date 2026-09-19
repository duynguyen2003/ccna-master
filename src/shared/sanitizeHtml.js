const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5',
  'h6', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'span', 'strong', 'table', 'tbody',
  'td', 'th', 'thead', 'tr', 'u', 'ul',
]);
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input',
  'button', 'textarea', 'select', 'option', 'link', 'meta', 'base', 'template',
  'noscript', 'video', 'audio',
]);

const escapeAttribute = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const safeUrl = (value, attribute) => {
  const url = String(value || '').trim();
  if (!url || Array.from(url).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return '';
  if (attribute === 'href' && (/^#/.test(url) || /^mailto:/i.test(url))) return url;
  if (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url) || /^\.{1,2}\//.test(url)) return url;
  return '';
};

const allowedAttribute = (tag, name, value) => {
  if (name === 'class' && /^[\w\s-]*$/.test(value)) return value;
  if (name === 'title') return value;
  if (tag === 'a' && name === 'href') return safeUrl(value, name);
  if (tag === 'a' && name === 'target' && ['_blank', '_self'].includes(value)) return value;
  if (tag === 'img' && name === 'src') return safeUrl(value, name);
  if (tag === 'img' && name === 'alt') return value;
  return null;
};

const sanitizeWithDom = (input) => {
  const template = document.createElement('template');
  template.innerHTML = input;

  const clean = (parent) => {
    Array.from(parent.childNodes).forEach((node) => {
      if (node.nodeType === 8) {
        node.remove();
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      if (DROP_WITH_CONTENT.has(tag)) {
        node.remove();
        return;
      }
      if (!ALLOWED_TAGS.has(tag)) {
        clean(node);
        node.replaceWith(...Array.from(node.childNodes));
        return;
      }
      Array.from(node.attributes).forEach(({ name, value }) => {
        const safe = allowedAttribute(tag, name.toLowerCase(), value);
        if (safe === null || safe === '') node.removeAttribute(name);
        else node.setAttribute(name, safe);
      });
      if (tag === 'a' && node.getAttribute('target') === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer');
      }
      if (tag === 'img' && !node.getAttribute('src')) {
        node.remove();
        return;
      }
      clean(node);
    });
  };

  clean(template.content);
  return template.innerHTML;
};

// Node uses this path when sanitizing stored lab guides. Browser rendering uses
// the DOM path above so malformed HTML is parsed before any attributes are kept.
const sanitizeWithoutDom = (input) => String(input)
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<\s*(script|style|iframe|object|embed|svg|math|form|button|textarea|select|template|noscript|video|audio)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  .replace(/<\s*\/?\s*([a-z][\w:-]*)([^>]*)>/gi, (full, rawTag, rawAttributes) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (full.trim().startsWith('</')) return `</${tag}>`;
    const attributes = [];
    String(rawAttributes || '').replace(
      /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi,
      (match, rawName, doubleValue, singleValue, bareValue) => {
        const name = rawName.toLowerCase();
        const safe = allowedAttribute(tag, name, doubleValue ?? singleValue ?? bareValue ?? '');
        if (safe !== null && safe !== '') attributes.push(`${name}="${escapeAttribute(safe)}"`);
        return match;
      }
    );
    if (tag === 'img' && !attributes.some((attribute) => attribute.startsWith('src='))) return '';
    if (tag === 'a' && attributes.some((attribute) => attribute === 'target="_blank"')) {
      attributes.push('rel="noopener noreferrer"');
    }
    return `<${tag}${attributes.length ? ` ${attributes.join(' ')}` : ''}>`;
  });

const sanitizeHtml = (input) => {
  const html = String(input || '');
  return typeof document === 'undefined' ? sanitizeWithoutDom(html) : sanitizeWithDom(html);
};

module.exports = { sanitizeHtml };
