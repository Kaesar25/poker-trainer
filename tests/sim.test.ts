import { it, expect } from 'vitest'
import { createGame, startHand, applyAction, isHandOver } from '../src/engine/game'
import { botDecide } from '../src/engine/bots'
it('bots play 200 hands without error and conserve chips', () => {
  let seed = 7
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  let s = createGame([
    { id: 0, name: 'A', stack: 2000, isBot: true, profile: 'nit' },
    { id: 1, name: 'B', stack: 2000, isBot: true, profile: 'fish' },
    { id: 2, name: 'C', stack: 2000, isBot: true, profile: 'lag' },
    { id: 3, name: 'D', stack: 2000, isBot: true, profile: 'station' },
    { id: 4, name: 'E', stack: 2000, isBot: true, profile: 'bully' },
    { id: 5, name: 'F', stack: 2000, isBot: true, profile: 'bluffer' },
  ], { sb: 10, bb: 20, ante: 0 })
  for (let h = 0; h < 200; h++) {
    s = startHand(s, rng)
    if (s.street === 'idle') break
    let g = 0
    while (!isHandOver(s) && g++ < 200) s = applyAction(s, botDecide(s, rng))
    expect(isHandOver(s)).toBe(true)
    expect(s.players.reduce((a, p) => a + p.stack, 0)).toBe(12000)
  }
  console.log(s.players.map(p => p.name + ':' + p.stack).join(' '), 'hands', s.handNumber)
})
