# Quick Open Selection

Opens VS Code Quick Open pre-filled with the current text selection.

## Commands

| Command | Description |
|---|---|
| `quickOpenSelection.searchText` | Opens Quick Open with `% <selection>` — searches text content across files |
| `quickOpenSelection.searchFile` | Opens Quick Open with `<selection>` — searches for files by name |

## Suggested Keybindings

Add to your `keybindings.json`:

```json
{ "key": "ctrl+alt+f", "command": "quickOpenSelection.searchText", "when": "editorTextFocus && editorHasSelection" },
{ "key": "ctrl+alt+p", "command": "quickOpenSelection.searchFile", "when": "editorTextFocus && editorHasSelection" }
```
