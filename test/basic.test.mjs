import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { readBpmnDescriptor } from "../src/bpmn.mjs";
import { prependMetadataComment, readMetadataComment } from "../src/metadata.mjs";
import { getSvgOutputDir } from "../src/paths.mjs";

const fixturePath = path.resolve("test/fixtures/sample.bpmn2");

test("reads BPMN process id and hash", async () => {
  const descriptor = await readBpmnDescriptor(fixturePath);
  assert.equal(descriptor.processId, "sample_process");
  assert.equal(typeof descriptor.sha256, "string");
  assert.equal(descriptor.sha256.length, 64);
});

test("round-trips generator metadata comment", () => {
  const svg = prependMetadataComment("<svg></svg>", {
    version: "0.1.0",
    processId: "sample_process",
    source: "src/main/resources/sample.bpmn2",
    sha256: "abc123",
  });

  const metadata = readMetadataComment(svg);
  assert.deepEqual(metadata, {
    version: "0.1.0",
    processId: "sample_process",
    source: "src/main/resources/sample.bpmn2",
    sha256: "abc123",
  });
});

test("resolves custom output directory against the consumer root", () => {
  const consumerRoot = path.resolve("/workspace/engine");

  assert.equal(
    getSvgOutputDir(consumerRoot),
    path.resolve("/workspace/engine/src/main/resources/META-INF/processSVG")
  );
  assert.equal(getSvgOutputDir(consumerRoot, "target/processSVG"), path.resolve("/workspace/engine/target/processSVG"));
  assert.equal(getSvgOutputDir(consumerRoot, "/tmp/processSVG"), path.resolve("/tmp/processSVG"));
});
