// Recently shown previews stay in a small recency stack.
// Walking away does not drop them. The oldest unused entry leaves
// only after the byte budget is full.
(function (root) {
  'use strict';

  function createCache(budget) {
    const entries = new Map();
    const stack = [];
    const listeners = new Set();
    let used = 0;

    function touch(key) {
      const index = stack.indexOf(key);
      if (index >= 0) stack.splice(index, 1);
      stack.push(key);
    }

    function evict() {
      let guard = 0;
      while (used > budget && stack.length && guard++ < stack.length + 2) {
        const key = stack.find(name => entries.has(name) && !entries.get(name).pinned);
        if (!key) return;
        const index = stack.indexOf(key);
        stack.splice(index, 1);
        const asset = entries.get(key);
        entries.delete(key);
        used -= asset.bytes;
        asset.dispose?.();
        listeners.forEach(fn => fn(key, asset));
      }
    }

    return {
      budget,
      has: key => entries.has(key),
      get: key => entries.get(key),
      used: () => used,
      put(key, asset) {
        if (entries.has(key)) {
          used -= entries.get(key).bytes;
          entries.get(key).dispose?.();
        }
        asset.pinned = false;
        entries.set(key, asset);
        used += asset.bytes;
        touch(key);
        evict();
      },
      touch,
      pin(key) {
        const asset = entries.get(key);
        if (asset) asset.pinned = true;
      },
      unpin(key) {
        const asset = entries.get(key);
        if (asset) asset.pinned = false;
      },
      onEvict(fn) { listeners.add(fn); }
    };
  }

  root.StudioPreview = root.StudioPreview || {};
  root.StudioPreview.createCache = createCache;
})(window);
