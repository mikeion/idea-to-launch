import Phaser from "phaser"

/** No assets yet in Milestone 1: shapes only. Kept so asset loading has a home later. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot")
  }

  create(): void {
    this.scene.start("Menu")
  }
}
