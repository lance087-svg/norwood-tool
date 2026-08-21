/* Norwood Supply - build version checker
 * Drop this in the repo root and add ONE line to each page, just before </body>:
 *   <script src="ns-version.js"></script>
 *
 * What it does:
 *  - Fetches version.json fresh from the network on every page load (never cached).
 *  - If the build on the server is newer than the build this device last loaded,
 *    it wipes the browser's cached copies, unregisters any service worker,
 *    and reloads the page so the device gets current files.
 *  - Writes the build number into any element marked data-ns-build, so the
 *    footer always shows which build that device is actually running.
 *  - Exposes window.nsForceRefresh() for a manual "Refresh app" button.
 *
 * Safe by design: only ever reloads once per build per session, so it can't
 * get stuck in a reload loop if a device refuses to give up a cached file.
 */
(function () {
  var STORE_KEY = 'ns_build';        // last build this device successfully loaded
  var GUARD_KEY = 'ns_build_reload'; // reload-once guard, per browser session

  function stampFooter(build) {
    var nodes = document.querySelectorAll('[data-ns-build]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = build;
    }
  }

  function purgeCaches() {
    var jobs = [];
    if (window.caches && caches.keys) {
      jobs.push(
        caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        })
      );
    }
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      jobs.push(
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          return Promise.all(regs.map(function (r) { return r.unregister(); }));
        })
      );
    }
    return Promise.all(jobs).catch(function () { /* nothing to purge */ });
  }

  function hardReload(build) {
    var url = new URL(window.location.href);
    url.searchParams.set('b', build); // new URL = guaranteed fresh fetch
    window.location.replace(url.toString());
  }

  function fetchBuild() {
    return fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) { return data.build; });
  }

  function check(force) {
    return fetchBuild().then(function (build) {
      if (!build) { return; }
      stampFooter(build);

      var seen = null;
      try { seen = localStorage.getItem(STORE_KEY); } catch (e) {}

      // First ever visit on this device: just record it, nothing to fix.
      if (!seen) {
        try { localStorage.setItem(STORE_KEY, build); } catch (e) {}
        return;
      }

      if (seen === build && !force) { return; }

      // Already tried to fix this exact build once this session - don't loop.
      var guard = null;
      try { guard = sessionStorage.getItem(GUARD_KEY); } catch (e) {}
      if (guard === build && !force) {
        try { localStorage.setItem(STORE_KEY, build); } catch (e) {}
        return;
      }

      try { sessionStorage.setItem(GUARD_KEY, build); } catch (e) {}
      try { localStorage.setItem(STORE_KEY, build); } catch (e) {}

      return purgeCaches().then(function () { hardReload(build); });
    }).catch(function () {
      /* Offline or version.json missing - leave the page alone. */
    });
  }

  // Manual escape hatch for the counter: wire a button to this.
  window.nsForceRefresh = function () {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    try { sessionStorage.removeItem(GUARD_KEY); } catch (e) {}
    return purgeCaches().then(function () {
      return fetchBuild().then(function (build) {
        hardReload(build || Date.now());
      }).catch(function () { window.location.reload(); });
    });
  };

  // Run on load.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { check(false); });
  } else {
    check(false);
  }

  // Re-check when a phone that was left open comes back to the foreground.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { check(false); }
  });
})();
