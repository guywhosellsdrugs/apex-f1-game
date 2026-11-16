import * as THREE from 'three';
import { GaithersburgWeather } from '../services/weatherService';

/**
 * Creates a circular feathered particle texture for realistic water spray & snow powder
 */
function createSprayParticleTexture(isRetroPixel = false): THREE.CanvasTexture {
  const size = isRetroPixel ? 16 : 64;
  const half = size * 0.5;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.65)');
    grad.addColorStop(0.7, 'rgba(240, 248, 255, 0.22)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (isRetroPixel) {
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
  }
  return tex;
}

export interface TireSpraySystem {
  group: THREE.Group;
  update: (
    carPos: THREE.Vector3,
    heading: number,
    speedKmh: number,
    sprayState: { active: boolean; type: 'rain' | 'snow' | 'none'; intensity: number; speedKmh: number },
    dt: number
  ) => void;
  dispose: () => void;
}

/**
 * Ultra-realistic 4-wheel tire spray & snow plume particle emitter.
 * - In rain: tires kick up water mist rooster tails expanding backwards and outwards.
 * - In snow: tires kick up billowing plumes of white snow powder flying from the wheels.
 */
export function createTireSpraySystem(
  scene: THREE.Scene,
  options?: { isRetroPixel?: boolean }
): TireSpraySystem {
  const isRetroPixel = Boolean(options?.isRetroPixel);
  const group = new THREE.Group();
  scene.add(group);

  const particleTexture = createSprayParticleTexture(isRetroPixel);

  // 160 particles in HD/Standard (48 lightweight particles in Retro Pixel '92)
  const COUNT = isRetroPixel ? 48 : 160;
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);

  // Per-particle state
  const pLifes = new Float32Array(COUNT);
  const pMaxLifes = new Float32Array(COUNT);
  const pVels = new Float32Array(COUNT * 3);
  const pWheelIndices = new Uint8Array(COUNT);

  // Initialize hidden particles
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3 + 0] = 0;
    positions[i * 3 + 1] = -999;
    positions[i * 3 + 2] = 0;
    colors[i * 3 + 0] = 1.0;
    colors[i * 3 + 1] = 1.0;
    colors[i * 3 + 2] = 1.0;
    sizes[i] = 0.8;
    pLifes[i] = (i / COUNT) * 0.45;
    pMaxLifes[i] = 0.35 + Math.random() * 0.35;
    pWheelIndices[i] = i % 4; // 0: FL, 1: FR, 2: RL, 3: RR
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    map: particleTexture,
    size: 1.6,
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    blending: THREE.NormalBlending,
    depthWrite: false,
  });

  const pointsMesh = new THREE.Points(geometry, material);
  group.add(pointsMesh);

  const update = (
    carPos: THREE.Vector3,
    heading: number,
    _speedKmh: number,
    sprayState: { active: boolean; type: 'rain' | 'snow' | 'none'; intensity: number; speedKmh: number },
    dt: number
  ) => {
    if (!sprayState.active || sprayState.type === 'none') {
      pointsMesh.visible = false;
      return;
    }
    pointsMesh.visible = true;

    const forwardX = -Math.sin(heading);
    const forwardZ = -Math.cos(heading);
    const rightX = -forwardZ;
    const rightZ = forwardX;

    // Wheel local contact patch anchor offsets relative to vehicle centroid
    const wheelAnchors = [
      { ox: rightX * -0.88 + forwardX * 1.35, oz: rightZ * -0.88 + forwardZ * 1.35 }, // FL
      { ox: rightX * 0.88 + forwardX * 1.35, oz: rightZ * 0.88 + forwardZ * 1.35 },  // FR
      { ox: rightX * -0.92 - forwardX * 1.35, oz: rightZ * -0.92 - forwardZ * 1.35 }, // RL
      { ox: rightX * 0.92 - forwardX * 1.35, oz: rightZ * 0.92 - forwardZ * 1.35 },  // RR
    ];

    const isSnow = sprayState.type === 'snow';
    const speedMps = sprayState.speedKmh / 3.6;
    const intensity = Math.max(0.3, Math.min(1.0, sprayState.intensity));
    material.size = isSnow ? 1.55 + intensity * 0.65 : 1.15 + intensity * 0.65;
    material.opacity = isSnow ? Math.min(0.92, 0.55 + intensity * 0.35) : Math.min(0.86, 0.45 + intensity * 0.4);

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    const pArr = posAttr.array as Float32Array;
    const cArr = colAttr.array as Float32Array;

    for (let i = 0; i < COUNT; i++) {
      pLifes[i] += dt;
      if (pLifes[i] >= pMaxLifes[i]) {
        // Respawn particle at wheel contact patch
        pLifes[i] = 0;
        pMaxLifes[i] = isSnow ? 0.42 + Math.random() * 0.45 : 0.30 + Math.random() * 0.35;

        const wIdx = pWheelIndices[i];
        const anchor = wheelAnchors[wIdx];
        const isRear = wIdx >= 2;

        // Base spawn position slightly behind tire contact patch
        pArr[i * 3 + 0] = carPos.x + anchor.ox - forwardX * 0.35 + (Math.random() - 0.5) * 0.3;
        pArr[i * 3 + 1] = carPos.y + 0.16 + Math.random() * 0.14;
        pArr[i * 3 + 2] = carPos.z + anchor.oz - forwardZ * 0.35 + (Math.random() - 0.5) * 0.3;

        // Backward rooster-tail ejection velocity
        const rearMultiplier = isRear ? 1.0 : 0.65;
        const kickBack = -speedMps * (0.45 + Math.random() * 0.35) * rearMultiplier;
        const sideSpread = (Math.random() - 0.5) * (isSnow ? 1.6 : 1.1);
        const upKick = (0.8 + Math.random() * 1.4) * (speedMps / 28) * (isSnow ? 1.25 : 1.0);

        pVels[i * 3 + 0] = forwardX * kickBack + rightX * sideSpread;
        pVels[i * 3 + 1] = upKick;
        pVels[i * 3 + 2] = forwardZ * kickBack + rightZ * sideSpread;
      } else {
        // Update physics: fly backward & expand
        const prog = pLifes[i] / pMaxLifes[i];
        pArr[i * 3 + 0] += pVels[i * 3 + 0] * dt;
        pArr[i * 3 + 1] += pVels[i * 3 + 1] * dt - 1.2 * dt; // slight gravity pull
        pArr[i * 3 + 2] += pVels[i * 3 + 2] * dt;

        // Fade out alpha & color over life
        const alpha = Math.max(0, 1.0 - prog) * intensity;
        if (isSnow) {
          // Pure white snow powder plume
          cArr[i * 3 + 0] = alpha * 1.0;
          cArr[i * 3 + 1] = alpha * 1.0;
          cArr[i * 3 + 2] = alpha * 1.0;
        } else {
          // Translucent misty water droplet spray
          cArr[i * 3 + 0] = alpha * 0.76;
          cArr[i * 3 + 1] = alpha * 0.88;
          cArr[i * 3 + 2] = alpha * 1.0;
        }
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
    particleTexture.dispose();
    scene.remove(group);
  };

  return { group, update, dispose };
}

export interface AtmosphericWeatherSystem {
  group: THREE.Group;
  update: (carPos: THREE.Vector3, weather: GaithersburgWeather, dt: number) => void;
  dispose: () => void;
}

/**
 * Atmospheric Falling Weather System (Rain Streaks or Snowflakes)
 * Floating bounding cloud surrounding the camera and player car.
 */
export function createAtmosphericWeatherSystem(
  scene: THREE.Scene,
  options?: { isRetroPixel?: boolean }
): AtmosphericWeatherSystem {
  const isRetroPixel = Boolean(options?.isRetroPixel);
  const group = new THREE.Group();
  scene.add(group);

  const COUNT = isRetroPixel ? 160 : 600;
  const positions = new Float32Array(COUNT * 3);
  const pVelsY = new Float32Array(COUNT);
  const pDriftX = new Float32Array(COUNT);

  // Initialize random distribution in a 60m x 32m x 60m cube
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = Math.random() * 32;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    pVelsY[i] = 12 + Math.random() * 8;
    pDriftX[i] = (Math.random() - 0.5) * 1.2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.65,
    transparent: true,
    opacity: 0.75,
    blending: THREE.NormalBlending,
    depthWrite: false,
  });

  const pointsMesh = new THREE.Points(geometry, material);
  group.add(pointsMesh);

  const update = (carPos: THREE.Vector3, weather: GaithersburgWeather, dt: number) => {
    const isRaining = weather.isRaining;
    const isSnowing = weather.isSnowing;

    if (!isRaining && !isSnowing) {
      pointsMesh.visible = false;
      return;
    }
    pointsMesh.visible = true;

    // Configure particle look
    if (isSnowing) {
      material.size = 0.95;
      material.color.setHex(0xf8fafc);
      material.opacity = Math.min(0.9, 0.45 + weather.precipitationRate * 0.45);
    } else {
      material.size = 0.55;
      material.color.setHex(0x93c5fd);
      material.opacity = Math.min(0.85, 0.4 + weather.precipitationRate * 0.45);
    }

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const pArr = posAttr.array as Float32Array;

    const fallSpeed = isSnowing ? 3.8 : 38.0; // Snow falls gently, rain plunges down rapidly
    const boxWidth = 64;
    const boxHeight = 32;

    for (let i = 0; i < COUNT; i++) {
      let px = pArr[i * 3 + 0];
      let py = pArr[i * 3 + 1];
      let pz = pArr[i * 3 + 2];

      py -= fallSpeed * dt;
      if (isSnowing) {
        px += Math.sin(py * 0.25 + i) * 1.6 * dt;
      }

      // Recycle particles relative to car
      const relX = px - carPos.x;
      const relZ = pz - carPos.z;

      if (py < carPos.y - 1.0) {
        py = carPos.y + boxHeight + Math.random() * 4.0;
        px = carPos.x + (Math.random() - 0.5) * boxWidth;
        pz = carPos.z + (Math.random() - 0.5) * boxWidth;
      } else if (Math.abs(relX) > boxWidth * 0.5 || Math.abs(relZ) > boxWidth * 0.5) {
        px = carPos.x + (Math.random() - 0.5) * boxWidth;
        pz = carPos.z + (Math.random() - 0.5) * boxWidth;
      }

      pArr[i * 3 + 0] = px;
      pArr[i * 3 + 1] = py;
      pArr[i * 3 + 2] = pz;
    }

    posAttr.needsUpdate = true;
  };

  const dispose = () => {
    geometry.dispose();
    material.dispose();
    scene.remove(group);
  };

  return { group, update, dispose };
}

