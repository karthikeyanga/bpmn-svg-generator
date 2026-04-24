const PREFIX = "bpmn-svg-generator:";

export function buildMetadataComment(metadata) {
  const pairs = Object.entries(metadata).map(([key, value]) => `${key}=${String(value)}`);
  return `<!-- ${PREFIX}${pairs.join(";")} -->`;
}

export function prependMetadataComment(svg, metadata) {
  return `${buildMetadataComment(metadata)}\n${svg.trim()}\n`;
}

export function readMetadataComment(svgContent) {
  const match = svgContent.match(/<!--\s*bpmn-svg-generator:([^]+?)\s*-->/);
  if (!match) {
    return null;
  }

  const metadata = {};
  for (const pair of match[1].split(";")) {
    const [key, ...rest] = pair.split("=");
    metadata[key] = rest.join("=");
  }
  return metadata;
}
