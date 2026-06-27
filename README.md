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

You can set each binding **two ways**:

1. **Type it** using `+` to combine modifiers with a key, for example:
   - `Ctrl+Shift+ArrowUp`
   - `Alt+K`
   - `Accel+PageDown`
2. **Record it** — enable **"Record Move Up keybind"** (or Down), then focus
   the browser window and press the combination you want. It's written into the
   text field automatically. Press **Esc** (or wait 10 seconds) to cancel.

   > Sine has no built-in shortcut-capture widget, so recording happens in the
   > browser window: after enabling the checkbox, click the browser window and
   > press your combo.

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

## Behavior options

In the mod's settings under **Behavior**:

- **Skip unloaded pinned tabs** (off by default) — when navigating, skip over
  pinned tabs that haven't been loaded yet (discarded or never-opened) and land
  on the next loaded tab instead.
- **Pause media when leaving a tab** (off by default) — when you navigate away
  from a tab that's playing audio/video, it's paused; when you navigate back,
  it resumes. Only media that *this mod* paused is auto-resumed, so a tab you
  paused yourself stays paused.

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
