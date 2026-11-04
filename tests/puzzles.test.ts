import { it, expect } from 'vitest'
import { generateLivePuzzle, generatePuzzle } from '../src/engine/puzzles'
it('generates live puzzles with a valid correct option', () => {
  let seed = 5
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  const diffs: number[] = []
  for (let i = 0; i < 30; i++) {
    const p = generateLivePuzzle(rng)
    expect(p).not.toBeNull()
    expect(p!.options.some((o) => o.id === p!.correct)).toBe(true)
    expect(p!.state!.acting).toBe(0)
    diffs.push(p!.difficulty)
  }
  console.log('difficulties', diffs.join(''))
  const q = generatePuzzle(5, rng)
  expect(q.kind).toBe('icm')
})
