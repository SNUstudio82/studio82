// The wood-and-steel column at exhibition 11. The file is a plain
// static glTF binary: four meshes, four JPEG maps, no animation.
(function (root) {
  'use strict';

  function chunk(view, start) {
    const length = view.getUint32(start, true);
    const type = String.fromCharCode(view.getUint8(start + 4), view.getUint8(start + 5), view.getUint8(start + 6), view.getUint8(start + 7));
    return {length, type, data: start + 8};
  }

  function attribute(T, bin, json, index, itemSize, arrayType) {
    const accessor = json.accessors[index];
    const bufferView = json.bufferViews[accessor.bufferView];
    const start = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    const bytes = accessor.count * itemSize * arrayType.BYTES_PER_ELEMENT;
    const copy = new Uint8Array(bytes);
    copy.set(bin.subarray(start, start + bytes));
    return new T.BufferAttribute(new arrayType(copy.buffer), itemSize);
  }

  function texture(T, bin, json, index) {
    const source = json.images[json.textures[index].source];
    const bufferView = json.bufferViews[source.bufferView];
    const start = bufferView.byteOffset || 0;
    const bytes = bin.subarray(start, start + bufferView.byteLength);
    const blob = new Blob([bytes], {type: source.mimeType || 'image/jpeg'});
    const url = URL.createObjectURL(blob);
    const map = new T.TextureLoader().load(url, () => URL.revokeObjectURL(url));
    map.colorSpace = T.SRGBColorSpace;
    map.flipY = false;
    map.wrapS = map.wrapT = T.MirroredRepeatWrapping;
    map.magFilter = T.LinearFilter;
    map.minFilter = T.LinearMipmapLinearFilter;
    return map;
  }

  function loadSculpture(T, url) {
    return fetch(url).then(response => {
      if (!response.ok) throw new Error('sculpture ' + response.status);
      return response.arrayBuffer();
    }).then(buffer => {
      const view = new DataView(buffer);
      const jsonChunk = chunk(view, 12);
      const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, jsonChunk.data, jsonChunk.length)));
      const binChunk = chunk(view, jsonChunk.data + jsonChunk.length);
      const bin = new Uint8Array(buffer, binChunk.data, binChunk.length);
      const group = new T.Group();
      group.name = 'wood-steel';
      json.nodes.forEach(node => {
        const primitive = json.meshes[node.mesh].primitives[0];
        const geometry = new T.BufferGeometry();
        geometry.setAttribute('position', attribute(T, bin, json, primitive.attributes.POSITION, 3, Float32Array));
        geometry.setAttribute('normal', attribute(T, bin, json, primitive.attributes.NORMAL, 3, Float32Array));
        geometry.setAttribute('uv', attribute(T, bin, json, primitive.attributes.TEXCOORD_0, 2, Float32Array));
        geometry.setIndex(attribute(T, bin, json, primitive.indices, 1, Uint32Array));
        const pbr = json.materials[primitive.material].pbrMetallicRoughness || {};
        const material = new T.MeshStandardMaterial({
          map: texture(T, bin, json, pbr.baseColorTexture.index),
          roughness: pbr.roughnessFactor == null ? 1 : pbr.roughnessFactor,
          metalness: pbr.metallicFactor == null ? 1 : pbr.metallicFactor
        });
        const mesh = new T.Mesh(geometry, material);
        mesh.name = node.name || 'wood-steel-part';
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      });
      const SCALE = 4 * Math.cbrt(4);
      group.scale.setScalar(SCALE);
      const fitted = new T.Box3().setFromObject(group);
      group.position.y -= fitted.min.y;
      group.updateMatrixWorld(true);
      const bounds = new T.Box3().setFromObject(group);
      const worldSize = bounds.getSize(new T.Vector3());
      const shell = new T.Mesh(new T.BoxGeometry(worldSize.x / SCALE, worldSize.y / SCALE, worldSize.z / SCALE));
      shell.name = 'wood-steel-shell';
      shell.visible = false;
      shell.raycast = function () {};
      shell.position.copy(bounds.getCenter(new T.Vector3()).applyMatrix4(group.matrixWorld.clone().invert()));
      group.add(shell);
      group.userData.height = worldSize.y;
      return group;
    });
  }

  function makeCling(T, model) {
    const shell = model.getObjectByName('wood-steel-shell');
    shell.updateWorldMatrix(true, true);
    const inv = shell.matrixWorld.clone().invert();
    const world = shell.matrixWorld;
    shell.geometry.computeBoundingBox();
    const min = shell.geometry.boundingBox.min;
    const max = shell.geometry.boundingBox.max;
    const scale = shell.getWorldScale(new T.Vector3()).x;
    const normals = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
    const local = new T.Vector3();
    const worldPoint = new T.Vector3();
    const worldNormal = new T.Vector3();
    const bounds = new T.Box3().setFromObject(shell);
    const center = bounds.getCenter(new T.Vector3());
    const size = bounds.getSize(new T.Vector3());
    function facePoint(face, lx, ly, lz) {
      const n = normals[face];
      const x = n[0] ? (n[0] < 0 ? min.x : max.x) : Math.max(min.x, Math.min(max.x, lx));
      const y = n[1] ? (n[1] < 0 ? min.y : max.y) : Math.max(min.y, Math.min(max.y, ly));
      const z = n[2] ? (n[2] < 0 ? min.z : max.z) : Math.max(min.z, Math.min(max.z, lz));
      const inside = (n[0] || (lx >= min.x && lx <= max.x)) && (n[1] || (ly >= min.y && ly <= max.y)) && (n[2] || (lz >= min.z && lz <= max.z));
      worldPoint.set(x, y, z).applyMatrix4(world);
      worldNormal.set(n[0], n[1], n[2]).transformDirection(world);
      return {face, x: worldPoint.x, y: worldPoint.y, z: worldPoint.z, nx: worldNormal.x, ny: worldNormal.y, nz: worldNormal.z, inside};
    }
    function project(face, px, py, pz) {
      local.set(px, py, pz).applyMatrix4(inv);
      return facePoint(face, local.x, local.y, local.z);
    }
    function nearest(px, py, pz, skip) {
      local.set(px, py, pz).applyMatrix4(inv);
      const lx = local.x, ly = local.y, lz = local.z;
      let best = null;
      for (let face = 0; face < 6; face++) {
        if (face === skip || face === 2) continue;
        const placed = facePoint(face, lx, ly, lz);
        const dist = (px - placed.x) ** 2 + (py - placed.y) ** 2 + (pz - placed.z) ** 2;
        if (!best || dist < best.dist) best = {dist, ...placed};
      }
      return best;
    }
    function pushOut(px, py, pz, clearance) {
      const skin = clearance / scale;
      local.set(px, py, pz).applyMatrix4(inv);
      const lx = local.x, ly = local.y, lz = local.z;
      if (lx < min.x - skin || lx > max.x + skin || ly < min.y - skin || ly > max.y + skin || lz < min.z - skin || lz > max.z + skin) return null;
      let best = null;
      for (let face = 0; face < 6; face++) {
        if (face === 2) continue;
        const n = normals[face];
        const coord = n[0] ? lx : n[1] ? ly : lz;
        const limit = n[0] < 0 || n[1] < 0 || n[2] < 0 ? (n[0] ? min.x : n[1] ? min.y : min.z) : (n[0] ? max.x : n[1] ? max.y : max.z);
        const outside = (n[0] + n[1] + n[2]) > 0 ? coord - limit : limit - coord;
        const push = skin - outside;
        if (push < 0) continue;
        if (!best || push < best.push) best = {push, face};
      }
      if (!best) return null;
      if (best.face === 3 && (max.y - ly) * scale > 0.8) {
        best = null;
        for (let face = 0; face < 6; face++) {
          if (face === 2 || face === 3) continue;
          const n = normals[face];
          const coord = n[0] ? lx : lz;
          const limit = n[0] < 0 || n[2] < 0 ? (n[0] ? min.x : min.z) : (n[0] ? max.x : max.z);
          const outside = (n[0] + n[2]) > 0 ? coord - limit : limit - coord;
          const push = skin - outside;
          if (push < 0) continue;
          if (!best || push < best.push) best = {push, face};
        }
        if (!best) return null;
      }
      const placed = facePoint(best.face, lx, ly, lz);
      return {
        face: placed.face,
        x: placed.x + placed.nx * clearance,
        y: placed.y + placed.ny * clearance,
        z: placed.z + placed.nz * clearance,
        nx: placed.nx, ny: placed.ny, nz: placed.nz,
        depth: best.push * scale
      };
    }
    function hit(ox, oy, oz, dx, dy, dz, maxDist) {
      const len = Math.hypot(dx, dy, dz);
      if (len < 1e-8) return null;
      const ux = dx / len, uy = dy / len, uz = dz / len;
      local.set(ox, oy, oz).applyMatrix4(inv);
      const e = inv.elements;
      const dir = [
        e[0] * ux + e[4] * uy + e[8] * uz,
        e[1] * ux + e[5] * uy + e[9] * uz,
        e[2] * ux + e[6] * uy + e[10] * uz
      ];
      const origin = [local.x, local.y, local.z];
      const bmin = [min.x, min.y, min.z], bmax = [max.x, max.y, max.z];
      let tmin = 0, tmax = maxDist, face = -1;
      for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(dir[axis]) < 1e-8) {
          if (origin[axis] < bmin[axis] || origin[axis] > bmax[axis]) return null;
          continue;
        }
        let t1 = (bmin[axis] - origin[axis]) / dir[axis];
        let t2 = (bmax[axis] - origin[axis]) / dir[axis];
        let near = axis * 2;
        if (t1 > t2) { const swap = t1; t1 = t2; t2 = swap; near = axis * 2 + 1; }
        if (t1 > tmin) { tmin = t1; face = near; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return null;
      }
      if (face < 0 || face === 2 || tmin < 0 || tmin > maxDist) return null;
      const n = normals[face];
      worldNormal.set(n[0], n[1], n[2]).transformDirection(world);
      return {dist: tmin, x: ox + ux * tmin, y: oy + uy * tmin, z: oz + uz * tmin, nx: worldNormal.x, ny: worldNormal.y, nz: worldNormal.z, face};
    }
    function wrap(px, py, pz, clearance) {
      const r = Math.max(clearance / scale, 1e-4);
      local.set(px, py, pz).applyMatrix4(inv);
      const lx = local.x, ly = local.y, lz = local.z;
      const cx = Math.max(min.x, Math.min(max.x, lx));
      const cy = Math.max(min.y, Math.min(max.y, ly));
      const cz = Math.max(min.z, Math.min(max.z, lz));
      let dx = lx - cx, dy = ly - cy, dz = lz - cz;
      let len = Math.hypot(dx, dy, dz);
      let nx, ny, nz, sx, sy, sz;
      if (len > 1e-4) {
        nx = dx / len; ny = dy / len; nz = dz / len;
        sx = cx + nx * r; sy = cy + ny * r; sz = cz + nz * r;
      } else {
        const options = [
          {d: lx - min.x, n: [-1, 0, 0]},
          {d: max.x - lx, n: [1, 0, 0]},
          {d: max.y - ly, n: [0, 1, 0]},
          {d: lz - min.z, n: [0, 0, -1]},
          {d: max.z - lz, n: [0, 0, 1]}
        ];
        let best = options[0];
        for (let i = 1; i < options.length; i++) if (options[i].d < best.d) best = options[i];
        nx = best.n[0]; ny = best.n[1]; nz = best.n[2];
        sx = (nx ? (nx < 0 ? min.x : max.x) : lx) + nx * r;
        sy = (ny ? (ny < 0 ? min.y : max.y) : ly) + ny * r;
        sz = (nz ? (nz < 0 ? min.z : max.z) : lz) + nz * r;
      }
      if (ny < -0.35 || sy < min.y - r * 0.25) return {drop: true};
      worldPoint.set(sx, sy, sz).applyMatrix4(world);
      worldNormal.set(nx, ny, nz).transformDirection(world);
      const ax = Math.abs(worldNormal.x), ay = Math.abs(worldNormal.y), az = Math.abs(worldNormal.z);
      let face = 5;
      if (ay >= ax && ay >= az) face = worldNormal.y >= 0 ? 3 : 2;
      else if (ax >= az) face = worldNormal.x >= 0 ? 1 : 0;
      else face = worldNormal.z >= 0 ? 5 : 4;
      return {drop: false, face, x: worldPoint.x, y: worldPoint.y, z: worldPoint.z, nx: worldNormal.x, ny: worldNormal.y, nz: worldNormal.z};
    }
    return {hit, project, nearest, pushOut, wrap, center, radius: size.length() * 0.5, minY: bounds.min.y};
  }



  root.StudioPreview = root.StudioPreview || {};
  root.StudioPreview.loadSculpture = loadSculpture;
  root.StudioPreview.makeCling = makeCling;
})(window);
