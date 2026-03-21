import * as Phaser from "phaser";

const LAYOUT = {
  floor1Ratio: 0.56,
  wallThickness: 0.01,
  leftRoomWidth: 0.42,
  stairsWidth: 0.28,
} as const;

const DIV_THICK = 10;
const CHASE_START_MS = 1200;
const MAX_CHASERS = 6;
const REINFORCE_EVERY_MS = 8000;
const WEAPON_EVERY_MS = 4500;

const COLORS = {
  upperWallpaper: 0xe8dfd2,
  lowerWallpaper: 0xe2d7c8,
  stripe: 0xc9b9a3,
  woodFloor: 0xb1835d,
  upperFloor: 0xa06f49,
  baseTrim: 0x6f4b2e,
  beam: 0x7a5033,
  railing: 0x6f4a31,
  stone: 0x6f6c67,
  stoneDark: 0x4f4b48,
  moss: 0x6e7b47,
  rug: 0xd8c5a6,
  rugAccent: 0xb88f73,
  curtain: 0xf3eadf,
  windowFrame: 0x745a46,
  sky: 0xbcdcf0,
  foliage: 0x7fa06b,
  sofa: 0xb9855b,
  sofaDark: 0x8f5f42,
  table: 0x8b5f3d,
  wood: 0x8b5e3b,
  woodDark: 0x5d3d28,
  cream: 0xf7f0e5,
  tile: 0xf1e3d2,
  tileLine: 0xcfb59a,
  stove: 0x4f4f53,
  fire: 0xffb347,
  ember: 0xff7a2f,
  book: 0x78936b,
  lamp: 0xf8d58a,
  outline: 0x2a211b,
} as const;

type AxisRect = { left: number; top: number; right: number; bottom: number };
type Point = { x: number; y: number };

type Chaser = {
  container: Phaser.GameObjects.Container;
  speed: number;
  color: number;
  phase: number;
  variant: StickmanVariant;
};

type Projectile = {
  go: Phaser.GameObjects.Triangle | Phaser.GameObjects.Container;
  vx: number;
  vy: number;
  kind: "dart" | "hammer";
};

type SceneInitData = { onEnter?: () => void };
type StickmanVariant = "runLeft" | "runRight" | "idle" | "jump" | "victory";

let pendingOnEnter: (() => void) | undefined;

export function setIntroOnEnter(cb: (() => void) | undefined) {
  pendingOnEnter = cb;
}

