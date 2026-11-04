let ctx: AudioContext | null = null
let enabled = true

export function setSoundEnabled(v: boolean) { enabled = v }
export function soundEnabled() { return enabled }

function ac(): AudioContext | null {
  if (!enabled) return null
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return ctx
  } catch { return null }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, when = 0) {
  const c = ac(); if (!c) return
  const o = c.createOscillator(); const g = c.createGain()
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(0, c.currentTime + when)
  g.gain.linearRampToValueAtTime(gain, c.currentTime + when + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur)
  o.connect(g); g.connect(c.destination)
  o.start(c.currentTime + when); o.stop(c.currentTime + when + dur + 0.05)
}

function noise(dur: number, gain = 0.06, hp = 2000) {
  const c = ac(); if (!c) return
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = c.createBufferSource(); src.buffer = buf
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp
  const g = c.createGain(); g.gain.value = gain
  src.connect(f); f.connect(g); g.connect(c.destination)
  src.start()
}

export const sfx = {
  deal: () => noise(0.06, 0.05, 3000),
  chip: () => { tone(1800, 0.05, 'triangle', 0.05); tone(2600, 0.04, 'triangle', 0.03, 0.03) },
  chips: () => { for (let i = 0; i < 4; i++) { tone(1500 + i * 200, 0.04, 'triangle', 0.04, i * 0.04) } },
  check: () => { tone(300, 0.05, 'square', 0.03); tone(300, 0.05, 'square', 0.03, 0.09) },
  fold: () => noise(0.08, 0.03, 800),
  turn: () => { tone(880, 0.12, 'sine', 0.05); tone(1320, 0.15, 'sine', 0.04, 0.08) },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'sine', 0.06, i * 0.09)) },
  lose: () => { tone(220, 0.3, 'sine', 0.04); tone(180, 0.35, 'sine', 0.04, 0.15) },
  alert: () => { tone(660, 0.1, 'triangle', 0.05); tone(560, 0.12, 'triangle', 0.05, 0.12) },
}

export function haptic(ms = 12) { try { navigator.vibrate?.(ms) } catch { /* ignore */ } }
