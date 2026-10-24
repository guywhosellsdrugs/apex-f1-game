import * as THREE from 'three';
import { GeneratedTrack } from './trackGenerator';

export interface PracticeLineCoachData {
  zone: 'accelerate' | 'coast' | 'brake';
  targetSpeedKmh: number;
  lineOffsetErrorMeters: number; // < 0 means optimal line is to player's left, > 0 means to player's right
  turnDirection: 'left' | 'right' | 'straight';
  upcomingCornerSpeedKmh: number;
}

export interface BuiltRacingLine {
  group: THREE.Group;
  update: (playerProgress: number, playerSpeedKmh: number, playerLateralOffset: number) => PracticeLineCoachData;
}

export function buildPracticeRacingLine(track: GeneratedTrack): BuiltRacingLine {
  const group = new THREE.Group();
  const segments = 720;
  const up = new THREE.Vector3(0, 1, 0);

  // 1. Pre-compute curvature, turn direction, target speed, and Out-In-Out optimal lateral offsets
  const rawOffsets = new Float32Array(segments);
  const pointTargetSpeeds = new Float32Array(segments);
  const turnDirections = new Int8Array(segments); // -1 = left, 1 = right, 0 = straight
  const curvatureMag = new Float32Array(segments);

  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const tPrev = ((t - 0.012) % 1 + 1) % 1;
    const tNext = (t + 0.012) % 1;

    const tanPrev = track.curve.getTangentAt(tPrev).normalize();
    const tanNext = track.curve.getTangentAt(tNext).normalize();

    const dot = THREE.MathUtils.clamp(tanPrev.dot(tanNext), -1, 1);
    const angle = Math.acos(dot);
    curvatureMag[i] = angle;

    // 2D cross product in XZ plane determines left vs right bend
    // Note: right vector = tangent x up = (tan.z, 0, -tan.x) or similar
    const rightVec = new THREE.Vector3().crossVectors(tanPrev, up).normalize();
    const turnSign = Math.sign(tanNext.dot(rightVec)); // +1 if turning right (+normal), -1 if turning left (-normal)

    if (angle > 0.065) {
      turnDirections[i] = turnSign >= 0 ? 1 : -1;
    } else {
      turnDirections[i] = 0;
    }

    pointTargetSpeeds[i] = track.getTargetCornerSpeedKmh(t);
  }

  // Compute Out-In-Out racing line lateral offsets:
  // - At apex (high curvature): hug the inside curb (turnSign * +6.8m)
  // - Approaching corner (20-75m before apex) & exiting corner (15-55m after apex): swing wide to outside (-turnSign * 5.4m)
  for (let i = 0; i < segments; i++) {
    const curAngle = curvatureMag[i];
    const curTurn = turnDirections[i];

    // Look ahead ~22 steps (~3% of track) for upcoming apex
    let maxAheadAngle = 0;
    let aheadTurn = 0;
    for (let step = 6; step <= 26; step++) {
      const idxAhead = (i + step) % segments;
      if (curvatureMag[idxAhead] > maxAheadAngle) {
        maxAheadAngle = curvatureMag[idxAhead];
        aheadTurn = turnDirections[idxAhead];
      }
    }

    // Look behind ~18 steps for recent apex (corner exit track-out)
    let maxBehindAngle = 0;
    let behindTurn = 0;
    for (let step = 5; step <= 20; step++) {
      const idxBehind = (i - step + segments) % segments;
      if (curvatureMag[idxBehind] > maxBehindAngle) {
        maxBehindAngle = curvatureMag[idxBehind];
        behindTurn = turnDirections[idxBehind];
      }
    }

    if (curAngle > 0.11 && curTurn !== 0) {
      // Inside apex clipping
      const apexIntensity = Math.min(1.0, (curAngle - 0.06) / 0.35);
      rawOffsets[i] = curTurn * (4.2 + apexIntensity * 3.0);
    } else if (maxAheadAngle > 0.13 && aheadTurn !== 0) {
      // Corner entry: swing wide to outside to open up braking & turn-in radius
      rawOffsets[i] = -aheadTurn * 5.2;
    } else if (maxBehindAngle > 0.13 && behindTurn !== 0) {
      // Corner exit: track out wide toward exit curb under full throttle
      rawOffsets[i] = -behindTurn * 4.8;
    } else {
      rawOffsets[i] = 0;
    }
  }

  // Smooth the Out-In-Out lateral offsets around the closed loop (8 passes of circular smoothing)
  let smoothedOffsets = new Float32Array(rawOffsets);
  for (let pass = 0; pass < 8; pass++) {
    const nextPass = new Float32Array(segments);
    const radius = 9;
    for (let i = 0; i < segments; i++) {
      let sum = 0;
      let weightSum = 0;
      for (let k = -radius; k <= radius; k++) {
        const idx = (i + k + segments) % segments;
        const w = radius + 1 - Math.abs(k);
        sum += smoothedOffsets[idx] * w;
        weightSum += w;
      }
      nextPass[i] = THREE.MathUtils.clamp(sum / weightSum, -7.8, 7.8);
    }
    smoothedOffsets = nextPass;
  }

  // Pre-compute baseline braking/coasting/acceleration speed profile around the loop
  // Work backwards from slow corners using realistic F1 deceleration so braking zones start at the exact right distance
  const optimalSpeedProfile = new Float32Array(segments);
  for (let i = 0; i < segments; i++) {
    optimalSpeedProfile[i] = pointTargetSpeeds[i];
  }

  const segLengthMeters = track.trackLength / segments;
  const maxBrakingDecelMs2 = 34.0; // ~3.5G F1 braking zone deceleration
  for (let pass = 0; pass < 2; pass++) {
    for (let i = segments - 1; i >= 0; i--) {
      const nextIdx = (i + 1) % segments;
      const vNextMs = optimalSpeedProfile[nextIdx] / 3.6;
      // v_curr = sqrt(v_next^2 + 2 * a * d)
      const vMaxEntryMs = Math.sqrt(vNextMs * vNextMs + 2 * maxBrakingDecelMs2 * segLengthMeters);
      const vMaxEntryKmh = vMaxEntryMs * 3.6;
      if (vMaxEntryKmh < optimalSpeedProfile[i]) {
        optimalSpeedProfile[i] = vMaxEntryKmh;
      }
    }
  }

  // 2. Build Continuous 3D Racing Line Ribbon Geometry + Raised Directional Chevrons
  const lineHalfWidth = 0.72;
  const ribbonGeom = new THREE.BufferGeometry();
  const ribbonVerts: number[] = [];
  const ribbonColors: number[] = [];
  const ribbonIndices: number[] = [];

  const lineWorldPoints: THREE.Vector3[] = [];
  const lineTangents: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const idx = i % segments;
    const t = idx / segments;
    const { position, tangent, normal } = track.getTrackPointAtProgress(t);
    const optOffset = smoothedOffsets[idx];

    const centerPt = position.clone().addScaledVector(normal, optOffset);
    centerPt.y = position.y + 0.14; // Elevated slightly above asphalt to prevent z-fighting
    lineWorldPoints.push(centerPt);
    lineTangents.push(tangent.clone());

    const leftPt = centerPt.clone().addScaledVector(normal, -lineHalfWidth);
    const rightPt = centerPt.clone().addScaledVector(normal, lineHalfWidth);

    ribbonVerts.push(leftPt.x, leftPt.y, leftPt.z);
    ribbonVerts.push(rightPt.x, rightPt.y, rightPt.z);

    // Default emerald green
    ribbonColors.push(0.0, 0.95, 0.45);
    ribbonColors.push(0.0, 0.95, 0.45);

    if (i < segments) {
      const base = i * 2;
      ribbonIndices.push(base, base + 1, base + 2);
      ribbonIndices.push(base + 1, base + 3, base + 2);
    }
  }

  ribbonGeom.setAttribute('position', new THREE.Float32BufferAttribute(ribbonVerts, 3));
  const ribbonColorAttr = new THREE.Float32BufferAttribute(ribbonColors, 3);
  ribbonGeom.setAttribute('color', ribbonColorAttr);
  ribbonGeom.setIndex(ribbonIndices);

  const ribbonMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  const ribbonMesh = new THREE.Mesh(ribbonGeom, ribbonMat);
  group.add(ribbonMesh);

  // Build Directional Forward Chevrons along the Racing Line (every 2 segments) for crisp visual speed & braking cues
  const chevronGeom = new THREE.BufferGeometry();
  const chevronVerts: number[] = [];
  const chevronColors: number[] = [];
  const chevronIndices: number[] = [];
  const chevronSegmentMap: number[] = [];

  let chevCount = 0;
  for (let i = 0; i < segments; i += 2) {
    const t = i / segments;
    const { position, tangent, normal } = track.getTrackPointAtProgress(t);
    const optOffset = smoothedOffsets[i];

    const center = position.clone().addScaledVector(normal, optOffset);
    center.y = position.y + 0.17;

    // Chevron pointing forward along tangent
    const tip = center.clone().addScaledVector(tangent, 1.5);
    const backLeft = center.clone().addScaledVector(tangent, -0.9).addScaledVector(normal, -1.35);
    const backRight = center.clone().addScaledVector(tangent, -0.9).addScaledVector(normal, 1.35);
    const innerBack = center.clone().addScaledVector(tangent, 0.15);

    const vBase = chevCount * 4;
    chevronVerts.push(
      tip.x, tip.y, tip.z,
      backLeft.x, backLeft.y, backLeft.z,
      innerBack.x, innerBack.y, innerBack.z,
      backRight.x, backRight.y, backRight.z
    );

    for (let c = 0; c < 4; c++) {
      chevronColors.push(0.0, 1.0, 0.5);
    }

    chevronIndices.push(vBase, vBase + 1, vBase + 2);
    chevronIndices.push(vBase, vBase + 2, vBase + 3);

    chevronSegmentMap.push(i);
    chevCount++;
  }

  chevronGeom.setAttribute('position', new THREE.Float32BufferAttribute(chevronVerts, 3));
  const chevronColorAttr = new THREE.Float32BufferAttribute(chevronColors, 3);
  chevronGeom.setAttribute('color', chevronColorAttr);
  chevronGeom.setIndex(chevronIndices);

  const chevronMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const chevronMesh = new THREE.Mesh(chevronGeom, chevronMat);
  group.add(chevronMesh);

  // 3. Real-time update function called each frame in Practice Mode
  const update = (
    playerProgress: number,
    playerSpeedKmh: number,
    playerLateralOffset: number
  ): PracticeLineCoachData => {
    const normProg = ((playerProgress % 1) + 1) % 1;
    const playerSegIdx = Math.floor(normProg * segments) % segments;
    const absSpeed = Math.abs(playerSpeedKmh);

    // Update vertex colors along the track based on optimal braking zones + live player speed relative to upcoming corner
    const rColors = ribbonColorAttr.array as Float32Array;
    for (let i = 0; i <= segments; i++) {
      const idx = i % segments;
      const nextIdx = (idx + 3) % segments;
      const lookIdx = (idx + 8) % segments;

      const optNow = optimalSpeedProfile[idx];
      const optNext = optimalSpeedProfile[nextIdx];
      const pointCap = pointTargetSpeeds[idx];
      const lookCap = pointTargetSpeeds[lookIdx];

      // Distance in segments ahead of player (0..segments)
      const segsAhead = (idx - playerSegIdx + segments) % segments;
      const isNearPlayerAhead = segsAhead <= 55; // Within ~400m ahead of player

      // Determine zone: 'brake' (Red), 'coast' (Amber/Yellow), 'accelerate' (Green)
      let r = 0.0;
      let g = 0.96;
      let b = 0.42;

      const isGeometryBrakingZone = optNext < optNow - 3.2 || (lookCap < pointCap - 35 && optNow > lookCap + 10);
      const isApexTurnZone = pointCap < 245 && !isGeometryBrakingZone && optNext <= optNow + 2.0;

      // Dynamic speed-adaptive highlight for the track section directly in front of the player
      const playerOverspeedForZone = isNearPlayerAhead && segsAhead <= 24 && absSpeed > optNow + 14;
      const playerCoastForZone = isNearPlayerAhead && segsAhead <= 20 && absSpeed > optNow - 6 && absSpeed <= optNow + 14 && pointCap < 290;

      if (isGeometryBrakingZone || playerOverspeedForZone) {
        // VIVID CRIMSON RED — BRAKE NOW!
        r = 1.0;
        g = 0.08;
        b = 0.22;
      } else if (isApexTurnZone || playerCoastForZone) {
        // VIVID AMBER / YELLOW — LIFT / TURN-IN APEX
        r = 1.0;
        g = 0.82;
        b = 0.0;
      } else {
        // LUMINOUS EMERALD GREEN — FULL THROTTLE ACCELERATE
        r = 0.0;
        g = 0.96;
        b = 0.44;
      }

      const vBase = i * 6;
      rColors[vBase] = r;
      rColors[vBase + 1] = g;
      rColors[vBase + 2] = b;
      rColors[vBase + 3] = r;
      rColors[vBase + 4] = g;
      rColors[vBase + 5] = b;
    }
    ribbonColorAttr.needsUpdate = true;

    // Sync chevron colors with their corresponding ribbon segments
    const cColors = chevronColorAttr.array as Float32Array;
    for (let c = 0; c < chevCount; c++) {
      const segIdx = chevronSegmentMap[c];
      const rBase = segIdx * 6;
      const r = rColors[rBase];
      const g = rColors[rBase + 1];
      const b = rColors[rBase + 2];

      const cBase = c * 12;
      for (let v = 0; v < 4; v++) {
        cColors[cBase + v * 3] = r;
        cColors[cBase + v * 3 + 1] = g;
        cColors[cBase + v * 3 + 2] = b;
      }
    }
    chevronColorAttr.needsUpdate = true;

    // Compute live HUD Coaching Cue for player's immediate position & lookahead (next ~85 meters)
    let minUpcomingCornerSpeed = pointTargetSpeeds[playerSegIdx];
    let upcomingTurnDir: 'left' | 'right' | 'straight' = 'straight';
    for (let step = 1; step <= 18; step++) {
      const lookSeg = (playerSegIdx + step) % segments;
      if (pointTargetSpeeds[lookSeg] < minUpcomingCornerSpeed) {
        minUpcomingCornerSpeed = pointTargetSpeeds[lookSeg];
      }
      if (upcomingTurnDir === 'straight' && turnDirections[lookSeg] !== 0) {
        upcomingTurnDir = turnDirections[lookSeg] < 0 ? 'left' : 'right';
      }
    }

    const optSpeedHere = optimalSpeedProfile[playerSegIdx];
    const optSpeedAhead = optimalSpeedProfile[(playerSegIdx + 4) % segments];
    const isBrakingCue =
      absSpeed > optSpeedHere + 14 ||
      absSpeed > minUpcomingCornerSpeed + 26 ||
      (optSpeedAhead < optSpeedHere - 4.0 && absSpeed > minUpcomingCornerSpeed + 5);

    const isCoastCue =
      !isBrakingCue &&
      ((minUpcomingCornerSpeed < 245 && absSpeed > minUpcomingCornerSpeed - 12) ||
        (pointTargetSpeeds[playerSegIdx] < 230 && optSpeedAhead <= optSpeedHere + 2.5));

    const zone: 'accelerate' | 'coast' | 'brake' = isBrakingCue
      ? 'brake'
      : isCoastCue
      ? 'coast'
      : 'accelerate';

    const optimalOffsetNow = smoothedOffsets[playerSegIdx];
    const lineOffsetErrorMeters = optimalOffsetNow - playerLateralOffset;

    return {
      zone,
      targetSpeedKmh: Math.round(Math.min(optSpeedHere, minUpcomingCornerSpeed)),
      lineOffsetErrorMeters,
      turnDirection: upcomingTurnDir,
      upcomingCornerSpeedKmh: Math.round(minUpcomingCornerSpeed),
    };
  };

  return {
    group,
    update,
  };
}
