import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

const RECENT_FILES_MAX = vscode.workspace
  .getConfiguration("elff.recentFiles")
  .get("maxCount", 50);
const STORAGE_KEY = "recentFiles";
let recentFiles: string[] = [];

export function activate(context: vscode.ExtensionContext) {
  recentFiles = context.globalState.get<string[]>(STORAGE_KEY, []);

  vscode.workspace.onDidOpenTextDocument((doc) => {
    if (doc.uri.scheme !== "file") {
      return;
    }
    const path = doc.uri.fsPath;
    const index = recentFiles.indexOf(path);
    if (index !== -1) {
      recentFiles.splice(index, 1);
    }
    recentFiles.unshift(path);
    if (recentFiles.length > RECENT_FILES_MAX) {
      recentFiles.pop();
    }

    context.globalState.update(STORAGE_KEY, recentFiles);
  });

  const findFileCommand = vscode.commands.registerCommand(
    "elff.findFile",
    async () => {
      const quickPick = vscode.window.createQuickPick();
      quickPick.placeholder = "Type a file path...";
      quickPick.matchOnDescription = true;
      quickPick.matchOnDetail = true;
      quickPick.ignoreFocusOut = true;
      quickPick.buttons = [
        {
          iconPath: new vscode.ThemeIcon("folder-opened"),
          tooltip: "Open Typed Path as Workspace",
        },
      ];
      quickPick.onDidTriggerButton(async (button) => {
        const inputPath = expandHome(quickPick.value.trim());

        if (fs.existsSync(inputPath) && fs.statSync(inputPath).isDirectory()) {
          quickPick.hide();
          await vscode.commands.executeCommand(
            "vscode.openFolder",
            vscode.Uri.file(inputPath),
            false
          );
        } else {
          vscode.window.showErrorMessage(
            "Typed path is not a valid directory."
          );
        }
      });

      const workspaceFolders = vscode.workspace.workspaceFolders;
      const homeDir = os.homedir();

      let baseDir: string;
      if (workspaceFolders && workspaceFolders.length > 0) {
        baseDir = workspaceFolders[0].uri.fsPath;
      } else {
        baseDir = homeDir;
      }

      const updateItems = (fullInput: string) => {
        fullInput = expandHome(fullInput);
        let directory: string;
        let partial: string;

        if (fs.existsSync(fullInput) && fs.statSync(fullInput).isDirectory()) {
          directory = fullInput;
          partial = "";
        } else {
          directory = path.dirname(fullInput);
          partial = path.basename(fullInput);
        }

        if (!fs.existsSync(directory)) {
          directory = baseDir;
        }

        directory = path.resolve(directory);

        try {
          const files = fs.readdirSync(directory);
          const matching = files
            .filter((f) => {
              if (!partial) {
                return true;
              }
              return f.toLowerCase().includes(partial.toLowerCase());
            })
            .map((f) => {
              const fullPath = path.join(directory, f);
              const isDir = fs.statSync(fullPath).isDirectory();
              return {
                label: f + (isDir ? path.sep : ""),
                iconPath: isDir
                  ? new vscode.ThemeIcon("folder")
                  : getFileIcon(f),
                detail: fullPath,
                alwaysShow: true,
                sortText: (isDir ? "0_" : "1_") + f.toLowerCase(),
              };
            })
            .sort((a, b) => a.sortText.localeCompare(b.sortText));
          quickPick.items = matching;
          quickPick.title = `📂 ${directory}`;
        } catch (err) {
          console.error("Error reading directory:", directory, err);
          quickPick.items = [];
        }
      };
      let previousValue = quickPick.value;

      quickPick.onDidChangeValue((newValue) => {
        const deleted = newValue.length < previousValue.length;

        if (
          deleted &&
          previousValue.endsWith(path.sep) &&
          !newValue.endsWith(path.sep)
        ) {
          const lastSlash = newValue.lastIndexOf(path.sep);
          if (lastSlash >= 0) {
            quickPick.value = newValue.slice(0, lastSlash + 1);

            setTimeout(() => {
              previousValue = quickPick.value;
              updateItems(quickPick.value);
            }, 0);

            return;
          }
        }

        previousValue = newValue;
        updateItems(newValue);
      });

      quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0];
        if (!selected) {
          const inputPath = quickPick.value;
          await openOrCreateFile(inputPath, quickPick);
          return;
        }

        const selectedPath = selected.detail!;
        if (fs.statSync(selectedPath).isDirectory()) {
          quickPick.value = path.join(selectedPath, path.sep);
          quickPick.activeItems = [];
          updateItems(quickPick.value);
        } else {
          vscode.window.showTextDocument(vscode.Uri.file(selectedPath));
          quickPick.hide();
        }
      });
      quickPick.show();
      quickPick.value = path.join(baseDir, path.sep);
      updateItems(quickPick.value);
    }
  );

  const recentFilesCommand = vscode.commands.registerCommand(
    "elff.recentFiles",
    async () => {
      if (recentFiles.length === 0) {
        vscode.window.showInformationMessage("No recent files recorded.");
        return;
      }

      const picked = await vscode.window.showQuickPick(
        recentFiles.map((path) => {
          return { label: path, path };
        }),
        {
          placeHolder: "Select a recent file to open",
        }
      );

      if (picked) {
        const uri = vscode.Uri.file(picked.path);
        vscode.window.showTextDocument(uri);
      }
    }
  );

  const clearRecentFilesCommand = vscode.commands.registerCommand(
    "elff.clearRecentFiles",
    async () => {
      const confirm = await vscode.window.showWarningMessage(
        "Clear all recent files?",
        { modal: true },
        "Yes"
      );

      if (confirm === "Yes") {
        recentFiles = [];
        await context.globalState.update(STORAGE_KEY, []);
        vscode.window.showInformationMessage("Recent files cleared.");
      }
    }
  );

  context.subscriptions.push(findFileCommand);
  context.subscriptions.push(recentFilesCommand);
  context.subscriptions.push(clearRecentFilesCommand);
}

