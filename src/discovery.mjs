import fs from "node:fs/promises";
import path from "node:path";
import { BPMN_EXTENSIONS } from "./constants.mjs";
import { readBpmnDescriptor } from "./bpmn.mjs";
import { getResourcesRoot, getSvgOutputDir } from "./paths.mjs";

async function walk(dirPath, visitor) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    const shouldDescend = await visitor(absolutePath, entry);
    if (entry.isDirectory()) {
      if (shouldDescend === false) {
        continue;
      }
      await walk(absolutePath, visitor);
    }
  }
}

export async function discoverBpmnFiles(consumerRoot) {
  const resourcesRoot = getResourcesRoot(consumerRoot);
  const svgOutputDir = getSvgOutputDir(consumerRoot);
  const files = [];

  await fs.access(resourcesRoot);

  await walk(resourcesRoot, async (absolutePath, entry) => {
    if (absolutePath.startsWith(svgOutputDir)) {
      return false;
    }
    if (!entry.isFile()) {
      return;
    }
    if (BPMN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(absolutePath);
    }
  });

  files.sort();
  return files;
}

export async function buildBpmnCatalog(filePaths) {
  const descriptors = [];
  const processIdToDescriptor = new Map();

  for (const filePath of filePaths) {
    const descriptor = await readBpmnDescriptor(filePath);
    const existing = processIdToDescriptor.get(descriptor.processId);
    if (existing) {
      throw new Error(
        `Duplicate process id '${descriptor.processId}' found in ${existing.filePath} and ${descriptor.filePath}`
      );
    }
    processIdToDescriptor.set(descriptor.processId, descriptor);
    descriptors.push(descriptor);
  }

  return { descriptors, processIdToDescriptor };
}
