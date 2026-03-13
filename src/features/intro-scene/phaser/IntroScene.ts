import * as Phaser from "phaser";

/** Layout: wide, breathable indoor cross-section (0–1 normalized) */
const LAYOUT = {
  floor1Ratio: 0.52,
  floor2Ratio: 0.48,
  wallThickness: 0.008,
  livingRoomWidth: 0.28,
  stairsWidth: 0.22,
  kitchenWidth: 0.50,
} as const;

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

export default class IntroScene extends Phaser.Scene {
  private exclamationMark?: Phaser.GameObjects.Text;
  private speechBubble?: Phaser.GameObjects.Container;
  private topHint?: Phaser.GameObjects.Text;

  constructor() {
    super("IntroScene");
  }

  preload() {}

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor("#0a0806");

    this.buildStructure();
    this.buildFloor1();
    this.buildFloor2();
    this.buildStoryElements();
    this.playOpeningSequence();
  }

  buildStructure() {
    const w = this.width;
    const h = this.height;
    const wallT = Math.max(4, w * LAYOUT.wallThickness);
    const floor1Y = h * (1 - LAYOUT.floor1Ratio);

    // Interior walls – full height, edge-to-edge
    this.add.rectangle(wallT / 2, h / 2, wallT, h + 4, COLORS.wall);
    this.add.rectangle(w - wallT / 2, h / 2, wallT, h + 4, COLORS.wall);

    // Floor 1 (ground) – warm wood tone
    this.add.rectangle(w / 2, floor1Y + (h - floor1Y) / 2, w, h - floor1Y, COLORS.floor1);
    this.add.rectangle(w / 2, floor1Y + (h - floor1Y) * 0.92, w, (h - floor1Y) * 0.04, COLORS.floor1Warm);

    // Floor 2 divider (ceiling / bedroom floor)
    const divThick = 10;
    this.add.rectangle(w / 2, floor1Y - divThick / 2, w, divThick, COLORS.floorDivider);

    // Bedroom floor surface
    const floor2H = floor1Y - divThick;
    this.add.rectangle(w / 2, floor2H / 2, w, floor2H, COLORS.floor2);

    // Softer upstairs atmosphere (cool tint)
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

    // --- Living room: small sofa, small table ---
    const livingW = livingRight - livingLeft;
    const sofaW = livingW * 0.5;
    const sofaH = floor1H * 0.12;
    const sofaX = livingLeft + livingW * 0.35;
    const sofaY = roomMidY + floor1H * 0.08;

    this.add.rectangle(sofaX, sofaY, sofaW, sofaH * 0.6, COLORS.sofaSeat);
    this.add.rectangle(sofaX - sofaW * 0.15, sofaY - sofaH * 0.2, sofaW * 0.2, sofaH * 1.1, COLORS.sofaBack);

    const tableW = livingW * 0.22;
    const tableH = floor1H * 0.05;
    this.add.rectangle(sofaX + sofaW * 0.35, sofaY + sofaH * 0.55, tableW, tableH, COLORS.table);

    // Floor lamp
    const lampX = livingLeft + livingW * 0.78;
    const lampY = roomMidY - floor1H * 0.05;
    this.add.rectangle(lampX, lampY + floor1H * 0.18, 3, floor1H * 0.25, COLORS.lampBase);
    this.add.circle(lampX, lampY, 8, COLORS.lampGlow, 0.6);

    // --- Stairs ---
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

    // --- Kitchen: slim counter, small fridge ---
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

    // Warm lighting overlay (first floor) – behind characters
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
    const floor2H = floor1Y - 10;
    const roomLeft = wallT;
    const roomRight = w - wallT;
    const roomMidY = floor2H / 2;

    // --- Bed (small) ---
    const bedW = (roomRight - roomLeft) * 0.2;
    const bedH = floor2H * 0.28;
    const bedX = roomLeft + (roomRight - roomLeft) * 0.22;
    const bedY = roomMidY + bedH * 0.05;

    this.add.rectangle(bedX, bedY, bedW, bedH * 0.12, COLORS.bedFrame);
    this.add.rectangle(bedX, bedY - bedH * 0.15, bedW * 0.95, bedH * 0.75, COLORS.bedSheet);

    // --- Cabinet (small) ---
    const cabinetW = (roomRight - roomLeft) * 0.1;
    const cabinetH = floor2H * 0.42;
    const cabinetX = roomRight - cabinetW * 0.65;
    const cabinetY = roomMidY - cabinetH * 0.05;

    this.add.rectangle(cabinetX, cabinetY, cabinetW, cabinetH, COLORS.cabinet);
    this.add.rectangle(cabinetX - cabinetW * 0.25, cabinetY, cabinetW * 0.08, cabinetH * 0.9, COLORS.cabinetDoor);

    // --- Window ---
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

  buildStoryElements() {
    const { width, height } = this.scale;
    const floor1Y = height * (1 - LAYOUT.floor1Ratio);
    const floor1H = height - floor1Y;
    const storyDepth = 100;

    // Blue stick figure (smoking) – in living room, more space around
    const blueX = width * 0.12;
    const blueY = floor1Y + floor1H * 0.55;
    this.drawStickman(blueX, blueY, 0x3b82f6, storyDepth);

    this.add.rectangle(blueX + 14, blueY - 2, 10, 2, 0xd1d5db).setDepth(storyDepth);
    this.add.circle(blueX + 18, blueY - 2, 1.5, 0xff6b6b).setDepth(storyDepth);
    this.createSmoke(blueX + 22, blueY - 16, storyDepth);

    // Yellow stick figure – in bedroom area
    const yellowX = width * 0.82;
    const yellowY = height * 0.28;
    this.drawStickman(yellowX, yellowY, 0xeab308, storyDepth);

    this.topHint = this.add
      .text(width / 2, 36, "They saw you. Click to enter, or keep moving.", {
        fontSize: "16px",
        color: "#c8c0b8",
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(storyDepth);

    this.exclamationMark = this.add
      .text(yellowX, yellowY - 48, "!", {
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
      .rectangle(yellowX + 58, yellowY - 72, bubbleW, bubbleH, 0xffffff)
      .setStrokeStyle(1.5, 0x333333)
      .setDepth(storyDepth);

    const bubbleText = this.add
      .text(yellowX + 58, yellowY - 72, "抓住他", {
        fontSize: "18px",
        color: "#222222",
      })
      .setOrigin(0.5)
      .setDepth(storyDepth);

    this.speechBubble = this.add.container(0, 0, [bubbleBg, bubbleText]).setAlpha(0).setDepth(storyDepth);
  }

  private drawStickman(x: number, y: number, color: number, depth = 0) {
    this.add.circle(x, y - 18, 7, color).setDepth(depth);
    this.add.rectangle(x, y, 3, 22, color).setDepth(depth);
    this.add.rectangle(x - 8, y - 3, 14, 2, color).setDepth(depth);
    this.add.rectangle(x + 8, y - 3, 14, 2, color).setDepth(depth);
    this.add.rectangle(x - 4, y + 14, 2, 14, color).setDepth(depth);
    this.add.rectangle(x + 4, y + 14, 2, 14, color).setDepth(depth);
  }

  private createSmoke(x: number, y: number, depth = 0) {
    for (let i = 0; i < 3; i++) {
      const puff = this.add.circle(x + i * 5, y - i * 6, 5 - i, 0xd1d5db, 0.45).setDepth(depth);

      this.tweens.add({
        targets: puff,
        y: puff.y - 24,
        x: puff.x + Phaser.Math.Between(-5, 5),
        alpha: 0,
        duration: 2000 + i * 280,
        repeat: -1,
        repeatDelay: 180,
        onRepeat: () => {
          puff.setY(y - i * 6);
          puff.setX(x + i * 5);
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

  private get width() {
    return this.scale.width;
  }

  private get height() {
    return this.scale.height;
  }

  update() {}
}
