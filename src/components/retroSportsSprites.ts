export type PixelSportKind =
  | 'basketball'
  | 'baseball'
  | 'golf'
  | 'football'
  | 'soccer'
  | 'bowling'
  | 'fishing';

export interface PixelAthleteRenderOpts {
  x: number;
  y: number;
  z?: number;
  vx?: number;
  vy?: number;
  faceX?: number;
  faceY?: number;
  jerseyColor: string;
  trimColor: string;
  shortsColor?: string;
  skinColor?: string;
  hairColor?: string;
  numberStr?: string;
  isUser?: boolean;
  scale?: number;
  walkTime?: number;
  // Basketball / Soccer / Football action states
  dribbleHand?: -1 | 1;
  crossTimer?: number; // >0 = active crossover visual
  tweenTimer?: number; // >0 = active between-the-legs visual
  ballInMove?: 'cross' | 'tween'; // draw ball layered inside leg/arm choreography
  moveProgress?: number; // 0..1 progress of active cross/tween
  stunTimer?: number; // >0 = ankle-broken dizzy wobble
  shootingPose?: boolean;
  dunkingPose?: boolean;
  dunkSwingProgress?: number; // 0..1 tomahawk flight/slam progression
  blockPose?: boolean;
  divePose?: boolean;
  // Baseball / Golf / Football / Bowling
  helmetColor?: string;
  capColor?: string;
  hasBat?: boolean;
  batSwingProgress?: number; // 0..1 when swinging
  hasGlove?: boolean;
  windupProgress?: number; // 0..1 pitcher leg kick
  isCatcher?: boolean;
  isGoalie?: boolean;
  hasPads?: boolean;
  spinTimer?: number;
  hasClub?: boolean;
  clubSwingProgress?: number;
}

const SKIN_TONES = ['#f2c29b', '#d99b66', '#9c643b', '#6d4224'];
const HAIR_TONES = ['#18181b', '#451a03', '#78350f', '#fde047'];

export function pickAthletePalette(seedIndex: number) {
  return {
    skin: SKIN_TONES[Math.abs(seedIndex) % SKIN_TONES.length],
    hair: HAIR_TONES[Math.abs(seedIndex * 3 + 1) % HAIR_TONES.length],
  };
}

/**
 * Draws a crisp, chunky 16-bit retro pixel-art athlete sprite onto a 2D canvas.
 * Uses integer-snapped pixel blocks (no blurry subpixel circles) for an authentic
 * NBA Jam / Tecmo Bowl / Ken Griffey Jr. arcade look.
 */
