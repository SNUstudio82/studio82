// One quiet preview stands at each work. Only the nearest work,
// or the one just clicked, is shown sharply. Clips and sculptures
// stay still until the player walks up or chooses them.
(function (root) {
  'use strict';

  const api = root.StudioPreview;
  const PLAY = 11;
  const RELEASE = 22;
  const SHARP_PIXELS = 42;
  const BUDGET = 1600000;

  function create(opts) {
    const T = opts.T;
    const cache = api.createCache(BUDGET);
    const loads = api.createLoader(T, cache);
    const items = [];
    const raycaster = new T.Raycaster();
    const pointer = new T.Vector2();
    let started = false;
    let engaged = null;

    function blankPlate() {
      return new T.MeshBasicMaterial({
        color: 0xd9d3c8,
        transparent: true,
        depthWrite: true,
        side: T.DoubleSide
      });
    }

    for (const mount of opts.mounts) {
      const work = api.describe(mount);
      const group = new T.Group();
      group.name = 'preview-' + work.id;
      const afloat = work.y < -0.4;
      group.position.set(afloat ? work.x : work.x - 1.55, work.y, afloat ? work.z : work.z + 0.15);
      let mesh;
      let material;
      if (work.kind === 'solid') {
        const color = new T.Color().setStyle('hsl(' + ((work.id * 47) % 360) + ' 28% 42%)');
        material = new T.MeshStandardMaterial({color, roughness: 0.72, metalness: 0.02});
        mesh = new T.Mesh(new T.BoxGeometry(0.62, 0.78 + (work.id % 3) * 0.08, 0.62), material);
        mesh.position.y = 0.5;
        mesh.castShadow = true;
      } else {
        material = blankPlate();
        mesh = new T.Mesh(new T.PlaneGeometry(1.42, 1.02), material);
        mesh.position.y = 0.72;
        mesh.rotation.y = Math.PI;
      }
      mesh.name = 'preview-hit-' + work.id;
      mesh.userData.preview = work.id;
      group.add(mesh);
      opts.scene.add(group);
      items.push({work, group, mesh, material, dist: Infinity, pixels: 0, tier: null, bound: null});
    }

    cache.onEvict(key => {
      const item = items.find(entry => entry.bound === key);
      if (!item || item.work.kind === 'solid') return;
      item.material.map = null;
      item.material.color.set(0xd9d3c8);
      item.material.needsUpdate = true;
      item.bound = null;
      item.tier = null;
    });

    function bind(item, tier) {
      const key = item.work.id + ':' + tier;
      const asset = cache.get(key);
      if (!asset) return false;
      if (item.bound && item.bound !== key) cache.unpin(item.bound);
      cache.pin(key);
      cache.touch(key);
      item.bound = key;
      item.tier = tier;
      if (asset.texture) {
        item.material.map = asset.texture;
        item.material.color.set(tier === 'high' ? 0xffffff : 0xb9b3aa);
        item.material.needsUpdate = true;
      }
      return true;
    }

    function projectedPixels(item, camera) {
      const height = item.work.kind === 'solid' ? 0.9 : 1.02;
      const dist = Math.max(0.8, camera.position.distanceTo(item.group.position));
      const fov = camera.fov * Math.PI / 180;
      return height / (2 * Math.tan(fov / 2) * dist) * (opts.canvas.clientHeight || 1);
    }

    function nearestItem() {
      let best = null;
      for (const item of items) if (!best || item.dist < best.dist) best = item;
      return best;
    }

    return {
      cache,
      focus() { return (engaged || nearestItem())?.work.id || 0; },
      press(clientX, clientY) {
        const rect = opts.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, opts.camera);
        const hits = raycaster.intersectObjects(items.map(item => item.mesh), false);
        engaged = hits.length ? items.find(item => item.work.id === hits[0].object.userData.preview) || null : null;
      },
      arm() {
        started = true;
        loads.arm();
      },
      update(now, dt, location, velocity, camera, hidden) {
        if (hidden) return;
        for (const item of items) {
          item.dist = Math.hypot(item.work.x - location.x, item.work.z - location.z);
          item.pixels = projectedPixels(item, camera);
          if (item.work.kind !== 'solid') {
            item.group.lookAt(camera.position.x, item.group.position.y, camera.position.z);
          }
        }
        if (engaged && engaged.dist > RELEASE) engaged = null;
        const focus = engaged || nearestItem();
        const sharp = !!(focus && (focus === engaged || focus.pixels >= SHARP_PIXELS));
        for (const item of items) {
          const playing = item === focus && (item.dist < PLAY || item === engaged);
          if (item.work.kind === 'solid') {
            if (playing) item.mesh.rotation.y += dt * 0.7;
            continue;
          }
          const want = sharp && item === focus ? 'high' : 'low';
          const tier = cache.has(item.work.id + ':' + want) ? want : 'low';
          if (cache.has(item.work.id + ':' + tier)) {
            if (item.tier !== tier) bind(item, tier);
            else if (item.bound) cache.touch(item.bound);
          }
          if (playing && item.work.kind === 'clip' && item.tier === 'high') {
            const asset = cache.get(item.work.id + ':high');
            if (asset && asset.canvas) {
              api.draw(asset.canvas, item.work, now);
              asset.texture.needsUpdate = true;
            }
          }
        }
        if (!started) return;
        const speed = Math.hypot(velocity.x, velocity.z);
        const missing = item => item.work.kind !== 'solid' && !cache.has(item.work.id + ':low') && !loads.queued(item.work.id + ':low');
        let ahead = [];
        if (speed > 0.35) {
          const vx = velocity.x / speed, vz = velocity.z / speed;
          ahead = items.filter(item => {
            if (!missing(item) || item.dist < 3 || item.dist > 96) return false;
            const dx = item.work.x - location.x, dz = item.work.z - location.z;
            return dx / item.dist * vx + dz / item.dist * vz > 0.4;
          }).sort((a, b) => a.dist - b.dist).slice(0, 2);
        } else {
          ahead = items.filter(item => missing(item) && item.dist < 70).sort((a, b) => a.dist - b.dist).slice(0, 1);
        }
        for (const item of ahead) loads.request(item.work, 'low', item.dist);
        if (sharp && focus && focus.work.kind !== 'solid' && !cache.has(focus.work.id + ':high')) {
          loads.request(focus.work, 'high', focus.dist);
        }
      }
    };
  }

  api.create = create;
})(window);
