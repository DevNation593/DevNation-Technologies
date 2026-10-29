import JsBarcode from "jsbarcode";

/** Barras del código CODE128, en módulos: cada racha de "1" es una barra negra. */
export function barcodeBars(value: string): { x: number; width: number }[] {
  const result: { encodings?: { data: string }[] } = {};
  JsBarcode(result, value, { format: "CODE128" });
  const modules = (result.encodings ?? []).map((e) => e.data).join("");

  const bars: { x: number; width: number }[] = [];
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] !== "1") continue;
    const start = i;
    while (modules[i + 1] === "1") i++;
    bars.push({ x: start, width: i - start + 1 });
  }
  return bars;
}
