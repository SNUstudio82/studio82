(() => {
  'use strict';
  const canvas = document.querySelector('#scene');
  const status = document.querySelector('#status');
  const audioButton = document.querySelector('#audio');
  const fullButton = document.querySelector('#full');
  const posX = document.querySelector('#posx'), posZ = document.querySelector('#posz');
  const asset = name => window.studioAssets?.[name] || './assets/' + name;
  const T = window.THREE;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:'high-performance'});
  } catch (error) {
    status.textContent = '이 들판은 WebGL을 사용해요. 하드웨어 가속을 켠 브라우저에서 열어주세요.';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.background = new T.Color(0xd3dee5);
  scene.fog = new T.FogExp2(scene.background, .016);
  const camera = new T.PerspectiveCamera(43, 1, .06, 520);
  const manager = new T.LoadingManager();
  let missingMaterial = false;
  manager.onError = () => { missingMaterial = true; };
  let sceneReady = false;
  let previews = null;
  manager.onLoad = () => {
    sceneReady = true;
    previews?.arm();
    if (!missingMaterial) status.hidden = true;
    else status.textContent = '일부 재질을 불러오지 못했어요. 새로고침해 주세요.';
  };
  const loader = new T.TextureLoader(manager);

  const skyMap = loader.load(asset('sky.jpg'), tex => {
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 1024; envCanvas.height = 512;
    const ctx = envCanvas.getContext('2d');
    ctx.drawImage(tex.image, 0, 0, 1024, 256);
    ctx.fillStyle = '#a7a7a0'; ctx.fillRect(0, 256, 1024, 256);
    const env = new T.CanvasTexture(envCanvas);
    env.colorSpace = T.SRGBColorSpace; env.mapping = T.EquirectangularReflectionMapping;
    scene.environment = env;
  });
  skyMap.wrapS = T.RepeatWrapping;
  // This shader samples display-encoded sky colors directly.
  const sky = new T.Mesh(new T.SphereGeometry(400, 64, 36), new T.ShaderMaterial({
    side:T.BackSide, depthWrite:false, uniforms:{skyMap:{value:skyMap},
      hazeColor:{value:scene.fog.color.clone().convertLinearToSRGB()}},
    vertexShader:`varying vec3 ray; void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform sampler2D skyMap; uniform vec3 hazeColor; varying vec3 ray;
      void main(){vec3 d=normalize(ray);float u=atan(d.x,-d.z)/6.2831853+0.5;
      float v=asin(clamp(d.y,-1.0,1.0))/1.5707963;
      vec3 skyColor=texture2D(skyMap,vec2(u,clamp(v,0.001,0.999))).rgb;
      float haze=0.94*(1.0-smoothstep(0.015,0.245,d.y));
      gl_FragColor=vec4(mix(skyColor,hazeColor,haze),1.0);}`
  }));
  sky.renderOrder = -2; scene.add(sky);

  const granite = loader.load(asset('granite.jpg'));
  granite.wrapS = granite.wrapT = T.RepeatWrapping;
  granite.colorSpace = T.SRGBColorSpace;
  granite.anisotropy = Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const carveUniforms = {
    carveMask:{value:new T.DataTexture(new Uint8Array([0,0,0,255, 0,0,0,255, 0,0,0,255, 0,0,0,255]), 2, 2, T.RGBAFormat)},
    carveMin:{value:new T.Vector2(-1,-1)},
    carveSize:{value:new T.Vector2(2,2)}
  };
  carveUniforms.carveMask.value.colorSpace = T.NoColorSpace;
  carveUniforms.carveMask.value.magFilter = T.LinearFilter;
  carveUniforms.carveMask.value.minFilter = T.LinearFilter;
  carveUniforms.carveMask.value.wrapS = carveUniforms.carveMask.value.wrapT = T.ClampToEdgeWrapping;
  carveUniforms.carveMask.value.generateMipmaps = false;
  carveUniforms.carveMask.value.needsUpdate = true;
  const stoneMat = new T.MeshStandardMaterial({map:granite, roughness:.94, metalness:0, envMapIntensity:.13});
  function compileGranite(shader, carve){
    shader.vertexShader = 'varying vec2 groundXZ;\n' + shader.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\ngroundXZ = (modelMatrix * vec4(transformed,1.)).xz;');
    let fragment = 'varying vec2 groundXZ;\n' + shader.fragmentShader;
    let grain = `
      vec2 grid = groundXZ / vec2(2.4,1.24);
      float row = floor(grid.y);
      grid.x += mod(row,2.)*.5;
      vec2 stone = floor(grid);
      float seed = fract(sin(dot(stone,vec2(41.31,27.17)))*1837.853);
      vec2 uv = groundXZ*.94 + seed*10.;
      vec3 grains = texture2D(map,uv).rgb;
      float pockets = texture2D(map,groundXZ*.034+vec2(2.12,4.78)).g;
      float chips = texture2D(map,groundXZ*.18+vec2(.37,1.16)).g;
      float relief = .042*pockets + .018*chips + .004*grains.g;
      grains *= .70 + seed*.16 + pockets*.46 + chips*.19;
      grains *= mix(vec3(.96,.99,1.02),vec3(1.035,1.,.955),seed);
      vec2 edge = .5 - abs(fract(grid)-.5);
      vec2 metres = edge * vec2(2.4,1.24);
      float seam = min(metres.x,metres.y);
      float aa = clamp(fwidth(seam),.0006,.065);
      float cut = 1.-smoothstep(.0015-aa,.0045+aa,seam);
      float bevel = 1.-smoothstep(.004-aa,.011+aa,seam);
      float fade = 1.-smoothstep(.012,.08,aa);
      grains *= 1.-(.43*cut+.095*bevel)*fade;
      diffuseColor.rgb *= grains;
    `;
    if(carve){
      fragment = 'uniform sampler2D carveMask;\nuniform vec2 carveMin;\nuniform vec2 carveSize;\n' + fragment;
      shader.uniforms.carveMask = carveUniforms.carveMask;
      shader.uniforms.carveMin = carveUniforms.carveMin;
      shader.uniforms.carveSize = carveUniforms.carveSize;
      grain = `
      vec2 carveUv = (groundXZ - carveMin) / carveSize;
      if(carveUv.x>0.0 && carveUv.y>0.0 && carveUv.x<1.0 && carveUv.y<1.0 && texture2D(carveMask, carveUv).r>0.018) discard;
      ` + grain;
    }
    shader.fragmentShader = fragment.replace('#include <map_fragment>', grain).replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      // A height gradient in world units keeps grain relief stable with zoom.
      vec3 dxView = dFdx(-vViewPosition), dyView = dFdy(-vViewPosition);
      vec3 acrossY = cross(dyView,normal), acrossX = cross(normal,dxView);
      float reliefDet = dot(dxView,acrossY);
      vec3 reliefSlope = (acrossY*dFdx(relief) + acrossX*dFdy(relief))
                        * sign(reliefDet)/max(abs(reliefDet),1.e-8);
      normal = normalize(normal - reliefSlope/max(1.,length(reliefSlope)/.68));
    `);
  }
  const compilePit = shader => compileGranite(shader, false);
  stoneMat.onBeforeCompile = compilePit;
  const pitMat = stoneMat.clone();
  pitMat.onBeforeCompile = compilePit;
  pitMat.vertexColors = true;
  pitMat.polygonOffset = true;
  pitMat.polygonOffsetFactor = -1;
  pitMat.polygonOffsetUnits = -1;
  stoneMat.onBeforeCompile = shader => compileGranite(shader, true);
  // Adjacent patches use the same elevation and normal at their shared edge.
  const fieldWidth = 96, divisions = 192, stride = divisions+1;
  const groundStep = fieldWidth/divisions;
  const fieldGeometry = new T.PlaneGeometry(fieldWidth,fieldWidth,divisions,divisions);
  fieldGeometry.rotateX(-Math.PI/2);
  const points = fieldGeometry.attributes.position, normals = fieldGeometry.attributes.normal;
  const elevations = new Float32Array(stride*stride);
  function periodicNoise(cells,seed){
    const samples=new Float32Array(cells*cells);
    for(let i=0;i<samples.length;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      samples[i]=seed/2147483648-1;
    }
    return (x,z)=>{
      const gx=(x/fieldWidth+.537)*cells, gz=(z/fieldWidth+.683)*cells;
      const ix=Math.floor(gx), iz=Math.floor(gz);
      const x0=T.MathUtils.euclideanModulo(ix,cells), z0=T.MathUtils.euclideanModulo(iz,cells);
      const x1=(x0+1)%cells, z1=(z0+1)%cells;
      let tx=gx-ix,tz=gz-iz;
      tx=tx*tx*(3-2*tx);tz=tz*tz*(3-2*tz);
      return T.MathUtils.lerp(
        T.MathUtils.lerp(samples[z0*cells+x0],samples[z0*cells+x1],tx),
        T.MathUtils.lerp(samples[z1*cells+x0],samples[z1*cells+x1],tx),tz);
    };
  }
  const outcrops=periodicNoise(11,823), ruts=periodicNoise(27,1979), bumps=periodicNoise(53,1091);
  function fieldHeight(x,z) {
    const u=x*2*Math.PI/fieldWidth, v=z*2*Math.PI/fieldWidth;
    return 2.85*Math.sin(u+.70*Math.sin(v+.2)-.70)
      - 2.70*Math.sin(2*v+.85*Math.sin(u-.4)+.42)
      + 1.25*Math.cos(2*u+v+.55*Math.cos(v))
      + .65*Math.sin(3*u-2*v+.4) + .36*Math.cos(u+4*v+1.25)
      + .83*outcrops(x,z) + .30*ruts(x,z) + .095*bumps(x,z);
  }
  const slope = new T.Vector3();
  for(let i=0;i<points.count;i++){
    const x=points.getX(i), z=points.getZ(i);
    elevations[i]=fieldHeight(x,z);
    points.setY(i,elevations[i]);
  }
  for(let row=0;row<stride;row++) for(let col=0;col<stride;col++){
    const left=(col+divisions-1)%divisions, right=(col+1)%divisions;
    const back=(row+divisions-1)%divisions, front=(row+1)%divisions;
    slope.set(elevations[row*stride+left]-elevations[row*stride+right],2*groundStep,
      elevations[back*stride+col]-elevations[front*stride+col]).normalize();
    normals.setXYZ(row*stride+col,slope.x,slope.y,slope.z);
  }
  fieldGeometry.computeBoundingSphere();
  const fields = new T.Group();
  for(let iz=-1;iz<=1;iz++) for(let ix=-1;ix<=1;ix++){
    const tile=new T.Mesh(fieldGeometry,stoneMat);
    tile.position.set(ix*fieldWidth,0,iz*fieldWidth);
    tile.receiveShadow=true; fields.add(tile);
  }
  scene.add(fields);
  fields.visible=false;
  // Interpolate the exact triangle under the player and camera.
  function baseGround(x,z,normal){
    const gx=T.MathUtils.euclideanModulo(x+fieldWidth/2,fieldWidth)/groundStep;
    const gz=T.MathUtils.euclideanModulo(z+fieldWidth/2,fieldWidth)/groundStep;
    const ix=Math.min(divisions-1,Math.floor(gx)), iz=Math.min(divisions-1,Math.floor(gz));
    const fx=gx-ix, fz=gz-iz, a=iz*stride+ix;
    const b=a+stride, d=a+1, c=b+1;
    const lower=fx+fz<=1;
    const dx=lower ? elevations[d]-elevations[a] : elevations[c]-elevations[b];
    const dz=lower ? elevations[b]-elevations[a] : elevations[c]-elevations[d];
    if(normal) normal.set(-dx,groundStep,-dz).normalize();
    return lower ? elevations[a]+fx*dx+fz*dz : elevations[c]+(fx-1)*dx+(fz-1)*dz;
  }
  let sampleGround = baseGround;
  function groundAt(x,z,normal){ return sampleGround(x,z,normal); }
  const exhibition = createExhibition(T, baseGround, pitMat, carveUniforms, granite, loader, asset);
  sampleGround = exhibition.sample;
  scene.add(exhibition.group);
  previews = window.StudioPreview.create({T, scene, camera, canvas, mounts: exhibition.mounts});
  if (sceneReady) previews.arm();
  const sun = new T.DirectionalLight(0xfff0d9, 1.6);
  scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:1,far:30});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -.00012; sun.shadow.normalBias = .002;
  scene.add(new T.HemisphereLight(0xe1f0ff,0xb3a79d,1.05));

  // A drawn numeral, extruded as a single body with two open counters.
  const glyph = new T.Shape();
  glyph.moveTo(-.419,.075);
  glyph.bezierCurveTo(-.641,.186,-.713,.379,-.701,.617);
  glyph.bezierCurveTo(-.682,.990,-.396,1.191,-.013,1.197);
  glyph.bezierCurveTo(.410,1.205,.695,.995,.718,.645);
  glyph.bezierCurveTo(.735,.40,.620,.198,.416,.081);
  glyph.bezierCurveTo(.704,-.045,.837,-.264,.833,-.546);
  glyph.bezierCurveTo(.827,-.991,.528,-1.245,.015,-1.249);
  glyph.bezierCurveTo(-.505,-1.253,-.840,-1.006,-.842,-.565);
  glyph.bezierCurveTo(-.846,-.270,-.697,-.046,-.419,.075);
  for (const [cy,rx,ry] of [[.62,.257,.251],[-.537,.334,.301]]) {
    const hole = new T.Path(); hole.absellipse(0,cy,rx,ry,0,Math.PI*2,false,0); glyph.holes.push(hole);
  }
  const bevel = .045, thickness = .46;
  const geometry = new T.ExtrudeGeometry(glyph,{depth:thickness,bevelEnabled:true,bevelSegments:4,
    steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:24});
  geometry.translate(0,0,-thickness/2);
  const glyphScale = .25;
  const face = new T.MeshPhysicalMaterial({color:0x141414,metalness:.06,roughness:.48,clearcoat:.14,clearcoatRoughness:.35,envMapIntensity:.36});
  const edge = new T.MeshPhysicalMaterial({color:0x101010,metalness:.08,roughness:.39,clearcoat:.24,clearcoatRoughness:.32,envMapIntensity:.45});
  const eight = new T.Mesh(geometry,[face,edge]); eight.castShadow = true; eight.receiveShadow = true; scene.add(eight);
  eight.scale.setScalar(glyphScale);
  const outline = glyph.getSpacedPoints(112);

  // The transparent print carries only the letterforms, set in Pretendard Medium.
  const printHeight=2.10, printWidth=printHeight*2545/2460;
  const printMap=loader.load(asset('passage.png'));
  printMap.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const printMaterial=new T.MeshBasicMaterial({map:printMap,color:0x000000,
    transparent:true,alphaTest:.004,depthWrite:false,fog:false,toneMapped:false});
  const printGeometry=new T.PlaneGeometry(printWidth,printHeight);
  const passage=new T.Group();
  passage.name='floating-passage';
  const front=new T.Mesh(printGeometry,printMaterial);
  const back=new T.Mesh(printGeometry,printMaterial);
  front.position.z=.012; back.position.z=-.012;
  back.rotation.y=Math.PI;
  front.renderOrder=back.renderOrder=2;
  passage.add(front,back);
  geometry.computeBoundingBox();
  const uprightHeight=(geometry.boundingBox.max.y-geometry.boundingBox.min.y)*glyphScale;
  passage.rotation.y=.20;
  passage.position.set(.31,groundAt(.31,1.55)+2*uprightHeight+printHeight/2,1.55);
  scene.add(passage);

  const stamp = document.createElement('canvas'); stamp.width = stamp.height = 128;
  const ink = stamp.getContext('2d'), gradient = ink.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(39,34,35,.63)'); gradient.addColorStop(.34,'rgba(39,34,35,.34)');
  gradient.addColorStop(1,'rgba(39,34,35,0)'); ink.fillStyle = gradient; ink.fillRect(0,0,128,128);
  const shadowMat = new T.MeshBasicMaterial({map:new T.CanvasTexture(stamp),transparent:true,depthWrite:false});
  const contact = new T.Mesh(new T.PlaneGeometry(2.05*glyphScale,1.28*glyphScale).rotateX(-Math.PI/2),shadowMat);
  scene.add(contact);

  const up = new T.Vector3(0,1,0);
  const location = new T.Vector3(), velocity = new T.Vector3(), desired = new T.Vector3(), follow = new T.Vector3();
  const cameraGoal = new T.Vector3(), gaze = new T.Vector3(), downLocal = new T.Vector3(), inverse = new T.Quaternion();
  const orientation = new T.Euler(0,0,0,'YXZ');
  const rimOffset=new T.Vector3();
  const groundNormal=new T.Vector3(), terrainTilt=new T.Quaternion(), shadowHeading=new T.Quaternion();
  const orbit = {yaw:.20,pitch:.075};
  let pitBlend = 0;
  let heading=.52, roll=-.13, hop=0, jumpSpeed=0, wobble=0, wobbleSpeed=0, lastLobe=0, impactDelay=0;
  let mode='ground', airY=0, verticalSpeed=0, paused=false, homing=false, homeStage='climb';
  const flight={yaw:0,pitch:0,bank:0,speed:0,takeoff:0};
  const previousAttitude=new T.Quaternion(), airAttitude=new T.Quaternion();
  const followPoint=new T.Vector3();
  const jumpButton=document.querySelector('#jump'), flightButton=document.querySelector('#flight');
  const flightLabel=document.querySelector('#flight-label'), steerHint=document.querySelector('#steer-hint');
  const travelStatus=document.querySelector('#travel-status');
  let lastUI=0, wasMoving=false;
  const held = new Set(), pointerKeys = new Map();
  const keyDir = {ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]};
  const wrap = n => Math.atan2(Math.sin(n),Math.cos(n));
  const ease = (rate,dt) => 1-Math.exp(-rate*dt);
  let ac = null, audible = false;
  const stoneSounds=[[],[]];
  function makeStoneSound(bright){
    const rate=32000;
    const buffer=ac.createBuffer(1,Math.ceil(rate*.15),rate);
    const data=buffer.getChannelData(0);
    const size=(bright?1.23:.87)*(.92+Math.random()*.16);
    const modes=[[395,.24,.019],[1030,.35,.012],[1865,.22,.008],[3470,.12,.005]];
    const contacts=[[0,1],[.003+Math.random()*.004,.24],[.012+Math.random()*.012,.12]];
    for(const [delay,force] of contacts){
      const start=Math.round(delay*rate);
      let band=0, bass=0;
      for(let i=start;i<data.length;i++){
        const t=(i-start)/rate;
        const noise=Math.random()*2-1;
        band+=.57*(noise-band);
        bass+=.10*(band-bass);
        const grit=(band-bass)*1.6*Math.exp(-t/.0045)+bass*.72*Math.exp(-t/.014);
        data[i]+=force*grit;
      }
      for(const [base,level,decay] of modes){
        const omega=2*Math.PI*base*size*(.96+Math.random()*.08);
        for(let i=start;i<data.length;i++){
          const t=(i-start)/rate;
          data[i]+=force*level*Math.sin(omega*t)*Math.exp(-t*size/decay);
        }
      }
    }
    let peak=0;
    for(let i=0;i<data.length;i++){
      data[i]*=Math.min(1,i/8);
      peak=Math.max(peak,Math.abs(data[i]));
    }
    for(let i=0;i<data.length;i++) data[i]*=.88/peak;
    return buffer;
  }
  function knock(amount,lobe) {
    if (!audible || !ac || ac.state !== 'running') return;
    const bank=stoneSounds[lobe>0?1:0];
    if(!bank.length) for(let i=0;i<3;i++) bank.push(makeStoneSound(lobe>0));
    const source=ac.createBufferSource(), gain=ac.createGain();
    source.buffer=bank[Math.floor(Math.random()*bank.length)];
    source.playbackRate.value=.94+.12*Math.random();
    gain.gain.value=Math.min(.65,.13+amount*.16);
    source.connect(gain).connect(ac.destination);
    source.onended=()=>{source.disconnect();gain.disconnect();};
    source.start();
  }
  audioButton.addEventListener('click',async () => {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state !== 'running') await ac.resume();
      audible=!audible; audioButton.setAttribute('aria-pressed',String(audible));
      audioButton.title=audible?'돌소리 끄기':'돌소리 켜기'; audioButton.setAttribute('aria-label',audioButton.title);
      if(audible) knock(1,-1);
    } catch { audioButton.title='이 브라우저에서는 소리를 재생할 수 없어요'; }
  });
  if (!document.fullscreenEnabled) fullButton.hidden=true;
  if (fullButton.hidden) fullButton.style.display='none';
  fullButton.addEventListener('click',async () => {
    try { if(document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { fullButton.title='전체 화면을 열 수 없어요'; }
  });
  document.addEventListener('fullscreenchange',()=>{
    fullButton.title=document.fullscreenElement?'전체 화면 종료':'전체 화면';
    fullButton.setAttribute('aria-label',fullButton.title);
  });
  function setMode(next){
    mode=next;
    const inFlight=mode==='flying'||mode==='landing';
    jumpButton.disabled=mode!=='ground';
    flightLabel.textContent=mode==='flying'?'착륙':mode==='landing'?'다시 이륙':'이륙';
    steerHint.textContent=inFlight?'↑↓ 고도 · ←→ 선회':'이동';
    travelStatus.textContent=mode==='flying'?'비행 중. 위아래로 고도 조절, 좌우로 선회합니다.':
      mode==='landing'?'착륙 중':mode==='falling'?'절벽에서 떨어져 곧 돌아옵니다.':mode==='jumping'?'점프':'지상';
    contact.visible=mode==='ground'||mode==='jumping';
    if(next==='ground') lookFree=false;
    for(const button of document.querySelectorAll('[data-key]')){
      const labels=inFlight?['상승','좌선회','하강','우선회']:['앞으로','왼쪽으로','뒤로','오른쪽으로'];
      const index=['ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].indexOf(button.dataset.key);
      button.setAttribute('aria-label',labels[index]);
    }
  }
  function jump(){
    if(homing||mode!=='ground') return;
    airY=eight.position.y; verticalSpeed=5.8;
    hop=0; jumpSpeed=0;
    setMode('jumping');
  }
  function toggleFlight(){
    if(homing) return;
    if(mode==='flying'){
      setMode('landing');
      return;
    }
    if(mode!=='landing'){
      flight.yaw=orbit.yaw; flight.bank=0; flight.pitch=.26;
      flight.speed=Math.max(2.3,velocity.length());
      verticalSpeed=mode==='jumping'?Math.max(verticalSpeed,1.9):1.9;
    }
    airY=eight.position.y; flight.takeoff=1.15;
    hop=0; jumpSpeed=0;
    setMode('flying');
  }
  jumpButton.addEventListener('click',jump);
  flightButton.addEventListener('click',toggleFlight);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#atlas')) return;
    if(e.detail>0&&e.target?.closest?.('button')) canvas.focus({preventScroll:true});
  });
  function clearInput(){held.clear(); pointerKeys.clear(); drag=null;}
  let drag=null, lookFree=false;
  window.addEventListener('keydown',e=>{
    if(e.isComposing||e.key==='Process') return;
    if(e.code==='F5'||((e.ctrlKey||e.metaKey)&&e.code==='KeyR')){
      e.preventDefault();
      returnHome();
      return;
    }
    if(e.code==='KeyM' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !e.target?.closest?.('input,textarea,select,[contenteditable="true"]')){
      e.preventDefault();
      exhibition.togglePin();
      return;
    }
    if(e.target?.closest?.('#atlas')) return;
    if(e.metaKey||e.ctrlKey||e.altKey||e.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if(homing){
      if(e.code==='Space'||keyDir[e.code]||e.code==='ShiftLeft'||e.code==='ShiftRight'||e.code==='KeyF') e.preventDefault();
      return;
    }
    if(e.code==='Space'||e.code==='ShiftLeft'||e.code==='ShiftRight'||e.code==='KeyF'){
      if(e.code==='Space'&&e.target?.closest?.('button')) return;
      if(e.code.startsWith('Shift')&&e.target?.closest?.('button')) return;
      e.preventDefault();
      if(e.repeat||held.has(e.code)) return;
      held.add(e.code);
      if(e.code==='Space') jump(); else toggleFlight();
      return;
    }
    if(!keyDir[e.code]) return;
    e.preventDefault(); held.add(e.code);
  });
  window.addEventListener('keyup',e=>held.delete(e.code));
  window.addEventListener('blur',()=>{paused=true;clearInput();});
  window.addEventListener('focus',()=>{paused=false;});
  document.addEventListener('visibilitychange',()=>{if (document.hidden) clearInput();});
  for(const button of document.querySelectorAll('[data-key]')){
    button.addEventListener('pointerdown',e=>{ e.preventDefault(); button.setPointerCapture(e.pointerId); pointerKeys.set(e.pointerId,button.dataset.key); });
    for(const event of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(event,e=>pointerKeys.delete(e.pointerId));
  }
  canvas.addEventListener('pointerdown',e=>{
    if(drag||e.button!==0) return;
    canvas.focus({preventScroll:true}); canvas.setPointerCapture(e.pointerId);
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY,moved:false};
  });
  canvas.addEventListener('pointermove',e=>{
    if (!drag || drag.id!==e.pointerId) return;
    if(Math.hypot(e.clientX-drag.ox, e.clientY-drag.oy)>5){
      drag.moved=true;
      if((mode==='flying'||mode==='landing') && !homing) lookFree=true;
    }
    orbit.yaw-=(e.clientX-drag.x)*.006; orbit.pitch=T.MathUtils.clamp(orbit.pitch+(e.clientY-drag.y)*.004,-.03,.83);
    drag.x=e.clientX; drag.y=e.clientY;
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(name,e=>{
    if(drag?.id!==e.pointerId) return;
    const tap=name==='pointerup' && !drag.moved;
    const x=e.clientX, y=e.clientY;
    drag=null;
    if(tap) previews.press(x, y);
  });

  function pose() {
    terrainTilt.setFromUnitVectors(up,groundNormal);
    orientation.set(wobble,heading,roll,'YXZ');
    eight.quaternion.setFromEuler(orientation).premultiply(terrainTilt);
    downLocal.copy(groundNormal).negate().applyQuaternion(inverse.copy(eight.quaternion).invert());
    let reach=-Infinity, foot=outline[0];
    for(const p of outline){
      const distance=p.x*downLocal.x+p.y*downLocal.y;
      if(distance>reach){reach=distance;foot=p;}
    }
    // The two rims can touch different terrain triangles on a rough patch.
    let bodyY=-Infinity;
    for(const p of outline){
      if(p.x*downLocal.x+p.y*downLocal.y<reach-.36) continue;
      for(let side=-1;side<=1;side+=2){
        rimOffset.set(p.x,p.y,side*thickness*.5).multiplyScalar(glyphScale).applyQuaternion(eight.quaternion);
        const ground=groundAt(location.x+rimOffset.x,location.z+rimOffset.z);
        if(Number.isFinite(ground)) bodyY=Math.max(bodyY,ground-rimOffset.y);
      }
    }
    if(!Number.isFinite(bodyY)) bodyY=location.y;
    eight.position.set(location.x,bodyY+bevel*glyphScale/groundNormal.y+hop,location.z);
    contact.position.copy(location).addScaledVector(groundNormal,.004);
    contact.quaternion.copy(terrainTilt).multiply(shadowHeading.setFromAxisAngle(up,heading));
    shadowMat.opacity=.88*Math.exp(-hop*2.2/glyphScale);
    return foot.y;
  }
  function fly(dt,turn,climb,guide){
    const landing=mode==='landing';
    const guided=!!guide;
    flight.takeoff=Math.max(0,flight.takeoff-dt);
    const targetPitch=guided?(guide.drop?-.04:climb*.55+.1):landing?-.08:climb*.55+.36*flight.takeoff/1.15;
    flight.pitch+= (targetPitch-flight.pitch)*ease(guided?2.2:3.5,dt);
    flight.bank+= (-turn*1.2-flight.bank)*ease(guided?4:11,dt);
    if(!guided) flight.yaw=wrap(flight.yaw-turn*2.6*dt+Math.sin(flight.bank)*.85*dt);
    if(!guided) flight.speed+=((landing?1.05:6.9-.9*Math.sin(flight.pitch))-flight.speed)*ease(landing?2.4:1.2,dt);
    const forwardSpeed=flight.speed*Math.cos(Math.max(0,flight.pitch));
    velocity.set(-Math.sin(flight.yaw)*forwardSpeed,0,-Math.cos(flight.yaw)*forwardSpeed);
    if(!(guided&&guide.drop)) location.addScaledVector(velocity,dt);
    const surface=groundAt(location.x,location.z,groundNormal);
    const supported=Number.isFinite(surface);
    if(supported && airY<surface+1.55) exhibition.constrain(location, airY);
    if(supported) location.y=surface;
    if(!supported && (landing||(guided&&guide.drop)) && !homing){
      startFall();
      return;
    }
    const dropGap=Math.max(0,airY-(supported?location.y:airY));
    const descent=landing?Math.min(2.35,.7+dropGap*.2):0;
    const targetVertical=guided&&guide.drop?-guide.sink:guided&&guide.hold!=null?guide.hold:landing?-descent:flight.speed*Math.sin(flight.pitch);
    verticalSpeed+=(targetVertical-verticalSpeed)*ease(guided?2.2:4,dt);
    airY+=verticalSpeed*dt;

    previousAttitude.copy(eight.quaternion);
    const lobe=supported&&pose()>.08?1:-1;
    const restingY=supported?eight.position.y:airY-2;
    if(!supported) eight.position.set(location.x,airY,location.z);
    if(supported && (landing||(guided&&guide.drop)) && airY<=restingY){
      verticalSpeed=0; flight.speed=0; velocity.set(0,0,0);
      if(!homing){lastLobe=lobe;impactDelay=.16;wasMoving=true;wobbleSpeed=.4;knock(1.1,lobe);}
      else wobbleSpeed=.18;
      setMode('ground');
      return;
    }
    if(supported && !landing && !(guided&&guide.drop)){
      const launchBlend=1-flight.takeoff/1.15;
      const clearance=location.y+.68/groundNormal.y;
      const floor=T.MathUtils.lerp(restingY,Math.max(restingY,clearance),launchBlend);
      if(airY<floor){airY=floor;verticalSpeed=Math.max(0,verticalSpeed);}
      if(airY>42){airY=42;verticalSpeed=Math.min(0,verticalSpeed);}
    }
    const gap=Math.max(0,airY-restingY);
    orientation.set(-.85+flight.pitch,flight.yaw,flight.bank,'YZX');
    airAttitude.setFromEuler(orientation);
    airAttitude.slerp(eight.quaternion,1-T.MathUtils.smoothstep(gap,0,.72));
    eight.quaternion.copy(previousAttitude).slerp(airAttitude,ease(12,dt));
    eight.position.y=airY;
    shadowMat.opacity=.88*Math.exp(-gap*5);
  }
  const veil=document.querySelector('#veil');
  const veilMist=veil.querySelector('.mist'), veilFill=veil.querySelector('.fill');
  let fogStart=0, fogPlaced=false;
  let homeTarget={x:0,z:0,settle:true}, hoverTime=0, arrival=null;
  function flyTo(x,z,settleHome,rush){
    const dx=location.x-x, dz=location.z-z;
    const distance=Math.hypot(dx,dz);
    homeTarget={x,z,settle:!!settleHome,rush:!!rush};
    arrival=null;
    if(!homing){
      if(distance<.45&&!settleHome) return;
      clearInput(); velocity.set(0,0,0);
      homing=true; homeStage='climb'; lookFree=false;
      flight.yaw=distance<.25?orbit.yaw:Math.atan2(dx,dz);
      flight.bank=0; flight.pitch=.42; flight.speed=2.2; flight.takeoff=1.15;
      airY=eight.position.y; verticalSpeed=2.4;
      hop=jumpSpeed=0;
      setMode('flying');
    }
    travelStatus.textContent=settleHome?'이륙해서 처음 위치로 돌아갑니다':'이륙해서 그 위치로 이동합니다';
  }
  function returnHome(){ flyTo(0,0,true,false); }
  function finishTravel(){
    homing=false; hoverTime=0;
    velocity.set(0,0,0); verticalSpeed=0; flight.speed=0;
    const miss=Math.hypot(location.x-homeTarget.x,location.z-homeTarget.z);
    if(miss>1.6){location.x=homeTarget.x;location.z=homeTarget.z;}
    location.y=groundAt(location.x,location.z,groundNormal);
    arrival={
      x:homeTarget.x, z:homeTarget.z, pose:homeTarget.settle,
      heading:homeTarget.settle?.52:flight.yaw,
      roll:homeTarget.settle?-.13:roll,
      yaw:homeTarget.settle?.20:orbit.yaw,
      pitch:homeTarget.settle?.075:orbit.pitch
    };
    setMode('ground'); pose(); updateCoords();
    travelStatus.textContent=homeTarget.settle?'처음 위치에 내려왔습니다':'그 위치에 내려왔습니다';
  }
  function stepHome(dt){
    if(mode==='ground'){ finishTravel(); return; }
    const dx=location.x-homeTarget.x, dz=location.z-homeTarget.z;
    const distance=Math.hypot(dx,dz);
    const floor=groundAt(location.x,location.z);
    const altitude=Number.isFinite(floor)?airY-floor:8;
    if(homeStage==='down' && !Number.isFinite(floor)){
      homing=false;
      startFall();
      return;
    }
    if(homeStage==='hover') hoverTime+=dt; else hoverTime=0;
    const rush=!!homeTarget.rush;
    if(homeStage==='climb'){
      if(flight.takeoff<=.05&&altitude>(rush?3.2:6.2)) homeStage=distance<3.2?'hover':'cruise';
    }else if(homeStage==='cruise'&&distance<3.2&&flight.speed<(rush?4.2:2.6)) homeStage='hover';
    else if(homeStage==='hover'&&(hoverTime>(rush?.28:1.5)||(distance<.55&&flight.speed<.8))) homeStage='down';
    if(homeStage!=='down'&&distance>.3){
      const desired=Math.atan2(dx,dz);
      flight.yaw+=wrap(desired-flight.yaw)*Math.min(1,dt*(distance<5?2.2:3.5));
    }
    flight.bank*=Math.max(0,1-dt*5);
    let speedGoal=0, climb=0, guide=null;
    if(homeStage==='climb'){
      speedGoal=rush?Math.min(7.5,Math.max(distance,2.4)):Math.min(2.8,Math.max(distance,1.2)); climb=1; guide={};
    }else if(homeStage==='cruise'){
      speedGoal=rush?(distance>18?12:distance>8?8.4:3.2):(distance>22?6.2:distance>10?3.6:1.7);
      climb=altitude<(rush?4:6)?.4:altitude>(rush?6.4:8.6)?-.25:0; guide={};
    }else if(homeStage==='hover'){
      speedGoal=0; guide={hold:altitude<(rush?3.2:5.6)?.6:altitude>(rush?5:7.2)?-.45:0};
    }else{
      speedGoal=0; guide={drop:true, sink:rush?Math.min(4.4,1.35+Math.max(0,altitude)*.32):Math.min(2.15,.65+Math.max(0,altitude)*.16)};
    }
    flight.speed+=(speedGoal-flight.speed)*Math.min(1,dt*3);
    if(homeStage==='hover'||homeStage==='down') flight.speed*=Math.max(0,1-dt*3.4);
    fly(dt,0,climb,guide);
    if(homeStage==='hover'||homeStage==='down'){
      const pull=Math.min(1,dt*(homeStage==='down'?2.6:1.8));
      location.x+=(homeTarget.x-location.x)*pull;
      location.z+=(homeTarget.z-location.z)*pull;
      velocity.set(0,0,0);
    }
    if(mode==='ground') finishTravel();
  }
  function updateHomeFog(now){
    if(!homing) return;
    const rise=1100, hold=320, fall=1300, t=now-fogStart;
    if(t>=rise+hold+fall){
      veilMist.style.opacity='0'; veilFill.style.opacity='0';
      veil.hidden=true; homing=false; fogPlaced=false;
      travelStatus.textContent='지상';
      return;
    }
    let mist, fill, shift;
    if(t<rise){
      const u=t/rise, e=u*u*(3-2*u), f=Math.max(0,(u-.42)/.58);
      mist=e; fill=f*f*(3-2*f); shift=34*(1-e);
    }else if(t<rise+hold){
      mist=1; fill=1; shift=0;
      if(!fogPlaced){fogPlaced=true; reset(); travelStatus.textContent='안개가 걷히며 처음 위치가 보입니다';}
    }else{
      const u=(t-rise-hold)/fall, e=u*u*(3-2*u);
      mist=1-e; fill=Math.max(0,1-Math.min(1,u/.75)); shift=-16*e;
    }
    veilMist.style.opacity=mist.toFixed(3);
    veilMist.style.transform=`translate3d(0,${shift.toFixed(2)}%,0) scale(${(1.04+mist*.08).toFixed(3)})`;
    veilFill.style.opacity=fill.toFixed(3);
  }
  let fallStartedAt=0, cliffFade=null;
  function beginCliffFade(now){
    if(cliffFade) return;
    cliffFade={start:now, placed:false};
    veil.hidden=false;
    travelStatus.textContent='화면이 걷히며 처음 위치로 돌아갑니다';
  }
  function updateCliffFade(now){
    if(!cliffFade) return;
    const rise=780, hold=160, fall=980, t=now-cliffFade.start;
    const fade=u=>{const x=Math.min(1,Math.max(0,u)); return x*x*(3-2*x);};
    if(t>=rise+hold+fall){
      veilMist.style.opacity='0'; veilFill.style.opacity='0';
      veil.hidden=true; cliffFade=null;
      travelStatus.textContent='지상';
      return;
    }
    let cover;
    if(t<rise) cover=fade(t/rise);
    else if(t<rise+hold) cover=1;
    else cover=1-fade((t-rise-hold)/fall);
    if(t>=rise && !cliffFade.placed){
      cliffFade.placed=true;
      reset();
      travelStatus.textContent='처음 위치가 보입니다';
    }
    veilMist.style.opacity=String(cover);
    veilMist.style.transform='none';
    veilFill.style.opacity=String(cover);
  }
  function startFall(){
    if(mode==='falling'||homing) return;
    airY=eight.position.y;
    verticalSpeed=Math.min(0, verticalSpeed, jumpSpeed);
    hop=0; jumpSpeed=0;
    fallStartedAt=performance.now();
    setMode('falling');
  }
  function fall(dt){
    verticalSpeed=Math.max(-48, verticalSpeed-22*dt);
    airY+=verticalSpeed*dt;
    location.y=airY;
    eight.position.set(location.x, airY, location.z);
    eight.rotateX(dt*.9);
    eight.rotateZ(-dt*1.7);
  }
  function move(dt) {
    if(mode==='falling'){fall(dt);return;}
    if(arrival&&(held.size||pointerKeys.size)) arrival=null;
    let x=0,z=0;
    for(const key of new Set([...held,...pointerKeys.values()])){
      if(keyDir[key]){x+=keyDir[key][0];z+=keyDir[key][1];}
    }
    if(mode==='flying'||mode==='landing'){
      fly(dt,Math.sign(x),-Math.sign(z));return;
    }
    desired.set(x,0,z);
    if(desired.lengthSq()>0){
      desired.normalize().applyAxisAngle(up,orbit.yaw);
      const uphill=-groundNormal.dot(desired)/groundNormal.y;
      desired.multiplyScalar(2.60*T.MathUtils.clamp(1-.50*uphill,.70,1.30));
    }
    velocity.lerp(desired,ease(x||z?4.5:6.8,dt));
    if(velocity.lengthSq()<.0001) velocity.set(0,0,0);
    const speed=velocity.length();
    location.addScaledVector(velocity,dt);
    const surface=groundAt(location.x,location.z,groundNormal);
    if((mode==='ground'||mode==='jumping') && !Number.isFinite(surface)){
      startFall();
      return;
    }
    exhibition.constrain(location, mode==='jumping'?airY:surface);
    location.y=surface;
    // Steer the wheel toward travel. A little sideways slip keeps the two holes visible.
    if(speed>.045){
      let target=Math.atan2(-velocity.z,velocity.x);
      if(Math.abs(wrap(target-heading))>Math.PI/2) target+=Math.PI;
      const relative=wrap(target-orbit.yaw), edgeOn=Math.abs(Math.sin(relative));
      if(edgeOn>.84) target-= Math.sign(Math.sin(2*relative)||1)*.43*(edgeOn-.84)/.16;
      heading+=wrap(target-heading)*ease(8,dt);
      const along=velocity.x*Math.cos(heading)-velocity.z*Math.sin(heading);
      const radius=glyphScale*(.91+.19*Math.cos(2*roll)+.09*Math.cos(roll));
      roll=wrap(roll-along/radius*dt);
    }
    const moving=speed>.1;
    if(moving&&!wasMoving)wobbleSpeed+=.36;
    wasMoving=moving;
    impactDelay-=dt;
    const rockTarget=.035*Math.sin(roll*2.0)*Math.min(1,speed);
    wobbleSpeed+=((rockTarget-wobble)*56-wobbleSpeed*6.0)*dt;wobble+=wobbleSpeed*dt;
    let lobe=pose()>.08?1:-1;
    if(mode==='jumping'){
      verticalSpeed-=12.8*dt; airY+=verticalSpeed*dt;
      const gap=airY-eight.position.y;
      if(gap<=0 && verticalSpeed<=0){
        knock(Math.min(2.7,-verticalSpeed*.4),lobe);
        setMode('ground');impactDelay=.16;verticalSpeed=0;wobbleSpeed+=.65;
      }else{
        eight.position.y+=Math.max(0,gap);
        shadowMat.opacity=.88*Math.exp(-Math.max(0,gap)*5);
      }
      lastLobe=lobe;return;
    }
    if(lastLobe && lobe!==lastLobe && speed>.65 && impactDelay<=0){
      jumpSpeed=Math.max(jumpSpeed,Math.min(.98,speed*(lobe>0?.36:.26)));
      wobbleSpeed+=(lobe>0?1:-1)*Math.min(1.55,speed*.31);
      impactDelay=.14;knock(speed,lobe);
    }
    lastLobe=lobe;
    if(hop>0||jumpSpeed>0){jumpSpeed-=12.8*dt;hop+=jumpSpeed*dt;
      if(hop<=0){if(jumpSpeed<-.72)knock(.4,lobe);hop=0;jumpSpeed=0;}
    }
    pose();
  }
  function view(dt,snap=false){
    followPoint.copy(location);
    if(mode==='falling'){
      followPoint.y=airY-.2;
    }else if(mode==='flying'||mode==='landing'){
      followPoint.y=Math.max(location.y,eight.position.y-.36);
      if(!drag && (!lookFree || homing)) orbit.yaw+=wrap(flight.yaw-orbit.yaw)*ease(homing?8:3.2,dt);
    }else if(mode==='jumping'){
      followPoint.y+=Math.max(0,eight.position.y-location.y-.32)*.32;
    }
    follow.lerp(followPoint,snap?1:ease(7.5,dt));
    const aspect=camera.aspect;
    const portraitDistance=1.62+printWidth/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*aspect*.86);
    const pitTarget=exhibition.interior(location.x,location.z);
    pitBlend+=(pitTarget-pitBlend)*(snap?1:ease(3.2,dt));
    const pit=(mode==='ground'||mode==='jumping')?pitBlend:pitBlend*.22;
    let radius=Math.max(7.6,portraitDistance);
    radius+=(Math.min(radius,3.65)-radius)*pit;
    if(pit>.3){
      const ux=Math.sin(orbit.yaw), uz=Math.cos(orbit.yaw);
      for(let i=0;i<4;i++){
        const dist=Math.cos(orbit.pitch)*radius;
        if(groundAt(follow.x+ux*dist, follow.z+uz*dist)<location.y+.72) break;
        radius*=.74;
      }
    }
    const horizontal=Math.cos(orbit.pitch)*radius;
    gaze.set(follow.x,follow.y+.87,follow.z);
    cameraGoal.set(follow.x+Math.sin(orbit.yaw)*horizontal,gaze.y+Math.sin(orbit.pitch)*radius,follow.z+Math.cos(orbit.yaw)*horizontal);
    camera.position.lerp(cameraGoal,snap?1:ease(17,dt));
    // Raise the eye enough to keep the sight line above any intervening ridge.
    if(mode!=='falling') for(let i=1;i<=8;i++){
      const t=i/8;
      const x=T.MathUtils.lerp(eight.position.x,camera.position.x,t);
      const z=T.MathUtils.lerp(eight.position.z,camera.position.z,t);
      const ground=groundAt(x,z);
      if(!Number.isFinite(ground)) continue;
      const minEye=eight.position.y+(ground+.11+.37*t-eight.position.y)/t;
      if(minEye>camera.position.y){
        const below=groundAt(camera.position.x,camera.position.z);
        const mild=Math.max(camera.position.y, (Number.isFinite(below)?below:camera.position.y)+.32);
        camera.position.y=minEye+(mild-minEye)*pit;
      }
    }
    const eyeFloor=groundAt(camera.position.x,camera.position.z);
    if(mode!=='falling' && Number.isFinite(eyeFloor)) camera.position.y=Math.max(camera.position.y, eyeFloor+.22);
    camera.lookAt(gaze); sky.position.copy(camera.position);
    fields.position.set(Math.round(location.x/fieldWidth)*fieldWidth,0,Math.round(location.z/fieldWidth)*fieldWidth);
    sun.position.copy(location).add(lightOffset);sun.target.position.copy(location);
  }
  const lightOffset=new T.Vector3(-5.5,9,-4.8);
  function updateCoords(){posX.textContent=(Math.abs(location.x)<.05?0:location.x).toFixed(1);posZ.textContent=(Math.abs(location.z)<.05?0:location.z).toFixed(1);}
  function reset(){
    clearInput();location.set(0,0,0);velocity.set(0,0,0);orbit.yaw=.20;orbit.pitch=.075;
    location.y=groundAt(0,0,groundNormal);
    heading=.52;roll=-.13;hop=jumpSpeed=wobble=wobbleSpeed=impactDelay=0;lastLobe=0;wasMoving=false;
    airY=0;verticalSpeed=0;setMode('ground');
    pose();view(0,true);updateCoords();
  }
  window.STUDIO_TRAVEL=(x,z)=>flyTo(x,z,false);
  document.querySelector('#home').addEventListener('click',returnHome);
  document.querySelector('#home-title').addEventListener('click',returnHome);
  function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();view(0,true);}
  window.addEventListener('resize',resize);resize();reset();
  let last=performance.now(), introArmed=false;
  renderer.setAnimationLoop(now=>{
    const elapsed=Math.min(Math.max((now-last)*.001,0),.07);last=now;
    const steps=Math.max(1,Math.ceil(elapsed/(1/90)));
    if(mode==='falling' && !cliffFade && now-fallStartedAt>=900) beginCliffFade(now);
    if(!paused&&!document.hidden && !cliffFade) for(let i=0;i<steps;i++){
      if(homing) stepHome(elapsed/steps); else move(elapsed/steps);
    }else if(!paused&&!document.hidden && cliffFade && !cliffFade.placed) fall(elapsed);
    updateCliffFade(now);
    if(arrival){
      const k=Math.min(1,elapsed*2.2);
      location.x+=(arrival.x-location.x)*k;
      location.z+=(arrival.z-location.z)*k;
      location.y=groundAt(location.x,location.z,groundNormal);
      if(arrival.pose){
        heading+=wrap(arrival.heading-heading)*k;
        roll+=wrap(arrival.roll-roll)*k;
        orbit.yaw+=wrap(arrival.yaw-orbit.yaw)*k;
        orbit.pitch+=(arrival.pitch-orbit.pitch)*k;
      }
      if(Math.hypot(location.x-arrival.x,location.z-arrival.z)<.03&&(!arrival.pose||Math.abs(wrap(arrival.yaw-orbit.yaw))<.02)){
        location.x=arrival.x; location.z=arrival.z;
        if(arrival.pose){heading=arrival.heading;roll=arrival.roll;orbit.yaw=arrival.yaw;orbit.pitch=arrival.pitch;}
        arrival=null;
      }
      pose();
    }
    view(elapsed);if(now-lastUI>110){updateCoords();lastUI=now;}
    if(sceneReady && !introArmed){introArmed=true; exhibition.armIntro(now);}
    exhibition.sync(now, location.x, location.z, eight.position.y, camera, held.size>0 || pointerKeys.size>0 || !!drag, document.hidden);
    previews.update(now, elapsed, location, velocity, camera, document.hidden);
    renderer.render(scene,camera);
    if(sceneReady) canvas.classList.add('ready');
  });
})();