export function drawRetroPixelAthlete(
  ctx: CanvasRenderingContext2D,
  o: PixelAthleteRenderOpts
) {
  const px = Math.round(o.x);
  const py = Math.round(o.y);
  const pz = Math.round(o.z || 0);
  const s = o.scale ?? 2; // pixel unit size (2px = crisp 16-bit)
  const spd = Math.hypot(o.vx || 0, o.vy || 0);
  const moving = spd > 12;
  const walkT = o.walkTime || 0;
  const stride = moving ? Math.sin(walkT * 14) : 0;
  const bob = moving ? Math.abs(Math.sin(walkT * 14)) * s : 0;
  const faceRight = (o.faceX ?? 1) >= 0;
  const dir = faceRight ? 1 : -1;

  const skin = o.skinColor || '#d99b66';
  const hair = o.hairColor || '#18181b';
  const shorts = o.shortsColor || o.jerseyColor;
  const isCross = (o.crossTimer || 0) > 0;
  const isTween = (o.tweenTimer || 0) > 0;
  const isStun = (o.stunTimer || 0) > 0;
  const isSpin = (o.spinTimer || 0) > 0;
  const isBlock = Boolean(o.blockPose);
  const isDive = Boolean(o.divePose);

  // Ground pixel shadow (stepped pixel oval)
  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.fillRect(px - 6 * s, py + 7 * s, 12 * s, 2 * s);
  ctx.fillRect(px - 4 * s, py + 6 * s, 8 * s, 4 * s);

  // User selection indicator: classic arcade gold pixel diamond/ring under feet
  if (o.isUser) {
    ctx.strokeStyle = isBlock ? '#38bdf8' : isTween ? '#38bdf8' : isCross ? '#f97316' : '#fde047';
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 8 * s, py + 5 * s, 16 * s, 5 * s);
    // Tiny retro P1 arrow above head
    const arrowY = py - 15 * s - pz - Math.round(bob);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(px - 3 * s, arrowY - 2 * s, 6 * s, s);
    ctx.fillRect(px - 2 * s, arrowY - s, 4 * s, s);
    ctx.fillRect(px - s, arrowY, 2 * s, s);
  }

  // Action motion afterimage streak during cross / tween / spin / block / dive!
  if (isCross || isTween || isSpin || isBlock || isDive) {
    ctx.globalAlpha = 0.36;
    ctx.fillStyle = isBlock ? '#38bdf8' : isTween ? '#22d3ee' : isSpin ? '#a855f7' : isDive ? '#facc15' : '#f97316';
    ctx.fillRect(px - dir * 6 * s - 4 * s, py - 9 * s - pz, 9 * s, 15 * s);
    ctx.globalAlpha = 1;
  }

  const baseY = py - pz - Math.round(bob) + (isDive ? 3 * s : 0);
  const crouch = isTween ? s * 2.2 : isCross ? s * 1.4 : o.isCatcher ? s * 2.5 : 0;
  const wobbleX = isStun ? Math.round(Math.sin(walkT * 28) * 3) : 0;
  const cx = px + wobbleX + (isCross ? dir * 2 * s : 0);

  // 1. LEGS & PIXEL SNEAKERS / CLEATS
  const isDunk = Boolean(o.dunkingPose) || (o.dunkSwingProgress || 0) > 0;
  const moveProg = Math.max(0, Math.min(1, o.moveProgress ?? 0.5));
  const handSide = o.dribbleHand || 1;
  const legSpread = isTween ? 5.2 * s : isCross ? 3.2 * s : isDunk ? 2.2 * s : Math.round(stride * 2.5 * s);
  const leftLegX = cx - 3 * s - (isTween ? 2.5 * s : 0);
  const rightLegX = cx + s + (isTween ? 2.5 * s : 0);
  const kneeTuck = isDunk ? -1.5 * s : 0;
  const leftLegY = baseY + 3 * s + (isTween ? 0 : legSpread * 0.4) + kneeTuck;
  const rightLegY = baseY + 3 * s - (isTween ? 0 : legSpread * 0.4) + kneeTuck;
  const kickLift =
    (o.windupProgress || 0) > 0 ? Math.round(Math.sin((o.windupProgress || 0) * Math.PI) * 5 * s) : 0;

  const drawSingleLeg = (lx: number, ly: number, lift = 0) => {
    ctx.fillStyle = o.hasBat || o.hasGlove || o.isCatcher ? '#e2e8f0' : skin;
    ctx.fillRect(lx, ly + crouch - lift, 2 * s, 3 * s);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(lx - (dir < 0 ? s : 0), ly + 2 * s + crouch - lift, 3 * s, 2 * s);
    ctx.fillStyle = o.trimColor;
    ctx.fillRect(lx, ly + 3 * s + crouch - lift, 2 * s, s);
  };

  // Shorts / Pants
  ctx.fillStyle = '#09090b'; // pixel outline
  ctx.fillRect(cx - 5 * s, baseY + 1 * s + crouch, 10 * s, 4 * s);
  ctx.fillStyle = shorts;
  ctx.fillRect(cx - 4 * s, baseY + 1 * s + crouch, 8 * s, 3 * s);

  if (o.ballInMove === 'tween' && isTween) {
    // Layered between-the-legs depth: back leg -> basketball weaving through gap -> front leg!
    const backX = dir >= 0 ? leftLegX : rightLegX;
    const backY = dir >= 0 ? leftLegY : rightLegY;
    const frontX = dir >= 0 ? rightLegX : leftLegX;
    const frontY = dir >= 0 ? rightLegY : leftLegY;

    drawSingleLeg(backX, backY, 0);

    const ballSweepX = cx + Math.cos(moveProg * Math.PI) * -handSide * 6.5 * s;
    const ballSweepY = baseY + 4.4 * s + crouch - Math.sin(moveProg * Math.PI) * 1.6 * s;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 6 * s, ballSweepY + s);
    ctx.quadraticCurveTo(cx, ballSweepY + 3 * s, cx + 6 * s, ballSweepY + s);
    ctx.stroke();
    drawRetroBasketball(ctx, ballSweepX, ballSweepY + 3 * s, 3 * s, moveProg * 8);

    drawSingleLeg(frontX, frontY, kickLift);
  } else {
    drawSingleLeg(leftLegX, leftLegY, 0);
    drawSingleLeg(rightLegX, rightLegY, kickLift);
  }

  // 2. TORSO / JERSEY (+ Shoulder Pads if Football)
  const torsoW = o.hasPads ? 10 * s : 8 * s;
  const torsoX = cx - Math.round(torsoW * 0.5);
  const torsoY = baseY - 5 * s + crouch;

  ctx.fillStyle = '#09090b'; // crisp 1px pixel border around jersey
  ctx.fillRect(torsoX - s, torsoY - s, torsoW + 2 * s, 7 * s);
  ctx.fillStyle = o.jerseyColor;
  ctx.fillRect(torsoX, torsoY, torsoW, 6 * s);

  // Trim / Racing stripe / Collar
  ctx.fillStyle = o.trimColor;
  ctx.fillRect(torsoX, torsoY, torsoW, s);
  ctx.fillRect(torsoX, torsoY + 5 * s, torsoW, s);
  if (o.hasPads) {
    ctx.fillRect(torsoX, torsoY, 2 * s, 2 * s);
    ctx.fillRect(torsoX + torsoW - 2 * s, torsoY, 2 * s, 2 * s);
  }

  // Pixel jersey number
  if (o.numberStr) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(8, Math.round(4.4 * s))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(o.numberStr, cx, torsoY + 4.6 * s);
  }

  // 3. HEAD + HAIR / HELMET / CAP / HEADBAND
  const headY = baseY - 10 * s + crouch;
  ctx.fillStyle = '#09090b';
  ctx.fillRect(cx - 4 * s, headY - s, 8 * s, 6 * s);
  ctx.fillStyle = skin;
  ctx.fillRect(cx - 3 * s, headY, 6 * s, 5 * s);

  if (o.helmetColor) {
    // Football / Batting Helmet with facemask
    ctx.fillStyle = o.helmetColor;
    ctx.fillRect(cx - 4 * s, headY - s, 8 * s, 3 * s);
    ctx.fillRect(cx - 4 * s, headY, 2 * s, 4 * s);
    // Helmet stripe
    ctx.fillStyle = o.trimColor;
    ctx.fillRect(cx - s, headY - s, 2 * s, 2 * s);
    // Facemask grill
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(cx + dir * s, headY + 2 * s, 3 * s, s);
    ctx.fillRect(cx + dir * 2 * s, headY + 3 * s, 2 * s, s);
  } else if (o.capColor) {
    // Baseball / Golf cap with brim
    ctx.fillStyle = o.capColor;
    ctx.fillRect(cx - 3 * s, headY - s, 6 * s, 2 * s);
    ctx.fillRect(cx + (dir > 0 ? 0 : -4 * s), headY, 5 * s, s);
  } else {
    // Retro Hair + Optional NBA Jam Headband
    ctx.fillStyle = hair;
    ctx.fillRect(cx - 3 * s, headY - s, 6 * s, 2 * s);
    if (o.isUser) {
      ctx.fillStyle = '#fde047';
      ctx.fillRect(cx - 3 * s, headY + s, 6 * s, s);
    }
  }

  // Pixel Eyes looking in facing direction
  ctx.fillStyle = '#09090b';
  const eyeOff = dir > 0 ? s : -2 * s;
  ctx.fillRect(cx + eyeOff, headY + 2 * s, s, s);
  ctx.fillRect(cx + eyeOff + dir * 2 * s, headY + 2 * s, s, s);

  // 4. ANIMATED ARMS & EQUIPMENT (Crosses, Tweens, Jump Shot, Bats, Clubs)
  const armBaseY = torsoY + s;
  const handReach = o.dribbleHand || 1;
  ctx.fillStyle = skin;

  if (isBlock) {
    // Sky-high shot-block swat pose: dominant arm reaches far above head + swat shockwave arc!
    ctx.fillRect(cx + dir * 2 * s, headY - 7 * s, 2.5 * s, 9 * s);
    ctx.fillRect(cx - dir * 4 * s, armBaseY + s, 2 * s, 3 * s);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + dir * 3 * s, headY - 7 * s, 5.5 * s, -Math.PI * 0.85, Math.PI * 0.15);
    ctx.stroke();
  } else if (o.dunkingPose || (o.dunkSwingProgress || 0) > 0) {
    // Expressive tomahawk dunk flight: cocks ball overhead then punches forward into the rim!
    const dp = Math.max(0, Math.min(1, o.dunkSwingProgress ?? 0.6));
    const reachX = dp < 0.55 ? -dir * (1 - dp) * 3 * s : dir * (dp - 0.35) * 6 * s;
    const reachY = headY - (dp < 0.65 ? 6 * s : 3 * s);
    ctx.fillRect(cx - dir * 4 * s, armBaseY + s, 2 * s, 3 * s); // off balance arm
    ctx.fillRect(cx + reachX - s, reachY, 2.5 * s, 7 * s); // tomahawk dunking arm
    if ((o.dunkSwingProgress || 0) > 0 && dp < 0.88) {
      drawRetroBasketball(ctx, cx + reachX + dir * 2 * s, reachY + 2 * s, 2 * s, dp * 6);
    }
    if (dp >= 0.72) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx + dir * 5 * s, reachY + s, 6 * s, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (o.shootingPose) {
    // Both arms raised high for jumper release!
    ctx.fillRect(cx - 5 * s, headY - 3 * s, 2 * s, 5 * s);
    ctx.fillRect(cx + 3 * s, headY - 3 * s, 2 * s, 5 * s);
  } else if (isCross) {
    // Crossover: off-arm shields defender, ball arm whips sharply across chest + front waist basketball!
    ctx.fillRect(cx - dir * 5 * s, armBaseY, 2 * s, 3 * s);
    ctx.fillRect(cx + handReach * 2 * s, armBaseY + 2 * s, 3.5 * s, 2 * s);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 5 * s, armBaseY + 3 * s);
    ctx.lineTo(cx + 5 * s, armBaseY + 2 * s);
    ctx.stroke();
    if (o.ballInMove === 'cross') {
      const ballCrossX = cx + Math.cos(moveProg * Math.PI) * -handSide * 6.5 * s;
      const ballCrossY = armBaseY + 3.4 * s;
      drawRetroBasketball(ctx, ballCrossX, ballCrossY + 4 * s, 3 * s, moveProg * 9);
    }
  } else if (isTween) {
    // Between-the-legs: arms reach down inside wide leg split!
    ctx.fillRect(cx - 4.5 * s, armBaseY + 2.5 * s, 2 * s, 4 * s);
    ctx.fillRect(cx + 2.5 * s, armBaseY + 2.5 * s, 2 * s, 4 * s);
  } else if (isDive) {
    // Diving tackle / interception arms outstretched forward!
    ctx.fillRect(cx + dir * 4 * s, armBaseY - s, 5 * s, 2 * s);
    ctx.fillRect(cx + dir * 3 * s, armBaseY + 2 * s, 5 * s, 2 * s);
  } else {
    // Natural swinging arms while running
    const armSwing = Math.round(stride * 2 * s);
    ctx.fillRect(torsoX - 2 * s, armBaseY + armSwing, 2 * s, 4 * s);
    ctx.fillRect(torsoX + torsoW, armBaseY - armSwing, 2 * s, 4 * s);
  }

  // Baseball Glove on fielder
  if (o.hasGlove) {
    ctx.fillStyle = '#78350f';
    ctx.fillRect(torsoX - 3 * s, armBaseY + 2 * s, 3 * s, 3 * s);
  }

  // Baseball Bat (coiled or mid-swing pixel arc)
  if (o.hasBat) {
    const sw = o.batSwingProgress || 0;
    const batAng = sw > 0 ? -1.4 + sw * 3.1 : -2.1;
    const bx1 = cx + 2 * s;
    const by1 = armBaseY + s;
    const bx2 = bx1 + Math.cos(batAng) * 14 * s;
    const by2 = by1 + Math.sin(batAng) * 14 * s;
    if (sw > 0.1 && sw < 0.85) {
      ctx.strokeStyle = 'rgba(253,224,71,0.45)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(bx1, by1, 11 * s, -1.6, batAng);
      ctx.stroke();
    }
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(bx1, by1);
    ctx.lineTo(bx2, by2);
    ctx.stroke();
  }

  // Golf Club
  if (o.hasClub) {
    const sw = o.clubSwingProgress || 0;
    const ang = sw > 0 ? 1.8 - sw * 3.2 : 1.75;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, armBaseY + 2 * s);
    ctx.lineTo(cx + Math.cos(ang) * 11 * s, armBaseY + 2 * s + Math.sin(ang) * 11 * s);
    ctx.stroke();
  }

  // Ankle-Broken Dizzy Stars above stunned defender!
  if (isStun) {
    for (let i = 0; i < 3; i++) {
      const a = walkT * 10 + (i * Math.PI * 2) / 3;
      const sx = cx + Math.round(Math.cos(a) * 6 * s);
      const sy = headY - 4 * s + Math.round(Math.sin(a) * 2 * s);
      ctx.fillStyle = i % 2 === 0 ? '#fde047' : '#38bdf8';
      ctx.fillRect(sx - 1, sy - 1, 3, 3);
    }
  }
}

/**
 * Draws a retro pixel-styled basketball with seam stripes and bounce shadow.
 */
export function drawRetroBasketball(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  z: number,
  spinAngle = 0
) {
  const bx = Math.round(x);
  const by = Math.round(y);
  const rad = Math.max(6, Math.round(6.5 + z * 0.045));

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath();
  ctx.ellipse(bx, by + 7, 7, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const dy = Math.round(by - z);
  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.arc(bx, dy, rad, 0, Math.PI * 2);
  ctx.fill();

  // Highlight pixel
  ctx.fillStyle = '#fb923c';
  ctx.fillRect(bx - rad * 0.45, dy - rad * 0.45, 3, 3);

  // Seam lines
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(bx, dy, rad, 0, Math.PI * 2);
  ctx.moveTo(bx - rad, dy);
  ctx.lineTo(bx + rad, dy);
  ctx.moveTo(bx + Math.sin(spinAngle) * rad * 0.55, dy - rad);
  ctx.lineTo(bx + Math.sin(spinAngle) * rad * 0.55, dy + rad);
  ctx.stroke();
}
