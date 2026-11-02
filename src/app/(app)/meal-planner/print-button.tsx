"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button className="secondary-button print-hidden" onClick={() => window.print()} type="button">
      {label}
    </button>
  );
}
