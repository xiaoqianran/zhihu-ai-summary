import { useState, useEffect, useRef } from 'preact/hooks';
import type { GenerationMode } from '@zhihu-ai-summary/core';
import { toast } from './Toast';
import { bindThemeRoot } from '../theme';
import { mountMermaidHosts } from '../mermaid/host';
import type { MermaidHostSpec } from '../mermaid/document';

interface PanelElement extends HTMLDivElement {
  __cleanup?: () => void;
}

interface SummaryPanelProps {
  content: string;
  markdown?: string;
  sourceUrl?: string;
  loading?: boolean;
  streaming?: boolean;
  cachedAt?: number;
  onClose: () => void;
  onRefresh?: () => void;
  className?: string;
  title?: string;
  panelType?: 'answer' | 'article' | 'question';
  targetElement?: Element;
  mermaidHosts?: MermaidHostSpec[];
  onMermaidRepair?: (source: string, error: string) => Promise<string>;
  onMermaidRepaired?: (id: string, nextSource: string) => void;
  activeMode?: GenerationMode;
  onModeChange?: (mode: GenerationMode) => void;
  actionsLocked?: boolean;
}

export function SummaryPanel({
  content,
  markdown,
  sourceUrl,
  loading,
  streaming,
  cachedAt,
  onClose,
  onRefresh,
  className = '',
  title = 'AI总结',
  panelType = 'answer',
  targetElement,
  mermaidHosts = [],
  onMermaidRepair,
  onMermaidRepaired,
  activeMode = 'summary',
  onModeChange,
  actionsLocked = false,
}: SummaryPanelProps) {
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);

  // 格式化缓存时间
  const formatCachedTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) { return '刚刚'; }
    if (minutes < 60) { return `${minutes}分钟前`; }
    if (hours < 24) { return `${hours}小时前`; }
    return `${days}天前`;
  };
  const panelRef = useRef<PanelElement>(null);
  const markdownRef = useRef<HTMLDivElement>(null);
  const mermaidRepairRef = useRef(onMermaidRepair);
  const mermaidRepairedRef = useRef(onMermaidRepaired);
  mermaidRepairRef.current = onMermaidRepair;
  mermaidRepairedRef.current = onMermaidRepaired;
  const originalParentRef = useRef<Element | null>(null);
  const contentCheckIntervalRef = useRef<number | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStateRef = useRef<{
    dragging: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    startRect: { left: number; top: number; width: number; height: number } | null;
    prevBodyUserSelect: string;
  }>({
    dragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    startRect: null,
    prevBodyUserSelect: '',
  });

  const applyDragTransform = (x: number, y: number) => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    panel.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const endDrag = () => {
    const state = dragStateRef.current;
    if (!state.dragging) {
      return;
    }

    state.dragging = false;
    state.pointerId = null;
    state.startRect = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);

    document.body.style.userSelect = state.prevBodyUserSelect;
    setDragging(false);
  };

  const clamp = (value: number, min: number, max: number) => {
    return Math.min(max, Math.max(min, value));
  };

  const handlePointerMove = (event: PointerEvent) => {
    const state = dragStateRef.current;
    if (!state.dragging || state.pointerId === null || event.pointerId !== state.pointerId) {
      return;
    }
    if (!state.startRect) {
      return;
    }

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;

    // 允许拖动，但避免把面板完全拖出屏幕（保留一小块可见区域，便于找回）
    const visibleMarginX = 80;
    const visibleMarginY = 60;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = state.startRect;

    const deltaXMin = (visibleMarginX - rect.width) - rect.left;
    const deltaXMax = (vw - visibleMarginX) - rect.left;
    const deltaYMin = (visibleMarginY - rect.height) - rect.top;
    const deltaYMax = (vh - visibleMarginY) - rect.top;

    const clampedDx = clamp(dx, deltaXMin, deltaXMax);
    const clampedDy = clamp(dy, deltaYMin, deltaYMax);

    const nextX = state.baseX + clampedDx;
    const nextY = state.baseY + clampedDy;

    dragOffsetRef.current = { x: nextX, y: nextY };
    applyDragTransform(nextX, nextY);
  };

  const handlePointerUp = (event: PointerEvent) => {
    const state = dragStateRef.current;
    if (!state.dragging || state.pointerId === null || event.pointerId !== state.pointerId) {
      return;
    }
    endDrag();
  };

  const handleHeaderPointerDown = (event: PointerEvent) => {
    // 点击关闭/复制按钮时不触发拖动
    const target = event.target as Element | null;
    if (target?.closest('button')) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const header = event.currentTarget as HTMLElement;
    dragStateRef.current.dragging = true;
    dragStateRef.current.pointerId = event.pointerId;
    dragStateRef.current.startX = event.clientX;
    dragStateRef.current.startY = event.clientY;
    dragStateRef.current.baseX = dragOffsetRef.current.x;
    dragStateRef.current.baseY = dragOffsetRef.current.y;

    const rect = panel.getBoundingClientRect();
    dragStateRef.current.startRect = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };

    dragStateRef.current.prevBodyUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    header.setPointerCapture(event.pointerId);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    setDragging(true);
  };

  // 检查内容高度并调整滚动条
  const checkContentHeight = (panel: HTMLDivElement, answerItem: Element) => {
    const elem = answerItem as HTMLElement;
    const elementHeight = elem.offsetHeight;
    const minPanelHeight = Math.max(300, window.innerHeight * 0.3);
    const maxPanelHeight = window.innerHeight - 90;

    // 计算目标高度
    let targetHeight: number;
    if (elementHeight < maxPanelHeight) {
      targetHeight = Math.max(minPanelHeight, elementHeight);
    } else {
      targetHeight = maxPanelHeight;
    }

    // 获取面板内容的实际高度
    const panelContentHeight = panel.scrollHeight;

    // 设置最大高度
    panel.style.maxHeight = `${targetHeight}px`;

    if (panelContentHeight > targetHeight) {
      panel.style.overflowY = 'auto';
    } else {
      panel.style.overflowY = 'hidden';
    }
  };

  // 监听流式输出状态，定期检查内容高度
  useEffect(() => {
    if (!panelRef.current || !targetElement || panelType !== 'answer') {return;}

    const panel = panelRef.current;
    const answerItem = targetElement.closest('.ContentItem.AnswerItem');
    if (!answerItem) {return;}

    if (streaming) {
      contentCheckIntervalRef.current = window.setInterval(() => {
        checkContentHeight(panel, answerItem);
      }, 500);
    } else {
      if (contentCheckIntervalRef.current) {
        clearInterval(contentCheckIntervalRef.current);
        contentCheckIntervalRef.current = null;
      }
      // 最后检查一次
      checkContentHeight(panel, answerItem);
    }

    return () => {
      if (contentCheckIntervalRef.current) {
        clearInterval(contentCheckIntervalRef.current);
        contentCheckIntervalRef.current = null;
      }
    };
  }, [streaming, targetElement, panelType]);

  useEffect(() => {
    if (!panelRef.current || !targetElement) {return;}

    const panel = panelRef.current;
    originalParentRef.current = panel.parentElement;

    // 找到正确的父元素并移动面板
    let parentElement: Element | null = null;
    let answerItem: Element | null = null;
    let updateTimer: number | null = null;

    // 更新面板高度的函数（带防抖）
    const updatePanelHeight = () => {
      if (!answerItem || panelType !== 'answer') {return;}

      // 清除之前的定时器
      if (updateTimer) {
        clearTimeout(updateTimer);
      }

      // 延迟执行，避免频繁更新
      updateTimer = window.setTimeout(() => {
        if (answerItem) {
          checkContentHeight(panel, answerItem);
        }
      }, 150);
    };

    const headerOffset = 70;
    const questionTopOffset = 135;
    const viewportBottomGap = 24;
    const preferWide = panel.classList.contains('is-mermaid');
    const preferredWidth = preferWide ? 560 : 400;
    const minWidth = preferWide ? 320 : 300;

    const pinBeside = (anchor: HTMLElement, useFixedLeft: boolean) => {
      const gap = 16;
      const rect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const available = viewportWidth - rect.right - gap * 2;
      const width = Math.max(minWidth, Math.min(preferredWidth, Math.max(available, minWidth)));
      panel.style.width = `${Math.round(Math.min(width, Math.max(available, minWidth)))}px`;

      if (useFixedLeft) {
        let left = rect.right + gap;
        const maxLeft = viewportWidth - Number.parseFloat(panel.style.width) - gap;
        if (available >= minWidth) {
          left = Math.min(left, maxLeft);
        } else {
          left = Math.max(rect.right + 8, maxLeft);
        }
        panel.style.left = `${Math.round(Math.max(gap, left))}px`;
        panel.style.marginLeft = '0';
      } else {
        panel.style.left = '100%';
        panel.style.marginLeft = `${gap}px`;
        if (available > 0) {
          panel.style.width = `${Math.round(Math.min(preferredWidth, available))}px`;
        }
      }
    };

    const applyFixedForBody = () => {
      panel.classList.add('zhihu-ai-panel-fixed');
      parentElement = document.body;
    };

    if (panelType === 'question') {
      panel.classList.add('question-fixed');
      parentElement = document.body;
      panel.classList.add('zhihu-ai-panel-fixed');
      const questionColumn = document.querySelector('.Question-mainColumn') as HTMLElement | null
        || document.querySelector('.QuestionHeader') as HTMLElement | null;
      const updateQuestionMaxHeight = () => {
        panel.style.overflowY = 'auto';
        panel.style.maxHeight = `${Math.max(200, window.innerHeight - questionTopOffset - viewportBottomGap)}px`;
        if (questionColumn) {
          pinBeside(questionColumn, true);
        }
      };

      updateQuestionMaxHeight();
      window.addEventListener('resize', updateQuestionMaxHeight);

      const prevCleanup = panel.__cleanup;
      panel.__cleanup = () => {
        if (prevCleanup) {
          prevCleanup();
        }
        window.removeEventListener('resize', updateQuestionMaxHeight);
      };
    } else if (panelType === 'answer') {
      // 对于回答，找到回答元素
      answerItem = targetElement.closest('.ContentItem.AnswerItem');
      if (answerItem) {
        parentElement = answerItem;
        const elem = answerItem as HTMLElement;
        if (!elem.style.position || elem.style.position === 'static') {
          elem.style.position = 'relative';
        }

        // 初始化面板高度，并限制在正文右侧空白里
        updatePanelHeight();
        pinBeside(elem, false);
        const onResizeAnswer = () => {
          pinBeside(elem, false);
        };
        window.addEventListener('resize', onResizeAnswer);

        // 使用 ResizeObserver 监听回答元素高度变化
        const resizeObserver = new ResizeObserver(() => {
          updatePanelHeight();
        });
        resizeObserver.observe(answerItem);

        // 使用 MutationObserver 监听 DOM 变化（例如展开/收起按钮点击）
        const mutationObserver = new MutationObserver(() => {
          // 延迟更新，等待动画完成
          updatePanelHeight();
        });

        // 只监听特定的变化，减少触发频率
        mutationObserver.observe(answerItem, {
          childList: false,
          subtree: false,
          attributes: true,
          attributeFilter: ['class']
        });

        // 清理观察器和定时器
        const cleanup = () => {
          if (updateTimer) {
            clearTimeout(updateTimer);
            updateTimer = null;
          }
          window.removeEventListener('resize', onResizeAnswer);
          resizeObserver.disconnect();
          mutationObserver.disconnect();
        };

        // 保存清理函数
        panel.__cleanup = cleanup;
      }
    } else if (panelType === 'article') {
      // 对于文章，找到文章容器
      // 优先使用正文左侧内容列作为定位基准，保证面板贴在正文右边
      const articleContainer = document.querySelector('.Post-Row-Content-left') ||
                             document.querySelector('.Post-Row-Content') ||
                             targetElement.closest('article') ||
                             targetElement.closest('.Post-Main');
      if (articleContainer) {
        parentElement = articleContainer;
        const elem = articleContainer as HTMLElement;
        if (!elem.style.position || elem.style.position === 'static') {
          elem.style.position = 'relative';
        }

        // 文章页：默认跟随容器；当滚动导致容器顶部离开视口时，面板吸顶（fixed）
        panel.style.top = '0';

        const updateArticleAffix = () => {
          const rect = elem.getBoundingClientRect();
          if (rect.top < headerOffset) {
            panel.style.top = `${headerOffset}px`;
            panel.style.overflowY = 'auto';
            panel.style.maxHeight = `${Math.max(200, window.innerHeight - headerOffset - viewportBottomGap)}px`;
            applyFixedForBody();
            pinBeside(elem, true);
          } else {
            panel.classList.remove('zhihu-ai-panel-fixed');
            panel.style.top = '0';
            panel.style.overflowY = 'auto';
            panel.style.maxHeight = `${Math.max(200, window.innerHeight - rect.top - viewportBottomGap)}px`;
            parentElement = articleContainer;
            pinBeside(elem, false);
          }

          // 按需移动 DOM
          if (parentElement && panel.parentElement !== parentElement) {
            parentElement.appendChild(panel);
          }
        };

        // 初始化一次 + 监听滚动/窗口尺寸
        const onScroll = () => {
          updateArticleAffix();
        };
        const onResize = () => {
          updateArticleAffix();
        };

        updateArticleAffix();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onResize);

        // 合并清理逻辑
        const prevCleanup = panel.__cleanup;
        panel.__cleanup = () => {
          if (prevCleanup) {
            prevCleanup();
          }
          window.removeEventListener('scroll', onScroll);
          window.removeEventListener('resize', onResize);
        };
      }
    }

    // 移动面板到正确的父元素
    if (parentElement && panel.parentElement !== parentElement) {
      parentElement.appendChild(panel);
    }

    // 清理函数：组件卸载时移除面板和观察器
    return () => {
      // 清理拖动监听器（如果正在拖动）
      endDrag();

      // 清理观察器
      if (panel.__cleanup) {
        panel.__cleanup();
        delete panel.__cleanup;
      }

      // 移除面板
      if (panel.parentElement) {
        panel.parentElement.removeChild(panel);
      }
    };
  }, [panelType, targetElement]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !targetElement) {
      return;
    }

    const preferWide = activeMode === 'mermaid';
    const preferredWidth = preferWide ? 560 : 400;
    const minWidth = preferWide ? 320 : 300;
    const gap = 16;

    const getAnchor = (): HTMLElement | null => {
      if (panelType === 'question') {
        return (document.querySelector('.Question-mainColumn')
          || document.querySelector('.QuestionHeader')) as HTMLElement | null;
      }
      if (panelType === 'answer') {
        return targetElement.closest('.ContentItem.AnswerItem') as HTMLElement | null;
      }
      return (document.querySelector('.Post-Row-Content-left')
        || document.querySelector('.Post-Row-Content')
        || targetElement.closest('article')
        || targetElement.closest('.Post-Main')) as HTMLElement | null;
    };

    const anchor = getAnchor();
    if (!anchor) {
      panel.style.width = `${preferredWidth}px`;
      return;
    }

    const useFixedLeft = panel.classList.contains('zhihu-ai-panel-fixed')
      || panel.classList.contains('question-fixed');
    const rect = anchor.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const available = viewportWidth - rect.right - gap * 2;
    const width = Math.max(minWidth, Math.min(preferredWidth, Math.max(available, minWidth)));
    panel.style.width = `${Math.round(Math.min(width, Math.max(available, minWidth)))}px`;

    if (useFixedLeft) {
      let left = rect.right + gap;
      const maxLeft = viewportWidth - Number.parseFloat(panel.style.width) - gap;
      if (available >= minWidth) {
        left = Math.min(left, maxLeft);
      } else {
        left = Math.max(rect.right + 8, maxLeft);
      }
      panel.style.left = `${Math.round(Math.max(gap, left))}px`;
    }
  }, [activeMode, panelType, targetElement]);

  useEffect(() => {
    // 初始化 transform，避免浏览器计算差异导致首次拖动跳变
    applyDragTransform(dragOffsetRef.current.x, dragOffsetRef.current.y);
    const panel = panelRef.current;
    const unbindTheme = panel ? bindThemeRoot(panel) : undefined;
    return () => {
      unbindTheme?.();
      endDrag();
    };
  }, []);

  useEffect(() => {
    if (streaming || !markdownRef.current || mermaidHosts.length === 0) {
      return;
    }
    return mountMermaidHosts(markdownRef.current, mermaidHosts, {
      onRepair: (source, error) => {
        const repair = mermaidRepairRef.current;
        if (!repair) {
          return Promise.reject(new Error('修复不可用'));
        }
        return repair(source, error);
      },
      onRepaired: (id, nextSource) => mermaidRepairedRef.current?.(id, nextSource),
    });
  }, [content, streaming]);

  const handleCopy = async () => {
    try {
      const now = new Date();
      const timestamp = now.toLocaleString('zh-CN', { hour12: false });
      const url = sourceUrl || window.location.href;
      const copyText = markdown
        ? `${markdown}\n\n---\n**来源**: ${url}\n**生成时间**: ${timestamp}`
        : content;

      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success('已复制到剪贴板');
    } catch (err) {
      console.error('复制失败:', err);
      toast.error('复制失败，请检查浏览器剪贴板权限');
    }
  };

  return (
    <div
      ref={panelRef}
      className={`zhihu-ai-side-panel ${className} ${dragging ? 'zhihu-ai-side-panel--dragging' : ''}`}
      aria-label={title}
    >
      <div className="zhihu-ai-answer-result">
        <div
          className="zhihu-ai-answer-result-header zhihu-ai-draggable-header"
          onPointerDown={handleHeaderPointerDown}
          title="按住拖动面板"
        >
          <div className="zhihu-ai-panel-tabs" role="tablist" aria-label="梳理方式">
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'summary'}
              className={`zhihu-ai-panel-tab ${activeMode === 'summary' ? 'is-active' : ''}`}
              onClick={() => onModeChange?.('summary')}
            >
              AI总结
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'mermaid'}
              className={`zhihu-ai-panel-tab ${activeMode === 'mermaid' ? 'is-active' : ''}`}
              onClick={() => onModeChange?.('mermaid')}
            >
              图梳理
            </button>
          </div>
          <div className="zhihu-ai-result-actions">
            <button
              type="button"
              className="zhihu-ai-result-copy"
              onClick={handleCopy}
              title={copied ? '已复制' : streaming ? '请等待生成完成后再复制' : '复制Markdown格式'}
              disabled={!content || streaming}
              aria-label={copied ? '已复制' : '复制'}
            >
              {copied ? (
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                  <path d="M5 12.5l4.2 4.2L19 7.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                  <rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M6 15.5V6.8A1.8 1.8 0 0 1 7.8 5H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="zhihu-ai-result-copy"
              onClick={onRefresh}
              title={streaming || actionsLocked ? '请等待当前生成完成' : activeMode === 'mermaid' ? '重新梳理' : '重新总结'}
              disabled={!onRefresh || streaming || actionsLocked}
              aria-label={activeMode === 'mermaid' ? '重新梳理' : '重新总结'}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                <path d="M19.4 12a7.4 7.4 0 1 1-2.1-5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M17.2 3.8v3.8H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              className="zhihu-ai-answer-result-close"
              onClick={onClose}
              title="关闭"
              aria-label="关闭"
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="zhihu-ai-answer-result-body" role="tabpanel">
          {cachedAt && (
            <div className="zhihu-ai-cache-chip">
              来自缓存 · {formatCachedTime(cachedAt)}
            </div>
          )}
          {!content && loading ? (
            <div className="zhihu-ai-inline-loading">
              <div className="zhihu-ai-inline-spinner"></div>
              <span>AI正在分析内容，请稍候...</span>
            </div>
          ) : !content ? (
            <div className="zhihu-ai-empty-mode">
              <p>{actionsLocked ? '请等待另一项生成完成' : activeMode === 'mermaid' ? '尚未生成图梳理' : '尚未生成AI总结'}</p>
              {onRefresh && (
                <button
                  type="button"
                  className="zhihu-ai-empty-mode-btn"
                  onClick={onRefresh}
                  disabled={actionsLocked}
                >
                  {activeMode === 'mermaid' ? '开始图梳理' : '开始AI总结'}
                </button>
              )}
            </div>
          ) : (
            <>
              <div
                ref={markdownRef}
                className="zhihu-ai-markdown-body"
                dangerouslySetInnerHTML={{ __html: content }}
              />
              {streaming && <span className="zhihu-ai-streaming-cursor"></span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
