export function TimerIcon({ size = 44, smSize, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: `var(--size, ${size}px)`, height: `var(--size, ${size}px)` }}
      className={`${smSize ? `[--size:${size}px] sm:[--size:${smSize}px]` : ''} ${className}`}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M12 13m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
      <path d="M12 6v-3" />
      <path d="M9 3h6" />
      <path d="M12 13l3 -2" />
    </svg>
  );
}
