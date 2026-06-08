// ==UserScript==
// @name           Ctrl+Up/Down Tab Navigation
// @description    Ctrl+Up moves up the vertical tab list, Ctrl+Down moves down
// @include        chrome://browser/content/browser.xhtml
// ==/UserScript==

(function () {
  function addKeys() {
    if (document.getElementById("zenTabNavKeyset")) return;

    const keyset = document.createXULElement("keyset");
    keyset.id = "zenTabNavKeyset";

    const make = (id, keycode, command) => {
      const k = document.createXULElement("key");
      k.id = id;
      k.setAttribute("keycode", keycode);
      k.setAttribute("modifiers", "accel"); // accel = Ctrl on Win/Linux, Cmd on macOS
      k.setAttribute("command", command);
      keyset.appendChild(k);
    };

    make("zenKeyTabDown", "VK_DOWN", "Browser:NextTab"); // down the list
    make("zenKeyTabUp",   "VK_UP",   "Browser:PrevTab"); // up the list

    document.documentElement.appendChild(keyset);
  }

  // Wait until Zen has rebuilt its own keyset so ours isn't wiped on startup.
  window.addEventListener("ZenKeyboardShortcutsReady", addKeys, { once: true });
})();