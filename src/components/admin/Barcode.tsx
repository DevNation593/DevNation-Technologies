"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export default function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (ref.current) {
      JsBarcode(ref.current, value, { format: "CODE128", displayValue: false, height: 56, margin: 0, width: 1.4 });
    }
  }, [value]);

  return <svg ref={ref} role="img" aria-label={`Código de barras ${value}`} preserveAspectRatio="none" />;
}
