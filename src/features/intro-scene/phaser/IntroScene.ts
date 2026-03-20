import * as Phaser from "phaser";

/** Layout: wide, breathable indoor cross-section (0–1 normalized) */
const LAYOUT = {
  floor1Ratio: 0.52,
  wallThickness: 0.008,
  livingRoomWidth: 0.28,
  stairsWidth: 0.22,
} as const;

const DIV_THICK = 10;
const CHASE_START_MS = 3200;
const CAUGHT_RADIUS = 44;
const MAX_CHASERS = 6;
const REINFORCE_EVERY_MS = 8000;
const WEAPON_EVERY_MS = 4500;

/** Refined color palette – warm downstairs, calm upstairs */
const COLORS = {
  wall: 0xe8e0d5,
  floor1: 0xb8a090,
  floor1Warm: 0xc4a882,
  floor2: 0xa89080,
  floorDivider: 0x8a7565,
  sofaSeat: 0x8b7355,
  sofaBack: 0x7a6348,
  table: 0x6b5344,
  counter: 0x9a8a78,
  counterEdge: 0x8a7a68,
  fridge: 0xf0e8e0,
  fridgeAccent: 0xd8d0c8,
  stairs: 0x9a8a78,
  stairsRiser: 0x7a6a58,
  bedFrame: 0x7a6a5a,
  bedSheet: 0x9a8a7a,
  cabinet: 0x6a5a4a,
  cabinetDoor: 0x5a4a3a,
  windowFrame: 0x5a5048,
  windowSky: 0x87ceeb,
  lampGlow: 0xffd4a0,
  lampBase: 0x4a4038,
} as const;

type AxisRect = { left: number; top: number; right: number; bottom: number };

type Chaser = {
  container: Phaser.GameObjects.Container;
  speed: number;
  color: number;
};

type Projectile = {
  go: Phaser.GameObjects.Triangle | Phaser.GameObjects.Container;
  vx: number;
  vy: number;
  kind: "dart" | "hammer";
};

type SceneInitData = { onEnter?: () => void };

/** Passed from React when GameConfig cannot carry `data` (Phaser typings). */
let pendingOnEnter: (() => void) | undefined;

export function setIntroOnEnter(cb: (() => void) | undefined) {
  pendingOnEnter = cb;
}

