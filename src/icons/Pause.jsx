export function PauseIcon({ size = 44, smSize, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ width: `var(--size, ${size}px)`, height: `var(--size, ${size}px)` }}
      className={`${smSize ? `[--size:${size}px] sm:[--size:${smSize}px]` : ''} ${className}`}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M9 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z" />
      <path d="M17 4h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2z" />
    </svg>
  );
}