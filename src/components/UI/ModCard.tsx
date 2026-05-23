import { Trash2, RefreshCw, ExternalLink } from 'lucide-react'
import { LOADER_COLORS, PLATFORM_COLORS } from '../../utils'
import { Toggle } from './Toggle'

interface ModCardProps {
  name: string; enabled: boolean; loader?: string; author?: string;
  version?: string; sizeMb?: number; source?: string; sourceUrl?: string;
  autoUpdate?: boolean; onToggle: () => void; onDelete?: () => void;
}

export function ModCard({ name, enabled, loader, author, version, sizeMb, source, sourceUrl, autoUpdate, onToggle, onDelete }: ModCardProps) {
  const loaderColor = loader ? (LOADER_COLORS[loader] ?? '#8888aa') : '#8888aa'
  const platformColor = source ? (PLATFORM_COLORS[source] ?? '#8888aa') : '#8888aa'
  return (
    <div className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-150 ${
      enabled ? 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.06] hover:border-gold/20' : 'bg-white/[0.02] border-white/[0.03] opacity-60 hover:opacity-80'
    }`}>
      {loader && (
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ color: loaderColor, backgroundColor: `${loaderColor}20`, border: `1px solid ${loaderColor}40` }}>
          {loader}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white/90 truncate">{name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {author && <span className="text-[10px] text-white/35">{author}</span>}
          {version && <span className="text-[10px] text-white/25">v{version}</span>}
          {sizeMb !== undefined && sizeMb > 0 && <span className="text-[10px] text-white/25">{sizeMb}MB</span>}
          {source && <span className="text-[10px] font-medium" style={{ color: platformColor }}>{source}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {autoUpdate && <RefreshCw size={10} className="text-gold/40" />}
        {sourceUrl && (
          <button className="opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink size={11} className="text-white/30 hover:text-white/60" />
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Trash2 size={11} className="text-white/30 hover:text-red-400" />
          </button>
        )}
        <Toggle checked={enabled} onChange={onToggle} size="sm" />
      </div>
    </div>
  )
}
