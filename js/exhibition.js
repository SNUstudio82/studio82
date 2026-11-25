// Fixed exhibition halls. The repeating granite tiles stay periodic;
// these cuts live in world space and are not parented to that group.
(function (root) {
  'use strict';

  const HALLS = [
    {id:'hall-01', number:'01', x:18, z:2, rotation:4.800, halfW:4.15, halfL:3.25, rim:1.85, ramp:8.2, depth:2.35, mouth:3.05, kind:'wall', color:'#b57268'},
    {id:'hall-02', number:'02', x:40, z:2, rotation:5.149, halfW:3.55, halfL:3.95, rim:2.05, ramp:7.5, depth:2.55, mouth:2.75, kind:'frame', color:'#6f948c'},
    {id:'hall-03', number:'03', x:28, z:30, rotation:2.007, halfW:4.45, halfL:3.15, rim:1.9, ramp:8.6, depth:2.45, mouth:3.25, kind:'ledge', color:'#b3965c'},
    {id:'hall-04', number:'04', x:-4, z:36, rotation:2.269, halfW:3.75, halfL:3.55, rim:1.8, ramp:8.0, depth:2.4, mouth:2.95, kind:'wall', color:'#7d86a3'},
    {id:'hall-05', number:'05', x:-30, z:14, rotation:1.658, halfW:3.95, halfL:3.35, rim:2.0, ramp:11.2, depth:2.35, mouth:2.85, kind:'frame', color:'#8a7e9a'},
    {id:'hall-06', number:'06', x:-20, z:-4, rotation:1.134, halfW:3.65, halfL:4.05, rim:1.95, ramp:8.4, depth:2.45, mouth:3.15, kind:'ledge', color:'#a6846c'},
    {id:'hall-07', number:'07', x:-16, z:-22, rotation:6.021, halfW:4.25, halfL:3.05, rim:1.75, ramp:9.4, depth:2.45, mouth:2.95, kind:'wall', color:'#6e8f78'},
    {id:'hall-08', number:'08', x:-2, z:-38, rotation:5.323, halfW:3.85, halfL:3.45, rim:2.1, ramp:10.5, depth:2.4, mouth:2.8, kind:'frame', color:'#c08a78'},
    {id:'hall-09', number:'09', x:24, z:-24, rotation:0.175, halfW:4.35, halfL:3.35, rim:1.85, ramp:8.3, depth:2.3, mouth:3.2, kind:'ledge', color:'#8d8474'},
    {id:'hall-10', number:'10', x:-24, z:42, rotation:2.356, halfW:3.45, halfL:3.75, rim:2.0, ramp:7.4, depth:2.5, mouth:2.65, kind:'wall', color:'#6f8fa4'}
  ];

  const SKIRT = 1.2;

  function smooth(e0, e1, x) {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }
  function smoother(t) {
    t = Math.min(1, Math.max(0, t));
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  function cornerOf(hall) {
    return Math.min(1.2, hall.halfW * 0.38, hall.halfL * 0.38);
  }
  function toLocal(hall, x, z) {
    const dx = x - hall.x, dz = z - hall.z;
    return [dx * hall.cos - dz * hall.sin, dx * hall.sin + dz * hall.cos];
  }
  function toWorld(hall, lx, lz) {
    return [hall.x + lx * hall.cos + lz * hall.sin, hall.z - lx * hall.sin + lz * hall.cos];
  }
  function sdf(hall, lx, lz) {
    const corner = hall.corner;
    const hx = hall.halfW - corner, hy = hall.halfL - corner;
    const qx = Math.abs(lx) - hx, qy = Math.abs(lz) - hy;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - corner;
  }
  function slopeWidth(hall, lx, lz) {
    const front = smooth(-0.05, 0.72, lz / hall.halfL);
    const mouth = 1 - smooth(hall.mouth * 0.28, hall.mouth * 0.86, Math.abs(lx));
    return hall.rim + (hall.ramp - hall.rim) * front * mouth;
  }
  function influence(hall, lx, lz) {
    const d = sdf(hall, lx, lz);
    const sw = slopeWidth(hall, lx, lz);
    if (d >= sw) return 0;
    if (d <= 0) return 1;
    return 1 - smoother(d / sw);
  }

  function createExhibition(T, baseGround, pitMat, carveUniforms) {
    for (const hall of HALLS) {
      hall.cos = Math.cos(hall.rotation);
      hall.sin = Math.sin(hall.rotation);
      hall.corner = cornerOf(hall);
      hall.floor = {width: hall.halfW * 2, length: hall.halfL * 2};
    }

    function prepareFloors() {
      for (const hall of HALLS) {
        let sum = 0, n = 0;
        for (let i = 0; i < 40; i++) {
          const a = i / 40 * Math.PI * 2;
          let lx = 0, lz = 0;
          for (let rad = 0.4; rad < 36; rad += 0.3) {
            lx = Math.cos(a) * rad;
            lz = Math.sin(a) * rad;
            if (sdf(hall, lx, lz) >= slopeWidth(hall, lx, lz)) break;
          }
          const [wx, wz] = toWorld(hall, lx, lz);
          sum += baseGround(wx, wz);
          n++;
        }
        hall.floorY = sum / n - hall.depth;
        hall.floor.y = hall.floorY;
      }
    }
    prepareFloors();

    const hit = {hall: null, influence: 0};
    function probe(x, z) {
      hit.hall = null;
      hit.influence = 0;
      for (let i = 0; i < HALLS.length; i++) {
        const hall = HALLS[i];
        if (x < hall.minX || x > hall.maxX || z < hall.minZ || z > hall.maxZ) continue;
        const [lx, lz] = toLocal(hall, x, z);
        const inf = influence(hall, lx, lz);
        if (inf > hit.influence) {
          hit.hall = hall;
          hit.influence = inf;
        }
      }
      return hit.influence > 0 ? hit : null;
    }
    function heightAt(x, z) {
      const found = probe(x, z);
      const base = baseGround(x, z);
      if (!found) return base;
      return found.hall.floorY + (base - found.hall.floorY) * (1 - found.influence);
    }
    function sample(x, z, normal) {
      const found = probe(x, z);
      if (!found) return baseGround(x, z, normal);
      const base = baseGround(x, z);
      const h = found.hall.floorY + (base - found.hall.floorY) * (1 - found.influence);
      if (normal) {
        const e = 0.14;
        normal.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
      }
      return h;
    }

    const positions = [];
    const colors = [];
    const indices = [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    for (const hall of HALLS) {
      const spanX = hall.halfW + hall.rim + SKIRT;
      const spanBack = hall.halfL + hall.rim + SKIRT;
      const spanFront = hall.halfL + hall.ramp + SKIRT;
      const step = 0.26;
      const cols = Math.ceil(spanX * 2 / step) + 1;
      const rows = Math.ceil((spanBack + spanFront) / step) + 1;
      const origin = positions.length / 3;
      const keep = [];
      for (let j = 0; j < rows; j++) {
        const lz = -spanBack + j * (spanBack + spanFront) / (rows - 1);
        for (let i = 0; i < cols; i++) {
          const lx = -spanX + i * (spanX * 2) / (cols - 1);
          const [wx, wz] = toWorld(hall, lx, lz);
          const d = sdf(hall, lx, lz);
          const sw = slopeWidth(hall, lx, lz);
          const inside = d < sw + SKIRT;
          keep.push(inside);
          const h = heightAt(wx, wz);
          positions.push(wx, h, wz);
          const drop = Math.min(1, Math.max(0, (baseGround(wx, wz) - h) / 1.35));
          const light = 1 - drop * 0.05;
          colors.push(light, light * 0.995, light * 0.985);
          if (wx < minX) minX = wx;
          if (wx > maxX) maxX = wx;
          if (wz < minZ) minZ = wz;
          if (wz > maxZ) maxZ = wz;
        }
      }
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = j * cols + i;
          if (!(keep[a] || keep[a + 1] || keep[a + cols] || keep[a + cols + 1])) continue;
          const o = origin + a;
          indices.push(o, o + cols, o + 1, o + 1, o + cols, o + cols + 1);
        }
      }
      hall.minX = hall.x - (spanX + spanFront);
      hall.maxX = hall.x + (spanX + spanFront);
      hall.minZ = hall.z - (spanX + spanFront);
      hall.maxZ = hall.z + (spanX + spanFront);
    }

    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const nrm = geometry.attributes.normal;
    const col = geometry.attributes.color;
    for (let i = 0; i < nrm.count; i++) {
      const shade = 0.84 + 0.16 * Math.max(0, nrm.getY(i));
      col.setXYZ(i, col.getX(i) * shade, col.getY(i) * shade, col.getZ(i) * shade);
    }
    geometry.computeBoundingSphere();
    const terrain = new T.Mesh(geometry, pitMat);
    terrain.name = 'exhibition-ground';
    terrain.receiveShadow = true;
    terrain.frustumCulled = true;

    const texW = 480, texH = 480;
    const pad = 3;
    minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
    const sizeX = Math.max(1, maxX - minX), sizeZ = Math.max(1, maxZ - minZ);
    const mask = new Uint8Array(texW * texH * 4);
    for (let j = 0; j < texH; j++) {
      const z = minZ + (j + 0.5) / texH * sizeZ;
      for (let i = 0; i < texW; i++) {
        const x = minX + (i + 0.5) / texW * sizeX;
        const found = probe(x, z);
        const byte = found ? Math.round(found.influence * 255) : 0;
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

    const group = new T.Group();
    group.name = 'exhibition';
    group.add(terrain);

    const propMat = new T.MeshStandardMaterial({color: 0xc4beb4, roughness: 0.93, metalness: 0, envMapIntensity: 0.1});
    const inkMat = new T.MeshStandardMaterial({color: 0x2c2926, roughness: 0.6, metalness: 0.04, envMapIntensity: 0.18});
    const box = new T.BoxGeometry(1, 1, 1);
    const plateGeo = new T.PlaneGeometry(0.46, 0.3);
    const colliders = [];
      const axisX = new T.Vector3();
    const axisY = new T.Vector3(0, 1, 0);
    const axisZ = new T.Vector3();

    function place(mesh, hall, lx, lz, y, sx, sy, sz) {
      const [wx, wz] = toWorld(hall, lx, lz);
      axisX.set(hall.cos * sx, 0, -hall.sin * sx);
      axisY.set(0, sy, 0);
      axisZ.set(hall.sin * sz, 0, hall.cos * sz);
      mesh.matrix.makeBasis(axisX, axisY, axisZ);
      mesh.matrix.setPosition(wx, y, wz);
      mesh.matrixAutoUpdate = false;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      group.add(mesh);
    }
    function addCollider(hall, lx, lz, hx, hz, top) {
      const [wx, wz] = toWorld(hall, lx, lz);
      colliders.push({x: wx, z: wz, hx, hz, cos: hall.cos, sin: hall.sin, top});
    }
    function numberTexture(label) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#d7d1c6';
      ctx.fillRect(0, 0, 256, 160);
      ctx.fillStyle = '#241f1c';
      ctx.font = '600 92px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 128, 84);
      const tex = new T.CanvasTexture(canvas);
      tex.colorSpace = T.SRGBColorSpace;
      tex.anisotropy = 4;
      return tex;
    }

    for (const hall of HALLS) {
      const floor = hall.floorY;
      if (hall.kind === 'wall') {
        const w = Math.min(hall.halfW * 1.5, hall.halfW * 2 - 1.3);
        const h = 1.16, t = 0.14;
        const lz = -(hall.halfL - 0.78);
        const mesh = new T.Mesh(box, propMat);
        place(mesh, hall, 0, lz, floor + h / 2, w, h, t);
        addCollider(hall, 0, lz, w / 2, t / 2, floor + h);
        const [mx, mz] = toWorld(hall, 0, lz + t / 2 + 0.04);
        hall.mount = {x: mx, y: floor + h * 0.62, z: mz, yaw: hall.rotation, kind: hall.kind};
      } else if (hall.kind === 'frame') {
        const w = 1.12, h = 0.9, t = 0.07, b = 0.07;
        const lz = -hall.halfL * 0.36;
        const y0 = floor + h / 2;
        const parts = [
          [0, y0 + h / 2 - b / 2, w, b],
          [0, y0 - h / 2 + b / 2, w, b],
          [-(w / 2 - b / 2), y0, b, h - b * 2],
          [w / 2 - b / 2, y0, b, h - b * 2]
        ];
        for (const [lx, y, sx, sy] of parts) {
          const mesh = new T.Mesh(box, inkMat);
          place(mesh, hall, lx, lz, y, sx, sy, t);
        }
        addCollider(hall, 0, lz, w / 2, t / 2 + 0.02, floor + h);
        const [mx, mz] = toWorld(hall, 0, lz + t / 2 + 0.03);
        hall.mount = {x: mx, y: floor + h * 0.5, z: mz, yaw: hall.rotation, kind: hall.kind};
      } else {
        const w = Math.min(1.7, hall.halfW * 1.15);
        const lz = -(hall.halfL - 0.98);
        const plinth = new T.Mesh(box, propMat);
        place(plinth, hall, 0, lz, floor + 0.08, w, 0.16, 0.5);
        const back = new T.Mesh(box, propMat);
        place(back, hall, 0, lz - 0.22, floor + 0.16 + 0.36, w, 0.72, 0.07);
        addCollider(hall, 0, lz, w / 2, 0.25, floor + 0.16);
        addCollider(hall, 0, lz - 0.22, w / 2, 0.04, floor + 0.88);
        const [mx, mz] = toWorld(hall, 0, lz);
        hall.mount = {x: mx, y: floor + 0.16, z: mz, yaw: hall.rotation, kind: hall.kind};
      }
      const plate = new T.Mesh(plateGeo, new T.MeshStandardMaterial({
        map: numberTexture(hall.number), roughness: 0.84, metalness: 0, side: T.DoubleSide
      }));
      const lx = hall.halfW * 0.56;
      const [px, pz] = toWorld(hall, lx, 0.1);
      axisX.set(hall.sin, 0, hall.cos);
      axisY.set(0, 1, 0);
      axisZ.set(-hall.cos, 0, hall.sin);
      plate.matrix.makeBasis(axisX, axisY, axisZ);
      plate.matrix.setPosition(px, floor + 0.17, pz);
      plate.matrixAutoUpdate = false;
      plate.receiveShadow = true;
      plate.name = hall.id + '-mark';
      group.add(plate);
      addCollider(hall, lx, 0.1, 0.04, 0.24, floor + 0.34);
    }
    group.updateMatrixWorld(true);

    const map = buildMap(HALLS, heightAt);
    map.panel.inert = true;
    map.panel.setAttribute('aria-hidden', 'true');
    let pinned = false, pointerInside = false, pointerDown = false, focused = false;
    let introUntil = 0, idleUntil = 0, open = false, lastDraw = -Infinity, skipPaint = true;
    let wasEngaged = false, current = null;
    const latest = {x: 0, z: 0, dirX: 0, dirZ: -1};
    const heading = new T.Vector3();

    function stayOpen(now) {
      return pinned || pointerInside || pointerDown || focused || now < introUntil || now < idleUntil;
    }
    function setOpen(next, now) {
      if (open === next) {
        if (next) map.paint(latest, current, true);
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
        map.paint(latest, current, true);
        lastDraw = now;
      }
    }
    function paintIfDue(now, force) {
      if (!open) return;
      if (skipPaint && !force) return;
      if (!force && now - lastDraw < 80) return;
      lastDraw = now;
      skipPaint = false;
      const next = occupied(latest.x, latest.z);
      if (current) {
        const [lx, lz] = toLocal(current, latest.x, latest.z);
        const still = influence(current, lx, lz);
        if (still < 0.2) current = next && next.influence > 0.62 ? next.hall : null;
      } else if (next && next.influence > 0.62) current = next.hall;
      map.paint(latest, current, false);
    }
    function occupied(x, z) {
      let hall = null, inf = 0;
      for (const item of HALLS) {
        if (x < item.minX || x > item.maxX || z < item.minZ || z > item.maxZ) continue;
        const [lx, lz] = toLocal(item, x, z);
        const value = influence(item, lx, lz);
        if (value > inf) { inf = value; hall = item; }
      }
      return hall ? {hall, influence: inf} : null;
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

    root.STUDIO_EXHIBITION = {halls: HALLS};

    return {
      group,
      halls: HALLS,
      sample,
      interior(x, z) {
        const found = probe(x, z);
        if (!found) return 0;
        return smooth(0.28, 0.78, found.influence);
      },
      constrain(pos, bodyY) {
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 0; i < colliders.length; i++) {
            const box = colliders[i];
            if (bodyY > box.top) continue;
            const dx = pos.x - box.x, dz = pos.z - box.z;
            const lx = dx * box.cos - dz * box.sin;
            const lz = dx * box.sin + dz * box.cos;
            const px = box.hx + 0.22, pz = box.hz + 0.22;
            const ax = Math.abs(lx), az = Math.abs(lz);
            if (ax > px || az > pz) continue;
            if (px - ax < pz - az) {
              const nlx = (lx < 0 ? -1 : 1) * px;
              const dlx = nlx - lx;
              pos.x += dlx * box.cos;
              pos.z -= dlx * box.sin;
            } else {
              const nlz = (lz < 0 ? -1 : 1) * pz;
              const dlz = nlz - lz;
              pos.x += dlz * box.sin;
              pos.z += dlz * box.cos;
            }
          }
        }
      },
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
        if (engaged && !wasEngaged) {
          setOpen(true, now);
          idleUntil = 0;
        }
        if (!engaged && wasEngaged) idleUntil = now + 3000;
        wasEngaged = engaged;
        if (open && !stayOpen(now)) setOpen(false, now);
        if (hidden) { skipPaint = true; return; }
        paintIfDue(now, false);
      }
    };
  }

  function buildMap(halls, heightAt) {
    const panel = document.querySelector('#atlas-panel');
    const svg = document.querySelector('#atlas-svg');
    const rootEl = document.querySelector('#atlas');
    const pin = document.querySelector('#atlas-pin');
    const openBtn = document.querySelector('#atlas-open');
    const NS = 'http://www.w3.org/2000/svg';
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const hall of halls) {
      const reach = Math.max(hall.halfW + hall.rim, hall.halfL + hall.ramp) + 6;
      minX = Math.min(minX, hall.x - reach);
      maxX = Math.max(maxX, hall.x + reach);
      minZ = Math.min(minZ, hall.z - reach);
      maxZ = Math.max(maxZ, hall.z + reach);
    }
    const worldW = maxX - minX, worldH = maxZ - minZ;
    const view = 216, pad = 28, inner = view - pad * 2;
    const scale = inner / Math.max(worldW, worldH);
    const offX = pad + (inner - worldW * scale) / 2;
    const offY = pad + (inner - worldH * scale) / 2;
    const project = (x, z) => [offX + (x - minX) * scale, offY + (z - minZ) * scale];
    const el = (name, attrs) => {
      const node = document.createElementNS(NS, name);
      for (const key of Object.keys(attrs)) node.setAttribute(key, attrs[key]);
      return node;
    };

    svg.appendChild(el('rect', {class: 'sheet-back', x: '8', y: '12', width: '198', height: '198', rx: '46'}));
    svg.appendChild(el('rect', {class: 'sheet', x: '6', y: '6', width: '204', height: '204', rx: '48'}));

    const contours = el('g', {class: 'contours'});
    svg.appendChild(contours);
    const cols = 64, rows = 64;
    const grid = new Float32Array(cols * rows);
    let low = Infinity, high = -Infinity;
    for (let j = 0; j < rows; j++) {
      const z = minZ + j / (rows - 1) * worldH;
      for (let i = 0; i < cols; i++) {
        const x = minX + i / (cols - 1) * worldW;
        const height = heightAt(x, z);
        grid[j * cols + i] = height;
        if (height < low) low = height;
        if (height > high) high = height;
      }
    }
    const levels = [0.32, 0.46, 0.6, 0.74].map(t => low + (high - low) * t);
    for (const level of levels) contours.appendChild(el('path', {class: 'contour', d: march(grid, cols, rows, level, project, minX, minZ, worldW, worldH)}));

    const layer = el('g', {class: 'halls'});
    svg.appendChild(layer);
    const hallNodes = new Map();
    for (const hall of halls) {
      const [cx, cy] = project(hall.x, hall.z);
      const deg = Math.atan2(-hall.sin, hall.cos) * 180 / Math.PI;
      const group = el('g', {
        id: hall.id + '-mark',
        class: 'hall',
        transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${deg.toFixed(2)})`
      });
      group.style.setProperty('--c', hall.color);
      const rx = (hall.halfW + hall.rim * 0.55) * scale;
      const ry = (hall.halfL + hall.rim * 0.4) * scale;
      const frx = hall.halfW * scale;
      const fry = hall.halfL * scale;
      group.appendChild(el('ellipse', {class: 'pit', cx: '0', cy: '0', rx: rx.toFixed(2), ry: ry.toFixed(2)}));
      group.appendChild(el('ellipse', {class: 'floor', cx: '0', cy: '0', rx: frx.toFixed(2), ry: fry.toFixed(2)}));
      group.appendChild(el('line', {
        class: 'entry',
        x1: '0', y1: fry.toFixed(2),
        x2: '0', y2: (fry + Math.min(hall.ramp * scale, 14)).toFixed(2)
      }));
      group.appendChild(el('circle', {class: 'dot', cx: '0', cy: '0', r: '3.3'}));
      const text = el('text', {class: 'num', x: '6.2', y: '2.6'});
      text.textContent = hall.number;
      group.appendChild(text);
      layer.appendChild(group);
      hallNodes.set(hall, group);
    }

    const you = el('g', {id: 'atlas-you'});
    const arrow = el('polygon', {class: 'you-arrow', points: '0,-11 3.2,-4.4 -3.2,-4.4'});
    you.appendChild(arrow);
    you.appendChild(el('circle', {class: 'you-ring', cx: '0', cy: '0', r: '5.3'}));
    you.appendChild(el('circle', {class: 'you-core', cx: '0', cy: '0', r: '3.15'}));
    svg.appendChild(you);
    const outside = el('text', {class: 'out-label', x: '18', y: '200', visibility: 'hidden'});
    outside.textContent = '구역 밖';
    svg.appendChild(outside);

    const bounds = {
      minX: offX, maxX: offX + worldW * scale,
      minY: offY, maxY: offY + worldH * scale
    };
    let shown = null;

    function paint(latest, current, force) {
      if (shown !== current || force) {
        if (shown) hallNodes.get(shown).classList.remove('is-current');
        if (current) hallNodes.get(current).classList.add('is-current');
        shown = current;
      }
      let [px, py] = project(latest.x, latest.z);
      const outsideMap = px < bounds.minX || px > bounds.maxX || py < bounds.minY || py > bounds.maxY;
      px = Math.min(bounds.maxX - 4, Math.max(bounds.minX + 4, px));
      py = Math.min(bounds.maxY - 4, Math.max(bounds.minY + 4, py));
      you.setAttribute('transform', `translate(${px.toFixed(2)} ${py.toFixed(2)})`);
      const deg = Math.atan2(latest.dirX, -latest.dirZ) * 180 / Math.PI;
      arrow.setAttribute('transform', `rotate(${deg.toFixed(2)})`);
      outside.setAttribute('visibility', outsideMap ? 'visible' : 'hidden');
    }

    return {panel, svg, root: rootEl, pin, openBtn, paint};
  }

  function march(grid, cols, rows, level, project, minX, minZ, worldW, worldH) {
    const dx = worldW / (cols - 1), dz = worldH / (rows - 1);
    const hAt = (i, j) => grid[j * cols + i];
    const edgePoint = (edge, i, j) => {
      const x0 = minX + i * dx, z0 = minZ + j * dz;
      const mix = (a, b) => {
        const d = b - a;
        const t = Math.abs(d) < 1e-6 ? 0.5 : (level - a) / d;
        return Math.min(1, Math.max(0, t));
      };
      let x, z;
      if (edge === 0) { const t = mix(hAt(i, j), hAt(i + 1, j)); x = x0 + dx * t; z = z0; }
      else if (edge === 1) { const t = mix(hAt(i + 1, j), hAt(i + 1, j + 1)); x = x0 + dx; z = z0 + dz * t; }
      else if (edge === 2) { const t = mix(hAt(i, j + 1), hAt(i + 1, j + 1)); x = x0 + dx * t; z = z0 + dz; }
      else { const t = mix(hAt(i, j), hAt(i, j + 1)); x = x0; z = z0 + dz * t; }
      const [px, py] = project(x, z);
      return px.toFixed(2) + ' ' + py.toFixed(2);
    };
    const pairs = {
      1: [0, 3], 2: [0, 1], 3: [1, 3], 4: [1, 2], 6: [0, 2], 7: [2, 3],
      8: [2, 3], 9: [0, 2], 11: [1, 2], 12: [1, 3], 13: [0, 1], 14: [0, 3]
    };
    let d = '';
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        let code = 0;
        if (hAt(i, j) > level) code |= 1;
        if (hAt(i + 1, j) > level) code |= 2;
        if (hAt(i + 1, j + 1) > level) code |= 4;
        if (hAt(i, j + 1) > level) code |= 8;
        if (code === 0 || code === 15) continue;
        const add = (a, b) => { d += `M${edgePoint(a, i, j)}L${edgePoint(b, i, j)}`; };
        if (code === 5) { add(0, 3); add(1, 2); continue; }
        if (code === 10) { add(0, 1); add(2, 3); continue; }
        const pair = pairs[code];
        if (pair) add(pair[0], pair[1]);
      }
    }
    return d;
  }

  root.createExhibition = createExhibition;
})(window);
