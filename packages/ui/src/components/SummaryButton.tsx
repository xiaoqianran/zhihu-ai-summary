// No imports needed with JSX transform

interface SummaryButtonProps {
  text: string;
  loading?: boolean;
  onClick: () => void;
  className?: string;
  variant?: 'summary' | 'mermaid';
}

export function SummaryButton({ text, loading, onClick, className = '', variant = 'summary' }: SummaryButtonProps) {
  return (
    <button
      type="button"
      className={`zhihu-ai-summary-btn ${className}`}
      onClick={onClick}
      disabled={loading}
    >
      {variant === 'mermaid' ? (
        <svg className="icon" viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
          <circle cx="6" cy="7" r="2.1" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="18" cy="7" r="2.1" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="17" r="2.1" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 8.2l3.2 6.4M16 8.2l-3.2 6.4" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ) : (
        <svg className="icon" viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
          <path
            d="M12 3.2l.86 4.18L17 8.2l-4.14.82L12 13.2l-.86-4.18L7 8.2l4.14-.82L12 3.2z"
            fill="currentColor"
          />
          <path
            d="M18.2 13.4l.42 2.04 2.08.4-2.08.4-.42 2.04-.42-2.04-2.08-.4 2.08-.4.42-2.04z"
            fill="currentColor"
            opacity="0.75"
          />
        </svg>
      )}
      {text}
    </button>
  );
}
