// ==UserScript==
// @name           Tab List Navigation
// @description    Configurable keyboard shortcuts to move up/down Zen's vertical tab list
// @include        chrome://browser/content/browser.xhtml
// ==/UserScript==

(function () {
  const PREF_PREFIX = "extensions.zen-tablist-navigation.";
  const DEFAULT_UP = "Ctrl+Shift+ArrowUp";
  const DEFAULT_DOWN = "Ctrl+Shift+ArrowDown";

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

  // The list of tabs the user can arrow through, in visual order, limited to
  // the current workspace (matches what advanceSelectedTab walks).
  function navigableTabs() {
    try {
      if (gBrowser.visibleTabs && gBrowser.visibleTabs.length) return gBrowser.visibleTabs;
    } catch (e) { /* fall through */ }
    try { return Array.from(gBrowser.tabs || []); }
    catch (e) { return []; }
  }

  // Walk from the current tab in `dir`, skipping pinned tabs that aren't loaded,
  // and return the first eligible tab WITHOUT selecting anything. We must peek
  // rather than select-then-check, because selecting an unloaded tab loads it
  // (which would defeat the skip). Returns null if no other tab qualifies.
  function pickSkippingUnloadedPinned(dir) {
    const tabs = navigableTabs();
    const n = tabs.length;
    if (!n) return null;
    const start = tabs.indexOf(gBrowser.selectedTab);
    if (start === -1) return null;
    let idx = start;
    for (let step = 0; step < n; step++) {
      idx = (idx + dir + n) % n;
      const t = tabs[idx];
      if (t === gBrowser.selectedTab) break; // wrapped all the way around
      if (t.pinned && isUnloaded(t)) continue; // skip unloaded pinned
      return t;
    }
    return null;
  }

  function navigate(dir) {
    try {
      const skipPinned = getBool("skip-unloaded-pinned", false);
      const pauseMedia = getBool("pause-media", false);

      const before = gBrowser.selectedTab;

      if (skipPinned) {
        const target = pickSkippingUnloadedPinned(dir);
        if (target && target !== before) gBrowser.selectedTab = target;
      } else {
        gBrowser.tabContainer.advanceSelectedTab(dir, true);
      }

      const after = gBrowser.selectedTab;

      if (pauseMedia && after !== before) {
        pauseMediaOnLeave(before);
        resumeMediaOnReturn(after);
      }
    } catch (e) {
      console.error("[zen-tab-nav] navigation error", e);
    }
  }

  // ---- Click-to-record on the Sine settings textbox ----
  // Sine has no native key-capture input. Its string prefs render as an
  // <input type="text"> inside an hbox whose id is the pref property with dots
  // replaced by hyphens (e.g. "extensions-zen-tablist-navigation-move-up").
  // about:preferences runs in the PARENT process, so from this chrome script we
  // can reach that input via the tab's contentDocument. We hook the field so
  // that focusing/clicking it kicks the user out of text entry, prompts for a
  // combo, and writes the captured combo back into the field and the pref.

  // True while a content-side capture is in progress, so the navigation
  // keydown handler stays out of the way.
  let capturingNow = false;
  let contentCapture = null;  // { input, prefName, doc, orig }
  let contentCaptureTimer = null;
  const hookedDocs = new WeakSet();

  // Which of our prefs (if any) an input belongs to, via its host hbox id.
  function prefForInput(input) {
    try {
      const host = input.closest("[id^='extensions-zen-tablist-navigation-']");
      if (!host) return null;
      if (host.id.endsWith("-move-up")) return "move-up";
      if (host.id.endsWith("-move-down")) return "move-down";
    } catch (e) { /* not one of ours */ }
    return null;
  }

  function endContentCapture(save, value) {
    const cap = contentCapture;
    if (!cap) return;
    contentCapture = null;
    capturingNow = false;
    if (contentCaptureTimer) { clearTimeout(contentCaptureTimer); contentCaptureTimer = null; }
    try { cap.doc.removeEventListener("keydown", onContentCaptureKey, true); } catch (e) {}
    try { cap.input.readOnly = false; } catch (e) {}
    try {
      if (save && value) {
        cap.input.value = value;
        setStr(cap.prefName, value); // updates the live binds via the observer
        // Nudge Sine's own change handler so it persists the field too.
        try { cap.input.dispatchEvent(new cap.doc.defaultView.Event("change", { bubbles: true })); } catch (e) {}
      } else {
        cap.input.value = cap.orig;
      }
    } catch (e) {
      console.error("[zen-tab-nav] endContentCapture", e);
    }
  }

  function onContentCaptureKey(e) {
    try {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { endContentCapture(false); return; }
      const bind = bindFromEvent(e);
      if (!bind) return; // lone modifier — keep waiting for a real key
      endContentCapture(true, bindToString(bind));
    } catch (err) {
      console.error("[zen-tab-nav] content capture key", err);
      endContentCapture(false);
    }
  }

  function startContentCapture(input, prefName, doc) {
    if (contentCapture) return; // one capture at a time
    try {
      contentCapture = { input, prefName, doc, orig: input.value };
      capturingNow = true;
      try { input.blur(); } catch (e) {}          // kick the user out of editing
      try { input.readOnly = true; } catch (e) {} // and out of text entry
      input.value = "Press a key combination… (Esc to cancel)";
      doc.addEventListener("keydown", onContentCaptureKey, true);
      contentCaptureTimer = setTimeout(() => endContentCapture(false), 10000);
    } catch (e) {
      console.error("[zen-tab-nav] startContentCapture", e);
      endContentCapture(false);
    }
  }

  function onPrefMouseDown(e) {
    try {
      const input = e.target;
      if (!input || input.tagName !== "INPUT") return;
      const prefName = prefForInput(input);
      if (!prefName) return;
      e.preventDefault();  // don't place a text caret / enter edit mode
      e.stopPropagation();
      startContentCapture(input, prefName, input.ownerDocument);
    } catch (err) {
      console.error("[zen-tab-nav] pref mousedown", err);
    }
  }

  function onPrefFocusIn(e) {
    try {
      const input = e.target;
      if (!input || input.tagName !== "INPUT") return;
      const prefName = prefForInput(input);
      if (!prefName) return;
      startContentCapture(input, prefName, input.ownerDocument); // dedup-guarded
    } catch (err) {
      console.error("[zen-tab-nav] pref focusin", err);
    }
  }

  // Attach the delegated listeners to an about:preferences document once.
  function hookPrefsDoc(doc) {
    try {
      if (!doc || hookedDocs.has(doc)) return;
      hookedDocs.add(doc);
      doc.addEventListener("mousedown", onPrefMouseDown, true);
      doc.addEventListener("focusin", onPrefFocusIn, true);
    } catch (e) {
      console.error("[zen-tab-nav] hookPrefsDoc", e);
    }
  }

  // Find any open about:preferences tab and hook its (in-process) document.
  function scanForPrefsDocs() {
    try {
      for (const b of gBrowser.browsers) {
        try {
          const uri = b.currentURI && b.currentURI.spec;
          if (uri && uri.startsWith("about:preferences") && b.contentDocument) {
            hookPrefsDoc(b.contentDocument);
          }
        } catch (e) { /* cross-process or not ready — skip */ }
      }
    } catch (e) {
      console.error("[zen-tab-nav] scanForPrefsDocs", e);
    }
  }

  function onMaybePrefsLoad(e) {
    try {
      const doc = e.target;
      const href = doc && doc.location && String(doc.location.href);
      if (href && href.startsWith("about:preferences")) hookPrefsDoc(doc);
    } catch (e) { /* ignore */ }
  }

  // ---- Event handling ----

  function onKeyDown(e) {
    if (capturingNow) return; // a settings-field capture is consuming keys
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

  // Live-reload binds when the user changes a shortcut in Sine's settings.
  const prefObserver = {
    observe(subject, topic, data) {
      if (topic !== "nsPref:changed") return;
      try {
        const name = String(data).slice(PREF_PREFIX.length);
        if (name === "move-up" || name === "move-down") reloadBinds();
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

      // Hook the Sine settings textboxes so clicking one records a combo.
      // about:preferences is in-process, so its content events reach us here.
      gBrowser.addEventListener("DOMContentLoaded", onMaybePrefsLoad, true);
      gBrowser.tabContainer.addEventListener("TabSelect", scanForPrefsDocs);
      scanForPrefsDocs(); // catch a settings tab that's already open

      window.addEventListener("unload", () => {
        try { Services.prefs.removeObserver(PREF_PREFIX, prefObserver); } catch (e) {}
        try { gBrowser.removeEventListener("DOMContentLoaded", onMaybePrefsLoad, true); } catch (e) {}
        try { gBrowser.tabContainer.removeEventListener("TabSelect", scanForPrefsDocs); } catch (e) {}
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
