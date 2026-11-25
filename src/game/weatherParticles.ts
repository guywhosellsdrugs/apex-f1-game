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

  const COUNT = isRetroPixel ? 96 : 600;
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

export interface SkyCelestialAndCloudsSystem {
  group: THREE.Group;
  sunDirection: THREE.Vector3;
  update: (carPos: THREE.Vector3, weather: GaithersburgWeather, dt: number, farScale?: number) => void;
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
 * Computes real Gaithersburg Sun vector in Three.js world space (North = -Z, East = +X, South = +Z, Up = +Y)
 * using astronomical solar azimuth and elevation for Gaithersburg, MD (39.1434° N, 77.2014° W).
 */
export function computeGaithersburgSunVector(weather: GaithersburgWeather, outVec: THREE.Vector3): THREE.Vector3 {
  const azRad = ((weather.sunAzimuthDeg ?? 180) * Math.PI) / 180;
  const trueElevDeg = weather.sunElevationDeg ?? (Math.asin(THREE.MathUtils.clamp(weather.sunAltitude, -1, 1)) * 180) / Math.PI;
  // Compress high midday peak (~74° in June) slightly into ~42° so sun arcs gracefully across driving camera FOV,
  // while keeping low sunrise/sunset (-4°..+14°) faithful to the horizon!
  const mappedElevDeg =
    trueElevDeg >= 0
      ? Math.min(44, trueElevDeg <= 14 ? trueElevDeg : 14 + (trueElevDeg - 14) * 0.5)
      : Math.max(-28, trueElevDeg * 0.85);
  const elevRad = (mappedElevDeg * Math.PI) / 180;
  const cosElev = Math.cos(elevRad);

  // North = -Z, East = +X, South = +Z, West = -X
  outVec.set(
    Math.sin(azRad) * cosElev,
    Math.sin(elevRad),
    -Math.cos(azRad) * cosElev
  );
  return outVec.normalize();
}

/**
 * Sky Celestial & Atmospheric Shader Cloud System for Maryland City Driving:
 * - Smooth vertical + azimuthal sunrise/sunset gradient sky dome following car (R=620 fits inside dynamic far clip >= 700)
 * - Visible Sun disc + radial corona following real Gaithersburg azimuth & elevation
 * - Visible Moon & twinkling Starfield at dusk/night
 * - High-altitude atmospheric cirrus clouds integrated directly into the sky dome shader
 */
export function createSkyCelestialAndCloudsSystem(
  scene: THREE.Scene,
  options?: { isRetroPixel?: boolean }
): SkyCelestialAndCloudsSystem {
  const isRetroPixel = Boolean(options?.isRetroPixel);
  const group = new THREE.Group();
  scene.add(group);

  // 1. Physically-Inspired Maryland Atmospheric Sky Dome Shell (Rayleigh + Mie + Sunrise/Sunset Belt of Venus)
  const skyUniforms = {
    uTopColor: { value: new THREE.Color(0x1b4e8f) },
    uMidColor: { value: new THREE.Color(0x5294d4) },
    uHorizonColor: { value: new THREE.Color(0xc4def4) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.35, 0.85).normalize() },
    uSunGlowColor: { value: new THREE.Color(0xfff1c9) },
    uTwilightColor: { value: new THREE.Color(0xf97316) },
    uAntiSolarColor: { value: new THREE.Color(0xb87596) },
    uTwilightStrength: { value: 0.0 },
    uSunScatter: { value: 0.95 },
    uCirrusAmount: { value: isRetroPixel ? 0.0 : 0.22 },
    uTime: { value: 0.0 },
  };
  const skyDomeGeom = new THREE.SphereGeometry(620, isRetroPixel ? 16 : 32, isRetroPixel ? 12 : 22);
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
      uniform vec3 uTwilightColor;
      uniform vec3 uAntiSolarColor;
      uniform float uTwilightStrength;
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
        vec3 sDir = normalize(uSunDir);

