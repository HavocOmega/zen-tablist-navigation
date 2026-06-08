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

  const isMac = navigator.platform.toLowerCase().includes("mac");
  const accelName = isMac ? "Cmd" : "Ctrl";

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

  // Use a raw keydown listener (capture phase) instead of XUL <key>/<command>
  // elements. Dynamically-inserted keysets often fail to register in an
  // already-loaded browser.xhtml, and inline `oncommand` is blocked by CSP.
  // A capture-phase keydown listener bypasses keyset registration, command
  // lookup, and CSP entirely.
  function onKeyDown(e) {
    const accel = isMac ? e.metaKey : e.ctrlKey;
    const wrongAccel = isMac ? e.ctrlKey : e.metaKey;
    if (!accel || wrongAccel || !e.shiftKey || e.altKey) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      navigate(1, accelName + "+Shift+Down"); // down the list
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      navigate(-1, accelName + "+Shift+Up"); // up the list
    }
  }

  function addKeys() {
    if (window._zenTabNavAttached) return;
    window._zenTabNavAttached = true;
    window.addEventListener("keydown", onKeyDown, true); // capture phase
    console.log("[zen-tab-nav] keydown listener attached");
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
