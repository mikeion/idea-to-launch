import type { GameConfig } from "../config"
import type { Player } from "../entities/Player"
import { apexForClearance, heightAtNet, solveShot, solveTimedShot } from "./physics"
import type { Rng } from "./rng"
import type { ShotType, Vec3 } from "./types"

export interface ShotPlan {
  target: { x: number; y: number }
  apex: number
  velocity: { vx: number; vy: number; vz: number }
}

/**
 * Turn a shot choice and its timing quality into a launch velocity.
 * Good timing: the ball skims the net and lands where aimed.
 * Bad timing: it floats higher (a pop-up) and scatters, possibly out.
 */
export function planShot(
  player: Player,
  contact: Vec3,
  shot: ShotType,
  quality: number,
  aimX: number,
  rng: Rng,
  cfg: GameConfig,
): ShotPlan {
  const { court } = cfg
  const miss = 1 - quality
  const toward = -player.side // direction of the opponent's half along y
  const g = cfg.ball.gravity
  const maxX = court.width / 2 - 0.35

  let tx: number
  let ty: number
  let clearance: number
  let float: number

  if (shot === "smash") {
    // Hit down hard, aimed by time-to-land rather than apex. Contact too low and the
    // physics puts it into the net; that is the risk of smashing a ball that wasn't high.
    const s = cfg.smash
    const low = clamp((s.lowContactHeight - contact.z) / s.lowContactHeight, 0, 1)
    const r = miss * s.scatter + low * s.lowContactScatter
    const sx =
      clamp(contact.x * 0.3 + aimX * s.aimWidth, -maxX, maxX) + rng.range(-r * 0.6, r * 0.6)
    const sy = toward * (s.depth + rng.range(-r * 0.5, r))
    const dist = Math.hypot(sx - contact.x, sy - contact.y)
    const minNetZ = court.netHeight + s.netClearance
    let t = Math.max(s.minFlightTime, dist / s.speed)
    let velocity = solveTimedShot(contact, sx, sy, t, g)
    while (t < s.maxFlightTime && (heightAtNet(contact, velocity, g) ?? Infinity) < minNetZ) {
      t += 0.01
      velocity = solveTimedShot(contact, sx, sy, t, g)
    }
    return { target: { x: sx, y: sy }, apex: contact.z, velocity }
  }

  if (shot === "dink") {
    const s = cfg.shots.dink
    tx = clamp(contact.x * 0.35 + aimX * s.aimWidth, -maxX, maxX)
    ty = toward * (s.depth + miss * s.floatDepth)
    const r = miss * s.scatter
    tx += rng.range(-r, r)
    ty += toward * rng.range(-r * 0.6, r)
    clearance = s.netClearance
    float = miss * s.float
  } else {
    const s = cfg.shots.drive
    // A ball contacted below the net has to be lifted, so driving it is riskier.
    const low = clamp((s.lowContactHeight - contact.z) / s.lowContactHeight, 0, 1)
    tx = clamp(contact.x * 0.25 + aimX * s.aimWidth, -maxX, maxX)
    ty = toward * (court.length / 2 - s.depthFromBaseline)
    const r = s.baseScatter + miss * s.scatter + low * s.lowContactScatter
    tx += rng.range(-r * 0.6, r * 0.6)
    ty += toward * rng.range(-r * 0.4, r)
    clearance = s.netClearance
    float = miss * s.float + low * s.lowContactFloat
  }

  const apex = apexForClearance(contact, tx, ty, court.netHeight + clearance, g) + float
  return { target: { x: tx, y: ty }, apex, velocity: solveShot(contact, tx, ty, apex, g) }
}

/**
 * Serve diagonally into the receiver's service box. The dink button gives a soft,
 * high serve and the drive button a flatter, faster one. Serves never fault on their own.
 */
// DESIGN: serves have no timing element in Milestone 1; scatter is kept small enough
// to always land in the box, so points start reliably and the focus stays on the rally.
export function planServe(
  server: Player,
  contact: Vec3,
  hard: boolean,
  boxSignX: 1 | -1,
  aimX: number,
  rng: Rng,
  cfg: GameConfig,
): ShotPlan {
  const { court } = cfg
  const s = cfg.shots.serve
  const toward = -server.side
  const margin = 0.45
  const boxCenterX = (boxSignX * court.width) / 4
  const tx = clamp(
    boxCenterX + aimX * s.aimWidth + rng.range(-s.scatter, s.scatter),
    boxSignX > 0 ? margin : -court.width / 2 + margin,
    boxSignX > 0 ? court.width / 2 - margin : -margin,
  )
  const ty = toward * (court.length / 2 - s.depthFromBaseline + rng.range(-s.scatter, s.scatter))
  const clearance = hard ? s.hardNetClearance : s.softNetClearance
  const g = cfg.ball.gravity
  const apex = apexForClearance(contact, tx, ty, court.netHeight + clearance, g)
  return { target: { x: tx, y: ty }, apex, velocity: solveShot(contact, tx, ty, apex, g) }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}
