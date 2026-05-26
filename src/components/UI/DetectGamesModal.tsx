import { ScanLine, Check, X } from 'lucide-react'
import { useState } from 'react'

interface DetectedGame {
  name: string; path: string; exec_path: string; game_id: number
}

interface Props {
  games: DetectedGame[]
  onClose: () => void
  onAdd: (selected: DetectedGame[]) => void
}

export function DetectGamesModal({ games, onClose, onAdd }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(games.map(g => g.exec_path)))

  const toggle = (path: string) => setSelected(prev => {
    const n = new Set(prev)
    n.has(path) ? n.delete(path) : n.add(path)
    return n
  })

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-ink-200 border border-white/[0.1] rounded-2xl p-5 w-80 shadow-2xl">
        <div className="flex items-center gap-2.5 mb-4">
          <ScanLine size={16} className="text-gold" />
          <h2 className="font-display font-bold text-base text-white">Jeux détectés</h2>
        </div>

        {games.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-4">Aucun jeu détecté automatiquement.</p>
        ) : (
          <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto scrollbar-hide">
            {games.map(game => {
              const checked = selected.has(game.exec_path)
              return (
                <button key={game.exec_path} onClick={() => toggle(game.exec_path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                    checked ? 'bg-gold/10 border-gold/25' : 'bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12]'
                  }`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    checked ? 'bg-gold border-gold' : 'border-white/20'
                  }`}>
                    {checked && <Check size={11} className="text-ink-400" strokeWidth={3} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-body font-medium text-white/90 truncate">{game.name}</p>
                    <p className="text-[10px] text-white/30 font-mono truncate">{game.exec_path.split(/[\\/]/).slice(-2).join('/')}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 bg-white/[0.05] rounded-lg text-sm text-white/50 hover:text-white transition-all border border-white/[0.06]">
            Annuler
          </button>
          <button
            disabled={selected.size === 0}
            onClick={() => { onAdd(games.filter(g => selected.has(g.exec_path))); onClose() }}
            className="flex-1 py-2 bg-gold text-ink-400 rounded-lg text-sm font-display font-bold hover:bg-gold-bright transition-all disabled:opacity-40">
            Ajouter ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}
