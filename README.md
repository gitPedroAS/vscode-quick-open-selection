# Quick Open Selection

Enhances VS Code Quick Open with selection-aware search and workspace scoping tools.

## Commands

| Command | Description |
|---|---|
| `Quick Open: Search selected text in files (%)` | Opens Quick Open with `%<selection>` — searches text content across files |
| `Quick Open: Search selected text as filename` | Opens Quick Open with `<selection>` — searches for files by name |
| `Quick Open: Toggle symlink inclusion in search` | Toggles `search.followSymlinks` globally — affects all search including `%` and Ctrl+P |
| `Quick Open: Set search root` | Prompts for a subdirectory (with live autocomplete), narrows `files.exclude` to that subtree, then opens Ctrl+P |
| `Quick Open: Reset search root` | Restores `files.exclude` to the state before "Set search root" was called |

## Directory Picker

When using **Set search root**, a picker opens where you can type a relative path:
- Subdirectories appear dynamically as you type
- Press **→** to autocomplete the highlighted (or first) suggestion and descend into it
- Press **Enter** to confirm the selected directory
- Press **Escape** to cancel

## Suggested Keybindings

Add to your `keybindings.json`:

```json
{ "key": "ctrl+alt+f", "command": "quickOpenSelection.searchText", "when": "editorTextFocus && editorHasSelection" },
{ "key": "ctrl+alt+p", "command": "quickOpenSelection.searchFile", "when": "editorTextFocus && editorHasSelection" }
```

## Notes

- `search.followSymlinks` is a global setting — the toggle affects all workspaces
- `files.exclude` changes from **Set search root** are scoped to the current workspace and are fully reversed by **Reset search root**
- If VS Code reports a settings write error, save your open `settings.json` file first
