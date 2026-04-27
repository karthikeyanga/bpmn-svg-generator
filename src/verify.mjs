import fs from "node:fs/promises";
import path from "node:path";
import { buildBpmnCatalog, discoverBpmnFiles } from "./discovery.mjs";
import { getSvgOutputDir, resolveConsumerRoot } from "./paths.mjs";

async function listSvgFiles(svgOutputDir) {
  try {
    const entries = await fs.readdir(svgOutputDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".svg")
      .map((entry) => path.join(svgOutputDir, entry.name))
      .sort();
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function runVerify(options) {
  const consumerRoot = resolveConsumerRoot(options.root);
  const bpmnFiles = await discoverBpmnFiles(consumerRoot);
  const { descriptors } = await buildBpmnCatalog(bpmnFiles);
  const expectedByProcessId = new Map(descriptors.map((descriptor) => [descriptor.processId, descriptor]));
  const svgOutputDir = getSvgOutputDir(consumerRoot, options.outputDir);
  const svgFiles = await listSvgFiles(svgOutputDir);

  const missing = [];
  const stale = [];
  const orphaned = [];

  for (const descriptor of descriptors) {
    const svgPath = path.join(svgOutputDir, `${descriptor.processId}.svg`);
    try {
      const [svgStats, bpmnStats] = await Promise.all([fs.stat(svgPath), fs.stat(descriptor.filePath)]);
      if (svgStats.mtimeMs < bpmnStats.mtimeMs) {
        stale.push({ processId: descriptor.processId, svgPath, sourcePath: descriptor.filePath });
      }
    } catch (error) {
      if (error && error.code === "ENOENT") {
        missing.push({ processId: descriptor.processId, svgPath, sourcePath: descriptor.filePath });
      } else {
        throw error;
      }
    }
  }

  for (const svgPath of svgFiles) {
    const processId = path.basename(svgPath, ".svg");
    if (!expectedByProcessId.has(processId)) {
      orphaned.push({ processId, svgPath });
    }
  }

  const problems = [
    ...missing.map((item) => `MISSING  ${item.processId} -> ${item.svgPath}`),
    ...stale.map((item) => `STALE    ${item.processId} -> ${item.svgPath}`),
    ...orphaned.map((item) => `ORPHAN  ${item.processId} -> ${item.svgPath}`),
  ];

  if (problems.length === 0) {
    console.log("SVG verification passed.");
    return { ok: true, missing, stale, orphaned };
  }

  for (const problem of problems) {
    console.log(problem);
  }

  const error = new Error(`SVG verification failed with ${problems.length} issue(s)`);
  error.code = "VERIFY_FAILED";
  error.details = { missing, stale, orphaned };
  throw error;
}
