# BPMN SVG Generator

Portable BPMN-to-SVG generator for Kogito-style process diagrams.

This utility is intended to replace ad hoc machine-local scripts with a repo-managed workflow:

- dependencies declared in the utility repo
- no `/tmp/...` imports
- no hardcoded Chrome path
- Kogito-compatible output under `src/main/resources/META-INF/processSVG/<processId>.svg`
- explicit `generate` and `verify` commands for local use and CI

## Status

Initial standalone CLI scaffold with:

- BPMN discovery under `src/main/resources`
- BPMN process-id extraction
- SVG generation through `@kie-tools/kie-editors-standalone`
- verification for missing, stale, orphaned, and duplicate outputs
- optional changed-file generation via `git diff`

## Install

```bash
npm install
npx playwright install chromium
```

This installs Playwright's managed headless Chromium runtime. The tool does not require a system Chrome install or a hardcoded Chrome path.

## Commands

Generate all BPMN SVGs for a consumer repo:

```bash
npx bpmn-svg generate --root /path/to/consumer-repo --all
```

Generate to a custom output directory:

```bash
npx bpmn-svg generate --root /path/to/consumer-repo --all --output-dir /tmp/processSVG
```

Generate one BPMN file:

```bash
npx bpmn-svg generate --input /path/to/consumer-repo/src/main/resources/com/example/process.bpmn2
```

Generate SVGs only for BPMNs changed from a git base ref:

```bash
npx bpmn-svg generate --root /path/to/consumer-repo --changed --base origin/main
```

Verify coverage and staleness:

```bash
npx bpmn-svg verify --root /path/to/consumer-repo
```

Verify a custom output directory:

```bash
npx bpmn-svg verify --root /path/to/consumer-repo --output-dir /tmp/processSVG
```

## CI or Jenkins

Use the same commands in CI:

```bash
npm ci
npx playwright install chromium
npx bpmn-svg verify --root "$WORKSPACE/engine"
```

For generation jobs:

```bash
npm ci
npx playwright install chromium
npx bpmn-svg generate --root "$WORKSPACE/engine" --all
```

If CI needs artifacts outside the consumer repo, pass `--output-dir`:

```bash
npx bpmn-svg generate --root "$WORKSPACE/engine" --all --output-dir "$WORKSPACE/generated/processSVG"
npx bpmn-svg verify --root "$WORKSPACE/engine" --output-dir "$WORKSPACE/generated/processSVG"
```

Set `BPMN_SVG_RENDER_TIMEOUT_MS` if large diagrams need a longer render timeout.

## Release and publish

This repo is set up to publish from GitHub Actions.

Local verification before a release:

```bash
npm ci
npm test
npm run pack:check
```

To publish a new version:

```bash
npm version patch
git push origin main --follow-tags
```

The `publish.yml` workflow publishes tagged versions to npm. The recommended npm setup is trusted publishing from GitHub Actions, configured once on npmjs.com for:

- GitHub user: `karthikeyanga`
- Repository: `bpmn-svg-generator`
- Workflow file: `publish.yml`

Until trusted publishing is configured on npm, you can switch the workflow to token-based publishing with an `NPM_TOKEN` repository secret if needed.

## Output convention

For BPMN files discovered under:

- `src/main/resources/**/*.bpmn`
- `src/main/resources/**/*.bpmn2`

the generated SVG output is:

- `src/main/resources/META-INF/processSVG/<processId>.svg`

The output filename is based on BPMN `processId`, not BPMN filename.

Use `--output-dir <dir>` to override only the output directory. The file name still remains `<processId>.svg`.

Relative `--output-dir` values are resolved from the consumer repo root. Absolute paths are used as-is.

The renderer creates short-lived host files in the operating system temp directory and removes them after each render. Repo-local scratch folders such as `tmp/` and `.tmp/` are ignored by `.gitignore`.

## Verification model

Generated SVGs include a small metadata comment recording:

- generator version
- source BPMN relative path
- BPMN content SHA-256
- process id

`verify` uses that metadata to report:

- missing SVGs
- stale SVGs
- orphaned SVGs
- duplicate process ids

## Intended consumer workflow

This repo is designed to be consumed by engine or workflow repos later via:

- local sibling checkout during early adoption
- npm package publishing later
- Maven wrapper scripts or exec plugin integration
- CI verification steps
