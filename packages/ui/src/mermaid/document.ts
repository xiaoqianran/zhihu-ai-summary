import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { MarkdownFormatter, extractMermaidBlocks } from '@zhihu-ai-summary/core';

export interface MermaidHostSpec {
  id: string;
  source: string;
}

export interface RenderedMermaidDocument {
  html: string;
  hosts: MermaidHostSpec[];
}

const TOKEN = '%%ZHIHU_AI_MERMAID_';

marked.setOptions({
  gfm: true,
  breaks: true,
});

function escapeAttribute(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderMermaidDocument(markdown: string): RenderedMermaidDocument {
  const formatted = MarkdownFormatter.format(markdown);
  const extracted = extractMermaidBlocks(formatted);
  const rawHtml = marked.parse(extracted.markdown, { async: false }) as string;
  const safeHtml = DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: ['mark'],
    ADD_ATTR: ['target'],
  });

  const hosts: MermaidHostSpec[] = extracted.blocks.map((source, index) => ({
    id: `mmd-${index}`,
    source,
  }));

  const html = safeHtml.replace(
    new RegExp(`(?:<p>\\s*)?${TOKEN}(\\d+)%%(?:\\s*</p>)?`, 'g'),
    (_match, indexText: string) => {
      const index = Number(indexText);
      const spec = hosts[index];
      if (!spec) {
        return '';
      }
      return `<div class="zhihu-ai-mermaid-host" data-zhihu-ai-mermaid="${escapeAttribute(spec.id)}"></div>`;
    }
  );

  return { html, hosts };
}
