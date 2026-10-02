import Phaser from "phaser"
import type { GameConfig } from "../config"
import type { Ball } from "../entities/Ball"
import type { Player } from "../entities/Player"
import { project } from "./projection"

export const COLORS = {
  background: 0x11161c,
  runoff: 0x2b5d4a,
  court: 0x2f7a8c,
  kitchen: 0x3b8f78,
  line: 0xf2f2ea,
  netPost: 0x1b1f24,
  netMesh: 0xe8e8e8,
  netTape: 0xffffff,
  shadow: 0x000000,
  ball: 0xf4e04d,
  ballOutline: 0x6b5d00,
  players: [0x3d7bff, 0xff8a3d],
  skin: 0xf0c9a0,
  paddle: 0x222831,
  reach: 0xffffff,
}

/** Fill a quadrilateral of court ground between two x and two y values. */
function groundRect(
  g: Phaser.GameObjects.Graphics,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  cfg: GameConfig,
): void {
  const a = project(x0, y0, 0, cfg)
  const b = project(x1, y0, 0, cfg)
  const c = project(x1, y1, 0, cfg)
  const d = project(x0, y1, 0, cfg)
  g.fillPoints([a, b, c, d], true)
}

function groundLine(
  g: Phaser.GameObjects.Graphics,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cfg: GameConfig,
): void {
  const a = project(x0, y0, 0, cfg)
  const b = project(x1, y1, 0, cfg)
  g.lineBetween(a.x, a.y, b.x, b.y)
}

/** Static court: surface, kitchen, lines. Drawn once. */
export function drawCourt(g: Phaser.GameObjects.Graphics, cfg: GameConfig): void {
  const { width, length, kitchenDepth, sideRunoff, backRunoff } = cfg.court
  const hw = width / 2
  const hl = length / 2

  g.fillStyle(COLORS.runoff)
  groundRect(g, -hw - sideRunoff, hw + sideRunoff, -hl - backRunoff, hl + backRunoff, cfg)
  g.fillStyle(COLORS.court)
  groundRect(g, -hw, hw, -hl, hl, cfg)
  g.fillStyle(COLORS.kitchen)
  groundRect(g, -hw, hw, -kitchenDepth, kitchenDepth, cfg)

  g.lineStyle(3, COLORS.line)
  groundLine(g, -hw, -hl, hw, -hl, cfg)
  groundLine(g, -hw, hl, hw, hl, cfg)
  groundLine(g, -hw, -hl, -hw, hl, cfg)
  groundLine(g, hw, -hl, hw, hl, cfg)
  groundLine(g, -hw, -kitchenDepth, hw, -kitchenDepth, cfg)
  groundLine(g, -hw, kitchenDepth, hw, kitchenDepth, cfg)
  // Center lines only run between the kitchen and the baselines.
  groundLine(g, 0, -hl, 0, -kitchenDepth, cfg)
  groundLine(g, 0, kitchenDepth, 0, hl, cfg)
}

/** The net is drawn at y = 0 and depth-sorted with players and ball. */
export function drawNet(g: Phaser.GameObjects.Graphics, cfg: GameConfig): void {
  const hw = cfg.court.width / 2 + 0.3
  const h = cfg.court.netHeight
  const bl = project(-hw, 0, 0, cfg)
  const br = project(hw, 0, 0, cfg)
  const tl = project(-hw, 0, h, cfg)
  const tr = project(hw, 0, h, cfg)

  g.fillStyle(COLORS.netMesh, 0.28)
  g.fillPoints([bl, br, tr, tl], true)
  g.lineStyle(1, COLORS.netMesh, 0.35)
  for (let i = 1; i < 4; i++) {
    const y = bl.y + ((tl.y - bl.y) * i) / 4
    g.lineBetween(bl.x, y, br.x, y)
  }
  for (let x = bl.x; x <= br.x; x += 14) g.lineBetween(x, bl.y, x, tl.y)
  g.lineStyle(5, COLORS.netTape)
  g.lineBetween(tl.x, tl.y, tr.x, tr.y)
  g.fillStyle(COLORS.netPost)
  g.fillRect(bl.x - 4, tl.y - 4, 8, bl.y - tl.y + 4)
  g.fillRect(br.x - 4, tr.y - 4, 8, br.y - tr.y + 4)
}

