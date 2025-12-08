export interface LoadingProps {
  variant?: 'overlay' | 'inline' | 'spinner';
  size?: number;
  text?: string;
  className?: string;
}

export const Loading = ({
  variant = 'spinner',
  size = 32,
  text = 'Loading...',
  className = '',
}: LoadingProps) => {
  const spinner = (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      <defs>
        <linearGradient id="loading-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C5A26E" />
          <stop offset="100%" stopColor="#E8D4A8" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={(size - 3) / 2}
        fill="none"
        stroke="url(#loading-gradient)"
        strokeWidth="3"
        strokeDasharray="75 25"
        strokeLinecap="round"
      />
    </svg>
  );

  const content = (
    <div className="flex flex-row items-center gap-3">
      {spinner}
      {text && (
        <span className="text-base font-normal text-[#C5A26E] tracking-wide">
          {text}
        </span>
      )}
    </div>
  );

  if (variant === 'overlay') {
    return (
      <div className={`fixed inset-0 flex items-center justify-center bg-[rgba(11,11,13,0.8)] backdrop-blur-sm z-[9999] ${className}`}>
        {content}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex items-center justify-center py-10 ${className}`}>
        {content}
      </div>
    );
  }

  return <div className={className}>{content}</div>;
};
