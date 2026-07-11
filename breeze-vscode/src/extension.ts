import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { spawn } from "child_process";

/**
 * Activates the Breeze VS Code extension.
 * Registers the `breeze.runFile` and `breeze.createProject` commands.
 */
export function activate(context: vscode.ExtensionContext): void {
  // Command: Run the active .bz file in a Breeze Output terminal.
  const runFileDisposable = vscode.commands.registerCommand(
    "breeze.runFile",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage(
          "Breeze: No active editor. Open a .bz file to run."
        );
        return;
      }

      const document = editor.document;

      if (document.languageId !== "breeze" && !document.fileName.endsWith(".bz")) {
        const choice = await vscode.window.showWarningMessage(
          "Breeze: This file doesn't look like a Breeze (.bz) file. Run it anyway?",
          "Run Anyway",
          "Cancel"
        );
        if (choice !== "Run Anyway") {
          return;
        }
      }

      // Save the file if it has unsaved changes.
      if (document.isDirty) {
        await document.save();
      }

      const filePath = document.uri.fsPath;
      const config = vscode.workspace.getConfiguration("breeze");
      const interpreterPath = config.get<string>("interpreterPath", "breeze");

      const terminal = vscode.window.createTerminal({
        name: "Breeze Output",
        location: vscode.TerminalLocation.Panel,
      });
      terminal.show(true);

      // A helper that sends text to the terminal, properly quoted.
      const send = (text: string) => {
        terminal.sendText(text, true);
      };

      // Wrap the file path in double quotes to handle spaces safely.
      const quotedFile = `"${filePath}"`;
      const quotedInterpreter = `"${interpreterPath}"`;

      // Run the interpreter as a child process to verify it exists first,
      // then either show output in the terminal or surface a friendly error.
      const probe = spawn(interpreterPath, [filePath], {
        cwd: path.dirname(filePath),
        shell: false,
      });

      let stderrOutput = "";
      let spawnFailed = false;

      probe.on("error", (err: Error) => {
        spawnFailed = true;
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          vscode.window.showErrorMessage(
            `Breeze: Interpreter "${interpreterPath}" was not found on your PATH. ` +
              "Install the Breeze language from https://github.com/Saff9/Breeze " +
              "or set the `breeze.interpreterPath` setting to the full path of the executable."
          );
        } else {
          vscode.window.showErrorMessage(
            `Breeze: Failed to start interpreter: ${err.message}`
          );
        }
      });

      probe.stderr.on("data", (chunk: Buffer) => {
        stderrOutput += chunk.toString();
      });

      probe.on("close", (code: number | null) => {
        if (spawnFailed) {
          return;
        }
        // Show the command and any captured stderr in the terminal.
        send(`echo [Breeze] Running ${quotedFile}`);
        if (stderrOutput.length > 0) {
          send(`echo ${quoteForShell(stderrOutput)}`);
        }
        send(`echo [Breeze] Process exited with code ${code ?? "null"}`);
        if (code !== null && code !== 0) {
          vscode.window.showWarningMessage(
            `Breeze: Program exited with code ${code}. Check the Breeze Output terminal for details.`
          );
        }
      });

      // Also run it directly in the terminal so the user can see live output.
      send(`${quotedInterpreter} ${quotedFile}`);
    }
  );

  // Command: Scaffold a new Breeze project in a folder chosen by the user.
  const createProjectDisposable = vscode.commands.registerCommand(
    "breeze.createProject",
    async () => {
      const projectName = await vscode.window.showInputBox({
        prompt: "Enter a name for your new Breeze project",
        placeHolder: "my-breeze-app",
        validateInput: (value: string) => {
          if (!value || value.trim().length === 0) {
            return "Project name cannot be empty";
          }
          if (!/^[a-zA-Z0-9_\-]+$/.test(value.trim())) {
            return "Use only letters, numbers, hyphens, and underscores";
          }
          return null;
        },
      });

      if (!projectName) {
        return;
      }

      const folderUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Create Project Here",
      });

      if (!folderUri || folderUri.length === 0) {
        return;
      }

      const parentDir = folderUri[0].fsPath;
      const projectDir = path.join(parentDir, projectName);

      try {
        if (fs.existsSync(projectDir)) {
          vscode.window.showErrorMessage(
            `Breeze: A folder named "${projectName}" already exists in the selected location.`
          );
          return;
        }

        fs.mkdirSync(projectDir, { recursive: true });

        // main.bz — a friendly hello-world template.
        const mainBz = [
          `# Welcome to Breeze — the easiest programming language!`,
          ``,
          `show "Hello, World!"`,
          ``,
          `# Try a variable and some math:`,
          `name = "Breeze"`,
          `show "Hello, " + name`,
          ``,
          `# Try a loop:`,
          `repeat i from 1 to 5:`,
          `  show i`,
          ``,
          `# Define a function:`,
          `func greet(who):`,
          `  show "Hi, " + who`,
          ``,
          `greet("friend")`,
          ``,
        ].join("\n");
        fs.writeFileSync(path.join(projectDir, "main.bz"), mainBz, "utf8");

        // breeze.json — a minimal project manifest.
        const breezeJson = JSON.stringify(
          {
            name: projectName,
            version: "1.0.0",
            description: "A Breeze project",
            main: "main.bz",
            license: "MIT",
          },
          null,
          2
        );
        fs.writeFileSync(
          path.join(projectDir, "breeze.json"),
          breezeJson + "\n",
          "utf8"
        );

        // README.md — a project readme.
        const readme = [
          `# ${projectName}`,
          ``,
          `A project written in [Breeze](https://github.com/Saff9/Breeze), the easiest programming language.`,
          ``,
          `## Getting Started`,
          ``,
          `1. Install the Breeze interpreter from https://github.com/Saff9/Breeze`,
          `2. Run the project:`,
          ``,
          "```sh",
          `breeze main.bz`,
          "```",
          ``,
          `## Project Structure`,
          ``,
          `- \`main.bz\` — the entry point of your Breeze program`,
          `- \`breeze.json\` — project manifest`,
          ``,
          `## License`,
          ``,
          `MIT`,
          ``,
        ].join("\n");
        fs.writeFileSync(path.join(projectDir, "README.md"), readme, "utf8");

        const projectUri = vscode.Uri.file(projectDir);
        await vscode.commands.executeCommand(
          "vscode.openFolder",
          projectUri,
          true
        );

        vscode.window.showInformationMessage(
          `Breeze: Created project "${projectName}" and opened it in a new window.`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(
          `Breeze: Failed to create project: ${message}`
        );
      }
    }
  );

  context.subscriptions.push(runFileDisposable);
  context.subscriptions.push(createProjectDisposable);
}

/**
 * Quotes a string for safe inclusion in a shell `echo` command.
 * Wraps the value in single quotes and escapes any embedded single quotes.
 */
function quoteForShell(text: string): string {
  const escaped = text.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

/**
 * Deactivates the extension. VS Code calls this when the extension is unloaded.
 */
export function deactivate(): undefined {
  return undefined;
}