function distSq(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function pointToSegmentDistanceSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return distSq(px, py, ax, ay);
  const apx = px - ax;
  const apy = py - ay;
  const t = Phaser.Math.Clamp((apx * abx + apy * aby) / ab2, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return distSq(px, py, cx, cy);
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
  private downstairsRect?: AxisRect;
  private upstairsRect?: AxisRect;
  private stairsRect?: AxisRect;
  private stairBottom?: Point;
  private stairTop?: Point;

  private exclamationMark?: Phaser.GameObjects.Text;
  private speechBubble?: Phaser.GameObjects.Container;
  private topHint?: Phaser.GameObjects.Text;

  private chasers: Chaser[] = [];
  private projectiles: Projectile[] = [];

  private table?: Phaser.GameObjects.Rectangle;
  private lampGroup?: Phaser.GameObjects.Container;

  private debuffUntil = 0;
  private chaseTargetX = 0;
  private chaseTargetY = 0;
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
    this.buildDownstairs();
    this.buildUpstairs();
    this.buildStoryElements();
    this.playOpeningSequence();
    this.setupInput();
    this.time.delayedCall(CHASE_START_MS, () => {
      this.chaseEnabled = true;
      this.chaseTargetX = this.input.activePointer.worldX;
      this.chaseTargetY = this.input.activePointer.worldY;
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
    const leftRoomRight = wallT + w * LAYOUT.leftRoomWidth;
    const stairsLeft = leftRoomRight;
    const stairsRight = stairsLeft + w * LAYOUT.stairsWidth;

    this.downstairsRect = { left: wallT, top: floor1Y, right: w - wallT, bottom: h - 8 };
    this.upstairsRect = { left: wallT, top: 8, right: w - wallT, bottom: floor2H - 12 };
    this.stairsRect = {
      left: stairsLeft + 8,
      top: floor2H * 0.24,
      right: stairsRight - 6,
      bottom: floor1Y + (h - floor1Y) * 0.98,
    };

    this.walkable = [this.downstairsRect, this.upstairsRect, this.stairsRect];
    this.stairBottom = {
      x: (this.stairsRect.left + this.stairsRect.right) / 2,
      y: this.downstairsRect.top + (this.downstairsRect.bottom - this.downstairsRect.top) * 0.82,
    };
    this.stairTop = {
      x: this.stairsRect.left + (this.stairsRect.right - this.stairsRect.left) * 0.7,
      y: this.upstairsRect.bottom - Math.min(24, floor2H * 0.08),
    };
  }

  private setupInput() {
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.chaseTargetX = pointer.worldX;
      this.chaseTargetY = pointer.worldY;
    });
  }


  private getFloorZone(x: number, y: number) {
    if (this.upstairsRect && pointInAnyRect(x, y, [this.upstairsRect])) return "upstairs" as const;
    if (this.downstairsRect && pointInAnyRect(x, y, [this.downstairsRect])) return "downstairs" as const;
    if (this.stairsRect && pointInAnyRect(x, y, [this.stairsRect])) return "stairs" as const;
    return "stairs" as const;
  }

  private getChaseWaypoint(chaser: Chaser, tx: number, ty: number) {
    const chaserZone = this.getFloorZone(chaser.container.x, chaser.container.y);
    const targetZone = this.getFloorZone(tx, ty);

    if (targetZone === "upstairs") {
      if (chaserZone === "downstairs" && this.stairBottom) {
        if (distSq(chaser.container.x, chaser.container.y, this.stairBottom.x, this.stairBottom.y) > 22 * 22) {
          return this.stairBottom;
        }
      }

      if (chaserZone === "stairs" && this.stairTop) {
        return this.stairTop;
      }
    }

    if (targetZone === "downstairs") {
      if (chaserZone === "upstairs" && this.stairTop) {
        if (distSq(chaser.container.x, chaser.container.y, this.stairTop.x, this.stairTop.y) > 22 * 22) {
          return this.stairTop;
        }
      }

      if (chaserZone === "stairs" && this.stairBottom) {
        return this.stairBottom;
      }
    }

    return { x: tx, y: ty };
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
        const palette = [0x111111, 0x8b5cf6, 0xef4444, 0x0ea5e9, 0x22c55e, 0xf97316];
        const tint = palette[this.chasers.length % palette.length];
        const variants: StickmanVariant[] = ["runLeft", "runRight", "jump", "idle", "victory"];
        this.spawnChaserAt(p.x, p.y, tint, variants[this.chasers.length % variants.length]);
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

  private spawnChaserAt(x: number, y: number, color: number, variant: StickmanVariant) {
    const c = this.createStickmanContainer(x, y, color, 110, variant);
    this.chasers.push({
      container: c,
      speed: Phaser.Math.Between(95, 140),
      color,
      phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      variant,
    });
  }

  private getHandWorldPos(container: Phaser.GameObjects.Container, targetX: number) {
    const dx = targetX - container.x;
    const localX = dx >= 0 ? 14 : -14;
    return { x: container.x + localX, y: container.y - 10 };
  }

  private spawnProjectile() {
    if (this.chasers.length === 0) return;

    const px = this.input.activePointer.worldX;
    const py = this.input.activePointer.worldY;
    const shooter = this.chasers[Phaser.Math.Between(0, this.chasers.length - 1)];
    const { x: sx, y: sy } = this.getHandWorldPos(shooter.container, px);

    const kind = this.nextWeaponDart ? "dart" : "hammer";
    this.nextWeaponDart = !this.nextWeaponDart;

    const dx = px - sx;
    const dy = py - sy;
    const len = Math.hypot(dx, dy) || 1;
    const speed = kind === "dart" ? 520 : 180;
    const vx = (dx / len) * speed;
    const vy = (dy / len) * speed;
    const angle = Math.atan2(dy, dx);

    let go: Phaser.GameObjects.Triangle | Phaser.GameObjects.Container;
    if (kind === "dart") {
      const tri = this.add.triangle(sx, sy, 0, -6, 10, 0, 0, 6, 0x22c55e);
      tri.setStrokeStyle(1, 0x14532d);
      tri.setRotation(angle);
      go = tri;
    } else {
      const head = this.add.rectangle(10, 0, 22, 16, 0x78716c);
      const handle = this.add.rectangle(-4, 0, 14, 4, 0x57534e);
      const cont = this.add.container(sx, sy, [handle, head]);
      cont.setRotation(angle);
      go = cont;
    }

    go.setDepth(200);
    this.projectiles.push({ go, vx, vy, kind });
  }

  private buildStructure() {
    const w = this.width;
    const h = this.height;
    const wallT = Math.max(4, w * LAYOUT.wallThickness);
    const floor1Y = h * (1 - LAYOUT.floor1Ratio);
    const floor2H = floor1Y - DIV_THICK;

    this.add.rectangle(w / 2, h / 2, w, h, 0x231913);
    this.drawWallpaperArea(w / 2, floor2H / 2, w - wallT * 2, floor2H, COLORS.upperWallpaper);
    this.drawWallpaperArea(w / 2, floor1Y + (h - floor1Y) / 2, w - wallT * 2, h - floor1Y, COLORS.lowerWallpaper);

    this.add.rectangle(wallT / 2, h / 2, wallT, h + 4, COLORS.beam);
    this.add.rectangle(w - wallT / 2, h / 2, wallT, h + 4, COLORS.beam);
    this.add.rectangle(w / 2, 10, w, 18, COLORS.beam);
    this.add.rectangle(w / 2, floor1Y - DIV_THICK / 2, w, DIV_THICK, COLORS.beam);
    this.add.rectangle(w / 2, h - 8, w, 16, COLORS.baseTrim);

    const upperFloorPlankY = floor1Y - 18;
    this.add.rectangle(w / 2, upperFloorPlankY, w, 20, COLORS.upperFloor).setDepth(4);
    for (let i = 0; i < 14; i++) {
      const x = (w / 14) * i + w / 28;
      this.add.rectangle(x, upperFloorPlankY, 2, 20, COLORS.woodDark, 0.28).setDepth(5);
    }

    const lowerFloorH = h - floor1Y;
    for (let i = 0; i < 18; i++) {
      const x = (w / 18) * i + w / 36;
      this.add.rectangle(x, floor1Y + lowerFloorH * 0.5, w / 18 - 1, lowerFloorH, COLORS.woodFloor).setDepth(1);
      this.add.rectangle(x, floor1Y + lowerFloorH * 0.5, 2, lowerFloorH, COLORS.woodDark, 0.12).setDepth(2);
    }
  }

  private drawWallpaperArea(x: number, y: number, width: number, height: number, fill: number) {
    this.add.rectangle(x, y, width, height, fill);
    for (let i = 0; i < 22; i++) {
      const stripeX = x - width / 2 + (width / 22) * i + width / 44;
      this.add.rectangle(stripeX, y, 2, height, COLORS.stripe, 0.45);
    }
  }

  private buildDownstairs() {
    const w = this.width;
    const h = this.height;
    const wallT = Math.max(4, w * LAYOUT.wallThickness);
    const floor1Y = h * (1 - LAYOUT.floor1Ratio);
    const floor1H = h - floor1Y;
    const leftRoomRight = wallT + w * LAYOUT.leftRoomWidth;
    const stairsLeft = leftRoomRight;
    const stairsRight = stairsLeft + w * LAYOUT.stairsWidth;
    const rightRoomLeft = stairsRight;

    this.buildKitchen(wallT, leftRoomRight, floor1Y, floor1H);
    this.buildStairHall(stairsLeft, stairsRight, floor1Y, floor1H);
    this.buildStoneRoom(rightRoomLeft, w - wallT, floor1Y, floor1H);
  }

  private buildKitchen(left: number, right: number, floor1Y: number, floor1H: number) {
    const roomW = right - left;
    const roomMidY = floor1Y + floor1H / 2;

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 8; col++) {
        const x = left + roomW * 0.08 + col * (roomW * 0.095);
        const y = floor1Y + floor1H * 0.18 + row * (floor1H * 0.11);
        this.add.rectangle(x, y, roomW * 0.09, floor1H * 0.1, COLORS.tile).setStrokeStyle(1, COLORS.tileLine, 0.7);
      }
    }

    const counter = this.add.rectangle(left + roomW * 0.2, roomMidY + floor1H * 0.18, roomW * 0.34, floor1H * 0.32, COLORS.wood);
    counter.setStrokeStyle(3, COLORS.woodDark);
    const sideCounter = this.add.rectangle(left + roomW * 0.06, roomMidY + floor1H * 0.1, roomW * 0.18, floor1H * 0.42, COLORS.wood);
    sideCounter.setStrokeStyle(3, COLORS.woodDark);
    const topCounter = this.add.rectangle(left + roomW * 0.2, roomMidY + floor1H * 0.01, roomW * 0.36, floor1H * 0.04, 0x7a5866);
    const sideTop = this.add.rectangle(left + roomW * 0.06, roomMidY - floor1H * 0.11, roomW * 0.18, floor1H * 0.04, 0x7a5866);
    topCounter.setDepth(5);
    sideTop.setDepth(5);

    const tableX = left + roomW * 0.33;
    const tableY = floor1Y + floor1H * 0.62;
    this.table = this.add.rectangle(tableX, tableY, roomW * 0.26, floor1H * 0.15, 0xaa7b4d);
    this.table.setStrokeStyle(3, COLORS.woodDark).setDepth(8);
    this.add.rectangle(tableX - roomW * 0.1, tableY + floor1H * 0.13, roomW * 0.06, floor1H * 0.16, 0x9b6d43).setDepth(6);
    this.add.rectangle(tableX + roomW * 0.1, tableY + floor1H * 0.13, roomW * 0.06, floor1H * 0.16, 0x9b6d43).setDepth(6);

    this.add.rectangle(left + roomW * 0.26, floor1Y + floor1H * 0.82, roomW * 0.1, floor1H * 0.18, 0xa06f49).setDepth(5);
    this.add.rectangle(left + roomW * 0.4, floor1Y + floor1H * 0.82, roomW * 0.1, floor1H * 0.18, 0xa06f49).setDepth(5);

    this.add.rectangle(left + roomW * 0.68, roomMidY + floor1H * 0.02, roomW * 0.22, floor1H * 0.3, COLORS.cream).setStrokeStyle(2, 0xc9baa5);
    this.add.rectangle(left + roomW * 0.68, roomMidY + floor1H * 0.02, roomW * 0.08, floor1H * 0.08, 0xc4dfe6).setStrokeStyle(2, 0x7f8c8d);
    this.add.circle(left + roomW * 0.63, roomMidY + floor1H * 0.02, floor1H * 0.025, 0x97a6b0);
    this.add.rectangle(left + roomW * 0.63, roomMidY + floor1H * 0.08, 4, floor1H * 0.08, 0x7f8c8d);

    this.drawWindow(left + roomW * 0.56, floor1Y + floor1H * 0.22, roomW * 0.18, floor1H * 0.28, true);
    this.drawHangingLamp(left + roomW * 0.35, floor1Y + floor1H * 0.18, floor1H * 0.17);
    this.drawPanRack(left + roomW * 0.12, floor1Y + floor1H * 0.14, roomW * 0.16, 4);
  }

  private buildStairHall(left: number, right: number, floor1Y: number, floor1H: number) {
    const stairW = right - left;
    const steps = 8;
    const stepRun = stairW * 0.12;
    const stepRise = floor1H * 0.1;
    const baseX = right - stepRun * 0.65;
    const baseY = floor1Y + floor1H * 0.82;

    for (let i = 0; i < steps; i++) {
      const x = baseX - i * stepRun;
      const y = baseY - i * stepRise;
      this.add.rectangle(x, y, stepRun * 1.05, stepRise * 0.28, 0xa37049).setDepth(10);
      this.add.rectangle(x + stepRun * 0.45, y + stepRise * 0.28, stepRun * 0.22, stepRise * 0.64, 0x7d5436).setDepth(9);
    }

    const rail = this.add.graphics();
    rail.lineStyle(4, COLORS.railing, 1);
    rail.beginPath();
    rail.moveTo(left + stairW * 0.14, floor1Y + floor1H * 0.76);
    rail.lineTo(right - stairW * 0.02, floor1Y + floor1H * 0.16);
    rail.strokePath();
    rail.lineStyle(3, COLORS.railing, 1);
    for (let i = 0; i < 7; i++) {
      const x = left + stairW * (0.18 + i * 0.1);
      const yTop = floor1Y + floor1H * (0.73 - i * 0.085);
      const yBottom = yTop + floor1H * 0.19;
      rail.beginPath();
      rail.moveTo(x, yTop);
      rail.lineTo(x, yBottom);
      rail.strokePath();
    }

    this.add.rectangle(right - stairW * 0.04, floor1Y + floor1H * 0.09, stairW * 0.06, floor1H * 0.34, COLORS.railing).setDepth(10);
    this.add.rectangle(left + stairW * 0.1, floor1Y + floor1H * 0.86, stairW * 0.08, floor1H * 0.26, COLORS.railing).setDepth(10);

    const shelfX = left + stairW * 0.06;
    const shelfY = floor1Y + floor1H * 0.44;
    this.add.rectangle(shelfX, shelfY, stairW * 0.18, floor1H * 0.42, 0x8b5f3d).setStrokeStyle(3, COLORS.woodDark);
    for (let i = 0; i < 3; i++) {
      this.add.rectangle(shelfX, shelfY - floor1H * 0.13 + i * floor1H * 0.13, stairW * 0.16, 3, COLORS.woodDark);
      for (let j = 0; j < 4; j++) {
        this.add.rectangle(
          shelfX - stairW * 0.055 + j * stairW * 0.035,
          shelfY - floor1H * 0.16 + i * floor1H * 0.13,
          stairW * 0.02,
          floor1H * 0.08,
          [0xb97758, 0x6d8764, 0xc6a057, 0x4f6c8c][(i + j) % 4]
        );
      }
    }

    this.add.rectangle(left + stairW * 0.26, floor1Y + floor1H * 0.9, stairW * 0.18, floor1H * 0.06, 0xb98e56).setStrokeStyle(2, COLORS.woodDark);
    this.add.rectangle(left + stairW * 0.31, floor1Y + floor1H * 0.84, stairW * 0.1, floor1H * 0.06, 0xc9a45e).setStrokeStyle(2, COLORS.woodDark);
  }

  private buildStoneRoom(left: number, right: number, floor1Y: number, floor1H: number) {
    const roomW = right - left;
    const roomMidY = floor1Y + floor1H / 2;

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        const x = left + roomW * 0.12 + col * roomW * 0.17;
        const y = floor1Y + floor1H * 0.15 + row * floor1H * 0.16;
        this.add.rectangle(x, y, roomW * 0.16, floor1H * 0.14, row % 2 === 0 ? COLORS.stone : COLORS.stoneDark, 0.92).setStrokeStyle(1, 0x3c3937, 0.6);
      }
    }

    const stoveX = left + roomW * 0.56;
    const stoveY = floor1Y + floor1H * 0.63;
    this.add.rectangle(stoveX, stoveY, roomW * 0.18, floor1H * 0.23, 0x7a7b80).setStrokeStyle(3, 0x34363b);
    this.add.rectangle(stoveX, stoveY - floor1H * 0.22, roomW * 0.05, floor1H * 0.24, 0x5d5f64).setDepth(5);
    this.add.rectangle(stoveX, stoveY - floor1H * 0.35, roomW * 0.15, floor1H * 0.12, 0x5d5f64).setStrokeStyle(3, 0x34363b).setDepth(5);
    this.add.circle(stoveX + roomW * 0.035, stoveY + floor1H * 0.02, floor1H * 0.022, COLORS.fire).setDepth(6);
    this.add.circle(stoveX + roomW * 0.005, stoveY + floor1H * 0.05, floor1H * 0.03, COLORS.ember).setDepth(6);

    this.add.ellipse(left + roomW * 0.22, floor1Y + floor1H * 0.58, roomW * 0.12, floor1H * 0.26, 0x8b633f).setStrokeStyle(3, COLORS.woodDark);
    this.add.rectangle(left + roomW * 0.22, floor1Y + floor1H * 0.41, roomW * 0.06, floor1H * 0.05, 0x3c2b20).setDepth(5);
    this.add.arc(left + roomW * 0.08, floor1Y + floor1H * 0.72, roomW * 0.09, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false, 0x8b633f).setStrokeStyle(4, COLORS.woodDark);

    this.add.rectangle(left + roomW * 0.12, floor1Y + floor1H * 0.87, roomW * 0.14, floor1H * 0.06, COLORS.moss, 0.75);
    this.add.rectangle(left + roomW * 0.46, floor1Y + floor1H * 0.9, roomW * 0.12, floor1H * 0.05, COLORS.moss, 0.7);
    this.add.rectangle(left + roomW * 0.7, floor1Y + floor1H * 0.84, roomW * 0.14, floor1H * 0.05, COLORS.moss, 0.65);

    this.add.rectangle(left + roomW * 0.84, roomMidY + floor1H * 0.1, roomW * 0.12, floor1H * 0.18, 0x8b6a4a).setStrokeStyle(3, COLORS.woodDark);
    this.add.rectangle(left + roomW * 0.8, roomMidY + floor1H * 0.22, roomW * 0.05, floor1H * 0.2, 0x9c784f).setDepth(4);
    this.drawFrame(left + roomW * 0.8, floor1Y + floor1H * 0.3, roomW * 0.12, floor1H * 0.16, 0xc7b18d);
  }

  private buildUpstairs() {
    const w = this.width;
    const h = this.height;
    const wallT = Math.max(4, w * LAYOUT.wallThickness);
    const floor1Y = h * (1 - LAYOUT.floor1Ratio);
    const floor2H = floor1Y - DIV_THICK;

    const kitchenLeft = wallT;
    const kitchenRight = wallT + w * 0.28;
    const loungeLeft = kitchenRight;
    const loungeRight = w * 0.86;
    const porchLeft = loungeRight;
    const porchRight = w - wallT;

    this.buildUpperKitchen(kitchenLeft, kitchenRight, floor2H);
    this.buildUpperLounge(loungeLeft, loungeRight, floor2H);
    this.buildUpperPorch(porchLeft, porchRight, floor2H);
  }

  private buildUpperKitchen(left: number, right: number, floor2H: number) {
    const roomW = right - left;
    const cookerX = left + roomW * 0.22;
    const cookerY = floor2H * 0.64;

    this.add.rectangle(cookerX, cookerY, roomW * 0.18, floor2H * 0.2, 0x7b7d81).setStrokeStyle(3, 0x3d4044);
    this.add.rectangle(cookerX, cookerY - floor2H * 0.2, roomW * 0.12, floor2H * 0.18, 0x484b50).setDepth(6);
    this.add.triangle(cookerX, cookerY - floor2H * 0.39, 0, floor2H * 0.08, roomW * 0.12, floor2H * 0.08, roomW * 0.06, -floor2H * 0.08, 0x63666b).setDepth(6);

    this.add.rectangle(left + roomW * 0.09, floor2H * 0.78, roomW * 0.24, floor2H * 0.08, 0xa87851).setStrokeStyle(3, COLORS.woodDark);
    this.add.rectangle(left + roomW * 0.08, floor2H * 0.71, roomW * 0.04, floor2H * 0.11, 0x8e6342).setDepth(5);
    this.add.rectangle(left + roomW * 0.18, floor2H * 0.71, roomW * 0.04, floor2H * 0.11, 0x8e6342).setDepth(5);

    this.drawPanRack(left + roomW * 0.2, floor2H * 0.45, roomW * 0.22, 5);
    this.drawHangingLamp(left + roomW * 0.58, floor2H * 0.2, floor2H * 0.16);
    this.drawFrame(left + roomW * 0.54, floor2H * 0.23, roomW * 0.14, floor2H * 0.12, 0xb9a07d);
  }

  private buildUpperLounge(left: number, right: number, floor2H: number) {
    const roomW = right - left;
    const centerY = floor2H * 0.58;

    const fireplaceX = left + roomW * 0.18;
    const fireplaceY = centerY + floor2H * 0.02;
    this.add.rectangle(fireplaceX, fireplaceY, roomW * 0.16, floor2H * 0.3, 0x8d8178).setStrokeStyle(3, 0x5e564f);
    this.add.rectangle(fireplaceX, fireplaceY - floor2H * 0.12, roomW * 0.19, floor2H * 0.03, 0x6e5c4a).setDepth(5);
    this.add.rectangle(fireplaceX, fireplaceY - floor2H * 0.18, roomW * 0.04, floor2H * 0.08, 0x6e5c4a).setDepth(4);
    this.add.rectangle(fireplaceX, fireplaceY + floor2H * 0.03, roomW * 0.08, floor2H * 0.1, 0x2e2a27).setDepth(5);
    this.add.circle(fireplaceX, fireplaceY + floor2H * 0.05, floor2H * 0.03, COLORS.fire).setDepth(6);
    this.add.circle(fireplaceX + roomW * 0.015, fireplaceY + floor2H * 0.04, floor2H * 0.016, COLORS.ember).setDepth(6);

    const armX = left + roomW * 0.38;
    const armY = centerY + floor2H * 0.02;
    this.add.ellipse(armX, armY, roomW * 0.12, floor2H * 0.23, COLORS.sofa).setStrokeStyle(3, COLORS.sofaDark);
    this.add.ellipse(armX - roomW * 0.035, armY - floor2H * 0.03, roomW * 0.05, floor2H * 0.15, COLORS.sofaDark).setDepth(6);

    const rugX = left + roomW * 0.56;
    const rugY = floor2H * 0.82;
    this.add.ellipse(rugX, rugY, roomW * 0.36, floor2H * 0.16, COLORS.rug, 0.9).setStrokeStyle(3, COLORS.rugAccent);
    this.add.ellipse(rugX, rugY, roomW * 0.22, floor2H * 0.08, COLORS.rugAccent, 0.18).setDepth(3);

    const tableX = left + roomW * 0.6;
    const tableY = centerY + floor2H * 0.08;
    this.add.rectangle(tableX, tableY, roomW * 0.16, floor2H * 0.05, COLORS.table).setStrokeStyle(3, COLORS.woodDark).setDepth(7);
    this.add.rectangle(tableX - roomW * 0.05, tableY + floor2H * 0.08, 4, floor2H * 0.12, COLORS.woodDark).setDepth(6);
    this.add.rectangle(tableX + roomW * 0.05, tableY + floor2H * 0.08, 4, floor2H * 0.12, COLORS.woodDark).setDepth(6);
    this.add.ellipse(tableX - roomW * 0.04, tableY - floor2H * 0.03, roomW * 0.04, floor2H * 0.02, 0x8fb2bd).setDepth(8);
    this.add.ellipse(tableX + roomW * 0.04, tableY - floor2H * 0.03, roomW * 0.04, floor2H * 0.02, 0x8fb2bd).setDepth(8);

    this.drawWindow(left + roomW * 0.56, floor2H * 0.24, roomW * 0.18, floor2H * 0.32, true);
    this.drawCurtains(left + roomW * 0.56, floor2H * 0.24, roomW * 0.23, floor2H * 0.4);
  }

  private buildUpperPorch(left: number, right: number, floor2H: number) {
    const roomW = right - left;
    const railY = floor2H * 0.78;
    this.add.rectangle((left + right) / 2, railY, roomW * 0.92, 5, COLORS.railing).setDepth(7);
    for (let i = 0; i < 4; i++) {
      this.add.rectangle(left + roomW * (0.15 + i * 0.18), railY + floor2H * 0.09, 4, floor2H * 0.18, COLORS.railing).setDepth(7);
    }
    this.add.rectangle(left + roomW * 0.08, railY + floor2H * 0.03, roomW * 0.06, floor2H * 0.25, COLORS.railing).setDepth(8);

    this.add.rectangle(right - roomW * 0.16, floor2H * 0.36, roomW * 0.18, floor2H * 0.44, 0x8f6444).setStrokeStyle(3, COLORS.woodDark);
    this.add.rectangle(right - roomW * 0.16, floor2H * 0.2, roomW * 0.18, floor2H * 0.03, 0xa3724a).setDepth(7);
    this.add.rectangle(right - roomW * 0.1, floor2H * 0.53, roomW * 0.08, floor2H * 0.12, 0x5e7b62).setStrokeStyle(2, 0x38503c).setDepth(8);
    this.drawFrame(right - roomW * 0.44, floor2H * 0.4, roomW * 0.12, floor2H * 0.16, 0xbea98f);

    this.drawWindow(left + roomW * 0.28, floor2H * 0.3, roomW * 0.16, floor2H * 0.34, false);
  }

  private drawWindow(x: number, y: number, width: number, height: number, withScenery: boolean) {
    this.add.rectangle(x, y, width, height, COLORS.sky).setStrokeStyle(4, COLORS.windowFrame);
    if (withScenery) {
      this.add.ellipse(x - width * 0.18, y + height * 0.25, width * 0.28, height * 0.18, COLORS.foliage, 0.9).setDepth(2);
      this.add.ellipse(x + width * 0.1, y + height * 0.22, width * 0.34, height * 0.2, 0x93b174, 0.9).setDepth(2);
    }
    this.add.rectangle(x, y, 3, height, COLORS.windowFrame).setDepth(4);
    this.add.rectangle(x, y, width, 3, COLORS.windowFrame).setDepth(4);
  }

  private drawCurtains(x: number, y: number, width: number, height: number) {
    this.add.rectangle(x - width * 0.28, y, width * 0.18, height, COLORS.curtain, 0.95).setStrokeStyle(1, 0xdacdbf).setDepth(5);
    this.add.rectangle(x + width * 0.28, y, width * 0.18, height, COLORS.curtain, 0.95).setStrokeStyle(1, 0xdacdbf).setDepth(5);
    this.add.rectangle(x, y - height * 0.52, width * 0.82, 4, COLORS.woodDark).setDepth(6);
  }

  private drawHangingLamp(x: number, y: number, height: number) {
    const cord = this.add.rectangle(0, height * 0.2, 2, height * 0.42, COLORS.outline);
    const shade = this.add.ellipse(0, height * 0.42, height * 0.38, height * 0.18, COLORS.lamp).setStrokeStyle(2, COLORS.outline);
    const bulb = this.add.circle(0, height * 0.45, height * 0.06, 0xfff3c0, 0.8);
    this.lampGroup = this.add.container(x, y, [cord, shade, bulb]);
    this.lampGroup.setDepth(8);
  }

  private drawPanRack(x: number, y: number, width: number, count: number) {
    this.add.rectangle(x, y, width, 3, COLORS.outline).setDepth(5);
    for (let i = 0; i < count; i++) {
      const px = x - width / 2 + (width / (count + 1)) * (i + 1);
      this.add.rectangle(px, y + 10, 2, 12, COLORS.outline).setDepth(5);
      this.add.circle(px, y + 24, 6 + (i % 2) * 2, 0x8d8e91).setStrokeStyle(2, COLORS.outline).setDepth(5);
    }
  }

  private drawFrame(x: number, y: number, width: number, height: number, fill: number) {
    this.add.rectangle(x, y, width, height, fill).setStrokeStyle(4, COLORS.woodDark);
    this.add.ellipse(x, y, width * 0.4, height * 0.25, 0x8aa87b, 0.8).setDepth(2);
  }

  private createStickmanContainer(x: number, y: number, color: number, depth: number, variant: StickmanVariant) {
    const c = this.add.container(x, y);
    c.setDepth(depth);

    const head = this.add.circle(0, -22, 10, 0xffffff).setStrokeStyle(2, COLORS.outline);
    const eyeL = this.add.circle(-3, -24, 1.2, COLORS.outline);
    const eyeR = this.add.circle(3, -24, 1.2, COLORS.outline);
    const smile = this.add.arc(0, -20, 4, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false, COLORS.outline).setStrokeStyle(2, COLORS.outline);
    c.add([head, eyeL, eyeR, smile]);

    const body = this.add.polygon(0, 0, [0, -10, 7, 12, -7, 12], color).setStrokeStyle(2, COLORS.outline);
    c.add(body);

    const graphics = this.add.graphics();
    graphics.lineStyle(3, COLORS.outline, 1);
    const pose = this.getStickPose(variant);
    graphics.beginPath();
    graphics.moveTo(pose.leftArm[0], pose.leftArm[1]);
    graphics.lineTo(pose.leftArm[2], pose.leftArm[3]);
    graphics.strokePath();
    graphics.beginPath();
    graphics.moveTo(pose.rightArm[0], pose.rightArm[1]);
    graphics.lineTo(pose.rightArm[2], pose.rightArm[3]);
    graphics.strokePath();
    graphics.beginPath();
    graphics.moveTo(pose.leftLeg[0], pose.leftLeg[1]);
    graphics.lineTo(pose.leftLeg[2], pose.leftLeg[3]);
    graphics.strokePath();
    graphics.beginPath();
    graphics.moveTo(pose.rightLeg[0], pose.rightLeg[1]);
    graphics.lineTo(pose.rightLeg[2], pose.rightLeg[3]);
    graphics.strokePath();
    c.add(graphics);

    for (const [hx, hy] of pose.hands) {
      c.add(this.add.circle(hx, hy, 2.4, 0xffffff).setStrokeStyle(2, COLORS.outline));
    }
    for (const [fx, fy] of pose.feet) {
      c.add(this.add.ellipse(fx, fy, 8, 3, 0xffffff).setStrokeStyle(2, COLORS.outline));
    }

    const shadow = this.add.ellipse(0, 28, 20, 5, 0x000000, 0.12);
    c.addAt(shadow, 0);
    return c;
  }

  private getStickPose(variant: StickmanVariant) {
    switch (variant) {
      case "runLeft":
        return {
          leftArm: [-2, -6, -16, 4],
          rightArm: [2, -4, 16, 8],
          leftLeg: [-2, 12, -14, 26],
          rightLeg: [2, 12, 12, 22],
          hands: [[-16, 4], [16, 8]] as [number, number][],
          feet: [[-16, 26], [13, 22]] as [number, number][],
        };
      case "runRight":
        return {
          leftArm: [-2, -4, -16, 10],
          rightArm: [2, -6, 16, 0],
          leftLeg: [-2, 12, -12, 22],
          rightLeg: [2, 12, 14, 28],
          hands: [[-16, 10], [16, 0]],
          feet: [[-12, 22], [15, 28]],
        };
      case "jump":
        return {
          leftArm: [-2, -6, -14, -14],
          rightArm: [2, -6, 14, -14],
          leftLeg: [-2, 12, -10, 24],
          rightLeg: [2, 12, 12, 20],
          hands: [[-14, -14], [14, -14]],
          feet: [[-10, 24], [13, 20]],
        };
      case "victory":
        return {
          leftArm: [-2, -6, -12, -20],
          rightArm: [2, -6, 12, -22],
          leftLeg: [-2, 12, -7, 28],
          rightLeg: [2, 12, 8, 28],
          hands: [[-12, -20], [12, -22]],
          feet: [[-7, 28], [9, 28]],
        };
      case "idle":
      default:
        return {
          leftArm: [-2, -4, -12, 6],
          rightArm: [2, -4, 12, 6],
          leftLeg: [-2, 12, -5, 28],
          rightLeg: [2, 12, 5, 28],
          hands: [[-12, 6], [12, 6]],
          feet: [[-5, 28], [6, 28]],
        };
    }
  }

  private buildStoryElements() {
    const { width, height } = this.scale;
    const floor1Y = height * (1 - LAYOUT.floor1Ratio);
    const floor1H = height - floor1Y;
    const storyDepth = 100;

    const palette = [0x111111, 0x7c3aed, 0xef4444, 0x0ea5e9, 0x22c55e];
    const blue = this.createStickmanContainer(width * 0.14, floor1Y + floor1H * 0.58, palette[0], storyDepth, "runLeft");
    const yellow = this.createStickmanContainer(width * 0.79, height * 0.26, palette[1], storyDepth, "runRight");

    this.topHint = this.add
      .text(width / 2, 36, "他们发现你了，被人物碰到就会进入。", {
        fontSize: "16px",
        color: "#e8ddcf",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(storyDepth);

    this.exclamationMark = this.add
      .text(0, -52, "!", {
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(storyDepth);

    const bubbleBg = this.add.rectangle(58, -76, 108, 40, 0xffffff).setStrokeStyle(2, 0x333333).setDepth(storyDepth);
    const bubbleText = this.add
      .text(58, -76, "抓住他！", {
        fontSize: "18px",
        color: "#222222",
      })
      .setOrigin(0.5)
      .setDepth(storyDepth);

    this.speechBubble = this.add.container(0, 0, [bubbleBg, bubbleText]).setAlpha(0).setDepth(storyDepth);
    yellow.add([this.exclamationMark, this.speechBubble]);

    this.chasers.push({ container: blue, speed: 120, color: palette[0], phase: 0, variant: "runLeft" });
    this.chasers.push({ container: yellow, speed: 115, color: palette[1], phase: Math.PI / 2, variant: "runRight" });
  }

  private isPointerTouchingChaser(chaser: Chaser, px: number, py: number) {
    const { x, y } = chaser.container;
    if (distSq(px, py, x, y - 22) <= 10 * 10) return true;
    if (distSq(px, py, x, y + 2) <= 13 * 13) return true;

    const pose = this.getStickPose(chaser.variant);
    const limbs = [pose.leftArm, pose.rightArm, pose.leftLeg, pose.rightLeg];
    return limbs.some(([ax, ay, bx, by]) => pointToSegmentDistanceSq(px, py, x + ax, y + ay, x + bx, y + by) <= 3.5 * 3.5);
  }

  private playOpeningSequence() {
    this.cameras.main.setAlpha(1);
    this.exclamationMark?.setAlpha(1);
    this.speechBubble?.setAlpha(1);
    this.topHint?.setAlpha(0.92);
  }

  private moveChaserToward(chaser: Chaser, tx: number, ty: number, delta: number) {
    const { x, y } = chaser.container;
    const dx = tx - x;
    const dy = ty - y;
    const len = Math.hypot(dx, dy) || 1;
    const step = chaser.speed * (delta / 1000);
    let nx = x + (dx / len) * Math.min(step, len);
    let ny = y + (dy / len) * Math.min(step, len);

    const clamped = closestPointOnUnion(nx, ny, this.walkable);
    nx = clamped.x;
    ny = clamped.y;

    chaser.container.setPosition(nx, ny + Math.sin(this.time.now / 180 + chaser.phase) * 0.4);
  }

  private separateChasers() {
    const minD = 34;
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

      if (go.x < -80 || go.x > this.width + 80 || go.y < -80 || go.y > this.height + 80) {
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

    const rx = this.input.activePointer.worldX;
    const ry = this.input.activePointer.worldY;
    const debuffed = this.time.now < this.debuffUntil;
    const followK = debuffed ? 5.5 : 18;
    const t = Math.min(1, (followK * delta) / 1000);
    this.chaseTargetX += (rx - this.chaseTargetX) * t;
    this.chaseTargetY += (ry - this.chaseTargetY) * t;

    for (const c of this.chasers) {
      const waypoint = this.getChaseWaypoint(c, this.chaseTargetX, this.chaseTargetY);
      this.moveChaserToward(c, waypoint.x, waypoint.y, delta);
    }
    this.separateChasers();

    for (const c of this.chasers) {
      if (this.isPointerTouchingChaser(c, rx, ry)) {
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
