import * as Phaser from "phaser";

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

    this.cameras.main.setBackgroundColor("#141414");

    // 背景墙体
    this.add.rectangle(width / 2, height / 2, width, height, 0x1c1c1c);

    // 二楼楼板
    this.add.rectangle(width / 2, height / 2, width, 10, 0x5a4b43);

    // 一楼地面
    this.add.rectangle(width / 2, height - 40, width, 80, 0x2f2f2f);

    // 左侧墙感
    this.add.rectangle(10, height / 2, 20, height, 0x232323);
    this.add.rectangle(width - 10, height / 2, 20, height, 0x232323);

    // 一楼客厅区域
    this.add.rectangle(220, height - 120, 180, 70, 0x4b5563); // 沙发
    this.add.rectangle(220, height - 70, 90, 20, 0x7c5a43); // 茶几
    this.add.rectangle(120, height - 150, 10, 80, 0x999999); // 灯杆
    this.add.triangle(120, height - 190, 0, 30, 30, 30, 15, 0, 0xf5deb3); // 灯罩

    // 一楼厨房区域
    this.add.rectangle(width - 220, height - 110, 260, 90, 0x374151); // 厨房台面
    this.add.rectangle(width - 90, height - 160, 70, 140, 0x9ca3af); // 冰箱
    this.add.rectangle(width - 250, height - 145, 40, 20, 0x1f2937); // 水槽占位

    // 楼梯
    for (let i = 0; i < 7; i++) {
      this.add.rectangle(
        width / 2 + 110 + i * 18,
        height - 80 - i * 28,
        55,
        8,
        0x8b5e3c
      );
    }

    // 二楼卧室区域
    this.add.rectangle(width - 250, height / 2 - 70, 180, 60, 0x6b7280); // 床
    this.add.rectangle(width - 120, height / 2 - 150, 90, 120, 0x8d6e63); // 衣柜
    this.add.rectangle(240, height / 2 - 120, 120, 80, 0xbfd7ea); // 窗户

    // 蓝色火柴人（抽烟）
    const blueX = 250;
    const blueY = height / 2 - 40;
    this.drawStickman(blueX, blueY, 0x3b82f6);

    // 烟
    this.add.rectangle(blueX + 18, blueY - 2, 12, 3, 0xd1d5db);
    this.add.circle(blueX + 23, blueY - 2, 2, 0xff6b6b);

    // 烟雾
    this.createSmoke(blueX + 28, blueY - 18);

    // 黄色火柴人（发现你）
    const yellowX = width - 280;
    const yellowY = height / 2 - 40;
    this.drawStickman(yellowX, yellowY, 0xeab308);

    // 顶部提示
    this.topHint = this.add
      .text(width / 2, 40, "They saw you. Click to enter, or keep moving.", {
        fontSize: "18px",
        color: "#d1d5db",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // 感叹号
    this.exclamationMark = this.add
      .text(yellowX, yellowY - 55, "!", {
        fontSize: "26px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    // 气泡
    const bubbleBg = this.add
      .rectangle(yellowX + 70, yellowY - 80, 120, 44, 0xffffff)
      .setStrokeStyle(2, 0x222222);

    const bubbleText = this.add
      .text(yellowX + 70, yellowY - 80, "抓住他", {
        fontSize: "20px",
        color: "#111111",
      })
      .setOrigin(0.5);

    this.speechBubble = this.add.container(0, 0, [bubbleBg, bubbleText]).setAlpha(0);

    // 第二天先直接播开场表演
    this.playOpeningSequence();
  }

  update() {}

  private drawStickman(x: number, y: number, color: number) {
    // 头
    this.add.circle(x, y - 24, 10, color);

    // 身体
    this.add.rectangle(x, y, 4, 28, color);

    // 手
    this.add.rectangle(x - 10, y - 4, 18, 3, color);
    this.add.rectangle(x + 10, y - 4, 18, 3, color);

    // 腿
    this.add.rectangle(x - 5, y + 18, 3, 18, color);
    this.add.rectangle(x + 5, y + 18, 3, 18, color);
  }

  private createSmoke(x: number, y: number) {
    for (let i = 0; i < 3; i++) {
      const puff = this.add.circle(x + i * 6, y - i * 8, 6 - i, 0xd1d5db, 0.5);

      this.tweens.add({
        targets: puff,
        y: puff.y - 30,
        x: puff.x + Phaser.Math.Between(-6, 6),
        alpha: 0,
        duration: 2200 + i * 300,
        repeat: -1,
        repeatDelay: 200,
        onRepeat: () => {
          puff.setY(y - i * 8);
          puff.setX(x + i * 6);
          puff.setAlpha(0.5);
        },
      });
    }
  }

  private playOpeningSequence() {
    const { width, height } = this.scale;

    // 黑场遮罩
    const blackOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

    // 上眼皮
    const topLid = this.add.rectangle(width / 2, height / 4, width, height / 2, 0x000000);
    // 下眼皮
    const bottomLid = this.add.rectangle(width / 2, height * 0.75, width, height / 2, 0x000000);

    // 先让场景整体偏暗
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

    // 感叹号出现
    this.time.delayedCall(1400, () => {
      if (!this.exclamationMark) return;

      this.tweens.add({
        targets: this.exclamationMark,
        alpha: 1,
        y: this.exclamationMark.y - 8,
        duration: 250,
        yoyo: true,
      });
    });

    // 气泡出现
    this.time.delayedCall(1900, () => {
      if (!this.speechBubble) return;

      this.tweens.add({
        targets: this.speechBubble,
        alpha: 1,
        duration: 300,
      });
    });

    // 顶部提示出现
    this.time.delayedCall(2200, () => {
      if (!this.topHint) return;

      this.tweens.add({
        targets: this.topHint,
        alpha: 0.85,
        duration: 500,
      });
    });
  }
}