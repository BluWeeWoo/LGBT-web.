export function Bloom({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="currentColor"
      aria-hidden="true"
    >
      {Array.from({ length: 12 }, (_, i) => (
        <ellipse
          key={i}
          cx="32"
          cy="17"
          rx="4.3"
          ry="15.1"
          transform={`rotate(${i * 30} 32 32)`}
        />
      ))}
      <circle cx="32" cy="32" r="4" fill="var(--bloom-center, currentColor)" />
    </svg>
  );
}
export function Brand() {
  return (
    <img
      className="brand-logo"
      src="/rye-atlas-orbit.webp"
      alt="RYE — Raise Your Equality"
      width={740}
      height={216}
    />
  );
}
