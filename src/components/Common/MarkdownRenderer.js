import React from 'react';
import { marked } from 'marked';

// Configure custom markdown renderer
const renderer = new marked.Renderer();

renderer.code = function({ text, lang }) {
  // CLI/Cisco blocks use a special black background
  if (!lang || lang === 'cli' || lang === 'cisco') {
    return `<pre class="lc-code-block">\n${text}\n</pre>\n`;
  }
  return `<pre><code>${text}</code></pre>\n`;
};

renderer.blockquote = function({ text, tokens }) {
  const alertMatch = text.match(/\[!(NOTE|WARNING|TIP|IMPORTANT|CAUTION)\]/i);
  
  if (alertMatch) {
    const type = alertMatch[1].toUpperCase();
    const config = {
      'NOTE': { title: 'Ghi chú', icon: '💡', class: 'note' },
      'TIP': { title: 'Mẹo nhỏ', icon: '✨', class: 'tip' },
      'IMPORTANT': { title: 'Quan trọng', icon: '📢', class: 'important' },
      'WARNING': { title: 'Cảnh báo', icon: '⚠️', class: 'warning' },
      'CAUTION': { title: 'Thận trọng', icon: '🛑', class: 'caution' }
    };
    
    const { title, icon, class: className } = config[type] || config['NOTE'];
    const bodyHtml = this.parser.parse(tokens);
    
    const cleanedText = bodyHtml
      .replace(/<p>\[!(?:NOTE|WARNING|TIP|IMPORTANT|CAUTION)\]/gi, '<p>')
      .replace(/<p>\s*<\/p>/g, '')
      .replace(/<\/p>\s*$/, '</p>');

    return `<div class="lc-alert-box ${className}">
              <h4 class="lc-alert-title">${icon} ${title}</h4>
              <div class="lc-alert-text">${cleanedText}</div>
            </div>`;
  }
  
  const bodyHtml = this.parser.parse(tokens);
  return `<blockquote>\n${bodyHtml}</blockquote>\n`;
};

marked.setOptions({
  renderer,
  breaks: true,
  gfm: true
});

const parseMarkdown = (content) => {
  if (!content) return '';
  // Support standalone [!TYPE] tags
  const processed = content.replace(/^\[!(NOTE|WARNING|TIP|IMPORTANT|CAUTION)\](?:\s*\n|$)([\s\S]*?)(?=\n\[!|\n#|\n$)/gmi, (match, type, body) => {
    const lines = body.trim().split('\n');
    return `> [!${type.toUpperCase()}]\n> ` + lines.join('\n> ') + '\n\n';
  });
  return marked.parse(processed);
};

const MarkdownRenderer = ({ content, className = "" }) => {
  const html = parseMarkdown(content);
  return (
    <div 
      className={`markdown-body ${className}`}
      dangerouslySetInnerHTML={{ __html: html }} 
    />
  );
};

export default MarkdownRenderer;
export { parseMarkdown };
