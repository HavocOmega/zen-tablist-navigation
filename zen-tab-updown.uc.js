// ==UserScript==
// @name           Tab List Navigation
// @description    Configurable keyboard shortcuts to move up/down Zen's vertical tab list
// @include        chrome://browser/content/browser.xhtml
// ==/UserScript==

(function () {
  const PREF_PREFIX = "extensions.zen-tablist-navigation.";
  const DEFAULT_UP = "Ctrl+Shift+ArrowUp";
  const DEFAULT_DOWN = "Ctrl+Shift+ArrowDown";

  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const isMac = navigator.platform.toLowerCase().includes("mac");

  function getStr(name, fallback) {
    try { return Services.prefs.getStringPref(PREF_PREFIX + name, fallback); }
    catch (e) { return fallback; }
  }
  function getBool(name, fallback) {
    try { return Services.prefs.getBoolPref(PREF_PREFIX + name, fallback); }
    catch (e) { return fallback; }
  }
  const debugEnabled = () => getBool("debug", false);

  function showToast(message, bg) {
    if (!debugEnabled()) return;
    try {
      let toast = document.getElementById("zenTabNavToast");
      if (!toast) {
        toast = document.createElementNS(HTML_NS, "div");
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

  const log = (...a) => { if (debugEnabled()) console.log("[zen-tab-nav]", ...a); };

  // Normalize common key aliases so both "Up" and "ArrowUp" work.
  function normalizeKey(k) {
    const map = {
      up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright",
      esc: "escape", space: " ", spacebar: " ",
      pgup: "pageup", pgdn: "pagedown", del: "delete", ins: "insert", return: "enter",
    };
    return map[k] || k;
  }

  // Parse a string like "Ctrl+Shift+ArrowUp" into a modifier/key descriptor.
  function parseBind(str) {
    const bind = { ctrl: false, alt: false, shift: false, meta: false, key: "" };
    for (const raw of String(str).split("+")) {
      const p = raw.trim().toLowerCase();
      if (!p) continue;
      if (p === "ctrl" || p === "control") bind.ctrl = true;
      else if (p === "alt" || p === "option" || p === "opt") bind.alt = true;
      else if (p === "shift") bind.shift = true;
      else if (p === "meta" || p === "cmd" || p === "command" || p === "win" || p === "super") bind.meta = true;
      else if (p === "accel") { if (isMac) bind.meta = true; else bind.ctrl = true; }
      else bind.key = normalizeKey(p);
    }
    return bind;
  }

  function bindToString(bind) {
    const parts = [];
    if (bind.ctrl) parts.push("Ctrl");
    if (bind.alt) parts.push("Alt");
    if (bind.shift) parts.push("Shift");
    if (bind.meta) parts.push(isMac ? "Cmd" : "Meta");
    if (bind.key) parts.push(bind.key);
    return parts.join("+");
  }

  // Exact modifier match avoids accidental triggers (e.g. extra Alt held).
  function eventMatches(e, bind) {
    if (!bind.key) return false;
    return e.ctrlKey === bind.ctrl &&
           e.altKey === bind.alt &&
           e.shiftKey === bind.shift &&
           e.metaKey === bind.meta &&
           e.key.toLowerCase() === bind.key;
  }

  let upBind = parseBind(DEFAULT_UP);
  let downBind = parseBind(DEFAULT_DOWN);

  function reloadBinds() {
    upBind = parseBind(getStr("move-up", DEFAULT_UP));
    downBind = parseBind(getStr("move-down", DEFAULT_DOWN));
    log("binds -> up:", bindToString(upBind), "| down:", bindToString(downBind));
  }

  function navigate(dir, label) {
    try {
      const before = gBrowser.selectedTab;
      gBrowser.tabContainer.advanceSelectedTab(dir, true);
      const after = gBrowser.selectedTab;
      const moved = before !== after;
      const title = (after.label || "tab").slice(0, 30);
      log(`${label} fired -> moved=${moved} -> ${title}`);
      showToast(`${label} ${moved ? "\u2192 " + title : "(no move)"}`, "rgba(0,90,160,0.95)");
    } catch (e) {
      console.error("[zen-tab-nav] command error", e);
    }
  }

  function onKeyDown(e) {
    if (eventMatches(e, downBind)) {
      e.preventDefault();
      e.stopPropagation();
      navigate(1, bindToString(downBind)); // down the list
    } else if (eventMatches(e, upBind)) {
      e.preventDefault();
      e.stopPropagation();
      navigate(-1, bindToString(upBind)); // up the list
    }
  }

  // Live-reload binds when the user edits them in Sine's settings.
  const prefObserver = {
    observe(subject, topic) {
      if (topic === "nsPref:changed") {
        reloadBinds();
        showToast("Shortcuts updated \u2714", "rgba(20,120,40,0.95)");
      }
    },
  };

  function attach() {
    if (window._zenTabNavAttached) return;
    window._zenTabNavAttached = true;

    reloadBinds();
    window.addEventListener("keydown", onKeyDown, true); // capture phase
    Services.prefs.addObserver(PREF_PREFIX, prefObserver);
    window.addEventListener("unload", () => {
      try { Services.prefs.removeObserver(PREF_PREFIX, prefObserver); } catch (e) {}
    }, { once: true });

    console.log("[zen-tab-nav] active (up:", bindToString(upBind), "down:", bindToString(downBind) + ")");
    showToast("Shortcuts active \u2714", "rgba(20,120,40,0.95)");
  }

  console.log("[zen-tab-nav] script evaluated");

  // Run as soon as gBrowser is ready.
  let tries = 0;
  function init() {
    if (typeof gBrowser === "undefined" || !gBrowser.tabContainer) {
      if (tries++ < 50) setTimeout(init, 200);
      else console.error("[zen-tab-nav] gBrowser never became ready");
      return;
    }
    attach();
  }
  init();
})();
