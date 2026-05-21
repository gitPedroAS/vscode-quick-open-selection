# Quick Open & Search Enhancements

A VS Code extension that enhances Quick Open with selection-aware search and directory-scoped file picking.

## Commands

All commands are available via `Ctrl+Shift+P` under the **Quick Open** category.

| Command | Description |
|---|---|
| `Quick Open: Search selected text in files (%)` | Opens Quick Open with `%<selection>` — searches file contents across the workspace |
| `Quick Open: Search selected text as filename` | Opens Quick Open with `<selection>` — searches for files by name |
| `Quick Open: Toggle symlink inclusion in search` | Toggles `search.followSymlinks` globally |
| `Quick Open: Search in directory` | Prompts for a subdirectory then opens Ctrl+P pre-filled with that path, filtering results to files under it |

## Search in Directory

Invoke **Quick Open: Search in directory** to open a directory picker:

- Subdirectories appear dynamically as you type a relative path
- Press **→** to autocomplete the highlighted (or first) suggestion and descend into it
- Press **Enter** to confirm — Ctrl+P opens pre-filled with `<chosen>/`
- Press **Escape** to cancel

Ctrl+P naturally filters its results to files whose paths start with the chosen directory. You can continue typing after the prefix to narrow further within that subtree.

## Suggested Keybindings

Add to your `keybindings.json`:

```json
{ "key": "ctrl+alt+f", "command": "qosEnhancements.searchText", "when": "editorTextFocus && editorHasSelection" },
{ "key": "ctrl+alt+p", "command": "qosEnhancements.searchFile", "when": "editorTextFocus && editorHasSelection" }
```

## Notes

- `search.followSymlinks` is a global setting — the toggle affects all workspaces
- The directory picker handles symbolic links and filesystems (e.g. NFS) that report unknown entry types
- If VS Code reports a settings write error, save your open `settings.json` file first

