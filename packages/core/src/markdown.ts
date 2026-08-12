const MARKDOWN_FENCE_LANGS = new Set(['markdown', 'md', 'gfm']);

function looksLikeMarkdownDocument(text: string): boolean {
  const sample = text.trim();
  if (!sample) {
    return false;
  }
  return (
    /^(#{1,6}\s*\S)/m.test(sample) ||
    /^([-*+•·]|－)\s+\S/m.test(sample) ||
    /^\d+(?:\.|\)|、|．)\s+\S/m.test(sample) ||
    /\*\*[^*\n]+\*\*/.test(sample) ||
    /^>\s+\S/m.test(sample)
  );
}

export class MarkdownParser {
  /**
   * Models often wrap the whole summary in a ```markdown fence.
   * Unwrap those (including a trailing unclosed fence while streaming)
   * so the inner markdown can actually render.
   */
  static unwrapMarkdownFences(markdown: string): string {
    let text = markdown.replace(/\r\n?/g, '\n');

    text = text.replace(/```(markdown|md|gfm)[ \t]*\n([\s\S]*?)```/gi, '$2');

    text = text.replace(/```[ \t]*\n([\s\S]*?)```/g, (match, code: string) => {
      return looksLikeMarkdownDocument(code) ? code : match;
    });

    // Streaming: drop only a still-open markdown/empty fence (never a closer)
    const lines = text.split('\n');
    let inFence = false;
    let openIndex = -1;
    let openLang = '';
    for (let i = 0; i < lines.length; i++) {
      const fence = lines[i].match(/^```([\w-]*)[ \t]*$/);
      if (!fence) {
        continue;
      }
      if (!inFence) {
        inFence = true;
        openIndex = i;
        openLang = (fence[1] || '').toLowerCase();
      } else {
        inFence = false;
        openIndex = -1;
        openLang = '';
      }
    }

    if (inFence && openIndex >= 0) {
      const body = lines.slice(openIndex + 1).join('\n');
      const shouldUnwrap =
        MARKDOWN_FENCE_LANGS.has(openLang) ||
        (openLang === '' && (!body.trim() || looksLikeMarkdownDocument(body)));
      if (shouldUnwrap) {
        lines.splice(openIndex, 1);
        text = lines.join('\n');
      }
    }

    return text;
  }

  static parse(markdown: string): string {
    // Normalize newlines and avoid huge blank blocks
    let html = this.unwrapMarkdownFences(markdown).replace(/\n{3,}/g, '\n\n');

    // --- Placeholders (prevent markdown parsing inside code) ---
    const codeBlocks: Array<{ id: number; code: string; lang: string }> = [];
    const inlineCodes: Array<{ id: number; code: string }> = [];

    // Code blocks ```lang\n...```
    html = html.replace(/```([\w-]+)?\n?([\s\S]*?)```/g, (_match, lang: string | undefined, code: string) => {
      const id = codeBlocks.length;
      codeBlocks.push({ id, code, lang: (lang ?? '').trim() });
      // Keep it as a real block element so paragraph wrapping won't break it.
      return `\n\n<pre><code data-zhihu-ai-code-block="${id}" data-lang="${this.escapeAttribute((lang ?? '').trim())}"></code></pre>\n\n`;
    });

    // Inline code `...` (single line)
    html = html.replace(/`([^`\n]+)`/g, (_match, code: string) => {
      const id = inlineCodes.length;
      inlineCodes.push({ id, code });
      return `<code data-zhihu-ai-inline-code="${id}"></code>`;
    });

    // 表格
    html = this.parseTable(html);

    // 标题（从深到浅，避免 #### 被 ### 抢先匹配；允许 ##标题 这种无空格写法）
    html = html
      .replace(/^######\s*(.+)$/gim, '<h6>$1</h6>')
      .replace(/^#####\s*(.+)$/gim, '<h5>$1</h5>')
      .replace(/^####\s*(.+)$/gim, '<h4>$1</h4>')
      .replace(/^###\s*(.+)$/gim, '<h3>$1</h3>')
      .replace(/^##\s*(.+)$/gim, '<h2>$1</h2>')
      .replace(/^#\s*(.+)$/gim, '<h1>$1</h1>');

    // 分隔线
    html = html.replace(/^(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '<hr>');

    // 引用
    html = html.replace(/(^> ?.*(?:\n> ?.*)*)/gm, (block) => {
      const inner = block
        .split('\n')
        .map((line) => line.replace(/^> ?/, ''))
        .join('<br>');
      return `<blockquote>${inner}</blockquote>`;
    });

    // 高亮（常见扩展语法）：==text==
    html = html.replace(/==([^=][\s\S]*?[^=])==/g, '<mark>$1</mark>');

    // 粗体和斜体
    html = html
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // 列表
    html = this.parseList(html);

    // 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    html = this.wrapParagraphs(html);

    // Restore inline code placeholders
    if (inlineCodes.length > 0) {
      html = html.replace(/<code data-zhihu-ai-inline-code="(\d+)">\s*<\/code>/g, (_match, idStr: string) => {
        const id = Number(idStr);
        const item = inlineCodes[id];
        if (!item) {
          return '';
        }
        return `<code>${this.escapeHTML(item.code)}</code>`;
      });
    }

    // Restore code block placeholders
    if (codeBlocks.length > 0) {
      html = html.replace(
        /<code data-zhihu-ai-code-block="(\d+)" data-lang="([^"]*)">\s*<\/code>/g,
        (_match, idStr: string, langAttr: string) => {
          const id = Number(idStr);
          const item = codeBlocks[id];
          if (!item) {
            return '';
          }
          const lang = (langAttr || item.lang || '').trim();
          const classAttr = lang ? ` class="language-${this.escapeAttribute(lang)}"` : '';
          return `<code${classAttr}>${this.escapeHTML(item.code)}</code>`;
        }
      );
    }

    return this.cleanHTML(html);
  }

  private static parseTable(html: string): string {
    const tableRegex = /(\|.+\|[\r\n]+\|[\s\-:]+\|[\r\n]+(?:\|.+\|[\r\n]*)+)/g;
    return html.replace(tableRegex, (match) => {
      const rows = match.trim().split('\n').filter((row) => row.trim());
      if (rows.length < 2) {return match;}

      const headers = rows[0].split('|').map((h) => h.trim()).filter((h) => h);
      const alignments = rows[1]
        .split('|')
        .map((s) => {
          s = s.trim();
          if (s.startsWith(':') && s.endsWith(':')) {return 'center';}
          if (s.endsWith(':')) {return 'right';}
          return 'left';
        })
        .filter((_, i) => i < headers.length);

      let tableHTML = '<table class="markdown-table"><thead><tr>';
      headers.forEach((header, i) => {
        tableHTML += `<th style="text-align: ${alignments[i] || 'left'}">${header}</th>`;
      });
      tableHTML += '</tr></thead><tbody>';

      rows.slice(2).forEach((row) => {
        const cells = row.split('|').map((c) => c.trim()).filter((c) => c);
        tableHTML += '<tr>';
        cells.forEach((cell, i) => {
          tableHTML += `<td style="text-align: ${alignments[i] || 'left'}">${cell}</td>`;
        });
        tableHTML += '</tr>';
      });

      return tableHTML + '</tbody></table>';
    });
  }

  private static parseList(html: string): string {
    const lines = html.split('\n');
    const processed: string[] = [];

    type ListType = 'ul' | 'ol';
    const stack: Array<{ type: ListType; indent: number; liOpen: boolean }> = [];

    const getIndent = (raw: string) => {
      const expanded = raw.replace(/\t/g, '  ');
      const m = expanded.match(/^(\s*)/);
      const spaces = (m?.[1] ?? '').length;
      // 2 spaces as one indent level (good enough for AI output)
      return Math.floor(spaces / 2);
    };

    const closeLiAtTop = () => {
      const top = stack[stack.length - 1];
      if (top?.liOpen) {
        processed.push('</li>');
        top.liOpen = false;
      }
    };

    const closeListsTo = (targetIndent: number) => {
      while (stack.length > 0 && stack[stack.length - 1].indent > targetIndent) {
        closeLiAtTop();
        const last = stack.pop();
        if (!last) {
          break;
        }
        processed.push(`</${last.type}>`);
      }
    };

    const closeAllLists = () => {
      while (stack.length > 0) {
        closeLiAtTop();
        const last = stack.pop();
        if (!last) {
          break;
        }
        processed.push(`</${last.type}>`);
      }
    };

    const openList = (type: ListType, indent: number) => {
      processed.push(`<${type}>`);
      stack.push({ type, indent, liOpen: false });
    };

    const unorderedRegex = /^(\s*)([-*+•·]|－)\s+(.+)$/;
    const orderedRegex = /^(\s*)(\d+)(?:\.|\)|、|．)\s+(.+)$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const unordered = line.match(unorderedRegex);
      const ordered = line.match(orderedRegex);

      const isListItem = Boolean(unordered || ordered);
      if (!isListItem) {
        // Continuation lines inside list item (common in AI output)
        if (stack.length > 0 && stack[stack.length - 1].liOpen) {
          const indentLevel = getIndent(line);
          const currentIndent = stack[stack.length - 1].indent;
          if (line.trim() && indentLevel > currentIndent) {
            processed.push(`<br>${line.trim()}`);
            continue;
          }
        }

        closeAllLists();
        processed.push(line);
        continue;
      }

      const indent = getIndent(line);
      const type: ListType = unordered ? 'ul' : 'ol';
      const content = (unordered ? unordered[3] : ordered?.[3]) ?? '';

      if (stack.length === 0) {
        openList(type, indent);
      } else {
        const current = stack[stack.length - 1];

        if (indent > current.indent) {
          // Nested list starts under current open <li>
          if (!current.liOpen) {
            // If there's no open <li>, open one to host nested list
            processed.push('<li>');
            current.liOpen = true;
          }
          openList(type, indent);
        } else {
          // Move up / same level
          closeListsTo(indent);

          const afterClose = stack[stack.length - 1];
          if (!afterClose) {
            openList(type, indent);
          } else if (afterClose.indent !== indent || afterClose.type !== type) {
            // Same indent but different type: switch list type
            if (afterClose.indent === indent && afterClose.type !== type) {
              closeLiAtTop();
              processed.push(`</${afterClose.type}>`);
              stack.pop();
              openList(type, indent);
            } else {
              closeListsTo(indent);
              if (stack.length === 0 || stack[stack.length - 1].indent !== indent || stack[stack.length - 1].type !== type) {
                openList(type, indent);
              }
            }
          }
        }
      }

      // New list item at current level
      closeLiAtTop();
      processed.push(`<li>${content}`);
      stack[stack.length - 1].liOpen = true;
    }

    closeAllLists();
    return processed.join('\n');
  }

  private static isBlockHtml(part: string): boolean {
    return /^(?:<h[1-6]>[\s\S]*<\/h[1-6]>|<ul>[\s\S]*<\/ul>|<ol>[\s\S]*<\/ol>|<pre>[\s\S]*<\/pre>|<table[\s\S]*<\/table>|<blockquote>[\s\S]*<\/blockquote>|<hr\s*\/?>)$/.test(part);
  }

  private static wrapParagraphs(html: string): string {
    const blockPattern =
      /(<h[1-6]>[\s\S]*?<\/h[1-6]>|<ul>[\s\S]*?<\/ul>|<ol>[\s\S]*?<\/ol>|<pre>[\s\S]*?<\/pre>|<table[\s\S]*?<\/table>|<blockquote>[\s\S]*?<\/blockquote>|<hr\s*\/?>)/g;

    return html
      .split(blockPattern)
      .map((part) => {
        if (!part || this.isBlockHtml(part)) {
          return part || '';
        }
        return part
          .split(/\n{2,}/)
          .map((chunk) => {
            const text = chunk.trim();
            if (!text) {
              return '';
            }
            return `<p>${text.replace(/\n+/g, ' ')}</p>`;
          })
          .join('');
      })
      .join('');
  }

  private static cleanHTML(html: string): string {
    const pres: string[] = [];
    const protectedHtml = html.replace(/<pre>[\s\S]*?<\/pre>/g, (block) => {
      pres.push(block);
      return `\0PRE${pres.length - 1}\0`;
    });

    const cleaned = protectedHtml
      .replace(/<p>\s*<\/p>/g, '')
      .replace(/<p>(<h[1-6]>)/g, '$1')
      .replace(/(<\/h[1-6]>)<\/p>/g, '$1')
      .replace(/<p>(<ul>)/g, '$1')
      .replace(/(<\/ul>)<\/p>/g, '$1')
      .replace(/<p>(<ol>)/g, '$1')
      .replace(/(<\/ol>)<\/p>/g, '$1')
      .replace(/<p>(<pre>)/g, '$1')
      .replace(/(<\/pre>)<\/p>/g, '$1')
      .replace(/<p>(<table)/g, '$1')
      .replace(/(<\/table>)<\/p>/g, '$1')
      .replace(/<p>(<blockquote)/g, '$1')
      .replace(/(<\/blockquote>)<\/p>/g, '$1')
      .replace(/<p>(<hr\b)/g, '$1')
      .trim();

    return cleaned.replace(/\0PRE(\d+)\0/g, (_match, idStr: string) => {
      return pres[Number(idStr)] ?? '';
    });
  }

  private static escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private static escapeAttribute(text: string): string {
    // Attribute-safe subset (quotes + angle brackets are enough here)
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

export class MarkdownFormatter {
  /**
   * Light-touch markdown formatting improvements for AI output.
   * Goal: better headings/lists/bold highlights while preserving original semantics.
   */
  static format(markdown: string): string {
    const normalized = MarkdownParser.unwrapMarkdownFences(markdown);
    const lines = normalized.split('\n');
    const out: string[] = [];

    let inFence = false;
    let fenceMarker: '```' | '~~~' | null = null;

    const isHeading = (line: string) => /^#{1,6}\s*\S/.test(line.trim());
    const isListLine = (line: string) => {
      const trimmed = line.trim();
      return (
        /^([-*+•·]|－)\s+\S/.test(trimmed) ||
        /^(\d+)(?:\.|\)|、|．)\s+\S/.test(trimmed)
      );
    };

    const normalizeListMarker = (line: string) => {
      let next = line;
      next = next.replace(/^(\s*)[•·]\s+/u, '$1- ');
      next = next.replace(/^(\s*)－\s+/u, '$1- ');
      next = next.replace(/^(\s*)(\d+)\)\s+/u, '$1$2. ');
      next = next.replace(/^(\s*)(\d+)[、．]\s+/u, '$1$2. ');
      return next;
    };

    const sectionHeading = (line: string) => {
      const m = line.trim().match(/^【(.+?)】\s*$/);
      if (m) {
        return `#### ${m[1].trim()}`;
      }
      return line;
    };

    const emphasizeLabels = (line: string) => {
      const labelAlternation = [
        '核心疑问',
        '背景信息',
        '具体诉求',
        '核心观点',
        '关键论据',
        '实用建议',
        '价值评估',
        '关键点',
        '要点',
        '结论',
        '建议',
        '总结',
        '注意',
        '风险',
        '警告',
      ].join('|');

      // Optional list prefix, then a label ending with :/：
      const re = new RegExp(`^(\\s*(?:[-*+]\\s+|\\d+\\.\\s+)?)(${labelAlternation})(\\s*[:：])`, 'u');
      const m = line.match(re);
      if (!m) {
        return line;
      }
      const prefix = m[1];
      const label = m[2];
      const sep = m[3];

      // Skip if already bolded
      const afterPrefix = line.slice(prefix.length);
      if (afterPrefix.startsWith('**')) {
        return line;
      }

      const highlightLabels = new Set(['注意', '风险', '警告']);
      const wrapped = highlightLabels.has(label) ? `==**${label}**==` : `**${label}**`;
      return `${prefix}${wrapped}${sep}${line.slice((prefix + label + sep).length)}`;
    };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Skip all formatting inside fenced code blocks
      const trimmedLine = line.trim();
      const fenceMatch = trimmedLine.match(/^(```|~~~)/);
      if (fenceMatch) {
        const marker = fenceMatch[1] as '```' | '~~~';
        if (!inFence) {
          inFence = true;
          fenceMarker = marker;
        } else if (fenceMarker === marker) {
          inFence = false;
          fenceMarker = null;
        }
        out.push(line);
        continue;
      }

      if (inFence) {
        out.push(line);
        continue;
      }

      line = normalizeListMarker(line);
      line = sectionHeading(line);
      line = emphasizeLabels(line);

      const trimmed = line.trim();
      const prev = out.length > 0 ? out[out.length - 1] : '';
      const prevTrimmed = prev.trim();

      // Insert a blank line before headings and before a new list block for readability
      if (trimmed) {
        if (isHeading(line) && prevTrimmed) {
          out.push('');
        } else if (isListLine(line) && prevTrimmed && !isListLine(prev) && !isHeading(prev)) {
          out.push('');
        }
      }

      out.push(line);
    }

    return out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

/** Unwrap fences, light-format AI output, then convert to HTML. */
export function renderSummaryMarkdown(markdown: string): string {
  return MarkdownParser.parse(MarkdownFormatter.format(markdown));
}

export interface ExtractedMermaid {
  markdown: string;
  blocks: string[];
}

export function cleanMermaidSource(source: string): string {
  let text = source.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  text = text.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  text = text.replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```$/i, '');
  text = text.replace(/\u2192/g, '-->').replace(/\u21D2/g, '==>');
  return text.replace(/^\s+|\s+$/g, '');
}

export function extractMermaidBlocks(markdown: string): ExtractedMermaid {
  const blocks: string[] = [];
  const normalized = MarkdownParser.unwrapMarkdownFences(markdown);
  const replaced = normalized.replace(/```mermaid[ \t]*\n([\s\S]*?)```/gi, (_match, code: string) => {
    const cleaned = cleanMermaidSource(code);
    if (!cleaned) {
      return '';
    }
    const index = blocks.length;
    blocks.push(cleaned);
    return `\n\n%%ZHIHU_AI_MERMAID_${index}%%\n\n`;
  });
  return { markdown: replaced, blocks };
}

export function replaceMermaidBlock(markdown: string, index: number, nextSource: string): string {
  const cleaned = cleanMermaidSource(nextSource);
  if (!cleaned || index < 0) {
    return markdown;
  }

  let current = 0;
  let replaced = false;
  const next = markdown.replace(/```mermaid[ \t]*\n([\s\S]*?)```/gi, (match) => {
    const thisIndex = current++;
    if (thisIndex !== index) {
      return match;
    }
    replaced = true;
    return `\`\`\`mermaid\n${cleaned}\n\`\`\``;
  });
  return replaced ? next : markdown;
}
