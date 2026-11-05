import { useState } from 'react'
import { TAG_LABEL, type NoteTag, type PlayerNote } from '../hooks/useSession'

const TAGS = Object.keys(TAG_LABEL) as NoteTag[]

export function NoteSheet({ name, note, onSave, onClose }: { name: string; note?: PlayerNote; onSave: (n: PlayerNote) => void; onClose: () => void }) {
  const [tag, setTag] = useState<NoteTag | undefined>(note?.tag)
  const [text, setText] = useState(note?.text ?? '')
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="sheet-title">Note sur {name}</div>
        <p className="hint" style={{ textAlign: 'left', margin: '0 2px 4px' }}>Comme en live : comment le lis-tu ? À la fin de la partie, l'app te dira si tu avais vu juste.</p>
        <div className="tags">
          {TAGS.map((t) => <button key={t} className={'tagbtn' + (tag === t ? ' on' : '')} onClick={() => setTag(tag === t ? undefined : t)}>{TAG_LABEL[t]}</button>)}
        </div>
        <textarea className="ta" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex. : mise vite quand il est fort, bluffe les rivers…" />
        <div className="row">
          <button className="ghost" style={{ flex: 1 }} onClick={onClose}>Annuler</button>
          <button className="primary" style={{ flex: 2 }} onClick={() => { onSave({ tag, text: text.trim() || undefined }); onClose() }}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}
