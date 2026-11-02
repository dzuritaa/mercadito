export function BrandMark() {
  return (
    <span aria-hidden="true" className="brand-mark">
      <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
        <path
          d="M12 20c-4.4 0-7-3-7-7 0-4.6 3.6-8 8.5-8.5C17 4.2 19 6 19 9c0 6-3 11-7 11Z"
          fill="currentColor"
          opacity="0.9"
        />
        <path
          d="M8.5 16.5C11 13 13.5 10.5 17 8.5"
          stroke="var(--sidebar)"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      </svg>
    </span>
  );
}
