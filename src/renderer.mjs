import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installChromiumBrowser, isMissingPlaywrightBrowserError } from "./playwright.mjs";

const require = createRequire(import.meta.url);
const standaloneBundlePath =
  process.env.BPMN_SVG_STANDALONE_BUNDLE_PATH || require.resolve("@kie-tools/bpmn-editor-standalone/dist/index.js");
const defaultReadyDelayMs = Number(process.env.BPMN_SVG_READY_DELAY_MS || 500);

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

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    if (!isMissingPlaywrightBrowserError(error)) {
      throw error;
    }

    console.error("Playwright Chromium is not installed yet. Bootstrapping it now...");
    await installChromiumBrowser();
    return await chromium.launch({ headless: true });
  }
}

export async function createSvgRenderer({
  timeoutMs = Number(process.env.BPMN_SVG_RENDER_TIMEOUT_MS || 90000),
  readyDelayMs = defaultReadyDelayMs,
} = {}) {
  const browser = await launchBrowser();
  let page;
  let tempDir;
  const browserMessages = [];

  async function getPage() {
    if (page) {
      return page;
    }

    const hostPage = await createHostPage();
    tempDir = hostPage.tempDir;
    page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    page.on("console", (message) => {
      browserMessages.push(`[${message.type()}] ${message.text()}`);
    });
    page.on("pageerror", (error) => {
      browserMessages.push(`[pageerror] ${error?.stack || String(error)}`);
    });
    page.on("requestfailed", (request) => {
      browserMessages.push(`[requestfailed] ${request.url()} ${request.failure()?.errorText || ""}`.trim());
    });
    await page.goto(hostPage.hostUrl);
    await page.addScriptTag({ path: standaloneBundlePath });
    return page;
  }

  return {
    async renderSvg({ bpmnXml, sourcePathLabel }) {
      return renderSvgWithPage({
        page: await getPage(),
        browserMessages,
        bpmnXml,
        sourcePathLabel,
        timeoutMs,
        readyDelayMs,
      });
    },
    async close() {
      try {
        if (page) {
          await page.close();
        }
      } finally {
        await browser.close();
        if (tempDir) {
          await fs.rm(tempDir, { recursive: true, force: true });
        }
      }
    },
  };
}

async function renderSvgWithPage({ page, browserMessages, bpmnXml, sourcePathLabel, timeoutMs, readyDelayMs }) {
  const browserMessageStart = browserMessages.length;
  try {
    const renderPromise = page
      .evaluate(
        async ({ xml, sourcePath, readyDelayMs }) => {
          const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const windowWithEditor = window;

          if (!windowWithEditor.__bpmnSvgGeneratorEditor) {
            windowWithEditor.__bpmnSvgGeneratorEditor = window.BpmnEditor.open({
              container: document.getElementById("container"),
              initialContent: Promise.resolve(xml),
              initialFileNormalizedPosixPathRelativeToTheWorkspaceRoot: sourcePath,
              readOnly: true,
            });
            await sleep(readyDelayMs);
          } else {
            await windowWithEditor.__bpmnSvgGeneratorEditor.setContent(sourcePath, xml);
          }

          return await windowWithEditor.__bpmnSvgGeneratorEditor.getPreview();
        },
        { xml: bpmnXml, sourcePath: sourcePathLabel, readyDelayMs }
      )
      .catch((error) => {
        const renderMessages = browserMessages.slice(browserMessageStart);
        if (renderMessages.length) {
          throw new Error(`${error.message}\nBrowser messages:\n${renderMessages.join("\n")}`, { cause: error });
        }
        throw error;
      });

    const svg = await withTimeout(
      renderPromise,
      timeoutMs,
      () => {
        const renderMessages = browserMessages.slice(browserMessageStart);
        return `Rendering ${sourcePathLabel}${renderMessages.length ? `\nBrowser messages:\n${renderMessages.join("\n")}` : ""}`;
      }
    );

    await delay(100);

    if (!svg || !svg.includes("<svg")) {
      throw new Error("Preview SVG was empty or invalid");
    }

    return svg.trim();
  } catch (error) {
    throw error;
  }
}

export async function renderSvg({
  bpmnXml,
  sourcePathLabel,
  timeoutMs = Number(process.env.BPMN_SVG_RENDER_TIMEOUT_MS || 90000),
  readyDelayMs = defaultReadyDelayMs,
}) {
  const renderer = await createSvgRenderer({ timeoutMs, readyDelayMs });
  try {
    return await renderer.renderSvg({ bpmnXml, sourcePathLabel });
  } finally {
    await renderer.close();
  }
}
