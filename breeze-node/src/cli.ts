// CLI.

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { run, runFile, VERSION } from "./index";

// Manifest written to breeze.json by `breeze init`/`breeze new`. All fields
// are optional so we can read other projects' manifests defensively.
interface BreezeManifest {
  name?: string;
  version?: string;
  entry?: string;
  description?: string;
  dependencies?: Record<string, string>;
}

function readManifest(dir: string): BreezeManifest | null {
  const p = path.join(dir, "breeze.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function printHelp(): void {
  console.log(`
  breeze ${VERSION} — the easiest programming language

  USAGE
    breeze <command> [args]

  COMMANDS
    run <file.bz>           Run a Breeze program file
    eval "<code>"           Run a one-line Breeze program
    new <name>              Scaffold a new Breeze project in ./<name>
    init [name]             Create breeze.json in the current folder
    install <source>        Install a package from GitHub into breeze_modules/
    list                    List packages installed in breeze_modules/
    version                 Print the installed Breeze version
    help                    Show this help message

  INSTALL SOURCES
    breeze install owner/repo           -> github.com/owner/repo
    breeze install github:owner/repo    -> same as above
    breeze install https://github.com/owner/repo.git

  EXAMPLES
    breeze run main.bz
    breeze eval "show 1 + 2"
    breeze new my-app
    breeze init my-app
    breeze install Saff9/breeze-string
    breeze list

  OPTIONS
    -v, --version      Print version
    -h, --help         Show help
    --sandbox          Run with fs/env/python and http.get/post disabled
                       (http.listen stays available). Used with run/eval.

  DOCUMENTATION
    https://github.com/Saff9/Breeze
`);
}

function cmdRun(
  fileArg: string | undefined,
  options: { sandbox?: boolean } = {}
): void {
  if (!fileArg) {
    console.error("Error: 'breeze run' needs a file path. Example: breeze run main.bz");
    process.exit(2);
  }
  const result = runFile(fileArg, { sandbox: options.sandbox });
  for (const line of result.output) {
    console.log(line);
  }
  if (result.error) {
    console.error(result.errorFormatted || result.error);
    process.exit(1);
  }
  // Don't exit(0): a started http server keeps the event loop alive to serve requests.
}

function cmdEval(
  code: string | undefined,
  options: { sandbox?: boolean } = {}
): void {
  if (code === undefined) {
    console.error("Error: 'breeze eval' needs a code string. Example: breeze eval \"show 1 + 2\"");
    process.exit(2);
  }
  const result = run(code, { sandbox: options.sandbox });
  for (const line of result.output) {
    console.log(line);
  }
  if (result.error) {
    console.error(result.errorFormatted || result.error);
    process.exit(1);
  }
}

function cmdNew(name: string | undefined): void {
  if (!name) {
    console.error("Error: 'breeze new' needs a project name. Example: breeze new my-app");
    process.exit(2);
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    console.error(`Error: invalid project name '${name}'. Use letters, numbers, hyphens or underscores, and start with a letter.`);
    process.exit(2);
  }

  const target = path.resolve(name);
  if (fs.existsSync(target)) {
    console.error(`Error: '${target}' already exists.`);
    process.exit(2);
  }

  fs.mkdirSync(target, { recursive: true });

  fs.writeFileSync(
    path.join(target, "main.bz"),
    `# Welcome to your Breeze app!
#
# Run it with:  breeze run main.bz
# Edit it and re-run to see changes.

show "Hello from Breeze!"

# Try the standard library:
show "Pi is " + math.pi
show "Now is " + time.now()

# Define a function
func greet(name):
  return "Hello, " + name + "!"

show greet("World")
`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(target, "package.json"),
    JSON.stringify(
      {
        name,
        version: "1.0.0",
        description: "A Breeze app",
        scripts: {
          start: "breeze run main.bz",
        },
        dependencies: {
          "breeze-lang": "^1.0.0",
        },
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  fs.writeFileSync(
    path.join(target, "breeze.json"),
    JSON.stringify(
      {
        name,
        version: "1.0.0",
        entry: "main.bz",
        description: "A Breeze app",
        language: "breeze",
        dependencies: {},
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  fs.writeFileSync(
    path.join(target, "README.md"),
    `# ${name}

A [Breeze](https://github.com/Saff9/Breeze) app.

## Run

\`\`\`bash
breeze run main.bz
\`\`\`

Or with npm:

\`\`\`bash
npm install
npm start
\`\`\`

## Learn more

- [Breeze documentation](https://github.com/Saff9/Breeze)
- Standard library: \`http\`, \`json\`, \`fs\`, \`env\`, \`time\`, \`math\`
`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(target, ".gitignore"),
    `breeze_modules/
node_modules/
*.log
.DS_Store
.env
dist/
`,
    "utf8"
  );

  console.log(`Created Breeze project '${name}' in ${target}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${name}`);
  console.log("  npm install");
  console.log("  breeze run main.bz");
}

function cmdInit(nameArg: string | undefined): void {
  const dir = process.cwd();
  const manifestPath = path.join(dir, "breeze.json");
  if (fs.existsSync(manifestPath)) {
    console.error(`Error: breeze.json already exists in ${dir}`);
    process.exit(2);
  }

  // Default to the current folder name when the user doesn't pass one.
  const name = nameArg || path.basename(dir);
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    console.error(
      `Error: invalid package name '${name}'. Use letters, numbers, hyphens or underscores, and start with a letter.`
    );
    process.exit(2);
  }

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        name,
        version: "1.0.0",
        description: "",
        entry: "main.bz",
        dependencies: {},
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  // Don't overwrite an existing entry file.
  if (!fs.existsSync(path.join(dir, "main.bz"))) {
    fs.writeFileSync(
      path.join(dir, "main.bz"),
      `# ${name}\n\nshow "Hello from Breeze!"\n`,
      "utf8"
    );
  }

  // Ensure breeze_modules/ is gitignored whether or not .gitignore exists.
  const gitignorePath = path.join(dir, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const existing = fs.readFileSync(gitignorePath, "utf8");
    if (!/^breeze_modules\//m.test(existing)) {
      fs.writeFileSync(gitignorePath, "breeze_modules/\n" + existing, "utf8");
    }
  } else {
    fs.writeFileSync(
      gitignorePath,
      `breeze_modules/\nnode_modules/\n*.log\n.DS_Store\n.env\ndist/\n`,
      "utf8"
    );
  }

  if (!fs.existsSync(path.join(dir, "README.md"))) {
    fs.writeFileSync(
      path.join(dir, "README.md"),
      `# ${name}\n\nA [Breeze](https://github.com/Saff9/Breeze) app.\n\n## Run\n\n\`\`\`bash\nbreeze run main.bz\n\`\`\`\n`,
      "utf8"
    );
  }

  console.log(`Initialized Breeze package '${name}' in ${dir}`);
  console.log("");
  console.log("Created: breeze.json, main.bz, .gitignore, README.md");
  console.log("");
  console.log("Install a package with:  breeze install owner/repo");
}

// Translate a user-supplied source spec into a git clone URL.
//   owner/repo               -> https://github.com/owner/repo.git
//   github:owner/repo        -> https://github.com/owner/repo.git
//   https://.../*.git        -> as-is
//   git+https://...          -> https://...
function resolveSourceUrl(source: string): string {
  if (source.startsWith("github:")) {
    return `https://github.com/${source.slice("github:".length)}.git`;
  }
  if (source.startsWith("git+")) {
    return source.slice(4);
  }
  if (source.startsWith("https://") || source.startsWith("git@")) {
    return source;
  }
  // owner/repo shorthand → GitHub.
  return `https://github.com/${source}.git`;
}

// Package name = last path segment of the URL, without a .git suffix.
function packageNameFromUrl(url: string): string {
  const cleaned = url.replace(/\.git$/, "").replace(/\/$/, "");
  const seg = cleaned.split(/[\/:]/).pop();
  return seg || "package";
}

// Shell-quote a single argument so user input can't break out of the command.
function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function cmdInstall(source: string | undefined): void {
  const modulesDir = path.resolve(process.cwd(), "breeze_modules");

  if (!source) {
    // No source given: install every dependency declared in breeze.json.
    const manifest = readManifest(process.cwd());
    if (!manifest || !manifest.dependencies) {
      console.error(
        "Error: 'breeze install' needs a source, or a breeze.json with a dependencies field."
      );
      console.error("Example: breeze install Saff9/breeze-string");
      process.exit(2);
    }
    const deps = Object.entries(manifest.dependencies);
    if (deps.length === 0) {
      console.log("No dependencies declared in breeze.json.");
      return;
    }
    const visited = new Set<string>();
    for (const [depName, depSource] of deps) {
      const url = resolveSourceUrl(depSource);
      const dest = path.join(modulesDir, depName);
      installPackageRecursive(url, depName, dest, modulesDir, visited);
    }
    return;
  }

  const url = resolveSourceUrl(source);
  const name = packageNameFromUrl(url);
  const dest = path.join(modulesDir, name);

  installPackageRecursive(url, name, dest, modulesDir, new Set());
}

// Depth-first install with a visited set so diamond dependencies don't loop.
function installPackageRecursive(
  url: string,
  name: string,
  dest: string,
  modulesDir: string,
  visited: Set<string>
): void {
  if (visited.has(dest)) return;
  visited.add(dest);

  fs.mkdirSync(modulesDir, { recursive: true });

  if (fs.existsSync(dest)) {
    // Already installed; still recurse into its dependencies.
    console.log(`already installed: ${name}`);
  } else {
    try {
      execSync(
        `git clone --depth 1 ${shellQuote(url)} ${shellQuote(dest)}`,
        { stdio: ["ignore", "ignore", "pipe"] }
      );
    } catch (e) {
      console.error(`Error: failed to clone ${url}`);
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
    // Drop the cloned repo's git metadata so it doesn't nest as a submodule.
    try {
      fs.rmSync(path.join(dest, ".git"), { recursive: true, force: true });
    } catch {
      // Best effort; ignore cleanup failures.
    }
    console.log(`installed ${name} from ${url}`);
  }

  // Monorepo support: if the cloned repo has a `lib/` folder, treat it as a
  // monorepo and copy each `lib/<subpackage>/` up to `breeze_modules/<subpackage>/`
  // so they can be imported directly by name (e.g. `import { map } from "list"`
  // resolves to breeze_modules/list/main.bz, not breeze_modules/Breeze/lib/list/).
  const libDir = path.join(dest, "lib");
  if (fs.existsSync(libDir) && fs.statSync(libDir).isDirectory()) {
    const subpackages: string[] = [];
    for (const entry of fs.readdirSync(libDir)) {
      const src = path.join(libDir, entry);
      if (!fs.statSync(src).isDirectory()) continue;
      const subDest = path.join(modulesDir, entry);
      fs.cpSync(src, subDest, { recursive: true });
      // Mark as visited so a later `breeze install <subpackage>` (or a
      // transitive dep pointing at the same name) is a no-op rather than a
      // re-clone of the whole monorepo under a different folder.
      visited.add(subDest);
      subpackages.push(entry);
    }
    if (subpackages.length > 0) {
      console.log(
        `Installed packages from monorepo: ${subpackages.join(", ")}`
      );
    }
    // The monorepo is self-contained: its subpackages live under lib/ and
    // don't need to be fetched from GitHub individually.
    return;
  }

  // Install transitive deps declared in the package's own breeze.json.
  const manifest = readManifest(dest);
  if (manifest && manifest.dependencies) {
    for (const [depName, depSource] of Object.entries(manifest.dependencies)) {
      const depUrl = resolveSourceUrl(depSource);
      const depDest = path.join(modulesDir, depName);
      installPackageRecursive(depUrl, depName, depDest, modulesDir, visited);
    }
  }
}

function cmdList(): void {
  const modulesDir = path.resolve(process.cwd(), "breeze_modules");
  if (!fs.existsSync(modulesDir)) {
    console.log("No breeze_modules/ directory in the current folder.");
    console.log("Run 'breeze install <source>' to add a package.");
    return;
  }
  const entries = fs
    .readdirSync(modulesDir)
    .filter((e) => fs.statSync(path.join(modulesDir, e)).isDirectory());
  if (entries.length === 0) {
    console.log("No packages installed.");
    return;
  }
  console.log("Installed packages:");
  for (const e of entries.sort()) {
    const manifest = readManifest(path.join(modulesDir, e));
    if (manifest) {
      const version = manifest.version ? `@${manifest.version}` : "";
      const desc = manifest.description ? ` — ${manifest.description}` : "";
      console.log(`  ${manifest.name || e}${version}${desc}`);
    } else {
      console.log(`  ${e}`);
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const cmd = args[0];
  switch (cmd) {
    case "run": {
      // Flags like --sandbox may appear after the file path
      // (e.g. `breeze run main.bz --sandbox`).
      const rest = args.slice(1);
      const sandbox = rest.includes("--sandbox");
      const positional = rest.filter((a) => a !== "--sandbox");
      cmdRun(positional[0], { sandbox });
      break;
    }
    case "eval": {
      const rest = args.slice(1);
      // `eval` takes a single quoted code string; --sandbox may follow it.
      const sandbox = rest.includes("--sandbox");
      const positional = rest.filter((a) => a !== "--sandbox");
      cmdEval(positional[0], { sandbox });
      break;
    }
    case "new":
      cmdNew(args[1]);
      break;
    case "init":
      cmdInit(args[1]);
      break;
    case "install":
      cmdInstall(args[1]);
      break;
    case "list":
      cmdList();
      break;
    case "version":
      console.log(`breeze ${VERSION}`);
      process.exit(0);
      break;
    case "--version":
    case "-v":
      console.log(VERSION);
      process.exit(0);
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      process.exit(0);
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      console.error("");
      printHelp();
      process.exit(2);
  }
}

// Detect stack overflow from deep recursion and give a friendly error.
process.on("uncaughtException", (e) => {
  if (e instanceof RangeError && /stack/i.test(e.message)) {
    console.error("Error: Breeze program exceeded the maximum recursion depth.");
    console.error("       For deeper recursion, run Node with --stack-size=65536:");
    console.error("         node --stack-size=65536 " + process.argv.slice(1).join(" "));
    process.exit(1);
  }
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

main();
