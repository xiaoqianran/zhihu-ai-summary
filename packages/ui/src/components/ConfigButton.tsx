import { useThemeRoot } from '../useThemeRoot';

interface ConfigButtonProps {
  onClick: () => void;
  autoHide?: boolean;
}

export function ConfigButton({ onClick, autoHide = false }: ConfigButtonProps) {
  const rootRef = useThemeRoot<HTMLDivElement>();

  return (
    <div ref={rootRef} className={`zhihu-ai-config-btn-wrapper${autoHide ? ' auto-hide' : ''}`}>
      <button type="button" className="zhihu-ai-config-btn" onClick={onClick} title="配置" aria-label="打开配置">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M19.2 12.8v-1.6l1.5-1.1-1.4-2.4-1.8.5a6.9 6.9 0 0 0-1.4-.8l-.3-1.9H10.2l-.3 1.9c-.5.2-1 .5-1.4.8l-1.8-.5-1.4 2.4 1.5 1.1v1.6l-1.5 1.1 1.4 2.4 1.8-.5c.4.3.9.6 1.4.8l.3 1.9h3.6l.3-1.9c.5-.2 1-.5 1.4-.8l1.8.5 1.4-2.4-1.5-1.1z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
