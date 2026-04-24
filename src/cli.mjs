import path from "node:path";
import { runGenerate } from "./generate.mjs";
import { runVerify } from "./verify.mjs";

function printHelp() {
  console.log(`Usage:
  bpmn-svg generate --root <consumer-repo> --all [--output-dir <dir>]
  bpmn-svg generate --root <consumer-repo> --changed --base <git-ref> [--output-dir <dir>]
  bpmn-svg generate --input <bpmn-file> [--root <consumer-repo>] [--output-dir <dir>]
  bpmn-svg verify --root <consumer-repo> [--output-dir <dir>]`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {
    command,
    all: false,
    changed: false,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    switch (token) {
      case "--root":
        flags.root = rest[++index];
        break;
      case "--input":
        flags.input = rest[++index];
        break;
      case "--output-dir":
        flags.outputDir = rest[++index];
        break;
      case "--base":
        flags.baseRef = rest[++index];
        break;
      case "--all":
        flags.all = true;
        break;
      case "--changed":
        flags.changed = true;
        break;
      case "--help":
      case "-h":
        flags.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  return flags;
}

function inferRootFromInput(input) {
  const absoluteInput = path.resolve(input);
  const marker = `${path.sep}src${path.sep}main${path.sep}resources${path.sep}`;
  const markerIndex = absoluteInput.indexOf(marker);
  if (markerIndex < 0) {
    return path.dirname(absoluteInput);
  }
  return absoluteInput.slice(0, markerIndex);
}

export async function main(argv) {
  const args = parseArgs(argv);

  if (!args.command || args.help) {
    printHelp();
    return;
  }

  if (args.command === "generate") {
    if (args.input) {
      args.root = args.root ?? inferRootFromInput(args.input);
      await runGenerate(args);
      return;
    }

    if (!args.root) {
      throw new Error("generate requires --root <consumer-repo> unless --input is used");
    }

    if (args.changed && !args.baseRef) {
      throw new Error("generate --changed requires --base <git-ref>");
    }

    if (!args.all && !args.changed) {
      throw new Error("generate requires one of --all, --changed, or --input");
    }

    await runGenerate(args);
    return;
  }

  if (args.command === "verify") {
    if (!args.root) {
      throw new Error("verify requires --root <consumer-repo>");
    }
    await runVerify(args);
    return;
  }

  throw new Error(`Unknown command: ${args.command}`);
}
