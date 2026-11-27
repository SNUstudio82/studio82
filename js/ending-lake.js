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
    const belowUniform = {value: 0};
    const waterMood = options.waterMood || {color: {value: new T.Color(0x7eb8c6)}, colorB: {value: new T.Color(0x9ec9cf)}, amount: {value: 0}};
    if (!waterMood.colorB) waterMood.colorB = {value: waterMood.color.value.clone()};
    if (!waterMood.colorC) waterMood.colorC = {value: waterMood.color.value.clone()};
    const moodTarget = waterMood.color.value.clone();
    const moodTargetB = waterMood.colorB.value.clone();
    const moodTargetC = waterMood.colorC.value.clone();
    const moodMid = new T.Color();
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
        x + drift - bottom, -5.2, z - drift,
        x + drift + bottom, -5.2, z + drift
      ], 3));
      geometry.setAttribute('uv', new T.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
      geometry.setIndex([0, 2, 1, 1, 2, 3]);
      const material = new T.ShaderMaterial({
        transparent: true, depthWrite: false, side: T.DoubleSide,
        blending: T.AdditiveBlending, toneMapped: false, fog: false,
        uniforms: {
          seaTime: swimTime, phase: {value: i * 1.37}, below: belowUniform,
          pigment: waterMood.color, pigmentB: waterMood.colorB, pigmentC: waterMood.colorC, mood: waterMood.amount
        },
        vertexShader: `
          varying vec2 vUv; uniform float seaTime; uniform float phase;
          void main() {
            vUv = uv;
            vec3 p = position;
            p.x += sin(seaTime * 0.6 + phase + position.y) * 0.12 * (1.0 - uv.y);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: `
          varying vec2 vUv; uniform float seaTime; uniform float phase; uniform float below;
          uniform vec3 pigment; uniform vec3 pigmentB; uniform vec3 pigmentC; uniform float mood;
          void main() {
            float width = pow(max(0.0, 1.0 - abs(vUv.x - 0.5) * 2.0), 1.65);
            float fade = smoothstep(0.0, 0.16, vUv.y) * pow(vUv.y, 0.62);
            float fine = 0.62 + 0.38 * sin(seaTime * 1.3 + vUv.y * 7.0 + phase);
            float band = 0.5 + 0.5 * sin(vUv.y * 5.5 - seaTime * 0.35 + phase);
            float bandC = 0.5 + 0.5 * sin(vUv.y * 2.4 + seaTime * 0.22 + phase);
            vec3 family = mix(mix(pigment, pigmentB, band), pigmentC, bandC * 0.65);
            vec3 glow = mix(vec3(0.62, 0.86, 0.96), family, mood * 0.94);
            gl_FragColor = vec4(glow, width * fade * fine * below * 0.32);
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
    spot.target.position.set(0, -4.8, 0);
    group.add(spot, spot.target);

    const dustCount = 160;
    const dust = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const a = i * 2.399;
      const r = 0.4 + (i % 10) * 0.42;
      dust[i * 3] = Math.cos(a) * r;
      dust[i * 3 + 1] = waterLevel - 0.4 - (i % 12) * 0.32;
      dust[i * 3 + 2] = Math.sin(a) * r;
    }
    const dustGeometry = new T.BufferGeometry();
    dustGeometry.setAttribute('position', new T.BufferAttribute(dust, 3));
    const dustMaterial = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: false,
      uniforms: {seaTime: swimTime, below: belowUniform},
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
        varying float vLight; uniform float below;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float alpha = 1.0 - smoothstep(0.08, 0.5, d);
          gl_FragColor = vec4(vec3(0.62, 0.86, 0.95), alpha * vLight * below * 0.45);
        }`
    });
    const motes = new T.Points(dustGeometry, dustMaterial);
    motes.frustumCulled = false;
    rig.add(motes);

    const WAKE_POINTS = 400;
    const WAKE_STEPS = 6;
    const WAKE_SPAN = WAKE_POINTS * WAKE_STEPS;
    const traces = new Map();
    const wakeBreaks = new Map();
    const tipDist = new Float32Array(220);
    const wakePositions = new Float32Array(WAKE_SPAN * 18);
    const wakeColours = new Float32Array(WAKE_SPAN * 18);
    const wakeAlphas = new Float32Array(WAKE_SPAN * 6);
    const wakeSides = new Float32Array(WAKE_SPAN * 6);
    const wakeIndices = new Uint32Array(WAKE_SPAN * 18);
    const wakeGeometry = new T.BufferGeometry();
    wakeGeometry.setAttribute('position', new T.BufferAttribute(wakePositions, 3).setUsage(T.DynamicDrawUsage));
    wakeGeometry.setAttribute('inkColour', new T.BufferAttribute(wakeColours, 3).setUsage(T.DynamicDrawUsage));
    wakeGeometry.setAttribute('inkAlpha', new T.BufferAttribute(wakeAlphas, 1).setUsage(T.DynamicDrawUsage));
    wakeGeometry.setAttribute('inkSide', new T.BufferAttribute(wakeSides, 1).setUsage(T.DynamicDrawUsage));
    wakeGeometry.setIndex(new T.BufferAttribute(wakeIndices, 1).setUsage(T.DynamicDrawUsage));
    wakeGeometry.setDrawRange(0, 0);
    const wakeMaterial = new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide, fog: false, toneMapped: false,
      blending: T.AdditiveBlending,
      vertexShader: `attribute vec3 inkColour; attribute float inkAlpha; attribute float inkSide;
        varying vec3 vColour; varying float vAlpha; varying float vSide;
        void main(){vColour=inkColour; vAlpha=inkAlpha; vSide=inkSide; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec3 vColour; varying float vAlpha; varying float vSide;
        void main(){float silk=pow(max(0.0,1.0-abs(vSide)),0.65); gl_FragColor=vec4(vColour, vAlpha*silk);}`
    });
    const wakeMesh = new T.Mesh(wakeGeometry, wakeMaterial);
    wakeMesh.name = 'ending-wake';
    wakeMesh.frustumCulled = false;
    wakeMesh.renderOrder = 6;
    group.add(wakeMesh);
    const wakeColour = new T.Color();
    const wakeEdge = new T.Color();

    const fishes = [];
    const schoolGroups = [];
    const goal = new T.Vector3();
    const scratch = new T.Vector3();
    const forward = new T.Vector3(1, 0, 0);
    const heading = new T.Vector3();
    const aim = new T.Quaternion();
    const bodyTurn = new T.Quaternion();
    const pearl = new T.Color(0xf7f4ef);
    const tintColor = new T.Color();
    const dyeColour = new T.Color();
    const dyeColourB = new T.Color();
    const dyeColourC = new T.Color();
    const dyeColourD = new T.Color();
    const MEET_SECONDS = 24;
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
    let prevY = 0;
    const mood = {ready: false};
    const underFog = new T.Color(0x1a5260);
    const underSun = new T.Color(0xd4f0f8);
    const underHemi = new T.Color(0x8ecfde);

    const FISH_GLSL = `attribute float swimFin;
vec3 articulateFish(vec3 p){
  float u=clamp(.5-p.x,0.,1.);
  float t=swimTime*6.8+swimPhase;
  bool vertical=abs(p.y)>=abs(p.z);
  float side=vertical?sign(p.y):sign(p.z);
  float root=vertical?.06:.04;
  float reach=(vertical?abs(p.y):abs(p.z))-root;
  float weight=swimFin*smoothstep(0.,.12,reach);
  float beat=sin(t-u*3.2+(!vertical&&side<0.?2.042:0.));
  float fold=beat*(vertical?.838:1.082)*weight;
  vec2 fin=p.yz-vec2(vertical?side*root:0.,vertical?0.:side*root);
  fin=mat2(cos(fold),-sin(fold),sin(fold),cos(fold))*fin;
  p.yz=fin+vec2(vertical?side*root:0.,vertical?0.:side*root);
  float stepLength=u/12.;vec2 centre=vec2(.5,0.);
  for(int i=0;i<12;i++){
    float along=(float(i)+.5)*stepLength;
    float angle=(.07+.90*along*along)*sin(t-along*4.4);
    centre+=vec2(-cos(angle),sin(angle))*stepLength;
  }
  float twist=(.035+.60*u*u)*sin(t-u*4.4);
  p.x=centre.x+sin(twist)*p.z;p.z=centre.y+cos(twist)*p.z;
  return p;
}`;
    const WHALE_GLSL = `attribute float swimFin;
vec3 articulateWhale(vec3 p){
  float u=clamp(.5-p.x,0.,1.);
  float t=swimTime*3.4+swimPhase;
  float stepLength=u/12.;vec2 centre=vec2(.5,0.);
  for(int i=0;i<12;i++){
    float along=(float(i)+.5)*stepLength;
    float angle=(.07+.62*along*along)*sin(t-along*4.4);
    centre+=vec2(-cos(angle),sin(angle))*stepLength;
  }
  float twist=(.035+.40*u*u)*sin(t-u*4.4);
  p.y+=swimFin*sin(t-u*3.2)*.05;
  p.x=centre.x+sin(twist)*p.y;p.y=centre.y+cos(twist)*p.y;
  return p;
}`;
    function seaGLSL(jelly) {
      return `attribute vec3 seaRest;attribute vec2 seaLimb;
vec3 articulateSea(vec3 original){
  vec3 delta=original-position;
  vec3 raw=seaRest+vec3(delta.z,delta.y,delta.x)*swimSpan;
  vec3 p=raw;
  float t=swimTime+swimPhase;
  ${jelly ? `float d=clamp((.17-p.y)/1.25,0.,1.);
  float angle=atan(p.z,p.x);
  float pulse=.5+.5*sin(t*2.25-d*3.5);
  p.xz*=1.-.16*pulse;p.y=.17+(p.y-.17)*(1.+.08*pulse);
  float sway=d*d;
  p+=vec3(sin(t*1.65-d*5.+angle)*.15*sway,sin(t*2.25-d*3.5)*.025*d,cos(t*1.4-d*4.5+angle)*.12*sway);` : `float limb=seaLimb.x,signSide=mod(limb,2.)<.5?-1.:1.;bool front=limb<1.5;
  vec3 root=front?vec3(signSide*.055,-.016,.02):vec3(signSide*.048,-.022,-.10);
  vec3 tip=front?vec3(signSide*.43,-.048,.12):vec3(signSide*.20,-.036,-.30);
  vec3 axis=tip-root;float u=clamp(dot(p-root,axis)/dot(axis,axis),0.,1.);
  float beat=t*2.6+(front?0.:1.3)+mod(limb,2.)*.16;
  float stroke=sin(beat),lag=sin(beat-u*1.9);
  p.y+=seaLimb.y*((front?.105:.045)*stroke*u+lag*u*u*(front?.055:.025));
  p.z+=seaLimb.y*cos(beat-.4)*u*u*(front?.04:.025);`}
  vec3 offset=p-raw;
  return original+vec3(offset.z,offset.y,offset.x)/swimSpan;
}`;
    }
    function swimParts(kind) {
      if (kind === 'jelly' || kind === 'turtle') return {head: seaGLSL(kind === 'jelly'), body: 'transformed=articulateSea(position);'};
      if (kind === 'whale') return {head: WHALE_GLSL, body: 'transformed=articulateWhale(transformed);'};
      return {head: FISH_GLSL, body: 'transformed=articulateFish(transformed);'};
    }

    // Each fish keeps one harmony. The five stops are ordered so lines and the body can grade through them.
    const PALETTES = [
      ['#f2b48e', '#f0a8c0', '#d7b4e6', '#b9c6f0', '#f7ead8'],
      ['#f6c0a4', '#f0a8b0', '#d9a8cc', '#c4b6e4', '#e8e4f6'],
      ['#f3e2a0', '#f6c8a4', '#f3b8c8', '#e4c8ee', '#fbf4e6'],
      ['#e7e6a4', '#c9d6a8', '#b7e2c8', '#b7d4f0', '#e4eef8'],
      ['#d4e6a8', '#b9e0c8', '#b4ddd8', '#c4d0f0', '#dcc8ee'],
      ['#bfe6d0', '#b7d6f2', '#d0c4ee', '#f0b8cc', '#f6d0b4'],
      ['#c9d4b4', '#e6d4b0', '#f0d8a4', '#f0c0c8', '#dcc8e6'],
      ['#b8e4dc', '#c8e4f2', '#c8c8ee', '#e0b4d0', '#f6eee4'],
      ['#b9d6f4', '#c4e6d4', '#eee6a8', '#f6c8b0', '#f0b4c4'],
      ['#f0b0a8', '#f6c8a8', '#f0e4a8', '#d0dcb4', '#c4e6d4'],
      ['#f0b0c4', '#d8bce8', '#c4d4f4', '#c8e6d8', '#f8f2ea'],
      ['#d8b0cc', '#c4c8ee', '#b8e0d4', '#ead8a8', '#f4c8c4'],
      ['#c8b4e0', '#f0b8cc', '#f6d0b4', '#f0e6b0', '#d4e0c0'],
      ['#c8e2f4', '#d4c8ee', '#f6c8d8', '#f6c8a8', '#ead8c0'],
      ['#d8e6a4', '#c4e6cc', '#c0d8f4', '#d0c4ee', '#f0c0cc'],
      ['#e8b8a8', '#ead4bc', '#d8c4e8', '#c8d0f2', '#d4e8f4'],
      ['#e8b0c0', '#dcb4d0', '#f0e4b0', '#d4e6b8', '#c4d8f2'],
      ['#b8e0d8', '#eee8b0', '#f6d0b8', '#d8c4ec', '#eee8f6'],
      ['#c8c4e6', '#f0b8c8', '#f4c8a8', '#f6eee0', '#d4e0c4'],
      ['#f4b4bc', '#f0d8a4', '#c8e4cc', '#c4cef0', '#dcc8ea'],
      ['#e8c0b4', '#ead4a4', '#c8daf2', '#c4e4d8', '#dcc8e8'],
      ['#dcb8e0', '#f0e6b4', '#f4c0b4', '#c8e6d4', '#d4e8f4'],
      ['#d0dcb8', '#ead8bc', '#f4c8cc', '#c8d0ee', '#f6f2ea'],
      ['#f4c8a4', '#f0b8c4', '#d8c0ea', '#c4d6f4', '#c8e6d6']
    ];

    function resample(points) {
      const lengths = points.map((p, i) => {
        const q = points[(i + 1) % points.length];
        return Math.hypot(q.x - p.x, q.y - p.y);
      });
      const total = lengths.reduce((sum, n) => sum + n, 0);
      if (total < 1e-8) return points;
      const count = Math.max(56, Math.min(96, Math.ceil(total / 3.2)));
      const output = [];
      let segment = 0, start = 0;
      for (let i = 0; i < count; i++) {
        const distance = i * total / count;
        while (segment < points.length - 1 && start + lengths[segment] < distance) {
          start += lengths[segment];
          segment++;
        }
        const a = points[segment], b = points[(segment + 1) % points.length];
        const t = (distance - start) / Math.max(1e-8, lengths[segment]);
        output.push({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t});
      }
      return output;
    }

    function makeField(identity) {
      const regions = [];
      let previous = null;
      let curvature = 0;
      let strokeCount = 0;
      const handedness = identity % 2 === 0 ? 1 : -1;
      function remesh() {
        for (const region of regions) region.points = resample(region.points);
      }
      function expand(centre, added) {
        if (added <= 0) return;
        for (const region of regions) {
          for (const p of region.points) {
            const dx = p.x - centre.x, dy = p.y - centre.y, d2 = dx * dx + dy * dy;
            if (d2 < 1e-12) { p.x = centre.x + Math.sqrt(added); p.y = centre.y; }
            else {
              const scale = Math.sqrt(1 + added / d2);
              p.x = centre.x + dx * scale;
              p.y = centre.y + dy * scale;
            }
          }
        }
        remesh();
      }
      function drop(centre, radius, paint, clear, mate, stops) {
        expand(centre, radius * radius);
        const count = Math.max(56, Math.min(96, Math.ceil(radius * 2.2)));
        const points = [];
        for (let i = 0; i < count; i++) {
          const angle = i / count * Math.PI * 2;
          points.push({x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius});
        }
        regions.push({paint, mate: mate || paint, stops: stops || null, clear, points});
        if (regions.length > 18) regions.shift();
      }
      function stroke(from, to, width) {
        const dx = to.x - from.x, dy = to.y - from.y, distance = Math.hypot(dx, dy);
        if (distance > 65) { previous = null; curvature = 0; return; }
        if (distance < 0.45 || !regions.length) return;
        const turn = previous ? Math.atan2(previous.x * dy - previous.y * dx, previous.x * dx + previous.y * dy) : 0;
        curvature = curvature * 0.72 + Math.max(-0.9, Math.min(0.9, turn)) * 0.28;
        const curl = 0.3 * Math.tanh(curvature * 12) + handedness * 0.13 * Math.exp(-curvature * curvature * 900);
        let arc = null;
        if (previous) {
          const ax = -previous.x, ay = -previous.y, cross = ax * dy - ay * dx;
          if (Math.abs(cross) > 1e-5) {
            const a2 = ax * ax + ay * ay, b2 = distance * distance;
            const ox = (a2 * dy - b2 * ay) / (2 * cross), oy = (ax * b2 - dx * a2) / (2 * cross);
            const radius = Math.hypot(ox, oy);
            const sx = -ox, sy = -oy, ex = dx - ox, ey = dy - oy;
            const angle = Math.atan2(sx * ey - sy * ex, sx * ex + sy * ey);
            if (radius >= 12 && radius <= 180 && Math.abs(angle) > 0.012 && Math.abs(angle) < 0.35) {
              arc = {cx: from.x + ox, cy: from.y + oy, radius, angle};
            }
          }
        }
        previous = {x: dx, y: dy};
        if (arc) {
          for (const region of regions) {
            for (const p of region.points) {
              const rx = p.x - arc.cx, ry = p.y - arc.cy, r = Math.hypot(rx, ry);
              const falloff = Math.sqrt((r - arc.radius) ** 2 + 64) - 8;
              const a = arc.radius * arc.angle * Math.exp(-falloff / width) / Math.sqrt(r * r + 4);
              const cos = Math.cos(a), sin = Math.sin(a);
              p.x = arc.cx + rx * cos - ry * sin;
              p.y = arc.cy + rx * sin + ry * cos;
            }
          }
        } else {
          const ux = dx / distance, uy = dy / distance;
          const steps = 1;
          const amount = distance / steps;
          for (let step = 0; step < steps; step++) {
            const t = (step + 0.5) / steps;
            const cx = from.x + dx * t, cy = from.y + dy * t;
            for (const region of regions) {
              for (const p of region.points) {
                const rx = p.x - cx, ry = p.y - cy;
                const x = rx * ux + ry * uy, y = -rx * uy + ry * ux;
                const r = Math.hypot(x, y);
                const fall = amount * Math.exp(-r / width);
                const den = Math.max(1e-8, r * width);
                const vx = r < 1e-8 ? amount : fall * (1 - y * y / den);
                const vy = r < 1e-8 ? 0 : fall * x * y / den;
                const mx = x + vx * 0.5, my = y + vy * 0.5;
                const mr = Math.hypot(mx, my);
                const mf = amount * Math.exp(-mr / width);
                const md = Math.max(1e-8, mr * width);
                const ax = mr < 1e-8 ? amount : mf * (1 - my * my / md);
                const ay = mr < 1e-8 ? 0 : mf * mx * my / md;
                p.x += ax * ux - ay * uy;
                p.y += ax * uy + ay * ux;
              }
            }
          }
        }
        const spread = width * 1.4;
        const bend = curl * distance / width;
        const variance = 2 * spread * spread;
        const mx = (from.x + to.x) * 0.5, my = (from.y + to.y) * 0.5;
        for (const region of regions) {
          for (const p of region.points) {
            const rx = p.x - mx, ry = p.y - my;
            const a = bend * Math.exp(-(rx * rx + ry * ry) / variance);
            const cos = Math.cos(a), sin = Math.sin(a);
            p.x = mx + rx * cos - ry * sin;
            p.y = my + rx * sin + ry * cos;
          }
        }
        if (++strokeCount % 4 === 0) remesh();
      }
      return {regions, drop, stroke};
    }

    function makeInk(index) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      texture.generateMipmaps = false;
      return {ctx, texture, palette: PALETTES[index % PALETTES.length], field: null, drawn: -1, prev: null, drops: 0, seeded: 0, root: null, path: [], habits: []};
    }

    const blankCanvas = document.createElement('canvas');
    blankCanvas.width = blankCanvas.height = 2;
    const blankTexture = new T.CanvasTexture(blankCanvas);
    blankTexture.colorSpace = T.SRGBColorSpace;
    blankTexture.generateMipmaps = false;

    function trace(ctx, points) {
      const last = points[points.length - 1];
      ctx.beginPath();
      ctx.moveTo((last.x + points[0].x) / 2, (last.y + points[0].y) / 2);
      for (let i = 0; i < points.length; i++) {
        const p = points[i], q = points[(i + 1) % points.length];
        ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
      }
      ctx.closePath();
    }

    function gestureCurves(points, habit, band, phase) {
      if (!points || points.length < 3) return [];
      let lowX = Infinity, lowY = Infinity, highX = -Infinity, highY = -Infinity;
      for (const p of points) {
        lowX = Math.min(lowX, p.x); lowY = Math.min(lowY, p.y);
        highX = Math.max(highX, p.x); highY = Math.max(highY, p.y);
      }
      const span = Math.max(0.055, highX - lowX, highY - lowY);
      let signed = 0, absolute = 0;
      let previous = {x: points[1].x - points[0].x, y: points[1].y - points[0].y};
      for (let i = 1; i < points.length - 1; i++) {
        const next = {x: points[i + 1].x - points[i].x, y: points[i + 1].y - points[i].y};
        if (previous.x ** 2 + previous.y ** 2 < 1e-8 || next.x ** 2 + next.y ** 2 < 1e-8) { previous = next; continue; }
        const cross = previous.x * next.y - previous.y * next.x;
        const dot = previous.x * next.x + previous.y * next.y;
        const delta = Math.abs(Math.atan2(cross, dot));
        signed += delta * (Math.sign(cross) || 1);
        absolute += delta;
        previous = next;
      }
      const start = points[0], end = points[points.length - 1];
      const dx = end.x - start.x, dy = end.y - start.y, chord = Math.max(1e-6, dx * dx + dy * dy);
      let bulgeT = 0.5, bulge = 0;
      for (let i = 0; i < points.length; i++) {
        const along = T.MathUtils.clamp(((points[i].x - start.x) * dx + (points[i].y - start.y) * dy) / chord, 0, 1);
        const distance = Math.hypot(points[i].x - (start.x + dx * along), points[i].y - (start.y + dy * along)) / span;
        if (distance > bulge) { bulge = distance; bulgeT = i / (points.length - 1); }
      }
      const turn = T.MathUtils.clamp(absolute / (Math.PI * 2), 0, 1.6);
      const curl = T.MathUtils.clamp(signed / (Math.PI * 2), -1.2, 1.2);
      const rise = T.MathUtils.clamp(dy / span, -1, 1);
      const sweep = T.MathUtils.clamp(dx / span, -1, 1);
      const repeat = n => ((n % 1) + 1) % 1;
      const reach = T.MathUtils.lerp(habit === 1 ? 0.28 : habit === 2 ? 0.36 : 0.32, habit === 1 ? 0.62 : habit === 2 ? 0.7 : 0.74, T.MathUtils.clamp(span / (habit === 1 ? 0.28 : habit === 2 ? 0.34 : 0.3), 0, 1));
      const origin = 0.1 + Math.max(0.02, 0.8 - reach) * repeat(band * 0.41 + phase / (Math.PI * 2));
      const pick = repeat(phase / (Math.PI * 2) * 0.73 + band * 0.29 + rise * 0.08);
      const centre = T.MathUtils.lerp(0.18, 0.82, pick);
      const mark = (x, y, weight) => ({x: T.MathUtils.clamp(x, 0.08, 0.92), y: T.MathUtils.clamp(y, 0.12, 0.88), weight});
      if (habit === 1) {
        const bow = 0.022 + 0.055 * T.MathUtils.clamp(bulge * 1.3 + turn * 0.2, 0, 1);
        const opening = 0.014 + 0.016 * Math.abs(rise);
        const mid = T.MathUtils.clamp(centre, 0.18 + bow + opening, 0.82 - bow - opening);
        return [1, -1].map(side => {
          const curve = [];
          for (let i = 0; i < 64; i++) {
            const t = i / 63;
            const x = T.MathUtils.lerp(origin, Math.min(0.9, origin + reach), t);
            const y = mid + side * (opening + bow * Math.sin(t * Math.PI)) + curl * 0.035 * (t - 0.5);
            curve.push(mark(x, y, 0.34));
          }
          return curve;
        });
      }
      const curve = [];
      for (let i = 0; i < 64; i++) {
        const t = i / 63;
        const x = T.MathUtils.lerp(origin, Math.min(0.9, origin + reach), t);
        if (habit === 2) {
          const second = repeat(bulgeT + 0.33 * (curl >= 0 ? 1 : -1));
          const tie = Math.exp(-(((t - bulgeT) / 0.07) ** 2));
          const extra = turn > 0.55 ? Math.exp(-(((t - second) / 0.055) ** 2)) : 0;
          const y = centre + rise * 0.035 * Math.sin(t * Math.PI) + sweep * 0.03 * (t - 0.5) * 2;
          curve.push(mark(x, y, 0.16 + 0.72 * Math.max(tie, extra * 0.8)));
        } else {
          const amplitude = 0.018 + 0.055 * T.MathUtils.clamp(bulge * 1.1 + turn * 0.4, 0, 1);
          const slant = T.MathUtils.clamp(sweep * 0.1 + curl * 0.06, -0.12, 0.12);
          const y = centre + slant * (t - 0.5) * 2 + Math.sin(t * Math.PI) * amplitude + Math.sin((t * (2 + T.MathUtils.clamp(turn, 0, 1.2)) + curl) * Math.PI) * amplitude * 0.35;
          curve.push(mark(x, y, 0.28 + 0.16 * Math.sin(t * Math.PI)));
        }
      }
      return [curve];
    }

    function deepenInk(color, amount) {
      const tone = {h: 0, s: 0, l: 0};
      color.getHSL(tone);
      color.setHSL(
        tone.h,
        Math.min(0.84, tone.s + (0.76 - tone.s) * amount),
        Math.max(0.3, tone.l - (tone.l - 0.4) * amount)
      );
      return color;
    }

    function drawInk(ink) {
      const ctx = ink.ctx;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, 256, 256);
      ctx.save();
      const growth = Math.min(1, 0.78 + Math.max(0, ink.drawn) / 5);
      ctx.beginPath();
      ctx.arc(ink.root.x, ink.root.y, 36 + growth * 210, 0, Math.PI * 2);
      ctx.clip();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ink.field.regions.forEach((region, regionIndex) => {
        const points = region.points;
        if (points.length < 3) return;
        const stops = region.stops && region.stops.length > 1 ? region.stops : [region.paint, region.mate || ink.palette[1], ink.palette[Math.min(2, ink.palette.length - 1)]];
        const from = stops[0];
        const toward = stops[2] || stops[stops.length - 1];
        trace(ctx, points);
        if (region.clear) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        } else {
          wakeColour.set(from);
          if (toward) wakeColour.lerp(wakeEdge.set(toward), 0.45);
          deepenInk(wakeColour, 0.28);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 0.42;
          ctx.fillStyle = '#' + wakeColour.getHexString();
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const count = points.length;
        const voice = 0.5 + 0.5 * Math.sin(regionIndex * 2.15 + 0.6);
        for (let i = 0; i < count; i++) {
          const p = points[i], q = points[(i + 1) % count], r = points[(i + 2) % count];
          const along = i / count;
          const swell = 0.5 + 0.5 * Math.sin(along * Math.PI * 1.65 + regionIndex * 0.9);
          const flutter = 0.5 + 0.5 * Math.sin(along * Math.PI * 5.4 + regionIndex * 1.7);
          const breadth = swell * 0.7 + flutter * 0.3;
          wakeColour.set(from);
          if (toward) wakeColour.lerp(wakeEdge.set(toward), swell * 0.7);
          deepenInk(wakeColour, 0.62);
          ctx.beginPath();
          ctx.moveTo((p.x + q.x) / 2, (p.y + q.y) / 2);
          ctx.quadraticCurveTo(q.x, q.y, (q.x + r.x) / 2, (q.y + r.y) / 2);
          ctx.strokeStyle = '#' + wakeColour.getHexString();
          ctx.globalAlpha = 1;
          ctx.lineWidth = 0.8 + voice * 1.5 + breadth * (2.1 + voice * 6.8);
          ctx.stroke();
        }
      });
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const habit of ink.habits) {
        for (const curve of habit.curves) {
          for (let i = 1; i < curve.length; i++) {
            const a = curve[i - 1], b = curve[i];
            const swell = 0.5 + 0.5 * Math.sin(i * 0.48 + habit.curves.length);
            const voice = 0.5 + 0.5 * Math.sin(habit.curves.length * 1.8);
            wakeColour.set(habit.color);
            if (habit.edge) wakeColour.lerp(wakeEdge.set(habit.edge), swell * 0.7);
            deepenInk(wakeColour, 0.62);
            ctx.beginPath();
            ctx.moveTo(a.x * 256, a.y * 256);
            ctx.lineTo(b.x * 256, b.y * 256);
            ctx.strokeStyle = '#' + wakeColour.getHexString();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 0.9 + voice * 1.2 + swell * (1.8 + voice * 5.4);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      ink.texture.needsUpdate = true;
    }

    function shade(template, kind, phase, tint, fin, patternSlot, swimSpan) {
      const material = template.clone();
      tintColor.set(tint);
      material.color.copy(pearl);
      material.emissive.set(0xfff8f2);
      material.emissiveMap = null;
      material.userData.restColor = material.color.clone();
      material.userData.bodyDye = {value: material.color.clone()};
      material.userData.bodyDyeB = {value: material.color.clone()};
      material.userData.bodyDyeC = {value: material.color.clone()};
      material.userData.bodyDyeD = {value: material.color.clone()};
      material.userData.bodyDyed = {value: 0};
      material.transparent = true;
      material.depthWrite = false;
      material.side = T.DoubleSide;
      material.opacity = 0;
      material.forceSinglePass = true;
      material.userData.baseOpacity = fin ? 0.16 : (kind === 'jelly' ? 0.22 : 0.34);
      material.userData.fin = !!fin;
      material.transmission = 0;
      material.thickness = 0;
      material.onBeforeCompile = shader => {
        const swim = swimParts(kind);
        shader.uniforms.swimTime = swimTime;
        shader.uniforms.swimPhase = {value: phase};
        shader.uniforms.swimSpan = {value: swimSpan || 1};
        shader.uniforms.patternMap = patternSlot;
        shader.uniforms.bodyDye = material.userData.bodyDye;
        shader.uniforms.bodyDyeB = material.userData.bodyDyeB;
        shader.uniforms.bodyDyeC = material.userData.bodyDyeC;
        shader.uniforms.bodyDyeD = material.userData.bodyDyeD;
        shader.uniforms.bodyDyed = material.userData.bodyDyed;
        shader.uniforms.dyeFlip = {value: kind === 'whale' ? -1 : 1};
        shader.vertexShader = 'uniform float swimTime; uniform float swimPhase; uniform float swimSpan;\nvarying vec3 vPearlLocal; varying vec3 vPearlN; varying vec3 vPearlView; varying vec3 vPearlNView;\n' + swim.head + '\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPearlLocal=position;\nvPearlN=normal;\n' + swim.body);
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvPearlView=normalize(mvPosition.xyz);\nvPearlNView=normalize(normalMatrix*vPearlN);');
        shader.fragmentShader = 'varying vec3 vPearlLocal; varying vec3 vPearlN; varying vec3 vPearlView; varying vec3 vPearlNView; uniform sampler2D patternMap; uniform vec3 bodyDye; uniform vec3 bodyDyeB; uniform vec3 bodyDyeC; uniform vec3 bodyDyeD; uniform float bodyDyed; uniform float dyeFlip; uniform float swimTime; uniform float swimPhase;\nvec4 pearlPigment = vec4(0.0); vec3 pearlDyed = vec3(1.0);\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          vec3 bw = abs(normalize(vPearlN));
          bw *= bw;
          bw /= max(0.001, bw.x + bw.y + bw.z);
          vec3 pearlPos = vPearlLocal;
          pearlPos.x *= dyeFlip;
          vec2 noseUv = dyeFlip < 0.0 ? pearlPos.yz : pearlPos.zy;
          vec2 backUv = dyeFlip < 0.0 ? vec2(pearlPos.z, pearlPos.x) : pearlPos.xz;
          vec2 flankUv = dyeFlip < 0.0 ? vec2(pearlPos.y, pearlPos.x) : pearlPos.xy;
          pearlPigment = texture2D(patternMap, clamp(noseUv * vec2(0.82, 0.95) + 0.5, vec2(0.02), vec2(0.98))) * bw.x;
          pearlPigment += texture2D(patternMap, clamp(backUv * vec2(0.82, 0.9) + 0.5, vec2(0.02), vec2(0.98))) * bw.y;
          pearlPigment += texture2D(patternMap, clamp(flankUv * vec2(0.82, 1.0) + 0.5, vec2(0.02), vec2(0.98))) * bw.z;
          float ink = clamp(pearlPigment.a, 0.0, 1.0);
          float along = smoothstep(0.08, 0.92, clamp(pearlPos.x * 0.85 + 0.5, 0.0, 1.0));
          float across = clamp(vPearlLocal.y * 1.05 + 0.5, 0.0, 1.0);
          along = mix(along, 0.5 + 0.5 * sin(vPearlLocal.z * 2.1 + swimTime * 0.16 + swimPhase), 0.16);
          vec3 early = mix(bodyDye, bodyDyeB, smoothstep(0.0, 0.55, along));
          vec3 late = mix(bodyDyeD, bodyDyeC, smoothstep(0.4, 1.0, along));
          pearlDyed = mix(early, late, along);
          pearlDyed = mix(pearlDyed, bodyDyeD, across * 0.22);
          vec3 inkColor = pearlPigment.rgb;
          float depth = smoothstep(0.12, 0.7, ink) * bodyDyed;
          diffuseColor.rgb = mix(vec3(0.99, 0.98, 0.96), pearlDyed, bodyDyed);
          diffuseColor.rgb = mix(diffuseColor.rgb, inkColor, depth);
          diffuseColor.a = mix(diffuseColor.a, 0.82, bodyDyed * 0.75);
          diffuseColor.a = mix(diffuseColor.a, 0.94, depth);
          if (!gl_FrontFacing) diffuseColor.a *= mix(1.0, 0.05, bodyDyed);`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissive_fragment>', `#include <emissive_fragment>
          float rim = pow(1.0 - clamp(abs(dot(normalize(vPearlNView), normalize(vPearlView))), 0.0, 1.0), 2.6);
          float pulse = 0.5 + 0.5 * sin(swimTime * 0.65 + swimPhase);
          vec3 breath = mix(vec3(1.0, 0.98, 0.96), pearlDyed, bodyDyed);
          totalEmissiveRadiance += breath * (0.08 + rim * 0.16 + pulse * 0.03);
          vec3 inkGlow = pearlPigment.rgb;
          totalEmissiveRadiance += inkGlow * clamp(pearlPigment.a, 0.0, 1.0) * bodyDyed * 1.05;`);
      };
      material.customProgramCacheKey = () => 'ending-spine-v21-' + kind + (fin ? '-fin' : '');
      return material;
    }

    function partGeometry(part) {
      const geometry = new T.BufferGeometry();
      const positions = decode(part.positions, Float32Array);
      const count = positions.length / 3;
      geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new T.BufferAttribute(decode(part.normals, Float32Array), 3));
      geometry.setAttribute('swimFin', new T.BufferAttribute(part.swimFin ? decode(part.swimFin, Float32Array) : new Float32Array(count), 1));
      geometry.setAttribute('seaRest', new T.BufferAttribute(part.seaRest ? decode(part.seaRest, Float32Array) : positions.slice(), 3));
      geometry.setAttribute('seaLimb', new T.BufferAttribute(part.seaLimb ? decode(part.seaLimb, Float32Array) : new Float32Array(count * 2), 2));
      if (part.uv) geometry.setAttribute('uv', new T.BufferAttribute(decode(part.uv, Float32Array), 2));
      geometry.setIndex(new T.BufferAttribute(decode(part.indices, Uint32Array), 1));
      const live = (part.groups || []).filter(item => item.count > 0);
      live.forEach(item => geometry.addGroup(item.start, item.count, live.length > 1 ? item.materialIndex : 0));
      geometry.computeBoundingSphere();
      geometry.userData.fins = live.length > 1;
      geometry.userData.swimSpan = part.swimSpan || 1;
      return geometry;
    }

    const bodyTemplate = new T.MeshStandardMaterial({
      color: 0xf7f4ef, roughness: 0.62, metalness: 0,
      transparent: true, opacity: 0.34, depthWrite: false, emissive: 0xfff8f2, emissiveIntensity: 0.16, envMapIntensity: 0.08
    });
    const finTemplate = new T.MeshStandardMaterial({
      color: 0xfbf8f4, roughness: 0.4, metalness: 0,
      transparent: true, opacity: 0.14, depthWrite: false, emissive: 0xfff8f2, emissiveIntensity: 0.34, envMapIntensity: 0.08
    });
    let pending = null;
    const warmQueue = [];
    const warmed = new Set();
    let warmWait = 0;

    function queueWarm(object) {
      if (!object || !object.material) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const key = materials.map(material => material.customProgramCacheKey()).join('|');
      if (warmed.has(key)) return;
      warmed.add(key);
      warmQueue.push(object);
    }

    function stepWarm(camera) {
      if (!warmQueue.length || !camera || !options.renderer) return;
      const scene = group.parent;
      if (!scene) return;
      if (!scene.environment && warmWait++ < 180) return;
      const object = warmQueue.shift();
      const standIn = object.clone();
      standIn.visible = true;
      standIn.frustumCulled = false;
      const mini = new T.Scene();
      mini.add(standIn);
      try { options.renderer.compile(mini, camera, scene); }
      catch (error) { warmQueue.unshift(object); }
    }

    queueWarm(shafts[0]);
    queueWarm(motes);
    queueWarm(wakeMesh);

    function spawnFish(job, index) {
      const name = job.data.spawn[index];
      const model = job.models.get(name);
      const geos = job.geometries.get(name);
      if (!model || !geos) return;
      const kind = kindOf(name);
      const tint = TINT[name] || 0xe7eef0;
      const phase = index * 1.17;
      const patternSlot = {value: blankTexture};
      const materials = [];
      const visual = new T.Group();
      geos.forEach(geometry => {
        const body = shade(bodyTemplate, kind, phase, tint, false, patternSlot, geometry.userData.swimSpan);
        const pieces = [body];
        if (geometry.userData.fins) pieces.push(shade(finTemplate, kind, phase, tint, true, patternSlot, geometry.userData.swimSpan));
        materials.push(...pieces);
        const mesh = new T.Mesh(geometry, pieces.length > 1 ? pieces : body);
        mesh.frustumCulled = true;
        mesh.renderOrder = 5;
        visual.add(mesh);
        queueWarm(mesh);
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
          center: new T.Vector3(Math.cos(angle) * radius, -2.4 - (gid % 5) * 1.05, lakeZ + Math.sin(angle) * radius),
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
        species: name, kind, phase, index, materials, patternSlot, ink: null, object: rootFish, school,
        position: rootFish.position, velocity: new T.Vector3(),
        offset: new T.Vector3(Math.cos(slotAngle) * 1.45, (slot - 1) * 0.22, Math.sin(slotAngle) * 1.05),
        state: 'school', cooldown: 0, meet: 0, placed: false, dyed: 0,
        dye: pearl.clone(), dyeB: pearl.clone(), dyeC: pearl.clone(), dyeD: pearl.clone(),
        bulk: kind === 'jelly' ? size * 1.15 : size,
        pen: {x: 128, y: 128}, penWorld: new T.Vector3(), penReady: false
      });
    }

    function stepLoad(camera) {
      if (!pending) return;
      if (camera) pending.camera = camera;
      if (pending.modelsLeft.length) {
        const model = pending.modelsLeft.shift();
        pending.geometries.set(model.name, model.parts.map(partGeometry));
        return;
      }
      if (pending.spawnIndex < pending.data.spawn.length) {
        spawnFish(pending, pending.spawnIndex);
        pending.spawnIndex++;
        return;
      }
      pending = null;
    }

    function ensure() {
      if (loading || failed || pending || fishes.length) return;
      loading = true;
      fetch(options.asset('unity-sealife.json')).then(response => {
        if (!response.ok) throw new Error('sealife');
        return response.json();
      }).then(data => {
        pending = {
          data, models: new Map(data.models.map(model => [model.name, model])),
          geometries: new Map(), modelsLeft: data.models.slice(), spawnIndex: 0, camera: null
        };
      }).catch(() => { failed = true; });
    }

    function clearStone(pos, bulk) {
      const bed = options.bed;
      if (typeof bed !== 'function') return;
      const pad = 0.34 + bulk * 0.2;
      const reach = 0.42 + bulk * 0.22;
      let floor = Math.max(bed(pos.x, pos.z), bed(pos.x + reach, pos.z), bed(pos.x - reach, pos.z), bed(pos.x, pos.z + reach), bed(pos.x, pos.z - reach));
      const ceiling = waterLevel - 0.38;
      let lift = floor + pad;
      if (lift > ceiling - 0.08) {
        const dx = pos.x, dz = pos.z - lakeZ;
        const dist = Math.hypot(dx, dz) || 1;
        const step = Math.min(0.72, 0.24 + (lift - ceiling));
        pos.x -= dx / dist * step;
        pos.z -= dz / dist * step;
        floor = bed(pos.x, pos.z);
        lift = floor + pad;
      }
      if (lift >= ceiling) pos.y = ceiling;
      else {
        if (pos.y < lift) pos.y = lift;
        if (pos.y > ceiling) pos.y = ceiling;
      }
    }

    function clampLake(bulk) {
      const dx = goal.x, dz = goal.z - lakeZ;
      const dist = Math.hypot(dx, dz);
      const limit = lakeR * 0.72;
      if (dist > limit) {
        goal.x = dx / dist * limit;
        goal.z = lakeZ + dz / dist * limit;
      }
      goal.y = Math.min(waterLevel - 0.5, Math.max(-5.2, goal.y));
      clearStone(goal, bulk || 0.7);
    }

    function placeGroup(school) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 4.8 + Math.random() * 5.5;
      school.goal.set(Math.cos(angle) * radius, -2.3 - Math.random() * 4.6, lakeZ + Math.sin(angle) * radius);
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
      clampLake(fish.bulk);
    }

    function paintPattern(fish, px, py, pz) {
      if (!fish.ink) {
        fish.ink = makeInk(fish.index);
        fish.patternSlot.value = fish.ink.texture;
      }
      const ink = fish.ink;
      if (ink.drawn > fish.meet) {
        ink.prev = null;
        ink.drawn = -1;
        fish.penReady = false;
      }
      if (fish.meet - ink.drawn < 0.1) return;
      ink.drawn = fish.meet;
      if (!ink.field) {
        ink.field = makeField(fish.index);
        ink.root = {x: 128, y: 128};
        ink.seeded = 0;
      }
      if (!ink.seeded) {
        const colors = ink.palette;
        const phase = fish.phase;
        const nest = {x: ink.root.x, y: ink.root.y};
        for (let layer = 0; layer < 12; layer++) {
          const centre = {
            x: nest.x + Math.cos(phase + layer * 0.62) * 5,
            y: nest.y + Math.sin(phase + layer * 0.62) * 4
          };
          const clear = layer === 3 || layer === 7 || layer === 10;
          const radius = layer === 0 ? 40 : layer === 11 ? 12 : 20;
          const stops = colors.map((_, step) => colors[(layer + step) % colors.length]);
          ink.field.drop(centre, radius, stops[0], clear, stops[1], stops);
        }
        ink.seeded = 1;
        ink.prev = {x: ink.root.x, y: ink.root.y};
        drawInk(ink);
        return;
      }
      if (!fish.penReady) {
        fish.penWorld.set(px, py, pz);
        fish.penReady = true;
        fish.pen.x = 128;
        fish.pen.y = 128;
        ink.prev = {x: fish.pen.x, y: fish.pen.y};
        return;
      }
      const scale = Math.max(0.2, fish.object.children[0] ? fish.object.children[0].scale.x : 1);
      scratch.set(px - fish.position.x, py - fish.position.y, pz - fish.position.z);
      fish.penWorld.set(px, py, pz);
      const moved = scratch.length();
      if (moved < 0.012) return;
      bodyTurn.copy(fish.object.quaternion).invert();
      scratch.applyQuaternion(bodyTurn);
      const meshX = scratch.x / scale, meshY = scratch.y / scale;
      const next = {
        x: T.MathUtils.clamp((meshX * 1.05 + 0.5) * 256, 24, 232),
        y: T.MathUtils.clamp((1 - (meshY * 1.25 + 0.5)) * 256, 24, 232)
      };
      if (Math.hypot(next.x - ink.prev.x, next.y - ink.prev.y) > 52) {
        fish.pen.x = next.x;
        fish.pen.y = next.y;
        ink.prev = next;
        return;
      }
      ink.field.stroke(ink.prev, next, 32 + Math.min(1, moved * 1.5) * 8);
      ink.path.push({x: next.x / 256, y: next.y / 256});
      if (ink.path.length > 48) ink.path.shift();
      if (ink.habits.length < 4 && ink.path.length >= 5 + ink.habits.length * 6) {
        ink.habits.push({
          color: ink.palette[ink.habits.length % ink.palette.length],
          edge: ink.palette[(ink.habits.length + 2) % ink.palette.length],
          curves: gestureCurves(ink.path.slice(), ink.habits.length % 3, ink.habits.length, fish.phase)
        });
      }
      fish.pen.x = next.x;
      fish.pen.y = next.y;
      ink.prev = next;
      drawInk(ink);
    }

    function trimTraces() {
      let total = 0;
      for (const list of traces.values()) total += list.length;
      while (total > WAKE_POINTS) {
        let oldest = null;
        let oldestId = 0;
        for (const [id, list] of traces) {
          if (list.length && (!oldest || list[0].t < oldest[0].t)) { oldest = list; oldestId = id; }
        }
        if (!oldest) break;
        oldest.shift();
        total--;
        if (!oldest.length) traces.delete(oldestId);
      }
    }

    function noteWake(x, y, z, time, palette, segment) {
      let use = wakeBreaks.get(segment) || segment;
      let list = traces.get(use);
      let py = Math.min(y, waterLevel - 0.18);
      const last = list && list.length ? list[list.length - 1] : null;
      let joined = false;
      if (last) {
        const gap = Math.hypot(x - last.x, py - last.y, z - last.z);
        if (gap < 0.1 || (time - last.t < 0.08 && gap < 0.34)) return;
        if (gap > 3.2) {
          use = segment * 1000 + Math.floor(time * 20);
          wakeBreaks.set(segment, use);
          list = [];
          traces.set(use, list);
        } else joined = true;
      }
      if (!list) {
        list = [];
        traces.set(use, list);
      }
      if (joined) {
        x = last.x + (x - last.x) * 0.7;
        py = last.y + (py - last.y) * 0.7;
        z = last.z + (z - last.z) * 0.7;
      }
      list.push({x, y: py, z, t: time, palette, w: 0.42});
      if (list.length > 200) list.shift();
      trimTraces();
    }

    function curve(a, b, c, d, t) {
      const t2 = t * t, t3 = t2 * t;
      return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    }

    function curveSlope(a, b, c, d, t) {
      const t2 = t * t;
      return 0.5 * ((-a + c) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t2);
    }

    function drawWake(time) {
      const drop = [];
      for (const [id, list] of traces) {
        let kept = 0;
        for (let i = 0; i < list.length; i++) {
          if (time - list[i].t <= 9.4) list[kept++] = list[i];
        }
        list.length = kept;
        if (!kept) drop.push(id);
      }
      for (const id of drop) traces.delete(id);
      if (!traces.size) {
        if (wakeMesh.visible) { wakeMesh.visible = false; wakeGeometry.setDrawRange(0, 0); }
        return;
      }
      let vertex = 0, index = 0;
      const vertLimit = WAKE_SPAN * 6;
      for (const list of traces.values()) {
        const n = list.length;
        if (n > tipDist.length) continue;
        tipDist[n - 1] = 0;
        for (let i = n - 2; i >= 0; i--) {
          const a = list[i], b = list[i + 1];
          tipDist[i] = tipDist[i + 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        }
        for (let strand = 0; strand < 1; strand++) {
          let previous = -1, guideX = 0, guideZ = 0;
          const spans = Math.max(0, n - 1);
          for (let i = 0; i < spans; i++) {
            const p0 = list[Math.max(0, i - 1)], p1 = list[i], p2 = list[i + 1], p3 = list[Math.min(n - 1, i + 2)];
            const steps = i === spans - 1 ? WAKE_STEPS + 1 : WAKE_STEPS;
            for (let s = 0; s < steps; s++) {
              const t = s / WAKE_STEPS;
              const age = time - (p1.t + (p2.t - p1.t) * t);
              const behind = tipDist[i] * (1 - t) + tipDist[i + 1] * t;
              const inT = T.MathUtils.clamp((behind - 0.12) / 1.15, 0, 1);
              const outT = T.MathUtils.clamp((age - 4.2) / 4.7, 0, 1);
              const fadeIn = inT * inT * inT * (inT * (inT * 6 - 15) + 10);
              const fadeOut = 1 - outT * outT * outT * (outT * (outT * 6 - 15) + 10);
              if (fadeOut <= 0.001 || vertex + 2 > vertLimit) { previous = -1; guideX = 0; guideZ = 0; continue; }
              const x = curve(p0.x, p1.x, p2.x, p3.x, t);
              const y = curve(p0.y, p1.y, p2.y, p3.y, t);
              const z = curve(p0.z, p1.z, p2.z, p3.z, t);
              let tx = curveSlope(p0.x, p1.x, p2.x, p3.x, t);
              let tz = curveSlope(p0.z, p1.z, p2.z, p3.z, t);
              const span = Math.hypot(tx, tz) || 1;
              tx /= span; tz /= span;
              let nx = -tz, nz = tx;
              if (nx * guideX + nz * guideZ < 0) { nx = -nx; nz = -nz; }
              guideX = nx; guideZ = nz;
              const swell = 0.5 + 0.5 * Math.sin(behind * 2.15);
              const half = (0.014 + swell * 0.046) * fadeIn * fadeOut;
              wakeColour.set(p1.palette[0]);
              if (p1.palette[2]) wakeColour.lerp(wakeEdge.set(p1.palette[2]), swell * 0.7);
              for (const side of [-1, 1]) {
                const offset = side * half, k = vertex * 3;
                wakePositions[k] = x + nx * offset;
                wakePositions[k + 1] = y;
                wakePositions[k + 2] = z + nz * offset;
                wakeColours[k] = wakeColour.r;
                wakeColours[k + 1] = wakeColour.g;
                wakeColours[k + 2] = wakeColour.b;
                wakeAlphas[vertex] = fadeIn * fadeOut * 0.4;
                wakeSides[vertex] = side;
                vertex++;
              }
              if (previous >= 0 && index + 6 <= wakeIndices.length) {
                const current = vertex - 2;
                wakeIndices[index++] = previous;
                wakeIndices[index++] = previous + 1;
                wakeIndices[index++] = current;
                wakeIndices[index++] = current;
                wakeIndices[index++] = previous + 1;
                wakeIndices[index++] = current + 1;
              }
              previous = vertex - 2;
            }
          }
        }
      }
      wakeGeometry.setDrawRange(0, index);
      wakeGeometry.attributes.position.needsUpdate = true;
      wakeGeometry.attributes.inkColour.needsUpdate = true;
      wakeGeometry.attributes.inkAlpha.needsUpdate = true;
      wakeGeometry.attributes.inkSide.needsUpdate = true;
      wakeGeometry.index.needsUpdate = true;
      wakeMesh.visible = index > 0;
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
      if (waterMood.amount.value > 0.001) {
        moodMid.copy(waterMood.color.value).lerp(waterMood.colorB.value, 0.5).lerp(waterMood.colorC.value, 0.33);
        scene.fog.color.lerp(moodMid, waterMood.amount.value * grade * 0.68);
      }
    }

    function update(time, worldX, worldZ, bodyY, camera) {
      const dt = lastTime < 0 ? 0 : Math.min(0.05, Math.max(0, time - lastTime));
      lastTime = time;
      swimTime.value = time;
      const lx = worldX - anchorX;
      const lz = worldZ - anchorZ;
      const moveX = hasPrev ? lx - prevX : 0;
      const moveZ = hasPrev ? lz - prevZ : 0;
      const moveY = hasPrev ? bodyY - prevY : 0;
      hasPrev = true;
      prevX = lx;
      prevZ = lz;
      prevY = bodyY;
      const hop = Math.hypot(moveX, moveZ);
      const dist = Math.hypot(lx, lz - lakeZ);
      const inside = 1 - T.MathUtils.smoothstep(dist, lakeR * 0.55, lakeR + 1.5);
      const glide = hop > 0.00001 && hop < 2.8 && inside > 0.08;
      const lift = glide && bodyY < waterLevel - 0.2;
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
      const below = camera ? 1 - T.MathUtils.smoothstep(camera.position.y, waterLevel - 0.72, waterLevel - 0.04) : 0;
      belowUniform.value = below;
      spot.position.set(lx, waterLevel - 0.12, lz);
      spot.target.position.set(lx, -4.8, lz);
      spot.intensity = reveal * below * 7.5;
      rig.position.set(lx, 0, lz);
      ensure();
      if (pending) { stepLoad(camera); stepLoad(camera); }
      stepWarm(camera);
      const lakeReady = warmQueue.length === 0;
      rig.visible = reveal > 0.02 && lakeReady;
      if (!fishes.length || reveal < 0.02 || !lakeReady) {
        dwell = 0;
        if (visitor) {
          visitor.state = 'school';
          visitor = null;
        }
        for (const fish of fishes) fish.object.visible = false;
        waterMood.amount.value = Math.max(0, waterMood.amount.value - dt * 0.12);
        waterMood.color.value.lerp(moodTarget, 1 - Math.exp(-dt * 1.6));
        waterMood.colorB.value.lerp(moodTargetB, 1 - Math.exp(-dt * 1.6));
        waterMood.colorC.value.lerp(moodTargetC, 1 - Math.exp(-dt * 1.6));
        drawWake(time);
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
      let washColour = null;
      for (const fish of fishes) {
        const meeting = fish === visitor;
        const beside = Math.hypot(fish.position.x - lx, fish.position.z - lz);
        const touching = meeting && (fish.state === 'near' || (fish.state === 'approach' && beside < 2.6));
        if (touching) {
          if (fish.state === 'near') fish.meet += dt;
          paintPattern(fish, lx, bodyY, lz);
          const wash = fish.ink ? fish.ink.palette : PALETTES[fish.index % PALETTES.length];
          washColour = wash[0];
          dyeColour.set(wash[0]);
          dyeColourB.set(wash[1]);
          dyeColourD.set(wash[2]);
          dyeColourC.set(wash[4] || wash[wash.length - 1]);
          fish.dye.lerp(dyeColour, 1 - Math.exp(-dt * 1.4));
          fish.dyeB.lerp(dyeColourB, 1 - Math.exp(-dt * 1.4));
          fish.dyeC.lerp(dyeColourC, 1 - Math.exp(-dt * 1.4));
          fish.dyeD.lerp(dyeColourD, 1 - Math.exp(-dt * 1.4));
          const meetT = Math.min(1, fish.meet / MEET_SECONDS);
          fish.dyed = Math.max(fish.dyed, meetT * meetT * (3 - 2 * meetT));
          const q = fish.object.quaternion;
          const fx = 1 - 2 * (q.y * q.y + q.z * q.z);
          const fy = 2 * (q.x * q.y + q.w * q.z);
          const fz = 2 * (q.x * q.z - q.w * q.y);
          const tail = Math.max(0.22, fish.object.children[0] ? fish.object.children[0].scale.x : 1) * 0.52;
          noteWake(lx, bodyY + 0.15, lz, time, wash, 1000 + fish.index);
          if (fish.state === 'near') noteWake(fish.position.x - fx * tail, fish.position.y - fy * tail * 0.45, fish.position.z - fz * tail, time, wash, fish.index);
          if (fish.state === 'near' && fish.meet >= MEET_SECONDS) depart(fish, time);
        }
        if (glide && fish === visitor && fish.state !== 'return') {
          fish.position.x += moveX;
          fish.position.z += moveZ;
          if (lift || fish.state === 'near' || fish.state === 'approach') fish.position.y += moveY;
        }
        if (fish === visitor && fish.state !== 'return') {
          const spin = time * 1.7 + fish.phase;
          const orbit = fish.state === 'near' ? 1.28 : 0.9;
          goal.set(lx + Math.cos(spin) * orbit, Math.min(waterLevel - 0.42, bodyY + 0.08 + Math.sin(spin * 2) * 0.16), lz + Math.sin(spin) * orbit);
          clampLake(fish.bulk);
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
        const circling = fish === visitor && fish.state === 'near';
        scratch.copy(goal).sub(fish.position);
        const length = scratch.length();
        const maxSpeed = fish.state === 'approach' ? 1.15 : fish.state === 'return' ? 0.72 : circling ? 2.4 : 0.38;
        if (length > 0.001) scratch.multiplyScalar(Math.min(length, maxSpeed) / length);
        else scratch.set(0, 0, 0);
        const response = fish.state === 'school' ? 0.55 : fish.state === 'approach' ? 1.5 : circling ? 6 : 0.9;
        fish.velocity.lerp(scratch, 1 - Math.exp(-dt * response));
        if (circling) fish.position.copy(goal);
        else fish.position.addScaledVector(fish.velocity, dt);
        if (circling && dt > 0) {
          const tangent = 1.7 * 1.28;
          fish.velocity.set(-Math.sin(time * 1.7 + fish.phase) * tangent, fish.velocity.y, Math.cos(time * 1.7 + fish.phase) * tangent);
        }
        clearStone(fish.position, fish.bulk || 0.7);
        if (fish.velocity.lengthSq() > 0.0004) {
          heading.copy(fish.velocity).normalize();
          aim.setFromUnitVectors(forward, heading);
          fish.object.quaternion.slerp(aim, 1 - Math.exp(-dt * (circling ? 8 : 1.1)));
        }
        if (fish.state === 'approach' && length < 0.7) fish.state = 'near';
        if (fish.state === 'return' && length < 1.1) fish.state = 'school';
        const fade = T.MathUtils.smoothstep(reveal, 0.02, 0.8);
        for (const material of fish.materials) {
          material.opacity = fade * (material.userData.baseOpacity + fish.dyed * 0.26);
          material.color.copy(material.userData.restColor).lerp(fish.dye, fish.dyed);
          material.emissive.copy(material.userData.restColor).lerp(fish.dye, fish.dyed);
          material.userData.bodyDye.value.copy(fish.dye);
          material.userData.bodyDyeB.value.copy(fish.dyeB);
          material.userData.bodyDyeC.value.copy(fish.dyeC);
          material.userData.bodyDyeD.value.copy(fish.dyeD);
          material.userData.bodyDyed.value = fish.dyed;
          material.emissiveIntensity = 0.16 + fish.dyed * 0.22 + (fish.state === 'near' ? 0.05 : 0);
          material.envMapIntensity = 0.1 * (1 - fish.dyed * 0.45);
        }
        fish.object.visible = fade > 0.03;
      }
      if (washColour) {
        moodTarget.set(washColour);
        moodTargetB.copy(dyeColourB);
        moodTargetC.copy(dyeColourC);
        const depth = visitor ? visitor.dyed : waterMood.amount.value;
        waterMood.amount.value += (depth - waterMood.amount.value) * (1 - Math.exp(-dt * 1.45));
      } else waterMood.amount.value = Math.max(0, waterMood.amount.value - dt * 0.06);
      waterMood.color.value.lerp(moodTarget, 1 - Math.exp(-dt * 1.6));
      waterMood.colorB.value.lerp(moodTargetB, 1 - Math.exp(-dt * 1.6));
      waterMood.colorC.value.lerp(moodTargetC, 1 - Math.exp(-dt * 1.6));
      drawWake(time);
    }

    return {update, shafts};
  }

  root.createEndingLake = createEndingLake;
})(window);
