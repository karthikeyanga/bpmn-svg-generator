import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const standaloneBundlePath = require.resolve("@kie-tools/kie-editors-standalone/dist/bpmn/index.js");

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, timeoutMs, label) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => {
          const message = typeof label === "function" ? label() : label;
          reject(new Error(`${message} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function createHostPage() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bpmn-svg-generator-"));
  const hostPath = path.join(tempDir, "host.html");
  await fs.writeFile(
    hostPath,
    '<!doctype html><html><body><div id="container" style="width:1600px;height:1200px"></div></body></html>',
    "utf8"
  );

  return { tempDir, hostUrl: pathToFileURL(hostPath).href };
}

export async function renderSvg({
  bpmnXml,
  sourcePathLabel,
  timeoutMs = Number(process.env.BPMN_SVG_RENDER_TIMEOUT_MS || 90000),
}) {
  const browser = await chromium.launch({ headless: true });
  const browserMessages = [];
  let tempDir;

  try {
    const hostPage = await createHostPage();
    tempDir = hostPage.tempDir;

    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    page.on("console", (message) => {
      browserMessages.push(`[${message.type()}] ${message.text()}`);
    });
    page.on("pageerror", (error) => {
      browserMessages.push(`[pageerror] ${error?.stack || String(error)}`);
    });
    await page.goto(hostPage.hostUrl);
    await page.addScriptTag({ path: standaloneBundlePath });

    const svg = await withTimeout(
      page.evaluate(
        async ({ xml, sourcePath }) => {
          const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

          const editor = window.BpmnEditor.open({
            container: document.getElementById("container"),
            initialContent: Promise.resolve(""),
            readOnly: true,
          });

          await sleep(5000);
          await editor.setContent(sourcePath, xml);
          await sleep(5000);

          return await editor.getPreview();
        },
        { xml: bpmnXml, sourcePath: sourcePathLabel }
      ),
      timeoutMs,
      () => `Rendering ${sourcePathLabel}${browserMessages.length ? `\nBrowser messages:\n${browserMessages.join("\n")}` : ""}`
    );

    await delay(100);

    if (!svg || !svg.includes("<svg")) {
      throw new Error("Preview SVG was empty or invalid");
    }

    return svg.trim();
  } finally {
    await browser.close();
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}
