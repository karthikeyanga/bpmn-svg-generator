import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

export async function findChangedBpmnFiles(consumerRoot, baseRef) {
  const resourcesPath = "src/main/resources";
  const { stdout } = await execFileAsync(
    "git",
    ["-C", consumerRoot, "diff", "--name-only", "--diff-filter=ACMR", baseRef, "--", resourcesPath],
    { cwd: consumerRoot }
  );

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((relativePath) => [".bpmn", ".bpmn2"].includes(path.extname(relativePath).toLowerCase()))
    .map((relativePath) => path.join(consumerRoot, relativePath));
}