        // Rayleigh zenith -> cerulean mid-sky -> humid Chesapeake/Piedmont horizon gradient
        vec3 col = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.24, h));
        col = mix(col, uTopColor, smoothstep(0.20, 0.86, h));

        // Soft atmospheric mist right along horizon line
        float horizonMist = exp(-h * 11.5);
        col = mix(col, uHorizonColor, horizonMist * 0.68);

        // Azimuthal Sunrise / Sunset Directional Glow & Opposite-Sky Belt of Venus
        if (uTwilightStrength > 0.005) {
          vec2 dirH = normalize(vec2(dir.x, dir.z) + vec2(1e-5));
          vec2 sunH = normalize(vec2(sDir.x, sDir.z) + vec2(1e-5));
          float towardSun = max(dot(dirH, sunH), 0.0);
          float awaySun = max(dot(dirH, -sunH), 0.0);
          float lowSkyMask = exp(-h * 5.2);
          float pinkBandMask = exp(-pow((h - 0.075) * 9.0, 2.0));

          col = mix(col, uTwilightColor, pow(towardSun, 2.4) * lowSkyMask * uTwilightStrength * 0.85);
          col = mix(col, uAntiSolarColor, pow(awaySun, 1.8) * pinkBandMask * uTwilightStrength * 0.52);
        }

        // Mie forward solar scattering + crisp sun aureole
        float sunCos = max(dot(dir, sDir), 0.0);
        float wideScatter = pow(sunCos, 5.0) * 0.24 * uSunScatter;
        float innerCorona = pow(sunCos, 44.0) * 0.55 * uSunScatter;
        float solarCore = smoothstep(0.9965, 0.9994, sunCos) * 0.85 * uSunScatter;
        col += uSunGlowColor * (wideScatter + innerCorona + solarCore);

        // Delicate high-altitude cirrus wisps illuminated warmly at sunrise/sunset
        if (uCirrusAmount > 0.01 && h > 0.04) {
          vec2 skyUv = dir.xz / (h + 0.16);
          vec2 p = skyUv * vec2(1.7, 3.1) + vec2(uTime * 0.0045, uTime * 0.002);
          float f = noise2d(p) * 0.62 + noise2d(p * 2.3 + vec2(3.7, 1.9)) * 0.38;
          float streak = smoothstep(0.56, 0.86, f) * smoothstep(0.04, 0.28, h) * (1.0 - smoothstep(0.72, 1.0, h));
          vec3 cirrusBase = mix(vec3(0.96, 0.98, 1.0), uTwilightColor, uTwilightStrength * 0.78);
          vec3 cirrusCol = mix(cirrusBase, uSunGlowColor, wideScatter * 0.75);
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
    const r = 580;
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

  const sunDirection = new THREE.Vector3(0.4, 0.8, 0.3).normalize();
  const scratchHiddenColor = new THREE.Color(0xffffff);
  const scratchDayTop = new THREE.Color(0x1b4e8f);
  const scratchDayMid = new THREE.Color(0x4e91d4);
  const scratchDayHor = new THREE.Color(0xc4def4);
  const scratchTwiTop = new THREE.Color(0x192544);
  const scratchTwiMid = new THREE.Color(0x844769);
  const scratchTwiHor = new THREE.Color(0xee7848);
  const scratchNightTop = new THREE.Color(0x020617);
  const scratchNightMid = new THREE.Color(0x080f21);
  const scratchNightHor = new THREE.Color(0x131d33);

  const update = (carPos: THREE.Vector3, weather: GaithersburgWeather, dt: number, farScale = 1.0) => {
    const skyScale = THREE.MathUtils.clamp(farScale, 0.44, 1.0);

    // Anchor sky dome & starfield around player car (horizon stays seamlessly at Y=0)
    skyDomeMesh.position.set(carPos.x, 0, carPos.z);
    skyDomeMesh.scale.setScalar(skyScale);
    starPoints.position.set(carPos.x, 0, carPos.z);
    starPoints.scale.setScalar(skyScale);

    skyUniforms.uTime.value += dt;

    // 1. Update Sun & Moon Positions from Real Gaithersburg Time & Solar Altitude
    computeGaithersburgSunVector(weather, sunDirection);
    skyUniforms.uSunDir.value.copy(sunDirection);
    const orbitR = 540 * skyScale;
    sunGroup.position.set(
      carPos.x + sunDirection.x * orbitR,
      sunDirection.y * orbitR,
      carPos.z + sunDirection.z * orbitR
    );
    sunDiscMesh.scale.setScalar(skyScale);

    const elevDeg = weather.sunElevationDeg ?? (Math.asin(THREE.MathUtils.clamp(weather.sunAltitude, -1, 1)) * 180) / Math.PI;
    const cloudFrac = THREE.MathUtils.clamp(weather.cloudCover / 100, 0, 1);
    const stormVeil =
      weather.isRaining || weather.isSnowing
        ? 0.92
        : weather.isFoggy
        ? 0.85
        : weather.condition === 'overcast'
        ? 0.76
        : weather.condition === 'clear'
        ? 0.0 // Clear skies reveal the sun cleanly even right along sunrise/sunset
        : cloudFrac * 0.34;
    const sunVisFactor = THREE.MathUtils.clamp((elevDeg + 2.5) / 6.0, 0, 1) * (1 - stormVeil);

    // Continuous atmospheric twilight factor: peaks around -1°..+5° (true sunrise & golden sunset!)
    const dayWeight = THREE.MathUtils.smoothstep(elevDeg, -1.5, 14.0);
    const twilightPeak = Math.exp(-Math.pow((elevDeg - 1.5) / 7.2, 2.0));
    const nightWeight = 1.0 - THREE.MathUtils.smoothstep(elevDeg, -11.0, 0.5);
    const clearSkyFactor = 1.0 - Math.min(1, stormVeil * 1.15);

    sunGroup.visible = sunVisFactor > 0.02;
    if (sunGroup.visible) {
      const goldenBlend = THREE.MathUtils.clamp(1.0 - Math.max(0, elevDeg) / 18.0, 0, 1);
      sunDiscMat.color.setHex(0xfffef2).lerp(scratchHiddenColor.setHex(0xfb7125), goldenBlend * 0.85);
      sunDiscMat.opacity = Math.min(1, sunVisFactor * 1.15);
      sunHaloMat.color.setHex(0xfef3c7).lerp(scratchHiddenColor.setHex(0xf97316), goldenBlend * 0.88);
      sunHaloMat.opacity = sunVisFactor * 0.94;
      const haloScale = (155 + goldenBlend * 75) * skyScale;
      sunHaloSprite.scale.set(haloScale, haloScale, 1);
      skyUniforms.uSunGlowColor.value.copy(sunHaloMat.color);
      skyUniforms.uSunScatter.value = sunVisFactor;
    } else {
      skyUniforms.uSunScatter.value = Math.max(0, THREE.MathUtils.clamp((elevDeg + 7) / 10, 0, 1) * 0.25);
    }

    skyUniforms.uTwilightStrength.value = twilightPeak * clearSkyFactor;
    // Sunrise is crisp coral-amber; sunset deepens to rich Chesapeake crimson-gold
    const isMorningSide = (weather.sunAzimuthDeg ?? 180) < 180;
    skyUniforms.uTwilightColor.value.setHex(isMorningSide ? 0xfb923c : 0xea580c);
    skyUniforms.uAntiSolarColor.value.setHex(isMorningSide ? 0xa5b4fc : 0xc08497);

    // Moon sits across the sky opposite the sun at night/twilight
    const moonVis = nightWeight * (weather.isRaining || weather.isSnowing || weather.condition === 'overcast' ? 0.14 : 1.0);
    moonGroup.visible = moonVis > 0.04;
    if (moonGroup.visible) {
      moonGroup.position.set(
        carPos.x - sunDirection.x * orbitR * 0.86,
        Math.max(80 * skyScale, -sunDirection.y * orbitR * 0.85 + 140 * skyScale),
        carPos.z - sunDirection.z * orbitR * 0.86
      );
      moonGroup.scale.setScalar(skyScale);
      moonMat.opacity = moonVis * 0.95;
      moonHaloMat.opacity = moonVis * 0.35;
    }

    starPoints.visible = nightWeight > 0.12 && cloudFrac < 0.88 && !weather.isRaining && !weather.isSnowing;
    if (starPoints.visible) {
      starMat.opacity = nightWeight * (1 - cloudFrac * 0.85) * 0.92;
    }

    // 2. Smooth Continuous Sky Dome Interpolation (Night -> Astronomical/Civil Twilight -> Sunrise/Sunset -> Daylight)
    scratchDayTop.setHex(0x1b4e8f);
    scratchDayMid.setHex(0x4e91d4);
    scratchDayHor.setHex(0xc4def4);

    if (weather.isSnowing) {
      scratchDayTop.setHex(0x7c8ea0);
      scratchDayMid.setHex(0x9fb0c0);
      scratchDayHor.setHex(0xcfd8dc);
    } else if (weather.isRaining) {
      scratchDayTop.setHex(0x1e293b);
      scratchDayMid.setHex(0x334155);
      scratchDayHor.setHex(0x475569);
    } else if (weather.isFoggy) {
      scratchDayTop.setHex(0x6e8094);
      scratchDayMid.setHex(0x8c9bad);
      scratchDayHor.setHex(0xa8b5c4);
    } else if (weather.condition === 'overcast' || weather.cloudCover >= 75) {
      scratchDayTop.setHex(0x526377);
      scratchDayMid.setHex(0x758699);
      scratchDayHor.setHex(0x9fb0c2);
    } else if (weather.condition === 'partly_cloudy' || weather.cloudCover >= 30) {
      scratchDayTop.setHex(0x215ea8);
      scratchDayMid.setHex(0x5d9cd8);
      scratchDayHor.setHex(0xc6dcf0);
    }

    scratchTwiTop.setHex(weather.isRaining ? 0x1e293b : isMorningSide ? 0x1e3a5f : 0x192544);
    scratchTwiMid.setHex(weather.isRaining ? 0x475569 : isMorningSide ? 0x6b5b7b : 0x844769);
    scratchTwiHor.setHex(weather.isRaining ? 0x64748b : isMorningSide ? 0xf6a46c : 0xee7848);

    scratchNightTop.setHex(0x020617);
    scratchNightMid.setHex(0x080f21);
    scratchNightHor.setHex(0x131d33);

    // Blend night -> daylight, then blend in twilight peak around sunrise/sunset
    skyUniforms.uTopColor.value
      .copy(scratchNightTop)
      .lerp(scratchDayTop, dayWeight)
      .lerp(scratchTwiTop, twilightPeak * 0.78);
    skyUniforms.uMidColor.value
      .copy(scratchNightMid)
      .lerp(scratchDayMid, dayWeight)
      .lerp(scratchTwiMid, twilightPeak * 0.85);
    skyUniforms.uHorizonColor.value
      .copy(scratchNightHor)
      .lerp(scratchDayHor, dayWeight)
      .lerp(scratchTwiHor, twilightPeak * 0.9);

    if (weather.isSnowing || weather.isRaining || weather.isFoggy) {
      skyUniforms.uCirrusAmount.value = 0.0;
    } else {
      const skyCloudDensity =
        weather.condition === 'overcast' || weather.cloudCover >= 75
          ? 0.42
          : weather.condition === 'partly_cloudy' || weather.cloudCover >= 30
          ? 0.34
          : weather.cloudCover >= 8
          ? 0.22
          : 0.1;
      skyUniforms.uCirrusAmount.value =
        isRetroPixel || skyScale < 0.72
          ? 0.0
          : skyCloudDensity * (0.35 + 0.65 * dayWeight + twilightPeak * 0.25);
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
    scene.remove(group);
  };

  return { group, sunDirection, update, dispose };
}

const _diurnalTmpA = new THREE.Color();
const _diurnalTmpB = new THREE.Color();
const _diurnalTmpC = new THREE.Color();

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
  const elevDeg =
    weather.sunElevationDeg ??
    (Math.asin(THREE.MathUtils.clamp(weather.sunAltitude, -1, 1)) * 180) / Math.PI;
  const isSnow = weather.isSnowing;
  const isRain = weather.isRaining;
  const isFog = weather.isFoggy;
  const isOvercast = weather.condition === 'overcast' || weather.cloudCover >= 75;
  const isPartlyCloudy = !isOvercast && (weather.condition === 'partly_cloudy' || weather.cloudCover >= 30);

  const dayWeight = THREE.MathUtils.smoothstep(elevDeg, -2.0, 14.0);
  const twilightPeak = Math.exp(-Math.pow((elevDeg - 1.2) / 6.8, 2.0));

  // Target daytime weather palette calibrated for AgX HDR + natural PMREM IBL contrast
  let dayFogHex = 0xc5ddf5;
  let dayFogDensity = 0.00056;
  let daySunHex = 0xfff7e6;
  let daySunInt = isUltra ? 2.15 : 2.05;
  let dayAmbHex = 0xdbeafe;
  let dayAmbInt = isUltra ? 0.34 : 0.38;
  let dayHemiSky = 0x8cc3fa;
  let dayHemiGnd = 0x364234;

  if (isSnow) {
    dayFogHex = 0xcfd8dc;
    dayFogDensity = 0.0036;
    daySunHex = 0xffffff;
    daySunInt = isUltra ? 1.45 : 1.4;
    dayAmbHex = 0xd8e2ec;
    dayAmbInt = isUltra ? 0.50 : 0.56;
    dayHemiSky = 0xe2e8f0;
    dayHemiGnd = 0x7c8b9b;
  } else if (isRain) {
    dayFogHex = 0x475569;
    dayFogDensity = 0.0044;
    daySunHex = 0x94a3b8;
    daySunInt = isUltra ? 1.0 : 1.05;
    dayAmbHex = 0x64748b;
    dayAmbInt = isUltra ? 0.38 : 0.44;
    dayHemiSky = 0x64748b;
    dayHemiGnd = 0x1e293b;
  } else if (isFog) {
    dayFogHex = 0xa8b5c4;
    dayFogDensity = 0.0064;
    daySunHex = 0xfef08a;
    daySunInt = isUltra ? 1.15 : 1.25;
    dayAmbHex = 0x9ca3af;
    dayAmbInt = isUltra ? 0.44 : 0.50;
    dayHemiSky = 0x94a3b8;
    dayHemiGnd = 0x334155;
  } else if (isOvercast) {
    dayFogHex = 0x9fb0c2;
    dayFogDensity = 0.0016;
    daySunHex = 0xe2e8f0;
    daySunInt = isUltra ? 1.25 : 1.32;
    dayAmbHex = 0xcbd5e1;
    dayAmbInt = isUltra ? 0.44 : 0.50;
    dayHemiSky = 0xcbd5e1;
    dayHemiGnd = 0x334155;
  } else if (isPartlyCloudy) {
    dayFogHex = 0xc6dcf2;
    dayFogDensity = 0.00078;
    daySunHex = 0xfff8ea;
    daySunInt = isUltra ? 1.98 : 1.92;
    dayAmbHex = 0xe2e8f0;
    dayAmbInt = isUltra ? 0.36 : 0.40;
    dayHemiSky = 0x9eccfa;
    dayHemiGnd = 0x323d30;
  }

  // Twilight & Night targets (smoothly blended by true solar elevation)
  const isStormOrOvercast = isOvercast || isRain || isSnow;
  const twiFogHex = isStormOrOvercast ? 0x64748b : 0xeb8454;
  const twiSunHex = isStormOrOvercast ? 0xcbd5e1 : 0xfb923c;
  const twiAmbHex = isStormOrOvercast ? 0x64748b : 0xd99b72;

  const nightFogHex = 0x03050c;
  const nightSunHex = 0x476898;
  const nightSunInt = isUltra ? 0.08 : 0.12;
  const nightAmbHex = 0x090f1d;
  const nightAmbInt = isUltra ? 0.028 : 0.048;

  _diurnalTmpA.setHex(nightFogHex).lerp(_diurnalTmpB.setHex(dayFogHex), dayWeight);
  _diurnalTmpA.lerp(_diurnalTmpC.setHex(twiFogHex), twilightPeak * (isStormOrOvercast ? 0.45 : 0.86));
  if (!(scene.background instanceof THREE.Color)) {
    scene.background = new THREE.Color(_diurnalTmpA.getHex());
  } else {
    scene.background.copy(_diurnalTmpA);
  }
  if (scene.fog) {
    scene.fog.color.copy(_diurnalTmpA);
    const nightFogDensity = isRain || isSnow ? 0.0040 : 0.0022;
    (scene.fog as THREE.FogExp2).density = THREE.MathUtils.lerp(nightFogDensity, dayFogDensity, dayWeight);
  }

  _diurnalTmpA.setHex(nightSunHex).lerp(_diurnalTmpB.setHex(daySunHex), dayWeight);
  _diurnalTmpA.lerp(_diurnalTmpC.setHex(twiSunHex), twilightPeak * (isStormOrOvercast ? 0.35 : 0.90));
  sunLight.color.copy(_diurnalTmpA);
  sunLight.intensity =
    THREE.MathUtils.lerp(nightSunInt, daySunInt, dayWeight) +
    twilightPeak * (isStormOrOvercast ? 0.14 : 0.44);

  _diurnalTmpA.setHex(nightAmbHex).lerp(_diurnalTmpB.setHex(dayAmbHex), dayWeight);
  _diurnalTmpA.lerp(_diurnalTmpC.setHex(twiAmbHex), twilightPeak * 0.65);
  ambientLight.color.copy(_diurnalTmpA);
  ambientLight.intensity = THREE.MathUtils.lerp(nightAmbInt, dayAmbInt, dayWeight);

  hemiLight.color.setHex(0x0c1428).lerp(_diurnalTmpB.setHex(dayHemiSky), dayWeight);
  hemiLight.groundColor.setHex(0x020306).lerp(_diurnalTmpB.setHex(dayHemiGnd), dayWeight);
  hemiLight.intensity = THREE.MathUtils.lerp(isUltra ? 0.055 : 0.085, isUltra ? 0.66 : 0.64, dayWeight);
}
