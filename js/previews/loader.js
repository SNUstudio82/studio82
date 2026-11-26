// One preview is decoded and uploaded at a time.
// Movement only queues a few low-resolution plates that lie ahead.
(function (root) {
  'use strict';

  const api = root.StudioPreview;

  function createLoader(T, cache) {
    const pending = [];
    const queued = new Set();
    let busy = false;
    let armed = false;

    function keyOf(work, tier) {
      return work.id + ':' + tier;
    }

    function pump() {
      if (!armed || busy) return;
      const job = pending.shift();
      if (!job) return;
      busy = true;
      requestAnimationFrame(() => {
        const size = workSize(job.work, job.tier);
        let asset;
        if (size > 0) {
          const canvas = api.paint(job.work, size, 0);
          const texture = new T.CanvasTexture(canvas);
          texture.colorSpace = T.SRGBColorSpace;
          texture.generateMipmaps = job.tier === 'high';
          texture.minFilter = job.tier === 'high' ? T.LinearMipmapLinearFilter : T.LinearFilter;
          texture.magFilter = T.LinearFilter;
          texture.needsUpdate = true;
          asset = {
            bytes: job.work.tiers[job.tier].bytes,
            canvas,
            texture,
            dispose() { texture.dispose(); }
          };
        } else {
          asset = {bytes: job.work.tiers[job.tier].bytes, dispose() {}};
        }
        queued.delete(job.key);
        cache.put(job.key, asset);
        busy = false;
        if (pending.length) requestAnimationFrame(pump);
      });
    }

    function workSize(work, tier) {
      return work.tiers[tier].size;
    }

    return {
      arm() {
        armed = true;
        pump();
      },
      queued(key) { return queued.has(key); },
      request(work, tier, dist) {
        const key = keyOf(work, tier);
        if (!armed || cache.has(key) || queued.has(key)) return;
        queued.add(key);
        pending.push({work, tier, key, dist: dist || 0});
        pending.sort((a, b) => (a.tier === b.tier ? a.dist - b.dist : a.tier === 'high' ? -1 : 1));
        while (pending.length > 3) {
          const dropped = pending.pop();
          queued.delete(dropped.key);
        }
        pump();
      }
    };
  }

  api.createLoader = createLoader;
})(window);
