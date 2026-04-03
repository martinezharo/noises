export function SkipNextIcon({ size = 44, smSize, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ width: `var(--size, ${size}px)`, height: `var(--size, ${size}px)` }}
      className={`${smSize ? `[--size:${size}px] sm:[--size:${smSize}px]` : ''} ${className}`}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M3 5v14a1 1 0 0 0 1.504 .864l12 -7a1 1 0 0 0 0 -1.728l-12 -7a1 1 0 0 0 -1.504 .864z" />
      <path d="M20 6v12a1 1 0 0 0 2 0v-12a1 1 0 0 0 -2 0z" />
    </svg>
  );
}
