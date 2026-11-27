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

    function blankPlate(work) {
      return new T.MeshBasicMaterial({
        color: work.media ? 0xffffff : 0xd9d3c8,
        transparent: true,
        opacity: work.media ? 0 : 1,
        depthWrite: !work.media,
        alphaTest: work.media ? 0.005 : 0,
        toneMapped: !work.media,
        side: T.DoubleSide
      });
    }

    for (const mount of opts.mounts) {
      const work = api.describe(mount);
      const group = new T.Group();
      group.name = 'preview-' + work.id;
      const afloat = work.y < -0.4;
      group.position.set(
        work.kind === 'model' ? work.x - 3.6 : afloat ? work.x : work.x - 1.55,
        work.y,
        work.kind === 'model' ? work.z - 2.2 : afloat ? work.z : work.z + 0.15
      );
      let mesh;
      let material;
      if (work.kind === 'model') {
        mesh = new T.Group();
        mesh.userData.height = 5.3;
        api.loadSculpture(T, work.model).then(model => {
          model.rotation.y = 0.4;
          model.position.y -= 0.02;
          model.traverse(part => {
            if (part.isMesh) part.userData.preview = work.id;
          });
          mesh.userData.height = model.userData.height || 27;
          mesh.add(model);
          root.STUDIO_CLING = api.makeCling(T, model);
        }).catch(error => console.warn(error));
      } else if (work.kind === 'solid') {
        const color = new T.Color().setStyle('hsl(' + ((work.id * 47) % 360) + ' 28% 42%)');
        material = new T.MeshStandardMaterial({color, roughness: 0.72, metalness: 0.02});
        mesh = new T.Mesh(new T.BoxGeometry(0.62, 0.78 + (work.id % 3) * 0.08, 0.62), material);
        mesh.position.y = 0.5;
        mesh.castShadow = true;
      } else {
        material = blankPlate(work);
        const plateWidth = 5.68;
        const plateHeight = work.aspect ? plateWidth / work.aspect : plateWidth * (1.02 / 1.42);
        mesh = new T.Mesh(new T.PlaneGeometry(plateWidth, plateHeight), material);
        const foot = work.id === 7 ? 3.05 : 0.45;
        mesh.position.y = plateHeight * 0.5 + foot;
        mesh.rotation.y = Math.PI;
        if (work.media) mesh.renderOrder = 3;
      }
      mesh.name = 'preview-hit-' + work.id;
      mesh.userData.preview = work.id;
      group.add(mesh);
      opts.scene.add(group);
      items.push({work, group, mesh, material, dist: Infinity, pixels: 0, tier: null, bound: null});
    }

    cache.onEvict(key => {
      const item = items.find(entry => entry.bound === key);
      if (!item || item.work.kind === 'solid' || item.work.kind === 'model') return;
      item.material.map = null;
      item.material.color.set(item.work.media ? 0xffffff : 0xd9d3c8);
      item.material.opacity = item.work.media ? 0 : 1;
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
        item.material.color.set(item.work.media || tier === 'high' ? 0xffffff : 0xb9b3aa);
        item.material.opacity = 1;
        item.material.needsUpdate = true;
      }
      return true;
    }

    function projectedPixels(item, camera) {
      const height = item.mesh.userData.height || item.mesh.geometry?.parameters?.height || 0.9;
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
        const hits = raycaster.intersectObjects(items.map(item => item.group), true);
        engaged = null;
        if (hits.length) {
          let obj = hits[0].object;
          while (obj) {
            if (obj.userData && obj.userData.preview) {
              engaged = items.find(item => item.work.id === obj.userData.preview) || null;
              break;
            }
            obj = obj.parent;
          }
        }
        if (!engaged) return null;
        return {
          x: engaged.work.x,
          z: engaged.work.z,
          lookX: engaged.group.position.x,
          lookZ: engaged.group.position.z
        };
      },
      arm() {
        started = true;
        loads.arm();
      },
      update(now, dt, location, velocity, camera, hidden) {
        if (hidden) {
          for (const item of items) cache.get(item.work.id + ':high')?.setPlaying?.(false);
          return;
        }
        for (const item of items) {
          item.dist = Math.hypot(item.work.x - location.x, item.work.z - location.z);
          item.pixels = projectedPixels(item, camera);
          if (item.work.kind !== 'solid' && item.work.kind !== 'model') {
            item.group.lookAt(camera.position.x, item.group.position.y, camera.position.z);
          }
        }
        if (engaged && engaged.dist > RELEASE) engaged = null;
        const focus = engaged || nearestItem();
        const sharp = !!(focus && (focus === engaged || focus.pixels >= SHARP_PIXELS));
        for (const item of items) {
          const playing = item === focus && (item.dist < PLAY || item === engaged);
          if (item.work.kind === 'solid' || item.work.kind === 'model') {
            if (playing && item.work.kind === 'solid') item.mesh.rotation.y += dt * 0.7;
            continue;
          }
          const want = sharp && item === focus ? 'high' : 'low';
          const tier = cache.has(item.work.id + ':' + want) ? want : 'low';
          if (cache.has(item.work.id + ':' + tier)) {
            if (item.tier !== tier) bind(item, tier);
            else if (item.bound) cache.touch(item.bound);
          }
          if (item.work.media) {
            cache.get(item.work.id + ':high')?.setPlaying?.(playing && item.tier === 'high');
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
        const missing = item => item.work.kind !== 'solid' && item.work.kind !== 'model' && !cache.has(item.work.id + ':low') && !loads.queued(item.work.id + ':low');
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
        if (sharp && focus && focus.work.kind !== 'solid' && focus.work.kind !== 'model' && !cache.has(focus.work.id + ':high')) {
          loads.request(focus.work, 'high', focus.dist);
        }
      }
    };
  }

  api.create = create;
})(window);
