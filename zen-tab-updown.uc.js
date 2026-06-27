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

  // ---- Pref helpers (every access is guarded; prefs may not exist yet) ----
  function getStr(name, fallback) {
    try { return Services.prefs.getStringPref(PREF_PREFIX + name, fallback); }
    catch (e) { console.error("[zen-tab-nav] getStr", name, e); return fallback; }
  }
  function getBool(name, fallback) {
    try { return Services.prefs.getBoolPref(PREF_PREFIX + name, fallback); }
    catch (e) { console.error("[zen-tab-nav] getBool", name, e); return fallback; }
  }
  function setStr(name, value) {
    try { Services.prefs.setStringPref(PREF_PREFIX + name, value); }
    catch (e) { console.error("[zen-tab-nav] setStr", name, e); }
  }
  function setBool(name, value) {
    try { Services.prefs.setBoolPref(PREF_PREFIX + name, value); }
    catch (e) { console.error("[zen-tab-nav] setBool", name, e); }
  }

  // ---- Keybind parsing / formatting ----

  // Normalize common key aliases so both "Up" and "ArrowUp" work.
  function normalizeKey(k) {
    const map = {
      up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright",
      esc: "escape", space: " ", spacebar: " ",
      pgup: "pageup", pgdn: "pagedown", del: "delete", ins: "insert", return: "enter",
    };
    return map[k] || k;
  }

  // Map a normalized key back to a friendly display name.
  function prettyKey(k) {
    const named = {
      arrowup: "ArrowUp", arrowdown: "ArrowDown", arrowleft: "ArrowLeft", arrowright: "ArrowRight",
      pageup: "PageUp", pagedown: "PageDown", escape: "Escape", enter: "Enter",
      delete: "Delete", insert: "Insert", home: "Home", end: "End", tab: "Tab",
      backspace: "Backspace", " ": "Space",
    };
    if (named[k]) return named[k];
    if (k.length === 1) return k.toUpperCase();
    if (/^f\d{1,2}$/.test(k)) return k.toUpperCase();
    return k;
  }

  // Parse a string like "Ctrl+Shift+ArrowUp" into a modifier/key descriptor.
  function parseBind(str) {
    const bind = { ctrl: false, alt: false, shift: false, meta: false, key: "" };
    try {
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
    } catch (e) {
      console.error("[zen-tab-nav] parseBind", str, e);
    }
    return bind;
  }

  function bindToString(bind) {
    const parts = [];
    if (bind.ctrl) parts.push("Ctrl");
    if (bind.alt) parts.push("Alt");
    if (bind.shift) parts.push("Shift");
    if (bind.meta) parts.push(isMac ? "Cmd" : "Meta");
    if (bind.key) parts.push(prettyKey(bind.key));
    return parts.join("+");
  }

  // Build a descriptor from a live keydown event. Returns null for a lone modifier.
  function bindFromEvent(e) {
    if (["Control", "Alt", "Shift", "Meta", "OS"].includes(e.key)) return null;
    return {
      ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey,
      key: normalizeKey(String(e.key).toLowerCase()),
    };
  }

  // Exact modifier match avoids accidental triggers (e.g. extra Alt held).
  function eventMatches(e, bind) {
    if (!bind.key) return false;
    return e.ctrlKey === bind.ctrl &&
           e.altKey === bind.alt &&
           e.shiftKey === bind.shift &&
           e.metaKey === bind.meta &&
           String(e.key).toLowerCase() === bind.key;
  }

  let upBind = parseBind(DEFAULT_UP);
  let downBind = parseBind(DEFAULT_DOWN);

  function reloadBinds() {
    upBind = parseBind(getStr("move-up", DEFAULT_UP));
    downBind = parseBind(getStr("move-down", DEFAULT_DOWN));
  }

  // ---- Tab navigation ----

  // A tab counts as "unloaded" if it has never had a content panel created
  // or has been explicitly discarded (Firefox marks these "pending").
  function isUnloaded(tab) {
    try { return !tab.linkedPanel || tab.hasAttribute("pending"); }
    catch (e) { return false; }
  }

  function mediaControllerFor(tab) {
    try { return tab.linkedBrowser.browsingContext.mediaController; }
    catch (e) { return null; }
  }

  function mcIsPlaying(mc) {
    try {
      if (typeof mc.isPlaying === "boolean") return mc.isPlaying;
      return mc.playbackState === "playing";
    } catch (e) { return false; }
  }

  // Tabs whose media *we* paused, so we only auto-resume what we paused.
  const autoPaused = new WeakMap();

  function pauseMediaOnLeave(tab) {
    try {
      const mc = mediaControllerFor(tab);
      if (mc && mcIsPlaying(mc)) {
        mc.pause();
        autoPaused.set(tab, true);
      }
    } catch (e) {
      console.error("[zen-tab-nav] pauseMediaOnLeave", e);
    }
  }

  function resumeMediaOnReturn(tab) {
    try {
      if (!autoPaused.get(tab)) return;
      autoPaused.delete(tab);
      const mc = mediaControllerFor(tab);
      if (mc && !mcIsPlaying(mc)) mc.play();
    } catch (e) {
      console.error("[zen-tab-nav] resumeMediaOnReturn", e);
    }
  }

  function navigate(dir) {
    try {
      const skipPinned = getBool("skip-unloaded-pinned", false);
      const pauseMedia = getBool("pause-media", false);

      const before = gBrowser.selectedTab;
      const tabCount = (gBrowser.tabs && gBrowser.tabs.length) || 0;

      gBrowser.tabContainer.advanceSelectedTab(dir, true);
      let after = gBrowser.selectedTab;

      // Keep moving in the same direction while we land on an unloaded pinned
      // tab. Stop if we loop back to the start or exhaust the tab list.
      if (skipPinned) {
        let guard = 0;
        while (after !== before && after.pinned && isUnloaded(after) && guard++ < tabCount) {
          gBrowser.tabContainer.advanceSelectedTab(dir, true);
          after = gBrowser.selectedTab;
        }
      }

      if (pauseMedia && after !== before) {
        pauseMediaOnLeave(before);
        resumeMediaOnReturn(after);
      }
    } catch (e) {
      console.error("[zen-tab-nav] navigation error", e);
    }
  }

  // ---- Keybind capture ("record" mode) ----
  // Sine has no native key-capture input, so we record the next key combo
  // pressed in the browser window and write it into the string pref.

  let captureTarget = null;     // "move-up" | "move-down"
  let captureRecordPref = null; // "record-up" | "record-down"
  let captureTimer = null;

  function captureOverlay() {
    let el = document.getElementById("zenTabNavCapture");
    if (!el) {
      el = document.createElementNS(HTML_NS, "div");
      el.id = "zenTabNavCapture";
      el.style.cssText = [
        "position: fixed", "top: 50%", "left: 50%",
        "transform: translate(-50%, -50%)", "z-index: 2147483647",
        "padding: 16px 22px", "border-radius: 12px",
        "background: rgba(20,20,20,0.96)", "color: #fff",
        "font: 14px/1.5 system-ui, sans-serif", "text-align: center",
        "box-shadow: 0 6px 24px rgba(0,0,0,0.5)", "pointer-events: none",
      ].join(";");
      const title = document.createElementNS(HTML_NS, "div");
      title.id = "zenTabNavCaptureTitle";
      title.style.cssText = "font-weight: 600; margin-bottom: 4px";
      const hint = document.createElementNS(HTML_NS, "div");
      hint.id = "zenTabNavCaptureHint";
      hint.style.cssText = "opacity: 0.75; font-size: 12px";
      el.appendChild(title);
      el.appendChild(hint);
      (document.body || document.documentElement).appendChild(el);
    }
    return el;
  }

  function showCaptureOverlay(title, hint) {
    try {
      const el = captureOverlay();
      el.querySelector("#zenTabNavCaptureTitle").textContent = title;
      el.querySelector("#zenTabNavCaptureHint").textContent = hint || "";
      el.style.display = "block";
    } catch (e) {
      console.error("[zen-tab-nav] showCaptureOverlay", e);
    }
  }

  function hideCaptureOverlay() {
    try {
      const el = document.getElementById("zenTabNavCapture");
      if (el) el.style.display = "none";
    } catch (e) {}
  }

  function endCapture() {
    captureTarget = null;
    captureRecordPref = null;
    if (captureTimer) { clearTimeout(captureTimer); captureTimer = null; }
  }

  function startCapture(targetPref, recordPref) {
    captureTarget = targetPref;
    captureRecordPref = recordPref;
    showCaptureOverlay("Press a key combination…", "Focus the browser window · Esc to cancel");
    if (captureTimer) clearTimeout(captureTimer);
    captureTimer = setTimeout(cancelCapture, 10000);
  }

  function cancelCapture() {
    const record = captureRecordPref;
    endCapture();
    hideCaptureOverlay();
    if (record) setBool(record, false);
  }

  function applyCapture(e) {
    const bind = bindFromEvent(e);
    if (!bind) return; // lone modifier — keep waiting for a real key
    const str = bindToString(bind);
    const target = captureTarget;
    const record = captureRecordPref;
    endCapture();
    setStr(target, str);           // observer reloads the binds
    if (record) setBool(record, false);
    showCaptureOverlay("Saved: " + str, "");
    setTimeout(hideCaptureOverlay, 900);
  }

  // ---- Event handling ----

  function onKeyDown(e) {
    // Capture mode swallows the next keystroke to record it.
    if (captureTarget) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { cancelCapture(); return; }
      applyCapture(e);
      return;
    }
    try {
      if (eventMatches(e, downBind)) {
        e.preventDefault();
        e.stopPropagation();
        navigate(1); // down the list
      } else if (eventMatches(e, upBind)) {
        e.preventDefault();
        e.stopPropagation();
        navigate(-1); // up the list
      }
    } catch (err) {
      console.error("[zen-tab-nav] keydown error", err);
    }
  }

  // Live-reload binds and handle record toggles from Sine's settings.
  const prefObserver = {
    observe(subject, topic, data) {
      if (topic !== "nsPref:changed") return;
      try {
        const name = String(data).slice(PREF_PREFIX.length);
        if (name === "record-up") {
          if (getBool("record-up", false)) startCapture("move-up", "record-up");
        } else if (name === "record-down") {
          if (getBool("record-down", false)) startCapture("move-down", "record-down");
        } else if (name === "move-up" || name === "move-down") {
          reloadBinds();
        }
      } catch (e) {
        console.error("[zen-tab-nav] pref observer error", e);
      }
    },
  };

  function attach() {
    if (window._zenTabNavAttached) return;
    window._zenTabNavAttached = true;

    try {
      reloadBinds();
      window.addEventListener("keydown", onKeyDown, true); // capture phase
      Services.prefs.addObserver(PREF_PREFIX, prefObserver);
      window.addEventListener("unload", () => {
        try { Services.prefs.removeObserver(PREF_PREFIX, prefObserver); } catch (e) {}
      }, { once: true });
    } catch (e) {
      console.error("[zen-tab-nav] attach error", e);
    }
  }

  // Run as soon as gBrowser is ready.
  let tries = 0;
  function init() {
    try {
      if (typeof gBrowser === "undefined" || !gBrowser.tabContainer) {
        if (tries++ < 50) setTimeout(init, 200);
        else console.error("[zen-tab-nav] gBrowser never became ready");
        return;
      }
      attach();
    } catch (e) {
      console.error("[zen-tab-nav] init error", e);
    }
  }
  init();
})();
