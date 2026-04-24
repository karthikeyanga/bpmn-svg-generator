import fs from "node:fs/promises";
import path from "node:path";
import { buildBpmnCatalog, discoverBpmnFiles } from "./discovery.mjs";
import { findChangedBpmnFiles } from "./git.mjs";
import { prependMetadataComment } from "./metadata.mjs";
import { resolveConsumerRoot, getRelativeToRoot, getSvgOutputDir, toPosix } from "./paths.mjs";
import { GENERATOR_VERSION } from "./constants.mjs";
import { readBpmnDescriptor } from "./bpmn.mjs";
import { renderSvg } from "./renderer.mjs";

function getConfiguredSvgOutputPath(consumerRoot, outputDir, processId) {
  return path.join(getSvgOutputDir(consumerRoot, outputDir), `${processId}.svg`);
}

async function collectDescriptors(options) {
  if (options.input) {
    return [await readBpmnDescriptor(path.resolve(options.input))];
  }

  const consumerRoot = resolveConsumerRoot(options.root);
  const allFiles = await discoverBpmnFiles(consumerRoot);
  const { descriptors, processIdToDescriptor } = await buildBpmnCatalog(allFiles);

  if (!options.changed) {
    return descriptors;
  }

  const changedFiles = new Set(await findChangedBpmnFiles(consumerRoot, options.baseRef));
  const changedDescriptors = descriptors.filter((descriptor) => changedFiles.has(descriptor.filePath));

  for (const descriptor of changedDescriptors) {
    if (processIdToDescriptor.get(descriptor.processId)?.filePath !== descriptor.filePath) {
      throw new Error(`Process id collision detected for '${descriptor.processId}'`);
    }
  }

  return changedDescriptors;
}

export async function runGenerate(options) {
  const consumerRoot = resolveConsumerRoot(options.root);

  const descriptors = await collectDescriptors(options);

  if (descriptors.length === 0) {
    console.log("No BPMN files selected.");
    return { generated: 0 };
  }

  const svgOutputDir = getSvgOutputDir(consumerRoot, options.outputDir);
  await fs.mkdir(svgOutputDir, { recursive: true });

  for (const descriptor of descriptors) {
    const outputPath = getConfiguredSvgOutputPath(consumerRoot, options.outputDir, descriptor.processId);
    const svg = await renderSvg({
      bpmnXml: descriptor.xml,
      sourcePathLabel: getRelativeToRoot(consumerRoot, descriptor.filePath),
    });
    const content = prependMetadataComment(svg, {
      version: GENERATOR_VERSION,
      processId: descriptor.processId,
      source: getRelativeToRoot(consumerRoot, descriptor.filePath),
      sha256: descriptor.sha256,
    });

    await fs.writeFile(outputPath, content, "utf8");
    console.log(`${toPosix(descriptor.filePath)} -> ${toPosix(outputPath)}`);
  }

  return { generated: descriptors.length };
}
