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

    function configureTexture(texture, mipmaps) {
      texture.colorSpace = T.SRGBColorSpace;
      texture.generateMipmaps = mipmaps;
      texture.minFilter = mipmaps ? T.LinearMipmapLinearFilter : T.LinearFilter;
      texture.magFilter = T.LinearFilter;
      texture.needsUpdate = true;
      return texture;
    }

    async function loadPoster(work, tier) {
      const image = new Image();
      image.src = work.media.poster;
      await image.decode();
      const size = workSize(work, tier);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = Math.round(size / work.aspect);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const texture = configureTexture(new T.CanvasTexture(canvas), tier === 'high');
      return {bytes: work.tiers[tier].bytes, texture, dispose() { texture.dispose(); }};
    }

    async function loadMedia(work, tier) {
      if (tier !== 'high') return loadPoster(work, tier);
      const video = document.createElement('video');
      video.muted = video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.src = work.media.clip;
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => finish(new Error('Preview video timed out')), 12000);
          function finish(error) {
            clearTimeout(timer);
            video.removeEventListener('loadeddata', ready);
            video.removeEventListener('error', failed);
            error ? reject(error) : resolve();
          }
          function ready() { finish(); }
          function failed() { finish(new Error('Preview video could not load')); }
          video.addEventListener('loadeddata', ready, {once: true});
          video.addEventListener('error', failed, {once: true});
          video.load();
        });
        const texture = configureTexture(new T.VideoTexture(video), false);
        let wanted = false, retryAt = 0;
        return {
          bytes: work.tiers[tier].bytes,
          texture, video,
          setPlaying(play) {
            if (!play) {
              wanted = false;
              if (!video.paused) video.pause();
            } else if (!wanted && performance.now() >= retryAt) {
              wanted = true;
              video.play().catch(() => { wanted = false; retryAt = performance.now() + 2000; });
            }
          },
          dispose() {
            video.pause();
            video.removeAttribute('src');
            video.load();
            texture.dispose();
          }
        };
      } catch (error) {
        video.pause();
        video.removeAttribute('src');
        video.load();
        return loadPoster(work, tier);
      }
    }

    function pump() {
      if (!armed || busy) return;
      const job = pending.shift();
      if (!job) return;
      busy = true;
      requestAnimationFrame(async () => {
        try {
          const size = workSize(job.work, job.tier);
          let asset;
          if (job.work.media) {
            asset = await loadMedia(job.work, job.tier);
          } else if (size > 0) {
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
          cache.put(job.key, asset);
        } catch (error) {
          console.warn('Preview ' + job.work.id + ' could not load', error);
        } finally {
          queued.delete(job.key);
          busy = false;
          if (pending.length) requestAnimationFrame(pump);
        }
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
