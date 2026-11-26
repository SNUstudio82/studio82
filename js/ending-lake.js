// The ending exhibition stays inside the north lake. Entering that water
// reveals its fish and the meeting, without leaving this world.
(function (root) {
  'use strict';

  const TINT = {
    PearlGentleWhale: 0xd5e4ea,
    PearlClownfish: 0xf0a060,
    PearlSeaTurtle: 0x7fbfa0,
    PearlBlueTang: 0x4aa0d8,
    PearlMoonJelly: 0xd5f1f6,
    PearlBetta: 0x8a78e0,
    PearlGoldfish: 0xf0b14a,
    PearlCowfish: 0xe6d27a,
    PearlYellowTang: 0xf0d15a,
    PearlButterflyFish: 0xf4f1ea,
    PearlCardinalFish: 0xe25b4a,
    PearlMoorishIdol: 0xf7f8f6,
    PearlParrotFish: 0x4cbfb0,
    PearlKoi: 0xf3f5f4,
    PearlSilkfin: 0xd7c4a8
  };

  function kindOf(name) {
    if (name === 'PearlMoonJelly') return 'jelly';
    if (name === 'PearlSeaTurtle') return 'turtle';
    if (name === 'PearlGentleWhale') return 'whale';
    return 'fish';
  }

  function decode(base64, Type) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Type(bytes.buffer);
  }

  function createEndingLake(T, options) {
    const group = options.group;
    const lakeZ = options.lakeZ;
    const lakeR = options.lakeR;
    const waterLevel = options.waterLevel;
    const anchorX = options.anchorX;
    const anchorZ = options.anchorZ;
    const waterUnder = options.waterUnder;
    const swimTime = {value: 0};
    const revealUniform = {value: 0};
    const rig = new T.Group();
    rig.name = 'ending-lake';
    rig.visible = false;
    group.add(rig);

    const shafts = [];
    for (let i = 0; i < 9; i++) {
      const angle = i / 9 * Math.PI * 2 + 0.35;
      const radius = 0.35 + (i % 4) * 0.62;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const top = 0.14 + (i % 3) * 0.04;
      const bottom = 0.62 + (i % 3) * 0.28;
      const drift = (i % 2 ? 0.42 : -0.28);
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute([
        x - top, waterLevel - 0.05, z,
        x + top, waterLevel - 0.05, z,
        x + drift - bottom, -4.55, z - drift,
        x + drift + bottom, -4.55, z + drift
      ], 3));
      geometry.setAttribute('uv', new T.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
      geometry.setIndex([0, 2, 1, 1, 2, 3]);
      const material = new T.ShaderMaterial({
        transparent: true, depthWrite: false, side: T.DoubleSide,
        blending: T.AdditiveBlending, toneMapped: false, fog: false,
        uniforms: {seaTime: swimTime, phase: {value: i * 1.37}, reveal: revealUniform},
        vertexShader: `
          varying vec2 vUv; uniform float seaTime; uniform float phase;
          void main() {
            vUv = uv;
            vec3 p = position;
            p.x += sin(seaTime * 0.6 + phase + position.y) * 0.12 * (1.0 - uv.y);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: `
          varying vec2 vUv; uniform float seaTime; uniform float phase; uniform float reveal;
          void main() {
            float width = pow(max(0.0, 1.0 - abs(vUv.x - 0.5) * 2.0), 1.65);
            float fade = smoothstep(0.0, 0.16, vUv.y) * pow(vUv.y, 0.62);
            float fine = 0.62 + 0.38 * sin(seaTime * 1.3 + vUv.y * 7.0 + phase);
            gl_FragColor = vec4(vec3(0.62, 0.86, 0.96), width * fade * fine * reveal * 0.28);
          }`
      });
      const shaft = new T.Mesh(geometry, material);
      shaft.renderOrder = 4;
      shaft.frustumCulled = false;
      rig.add(shaft);
      shafts.push(shaft);
    }

    const spot = new T.SpotLight(0xfff3dc, 0, 16, 0.62, 0.55, 1.4);
    spot.position.set(0, waterLevel - 0.12, 0);
    spot.target.position.set(0, -4.2, 0);
    rig.add(spot, spot.target);

    const dustCount = 160;
    const dust = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const a = i * 2.399;
      const r = 0.4 + (i % 10) * 0.42;
      dust[i * 3] = Math.cos(a) * r;
      dust[i * 3 + 1] = waterLevel - 0.3 - (i % 12) * 0.28;
      dust[i * 3 + 2] = Math.sin(a) * r;
    }
    const dustGeometry = new T.BufferGeometry();
    dustGeometry.setAttribute('position', new T.BufferAttribute(dust, 3));
    const dustMaterial = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: false,
      uniforms: {seaTime: swimTime, reveal: revealUniform},
      vertexShader: `
        uniform float seaTime; varying float vLight;
        void main() {
          vec3 p = position;
          p.y += sin(seaTime * 0.35 + position.x) * 0.08;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(42.0 / -mv.z, 1.0, 3.2);
          vLight = 0.45 + 0.55 * sin(position.y * 3.0 + seaTime);
        }`,
      fragmentShader: `
        varying float vLight; uniform float reveal;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float alpha = 1.0 - smoothstep(0.08, 0.5, d);
          gl_FragColor = vec4(vec3(0.62, 0.86, 0.95), alpha * vLight * reveal * 0.45);
        }`
    });
    const motes = new T.Points(dustGeometry, dustMaterial);
    motes.frustumCulled = false;
    rig.add(motes);

    const fishes = [];
    const schoolGroups = [];
    const goal = new T.Vector3();
    const scratch = new T.Vector3();
    const forward = new T.Vector3(1, 0, 0);
    const heading = new T.Vector3();
    const aim = new T.Quaternion();
    const pearl = new T.Color(0xb1d6dd);
    const tintColor = new T.Color();
    const MEET_SECONDS = 6;
    let loading = false;
    let failed = false;
    let visitor = null;
    let lastSpecies = null;
    let dwell = 0;
    let nextInvite = 0;
    let lastTime = -1;
    let hasPrev = false;
    let prevX = 0;
    let prevZ = 0;
    const mood = {ready: false};
    const underFog = new T.Color(0x1a5260);
    const underSun = new T.Color(0xd4f0f8);
    const underHemi = new T.Color(0x8ecfde);

    function deformation(kind) {
      if (kind === 'jelly') return 'float pulse=sin(swimTime*2.4+swimPhase); transformed.xz*=1.0+pulse*0.025; transformed.y+=sin(position.y*5.0-swimTime*2.4+swimPhase)*0.02;';
      if (kind === 'turtle') return 'float flipper=smoothstep(0.1,0.35,abs(position.z)); float stroke=sin(swimTime*2.2+swimPhase); transformed.y+=stroke*flipper*0.035;';
      const axis = kind === 'whale' ? 'y' : 'z';
      const amp = kind === 'whale' ? '0.055' : '0.08';
      return 'float tail=1.0-smoothstep(-0.48,0.28,position.x); float stroke=sin(swimTime*3.1-tail*1.2+swimPhase); transformed.' + axis + '+=stroke*tail*tail*' + amp + ';';
    }

    function makeInk(index) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 160;
      const ctx = canvas.getContext('2d');
      const texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      texture.generateMipmaps = false;
      const hues = [176, 198, 22, 332, 262, 152, 42];
      return {ctx, texture, hue: hues[index % hues.length], accent: hues[(index + 3) % hues.length], last: null, drawn: -1, rings: -1};
    }

    function shade(template, kind, phase, tint, fin, pattern) {
      const material = template.clone();
      tintColor.set(tint);
      material.color.copy(pearl).lerp(tintColor, kind === 'jelly' ? 0.16 : 0.24);
      material.emissive.set(0xffffff);
      material.emissiveMap = pattern;
      material.transparent = true;
      material.depthWrite = false;
      material.side = T.DoubleSide;
      material.opacity = 0;
      material.userData.baseOpacity = fin ? 0.24 : (kind === 'jelly' ? 0.32 : 0.46);
      material.userData.fin = !!fin;
      material.transmission = 0;
      material.thickness = 0;
      material.onBeforeCompile = shader => {
        shader.uniforms.swimTime = swimTime;
        shader.uniforms.swimPhase = {value: phase};
        shader.uniforms.patternMap = {value: pattern};
        shader.vertexShader = 'varying vec3 vPearlLocal; uniform float swimTime; uniform float swimPhase;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPearlLocal=position;\n' + deformation(kind));
        shader.fragmentShader = 'varying vec3 vPearlLocal; uniform sampler2D patternMap;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          vec2 pigmentUv = clamp(vPearlLocal.xy * vec2(1.05, 1.25) + vec2(0.5), vec2(0.02), vec2(0.98));
          vec4 pigment = texture2D(patternMap, pigmentUv);
          diffuseColor.rgb = mix(diffuseColor.rgb, pigment.rgb, pigment.a * 0.82);
          diffuseColor.a = max(diffuseColor.a, pigment.a * 0.28);`);
      };
      material.customProgramCacheKey = () => 'ending-glass-' + kind + (fin ? '-fin' : '');
      return material;
    }

    function build(data) {
      const models = new Map(data.models.map(model => [model.name, model]));
      const geometries = new Map();
      const bodyTemplate = new T.MeshStandardMaterial({
        color: 0xb1d6dd, roughness: 0.22, metalness: 0.02,
        transparent: true, opacity: 0.34, depthWrite: false, emissive: 0x6aa4c4, emissiveIntensity: 0.1, envMapIntensity: 0.4
      });
      const finTemplate = new T.MeshStandardMaterial({
        color: 0xc5e4ea, roughness: 0.18, metalness: 0.01,
        transparent: true, opacity: 0.18, depthWrite: false, emissive: 0x6aa4c4, emissiveIntensity: 0.08, envMapIntensity: 0.3
      });
      for (const model of data.models) {
        geometries.set(model.name, model.parts.map(part => {
          const geometry = new T.BufferGeometry();
          geometry.setAttribute('position', new T.BufferAttribute(decode(part.positions, Float32Array), 3));
          geometry.setAttribute('normal', new T.BufferAttribute(decode(part.normals, Float32Array), 3));
          if (part.uv) geometry.setAttribute('uv', new T.BufferAttribute(decode(part.uv, Float32Array), 2));
          geometry.setIndex(new T.BufferAttribute(decode(part.indices, Uint32Array), 1));
          const live = (part.groups || []).filter(item => item.count > 0);
          live.forEach((item, index) => geometry.addGroup(item.start, item.count, live.length > 1 ? item.materialIndex : 0));
          geometry.computeBoundingSphere();
          geometry.userData.fins = live.length > 1;
          return geometry;
        }));
      }
      data.spawn.forEach((name, index) => {
        const model = models.get(name);
        const geos = geometries.get(name);
        if (!model || !geos) return;
        const kind = kindOf(name);
        const tint = TINT[name] || 0xe7eef0;
        const phase = index * 1.17;
        const ink = makeInk(index);
        const materials = [];
        const visual = new T.Group();
        geos.forEach(geometry => {
          const body = shade(bodyTemplate, kind, phase, tint, false, ink.texture);
          const pieces = [body];
          if (geometry.userData.fins) pieces.push(shade(finTemplate, kind, phase, tint, true, ink.texture));
          materials.push(...pieces);
          const mesh = new T.Mesh(geometry, pieces.length > 1 ? pieces : body);
          mesh.frustumCulled = true;
          mesh.renderOrder = 5;
          visual.add(mesh);
        });
        const size = Math.max(0.42, Math.min(2.15, model.length * 1.35));
        visual.scale.setScalar(kind === 'jelly' ? size * 1.15 : size);
        const rootFish = new T.Group();
        rootFish.add(visual);
        rootFish.visible = false;
        const gid = Math.floor(index / 3);
        let school = schoolGroups[gid];
        if (!school) {
          const angle = gid * 2.399;
          const radius = 5.2 + (gid % 4) * 1.35;
          school = {
            center: new T.Vector3(Math.cos(angle) * radius, -1.7 - (gid % 3) * 0.55, lakeZ + Math.sin(angle) * radius),
            goal: new T.Vector3(), velocity: new T.Vector3(), speed: 0.22 + (gid % 4) * 0.04
          };
          school.goal.copy(school.center);
          placeGroup(school);
          schoolGroups[gid] = school;
        }
        const slot = index % 3;
        const slotAngle = slot * Math.PI * 2 / 3;
        rootFish.position.copy(school.center);
        group.add(rootFish);
        fishes.push({
          species: name, kind, phase, materials, ink, object: rootFish, school,
          position: rootFish.position, velocity: new T.Vector3(),
          offset: new T.Vector3(Math.cos(slotAngle) * 1.45, (slot - 1) * 0.22, Math.sin(slotAngle) * 1.05),
          state: 'school', cooldown: 0, meet: 0, placed: false
        });
      });
      bodyTemplate.dispose();
      finTemplate.dispose();
    }

    function ensure() {
      if (loading || failed || fishes.length) return;
      loading = true;
      fetch(options.asset('unity-sealife.json')).then(response => {
        if (!response.ok) throw new Error('sealife');
        return response.json();
      }).then(data => {
        build(data);
      }).catch(() => { failed = true; });
    }

    function clampLake() {
      const dx = goal.x, dz = goal.z - lakeZ;
      const dist = Math.hypot(dx, dz);
      const limit = lakeR * 0.72;
      if (dist > limit) {
        goal.x = dx / dist * limit;
        goal.z = lakeZ + dz / dist * limit;
      }
      goal.y = Math.min(waterLevel - 0.45, Math.max(-4.15, goal.y));
    }

    function placeGroup(school) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 4.8 + Math.random() * 5.5;
      school.goal.set(Math.cos(angle) * radius, -1.55 - Math.random() * 1.7, lakeZ + Math.sin(angle) * radius);
    }

    function schoolGoal(time, fish, bodyX, bodyZ) {
      const school = fish.school;
      goal.copy(school.center).add(fish.offset);
      goal.x += Math.sin(time * 0.15 + fish.phase) * 0.28;
      goal.y += Math.sin(time * 0.12 + fish.phase) * 0.16;
      goal.z += Math.cos(time * 0.11 + fish.phase) * 0.28;
      const dx = goal.x - bodyX, dz = goal.z - bodyZ;
      const dist = Math.hypot(dx, dz);
      if (dist < 4.4) {
        const scale = dist < 0.001 ? 4.4 : 4.4 / dist;
        goal.x = bodyX + dx * scale;
        goal.z = bodyZ + dz * scale;
      }
      clampLake();
    }

    function paintPattern(fish) {
      const ink = fish.ink;
      if (fish.meet - ink.drawn < 0.08) return;
      ink.drawn = fish.meet;
      const ctx = ink.ctx;
      const turn = fish.meet / MEET_SECONDS;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {
        const ox = 80 + Math.cos(fish.meet * 1.35 + i * 2.1 + fish.phase) * (18 + turn * 52);
        const oy = 80 + Math.sin(fish.meet * 1.8 + i + fish.phase) * (14 + turn * 48);
        ctx.fillStyle = `hsla(${i === 1 ? ink.accent : ink.hue}, 72%, 58%, 0.5)`;
        ctx.beginPath();
        ctx.arc(ox, oy, 9 + turn * 16, 0, Math.PI * 2);
        ctx.fill();
        if (i === 0 && ink.last) {
          ctx.strokeStyle = `hsla(${ink.hue}, 70%, 62%, 0.85)`;
          ctx.lineWidth = 3 + turn * 5;
          ctx.beginPath();
          ctx.moveTo(ink.last.x, ink.last.y);
          ctx.quadraticCurveTo(80, 80, ox, oy);
          ctx.stroke();
        }
        if (i === 0) ink.last = {x: ox, y: oy};
      }
      ink.texture.needsUpdate = true;
    }

    function choose(time, bodyX, bodyZ) {
      let best = null;
      let bestD = Infinity;
      for (const fish of fishes) {
        if (fish.state !== 'school' || fish.cooldown > time || fish.species === lastSpecies) continue;
        const d = (fish.position.x - bodyX) ** 2 + (fish.position.z - bodyZ) ** 2;
        if (d < bestD) { bestD = d; best = fish; }
      }
      if (best) return best;
      for (const fish of fishes) {
        if (fish.state === 'school' && fish.cooldown <= time) return fish;
      }
      return null;
    }

    function depart(fish, time) {
      fish.state = 'return';
      fish.cooldown = time + 14;
      lastSpecies = fish.species;
      if (visitor === fish) visitor = null;
      nextInvite = time + 3.2;
    }

    function capture(scene) {
      if (mood.ready || !scene || !scene.fog) return;
      mood.ready = true;
      mood.fog = scene.fog.color.clone();
      mood.density = scene.fog.density;
      scene.traverse(object => {
        if (!mood.sun && object.isDirectionalLight) mood.sun = object;
        if (!mood.hemi && object.isHemisphereLight) mood.hemi = object;
      });
      if (mood.sun) {
        mood.sunColor = mood.sun.color.clone();
        mood.sunIntensity = mood.sun.intensity;
      }
      if (mood.hemi) {
        mood.hemiColor = mood.hemi.color.clone();
        mood.hemiIntensity = mood.hemi.intensity;
      }
    }

    function gradeScene(scene, grade) {
      capture(scene);
      if (!mood.ready) return;
      scene.fog.color.copy(mood.fog).lerp(underFog, grade);
      scene.fog.density = mood.density + (0.048 - mood.density) * grade;
      if (mood.sun) {
        mood.sun.color.copy(mood.sunColor).lerp(underSun, grade);
        mood.sun.intensity = mood.sunIntensity + grade * 0.35;
      }
      if (mood.hemi) {
        mood.hemi.color.copy(mood.hemiColor).lerp(underHemi, grade);
        mood.hemi.intensity = mood.hemiIntensity + grade * 0.12;
      }
    }

    function update(time, worldX, worldZ, bodyY, camera) {
      const dt = lastTime < 0 ? 0 : Math.min(0.05, Math.max(0, time - lastTime));
      lastTime = time;
      swimTime.value = time;
      const lx = worldX - anchorX;
      const lz = worldZ - anchorZ;
      if (!hasPrev) { prevX = lx; prevZ = lz; hasPrev = true; }
      const speed = dt > 0 ? Math.hypot(lx - prevX, lz - prevZ) / dt : 0;
      prevX = lx;
      prevZ = lz;
      const dist = Math.hypot(lx, lz - lakeZ);
      const inside = 1 - T.MathUtils.smoothstep(dist, lakeR * 0.55, lakeR + 1.5);
      const depth = 1 - T.MathUtils.smoothstep(bodyY, waterLevel - 0.75, waterLevel + 0.08);
      const reveal = inside * depth;
      const scene = group.parent;
      let grade = 0;
      if (camera) {
        const camDist = Math.hypot(camera.position.x - anchorX, camera.position.z - anchorZ - lakeZ);
        const camInside = 1 - T.MathUtils.smoothstep(camDist, lakeR * 0.72, lakeR + 3);
        const camDepth = 1 - T.MathUtils.smoothstep(camera.position.y, waterLevel - 0.85, waterLevel + 0.05);
        grade = camInside * camDepth * 0.82;
      }
      gradeScene(scene, grade);
      if (waterUnder) waterUnder.value = grade;
      revealUniform.value = reveal;
      spot.intensity = reveal * 7.5;
      rig.visible = reveal > 0.02;
      rig.position.set(lx, 0, lz);
      ensure();
      if (!fishes.length || reveal < 0.02) {
        dwell = 0;
        if (visitor) {
          visitor.state = 'school';
          visitor = null;
        }
        for (const fish of fishes) fish.object.visible = false;
        return;
      }
      for (const school of schoolGroups) {
        const awayX = school.center.x - lx, awayZ = school.center.z - lz;
        const away = Math.hypot(awayX, awayZ);
        if (away < 5) {
          const scale = away < 0.2 ? 5 : 5 / away;
          school.goal.set(lx + awayX * scale, school.center.y, lz + awayZ * scale);
        } else if (school.center.distanceTo(school.goal) < 1.8) placeGroup(school);
        scratch.copy(school.goal).sub(school.center);
        const span = scratch.length() || 1;
        scratch.multiplyScalar(school.speed / span);
        school.velocity.lerp(scratch, 1 - Math.exp(-dt * 0.35));
        school.center.addScaledVector(school.velocity, dt);
      }
      if (reveal > 0.35) dwell += dt;
      else dwell = 0;
      if (!visitor && dwell > 0.7 && time >= nextInvite) {
        const pick = choose(time, lx, lz);
        if (pick) {
          visitor = pick;
          pick.state = 'approach';
          pick.meet = 0;
          dwell = 0;
        }
      }
      for (const fish of fishes) {
        const meeting = fish === visitor;
        if (meeting && fish.state === 'near') {
          fish.meet += dt;
          paintPattern(fish);
          if (fish.meet >= MEET_SECONDS) depart(fish, time);
        }
        if (fish === visitor && fish.state !== 'return') {
          const spin = time * 0.28 + fish.phase;
          goal.set(lx + Math.cos(spin) * 1.25, Math.min(waterLevel - 0.55, bodyY + 0.42), lz + Math.sin(spin) * 1.25);
          clampLake();
        } else {
          schoolGoal(time, fish, lx, lz);
          if (fish.state === 'school') {
            for (const other of fishes) {
              if (other === fish || other === visitor) continue;
              const dx = fish.position.x - other.position.x;
              const dy = fish.position.y - other.position.y;
              const dz = fish.position.z - other.position.z;
              const gap = Math.hypot(dx, dy, dz);
              if (gap > 0.001 && gap < 1.35) {
                goal.x += dx / gap * (1.35 - gap);
                goal.z += dz / gap * (1.35 - gap);
              }
            }
          }
        }
        if (!fish.placed) {
          fish.position.copy(goal);
          fish.velocity.set(0, 0, 0);
          fish.placed = true;
        }
        scratch.copy(goal).sub(fish.position);
        const length = scratch.length();
        const maxSpeed = fish.state === 'approach' ? 1.15 : fish.state === 'return' ? 0.72 : fish.state === 'near' ? 0.26 : 0.38;
        if (length > 0.001) scratch.multiplyScalar(Math.min(length, maxSpeed) / length);
        else scratch.set(0, 0, 0);
        const response = fish.state === 'school' ? 0.55 : fish.state === 'approach' ? 1.5 : 0.9;
        fish.velocity.lerp(scratch, 1 - Math.exp(-dt * response));
        fish.position.addScaledVector(fish.velocity, dt);
        if (fish.velocity.lengthSq() > 0.0004) {
          heading.copy(fish.velocity).normalize();
          aim.setFromUnitVectors(forward, heading);
          fish.object.quaternion.slerp(aim, 1 - Math.exp(-dt * 1.1));
        }
        if (fish.state === 'approach' && length < 0.7) fish.state = 'near';
        if (fish.state === 'return' && length < 1.1) fish.state = 'school';
        const fade = T.MathUtils.smoothstep(reveal, 0.02, 0.8);
        const glow = fish.state === 'near' ? 0.55 + fish.meet / MEET_SECONDS * 0.4 : 0.16;
        for (const material of fish.materials) {
          material.opacity = fade * material.userData.baseOpacity;
          material.emissiveIntensity = glow;
        }
        fish.object.visible = fade > 0.03;
      }
    }

    return {update, shafts};
  }

  root.createEndingLake = createEndingLake;
})(window);
