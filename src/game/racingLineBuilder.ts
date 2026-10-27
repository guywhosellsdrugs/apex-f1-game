import * as THREE from 'three';
import { GeneratedTrack } from './trackGenerator';

export interface PracticeLineCoachData {
  zone: 'accelerate' | 'coast' | 'brake';
  targetSpeedKmh: number;
  lineOffsetErrorMeters: number; // < 0 means optimal line is to player's left, > 0 means to player's right
  turnDirection: 'left' | 'right' | 'straight';
  upcomingCornerSpeedKmh: number;
  distanceToCornerMeters: number;
  recommendedPedalPct: number;
}

export interface BuiltRacingLine {
  group: THREE.Group;
  update: (playerProgress: number, playerSpeedKmh: number, playerLateralOffset: number) => PracticeLineCoachData;
}

export function buildPracticeRacingLine(track: GeneratedTrack): BuiltRacingLine {
  const group = new THREE.Group();
  const segments = 960;
  const up = new THREE.Vector3(0, 1, 0);
  const segLengthMeters = track.trackLength / segments;

  // 1. Sample track curvature, signed turn direction, and corner speed limits around the loop
  const rawOffsets = new Float32Array(segments);
  const pointTargetSpeeds = new Float32Array(segments);
  const turnDirections = new Int8Array(segments); // -1 = left, 1 = right, 0 = straight
  const signedCurvature = new Float32Array(segments);
  const curvatureMag = new Float32Array(segments);

  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const tPrev = ((t - 0.009) % 1 + 1) % 1;
    const tNext = (t + 0.009) % 1;

    const tanPrev = track.curve.getTangentAt(tPrev).normalize();
    const tanNext = track.curve.getTangentAt(tNext).normalize();

    const dot = THREE.MathUtils.clamp(tanPrev.dot(tanNext), -1, 1);
    const angle = Math.acos(dot);
    curvatureMag[i] = angle;

    const rightVec = new THREE.Vector3().crossVectors(tanPrev, up).normalize();
    const turnSign = Math.sign(tanNext.dot(rightVec)) || 1;
    signedCurvature[i] = angle * turnSign;

    if (angle > 0.048) {
      turnDirections[i] = turnSign >= 0 ? 1 : -1;
    } else {
      turnDirections[i] = 0;
    }

    pointTargetSpeeds[i] = track.getTargetCornerSpeedKmh(t);
  }

  // Smooth signed curvature slightly to avoid micro-oscillations
  const smoothSignedCurv = new Float32Array(segments);
  for (let i = 0; i < segments; i++) {
    let sum = 0;
    let wSum = 0;
    for (let k = -5; k <= 5; k++) {
      const idx = (i + k + segments) % segments;
      const w = 6 - Math.abs(k);
      sum += signedCurvature[idx] * w;
      wSum += w;
    }
    smoothSignedCurv[i] = sum / wSum;
  }

  // 2. Compute authentic F1 Out-In-Out racing line lateral offsets:
  //    - Entry phase (up to ~115m before apex): position car wide on outside (-turnSign * 5.8m) for straight-line braking & max turn radius
  //    - Late Apex phase (slightly past geometric corner center): clip inside curb (+turnSign * 6.9m)
  //    - Exit Track-out phase (up to ~85m after apex): run wide to outside curb (-turnSign * 5.8m) on corner exit
  //    - Chicane awareness: if an opposite-direction corner follows immediately, transition smoothly to its entry side
  const entryLookAheadSteps = Math.max(18, Math.min(48, Math.round(115 / segLengthMeters)));
  const exitLookBehindSteps = Math.max(14, Math.min(36, Math.round(85 / segLengthMeters)));

  for (let i = 0; i < segments; i++) {
    // Shift curvature lookup slightly behind (-2 steps) to create a true F1 late-apex clipping point
    const lateApexIdx = (i - 2 + segments) % segments;
    const curSigned = smoothSignedCurv[lateApexIdx];
    const curAngle = Math.abs(curSigned);
    const curTurn = curSigned >= 0 ? 1 : -1;

    // Look ahead for upcoming corner apex
    let maxAheadAngle = 0;
    let aheadTurn = 0;
    let aheadDistSteps = entryLookAheadSteps;
    for (let step = 4; step <= entryLookAheadSteps; step++) {
      const idxAhead = (i + step) % segments;
      const aMag = Math.abs(smoothSignedCurv[idxAhead]);
      if (aMag > maxAheadAngle) {
        maxAheadAngle = aMag;
        aheadTurn = smoothSignedCurv[idxAhead] >= 0 ? 1 : -1;
        aheadDistSteps = step;
      }
    }

    // Look behind for recent corner apex (exit track-out)
    let maxBehindAngle = 0;
    let behindTurn = 0;
    let behindDistSteps = exitLookBehindSteps;
    for (let step = 4; step <= exitLookBehindSteps; step++) {
      const idxBehind = (i - step + segments) % segments;
      const bMag = Math.abs(smoothSignedCurv[idxBehind]);
      if (bMag > maxBehindAngle) {
        maxBehindAngle = bMag;
        behindTurn = smoothSignedCurv[idxBehind] >= 0 ? 1 : -1;
        behindDistSteps = step;
      }
    }

    if (curAngle > 0.075) {
      // Inside apex clipping: deeper clip on tighter corners
      const apexFactor = THREE.MathUtils.clamp((curAngle - 0.05) / 0.28, 0.25, 1.0);
      rawOffsets[i] = curTurn * (4.6 + apexFactor * 2.4);
    } else if (maxAheadAngle > 0.085 && maxBehindAngle > 0.085 && aheadTurn !== behindTurn) {
      // Chicane / S-bend transition: blend smoothly from previous exit into next corner's outside entry
      const blend = aheadDistSteps / (aheadDistSteps + behindDistSteps);
      const entryTarget = -aheadTurn * 5.6;
      const exitTarget = -behindTurn * 5.2;
      rawOffsets[i] = THREE.MathUtils.lerp(entryTarget, exitTarget, blend);
    } else if (maxAheadAngle > 0.085) {
      // Corner approach: swing wide to outside before turn-in
      const entryEnvelope = Math.sin(
        THREE.MathUtils.clamp(1.0 - (aheadDistSteps - 4) / entryLookAheadSteps, 0.15, 1.0) * (Math.PI * 0.5)
      );
      const severity = THREE.MathUtils.clamp((maxAheadAngle - 0.06) / 0.25, 0.4, 1.0);
      rawOffsets[i] = -aheadTurn * (5.9 * entryEnvelope * severity);
    } else if (maxBehindAngle > 0.085) {
      // Corner exit: let car track out wide toward outside exit kerb
      const exitEnvelope = Math.cos(
        THREE.MathUtils.clamp((behindDistSteps - 4) / exitLookBehindSteps, 0, 1.0) * (Math.PI * 0.5)
      );
      const severity = THREE.MathUtils.clamp((maxBehindAngle - 0.06) / 0.25, 0.4, 1.0);
      rawOffsets[i] = -behindTurn * (5.6 * exitEnvelope * severity);
    } else {
      rawOffsets[i] = 0;
    }
  }

  // Smooth the lateral offsets with multi-pass circular Gaussian-like filtering so the spline is ultra-fluid
  let smoothedOffsets = new Float32Array(rawOffsets);
  for (let pass = 0; pass < 12; pass++) {
    const nextPass = new Float32Array(segments);
    const radius = 14;
    for (let i = 0; i < segments; i++) {
      let sum = 0;
      let weightSum = 0;
      for (let k = -radius; k <= radius; k++) {
        const idx = (i + k + segments) % segments;
        // Cosine bell weight
        const w = Math.cos((k / (radius + 1)) * (Math.PI * 0.5));
        sum += smoothedOffsets[idx] * w;
        weightSum += w;
      }
      nextPass[i] = THREE.MathUtils.clamp(sum / weightSum, -7.4, 7.4);
    }
    smoothedOffsets = nextPass;
  }

  // 3. Build a closed 3D CatmullRom spline through the optimal racing line points
  //    Calculate true racing-line curvature (which is flatter than centerline curvature!) to derive accurate apex speeds
  const rawLinePoints: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const { position, normal } = track.getTrackPointAtProgress(t);
    const pt = position.clone().addScaledVector(normal, smoothedOffsets[i]);
    pt.y = position.y + 0.035; // Hug asphalt closely so it never blocks the car or clips front wing
    rawLinePoints.push(pt);
  }
  const racingLineCurve = new THREE.CatmullRomCurve3(rawLinePoints, true, 'centripetal', 0.5);

  // Compute optimal speed profile along the actual racing line (forward acceleration pass + backward braking pass)
  const optimalSpeedProfile = new Float32Array(segments);
  for (let i = 0; i < segments; i++) {
    // Because the Out-In-Out racing line opens up the corner radius, the car can carry ~6-10% more speed through the apex
    optimalSpeedProfile[i] = Math.min(358, pointTargetSpeeds[i] * 1.05);
  }

  // Forward pass: realistic F1 traction/acceleration limit out of corners
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < segments; i++) {
      const prevIdx = (i - 1 + segments) % segments;
      const vPrevMs = optimalSpeedProfile[prevIdx] / 3.6;
      const accelMs2 = Math.max(4.5, 13.5 * (1 - (vPrevMs / 102) * 0.65));
      const vMaxNextKmh = Math.sqrt(vPrevMs * vPrevMs + 2 * accelMs2 * segLengthMeters) * 3.6;
      if (vMaxNextKmh < optimalSpeedProfile[i]) {
        optimalSpeedProfile[i] = vMaxNextKmh;
      }
    }
  }

  // Backward pass: realistic F1 aerodynamic + mechanical braking deceleration (up to 4.2G at high speed, ~2.8G at low speed)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = segments - 1; i >= 0; i--) {
      const nextIdx = (i + 1) % segments;
      const vNextMs = optimalSpeedProfile[nextIdx] / 3.6;
      const aeroFactor = Math.min(1.0, (vNextMs / 85) * (vNextMs / 85));
      const decelMs2 = 25.0 + 14.5 * aeroFactor;
      const vMaxEntryKmh = Math.sqrt(vNextMs * vNextMs + 2 * decelMs2 * segLengthMeters) * 3.6;
      if (vMaxEntryKmh < optimalSpeedProfile[i]) {
        optimalSpeedProfile[i] = vMaxEntryKmh;
      }
    }
  }

  // 4. Build Sleek Dual-Rail 3D Racing Line Ribbon + Animated Forward Chevrons
  const lineHalfWidth = 0.64;
  const edgeRailWidth = 0.14;
  const ribbonGeom = new THREE.BufferGeometry();
  const ribbonVerts: number[] = [];
  const ribbonColors: number[] = [];
  const ribbonIndices: number[] = [];

  // We build a 4-vertex-per-row ribbon (left outer, left inner, right inner, right outer)
  // so the outer edges are crisp and bright while the center is sleek and non-obtrusive
  for (let i = 0; i <= segments; i++) {
    const idx = i % segments;
    const t = idx / segments;
    const { position, normal } = track.getTrackPointAtProgress(t);
    const centerPt = racingLineCurve.getPointAt(t);
    centerPt.y = position.y + 0.035;

    const pLeftOuter = centerPt.clone().addScaledVector(normal, -lineHalfWidth);
    const pLeftInner = centerPt.clone().addScaledVector(normal, -(lineHalfWidth - edgeRailWidth));
    const pRightInner = centerPt.clone().addScaledVector(normal, lineHalfWidth - edgeRailWidth);
    const pRightOuter = centerPt.clone().addScaledVector(normal, lineHalfWidth);

    ribbonVerts.push(
      pLeftOuter.x, pLeftOuter.y, pLeftOuter.z,
      pLeftInner.x, pLeftInner.y, pLeftInner.z,
      pRightInner.x, pRightInner.y, pRightInner.z,
      pRightOuter.x, pRightOuter.y, pRightOuter.z
    );

    for (let v = 0; v < 4; v++) {
      ribbonColors.push(0.0, 0.95, 0.48);
    }

    if (i < segments) {
      const b = i * 4;
      const n = (i + 1) * 4;
      // Left rail quad
      ribbonIndices.push(b, b + 1, n, b + 1, n + 1, n);
      // Center core quad
      ribbonIndices.push(b + 1, b + 2, n + 1, b + 2, n + 2, n + 1);
      // Right rail quad
      ribbonIndices.push(b + 2, b + 3, n + 2, b + 3, n + 3, n + 2);
    }
  }

  ribbonGeom.setAttribute('position', new THREE.Float32BufferAttribute(ribbonVerts, 3));
  const ribbonColorAttr = new THREE.Float32BufferAttribute(ribbonColors, 3);
  ribbonGeom.setAttribute('color', ribbonColorAttr);
  ribbonGeom.setIndex(ribbonIndices);

  const ribbonMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  const ribbonMesh = new THREE.Mesh(ribbonGeom, ribbonMat);
  ribbonMesh.renderOrder = 2;
  group.add(ribbonMesh);

  // Build Directional Forward Chevrons along the Racing Line (every 2 segments)
  const chevronGeom = new THREE.BufferGeometry();
  const chevronVerts: number[] = [];
  const chevronColors: number[] = [];
  const chevronIndices: number[] = [];
  const chevronSegmentMap: number[] = [];

  let chevCount = 0;
  for (let i = 0; i < segments; i += 2) {
    const t = i / segments;
    const { position } = track.getTrackPointAtProgress(t);
    const center = racingLineCurve.getPointAt(t);
    const lineTan = racingLineCurve.getTangentAt(t).normalize();
    const lineNorm = new THREE.Vector3().crossVectors(lineTan, up).normalize();
    center.y = position.y + 0.048;

    const tip = center.clone().addScaledVector(lineTan, 1.35);
    const backLeft = center.clone().addScaledVector(lineTan, -0.75).addScaledVector(lineNorm, -1.05);
    const backRight = center.clone().addScaledVector(lineTan, -0.75).addScaledVector(lineNorm, 1.05);
    const innerBack = center.clone().addScaledVector(lineTan, 0.22);

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
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });

  const chevronMesh = new THREE.Mesh(chevronGeom, chevronMat);
  chevronMesh.renderOrder = 3;
  group.add(chevronMesh);

  let pulsePhase = 0;

  // 5. Real-time update function called each frame in Practice Mode
  const update = (
    playerProgress: number,
    playerSpeedKmh: number,
    playerLateralOffset: number
  ): PracticeLineCoachData => {
    pulsePhase = (pulsePhase + 0.12) % (Math.PI * 2);
    const normProg = ((playerProgress % 1) + 1) % 1;
    const playerSegIdx = Math.floor(normProg * segments) % segments;
    const absSpeed = Math.abs(playerSpeedKmh);

    const rColors = ribbonColorAttr.array as Float32Array;
    for (let i = 0; i <= segments; i++) {
      const idx = i % segments;
      const nextIdx = (idx + 4) % segments;
      const lookIdx = (idx + 10) % segments;

      const optNow = optimalSpeedProfile[idx];
      const optNext = optimalSpeedProfile[nextIdx];
      const pointCap = pointTargetSpeeds[idx];
      const lookCap = pointTargetSpeeds[lookIdx];

      const segsAhead = (idx - playerSegIdx + segments) % segments;
      const distAheadMeters = segsAhead * segLengthMeters;
      const isNearPlayerAhead = distAheadMeters <= 240;

      // Calculate how much deceleration is required on the optimal profile at this point
      const speedDropRate = optNow - optNext; // positive when braking
      const baseBrakeIntensity = THREE.MathUtils.clamp((speedDropRate - 1.2) / 10.5, 0, 1);

      // Dynamic speed-adaptive braking zone: if player is carrying more speed than the optimal line
      // approaching a corner, illuminate the braking zone earlier so the line reacts to the player's actual speed
      let liveOverspeedIntensity = 0;
      if (isNearPlayerAhead && distAheadMeters <= 125) {
        const minTargetAtIdx = Math.min(optNow, lookCap);
        const speedExcess = absSpeed - minTargetAtIdx;
        if (speedExcess > 8) {
          liveOverspeedIntensity = THREE.MathUtils.clamp((speedExcess - 8) / 38, 0, 1);
        }
      }

      const brakeSeverity = Math.max(
        baseBrakeIntensity,
        lookCap < pointCap - 32 && optNow > lookCap + 8 ? 0.85 : 0,
        liveOverspeedIntensity
      );

      const isCoastApexZone =
        brakeSeverity < 0.25 &&
        ((pointCap < 245 && optNext <= optNow + 2.2) ||
          (isNearPlayerAhead && distAheadMeters <= 80 && absSpeed > optNow - 6 && absSpeed <= optNow + 10 && pointCap < 275));

      let r = 0.0;
      let g = 0.96;
      let b = 0.46;

      if (brakeSeverity >= 0.25) {
        // Smooth transition from Amber-Orange (light brake) to Vivid Laser Red (hard threshold braking)
        const tBrake = THREE.MathUtils.clamp((brakeSeverity - 0.25) / 0.65, 0, 1);
        r = 1.0;
        g = THREE.MathUtils.lerp(0.55, 0.05, tBrake);
        b = THREE.MathUtils.lerp(0.05, 0.18, tBrake);
      } else if (isCoastApexZone) {
        // Luminous Gold / Amber — Lift & Turn-in to Apex
        r = 1.0;
        g = 0.82;
        b = 0.04;
      } else {
        // Luminous Emerald / Cyan-Green — Full Throttle
        r = 0.0;
        g = 0.96;
        b = 0.48;
      }

      // Outer rails are full brightness; inner core is slightly softer so asphalt details show through
      const vBase = i * 12;
      // Left outer rail
      rColors[vBase] = r;
      rColors[vBase + 1] = g;
      rColors[vBase + 2] = b;
      // Left inner core
      rColors[vBase + 3] = r * 0.72;
      rColors[vBase + 4] = g * 0.72;
      rColors[vBase + 5] = b * 0.72;
      // Right inner core
      rColors[vBase + 6] = r * 0.72;
      rColors[vBase + 7] = g * 0.72;
      rColors[vBase + 8] = b * 0.72;
      // Right outer rail
      rColors[vBase + 9] = r;
      rColors[vBase + 10] = g;
      rColors[vBase + 11] = b;
    }
    ribbonColorAttr.needsUpdate = true;

    // Update animated directional chevrons (flow pulse along the track)
    const cColors = chevronColorAttr.array as Float32Array;
    for (let c = 0; c < chevCount; c++) {
      const segIdx = chevronSegmentMap[c];
      const rBase = segIdx * 12;
      const wave = 0.82 + 0.18 * Math.sin(c * 0.45 - pulsePhase);
      const r = Math.min(1, rColors[rBase] * wave + 0.08);
      const g = Math.min(1, rColors[rBase + 1] * wave + 0.08);
      const b = Math.min(1, rColors[rBase + 2] * wave + 0.08);

      const cBase = c * 12;
      for (let v = 0; v < 4; v++) {
        cColors[cBase + v * 3] = r;
        cColors[cBase + v * 3 + 1] = g;
        cColors[cBase + v * 3 + 2] = b;
      }
    }
    chevronColorAttr.needsUpdate = true;

    // 6. Compute live HUD Coaching Cue for the Top-of-Screen Practice Telemetry Banner
    const lookaheadSteps = Math.max(24, Math.min(55, Math.round(160 / segLengthMeters)));
    let minUpcomingCornerSpeed = pointTargetSpeeds[playerSegIdx];
    let upcomingTurnDir: 'left' | 'right' | 'straight' = 'straight';
    let cornerStepsAhead = lookaheadSteps;

    for (let step = 1; step <= lookaheadSteps; step++) {
      const lookSeg = (playerSegIdx + step) % segments;
      if (pointTargetSpeeds[lookSeg] < minUpcomingCornerSpeed) {
        minUpcomingCornerSpeed = pointTargetSpeeds[lookSeg];
        cornerStepsAhead = step;
      }
      if (upcomingTurnDir === 'straight' && turnDirections[lookSeg] !== 0) {
        upcomingTurnDir = turnDirections[lookSeg] < 0 ? 'left' : 'right';
      }
    }

    const distanceToCornerMeters = Math.round(cornerStepsAhead * segLengthMeters);
    const optSpeedHere = optimalSpeedProfile[playerSegIdx];
    const optSpeedAhead = optimalSpeedProfile[(playerSegIdx + 5) % segments];

    // Calculate physical braking distance needed from player's current speed down to upcoming corner speed
    const vPlayerMs = absSpeed / 3.6;
    const vCornerMs = minUpcomingCornerSpeed / 3.6;
    const requiredBrakingMeters =
      vPlayerMs > vCornerMs ? ((vPlayerMs * vPlayerMs - vCornerMs * vCornerMs) / (2 * 29.0)) * 1.15 : 0;

    const isBrakingCue =
      absSpeed > optSpeedHere + 10 ||
      (requiredBrakingMeters > 8 && distanceToCornerMeters <= requiredBrakingMeters + 14 && absSpeed > minUpcomingCornerSpeed + 12) ||
      (optSpeedAhead < optSpeedHere - 3.5 && absSpeed > minUpcomingCornerSpeed + 6);

    const isCoastCue =
      !isBrakingCue &&
      ((minUpcomingCornerSpeed < 250 &&
        distanceToCornerMeters <= requiredBrakingMeters + 38 &&
        absSpeed > minUpcomingCornerSpeed - 10) ||
        (pointTargetSpeeds[playerSegIdx] < 235 && optSpeedAhead <= optSpeedHere + 2.2));

    const zone: 'accelerate' | 'coast' | 'brake' = isBrakingCue
      ? 'brake'
      : isCoastCue
      ? 'coast'
      : 'accelerate';

    let recommendedPedalPct = 100;
    if (zone === 'brake') {
      const overSpeed = Math.max(8, absSpeed - Math.min(optSpeedHere, minUpcomingCornerSpeed));
      recommendedPedalPct = Math.round(THREE.MathUtils.clamp((overSpeed / 85) * 100, 35, 100));
    } else if (zone === 'coast') {
      recommendedPedalPct = 25;
    }

    const optimalOffsetNow = smoothedOffsets[playerSegIdx];
    const lineOffsetErrorMeters = optimalOffsetNow - playerLateralOffset;

    return {
      zone,
      targetSpeedKmh: Math.round(Math.min(optSpeedHere, minUpcomingCornerSpeed)),
      lineOffsetErrorMeters,
      turnDirection: upcomingTurnDir,
      upcomingCornerSpeedKmh: Math.round(minUpcomingCornerSpeed),
      distanceToCornerMeters,
      recommendedPedalPct,
    };
  };

  return {
    group,
    update,
  };
}
