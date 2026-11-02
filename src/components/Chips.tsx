const DENOMS: [number, string][] = [
  [5000, '#2b2b2b'], [1000, '#e9d48a'], [500, '#8d6cf0'], [100, '#111'], [25, '#2e9e5b'], [5, '#d12b2b'], [1, '#f2f2f2'],
]

export function chipList(amount: number): string[] {
  const out: string[] = []
  let rest = amount
  for (const [d, c] of DENOMS) {
    while (rest >= d && out.length < 8) { out.push(c); rest -= d }
  }
  if (out.length === 0) out.push('#f2f2f2')
  return out
}

export function Chips({ amount, x, y }: { amount: number; x: number; y: number }) {
  const list = chipList(amount).slice(0, 6)
  return (
    <div className="chips" style={{ left: `${x}%`, top: `${y}%` }}>
      <div className="stack-vis">
        {list.map((c, i) => <div key={i} className="chip" style={{ ['--c' as any]: c, top: `${-i * 3}px` }} />)}
      </div>
      <span className="amt">{amount}</span>
    </div>
  )
}
