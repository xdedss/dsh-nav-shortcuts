# dsh-nav-shortcuts

Keyboard shortcuts for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH):
step through sessions in the order the sidebar shows them, and put focus back
into the message input.

| Action | Windows / Linux | macOS |
|---|---|---|
| Next session | `Ctrl+Alt+Down` | `Cmd+Alt+Down` |
| Previous session | `Ctrl+Alt+Up` | `Cmd+Alt+Up` |
| Focus the message input | `Ctrl+Alt+I` | `Cmd+Alt+I` |

The desktop client uses the same defaults. All three appear in DSH's built-in
shortcut reference (`Ctrl+/`, “Keyboard shortcuts”), where they can be rebound,
cleared or restored like any built-in command. Search terms include
`next session` / `下一个会话`, `previous session` / `上一个会话`, and
`focus composer` / `聚焦输入框`.

## Behaviour

- **Next / Previous session** walks the left sidebar's *displayed* order: the
  rows actually on screen, in document order, so Workspace grouping and nesting,
  manual row order and the archive filter all match what you see. Rows the
  sidebar does not render — collapsed Workspaces, rows beyond a Workspace's
  “Show more” watermark, subagent Sessions — are skipped. It wraps at both ends;
  when the current Session is itself not on screen (inside a collapsed group),
  “next” starts at the first shown row and “previous” at the last. If no tree is
  rendered at all (collapsed rail, or the sidebar replaced by search results) it
  falls back to catalog order. Switching goes through the same
  `uiWorkspace.openSession()` path a sidebar click uses, so the main view and
  the right panel behave exactly as they do for a click.
- **Focus message input** focuses the composer's contenteditable host for the
  current Session (Lexical's own focus, so the draft caret is restored), and
  scrolls it into view first when needed.

## Requirements

- DSH with the Web UI and the `@deepseek-ai/dsh-client-shortcuts` service
  (the `Ctrl+/` reference and this plugin's registration API). Verified against
  DSH `0.2.2-rc.1` in the browser and `0.2.2-rc.2` in the desktop client.

## Install

### DSH Desktop

Open **Plugins → Add plugin** and select this directory. The Host installs it
into the `desktop` profile and mounts the browser half; reload the window
(`Ctrl+R`) afterwards.

### DSH Web

```powershell
dsh plugin --profile web add link:<absolute path to this directory>
```

`link:` keeps the source directory live: edits to `lib/client.js` take effect on
a browser refresh. Do not move or rename the directory afterwards — re-run the
command if you do. Use `file:` instead for a copied install.

The Host half (`lib/index.js`) is inert; the browser half is loaded through the
`dsh.client` declaration in `package.json`.

## Uninstall

- Desktop: **Plugins** → remove `dsh-nav-shortcuts`.
- Web: `dsh plugin --profile web remove dsh-nav-shortcuts`

## Development

```bash
npm test        # node --test, Node 20+
```

The tests load the real browser bundle with a stubbed `window.__ModuleLoader__`
and stubbed DSH services, so they need neither an installed DSH nor a browser.

| Path | Role |
|---|---|
| `lib/index.js` | Host Loader entry (registers nothing) |
| `lib/client.js` | Browser bundle: `window.__ModuleLoader__.load({ id, factory })` |
| `cordis.patch.yml` | Bundle patch that mounts the plugin row |
| `test/client.test.mjs` | Behaviour tests for ordering, wrapping, fallback and focus |

## Compatibility and limitations

- The plugin relies on DSH internals that are stable across the 0.2.2 line:
  `ctx.shortcuts.register`, `ctx.get('sessions')`,
  `ctx.get('uiWorkspace').openSession`, `ctx.get('uiSession').adapter.current`,
  the composer's `[data-composer-input]` element, and the sidebar row key
  `[data-row-key^="session:"]`. If the row key changes, session stepping falls
  back to catalog order instead of failing.
- The Linux desktop runtime reserves the arrow codes, so next/previous have no
  default there. Record a binding from `Ctrl+/` if you want them.
- `Ctrl+Alt+Arrow` is also an Intel graphics rotation hotkey on some older
  drivers. If the browser never sees the key, rebind it in `Ctrl+/`.

## License

MIT — see [LICENSE](LICENSE).
