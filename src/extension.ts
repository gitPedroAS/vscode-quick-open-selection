import * as vscode from 'vscode';

function getSelectedText(): string {
  const editor = vscode.window.activeTextEditor;
  return editor ? editor.document.getText(editor.selection) : '';
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
      vscode.window.showInformationMessage(`Quick Open: Symbolic link search ${!current ? 'enabled' : 'disabled'}`);
    })
  );
}

export function deactivate(): void {}
