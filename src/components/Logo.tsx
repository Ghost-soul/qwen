export default function Logo({
  className = "",
  small = false,
}: {
  className?: string;
  small?: boolean;
}) {
  return (
    <span
      className={`brand-mark ${small ? "small" : ""} ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" fill="none">
        <path
          d="M12.5 15.5C20 7 36 12.5 36 24S23 41 14.5 32.5"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M12.5 25c7-6.5 15-5.5 23.5-1M12.5 33l2-10"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
