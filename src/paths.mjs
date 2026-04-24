import path from "node:path";
import { PROCESS_SVG_RELATIVE_PATH, RESOURCES_RELATIVE_PATH } from "./constants.mjs";

export function resolveConsumerRoot(rootArg = process.cwd()) {
  return path.resolve(rootArg);
}

export function getResourcesRoot(consumerRoot) {
  return path.join(consumerRoot, RESOURCES_RELATIVE_PATH);
}

export function getSvgOutputDir(consumerRoot, outputDir) {
  if (!outputDir) {
    return path.join(consumerRoot, PROCESS_SVG_RELATIVE_PATH);
  }
  return path.isAbsolute(outputDir) ? outputDir : path.resolve(consumerRoot, outputDir);
}

export function toPosix(value) {
  return value.split(path.sep).join(path.posix.sep);
}

export function getRelativeToRoot(consumerRoot, targetPath) {
  return toPosix(path.relative(consumerRoot, targetPath));
}
