import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const playwrightPackagePath = require.resolve("playwright/package.json");
const playwrightCliPath = path.join(path.dirname(playwrightPackagePath), "cli.js");

function runNodeCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed with exit code ${code}: node ${args.join(" ")}`));
    });
  });
}

export function isMissingPlaywrightBrowserError(error) {
  const message = error?.message ?? "";
  return message.includes("Executable doesn't exist");
}

export async function installChromiumBrowser() {
  await runNodeCommand([playwrightCliPath, "install", "chromium"]);
}
