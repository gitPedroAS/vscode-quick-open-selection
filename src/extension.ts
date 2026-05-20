import * as vscode from 'vscode';

function getSelectedText(): string {
  const editor = vscode.window.activeTextEditor;
  return editor ? editor.document.getText(editor.selection) : '';
}

export function activate(context: vscode.ExtensionContext): void {
  // Opens Quick Open with % prefix + selected text — searches text content across files.
  context.subscriptions.push(
    vscode.commands.registerCommand('quickOpenSelection.searchText', () => {
      const text = getSelectedText();
      if (text) vscode.commands.executeCommand('workbench.action.quickOpen', `% ${text}`);
    })
  );

  // Opens Quick Open with selected text — searches for files by name.
  context.subscriptions.push(
    vscode.commands.registerCommand('quickOpenSelection.searchFile', () => {
      const text = getSelectedText();
      if (text) vscode.commands.executeCommand('workbench.action.quickOpen', text);
    })
  );
}

export function deactivate(): void {}