function setBgHex(scene: THREE.Scene, hex: number) {
  if (scene.background instanceof THREE.Color) {
    scene.background.setHex(hex);
  } else {
    scene.background = new THREE.Color(hex);
  }
}

export interface SkyCelestialAndCloudsSystem {
  group: THREE.Group;
  sunDirection: THREE.Vector3;
  update: (carPos: THREE.Vector3, weather: GaithersburgWeather, dt: number) => void;
  dispose: () => void;
}

function createSunGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    grad.addColorStop(0.0, 'rgba(255, 255, 245, 1.0)');
    grad.addColorStop(0.2, 'rgba(255, 240, 190, 0.85)');
    grad.addColorStop(0.48, 'rgba(253, 186, 116, 0.35)');
    grad.addColorStop(1.0, 'rgba(255, 200, 120, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Computes real Gaithersburg Sun vector in world space (East = +X, South = +Z, Up = +Y)
 * Maps daytime elevation into a realistic 4°–22° visible sky arc so the sun is clearly
 * visible above Maryland buildings and horizon from the driving camera perspective.
 */
export function computeGaithersburgSunVector(weather: GaithersburgWeather, outVec: THREE.Vector3): THREE.Vector3 {
  const hourNorm = THREE.MathUtils.clamp((weather.localHour - 6) / 12, -0.35, 1.35);
  const elevationRad =
    weather.sunAltitude >= 0
      ? 0.07 + Math.pow(THREE.MathUtils.clamp(weather.sunAltitude, 0, 1), 0.75) * 0.31
      : THREE.MathUtils.clamp(weather.sunAltitude * (Math.PI * 0.35), -0.65, 0);
  const azimuthRad = (0.5 - hourNorm) * Math.PI * 0.92; // +X at dawn -> +Z at noon -> -X at dusk
  const cosElev = Math.cos(elevationRad);
  outVec.set(
    Math.sin(azimuthRad) * cosElev,
    Math.sin(elevationRad),
    Math.cos(azimuthRad) * cosElev
  );
  return outVec.normalize();
}

/**
 * Sky Celestial & Dynamic 3D Cloud System for Maryland City Driving:
 * - Smooth vertical gradient sky dome following car (inside Low-graphics far clip = 1400)
 * - Visible Sun disc + radial corona following real Gaithersburg hour & altitude
 * - Visible Moon & twinkling Starfield at dusk/night
 * - 48 multi-puff volumetric 3D cloud clusters (240 puffs in 1 InstancedMesh draw call)
 *   driven smoothly by weather.cloudCover, weather.condition, & weather.windSpeedKmh
 */
export function createSkyCelestialAndCloudsSystem(
  scene: THREE.Scene,
  options?: { isRetroPixel?: boolean }
): SkyCelestialAndCloudsSystem {
  const isRetroPixel = Boolean(options?.isRetroPixel);
  const group = new THREE.Group();
  scene.add(group);

  // 1. Physically-Inspired Maryland Atmospheric Sky Dome Shell (Rayleigh gradient, horizon haze, Mie sun glow, cirrus wisps)
  const skyUniforms = {
    uTopColor: { value: new THREE.Color(0x1b4e8f) },
    uMidColor: { value: new THREE.Color(0x5294d4) },
    uHorizonColor: { value: new THREE.Color(0xc4def4) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.35, 0.85).normalize() },
    uSunGlowColor: { value: new THREE.Color(0xfff1c9) },
    uSunScatter: { value: 0.95 },
    uCirrusAmount: { value: isRetroPixel ? 0.0 : 0.22 },
    uTime: { value: 0.0 },
  };
  const skyDomeGeom = new THREE.SphereGeometry(920, isRetroPixel ? 16 : 32, isRetroPixel ? 12 : 22);
  const skyDomeMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWorldLocalPos;
      void main() {
        vWorldLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunGlowColor;
      uniform float uSunScatter;
      uniform float uCirrusAmount;
      uniform float uTime;
      varying vec3 vWorldLocalPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2d(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      void main() {
        vec3 dir = normalize(vWorldLocalPos);
        float h = clamp(dir.y, 0.0, 1.0);

        // Rayleigh zenith -> cerulean mid-sky -> humid Chesapeake/Piedmont horizon gradient
        vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.24, h));
        col = mix(col, uTopColor, smoothstep(0.20, 0.86, h));

        // Soft atmospheric mist right along horizon line
        float horizonMist = exp(-h * 12.0);
        col = mix(col, uHorizonColor, horizonMist * 0.72);

        // Mie forward solar scattering + crisp sun aureole
        float sunCos = max(dot(dir, normalize(uSunDir)), 0.0);
        float wideScatter = pow(sunCos, 6.0) * 0.22 * uSunScatter;
        float innerCorona = pow(sunCos, 48.0) * 0.52 * uSunScatter;
        float solarCore = smoothstep(0.9968, 0.9994, sunCos) * 0.85 * uSunScatter;
        col += uSunGlowColor * (wideScatter + innerCorona + solarCore);

        // Delicate high-altitude cirrus wisps on clear & partly-cloudy skies
        if (uCirrusAmount > 0.01 && h > 0.04) {
          vec2 skyUv = dir.xz / (h + 0.16);
          vec2 p = skyUv * vec2(1.7, 3.1) + vec2(uTime * 0.0045, uTime * 0.002);
          float f = noise2d(p) * 0.62 + noise2d(p * 2.3 + vec2(3.7, 1.9)) * 0.38;
          float streak = smoothstep(0.56, 0.86, f) * smoothstep(0.04, 0.28, h) * (1.0 - smoothstep(0.72, 1.0, h));
          vec3 cirrusCol = mix(vec3(0.96, 0.98, 1.0), uSunGlowColor, wideScatter * 0.7);
          col = mix(col, cirrusCol, streak * uCirrusAmount);
        }

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `,
  });
  const skyDomeMesh = new THREE.Mesh(skyDomeGeom, skyDomeMat);
  skyDomeMesh.renderOrder = -100;
  skyDomeMesh.frustumCulled = false;
  group.add(skyDomeMesh);

  // 2. Visible Sun Disc + Radial Corona Halo
  const sunGroup = new THREE.Group();
  const sunDiscGeom = new THREE.SphereGeometry(24, isRetroPixel ? 10 : 20, isRetroPixel ? 8 : 16);
  const sunDiscMat = new THREE.MeshBasicMaterial({
    color: 0xfffef2,
    fog: false,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });
  const sunDiscMesh = new THREE.Mesh(sunDiscGeom, sunDiscMat);
  sunGroup.add(sunDiscMesh);

  const sunGlowTex = createSunGlowTexture();
  const sunHaloMat = new THREE.SpriteMaterial({
    map: sunGlowTex,
    color: 0xfef3c7,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const sunHaloSprite = new THREE.Sprite(sunHaloMat);
  sunHaloSprite.scale.set(205, 205, 1);
  sunGroup.add(sunHaloSprite);
  sunGroup.renderOrder = -90;
  group.add(sunGroup);

  // 3. Visible Moon + Halo + Night Starfield
  const moonGroup = new THREE.Group();
  const moonGeom = new THREE.SphereGeometry(18, isRetroPixel ? 10 : 18, isRetroPixel ? 8 : 14);
  const moonMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0,
    fog: false,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const moonMesh = new THREE.Mesh(moonGeom, moonMat);
  moonGroup.add(moonMesh);

  const moonHaloMat = new THREE.SpriteMaterial({
    map: sunGlowTex,
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const moonHaloSprite = new THREE.Sprite(moonHaloMat);
  moonHaloSprite.scale.set(95, 95, 1);
  moonGroup.add(moonHaloSprite);
  moonGroup.renderOrder = -91;
  group.add(moonGroup);

  const STAR_COUNT = isRetroPixel ? 96 : 320;
  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(0.08 + Math.random() * 0.92); // upper hemisphere
    const r = 860;
    starPositions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = r * Math.cos(phi);
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeom = new THREE.BufferGeometry();
  starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xf8fafc,
    size: 2.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.0,
    fog: false,
    depthWrite: false,
  });
  const starPoints = new THREE.Points(starGeom, starMat);
  starPoints.renderOrder = -95;
  starPoints.frustumCulled = false;
  group.add(starPoints);

  // 4. Procedural 3D Cumulus / Stratus Clouds (48 clusters HD, 18 clusters Retro Pixel '92 in 1 InstancedMesh)
  const CLOUD_CLUSTERS = isRetroPixel ? 18 : 48;
  const PUFFS_PER_CLUSTER = 5;
  const TOTAL_PUFFS = CLOUD_CLUSTERS * PUFFS_PER_CLUSTER;

  // Vertex-shaded flat-bottomed cumulus puff so cloud bases sit realistically flat while tops billow in sunlight
  const puffGeom = new THREE.SphereGeometry(1, isRetroPixel ? 6 : 12, isRetroPixel ? 4 : 9);
  const puffPosAttr = puffGeom.getAttribute('position') as THREE.BufferAttribute;
  const puffVColors = new Float32Array(puffPosAttr.count * 3);
  for (let i = 0; i < puffPosAttr.count; i++) {
    const ny = puffPosAttr.getY(i); // -1..+1
    if (ny < 0) {
      puffPosAttr.setY(i, ny * 0.48); // realistic flat cumulus condensation base
    }
    const shade = THREE.MathUtils.clamp(0.70 + (ny + 1.0) * 0.165, 0.66, 1.0);
    puffVColors[i * 3 + 0] = shade;
    puffVColors[i * 3 + 1] = shade;
    puffVColors[i * 3 + 2] = Math.min(1.0, shade * 1.03);
  }
  puffPosAttr.needsUpdate = true;
  puffGeom.setAttribute('color', new THREE.BufferAttribute(puffVColors, 3));

  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    fog: true,
  });

  const cloudInstancedMesh = new THREE.InstancedMesh(puffGeom, cloudMat, TOTAL_PUFFS);
  cloudInstancedMesh.frustumCulled = false;
  cloudInstancedMesh.renderOrder = -60;
  group.add(cloudInstancedMesh);

  interface CloudClusterState {
    rx: number; // local X relative to car
    ry: number; // sky altitude
    rz: number; // local Z relative to car
    scaleMul: number;
    puffOffsets: { ox: number; oy: number; oz: number; sx: number; sy: number; sz: number }[];
  }

  const FIELD_SPAN = 1280;
  const HALF_SPAN = FIELD_SPAN * 0.5;
  const cloudStates: CloudClusterState[] = [];

  for (let c = 0; c < CLOUD_CLUSTERS; c++) {
    // Stratified golden-angle grid distribution so clouds cover the sky evenly without clumps
    const ring = (c + 0.5) / CLOUD_CLUSTERS;
    const angle = c * 2.3999632; // golden angle
    const radius = Math.sqrt(ring) * (HALF_SPAN * 0.94);
    const rx = Math.cos(angle) * radius;
    const rz = Math.sin(angle) * radius;
    const ry = 112 + (c % 5) * 10 + Math.random() * 6;
    const scaleMul = 0.85 + Math.random() * 0.65;

    const puffOffsets = [
      { ox: 0, oy: 2.0, oz: 0, sx: 26, sy: 10.5, sz: 20 },
      { ox: -16, oy: -0.5, oz: 4, sx: 19, sy: 8.2, sz: 16 },
      { ox: 17, oy: -0.2, oz: -3, sx: 20, sy: 8.5, sz: 16 },
      { ox: -6, oy: 4.5, oz: -8, sx: 16, sy: 8.0, sz: 14 },
      { ox: 7, oy: 3.8, oz: 9, sx: 15, sy: 7.4, sz: 14 },
    ];
    cloudStates.push({ rx, ry, rz, scaleMul, puffOffsets });
  }

  const sunDirection = new THREE.Vector3(0.4, 0.8, 0.3).normalize();
  const scratchDummy = new THREE.Object3D();
  const scratchCloudColor = new THREE.Color(0xffffff);
  const scratchHiddenColor = new THREE.Color(0xffffff);
  const lastColorHex = { value: -1 };
  let prevCarX = 0;
  let prevCarZ = 0;
  let initializedCarOrigin = false;

  const update = (carPos: THREE.Vector3, weather: GaithersburgWeather, dt: number) => {
    if (!initializedCarOrigin) {
      prevCarX = carPos.x;
      prevCarZ = carPos.z;
      initializedCarOrigin = true;
    }

    const dCarX = carPos.x - prevCarX;
    const dCarZ = carPos.z - prevCarZ;
    prevCarX = carPos.x;
    prevCarZ = carPos.z;

    // Anchor sky dome & starfield around player car (horizon stays seamlessly at Y=0)
    skyDomeMesh.position.set(carPos.x, 0, carPos.z);
    starPoints.position.set(carPos.x, 0, carPos.z);

    skyUniforms.uTime.value += dt;

    // 1. Update Sun & Moon Positions from Real Gaithersburg Time & Solar Altitude
    computeGaithersburgSunVector(weather, sunDirection);
    skyUniforms.uSunDir.value.copy(sunDirection);
    const orbitR = 780;
    sunGroup.position.set(
      carPos.x + sunDirection.x * orbitR,
      sunDirection.y * orbitR,
      carPos.z + sunDirection.z * orbitR
    );

    const sunAlt = weather.sunAltitude;
    const cloudFrac = THREE.MathUtils.clamp(weather.cloudCover / 100, 0, 1);
    const stormVeil =
      weather.isRaining || weather.isSnowing
        ? 0.92
        : weather.isFoggy
        ? 0.85
        : weather.condition === 'overcast'
        ? 0.76
        : weather.condition === 'clear'
        ? 0.0 // Clear daytime skies always reveal the sun brightly
        : cloudFrac * 0.34;
    const sunVisFactor = THREE.MathUtils.clamp((sunAlt + 0.06) / 0.16, 0, 1) * (1 - stormVeil);

    sunGroup.visible = sunVisFactor > 0.03;
    if (sunGroup.visible) {
      const goldenBlend = THREE.MathUtils.clamp(1.0 - sunAlt / 0.35, 0, 1);
      sunDiscMat.color.setHex(0xfffef2).lerp(scratchHiddenColor.setHex(0xfb923c), goldenBlend * 0.75);
      sunDiscMat.opacity = Math.min(1, sunVisFactor * 1.15);
      sunHaloMat.color.setHex(0xfef3c7).lerp(scratchHiddenColor.setHex(0xf97316), goldenBlend * 0.8);
      sunHaloMat.opacity = sunVisFactor * 0.92;
      const haloScale = 195 + goldenBlend * 65;
      sunHaloSprite.scale.set(haloScale, haloScale, 1);
      skyUniforms.uSunGlowColor.value.copy(sunHaloMat.color);
      skyUniforms.uSunScatter.value = sunVisFactor;
    } else {
      skyUniforms.uSunScatter.value = Math.max(0, THREE.MathUtils.clamp((sunAlt + 0.06) / 0.2, 0, 1) * 0.18);
    }

    // Moon sits across the sky opposite the sun at night/twilight
    const nightFactor = THREE.MathUtils.clamp((-sunAlt + 0.04) / 0.24, 0, 1);
    const moonVis = nightFactor * (weather.isRaining || weather.isSnowing || weather.condition === 'overcast' ? 0.12 : 1.0);
    moonGroup.visible = moonVis > 0.04;
    if (moonGroup.visible) {
      moonGroup.position.set(
        carPos.x - sunDirection.x * orbitR * 0.82,
        Math.max(90, -sunDirection.y * orbitR * 0.85 + 160),
        carPos.z - sunDirection.z * orbitR * 0.82
      );
      moonMat.opacity = moonVis * 0.95;
      moonHaloMat.opacity = moonVis * 0.35;
    }

    starPoints.visible = nightFactor > 0.08 && cloudFrac < 0.88 && !weather.isRaining && !weather.isSnowing;
    if (starPoints.visible) {
      starMat.opacity = nightFactor * (1 - cloudFrac * 0.85) * 0.9;
    }

    // 2. Match Atmospheric Gradient Sky Dome & Cirrus Veil to Current Gaithersburg Sky
    if (sunAlt > 0.08) {
      if (weather.isSnowing) {
        skyUniforms.uTopColor.value.setHex(0x7c8ea0);
        skyUniforms.uMidColor.value.setHex(0x9fb0c0);
        skyUniforms.uHorizonColor.value.setHex(0xcfd8dc);
        skyUniforms.uCirrusAmount.value = 0.0;
      } else if (weather.isRaining) {
        skyUniforms.uTopColor.value.setHex(0x1e293b);
        skyUniforms.uMidColor.value.setHex(0x334155);
        skyUniforms.uHorizonColor.value.setHex(0x475569);
        skyUniforms.uCirrusAmount.value = 0.0;
      } else if (weather.isFoggy) {
        skyUniforms.uTopColor.value.setHex(0x6e8094);
        skyUniforms.uMidColor.value.setHex(0x8c9bad);
        skyUniforms.uHorizonColor.value.setHex(0xa8b5c4);
        skyUniforms.uCirrusAmount.value = 0.0;
      } else if (weather.condition === 'overcast' || weather.cloudCover >= 75) {
        skyUniforms.uTopColor.value.setHex(0x526377);
        skyUniforms.uMidColor.value.setHex(0x758699);
        skyUniforms.uHorizonColor.value.setHex(0x9fb0c2);
        skyUniforms.uCirrusAmount.value = isRetroPixel ? 0.0 : 0.12;
      } else if (weather.condition === 'partly_cloudy' || weather.cloudCover >= 30) {
        skyUniforms.uTopColor.value.setHex(0x215ea8);
        skyUniforms.uMidColor.value.setHex(0x5d9cd8);
        skyUniforms.uHorizonColor.value.setHex(0xc6dcf0);
        skyUniforms.uCirrusAmount.value = isRetroPixel ? 0.0 : 0.28;
      } else {
        // Realistic Crisp Clear Maryland Daylight Sky (Rayleigh cerulean + Piedmont horizon haze)
        skyUniforms.uTopColor.value.setHex(0x1b4e8f);
        skyUniforms.uMidColor.value.setHex(0x4e91d4);
        skyUniforms.uHorizonColor.value.setHex(0xc4def4);
        skyUniforms.uCirrusAmount.value = isRetroPixel ? 0.0 : 0.18;
      }
    } else if (sunAlt >= -0.08) {
      if (weather.isRaining || weather.condition === 'overcast') {
        skyUniforms.uTopColor.value.setHex(0x334155);
        skyUniforms.uMidColor.value.setHex(0x64748b);
        skyUniforms.uHorizonColor.value.setHex(0x94a3b8);
        skyUniforms.uCirrusAmount.value = 0.0;
      } else {
        skyUniforms.uTopColor.value.setHex(0x1d3557);
        skyUniforms.uMidColor.value.setHex(0x8b4c6b);
        skyUniforms.uHorizonColor.value.setHex(0xf09260);
        skyUniforms.uCirrusAmount.value = isRetroPixel ? 0.0 : 0.24;
      }
    } else {
      skyUniforms.uTopColor.value.setHex(0x020617);
      skyUniforms.uMidColor.value.setHex(0x090f21);
      skyUniforms.uHorizonColor.value.setHex(0x131d33);
      skyUniforms.uCirrusAmount.value = 0.0;
    }

    // 3. Update Procedural 3D Clouds (count, height, spread, opacity, color, & wind drift)
    let targetActiveClouds = Math.round(cloudFrac * CLOUD_CLUSTERS);
    if (weather.condition === 'clear' && weather.cloudCover < 22) {
      targetActiveClouds = weather.cloudCover >= 8 ? 5 : 0;
    } else if (weather.condition === 'partly_cloudy') {
      targetActiveClouds = Math.max(20, Math.min(34, targetActiveClouds));
    } else if (weather.condition === 'overcast' || weather.isRaining || weather.isSnowing) {
      targetActiveClouds = CLOUD_CLUSTERS;
    }

    cloudInstancedMesh.visible = targetActiveClouds > 0;
    if (!cloudInstancedMesh.visible) return;

    const isOvercastLike = weather.condition === 'overcast' || weather.cloudCover >= 75 || weather.isRaining || weather.isSnowing;
    const widenFactor = isOvercastLike ? 1.48 : 1.0;
    const flattenYFactor = isOvercastLike ? 0.78 : 1.0;
    const altitudeShift = weather.isRaining ? -18 : weather.isSnowing ? -14 : isOvercastLike ? -10 : 0;

    let cloudHex = 0xf8fafc;
    if (sunAlt < -0.06) {
      cloudHex = weather.isRaining ? 0x1e293b : 0x334155;
    } else if (sunAlt <= 0.08) {
      cloudHex = weather.isRaining ? 0x475569 : 0xfdba74;
    } else if (weather.isRaining) {
      cloudHex = weather.condition === 'thunderstorm' || weather.condition === 'heavy_rain' ? 0x475569 : 0x64748b;
    } else if (weather.isSnowing) {
      cloudHex = 0xdbe4ee;
    } else if (weather.isFoggy) {
      cloudHex = 0xcbd5e1;
    } else if (isOvercastLike) {
      cloudHex = 0x9aa8b8;
    } else {
      cloudHex = 0xf8fafc;
    }

    cloudMat.opacity = isOvercastLike ? 0.94 : weather.condition === 'partly_cloudy' ? 0.88 : 0.76;

    const needsColorUpdate = lastColorHex.value !== cloudHex;
    if (needsColorUpdate) {
      lastColorHex.value = cloudHex;
      scratchCloudColor.setHex(cloudHex);
    }

    // Wind drift velocity in world meters/sec (gentle visible sky motion matching windSpeedKmh)
    const windMps = Math.max(4.5, weather.windSpeedKmh * 0.42);
    const windStepX = windMps * dt * 0.88;
    const windStepZ = windMps * dt * 0.46;

    let instIdx = 0;
    for (let c = 0; c < CLOUD_CLUSTERS; c++) {
      const cs = cloudStates[c];
      // Keep relative positions anchored smoothly when car drives fast across Maryland
      cs.rx -= dCarX * 0.75; // parallax slower than foreground road so clouds sit majestically high
      cs.rz -= dCarZ * 0.75;
      cs.rx += windStepX;
      cs.rz += windStepZ;

      if (cs.rx > HALF_SPAN) cs.rx -= FIELD_SPAN;
      else if (cs.rx < -HALF_SPAN) cs.rx += FIELD_SPAN;
      if (cs.rz > HALF_SPAN) cs.rz -= FIELD_SPAN;
      else if (cs.rz < -HALF_SPAN) cs.rz += FIELD_SPAN;

      const isActive = c < targetActiveClouds;
      const baseX = carPos.x + cs.rx;
      const baseY = cs.ry + altitudeShift;
      const baseZ = carPos.z + cs.rz;

      for (let p = 0; p < PUFFS_PER_CLUSTER; p++) {
        if (!isActive) {
          scratchDummy.position.set(0, -500, 0);
          scratchDummy.scale.set(0.001, 0.001, 0.001);
        } else {
          const po = cs.puffOffsets[p];
          scratchDummy.position.set(
            baseX + po.ox * cs.scaleMul * widenFactor,
            baseY + po.oy * cs.scaleMul * flattenYFactor,
            baseZ + po.oz * cs.scaleMul * widenFactor
          );
          scratchDummy.scale.set(
            po.sx * cs.scaleMul * widenFactor,
            po.sy * cs.scaleMul * flattenYFactor,
            po.sz * cs.scaleMul * widenFactor
          );
        }
        scratchDummy.updateMatrix();
        cloudInstancedMesh.setMatrixAt(instIdx, scratchDummy.matrix);
        if (needsColorUpdate) {
          cloudInstancedMesh.setColorAt(instIdx, scratchCloudColor);
        }
        instIdx++;
      }
    }

    cloudInstancedMesh.instanceMatrix.needsUpdate = true;
    if (needsColorUpdate && cloudInstancedMesh.instanceColor) {
      cloudInstancedMesh.instanceColor.needsUpdate = true;
    }
  };

  const dispose = () => {
    skyDomeGeom.dispose();
    skyDomeMat.dispose();
    sunDiscGeom.dispose();
    sunDiscMat.dispose();
    sunHaloMat.dispose();
    sunGlowTex.dispose();
    moonGeom.dispose();
    moonMat.dispose();
    moonHaloMat.dispose();
    starGeom.dispose();
    starMat.dispose();
    puffGeom.dispose();
    cloudMat.dispose();
    scene.remove(group);
  };

  return { group, sunDirection, update, dispose };
}

/**
 * Synchronizes Sky, Sun Direction, Ambient Light, and Fog with Gaithersburg, Maryland Live Time and Weather
 */
export function updateSceneDiurnalLighting(
  scene: THREE.Scene,
  sunLight: THREE.DirectionalLight,
  ambientLight: THREE.AmbientLight,
  hemiLight: THREE.HemisphereLight,
  weather: GaithersburgWeather,
  isUltra: boolean
): void {
  const sunAlt = weather.sunAltitude; // -1 (midnight) to +1 (noon)
  const isSnow = weather.isSnowing;
  const isRain = weather.isRaining;
  const isFog = weather.isFoggy;
  const isOvercast = weather.condition === 'overcast' || weather.cloudCover >= 75;
  const isPartlyCloudy = !isOvercast && (weather.condition === 'partly_cloudy' || weather.cloudCover >= 30);

  if (sunAlt > 0.08) {
    // ------------------------------------------------------------------
    // DAYTIME (Gaithersburg Sun Above Horizon)
    // ------------------------------------------------------------------
    if (isSnow) {
      setBgHex(scene, 0xb0bec5);
      if (scene.fog) {
        scene.fog.color.setHex(0xcfd8dc);
        (scene.fog as THREE.FogExp2).density = 0.0038;
      }
      sunLight.color.setHex(0xffffff);
      sunLight.intensity = isUltra ? 1.0 : 1.25;
      ambientLight.color.setHex(0xe2e8f0);
      ambientLight.intensity = 0.85;
      hemiLight.color.setHex(0xe2e8f0);
      hemiLight.groundColor.setHex(0x94a3b8);
    } else if (isRain) {
      setBgHex(scene, 0x334155);
      if (scene.fog) {
        scene.fog.color.setHex(0x475569);
        (scene.fog as THREE.FogExp2).density = 0.0046;
      }
      sunLight.color.setHex(0x94a3b8);
      sunLight.intensity = isUltra ? 0.68 : 0.9;
      ambientLight.color.setHex(0x64748b);
      ambientLight.intensity = 0.68;
      hemiLight.color.setHex(0x64748b);
      hemiLight.groundColor.setHex(0x334155);
    } else if (isFog) {
      setBgHex(scene, 0xa8b5c4);
      if (scene.fog) {
        scene.fog.color.setHex(0xa8b5c4);
        (scene.fog as THREE.FogExp2).density = 0.0068;
      }
      sunLight.color.setHex(0xfef08a);
      sunLight.intensity = isUltra ? 0.82 : 1.05;
      ambientLight.color.setHex(0xa1a1aa);
      ambientLight.intensity = 0.76;
      hemiLight.color.setHex(0x94a3b8);
      hemiLight.groundColor.setHex(0x475569);
    } else if (isOvercast) {
      // Cloudy / Overcast Maryland Sky (cool grey-blue overcast diffused light)
      setBgHex(scene, 0x9fb0c2);
      if (scene.fog) {
        scene.fog.color.setHex(0x9fb0c2);
        (scene.fog as THREE.FogExp2).density = 0.0018;
      }
      sunLight.color.setHex(0xe2e8f0);
      sunLight.intensity = isUltra ? 0.92 : 1.18;
      ambientLight.color.setHex(0xcbd5e1);
      ambientLight.intensity = 0.82;
      hemiLight.color.setHex(0xcbd5e1);
      hemiLight.groundColor.setHex(0x475569);
    } else if (isPartlyCloudy) {
      // Partly Cloudy Sunny Maryland Day
      setBgHex(scene, 0xc6dcf0);
      if (scene.fog) {
        scene.fog.color.setHex(0xc6dcf0);
        (scene.fog as THREE.FogExp2).density = 0.00105;
      }
      sunLight.color.setHex(0xfff7e6);
      sunLight.intensity = isUltra ? 1.38 : 1.75;
      ambientLight.color.setHex(0xf8fafc);
      ambientLight.intensity = 0.86;
      hemiLight.color.setHex(0xa6d2fa);
      hemiLight.groundColor.setHex(0x39473a);
    } else {
      // Crisp Clear Sunny Maryland Sky (horizon fog matches Piedmont sky horizon)
      setBgHex(scene, 0xc4def4);
      if (scene.fog) {
        scene.fog.color.setHex(0xc4def4);
        (scene.fog as THREE.FogExp2).density = 0.00085;
      }
      sunLight.color.setHex(0xfff6e3);
      sunLight.intensity = isUltra ? 1.52 : 1.92;
      ambientLight.color.setHex(0xffffff);
      ambientLight.intensity = 0.90;
      hemiLight.color.setHex(0x98ccfc);
      hemiLight.groundColor.setHex(0x3c4a3c);
    }
  } else if (sunAlt >= -0.08) {
    // ------------------------------------------------------------------
    // DAWN / DUSK (Maryland Golden Hour)
    // ------------------------------------------------------------------
    if (isOvercast || isRain || isSnow) {
      setBgHex(scene, 0x94a3b8);
      if (scene.fog) {
        scene.fog.color.setHex(0x94a3b8);
        (scene.fog as THREE.FogExp2).density = 0.0028;
      }
      sunLight.color.setHex(0xcbd5e1);
      sunLight.intensity = isUltra ? 0.72 : 0.92;
      ambientLight.color.setHex(0x94a3b8);
      ambientLight.intensity = 0.65;
    } else {
      setBgHex(scene, 0xf09260);
      if (scene.fog) {
        scene.fog.color.setHex(0xf09260);
        (scene.fog as THREE.FogExp2).density = 0.0018;
      }
      sunLight.color.setHex(0xfb923c);
      sunLight.intensity = isUltra ? 1.15 : 1.45;
      ambientLight.color.setHex(0xfed7aa);
      ambientLight.intensity = 0.75;
    }
  } else {
    // ------------------------------------------------------------------
    // NIGHTTIME (Gaithersburg Midnight / Cool Moonlit Sky)
    // ------------------------------------------------------------------
    setBgHex(scene, 0x030712);
    if (scene.fog) {
      scene.fog.color.setHex(0x0f172a);
      (scene.fog as THREE.FogExp2).density = 0.002;
    }
    sunLight.color.setHex(0x60a5fa);
    sunLight.intensity = isUltra ? 0.3 : 0.44;
    ambientLight.color.setHex(0x1e293b);
    ambientLight.intensity = 0.5;
    hemiLight.color.setHex(0x1e293b);
    hemiLight.groundColor.setHex(0x090d16);
  }
}
