export function sanitizeSvgOutput(svg) {
  const normalized = String(svg ?? "").replace(/^\uFEFF/, "");
  const svgStart = normalized.search(/<svg[\s>]/i);

  if (svgStart < 0) {
    throw new Error("Generated output does not contain an <svg> root element");
  }

  return `${normalized.slice(svgStart).trim()}\n`;
}
