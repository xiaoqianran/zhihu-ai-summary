import { useState, useEffect, useRef } from 'preact/hooks';
import {
  MarkdownFormatter,
  MarkdownParser,
  renderSummaryMarkdown,
  replaceMermaidBlock,
  type APIClient,
  type ExtractedContent,
  type ConfigManager,
  type GenerationMode,
} from '@zhihu-ai-summary/core';
import { SummaryButton } from './SummaryButton';
import { SummaryPanel } from './SummaryPanel';
import { toast } from './Toast';
import { renderMermaidDocument, type MermaidHostSpec } from '../mermaid/document';

export interface SummaryButtonWrapperProps {
  content: ExtractedContent | (() => Promise<ExtractedContent>);
  buttonClass: string;
  type: 'article' | 'question' | 'answer';
  targetElement: Element;
  apiClient: APIClient;
  configManager: ConfigManager;
  authorName?: string;
  autoTrigger?: boolean;
  minLength?: number;
  panelClassName?: string;
}

interface ModeResult {
  markdown: string;
  html: string;
  mermaidHosts: MermaidHostSpec[];
  cachedAt?: number;
}

const emptyResult = (): ModeResult => ({ markdown: '', html: '', mermaidHosts: [] });

export function SummaryButtonWrapper({
  content,
  buttonClass,
  type,
  targetElement,
  apiClient,
  configManager,
  authorName,
  autoTrigger = false,
  minLength = 0,
  panelClassName = '',
}: SummaryButtonWrapperProps) {
  const [open, setOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<GenerationMode>('summary');
  const [generatingMode, setGeneratingMode] = useState<GenerationMode | null>(null);
  const [results, setResults] = useState<Record<GenerationMode, ModeResult>>({
    summary: emptyResult(),
    mermaid: emptyResult(),
  });
  const [sourceUrl, setSourceUrl] = useState(window.location.href);
  const [modelName, setModelName] = useState('AI');
  const cacheSavedRef = useRef(false);
  const generatingModeRef = useRef<GenerationMode | null>(null);
  const resultsRef = useRef(results);
  const cacheKeyRef = useRef('');
  resultsRef.current = results;

  const current = results[activeMode];
  const viewingBusy = generatingMode === activeMode;

  const hideSideColumn = () => {
    if (type !== 'answer') {
      return () => {};
    }
    const sideColumn = document.querySelector(
      'div.Question-sideColumn.Question-sideColumn--sticky'
    ) as HTMLElement | null;
    if (!sideColumn) {
      return () => {};
    }

    const prevDisplay = sideColumn.style.display;
    sideColumn.style.display = 'none';
    return () => {
      sideColumn.style.display = prevDisplay;
    };
  };

  const setGenerating = (mode: GenerationMode | null) => {
    generatingModeRef.current = mode;
    setGeneratingMode(mode);
  };

  const ensureModeContent = (mode: GenerationMode) => {
    const existing = results[mode];
    if (existing.html || existing.markdown) {
      return;
    }
    if (generatingModeRef.current) {
      return;
    }
    void startGenerate(mode, false);
  };

  const handleButtonClick = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    ensureModeContent(activeMode);
  };

  const handleModeChange = (mode: GenerationMode) => {
    setActiveMode(mode);
    ensureModeContent(mode);
  };

  const persistMermaidRepair = (hostId: string, nextSource: string) => {
    const currentMermaid = resultsRef.current.mermaid;
    const index = currentMermaid.mermaidHosts.findIndex((item) => item.id === hostId);
    if (index < 0) {
      return;
    }

    const nextHosts = currentMermaid.mermaidHosts.map((item) => (
      item.id === hostId ? { ...item, source: nextSource } : item
    ));
    let nextMarkdown = replaceMermaidBlock(currentMermaid.markdown, index, nextSource);
    if (nextMarkdown === currentMermaid.markdown) {
      let fenceIndex = 0;
      nextMarkdown = currentMermaid.markdown.replace(/```mermaid[ \t]*\n([\s\S]*?)```/gi, (match) => {
        const host = nextHosts[fenceIndex++];
        return host ? `\`\`\`mermaid\n${host.source}\n\`\`\`` : match;
      });
    }

    setResults((prev) => ({
      ...prev,
      mermaid: {
        ...prev.mermaid,
        markdown: nextMarkdown,
        mermaidHosts: nextHosts,
      },
    }));

    const cacheKey = cacheKeyRef.current;
    if (!cacheKey || nextMarkdown === currentMermaid.markdown) {
      return;
    }
    void configManager.setCachedSummary(cacheKey, {
      markdown: nextMarkdown,
      timestamp: Date.now(),
    }).catch((error) => {
      console.error('保存修复缓存失败:', error);
    });
  };

  const followMermaidIfNeeded = (mode: GenerationMode) => {
    if (mode !== 'summary') {
      return;
    }
    const mermaid = resultsRef.current.mermaid;
    if (mermaid.html || mermaid.markdown) {
      return;
    }
    void startGenerate('mermaid', false, false, { activate: false });
  };

  const startGenerate = async (
    mode: GenerationMode,
    isManualClick: boolean = true,
    skipCache: boolean = false,
    options: { activate?: boolean } = {}
  ) => {
    if (generatingModeRef.current && generatingModeRef.current !== mode) {
      toast.error('请等待当前生成完成');
      return;
    }

    const activate = options.activate !== false;
    cacheSavedRef.current = false;
    const restoreSideColumn = hideSideColumn();
    if (activate) {
      setActiveMode(mode);
      setOpen(true);
    }
    setGenerating(mode);
    setResults((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], cachedAt: undefined },
    }));

    const model = apiClient.modelName || 'AI';
    setModelName(model);

    let answerUrl = sourceUrl;
    if (type === 'answer') {
      const answerItem = targetElement.closest('.ContentItem.AnswerItem');
      if (answerItem) {
        const metaUrls = answerItem.querySelectorAll('meta[itemprop="url"]');
        const metaUrl = metaUrls.length > 1 ? metaUrls[1] : null;
        if (metaUrl && (metaUrl as HTMLMetaElement).content && (metaUrl as HTMLMetaElement).content.includes('/answer/')) {
          answerUrl = (metaUrl as HTMLMetaElement).content;
          setSourceUrl(answerUrl);
        }
      }
    }

    try {
      const extractedContent = typeof content === 'function' ? await content() : content;

      if (!isManualClick && type === 'answer') {
        const contentLength = extractedContent.content?.length || 0;
        if (contentLength < minLength) {
          setResults((prev) => ({
            ...prev,
            [mode]: {
              markdown: '',
              html: `<div class="zhihu-ai-inline-error">回答内容较短 (${contentLength} < ${minLength}字)，可手动点击触发</div>`,
              mermaidHosts: [],
            },
          }));
          setGenerating(null);
          restoreSideColumn();
          return;
        }
      }

      const cacheKey = mode === 'mermaid' ? `${answerUrl}:${type}:mermaid` : `${answerUrl}:${type}`;
      cacheKeyRef.current = cacheKey;

      if (!isManualClick && !skipCache) {
        const cached = await configManager.getCachedSummary(cacheKey);
        if (cached) {
          const rendered = mode === 'mermaid'
            ? renderMermaidDocument(cached.markdown)
            : { html: renderSummaryMarkdown(cached.markdown), hosts: [] as MermaidHostSpec[] };
          setResults((prev) => ({
            ...prev,
            [mode]: {
              markdown: cached.markdown,
              html: rendered.html,
              mermaidHosts: rendered.hosts ?? [],
              cachedAt: cached.timestamp,
            },
          }));
          setGenerating(null);
          restoreSideColumn();
          followMermaidIfNeeded(mode);
          return;
        }
      }

      let fullMarkdown = '';
      const authorPrefix = (type === 'answer' && authorName)
        ? (mode === 'mermaid' ? `**对 ${authorName} 的回答进行图梳理**\n\n` : `**对 ${authorName} 的回答进行AI总结**\n\n`)
        : '';

      await apiClient.streamCall(
        extractedContent,
        (chunk) => {
          fullMarkdown += chunk;
          const fullText = authorPrefix + fullMarkdown;
          const rendered = mode === 'mermaid'
            ? renderMermaidDocument(fullText)
            : { html: renderSummaryMarkdown(fullText), hosts: [] as MermaidHostSpec[] };
          setResults((prev) => ({
            ...prev,
            [mode]: {
              markdown: fullText,
              html: rendered.html,
              mermaidHosts: rendered.hosts ?? [],
            },
          }));
        },
        async () => {
          const fullText = authorPrefix + fullMarkdown;
          const formatted = MarkdownFormatter.format(fullText);
          const rendered = mode === 'mermaid'
            ? renderMermaidDocument(formatted)
            : { html: MarkdownParser.parse(formatted), hosts: [] as MermaidHostSpec[] };
          setResults((prev) => ({
            ...prev,
            [mode]: {
              markdown: formatted,
              html: rendered.html,
              mermaidHosts: rendered.hosts ?? [],
            },
          }));
          setGenerating(null);
          restoreSideColumn();
          if (!cacheSavedRef.current) {
            cacheSavedRef.current = true;
            try {
              await configManager.setCachedSummary(cacheKey, {
                markdown: formatted,
                timestamp: Date.now(),
              });
            } catch (e) {
              console.error('保存缓存失败:', e);
            }
          }
          followMermaidIfNeeded(mode);
        },
        (error) => {
          setResults((prev) => ({
            ...prev,
            [mode]: {
              markdown: '',
              html: `<div class="zhihu-ai-inline-error">${error.message}</div>`,
              mermaidHosts: [],
            },
          }));
          if (isManualClick) {
            toast.error(error.message || '生成失败');
          }
          setGenerating(null);
          restoreSideColumn();
        },
        { mode }
      );
    } catch (error) {
      console.error('生成失败:', error);
      const message = error instanceof Error ? error.message : '生成失败';
      setResults((prev) => ({
        ...prev,
        [mode]: {
          markdown: '',
          html: `<div class="zhihu-ai-inline-error">${message}</div>`,
          mermaidHosts: [],
        },
      }));
      if (isManualClick) {
        toast.error(message);
      }
      setGenerating(null);
      restoreSideColumn();
    }
  };

  useEffect(() => {
    if (autoTrigger) {
      const timer = setTimeout(() => startGenerate('summary', false), 100);
      return () => clearTimeout(timer);
    }
  }, [autoTrigger]);

  const titleMap: Record<GenerationMode, Record<'answer' | 'article' | 'question', string>> = {
    summary: {
      answer: `AI 回答总结 (${modelName})`,
      article: `AI 文章总结 (${modelName})`,
      question: `AI 问题总结 (${modelName})`,
    },
    mermaid: {
      answer: `图梳理 · 回答 (${modelName})`,
      article: `图梳理 · 文章 (${modelName})`,
      question: `图梳理 · 问题 (${modelName})`,
    },
  };

  return (
    <>
      <SummaryButton
        text="AI总结"
        loading={generatingMode !== null}
        onClick={handleButtonClick}
        className={buttonClass}
        variant="summary"
      />
      {open && (
        <SummaryPanel
          content={current.html}
          markdown={current.markdown}
          mermaidHosts={current.mermaidHosts}
          sourceUrl={sourceUrl}
          loading={viewingBusy}
          streaming={viewingBusy}
          cachedAt={current.cachedAt}
          onClose={() => setOpen(false)}
          onRefresh={() => startGenerate(activeMode, true, true)}
          onMermaidRepair={(source, error) => apiClient.repairMermaid(source, error)}
          onMermaidRepaired={persistMermaidRepair}
          title={titleMap[activeMode][type]}
          panelType={type}
          targetElement={targetElement}
          className={`${panelClassName} ${activeMode === 'mermaid' ? 'is-mermaid' : ''}`.trim()}
          activeMode={activeMode}
          onModeChange={handleModeChange}
          actionsLocked={generatingMode !== null && generatingMode !== activeMode}
        />
      )}
    </>
  );
}
