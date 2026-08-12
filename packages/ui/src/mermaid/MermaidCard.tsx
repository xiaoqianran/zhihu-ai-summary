import { useEffect, useRef, useState } from 'preact/hooks';
import DOMPurify from 'dompurify';
import { getMermaidThemeOptions } from '../theme';
import { enqueueMermaidTask } from './queue';

interface MermaidCardProps {
  source: string;
  title?: string;
  onRepair?: (source: string, error: string) => Promise<string>;
  onRepaired?: (nextSource: string) => void;
}

type CardStatus = 'pending' | 'rendering' | 'ready' | 'error';

let mermaidMod: typeof import('mermaid').default | null = null;

async function getMermaid() {
  if (!mermaidMod) {
    const mod = await import('mermaid');
    mermaidMod = mod.default;
  }
  const theme = getMermaidThemeOptions();
  mermaidMod.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    themeVariables: theme,
    themeCSS: theme.themeCSS,
  });
  return mermaidMod;
}

export function MermaidCard({ source, title = '流程图', onRepair, onRepaired }: MermaidCardProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<CardStatus>('pending');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [scale, setScale] = useState(1);
  const [fitMode, setFitMode] = useState<'fit' | 'free'>('fit');
  const [workingSource, setWorkingSource] = useState(source);
  const [repairing, setRepairing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const renderIdRef = useRef(0);

  const renderSource = async (nextSource: string): Promise<boolean> => {
    const renderId = ++renderIdRef.current;
    setStatus('rendering');
    setError('');
    try {
      const mermaid = await getMermaid();
      const svgText = await enqueueMermaidTask(async () => {
        const id = `zhihu-ai-mmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const result = await mermaid.render(id, nextSource);
        return result.svg;
      });
      if (renderId !== renderIdRef.current) {
        return false;
      }
      const cleanSvg = DOMPurify.sanitize(svgText, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ['foreignObject'],
      });
      setSvg(cleanSvg);
      setStatus('ready');
      setFitMode('fit');
      setScale(1);
      return true;
    } catch (err) {
      if (renderId !== renderIdRef.current) {
        return false;
      }
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  };

  useEffect(() => {
    setWorkingSource(source);
    void renderSource(source);
  }, [source]);

  useEffect(() => {
    if (status !== 'ready' || fitMode !== 'fit') {
      return;
    }
    const viewport = viewportRef.current;
    const stage = viewport?.querySelector('.zhihu-ai-mermaid-stage') as HTMLElement | null;
    const svgEl = viewport?.querySelector('svg');
    if (!viewport || !stage || !svgEl) {
      return;
    }
    const natural = svgEl.getBoundingClientRect().width / scale || svgEl.clientWidth || 760;
    const available = Math.max(220, viewport.clientWidth - 32);
    const next = Math.min(1.35, available / Math.max(natural, 1));
    setScale(Math.max(0.25, Number(next.toFixed(2))));
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  }, [status, fitMode, svg]);

  const zoom = (factor: number) => {
    setFitMode('free');
    setScale((prev) => Math.min(2.4, Math.max(0.35, Number((prev * factor).toFixed(2)))));
  };

  const toggleFullscreen = () => {
    setFullscreen((prev) => !prev);
  };

  const handleRepair = async () => {
    if (!onRepair) {
      void renderSource(workingSource);
      return;
    }
    setRepairing(true);
    try {
      const fixed = await onRepair(workingSource, error || 'unknown mermaid error');
      setWorkingSource(fixed);
      const ok = await renderSource(fixed);
      if (ok) {
        onRepaired?.(fixed);
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`zhihu-ai-mermaid-card${fullscreen ? ' is-lightbox' : ''}`}
      data-fit={fitMode}
    >
      {fullscreen && (
        <button type="button" className="zhihu-ai-mermaid-backdrop" onClick={toggleFullscreen} aria-label="关闭全屏" />
      )}
      <div className="zhihu-ai-mermaid-shell">
        <div className="zhihu-ai-mermaid-toolbar">
          <span className="zhihu-ai-mermaid-title">{title}</span>
          <div className="zhihu-ai-mermaid-tools">
            <button type="button" className="zhihu-ai-mermaid-tool" onClick={() => { setFitMode('fit'); }} disabled={status !== 'ready'} title="适应宽度">适应</button>
            <button type="button" className="zhihu-ai-mermaid-tool" onClick={() => zoom(1 / 1.15)} disabled={status !== 'ready'} title="缩小">−</button>
            <span className="zhihu-ai-mermaid-scale">{Math.round(scale * 100)}%</span>
            <button type="button" className="zhihu-ai-mermaid-tool" onClick={() => zoom(1.15)} disabled={status !== 'ready'} title="放大">+</button>
            <button type="button" className="zhihu-ai-mermaid-tool" onClick={toggleFullscreen} disabled={status !== 'ready'} title={fullscreen ? '退出全屏' : '全屏查看'}>
              {fullscreen ? '退出' : '全屏'}
            </button>
            <button type="button" className="zhihu-ai-mermaid-tool" onClick={() => void renderSource(workingSource)} disabled={status === 'rendering'} title="重新渲染">重试</button>
            {onRepair && (
              <button type="button" className="zhihu-ai-mermaid-tool" onClick={() => void handleRepair()} disabled={repairing || status === 'rendering'} title="让 AI 修复语法">
                {repairing ? '修复中' : '修复'}
              </button>
            )}
          </div>
        </div>
        <div
          className="zhihu-ai-mermaid-viewport"
          ref={viewportRef}
          onWheel={(event) => {
            if (!event.ctrlKey && !event.metaKey) {
              return;
            }
            event.preventDefault();
            zoom(event.deltaY > 0 ? 1 / 1.12 : 1.12);
          }}
        >
          {status === 'ready' && (
            <div className="zhihu-ai-mermaid-stage" style={{ transform: `scale(${scale})` }}>
              <div className="zhihu-ai-mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
            </div>
          )}
          {(status === 'pending' || status === 'rendering') && (
            <div className="zhihu-ai-inline-loading">
              <div className="zhihu-ai-inline-spinner"></div>
              <span>图表将在进入视区时渲染</span>
            </div>
          )}
          {status === 'error' && (
            <div className="zhihu-ai-mermaid-error">
              <div className="zhihu-ai-mermaid-error-head">图示渲染失败</div>
              <pre>{error}</pre>
            </div>
          )}
          {status === 'ready' && <div className="zhihu-ai-mermaid-hint">Ctrl + 滚轮缩放</div>}
        </div>
      </div>
    </div>
  );
}