function distSq(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function clampToRect(px: number, py: number, r: AxisRect) {
  return {
    x: Phaser.Math.Clamp(px, r.left, r.right),
    y: Phaser.Math.Clamp(py, r.top, r.bottom),
  };
}

function closestPointOnUnion(px: number, py: number, rects: AxisRect[]) {
  let bestX = px;
  let bestY = py;
  let bestD = Infinity;
  for (const r of rects) {
    const c = clampToRect(px, py, r);
    const d = distSq(px, py, c.x, c.y);
    if (d < bestD) {
      bestD = d;
      bestX = c.x;
      bestY = c.y;
    }
  }
  return { x: bestX, y: bestY };
}

function pointInAnyRect(px: number, py: number, rects: AxisRect[]) {
  return rects.some(
    (r) => px >= r.left && px <= r.right && py >= r.top && py <= r.bottom
  );
}

export default class IntroScene extends Phaser.Scene {
  private onEnterCallback?: () => void;
  private hasEntered = false;
  private chaseEnabled = false;
  private walkable: AxisRect[] = [];

  private exclamationMark?: Phaser.GameObjects.Text;
  private speechBubble?: Phaser.GameObjects.Container;
  private topHint?: Phaser.GameObjects.Text;

  private chasers: Chaser[] = [];
  private projectiles: Projectile[] = [];

  private table?: Phaser.GameObjects.Rectangle;
  private lampGroup?: Phaser.GameObjects.Container;

  private debuffUntil = 0;
  private reinforceTimer?: Phaser.Time.TimerEvent;
  private weaponTimer?: Phaser.Time.TimerEvent;
  private nextWeaponDart = true;

  constructor() {
    super("IntroScene");
  }

  init(data: SceneInitData) {
    this.onEnterCallback = data?.onEnter ?? pendingOnEnter;
  }

  preload() {}

  create() {
    this.cameras.main.setBackgroundColor("#0a0806");
    this.rebuildWalkable();

    this.buildStructure();
    this.buildFloor1();
    this.buildFloor2();
    this.buildStoryElements();
    this.playOpeningSequence();
    this.setupInput();
    this.time.delayedCall(CHASE_START_MS, () => {
      this.chaseEnabled = true;
      this.startReinforcements();
      this.startWeapons();
    });
  }

  private rebuildWalkable() {
    const w = this.width;
    const h = this.height;
    const wallT = Math.max(4, w * LAYOUT.wallThickness);
    const floor1Y = h * (1 - LAYOUT.floor1Ratio);
    const floor2H = floor1Y - DIV_THICK;
    const livingRight = wallT + w * LAYOUT.livingRoomWidth;
    const stairsLeft = livingRight;
    const stairsRight = stairsLeft + w * LAYOUT.stairsWidth;

    const floor1: AxisRect = {
      left: wallT,
      top: floor1Y,
      right: w - wallT,
      bottom: h,
    };
    const floor2: AxisRect = {
      left: wallT,
      top: 0,
      right: w - wallT,
      bottom: floor2H,
    };
    const stairs: AxisRect = {
      left: stairsLeft,
      top: 0,
      right: stairsRight,
      bottom: h,
    };

    this.walkable = [floor1, floor2, stairs];
  }

  private setupInput() {
    this.input.on("pointerdown", () => {
      if (this.hasEntered) return;
      if (!this.chaseEnabled) return;
      this.tryEnter();
    });
  }

  private tryEnter() {
    if (this.hasEntered) return;
    this.hasEntered = true;
    this.onEnterCallback?.();
  }

  private startReinforcements() {
    this.reinforceTimer = this.time.addEvent({
      delay: REINFORCE_EVERY_MS,
      loop: true,
      callback: () => {
        if (this.chasers.length >= MAX_CHASERS) return;
        const p = this.randomWalkablePoint();
        const tint = this.chasers.length % 2 === 0 ? 0x3b82f6 : 0xeab308;
        this.spawnChaserAt(p.x, p.y, tint);
      },
    });
  }

  private startWeapons() {
    this.weaponTimer = this.time.addEvent({
      delay: WEAPON_EVERY_MS,
      loop: true,
      callback: () => {
        if (!this.chaseEnabled || this.hasEntered) return;
        this.spawnProjectile();
      },
    });
  }

  private randomWalkablePoint() {
    const w = this.width;
    const h = this.height;
    for (let i = 0; i < 24; i++) {
      const x = Phaser.Math.Between(40, w - 40);
      const y = Phaser.Math.Between(40, h - 40);
      if (pointInAnyRect(x, y, this.walkable)) return { x, y };
    }
    return { x: w * 0.5, y: h * 0.72 };
  }

  private spawnChaserAt(x: number, y: number, color: number) {
    const c = this.createStickmanContainer(x, y, color, 110);
    this.chasers.push({ container: c, speed: Phaser.Math.Between(95, 140), color });
  }

  private spawnProjectile() {
    const px = this.input.activePointer.worldX;
    const py = this.input.activePointer.worldY;
    const edge = Phaser.Math.Between(0, 3);
    const w = this.width;
    const h = this.height;
    let sx = w / 2;
    let sy = h / 2;
    if (edge === 0) {
      sx = -20;
      sy = Phaser.Math.Between(0, h);
    } else if (edge === 1) {
      sx = w + 20;
      sy = Phaser.Math.Between(0, h);
    } else if (edge === 2) {
      sx = Phaser.Math.Between(0, w);
      sy = -20;
    } else {
      sx = Phaser.Math.Between(0, w);
      sy = h + 20;
    }

    const kind = this.nextWeaponDart ? "dart" : "hammer";
    this.nextWeaponDart = !this.nextWeaponDart;

    const dx = px - sx;
    const dy = py - sy;
    const len = Math.hypot(dx, dy) || 1;
    const speed = kind === "dart" ? 520 : 180;
    const vx = (dx / len) * speed;
    const vy = (dy / len) * speed;

    let go: Phaser.GameObjects.Triangle | Phaser.GameObjects.Container;
    if (kind === "dart") {
      const tri = this.add.triangle(sx, sy, 0, -6, 10, 0, 0, 6, 0x22c55e);
      tri.setStrokeStyle(1, 0x14532d);
      go = tri;
    } else {
      const head = this.add.rectangle(0, 0, 22, 16, 0x78716c);
      const handle = this.add.rectangle(-18, 0, 14, 4, 0x57534e);
      const cont = this.add.container(sx, sy, [handle, head]);
      go = cont;
    }

    go.setDepth(200);
    this.projectiles.push({ go, vx, vy, kind });
  }

  buildStructure() {
    const w = this.width;
    const h = this.height;
    const wallT = Math.max(4, w * LAYOUT.wallThickness);
    const floor1Y = h * (1 - LAYOUT.floor1Ratio);

    this.add.rectangle(wallT / 2, h / 2, wallT, h + 4, COLORS.wall);
    this.add.rectangle(w - wallT / 2, h / 2, wallT, h + 4, COLORS.wall);

    this.add.rectangle(w / 2, floor1Y + (h - floor1Y) / 2, w, h - floor1Y, COLORS.floor1);
    this.add.rectangle(w / 2, floor1Y + (h - floor1Y) * 0.92, w, (h - floor1Y) * 0.04, COLORS.floor1Warm);

    this.add.rectangle(w / 2, floor1Y - DIV_THICK / 2, w, DIV_THICK, COLORS.floorDivider);

    const floor2H = floor1Y - DIV_THICK;
    this.add.rectangle(w / 2, floor2H / 2, w, floor2H, COLORS.floor2);

    const calmOverlay = this.add.rectangle(w / 2, floor2H / 2, w, floor2H, 0xaaccff, 0.03);
    calmOverlay.setDepth(2);
  }

  buildFloor1() {
    const w = this.width;
    const h = this.height;
    const wallT = Math.max(4, w * LAYOUT.wallThickness);
    const floor1Y = h * (1 - LAYOUT.floor1Ratio);
    const floor1H = h - floor1Y;

    const livingLeft = wallT;
    const livingRight = wallT + w * LAYOUT.livingRoomWidth;
    const stairsLeft = livingRight;
    const stairsRight = livingRight + w * LAYOUT.stairsWidth;
    const kitchenLeft = stairsRight;
    const kitchenRight = w - wallT;

    const roomMidY = floor1Y + floor1H / 2;

    const livingW = livingRight - livingLeft;
    const sofaW = livingW * 0.5;
    const sofaH = floor1H * 0.12;
    const sofaX = livingLeft + livingW * 0.35;
    const sofaY = roomMidY + floor1H * 0.08;

    this.add.rectangle(sofaX, sofaY, sofaW, sofaH * 0.6, COLORS.sofaSeat);
    this.add.rectangle(sofaX - sofaW * 0.15, sofaY - sofaH * 0.2, sofaW * 0.2, sofaH * 1.1, COLORS.sofaBack);

    const tableW = livingW * 0.22;
    const tableH = floor1H * 0.05;
    const tableX = sofaX + sofaW * 0.35;
    const tableY = sofaY + sofaH * 0.55;
    this.table = this.add.rectangle(tableX, tableY, tableW, tableH, COLORS.table);
    this.table.setDepth(8);

    const lampX = livingLeft + livingW * 0.78;
    const lampY = roomMidY - floor1H * 0.05;
    const pole = this.add.rectangle(0, floor1H * 0.18, 3, floor1H * 0.25, COLORS.lampBase);
    const bulb = this.add.circle(0, 0, 8, COLORS.lampGlow, 0.6);
    this.lampGroup = this.add.container(lampX, lampY, [pole, bulb]);
    this.lampGroup.setDepth(8);

    const stairsCenterX = (stairsLeft + stairsRight) / 2;
    const stepCount = 9;
    const stepH = floor1H / stepCount;
    const stepW = (stairsRight - stairsLeft) * 0.55;

    for (let i = 0; i < stepCount; i++) {
      const stepY = floor1Y + floor1H - stepH * (i + 0.5);
      const stepX = stairsCenterX - stepW / 2 + (i / stepCount) * stepW * 0.2;
      this.add.rectangle(stepX, stepY, stepW, stepH * 0.35, COLORS.stairs);
      this.add.rectangle(stepX, stepY + stepH * 0.32, stepW * 1.02, stepH * 0.25, COLORS.stairsRiser);
    }

    const kitchenW = kitchenRight - kitchenLeft;
    const counterDepth = floor1H * 0.1;
    const counterLen = kitchenW * 0.7;
    const counterX = kitchenLeft + kitchenW * 0.35;
    const counterY = roomMidY - floor1H * 0.08;

    this.add.rectangle(counterX, counterY, counterLen, counterDepth, COLORS.counter);
    this.add.rectangle(counterX, counterY + counterDepth * 0.4, counterLen, 2, COLORS.counterEdge);

    const fridgeW = kitchenW * 0.12;
    const fridgeH = floor1H * 0.38;
    const fridgeX = kitchenRight - fridgeW * 0.7;
    const fridgeY = roomMidY - fridgeH * 0.15;

    this.add.rectangle(fridgeX, fridgeY, fridgeW, fridgeH, COLORS.fridge);
    this.add.rectangle(fridgeX - fridgeW * 0.35, fridgeY, fridgeW * 0.12, fridgeH * 0.88, COLORS.fridgeAccent);

    const warmOverlay = this.add.rectangle(
      w / 2,
      floor1Y + floor1H / 2,
      w,
      floor1H,
      0xffaa44,
      0.05
    );
    warmOverlay.setDepth(5);
  }

  buildFloor2() {
    const w = this.width;
    const h = this.height;
    const wallT = Math.max(4, w * LAYOUT.wallThickness);
    const floor1Y = h * (1 - LAYOUT.floor1Ratio);
    const floor2H = floor1Y - DIV_THICK;
    const roomLeft = wallT;
    const roomRight = w - wallT;
    const roomMidY = floor2H / 2;

    const bedW = (roomRight - roomLeft) * 0.2;
    const bedH = floor2H * 0.28;
    const bedX = roomLeft + (roomRight - roomLeft) * 0.22;
    const bedY = roomMidY + bedH * 0.05;

    this.add.rectangle(bedX, bedY, bedW, bedH * 0.12, COLORS.bedFrame);
    this.add.rectangle(bedX, bedY - bedH * 0.15, bedW * 0.95, bedH * 0.75, COLORS.bedSheet);

    const cabinetW = (roomRight - roomLeft) * 0.1;
    const cabinetH = floor2H * 0.42;
    const cabinetX = roomRight - cabinetW * 0.65;
    const cabinetY = roomMidY - cabinetH * 0.05;

    this.add.rectangle(cabinetX, cabinetY, cabinetW, cabinetH, COLORS.cabinet);
    this.add.rectangle(cabinetX - cabinetW * 0.25, cabinetY, cabinetW * 0.08, cabinetH * 0.9, COLORS.cabinetDoor);

    const windowW = (roomRight - roomLeft) * 0.14;
    const windowH = floor2H * 0.28;
    const windowX = roomRight - windowW * 0.65;
    const windowY = floor2H * 0.22;

    this.add.rectangle(windowX, windowY, windowW * 0.88, windowH, COLORS.windowSky);
    this.add.rectangle(windowX, windowY - windowH * 0.48, windowW, 3, COLORS.windowFrame);
    this.add.rectangle(windowX, windowY + windowH * 0.48, windowW, 3, COLORS.windowFrame);
    this.add.rectangle(windowX - windowW * 0.5, windowY, 3, windowH, COLORS.windowFrame);
    this.add.rectangle(windowX + windowW * 0.5, windowY, 3, windowH, COLORS.windowFrame);
  }

  private createStickmanContainer(
    x: number,
    y: number,
    color: number,
    depth: number
  ) {
    const c = this.add.container(x, y);
    c.setDepth(depth);
    c.add(this.add.circle(0, -18, 7, color));
    c.add(this.add.rectangle(0, 0, 3, 22, color));
    c.add(this.add.rectangle(-8, -3, 14, 2, color));
    c.add(this.add.rectangle(8, -3, 14, 2, color));
    c.add(this.add.rectangle(-4, 14, 2, 14, color));
    c.add(this.add.rectangle(4, 14, 2, 14, color));
    return c;
  }

  buildStoryElements() {
    const { width, height } = this.scale;
    const floor1Y = height * (1 - LAYOUT.floor1Ratio);
    const floor1H = height - floor1Y;
    const storyDepth = 100;

    const blueX = width * 0.12;
    const blueY = floor1Y + floor1H * 0.55;
    const blue = this.createStickmanContainer(blueX, blueY, 0x3b82f6, storyDepth);

    const cig = this.add.rectangle(14, -2, 10, 2, 0xd1d5db);
    const ember = this.add.circle(18, -2, 1.5, 0xff6b6b);
    blue.add(cig);
    blue.add(ember);
    this.createSmokeForContainer(blue, 22, -16, storyDepth);

    const yellowX = width * 0.82;
    const yellowY = height * 0.28;
    const yellow = this.createStickmanContainer(yellowX, yellowY, 0xeab308, storyDepth);

    this.topHint = this.add
      .text(width / 2, 36, "They saw you. Click to enter, or keep moving.", {
        fontSize: "16px",
        color: "#c8c0b8",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(storyDepth);

    this.exclamationMark = this.add
      .text(0, -48, "!", {
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(storyDepth);

    const bubbleW = 100;
    const bubbleH = 38;
    const bubbleBg = this.add
      .rectangle(58, -72, bubbleW, bubbleH, 0xffffff)
      .setStrokeStyle(1.5, 0x333333)
      .setDepth(storyDepth);

    const bubbleText = this.add
      .text(58, -72, "抓住他", {
        fontSize: "18px",
        color: "#222222",
      })
      .setOrigin(0.5)
      .setDepth(storyDepth);

    this.speechBubble = this.add.container(0, 0, [bubbleBg, bubbleText]).setAlpha(0).setDepth(storyDepth);

    yellow.add(this.exclamationMark);
    yellow.add(this.speechBubble);

    this.chasers.push({ container: blue, speed: 120, color: 0x3b82f6 });
    this.chasers.push({ container: yellow, speed: 115, color: 0xeab308 });
  }

  private createSmokeForContainer(
    parent: Phaser.GameObjects.Container,
    ox: number,
    oy: number,
    depth: number
  ) {
    for (let i = 0; i < 3; i++) {
      const puff = this.add.circle(ox + i * 5, oy - i * 6, 5 - i, 0xd1d5db, 0.45);
      puff.setDepth(depth);
      parent.add(puff);

      this.tweens.add({
        targets: puff,
        y: puff.y - 24,
        x: puff.x + Phaser.Math.Between(-5, 5),
        alpha: 0,
        duration: 2000 + i * 280,
        repeat: -1,
        repeatDelay: 180,
        onRepeat: () => {
          puff.setY(oy - i * 6);
          puff.setX(ox + i * 5);
          puff.setAlpha(0.45);
        },
      });
    }
  }

  private playOpeningSequence() {
    const { width, height } = this.scale;

    const blackOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000);
    const topLid = this.add.rectangle(width / 2, height / 4, width, height / 2, 0x000000);
    const bottomLid = this.add.rectangle(width / 2, height * 0.75, width, height / 2, 0x000000);

    this.cameras.main.setAlpha(0.6);

    this.time.delayedCall(300, () => {
      this.tweens.add({
        targets: [topLid],
        y: -height / 4,
        duration: 1000,
        ease: "Sine.easeOut",
      });

      this.tweens.add({
        targets: [bottomLid],
        y: height + height / 4,
        duration: 1000,
        ease: "Sine.easeOut",
      });

      this.tweens.add({
        targets: blackOverlay,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          blackOverlay.destroy();
          topLid.destroy();
          bottomLid.destroy();
        },
      });

      this.tweens.add({
        targets: this.cameras.main,
        alpha: 1,
        duration: 1000,
      });
    });

    this.time.delayedCall(1400, () => {
      if (!this.exclamationMark) return;
      this.tweens.add({
        targets: this.exclamationMark,
        alpha: 1,
        y: this.exclamationMark.y - 6,
        duration: 220,
        yoyo: true,
      });
    });

    this.time.delayedCall(1900, () => {
      if (!this.speechBubble) return;
      this.tweens.add({
        targets: this.speechBubble,
        alpha: 1,
        duration: 280,
      });
    });

    this.time.delayedCall(2200, () => {
      if (!this.topHint) return;
      this.tweens.add({
        targets: this.topHint,
        alpha: 0.9,
        duration: 450,
      });
    });
  }

  private moveChaserToward(chaser: Chaser, tx: number, ty: number, delta: number) {
    const slow = this.time.now < this.debuffUntil ? 0.45 : 1;
    const { x, y } = chaser.container;
    const dx = tx - x;
    const dy = ty - y;
    const len = Math.hypot(dx, dy) || 1;
    const step = chaser.speed * slow * (delta / 1000);
    let nx = x + (dx / len) * Math.min(step, len);
    let ny = y + (dy / len) * Math.min(step, len);

    const clamped = closestPointOnUnion(nx, ny, this.walkable);
    nx = clamped.x;
    ny = clamped.y;

    chaser.container.setPosition(nx, ny);
  }

  private separateChasers() {
    const minD = 36;
    const min2 = minD * minD;
    for (let i = 0; i < this.chasers.length; i++) {
      for (let j = i + 1; j < this.chasers.length; j++) {
        const a = this.chasers[i].container;
        const b = this.chasers[j].container;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < min2 && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (minD - d) / 2;
          const ux = (dx / d) * push;
          const uy = (dy / d) * push;
          const na = closestPointOnUnion(a.x - ux, a.y - uy, this.walkable);
          const nb = closestPointOnUnion(b.x + ux, b.y + uy, this.walkable);
          a.setPosition(na.x, na.y);
          b.setPosition(nb.x, nb.y);
        }
      }
    }
  }

  private updateProjectiles(delta: number) {
    const px = this.input.activePointer.worldX;
    const py = this.input.activePointer.worldY;
    const dt = delta / 1000;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const go = p.go;
      go.x += p.vx * dt;
      go.y += p.vy * dt;

      if (
        go.x < -80 ||
        go.x > this.width + 80 ||
        go.y < -80 ||
        go.y > this.height + 80
      ) {
        p.go.destroy();
        this.projectiles.splice(i, 1);
        continue;
      }

      const hitR = p.kind === "dart" ? 10 : 22;
      if (distSq(go.x, go.y, px, py) < (hitR + 8) * (hitR + 8)) {
        this.applyPointerDebuff(p.kind);
        p.go.destroy();
        this.projectiles.splice(i, 1);
        continue;
      }

      this.checkFurnitureHit(go.x, go.y, p.kind);
    }
  }

  private applyPointerDebuff(kind: "dart" | "hammer") {
    const now = this.time.now;
    const extra = kind === "dart" ? 420 : 1200;
    this.debuffUntil = Math.max(this.debuffUntil, now + extra);
    this.cameras.main.flash(120, kind === "dart" ? 80 : 120, 40, 40, false);
  }

  private checkFurnitureHit(x: number, y: number, kind: "dart" | "hammer") {
    const shake = kind === "dart" ? 3 : 9;
    const dur = kind === "dart" ? 90 : 160;

    if (this.table) {
      const b = this.table.getBounds();
      if (b.contains(x, y)) {
        this.tweens.add({
          targets: this.table,
          angle: { from: -shake, to: shake },
          duration: dur,
          yoyo: true,
          repeat: 1,
        });
      }
    }

    if (this.lampGroup) {
      const gx = this.lampGroup.x;
      const gy = this.lampGroup.y;
      if (distSq(x, y, gx, gy) < (kind === "dart" ? 900 : 1600)) {
        this.tweens.add({
          targets: this.lampGroup,
          x: gx + Phaser.Math.Between(-6, 6),
          y: gy + Phaser.Math.Between(-2, 6),
          duration: dur,
          yoyo: true,
        });
      }
    }
  }

  update(_time: number, delta: number) {
    if (this.hasEntered || !this.chaseEnabled) return;

    const px = this.input.activePointer.worldX;
    const py = this.input.activePointer.worldY;

    for (const c of this.chasers) {
      this.moveChaserToward(c, px, py, delta);
    }
    this.separateChasers();

    for (const c of this.chasers) {
      const { x, y } = c.container;
      if (distSq(x, y, px, py) < CAUGHT_RADIUS * CAUGHT_RADIUS) {
        this.tryEnter();
        break;
      }
    }

    this.updateProjectiles(delta);
  }

  private get width() {
    return this.scale.width;
  }

  private get height() {
    return this.scale.height;
  }
}