export function drawBallShadow(g: Phaser.GameObjects.Graphics, ball: Ball, cfg: GameConfig): void {
  g.clear()
  const s = project(ball.x, ball.y, 0, cfg)
  // Shadow shrinks and fades as the ball rises: this is how height reads on screen.
  const lift = Math.min(ball.z / 3, 1)
  g.fillStyle(COLORS.shadow, 0.45 - lift * 0.25)
  g.fillEllipse(s.x, s.y, (16 - lift * 6) * s.scale, (7 - lift * 2.5) * s.scale)
}

export function drawBall(
  g: Phaser.GameObjects.Graphics,
  ball: Ball,
  cfg: GameConfig,
  /** 0 = no glow; up to 1 = full smash-opportunity glow (pass a pulsing value). */
  glow: number,
): void {
  g.clear()
  const ground = project(ball.x, ball.y, 0, cfg)
  const p = project(ball.x, ball.y, ball.z, cfg)
  if (ball.z > 0.15) {
    g.lineStyle(1, COLORS.line, 0.18)
    g.lineBetween(ground.x, ground.y, p.x, p.y)
  }
  const r = 7 * p.scale
  if (glow > 0) {
    g.fillStyle(COLORS.ball, 0.18 + 0.22 * glow)
    g.fillCircle(p.x, p.y, r * (2 + glow))
    g.lineStyle(2, COLORS.ball, 0.5 + 0.5 * glow)
    g.strokeCircle(p.x, p.y, r * (2.6 + glow))
  }
  g.fillStyle(COLORS.ball)
  g.fillCircle(p.x, p.y, r)
  g.lineStyle(1.5, COLORS.ballOutline)
  g.strokeCircle(p.x, p.y, r)
}

export function drawPlayer(
  g: Phaser.GameObjects.Graphics,
  player: Player,
  ball: Ball,
  cfg: GameConfig,
  canHit: boolean,
): void {
  g.clear()
  const color = COLORS.players[player.id]
  const foot = project(player.x, player.y, 0, cfg)
  const s = foot.scale

  // Reach ring on the ground: brightens when the ball can be hit.
  const rx = cfg.player.reach * cfg.view.pxPerMeterX * s
  const ry = cfg.player.reach * cfg.view.pxPerMeterY
  g.lineStyle(canHit ? 3 : 1.5, canHit ? COLORS.ball : COLORS.reach, canHit ? 0.9 : 0.22)
  g.strokeEllipse(foot.x, foot.y, rx * 2, ry * 2)

  g.fillStyle(COLORS.shadow, 0.35)
  g.fillEllipse(foot.x, foot.y, 40 * s, 14 * s)

  const bodyW = 34 * s
  const bodyH = 64 * s
  const headR = 13 * s
  g.fillStyle(color)
  g.fillRoundedRect(foot.x - bodyW / 2, foot.y - bodyH, bodyW, bodyH - 4 * s, 10 * s)
  g.fillStyle(COLORS.skin)
  g.fillCircle(foot.x, foot.y - bodyH - headR + 4 * s, headR)

  // Paddle: on the forehand side, swinging toward the ball when hitting.
  const forehand = player.side // near player's right is screen right, far player's is screen left
  let px = player.x + forehand * 0.42
  let pz = 0.8
  if (player.swingTimer > 0) {
    const t = player.swingTimer / 0.22
    const towardBall = Math.max(-1, Math.min(1, ball.x - player.x))
    px = player.x + towardBall * 0.5 * (1 - t) + forehand * 0.42 * t
    pz = player.swingShot === "drive" ? 0.6 + 0.6 * (1 - t) : 0.5 + 0.3 * (1 - t)
  }
  const pp = project(px, player.y - player.side * 0.15, pz, cfg)
  g.fillStyle(COLORS.paddle)
  g.fillEllipse(pp.x, pp.y, 16 * s, 20 * s)
  g.lineStyle(2, color)
  g.strokeEllipse(pp.x, pp.y, 16 * s, 20 * s)
}
