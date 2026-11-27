// An eight-shaped island for the exhibition ground. The repeating granite
// field and the contour map stay; only this landform replaces the mound.
(function (root) {
  'use strict';

  const EIGHT = {
    id: 'eight-ground',
    x: 26,
    z: -22,
    rotation: 2.09,
    radius: 7.8,
    gap: 7.05,
    slope: 7,
    rise: 2.55
  };
  const SKIRT = 1.15;
  const LAND = 0.46;
  const SITES = [[0,-124],[-58,-96],[0,-58],[58,-96],[-40,-14],[40,-14],[0,57],[-66,52],[66,52],[-48,108],[48,108],[0,132]];

  function smooth(e0, e1, x) {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }
  function smoother(t) {
    t = Math.min(1, Math.max(0, t));
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function createExhibition(T, baseGround, surfaceMat, carveUniforms, granite, loader, asset, renderer) {
    const cos = Math.cos(EIGHT.rotation);
    const sin = Math.sin(EIGHT.rotation);
    const outer = EIGHT.radius + EIGHT.slope;

    function toLocal(x, z) {
      const dx = x - EIGHT.x, dz = z - EIGHT.z;
      return [dx * cos - dz * sin, dx * sin + dz * cos];
    }
    function toWorld(lx, lz) {
      return [EIGHT.x + lx * cos + lz * sin, EIGHT.z - lx * sin + lz * cos];
    }
    function dist8(lx, lz) {
      return Math.min(Math.hypot(lx, lz - EIGHT.gap), Math.hypot(lx, lz + EIGHT.gap));
    }
    function coverage(x, z) {
      const [lx, lz] = toLocal(x, z);
      const d = dist8(lx, lz);
      if (d >= outer) return 0;
      if (d <= EIGHT.radius) return 1;
      return 1 - smoother((d - EIGHT.radius) / EIGHT.slope);
    }

    const zMin = -134, zMax = 141, rows = 320, cols = 164, rowH = (zMax - zMin) / rows;
    const lakes = [{z: -58, r: 35}, {z: 57, r: 41}];
    const waterLevel = -1;
    const mix = T.MathUtils.lerp, clamp = T.MathUtils.clamp;
    function edges(z) {
      const a = Math.sqrt(Math.max(0, 76 * 76 - (z + 58) ** 2));
      const b = Math.sqrt(Math.max(0, 84 * 84 - (z - 57) ** 2));
      const width = Math.max(0.08, Math.max(a, b) + Math.max(10 - Math.abs(a - b), 0) ** 2 / 40);
      const wobble = width / 85;
      return [-width + wobble * (1.3 * Math.sin(z * 0.092) + 0.85 * Math.cos(z * 0.19)), width + wobble * (1.7 * Math.sin(z * 0.085 - 0.8) + 0.55 * Math.sin(z * 0.29))];
    }
    function shoreRadius(lake, angle) { return lake.r * (1 + 0.018 * Math.sin(3 * angle + 0.5) + 0.014 * Math.cos(5 * angle - 0.3)); }
    function landform(x, z, bounds) {
      const lake = z < 0 ? lakes[0] : lakes[1], angle = Math.atan2(z - lake.z, x);
      const shore = Math.hypot(x, z - lake.z) - shoreRadius(lake, angle);
      const margin = Math.min(x - bounds[0], bounds[1] - x, z - zMin, zMax - z);
      const folds = Math.sin(x * 0.077 + 1.12 * Math.cos(z * 0.051)) + Math.sin(z * 0.113 + x * 0.046) * 0.65;
      const grains = 0.17 * Math.cos(x * 0.91 + z * 0.44) * Math.sin(z * 0.95) + 0.34 * Math.sin(z * 0.37 + x * 0.28) * Math.cos(x * 0.42);
      const hillside = 3.4 + 2.9 * folds + grains + (5.5 + 2 * Math.sin(z * 0.24)) * Math.exp(-(Math.max(0, margin - 1) ** 2) / 130);
      const t = T.MathUtils.smoothstep(shore, 0, 22);
      const north = z >= 0;
      const raw = shore < 0 ? -1 + Math.max(north ? -15.5 : -3.7, shore * (north ? 0.46 : 0.29)) : mix(-1 + shore * 0.16, hillside, t);
      return -1 + (raw + 1) * 0.58;
    }
    const pads = SITES.map(([sx, sz]) => ({sx, sz, y: landform(sx, sz, edges(sz))}));
    const padCore = 11, padReach = 24;
    function settle(x, z, y) {
      let best = 0, target = y;
      for (let i = 0; i < pads.length; i++) {
        const core = i === 10 ? 42 : padCore;
        const reach = i === 10 ? 64 : padReach;
        const d = Math.hypot(x - pads[i].sx, z - pads[i].sz);
        if (d >= reach) continue;
        const w = d <= core ? 1 : 1 - smooth(core, reach, d);
        if (w > best) { best = w; target = pads[i].y; }
      }
      return best ? mix(y, target, best * 0.84) : y;
    }
    const bounds = [], stride = cols + 1, heights = new Float32Array((rows + 1) * stride);
    const verts = [], indices = [], uv = [];
    for (let row = 0; row <= rows; row++) {
      const z = zMin + row * rowH, e = edges(z);
      bounds.push(e);
      for (let col = 0; col <= cols; col++) {
        const x = mix(e[0], e[1], col / cols), i = row * stride + col;
        heights[i] = settle(x, z, landform(x, z, e));
        verts.push(x * LAND, heights[i], z * LAND);
        uv.push(x * 0.2, z * 0.2);
        if (row < rows && col < cols) indices.push(i, i + stride, i + 1, i + stride, i + stride + 1, i + 1);
      }
    }
    function makeGeometry(v, idx, tex, colors) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(v, 3));
      if (tex) g.setAttribute('uv', new T.Float32BufferAttribute(tex, 2));
      if (colors) g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      return g;
    }
    function localOf(x, z) { return [(x - EIGHT.x) / LAND, (z - EIGHT.z) / LAND]; }
    function contains(x, z) {
      const [lx, lz] = localOf(x, z);
      if (lz < zMin || lz > zMax) return false;
      const e = edges(lz);
      return lx >= e[0] && lx <= e[1];
    }
    function surfaceLocal(x, z, normal) {
      if (normal) normal.set(0, 1, 0);
      const row = clamp(Math.floor((z - zMin) / rowH), 0, rows - 1);
      const f = (z - zMin) / rowH - row;
      const e = bounds[row], next = bounds[row + 1];
      const left = mix(e[0], next[0], f), right = mix(e[1], next[1], f);
      const col = clamp(Math.floor((x - left) / (right - left) * cols), 0, cols - 1);
      const w = (e[1] - e[0]) / cols, v = (next[1] - next[0]) / cols;
      const x0 = e[0] + col * w, x1 = next[0] + col * v;
      const a = row * stride + col, b = a + stride, d = a + 1, c = b + 1;
      const diagonal = mix(x0 + w, x1, f);
      let gradX, gradZ, y;
      if (x <= diagonal) {
        gradX = (heights[d] - heights[a]) / w;
        gradZ = (heights[b] - heights[a] - gradX * (x1 - x0)) / rowH;
        y = heights[a] + (x - x0) * gradX + f * rowH * gradZ;
      } else {
        gradX = (heights[c] - heights[b]) / v;
        gradZ = (heights[c] - heights[d] - gradX * (x1 + v - x0 - w)) / rowH;
        y = heights[c] + (x - x1 - v) * gradX + (f - 1) * rowH * gradZ;
      }
      if (normal) normal.set(-gradX, 1, -gradZ).normalize();
      return y;
    }
    function sample(x, z, normal) {
      if (!contains(x, z)) {
        if (normal) normal.set(0, 1, 0);
        return -Infinity;
      }
      const [lx, lz] = localOf(x, z);
      return surfaceLocal(lx, lz, normal);
    }

    const landMat = surfaceMat.clone();
    landMat.vertexColors = false;
    const terrain = new T.Mesh(makeGeometry(verts, indices, uv), landMat);
    terrain.name = 'exhibition-ground';
    terrain.receiveShadow = true;
    terrain.renderOrder = 1;

    const rim = [];
    for (let j = 0; j <= rows; j++) rim.push([bounds[j][1], zMin + j * rowH, heights[j * stride + cols]]);
    for (let j = rows; j >= 0; j--) rim.push([bounds[j][0], zMin + j * rowH, heights[j * stride]]);
    const rimArc = new Float32Array(rim.length);
    for (let j = 1; j < rim.length; j++) {
      const a = rim[j - 1], b = rim[j];
      rimArc[j] = rimArc[j - 1] + Math.hypot((b[0] - a[0]) * LAND, (b[1] - a[1]) * LAND);
    }
    const cv = [], ci = [], cc = [], cu = [];
    const tiers = [0, 2.5, 9, 21, 39, 66, 93];
    const shades = ['#9b9a93', '#898d88', '#7d807d', '#68746e', '#66716e', '#83938c', '#9daca7'];
    for (let k = 0; k < tiers.length; k++) {
      for (let j = 0; j < rim.length; j++) {
        const [x, z, y] = rim[j], a = Math.atan2(z / 137, x / 84), depth = tiers[k];
        const flute = Math.sin(a * 43 + 1.8 * Math.sin(a * 17)) + 0.52 * Math.sin(91 * a + 0.8 * k);
        const pinch = k === 0 ? 1 : 1 - 0.0021 * depth + 0.034 * flute * (1 - Math.exp(-k));
        const drop = depth * (1 + 0.085 * Math.sin(a * 19) + 0.045 * flute);
        cv.push(x * pinch * LAND, y - drop, z * pinch * LAND);
        cu.push(rimArc[j] * 1.05, drop * 1.05);
        const color = new T.Color(shades[k]).multiplyScalar(1 + 0.08 * flute);
        cc.push(color.r, color.g, color.b);
        if (k < tiers.length - 1) {
          const i = k * rim.length + j, n = k * rim.length + (j + 1) % rim.length;
          ci.push(i, n, i + rim.length, n, n + rim.length, i + rim.length);
        }
      }
    }
    const baseIndex = cv.length / 3;
    cv.push(0, -102, 0); cu.push(0, 0); cc.push(0.25, 0.30, 0.28);
    for (let j = 0; j < rim.length; j++) ci.push(baseIndex, (tiers.length - 1) * rim.length + j, (tiers.length - 1) * rim.length + (j + 1) % rim.length);
    const cliffMat = new T.MeshStandardMaterial({vertexColors: true, map: granite, roughness: 0.97, side: T.DoubleSide});
    const cliffs = new T.Mesh(makeGeometry(cv, ci, cu, cc), cliffMat);
    cliffs.name = 'island-cliffs';
    cliffs.receiveShadow = true;

    const waterClock = {value: 0};
    const waterUnder = {value: 0};
    const waterMood = {
      color: {value: new T.Color(0x7eb8c6)},
      colorB: {value: new T.Color(0x9ec9cf)},
      colorC: {value: new T.Color(0xb7d4ea)},
      amount: {value: 0}
    };
    const northCentre = new T.Vector2(EIGHT.x, EIGHT.z + lakes[1].z * LAND);
    const northRadius = {value: lakes[1].r * LAND};
    const waterMat = new T.MeshStandardMaterial({
      color: 0xd7e6ec, roughness: 0.08, metalness: 0.02, envMapIntensity: 0.85,
      transparent: true, opacity: 0.34, depthWrite: false, side: T.DoubleSide,
      forceSinglePass: true
    });
    waterMat.onBeforeCompile = shader => {
      shader.uniforms.tLake = waterClock;
      shader.uniforms.uUnder = waterUnder;
      shader.uniforms.uPigment = waterMood.color;
      shader.uniforms.uPigmentB = waterMood.colorB;
      shader.uniforms.uPigmentC = waterMood.colorC;
      shader.uniforms.uMood = waterMood.amount;
      shader.uniforms.uLake = {value: northCentre};
      shader.uniforms.uLakeR = northRadius;
      shader.vertexShader = 'varying vec2 waterXZ;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nwaterXZ=(modelMatrix*vec4(position,1.)).xz;');
      shader.fragmentShader = 'uniform float tLake; uniform float uUnder; uniform vec3 uPigment; uniform vec3 uPigmentB; uniform vec3 uPigmentC; uniform float uMood; uniform vec2 uLake; uniform float uLakeR; varying vec2 waterXZ;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec2 p=waterXZ;
        float ripple=sin(p.y*4.5+.8*sin(p.x*.7+tLake*.35)+tLake*1.2);
        float swell=sin(p.y*1.65+p.x*.68-.6*tLake+.28*sin(p.x*1.5));
        float light=smoothstep(.68,.99,ripple*.65+swell*.35)*(1.-smoothstep(.2,1.7,fwidth(p.y)*4.5));
        diffuseColor.rgb=mix(diffuseColor.rgb, vec3(.93,.97,.99), light*.7);
        diffuseColor.a=0.22+light*.2;
        diffuseColor.rgb=mix(diffuseColor.rgb, vec3(.72,.88,.95), uUnder*.55);
        diffuseColor.a=mix(diffuseColor.a, .48, uUnder*.7);
        float lakeMask=1.-smoothstep(uLakeR*.2, uLakeR*.95, length(waterXZ-uLake));
        float tide=0.5+0.5*sin(p.x*0.16+p.y*0.09-tLake*0.18);
        float tide2=0.5+0.5*sin(p.y*0.055-p.x*0.04+tLake*0.11);
        vec3 wash=mix(uPigment, uPigmentB, tide);
        wash=mix(wash, uPigmentC, tide2*0.65);
        diffuseColor.rgb=mix(diffuseColor.rgb, wash, uMood*lakeMask*0.72);`);
    };
    const waters = lakes.map(lake => {
      const v = [0, waterLevel, lake.z * LAND], idx = [];
      let reach = 0;
      for (let i = 0; i < 180; i++) {
        const a = i * Math.PI / 90, r = (shoreRadius(lake, a) + 0.8) * LAND;
        if (r > reach) reach = r;
        v.push(Math.cos(a) * r, waterLevel, lake.z * LAND + Math.sin(a) * r);
        idx.push(0, (i + 1) % 180 + 1, i + 1);
      }
      const water = new T.Mesh(makeGeometry(v, idx), waterMat);
      water.name = 'clear-lake';
      water.renderOrder = 2;
      water.userData.cx = 0;
      water.userData.cz = lake.z * LAND;
      water.userData.cr = reach;
      return water;
    });

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let row = 0; row <= rows; row += 4) {
      const z = zMin + row * rowH, e = bounds[row];
      for (const x of e) {
        const wx = x * LAND + EIGHT.x, wz = z * LAND + EIGHT.z;
        if (wx < minX) minX = wx;
        if (wx > maxX) maxX = wx;
        if (wz < minZ) minZ = wz;
        if (wz > maxZ) maxZ = wz;
      }
    }
    const texW = 384, texH = 512, pad = 3;
    minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
    const sizeX = Math.max(1, maxX - minX), sizeZ = Math.max(1, maxZ - minZ);
    const mask = new Uint8Array(texW * texH * 4);
    for (let j = 0; j < texH; j++) {
      const z = minZ + (j + 0.5) / texH * sizeZ;
      for (let i = 0; i < texW; i++) {
        const x = minX + (i + 0.5) / texW * sizeX;
        const byte = contains(x, z) ? 255 : 0;
        const p = (j * texW + i) * 4;
        mask[p] = mask[p + 1] = mask[p + 2] = byte;
        mask[p + 3] = 255;
      }
    }
    const maskTex = new T.DataTexture(mask, texW, texH, T.RGBAFormat);
    maskTex.colorSpace = T.NoColorSpace;
    maskTex.magFilter = T.LinearFilter;
    maskTex.minFilter = T.LinearFilter;
    maskTex.wrapS = maskTex.wrapT = T.ClampToEdgeWrapping;
    maskTex.generateMipmaps = false;
    maskTex.needsUpdate = true;
    carveUniforms.carveMask.value = maskTex;
    carveUniforms.carveMin.value.set(minX, minZ);
    carveUniforms.carveSize.value.set(sizeX, sizeZ);

    function stood(lx, lz) {
      const y = surfaceLocal(lx, lz);
      const lake = lz < 0 ? lakes[0] : lakes[1];
      if (Math.hypot(lx, lz - lake.z) < 4) return Math.max(y, waterLevel);
      return y;
    }
    const mounts = SITES.map(([lx, lz], index) => {
      const x = EIGHT.x + lx * LAND, z = EIGHT.z + lz * LAND;
      return {id: index + 1, x, z, y: stood(lx, lz), yaw: 0};
    });
    EIGHT.mounts = mounts;
    const southLake = mounts[2], northLake = mounts[6];
    const spawn = {x: (southLake.x + northLake.x) / 2, z: (southLake.z + northLake.z) / 2};

    const group = new T.Group();
    group.name = 'exhibition';
    group.position.set(EIGHT.x, 0, EIGHT.z);
    group.add(terrain, cliffs, ...waters);
    const endingLake = root.createEndingLake(T, {
      group, asset, waterUnder, waterMood,
      anchorX: EIGHT.x, anchorZ: EIGHT.z,
      lakeZ: lakes[1].z * LAND, lakeR: lakes[1].r * LAND, waterLevel, renderer,
      bed: (x, z) => surfaceLocal(x / LAND, z / LAND)
    });
    if (loader && asset) {
      loader.load(asset('work-labels.png'), sheet => {
        sheet.colorSpace = T.SRGBColorSpace;
        SITES.forEach(([lx, lz], index) => {
          const id = index + 1;
          const texture = sheet.clone();
          texture.needsUpdate = true;
          texture.repeat.set(0.5, 0.125);
          texture.offset.set((index % 2) * 0.5, 1 - (1 + Math.floor(index / 2)) * 0.125);
          const material = new T.SpriteMaterial({map: texture, color: 0x000000, transparent: true, depthWrite: false, fog: false, toneMapped: false});
          const label = new T.Sprite(material);
          label.name = 'work-label-' + id;
          label.center.set(124 / 1024, 1 - 90 / 256);
          const pixelsPerUnit = id === 1 ? 325 : 240;
          label.scale.set(1024 / pixelsPerUnit, 256 / pixelsPerUnit, 1);
          const lake = lz < 0 ? lakes[0] : lakes[1];
          const afloat = Math.hypot(lx, lz - lake.z) < 4;
          const x = lx * LAND + (id === 11 ? 8.4 : afloat ? 0 : 2.4);
          const z = lz * LAND + (id === 11 ? -0.4 : afloat ? 0 : 0.1);
          label.position.set(x, stood(lx, lz) + (id === 11 ? 1.9 : afloat ? 2.15 : 2.45), z);
          group.add(label);
        });
      });
    }

    const ringPath = pts => {
      let d = '';
      for (let i = 0; i < pts.length; i++) d += (i ? 'L' : 'M') + pts[i][0].toFixed(2) + ' ' + pts[i][1].toFixed(2);
      return d + 'Z';
    };
    let reach = 0;
    const right = [], left = [];
    for (let z = zMin; z <= zMax; z += 1.25) {
      const e = edges(z);
      right.push([e[1] * LAND, z * LAND]);
      left.push([e[0] * LAND, z * LAND]);
      reach = Math.max(reach, Math.hypot(e[0], z) * LAND);
    }
    const tip = edges(zMax);
    right.push([tip[1] * LAND, zMax * LAND]);
    left.push([tip[0] * LAND, zMax * LAND]);
    reach = Math.max(reach, Math.abs(zMin) * LAND, Math.abs(zMax) * LAND);
    const lakePaths = lakes.map(lake => {
      const ring = [];
      for (let i = 0; i < 96; i++) {
        const a = i * Math.PI / 48, r = shoreRadius(lake, a) * LAND;
        ring.push([Math.cos(a) * r, lake.z * LAND + Math.sin(a) * r]);
      }
      return ringPath(ring);
    });
    const map = buildMap(EIGHT, toWorld, (x, z) => contains(x, z) ? sample(x, z) : NaN, {
      outline: ringPath(right.concat(left.reverse())),
      lakes: lakePaths,
      sites: mounts,
      reach: reach + 4
    });
    map.panel.inert = true;
    map.panel.setAttribute('aria-hidden', 'true');
    let pinned = false, pointerInside = false, pointerDown = false, focused = false;
    let introUntil = 0, idleUntil = 0, open = false, lastDraw = -Infinity, skipPaint = true;
    let wasEngaged = false, moving = false, onLand = false;
    const holdMs = 5000;
    const latest = {x: 0, z: 0, dirX: 0, dirZ: -1};
    const heading = new T.Vector3();

    function stayOpen(now) {
      return pinned || pointerInside || pointerDown || focused || moving || now < introUntil || now < idleUntil;
    }
    function setOpen(next, now) {
      if (open === next) {
        if (next) map.paint(latest, onLand, true);
        return;
      }
      open = next;
      map.panel.classList.toggle('is-open', open);
      map.panel.inert = !open;
      map.panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      map.root.classList.toggle('is-open', open);
      map.openBtn.inert = open;
      map.openBtn.tabIndex = open ? -1 : 0;
      map.openBtn.setAttribute('aria-hidden', open ? 'true' : 'false');
      map.openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        skipPaint = false;
        map.paint(latest, onLand, true);
        lastDraw = now;
      }
    }
    function paintIfDue(now, force) {
      if (!open) return;
      if (skipPaint && !force) return;
      if (!force && now - lastDraw < 80) return;
      lastDraw = now;
      skipPaint = false;
      const t = coverage(latest.x, latest.z);
      if (onLand) { if (t < 0.2) onLand = false; }
      else if (t > 0.62) onLand = true;
      map.paint(latest, onLand, false);
    }

    map.panel.addEventListener('pointerenter', () => { pointerInside = true; });
    map.panel.addEventListener('pointerleave', () => {
      pointerInside = false;
      idleUntil = performance.now() + 3000;
    });
    map.panel.addEventListener('pointerdown', () => { pointerDown = true; });
    map.panel.addEventListener('pointerup', () => {
      pointerDown = false;
      if (!pointerInside) idleUntil = performance.now() + 3000;
    });
    map.panel.addEventListener('pointercancel', () => { pointerDown = false; });
    map.panel.addEventListener('focusin', () => { focused = true; });
    map.panel.addEventListener('focusout', event => {
      if (map.panel.contains(event.relatedTarget)) return;
      focused = false;
      idleUntil = performance.now() + 3000;
    });
    map.pin.addEventListener('click', () => togglePin());
    map.openBtn.addEventListener('click', () => {
      const now = performance.now();
      idleUntil = now + 3000;
      setOpen(true, now);
      requestAnimationFrame(() => { if (open) map.pin.focus(); });
    });

    function togglePin() {
      pinned = !pinned;
      map.pin.setAttribute('aria-pressed', String(pinned));
      const now = performance.now();
      if (pinned) setOpen(true, now);
      else idleUntil = now + 3000;
    }

    root.STUDIO_EXHIBITION = {eight: EIGHT, mounts};

    return {
      group,
      eight: EIGHT,
      mounts,
      spawn,
      sample,
      contains,
      interior() { return 0; },
      constrain() {},
      armIntro(now) {
        introUntil = now + 6000;
        setOpen(true, now);
      },
      togglePin,
      sync(now, x, z, bodyY, camera, engaged, hidden) {
        waterClock.value = now * 0.001;
        const eye = Math.abs(camera.position.y - waterLevel);
        for (const water of waters) {
          const band = water.userData.grazing ? 0.22 : 0.12;
          const dx = camera.position.x - group.position.x - water.userData.cx;
          const dz = camera.position.z - group.position.z - water.userData.cz;
          const over = dx * dx + dz * dz < (water.userData.cr + 0.8) * (water.userData.cr + 0.8);
          water.userData.grazing = eye < band && over;
          water.visible = !water.userData.grazing;
        }
        endingLake.update(now * 0.001, x, z, bodyY, camera);
        latest.x = x;
        latest.z = z;
        camera.getWorldDirection(heading);
        latest.dirX = heading.x;
        latest.dirZ = heading.z;
        if (engaged && !wasEngaged) idleUntil = 0;
        if (!engaged && wasEngaged) idleUntil = now + holdMs;
        moving = engaged;
        wasEngaged = engaged;
        if (moving) setOpen(true, now);
        else if (open && !stayOpen(now)) setOpen(false, now);
        if (hidden) { skipPaint = true; return; }
        paintIfDue(now, false);
      }
    };
  }

  function traceContours(sample, anchorX, anchorZ, half, step, interval) {
    const n = Math.round(half * 2 / step);
    const hs = new Float32Array((n + 1) * (n + 1));
    let lo = Infinity, hi = -Infinity;
    const at = (i, j) => hs[j * (n + 1) + i];
    for (let j = 0; j <= n; j++) {
      const z = anchorZ - half + j * step;
      for (let i = 0; i <= n; i++) {
        const h = sample(anchorX - half + i * step, z);
        hs[j * (n + 1) + i] = h;
        if (!Number.isFinite(h)) continue;
        if (h < lo) lo = h;
        if (h > hi) hi = h;
      }
    }
    if (!(hi > lo)) return [];
    const levels = [];
    for (let level = Math.ceil(lo / interval) * interval; level < hi; level += interval) levels.push(+level.toFixed(4));
    const edgePoint = (x0, z0, edge, t) => {
      if (edge === 0) return [x0 + t * step, z0];
      if (edge === 1) return [x0 + step, z0 + t * step];
      if (edge === 2) return [x0 + t * step, z0 + step];
      return [x0, z0 + t * step];
    };
    const cross = (h0, h1, level) => {
      const d = h1 - h0;
      return Math.abs(d) < 1e-6 ? 0.5 : (level - h0) / d;
    };
    const lines = [];
    for (const level of levels) {
      const segs = [];
      for (let j = 0; j < n; j++) {
        const z0 = -half + j * step;
        for (let i = 0; i < n; i++) {
          const x0 = -half + i * step;
          const hbl = at(i, j), hbr = at(i + 1, j), htr = at(i + 1, j + 1), htl = at(i, j + 1);
          if (!Number.isFinite(hbl + hbr + htr + htl)) continue;
          let code = 0;
          if (hbl >= level) code |= 1;
          if (hbr >= level) code |= 2;
          if (htr >= level) code |= 4;
          if (htl >= level) code |= 8;
          if (code === 0 || code === 15) continue;
          const pt = (edge, t) => edgePoint(x0, z0, edge, t);
          const bottom = pt(0, cross(hbl, hbr, level));
          const right = pt(1, cross(hbr, htr, level));
          const top = pt(2, cross(htl, htr, level));
          const left = pt(3, cross(hbl, htl, level));
          const link = (a, b) => segs.push([a, b]);
          if (code === 1) link(left, bottom);
          else if (code === 2) link(bottom, right);
          else if (code === 3) link(left, right);
          else if (code === 4) link(right, top);
          else if (code === 5) {
            const mid = (hbl + hbr + htr + htl) / 4;
            if (mid >= level) { link(left, bottom); link(right, top); }
            else { link(left, top); link(bottom, right); }
          } else if (code === 6) link(bottom, top);
          else if (code === 7) link(left, top);
          else if (code === 8) link(top, left);
          else if (code === 9) link(bottom, top);
          else if (code === 10) {
            const mid = (hbl + hbr + htr + htl) / 4;
            if (mid >= level) { link(bottom, right); link(top, left); }
            else { link(bottom, left); link(right, top); }
          } else if (code === 11) link(top, right);
          else if (code === 12) link(right, left);
          else if (code === 13) link(right, bottom);
          else if (code === 14) link(bottom, left);
        }
      }
      const key = p => p[0].toFixed(3) + ',' + p[1].toFixed(3);
      const adj = new Map();
      const ek = (a, b) => {
        const ka = key(a), kb = key(b);
        return ka < kb ? ka + '|' + kb : kb + '|' + ka;
      };
      for (const [a, b] of segs) {
        for (const [p, q] of [[a, b], [b, a]]) {
          const k = key(p);
          if (!adj.has(k)) adj.set(k, []);
          adj.get(k).push(q);
        }
      }
      const used = new Set();
      const walk = (from, to) => {
        const pts = [from, to];
        used.add(ek(from, to));
        let cur = to;
        for (let guard = 0; guard < segs.length + 2; guard++) {
          const nbrs = adj.get(key(cur)) || [];
          let nxt = null;
          for (const n of nbrs) if (!used.has(ek(cur, n))) { nxt = n; break; }
          if (!nxt) break;
          used.add(ek(cur, nxt));
          pts.push(nxt);
          cur = nxt;
          if (key(cur) === key(from)) break;
        }
        return pts;
      };
      for (const [a, b] of segs) {
        if (used.has(ek(a, b))) continue;
        let pts = walk(a, b);
        const nbrs = adj.get(key(a)) || [];
        let back = null;
        for (const n of nbrs) if (!used.has(ek(a, n))) { back = n; break; }
        if (back) {
          const tail = walk(a, back).slice(1);
          pts = tail.reverse().concat(pts);
        }
        if (pts.length < 4) continue;
        const closed = key(pts[0]) === key(pts[pts.length - 1]);
        if (closed) pts = pts.slice(0, -1);
        const smooth = [];
        const count = pts.length;
        const limit = closed ? count : count - 1;
        if (!closed) smooth.push(pts[0]);
        for (let i = 0; i < limit; i++) {
          const p = pts[i], q = pts[(i + 1) % count];
          smooth.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25]);
          smooth.push([p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
        }
        if (!closed) smooth.push(pts[count - 1]);
        let d = '';
        for (let i = 0; i < smooth.length; i++) {
          d += (i ? 'L' : 'M') + smooth[i][0].toFixed(2) + ' ' + smooth[i][1].toFixed(2);
        }
        if (closed) d += 'Z';
        lines.push({d, index: Math.round(level / interval) % 4 === 0});
      }
    }
    return lines;
  }

  function buildMap(eight, toWorld, sampleHeight, island) {
    const panel = document.querySelector('#atlas-panel');
    const svg = document.querySelector('#atlas-svg');
    const rootEl = document.querySelector('#atlas');
    const pin = document.querySelector('#atlas-pin');
    const openBtn = document.querySelector('#atlas-open');
    const NS = 'http://www.w3.org/2000/svg';
    const view = 216;
    const anchorX = eight.x;
    const anchorZ = eight.z;
    const margin = 16;
    const fitReach = Math.max(island.reach, Math.hypot(anchorX, anchorZ));
    const baseScale = (view / 2 - margin) / fitReach;
    const el = (name, attrs) => {
      const node = document.createElementNS(NS, name);
      for (const key of Object.keys(attrs)) node.setAttribute(key, attrs[key]);
      return node;
    };

    svg.replaceChildren();
    const defs = el('defs', {});
    const grad = el('radialGradient', {id: 'contour-soft', cx: '50%', cy: '50%', r: '52%'});
    grad.appendChild(el('stop', {offset: '34%', 'stop-color': '#fff', 'stop-opacity': '1'}));
    grad.appendChild(el('stop', {offset: '62%', 'stop-color': '#fff', 'stop-opacity': '0.55'}));
    grad.appendChild(el('stop', {offset: '84%', 'stop-color': '#fff', 'stop-opacity': '0.22'}));
    grad.appendChild(el('stop', {offset: '100%', 'stop-color': '#fff', 'stop-opacity': '0.04'}));
    defs.appendChild(grad);
    const mask = el('mask', {id: 'contour-fade', maskContentUnits: 'objectBoundingBox'});
    mask.appendChild(el('rect', {x: '0', y: '0', width: '1', height: '1', fill: 'url(#contour-soft)'}));
    defs.appendChild(mask);
    svg.appendChild(defs);
    const relief = el('g', {id: 'atlas-relief'});
    svg.appendChild(relief);
    relief.appendChild(el('path', {class: 'island', d: island.outline, 'vector-effect': 'non-scaling-stroke'}));
    for (const d of island.lakes) relief.appendChild(el('path', {class: 'lake', d, 'vector-effect': 'non-scaling-stroke'}));
    const contours = el('g', {mask: 'url(#contour-fade)'});
    relief.appendChild(contours);
    const half = Math.ceil(island.reach);
    for (const line of traceContours(sampleHeight, anchorX, anchorZ, half, 2.4, 1.05)) {
      contours.appendChild(el('path', {class: line.index ? 'contour index' : 'contour', d: line.d, 'vector-effect': 'non-scaling-stroke'}));
    }
    const marks = el('g', {id: 'atlas-sites'});
    for (const site of island.sites) {
      const text = el('text', {class: 'work-num'});
      text.textContent = String(site.id);
      marks.appendChild(text);
    }
    svg.appendChild(marks);
    const you = el('g', {id: 'atlas-you'});
    you.appendChild(el('circle', {class: 'you-core', cx: '0', cy: '0', r: '7'}));
    you.appendChild(el('circle', {class: 'you-layer you-layer-a', cx: '0', cy: '0', r: '14'}));
    you.appendChild(el('circle', {class: 'you-layer you-layer-b', cx: '0', cy: '0', r: '22'}));
    you.appendChild(el('circle', {class: 'you-layer you-layer-c', cx: '0', cy: '0', r: '32'}));
    const arrow = el('polygon', {class: 'you-arrow', points: '0,-16 3.1,-6.2 -3.1,-6.2'});
    you.appendChild(arrow);
    svg.appendChild(you);
    svg.addEventListener('click', event => {
      const rect = svg.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const px = (event.clientX - rect.left) / rect.width * view;
      const py = (event.clientY - rect.top) / rect.height * view;
      const scale = landScale > 0 ? landScale : baseScale;
      const x = anchorX + (px - view / 2) / scale;
      const z = anchorZ + (py - view / 2) / scale;
      if (typeof root.STUDIO_TRAVEL === 'function') root.STUDIO_TRAVEL(x, z);
    });

    let landScale = -1;
    function placeRelief(scale) {
      relief.setAttribute('transform', `translate(${view / 2} ${view / 2}) scale(${scale})`);
      landScale = scale;
    }
    function paint(latest) {
      const dx = latest.x - anchorX;
      const dz = latest.z - anchorZ;
      const reach = Math.hypot(dx, dz);
      const limit = view / 2 - margin;
      const scale = reach * baseScale <= limit ? baseScale : limit / Math.max(reach, 0.001);
      if (Math.abs(scale - landScale) > 0.0001) placeRelief(scale);
      you.setAttribute('transform', `translate(${(view / 2 + dx * scale).toFixed(2)} ${(view / 2 + dz * scale).toFixed(2)})`);
      island.sites.forEach((site, index) => {
        const node = marks.children[index];
        let ox = site.x - anchorX, oz = site.z - anchorZ;
        const len = Math.hypot(ox, oz) || 1;
        const t = len / Math.max(island.reach, 1);
        const keep = 1 - Math.pow(Math.max(0, (t - 0.4) / 0.6), 1.1) * 0.28;
        ox *= keep;
        oz *= keep;
        node.setAttribute('x', (view / 2 + ox * scale).toFixed(2));
        node.setAttribute('y', (view / 2 + oz * scale).toFixed(2));
      });
      const deg = Math.atan2(latest.dirX, -latest.dirZ) * 180 / Math.PI;
      arrow.setAttribute('transform', `rotate(${deg.toFixed(2)})`);
    }
    placeRelief(baseScale);
    return {panel, svg, root: rootEl, pin, openBtn, paint};
  }

  root.createExhibition = createExhibition;
})(window);
