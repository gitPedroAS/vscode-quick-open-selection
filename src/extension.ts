import * as vscode from 'vscode';
import * as nodePath from 'path';
import { promises as nodeFs } from 'fs';

// Shared ref to the currently open dir picker so the right-arrow command can access it.
let currentDirPicker: vscode.QuickPick<vscode.QuickPickItem> | undefined;

function getSelectedText(): string {
  const editor = vscode.window.activeTextEditor;
  return editor ? editor.document.getText(editor.selection) : '';
}

// Returns true if the entry is a directory (or symlink/DT_UNKNOWN entry pointing to one).
// Falls back to stat() for symlinks and NFS mounts where dirent type is DT_UNKNOWN
// (isDirectory/isFile/isSymbolicLink all return false on those filesystems).
async function isDirEntry(parentAbsPath: string, entry: import('fs').Dirent): Promise<boolean> {
  if (entry.isDirectory()) return true;
  if (entry.isFile()) return false;
  try {
    const s = await nodeFs.stat(nodePath.join(parentAbsPath, entry.name));
    return s.isDirectory();
  } catch {
    return false; // broken symlink or inaccessible
  }
}

// Returns subdirectory names inside `parentAbsPath` that start with `prefix`.
async function matchingSubdirs(parentAbsPath: string, prefix: string): Promise<string[]> {
  try {
    const entries = await nodeFs.readdir(parentAbsPath, { withFileTypes: true });
    const results = await Promise.all(
      entries
        .filter(e => e.name.startsWith(prefix))
        .map(async e => (await isDirEntry(parentAbsPath, e)) ? e.name : null)
    );
    return results.filter((n): n is string => n !== null);
  } catch {
    return [];
  }
}

// Shows a QuickPick for navigating/autocompleting subdirectories.
// Right arrow autofills the active (or first) suggestion and descends into it.
// Returns the chosen relative path (e.g. "src/components") or undefined if cancelled.
async function pickDirectory(workspaceRoot: string): Promise<string | undefined> {
  return new Promise(resolve => {
    const qp = vscode.window.createQuickPick();
    qp.placeholder = 'Type a relative directory path — press → to autocomplete';
    qp.title = 'Quick Open: Search in directory';

    // Guard against double-resolve: onDidAccept calls qp.hide() which fires onDidHide.
    let settled = false;
    const settle = (val: string | undefined) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    // Guard against async callbacks updating a disposed picker.
    let disposed = false;

    currentDirPicker = qp;
    vscode.commands.executeCommand('setContext', 'quickOpenSE.dirPickerOpen', true);

    let lastInput = '';
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const doRefresh = async (input: string) => {
      if (disposed) return;
      qp.busy = true;

      const slashIdx = input.lastIndexOf('/');
      const parentRel = slashIdx >= 0 ? input.slice(0, slashIdx) : '';
      const prefix    = slashIdx >= 0 ? input.slice(slashIdx + 1) : input;
      const parentAbs = nodePath.join(workspaceRoot, parentRel);

      const names = await matchingSubdirs(parentAbs, prefix);
      if (disposed || input !== lastInput) return; // stale or dismissed

      qp.items = names.map(name => {
        const rel = parentRel ? `${parentRel}/${name}` : name;
        return { label: rel, description: nodePath.join(workspaceRoot, rel) };
      });
      qp.busy = false;
    };

    // Debounced refresh — avoids hammering the filesystem on every keystroke (especially on NFS).
    const refresh = (input: string) => {
      lastInput = input;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => doRefresh(input), 150);
    };

    qp.onDidChangeValue(refresh);
    refresh('');

    qp.onDidAccept(() => {
      const selected = qp.selectedItems[0]?.label ?? qp.value.trim().replace(/\/$/, '');
      settle(selected || undefined); // settle before hide to win the race with onDidHide
      qp.hide();
    });

    qp.onDidHide(() => {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      // Only clear shared state if this is still the active picker (guards against re-entry).
      if (currentDirPicker === qp) {
        currentDirPicker = undefined;
        vscode.commands.executeCommand('setContext', 'quickOpenSE.dirPickerOpen', false);
      }
      qp.dispose();
      settle(undefined);
    });

    qp.show();
  });
}

export function activate(context: vscode.ExtensionContext): void {
  // One-time cleanup of globalState left by the old set/reset search root feature.
  context.globalState.update('savedFilesExclude', undefined);
  context.globalState.update('savedIncludeHistory', undefined);

  // Opens Quick Open with % prefix + selected text — searches text content across files.
  context.subscriptions.push(
    vscode.commands.registerCommand('quickOpenSE.searchText', () => {
      const text = getSelectedText();
      if (text) vscode.commands.executeCommand('workbench.action.quickOpen', `%${text}`);
    })
  );

  // Opens Quick Open with selected text — searches for files by name.
  context.subscriptions.push(
    vscode.commands.registerCommand('quickOpenSE.searchFile', () => {
      const text = getSelectedText();
      if (text) vscode.commands.executeCommand('workbench.action.quickOpen', text);
    })
  );

  // Toggles search.followSymlinks — affects all search operations including % and Ctrl+P.
  context.subscriptions.push(
    vscode.commands.registerCommand('quickOpenSE.toggleSymlinks', async () => {
      const config = vscode.workspace.getConfiguration('search');
      const current = config.get<boolean>('followSymlinks', true);
      try {
        await config.update('followSymlinks', !current, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Quick Open: Symbolic link search ${!current ? 'enabled' : 'disabled'}`);
      } catch {
        vscode.window.showWarningMessage('Quick Open: Please save your settings file before toggling symlink search.');
      }
    })
  );

  // Prompts for a subdirectory then opens Ctrl+P pre-filled with that path.
  // Ctrl+P naturally filters results to files whose paths start with the chosen directory.
  context.subscriptions.push(
    vscode.commands.registerCommand('quickOpenSE.searchInDirectory', async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders?.length) {
        vscode.window.showWarningMessage('Quick Open: No workspace folder open.');
        return;
      }
      const workspaceRoot = folders[0].uri.fsPath;
      const chosen = await pickDirectory(workspaceRoot);
      if (!chosen) return;
      vscode.commands.executeCommand('workbench.action.quickOpen', `${chosen}/`);
    })
  );

  // Autofills the active (or first) dir suggestion when right arrow is pressed in our picker.
  // Triggered via keybinding scoped to quickOpenSE.dirPickerOpen context.
  context.subscriptions.push(
    vscode.commands.registerCommand('quickOpenSE.dirPickerRight', () => {
      if (!currentDirPicker) return;
      const target = currentDirPicker.activeItems[0] ?? currentDirPicker.items[0];
      if (target) {
        currentDirPicker.value = target.label + '/';
      }
    })
  );
}

export function deactivate(): void {}