export function deactivate() {}

function expandHome(inputPath: string): string {
  if (inputPath.startsWith("~")) {
    return path.join(os.homedir(), inputPath.slice(1));
  }
  return inputPath;
}

async function openOrCreateFile(
  filePath: string,
  quickPick: vscode.QuickPick<vscode.QuickPickItem>
) {
  const expandedPath = expandHome(filePath);
  const isDirectory = expandedPath.endsWith(path.sep);

  if (fs.existsSync(expandedPath)) {
    const stat = fs.statSync(expandedPath);
    if (stat.isFile()) {
      vscode.window.showTextDocument(vscode.Uri.file(expandedPath));
    }
  } else {
    if (isDirectory) {
      const createAndOpen = await vscode.window.showInformationMessage(
        `Directory does not exist:\n${filePath}\n\nCreate and open it?`,
        { modal: true },
        "Yes",
        "No"
      );
      if (createAndOpen === "Yes") {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Creating directory: ${filePath}`,
            cancellable: false,
          },
          async (progress) => {
            fs.mkdirSync(expandedPath, { recursive: true });
            await vscode.commands.executeCommand(
              "vscode.openFolder",
              vscode.Uri.file(expandedPath),
              false
            );
            vscode.window.setStatusBarMessage(
              "Directory created successfully ✨",
              3000
            );
          }
        );
      }
    } else {
      const create = await vscode.window.showInformationMessage(
        `File does not exist:\n${filePath}\n\nCreate it?`,
        { modal: true },
        "Yes",
        "No"
      );

      if (create === "Yes") {
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Creating file: ${filePath}`,
            cancellable: false,
          },
          async (progress) => {
            fs.mkdirSync(path.dirname(expandedPath), { recursive: true });
            fs.writeFileSync(expandedPath, "");

            const document = await vscode.workspace.openTextDocument(
              expandedPath
            );
            await vscode.window.showTextDocument(document);

            vscode.window.setStatusBarMessage(
              "File created successfully",
              3000
            );
          }
        );
        quickPick.hide();
      }
    }
  }
}

function getFileIcon(filename: string): vscode.ThemeIcon {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".js":
    case ".ts":
    case ".jsx":
    case ".tsx":
      return new vscode.ThemeIcon("symbol-method");
    case ".json":
      return new vscode.ThemeIcon("bracket");
    case ".html":
    case ".htm":
      return new vscode.ThemeIcon("symbol-customization");
    case ".css":
    case ".scss":
    case ".less":
      return new vscode.ThemeIcon("symbol-color");
    case ".md":
      return new vscode.ThemeIcon("markdown");
    case ".png":
    case ".jpg":
    case ".jpeg":
    case ".gif":
    case ".svg":
      return new vscode.ThemeIcon("symbol-variable");
    default:
      return new vscode.ThemeIcon("file");
  }
}
