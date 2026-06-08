# zen-tablist-navigation

A [Sine](https://github.com/CosmoCreeper/Sine) mod for [Zen Browser](https://github.com/zen-browser/desktop) that adds keyboard shortcuts to move up and down the vertical tab list:

- **Ctrl+Shift+Up** — move up the tab list (previous tab)
- **Ctrl+Shift+Down** — move down the tab list (next tab)

(On macOS these are Cmd+Shift+Up/Down.)

## Install (Sine)

1. In Zen, open **Settings → Sine Mods**.
2. Open Sine's **Settings** and enable **"Enable installing JS from unofficial sources"** (required for JS mods outside the official marketplace).
3. In the **"add your own locally from a GitHub repo"** field, enter:
   ```
   HavocOmega/zen-tablist-navigation
   ```
   and click **Install**.
4. Go to `about:support` and click **Clear startup cache**, then restart.

## Debugging

The script ships with a visual debug toast (bottom-right) and console logs
(prefixed `[zen-tab-nav]`, viewable in the Browser Console — Ctrl+Shift+J):

- **"Script loaded ✔"** — the file loaded.
- **"Shortcuts active ✔"** — the keydown listener attached.
- A blue toast on each keypress naming the tab it moved to.

Set `DEBUG = false` at the top of `zen-tab-updown.uc.js` to silence these.

## Notes

- Shortcuts are handled by a capture-phase `keydown` listener rather than XUL
  `<key>`/`<command>` elements. Dynamically-inserted keysets often fail to
  register in an already-loaded browser.xhtml, and inline `oncommand` handlers
  are blocked by browser.xhtml's CSP (`script-src-attr`). A raw keydown
  listener avoids all of those problems.
- The accel key is Ctrl on Windows/Linux and Cmd on macOS.
- The shortcuts reuse Firefox's built-in `advanceSelectedTab`, so "down" = next
  tab and "up" = previous tab in Zen's vertical order.
- Because the listener is global to the chrome window, the combo also triggers
  while focus is in the URL bar. Open an issue if you'd prefer it to ignore
  text fields.
