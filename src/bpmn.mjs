import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: "@_",
});

function asArray(value) {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export async function readBpmnDescriptor(filePath) {
  const xml = await fs.readFile(filePath, "utf8");
  const parsed = parser.parse(xml);
  const definitions = parsed?.definitions;
  const processes = asArray(definitions?.process);

  if (processes.length === 0) {
    throw new Error(`No BPMN process found in ${filePath}`);
  }

  if (processes.length > 1) {
    throw new Error(`Multiple BPMN processes found in ${filePath}; v1 requires exactly one process per file`);
  }

  const processDefinition = processes[0];
  const processId = processDefinition?.["@_id"];

  if (!processId) {
    throw new Error(`Process id is missing in ${filePath}`);
  }

  return {
    filePath: path.resolve(filePath),
    xml,
    sha256: crypto.createHash("sha256").update(xml).digest("hex"),
    processId,
  };
}
