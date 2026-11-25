// One raised figure-eight of granite. The repeating field stays as it is;
// this mound lives in world space and is not parented to that group.
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

  function smooth(e0, e1, x) {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }
  function smoother(t) {
    t = Math.min(1, Math.max(0, t));
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function createExhibition(T, baseGround, surfaceMat, carveUniforms) {
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

    let deckA = 0, deckB = 0;
    function prepareDeck() {
      let sumA = 0, nA = 0, sumB = 0, nB = 0;
      for (let i = 0; i < 28; i++) {
        const a = i / 28 * Math.PI * 2;
        const ring = EIGHT.radius * 0.62;
        for (const sign of [1, -1]) {
          const lx = Math.cos(a) * ring;
          const lz = sign * EIGHT.gap + Math.sin(a) * ring;
          const [x, z] = toWorld(lx, lz);
          const y = baseGround(x, z);
          if (sign > 0) { sumA += y; nA++; }
          else { sumB += y; nB++; }
        }
      }
      deckA = sumA / nA;
      deckB = sumB / nB;
    }
    prepareDeck();

    function deckAt(lz) {
      const t = smooth(-EIGHT.gap, EIGHT.gap, lz);
      return deckB + (deckA - deckB) * t;
    }
    function heightAt(x, z) {
      const [lx, lz] = toLocal(x, z);
      const t = coverage(x, z);
      const base = baseGround(x, z);
      if (t <= 0) return base;
      const localTop = base + EIGHT.rise;
      const leveled = localTop + (deckAt(lz) + EIGHT.rise - localTop) * 0.42;
      const top = Math.min(Math.max(leveled, base + EIGHT.rise * 0.9), base + EIGHT.rise * 1.22);
      return base + (top - base) * t;
    }
    function sample(x, z, normal) {
      const h = heightAt(x, z);
      if (normal) {
        const e = 0.16;
        normal.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
      }
      return h;
    }

    const spanX = outer + SKIRT;
    const spanZ = EIGHT.gap + outer + SKIRT;
    const step = 0.4;
    const cols = Math.ceil(spanX * 2 / step) + 1;
    const rows = Math.ceil(spanZ * 2 / step) + 1;
    const positions = [];
    const colors = [];
    const keep = [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let j = 0; j < rows; j++) {
      const lz = -spanZ + j * (spanZ * 2) / (rows - 1);
      for (let i = 0; i < cols; i++) {
        const lx = -spanX + i * (spanX * 2) / (cols - 1);
        const [wx, wz] = toWorld(lx, lz);
        const inside = dist8(lx, lz) < outer + SKIRT;
        keep.push(inside);
        const h = heightAt(wx, wz);
        positions.push(wx, h, wz);
        const lift = Math.min(1, Math.max(0, (h - baseGround(wx, wz)) / EIGHT.rise));
        const light = 0.94 + lift * 0.06;
        colors.push(light, light * 0.995, light * 0.985);
        if (inside) {
          if (wx < minX) minX = wx;
          if (wx > maxX) maxX = wx;
          if (wz < minZ) minZ = wz;
          if (wz > maxZ) maxZ = wz;
        }
      }
    }
    const indices = [];
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = j * cols + i;
        if (!(keep[a] || keep[a + 1] || keep[a + cols] || keep[a + cols + 1])) continue;
        indices.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
      }
    }

    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const nrm = geometry.attributes.normal;
    const col = geometry.attributes.color;
    for (let i = 0; i < nrm.count; i++) {
      const shade = 0.86 + 0.14 * Math.max(0, nrm.getY(i));
      col.setXYZ(i, col.getX(i) * shade, col.getY(i) * shade, col.getZ(i) * shade);
    }
    geometry.computeBoundingSphere();
    const terrain = new T.Mesh(geometry, surfaceMat);
    terrain.name = 'exhibition-ground';
    terrain.receiveShadow = true;
    terrain.renderOrder = 1;

    const texW = 384, texH = 384, pad = 2;
    minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
    const sizeX = Math.max(1, maxX - minX), sizeZ = Math.max(1, maxZ - minZ);
    const mask = new Uint8Array(texW * texH * 4);
    for (let j = 0; j < texH; j++) {
      const z = minZ + (j + 0.5) / texH * sizeZ;
      for (let i = 0; i < texW; i++) {
        const x = minX + (i + 0.5) / texW * sizeX;
        const byte = Math.round(coverage(x, z) * 255);
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

    const [northX, northZ] = toWorld(0, EIGHT.gap);
    const [southX, southZ] = toWorld(0, -EIGHT.gap);
    const mounts = [
      {id: 'north', x: northX, z: northZ, y: heightAt(northX, northZ), yaw: EIGHT.rotation},
      {id: 'south', x: southX, z: southZ, y: heightAt(southX, southZ), yaw: EIGHT.rotation + Math.PI}
    ];
    EIGHT.deckA = deckA + EIGHT.rise;
    EIGHT.deckB = deckB + EIGHT.rise;
    EIGHT.mounts = mounts;

    const group = new T.Group();
    group.name = 'exhibition';
    group.add(terrain);

    const map = buildMap(EIGHT, toWorld, baseGround);
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
      sample,
      interior() { return 0; },
      constrain() {},
      armIntro(now) {
        introUntil = now + 6000;
        setOpen(true, now);
      },
      togglePin,
      sync(now, x, z, camera, engaged, hidden) {
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
        if (h < lo) lo = h;
        if (h > hi) hi = h;
      }
    }
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

  function buildMap(eight, toWorld, sampleHeight) {
    const panel = document.querySelector('#atlas-panel');
    const svg = document.querySelector('#atlas-svg');
    const rootEl = document.querySelector('#atlas');
    const pin = document.querySelector('#atlas-pin');
    const openBtn = document.querySelector('#atlas-open');
    const NS = 'http://www.w3.org/2000/svg';
    const outer = eight.radius + eight.slope * 0.42;
    const view = 216;
    const anchorX = eight.x;
    const anchorZ = eight.z;
    const margin = 36;
    const fitReach = Math.max(Math.hypot(anchorX, anchorZ), eight.gap + outer);
    const baseScale = (view / 2 - margin) / fitReach;
    const el = (name, attrs) => {
      const node = document.createElementNS(NS, name);
      for (const key of Object.keys(attrs)) node.setAttribute(key, attrs[key]);
      return node;
    };

    svg.replaceChildren();
    const defs = el('defs', {});
    const bleed = el('filter', {id: 'atlas-bleed', x: '-60%', y: '-60%', width: '220%', height: '220%'});
    bleed.appendChild(el('feGaussianBlur', {stdDeviation: '7'}));
    defs.appendChild(bleed);
    svg.appendChild(defs);

    const wash = el('g', {filter: 'url(#atlas-bleed)'});
    svg.appendChild(wash);
    wash.appendChild(el('ellipse', {class: 'wash', cx: 108, cy: 110, rx: 98, ry: 92}));

    const fade = el('radialGradient', {id: 'atlas-fade', cx: '50%', cy: '50%', r: '68%'});
    fade.appendChild(el('stop', {offset: '62%', 'stop-color': '#fff'}));
    fade.appendChild(el('stop', {offset: '100%', 'stop-color': '#fff', 'stop-opacity': '0'}));
    defs.appendChild(fade);
    const mask = el('mask', {id: 'atlas-mask', maskUnits: 'userSpaceOnUse', x: '0', y: '0', width: '216', height: '216'});
    mask.appendChild(el('rect', {x: '0', y: '0', width: '216', height: '216', fill: 'url(#atlas-fade)'}));
    defs.appendChild(mask);

    const frame = el('g', {id: 'atlas-relief', mask: 'url(#atlas-mask)'});
    const relief = el('g', {});
    frame.appendChild(relief);
    svg.appendChild(frame);
    for (const line of traceContours(sampleHeight, anchorX, anchorZ, 78, 1.35, 0.7)) {
      relief.appendChild(el('path', {class: line.index ? 'contour index' : 'contour', d: line.d, 'vector-effect': 'non-scaling-stroke'}));
    }
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
      const deg = Math.atan2(latest.dirX, -latest.dirZ) * 180 / Math.PI;
      arrow.setAttribute('transform', `rotate(${deg.toFixed(2)})`);
    }
    placeRelief(baseScale);
    return {panel, svg, root: rootEl, pin, openBtn, paint};
  }

  root.createExhibition = createExhibition;
})(window);
