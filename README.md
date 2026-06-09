# zen-tablist-navigation

A [Sine](https://github.com/CosmoCreeper/Sine) mod for [Zen Browser](https://github.com/zen-browser/desktop) that adds **configurable** keyboard shortcuts to move up and down the vertical tab list.

Defaults:

- **Ctrl+Shift+ArrowUp** — move up the tab list (previous tab)
- **Ctrl+Shift+ArrowDown** — move down the tab list (next tab)

## Install (Sine)

1. In Zen, open **Settings → Sine Mods**.
2. Open Sine's **Settings** and enable **"Enable installing JS from unofficial sources"** (required for JS mods outside the official marketplace).
3. In the **"add your own locally from a GitHub repo"** field, enter:
   ```
   HavocOmega/zen-tablist-navigation
   ```
   and click **Install**.
4. Go to `about:support` and click **Clear startup cache**, then restart.

## Customizing the shortcuts

Open **Settings → Sine Mods**, find **Tab List Navigation**, and click the
**gear (⚙) icon** to open its settings. You'll see two text fields:

- **Move up the tab list**
- **Move down the tab list**

Type a keybind using `+` to combine modifiers with a key, for example:

- `Ctrl+Shift+ArrowUp`
- `Alt+K`
- `Accel+PageDown`

### Supported modifiers

| Modifier | Aliases |
| --- | --- |
| Control | `Ctrl`, `Control` |
| Alt | `Alt`, `Option`, `Opt` |
| Shift | `Shift` |
| Meta | `Meta`, `Cmd`, `Command`, `Win`, `Super` |
| Accel | `Accel` (Ctrl on Windows/Linux, Cmd on macOS) |

### Keys

Use any single key (`A`–`Z`, `0`–`9`, `,`, `.`, etc.), function keys (`F1`–`F12`),
or named keys. Arrow keys accept either form: `ArrowUp`/`Up`, `ArrowDown`/`Down`.
Other aliases: `PgUp`/`PageUp`, `PgDn`/`PageDown`, `Esc`/`Escape`, `Del`/`Delete`.

Changes apply **immediately** — no restart needed — thanks to a live pref observer.

## Debugging

In the mod's settings, toggle **"Show debug toast on keypress"** (off by default).
When on, you'll get an on-screen toast plus console logs (prefixed
`[zen-tab-nav]`, viewable in the Browser Console — Ctrl+Shift+J):

- **"Shortcuts active ✔"** — the keydown listener attached.
- **"Shortcuts updated ✔"** — a keybind was changed in settings.
- A blue toast on each keypress naming the tab it moved to.

## Notes

- Shortcuts are handled by a capture-phase `keydown` listener rather than XUL
  `<key>`/`<command>` elements, which avoids keyset-registration and CSP issues
  in an already-loaded browser.xhtml.
- Modifier matching is exact, so e.g. `Ctrl+Shift+ArrowUp` will not fire if Alt
  is also held.
- The shortcuts reuse Firefox's built-in `advanceSelectedTab`, so "down" = next
  tab and "up" = previous tab in Zen's vertical order.
- This is a free-text field with no live conflict detection. If you choose a
  combo Zen already uses, behavior may be unpredictable — pick another binding.
- Because the listener is global to the chrome window, shortcuts also fire while
  focus is in the URL bar.
