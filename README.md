# Elff - Emacs-like find file for VS Code

A VS Code Extension for Emacs-like find file/recent files functionality.

## Features

- File system navigation like in Doom Emacs
  - path-based text input based on the currently open workspace (or ~ if no workspace is open)
  - fuzzy autocomplete of directories & file names
  - quick-deletion of path segments
  - create files, directories and/or open them as a workspace
- Recent files like in Doom Emacs
  - displays the last n files you opened whether as part of a workspace or not
  - fuzzy search through them

## Usage

Elff provides two main commands "Elff: Find File" and "Elff: Recent Files". These can be invoked from either the command palette or by hitting the configured keybinding, see below.

### Find File

_Find file_ uses the currently open workspace (or ~ if there is no workspace) as the initial path. You can go up and down your filesystem by hitting backspace to remove a segment or typing the name of the directory you want to go into/the name of the file you want to open. Autocompletions can be accpeted by hitting Enter. As you might expect, if you type non-existent directories/files you will be prompted to create them.

### Recent Files

_Recent Files_ keeps a list of recently opened files for quick access. Their full path is displayed and can be searched. Files are opened in the current window and do not touch the currently open workspace.

By running "Elff: Clear Recent Files" the list of recent files can be cleared. Note that deleted files are removed automatically and do not require this command.

### A note for Doom Emacs users

Unfortunately, leveraging TAB to invoke autocompletions seems to be quite complicated in VS Code. Thus this extension uses enter to accept autocompletions and relies on a separate button to open directories as workspaces. Maybe this can be improved in the future.

## Keybindings

The two main commands have the following keybindings by default:

```json
{
  "key": "ctrl+shift+e",
  "command": "elff.findFile"
},
{
  "key": "ctrl+shift+r",
  "command": "elff.recentFiles"
},

```

## Configuration

The number of recent files to track at one time can be configured as follows:

```json
"elff.TODO": 50
```
