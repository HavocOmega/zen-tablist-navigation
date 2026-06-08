// ==UserScript==
// @name           Ctrl+Shift+Up/Down Tab Navigation
// @description    Ctrl+Shift+Up moves up the vertical tab list, Ctrl+Shift+Down moves down (with visual debug)
// @include        chrome://browser/content/browser.xhtml
// ==/UserScript==

(function () {
  const DEBUG = true; // set to false to silence toast + console logs

  // browser.xhtml is a XUL document, so its default namespace is XUL.
  // HTML elements MUST be created in the XHTML namespace or they won't render.
  const HTML_NS = "http://www.w3.org/1999/xhtml";

  function showToast(message, bg) {
    if (!DEBUG) return;
    try {
      let toast = document.getElementById("zenTabNavToast");
      if (!toast) {
        toast = document.createElementNS(HTML_NS, "div"); // HTML div, not XUL
        toast.id = "zenTabNavToast";
        toast.style.cssText = [
          "position: fixed", "bottom: 20px", "right: 20px",
          "z-index: 2147483647", "padding: 10px 16px", "border-radius: 10px",
          "color: #fff", "font: 13px/1.4 system-ui, sans-serif",
          "pointer-events: none", "opacity: 0",
          "transition: opacity 0.15s ease",
          "box-shadow: 0 4px 16px rgba(0,0,0,0.4)",
        ].join(";");
        (document.body || document.documentElement).appendChild(toast);
      }
      toast.style.background = bg || "rgba(20,20,20,0.9)";
      toast.textContent = message;
      toast.style.opacity = "1";
      clearTimeout(toast._hideTimer);
      toast._hideTimer = setTimeout(() => (toast.style.opacity = "0"), 1200);
    } catch (e) {
      console.error("[zen-tab-nav] toast error", e);
    }
  }

  // (A) Runs the instant the file is evaluated.
  //     If you DON'T see this, the file itself isn't loading (install / cache issue).
  console.log("[zen-tab-nav] script evaluated");
  showToast("Script loaded \u2714");

  function navigate(dir, label) {
    try {
      const before = gBrowser.selectedTab;
      gBrowser.tabContainer.advanceSelectedTab(dir, true);
      const after = gBrowser.selectedTab;
      const moved = before !== after;
      const title = (after.label || "tab").slice(0, 30);
      console.log(`[zen-tab-nav] ${label} fired -> moved=${moved} -> ${title}`);
      showToast(`${label} ${moved ? "\u2192 " + title : "(no move)"}`, "rgba(0,90,160,0.95)");
    } catch (e) {
      console.error("[zen-tab-nav] command error", e);
    }
  }

  function addKeys() {
    if (document.getElementById("zenTabNavKeyset")) return;

    // Use a <commandset> with a listener added via addEventListener instead of
    // inline `oncommand` attributes. browser.xhtml's CSP (script-src-attr)
    // blocks inline event handlers, so the inline approach silently fails.
    const commandSet = document.createXULElement("commandset");
    commandSet.id = "zenTabNavCommandSet";

    const makeCommand = (id) => {
      const cmd = document.createXULElement("command");
      cmd.id = id;
      commandSet.appendChild(cmd);
    };
    makeCommand("zenCmdTabDown");
    makeCommand("zenCmdTabUp");

    commandSet.addEventListener("command", (e) => {
      if (e.target.id === "zenCmdTabDown") navigate(1, "Ctrl+Shift+Down");
      else if (e.target.id === "zenCmdTabUp") navigate(-1, "Ctrl+Shift+Up");
    });
    document.documentElement.appendChild(commandSet);

    const keyset = document.createXULElement("keyset");
    keyset.id = "zenTabNavKeyset";

    const make = (id, keycode, command) => {
      const k = document.createXULElement("key");
      k.id = id;
      k.setAttribute("keycode", keycode);
      k.setAttribute("modifiers", "accel shift"); // Ctrl+Shift (Cmd+Shift on macOS)
      k.setAttribute("command", command); // id reference, not inline script -> CSP-safe
      keyset.appendChild(k);
    };

    make("zenKeyTabDown", "VK_DOWN", "zenCmdTabDown"); // down the list
    make("zenKeyTabUp", "VK_UP", "zenCmdTabUp");       // up the list

    document.documentElement.appendChild(keyset);

    // Re-insert so Firefox's global key listener registers the dynamically-added keys.
    keyset.remove();
    document.documentElement.appendChild(keyset);

    console.log("[zen-tab-nav] keyset attached");
    showToast("Shortcuts active \u2714", "rgba(20,120,40,0.95)");
  }

  // (B) Robust init: run as soon as gBrowser is ready. Don't rely on a one-shot
  //     event (ZenKeyboardShortcutsReady) that may have already fired before
  //     Sine injected this script.
  let tries = 0;
  function init() {
    if (typeof gBrowser === "undefined" || !gBrowser.tabContainer) {
      if (tries++ < 50) {
        setTimeout(init, 200);
      } else {
        console.error("[zen-tab-nav] gBrowser never became ready");
      }
      return;
    }
    addKeys();
  }
  init();
})();
