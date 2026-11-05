/** Malmuth-Harville ICM: expected prize for each stack. */
export function icm(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length
  const total = stacks.reduce((a, b) => a + b, 0)
  if (total <= 0) return stacks.map(() => 0)
  const memo = new Map<string, number[]>()
  // ev(mask, place): expected prize from `place` onwards for players in mask
  const rec = (mask: number, place: number): number[] => {
    const key = mask + ':' + place
    const hit = memo.get(key)
    if (hit) return hit
    const out = new Array(n).fill(0)
    if (place >= payouts.length || mask === 0) { memo.set(key, out); return out }
    let sum = 0
    for (let i = 0; i < n; i++) if (mask & (1 << i)) sum += stacks[i]
    if (sum <= 0) { memo.set(key, out); return out }
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue
      const p = stacks[i] / sum
      if (p === 0) continue
      out[i] += p * payouts[place]
      const sub = rec(mask & ~(1 << i), place + 1)
      for (let j = 0; j < n; j++) out[j] += p * sub[j]
    }
    memo.set(key, out)
    return out
  }
  const full = (1 << n) - 1
  return rec(full, 0)
}

/**
 * Required equity for `hero` to call an all-in from `villain` under ICM.
 * Pot excludes the two effective stacks: `dead` chips already in the middle (blinds/antes from others).
 */
export function callShoveIcm(stacks: number[], payouts: number[], hero: number, villain: number, dead = 0): { chipEq: number; icmEq: number; fold: number; win: number; lose: number } {
  const eff = Math.min(stacks[hero], stacks[villain])
  const total = stacks[hero] + stacks[villain]
  const chipEq = eff / (2 * eff + dead)
  const foldStacks = stacks.slice()
  foldStacks[villain] += dead
  const winStacks = stacks.slice(); winStacks[hero] += eff + dead; winStacks[villain] -= eff
  const loseStacks = stacks.slice(); loseStacks[hero] -= eff; loseStacks[villain] += eff + dead
  void total
  const fold = icm(foldStacks, payouts)[hero]
  const win = icm(winStacks, payouts)[hero]
  const lose = icm(loseStacks.map((x) => Math.max(0, x)), payouts)[hero]
  const icmEq = win - lose === 0 ? 1 : (fold - lose) / (win - lose)
  return { chipEq, icmEq: Math.max(0, Math.min(1, icmEq)), fold, win, lose }
}
