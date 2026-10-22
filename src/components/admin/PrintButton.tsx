"use client";

export default function PrintButton({ label = "Imprimir / PDF" }: { label?: string }) {
  return (
    <button className="btn-success" onClick={() => window.print()}>
      {label}
    </button>
  );
}
