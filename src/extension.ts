import * as vscode from 'vscode';
import * as nodePath from 'path';
import { promises as nodeFs } from 'fs';

const SEARCH_ROOT_STATE_KEY = 'savedFilesExclude';

function getSelectedText(): string {
  const editor = vscode.window.activeTextEditor;
  return editor ? editor.document.getText(editor.selection) : '';
}

// Returns subdirectory names inside `parentAbsPath` that start with `prefix`.
async function matchingSubdirs(parentAbsPath: string, prefix: string): Promise<string[]> {
  try {
    const entries = await nodeFs.readdir(parentAbsPath, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && e.name.startsWith(prefix))
      .map(e => e.name);
  } catch {
    return [];
  }
}

// Shows a QuickPick that lets the user navigate/autocomplete subdirectories.
// Returns the chosen relative path (e.g. "src/components") or undefined if cancelled.
async function pickDirectory(workspaceRoot: string): Promise<string | undefined> {
  return new Promise(resolve => {
    const qp = vscode.window.createQuickPick();
    qp.placeholder = 'Type a relative directory path (e.g. src/components)';
    qp.title = 'Quick Open: Set search root';

    let lastInput = '';

    const refresh = async (input: string) => {
      lastInput = input;
      const slashIdx = input.lastIndexOf('/');
      const parentRel = slashIdx >= 0 ? input.slice(0, slashIdx) : '';
      const prefix    = slashIdx >= 0 ? input.slice(slashIdx + 1) : input;
      const parentAbs = nodePath.join(workspaceRoot, parentRel);

      const names = await matchingSubdirs(parentAbs, prefix);
      if (input !== lastInput) return; // stale, discard

      qp.items = names.map(name => {
        const rel = parentRel ? `${parentRel}/${name}` : name;
        return { label: rel, description: nodePath.join(workspaceRoot, rel) };
      });
    };

    qp.onDidChangeValue(refresh);
    refresh('');

    qp.onDidAccept(() => {
      const selected = qp.selectedItems[0]?.label ?? qp.value.trim();
      qp.hide();
      resolve(selected || undefined);
    });

    qp.onDidHide(() => {
      qp.dispose();
      resolve(undefined);
    });

    qp.show();
  });
}

// Computes files.exclude patterns to show only files under `targetRelPath`.
// At each level of the path, excludes sibling directories.
async function buildExcludePatterns(workspaceRoot: string, targetRelPath: string): Promise<Record<string, boolean>> {
  const parts = targetRelPath.split('/').filter(Boolean);
  const excludes: Record<string, boolean> = {};
  let currentAbs = workspaceRoot;

  for (let i = 0; i < parts.length; i++) {
    let entries: import('fs').Dirent[];
    try {
      entries = await nodeFs.readdir(currentAbs, { withFileTypes: true });
    } catch {
      break;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== parts[i]) {
        const relPrefix = parts.slice(0, i).join('/');
        const pattern = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        excludes[`${pattern}/**`] = true;
      }
    }
    currentAbs = nodePath.join(currentAbs, parts[i]);
  }

  return excludes;
}

export function activate(context: vscode.ExtensionContext): void {
  // Opens Quick Open with % prefix + selected text - searches text content across files.
  context.subscriptions.push(
    vscode.commands.registerCommand('quickOpenSelection.searchText', () => {
      const text = getSelectedText();
      if (text) vscode.commands.executeCommand('workbench.action.quickOpen', `%${text}`);
    })
  );

  // Opens Quick Open with selected text - searches for files by name.
  context.subscriptions.push(
    vscode.commands.registerCommand('quickOpenSelection.searchFile', () => {
      const text = getSelectedText();
      if (text) vscode.commands.executeCommand('workbench.action.quickOpen', text);
    })
  );

  // Toggles search.followSymlinks - affects all search operations including % and Ctrl+P.
  context.subscriptions.push(
    vscode.commands.registerCommand('quickOpenSelection.toggleSymlinks', async () => {
      const config = vscode.workspace.getConfiguration('search');
      const current = config.get<boolean>('followSymlinks', true);
      await config.update('followSymlinks', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`ℹ️ Quick Open: Symbolic link search ${!current ? 'enabled' : 'disabled'}`);
    })
  );

  // Prompts for a subdirectory, narrows files.exclude to that scope, then opens Ctrl+P.
  context.subscriptions.push(
    vscode.commands.registerCommand('quickOpenSelection.setSearchRoot', async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders?.length) {
        vscode.window.showWarningMessage('No workspace folder open.');
        return;
      }
      const workspaceRoot = folders[0].uri.fsPath;
      const chosen = await pickDirectory(workspaceRoot);
      if (!chosen) return;

      const filesConfig = vscode.workspace.getConfiguration('files');
      const current = filesConfig.get<Record<string, boolean>>('exclude') ?? {};

      // Save original state so reset can restore it.
      await context.globalState.update(SEARCH_ROOT_STATE_KEY, current);

      const added = await buildExcludePatterns(workspaceRoot, chosen);
      await filesConfig.update('exclude', { ...current, ...added }, vscode.ConfigurationTarget.Workspace);

      vscode.window.showInformationMessage(`ℹ️ Quick Open: Search root narrowed to ${chosen}`);
      vscode.commands.executeCommand('workbench.action.quickOpen');
    })
  );

  // Restores files.exclude to the state before setSearchRoot was called.
  context.subscriptions.push(
    vscode.commands.registerCommand('quickOpenSelection.resetSearchRoot', async () => {
      const saved = context.globalState.get<Record<string, boolean>>(SEARCH_ROOT_STATE_KEY);
      if (saved === undefined) {
        vscode.window.showInformationMessage('ℹ️ Quick Open: No saved search root to reset.');
        return;
      }
      const filesConfig = vscode.workspace.getConfiguration('files');
      await filesConfig.update('exclude', saved, vscode.ConfigurationTarget.Workspace);
      await context.globalState.update(SEARCH_ROOT_STATE_KEY, undefined);
      vscode.window.showInformationMessage('ℹ️ Quick Open: Search root reset to workspace.');
    })
  );
}

export function deactivate(): void {}

