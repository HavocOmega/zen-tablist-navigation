// ==UserScript==
// @name           Alt+Shift+Up/Down Tab Navigation
// @description    Alt+Shift+Up moves up the vertical tab list, Alt+Shift+Down moves down (with visual debug)
// @include        chrome://browser/content/browser.xhtml
// ==/UserScript==

(function () {
  const DEBUG = true; // set to false to silence the on-screen toast + console logs

  function showToast(message) {
    if (!DEBUG) return;
    let toast = document.getElementById("zenTabNavToast");
    if (!toast) {
      toast = document.createElement("div"); // HTML div (browser.xhtml is XHTML)
      toast.id = "zenTabNavToast";
      toast.style.cssText = [
        "position: fixed",
        "bottom: 20px",
        "right: 20px",
        "z-index: 2147483647",
        "padding: 10px 16px",
        "border-radius: 10px",
        "background: rgba(20,20,20,0.9)",
        "color: #fff",
        "font: 13px/1.4 system-ui, sans-serif",
        "pointer-events: none",
        "opacity: 0",
        "transition: opacity 0.15s ease",
        "box-shadow: 0 4px 16px rgba(0,0,0,0.4)",
      ].join(";");
      document.documentElement.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = "1";
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => (toast.style.opacity = "0"), 800);
  }

  // Exposed so the <key> elements can call it via oncommand.
  window.zenTabNav = function (dir, label) {
    const before = gBrowser.selectedTab;
    gBrowser.tabContainer.advanceSelectedTab(dir, true);
    const after = gBrowser.selectedTab;
    const moved = before !== after;
    const title = (after.label || "tab").slice(0, 30);
    console.log(`[zen-tab-nav] ${label} fired → moved=${moved} → ${title}`);
    showToast(`${label} ${moved ? "→ " + title : "(no move)"}`);
  };

  function addKeys() {
    if (document.getElementById("zenTabNavKeyset")) return;

    const keyset = document.createXULElement("keyset");
    keyset.id = "zenTabNavKeyset";

    const make = (id, keycode, dir, label) => {
      const k = document.createXULElement("key");
      k.id = id;
      k.setAttribute("keycode", keycode);
      k.setAttribute("modifiers", "alt shift"); // Alt+Shift (Option+Shift on macOS)
      k.setAttribute("oncommand", `zenTabNav(${dir}, "${label}")`);
      keyset.appendChild(k);
    };

    make("zenKeyTabDown", "VK_DOWN", 1, "Alt+Shift+Down"); // down the list
    make("zenKeyTabUp",   "VK_UP",  -1, "Alt+Shift+Up");   // up the list

    document.documentElement.appendChild(keyset);
    console.log("[zen-tab-nav] keyset attached");
    showToast("Tab nav shortcuts loaded ✔");
  }

  window.addEventListener("ZenKeyboardShortcutsReady", addKeys, { once: true });
})();
