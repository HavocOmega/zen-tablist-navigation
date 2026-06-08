# zen-tablist-navigation

A [Sine](https://github.com/CosmoCreeper/Sine) mod for [Zen Browser](https://github.com/zen-browser/desktop) that adds keyboard shortcuts to move up and down the vertical tab list:

- **Alt+Shift+Up** — move up the tab list (previous tab)
- **Alt+Shift+Down** — move down the tab list (next tab)

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
- **"Shortcuts active ✔"** — the keyset attached.
- A blue toast on each keypress naming the tab it moved to.

Set `DEBUG = false` at the top of `zen-tab-updown.uc.js` to silence these.

## Notes

- `modifiers` is `alt shift` — Alt+Shift on Windows/Linux, Option+Shift on macOS.
- The shortcuts reuse Firefox's built-in `advanceSelectedTab`, so "down" = next
  tab and "up" = previous tab in Zen's vertical order.
