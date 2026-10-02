import type Phaser from "phaser"

/**
 * Tiny synthesized sound effects (no audio files yet). Uses Phaser's Web Audio
 * context, which Phaser unlocks on the first key or button press.
 */
export class Sfx {
  private ctx: AudioContext | null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null

  constructor(scene: Phaser.Scene, volume = 0.5) {
    const sm = scene.sound as Partial<Phaser.Sound.WebAudioSoundManager>
    this.ctx = sm.context ?? null
    if (!this.ctx) return
    this.master = this.ctx.createGain()
    this.master.gain.value = volume
    this.master.connect(this.ctx.destination)
    const len = Math.floor(this.ctx.sampleRate * 0.4)
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = this.noiseBuffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  }

  dink(): void {
    this.tone(720, 0.07, "triangle", 0.35, 520)
  }

  drive(): void {
    this.tone(980, 0.06, "square", 0.18, 600)
    this.noise(0.05, 0.25, 3000)
  }

  smash(): void {
    this.tone(110, 0.25, "sine", 0.9, 45)
    this.noise(0.22, 0.7, 1800)
    this.tone(1400, 0.05, "square", 0.15, 700)
  }

  bounce(): void {
    this.tone(260, 0.035, "sine", 0.18, 180)
  }

  net(): void {
    this.noise(0.12, 0.35, 600)
    this.tone(140, 0.1, "sine", 0.3, 90)
  }

  smashChance(): void {
    this.tone(500, 0.18, "sawtooth", 0.08, 1200)
  }

  point(): void {
    this.tone(660, 0.12, "triangle", 0.25)
    this.tone(990, 0.18, "triangle", 0.25, undefined, 0.11)
  }

  whiff(): void {
    this.noise(0.08, 0.12, 900)
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    endFreq?: number,
    delay = 0,
  ): void {
    const ctx = this.ctx
    if (!ctx || !this.master || ctx.state !== "running") return
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private noise(dur: number, gain: number, cutoff: number): void {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.noiseBuffer || ctx.state !== "running") return
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = cutoff
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(filter).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }
}
