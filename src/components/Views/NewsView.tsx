import { Zap, Bug, ArrowUp, Trash2 } from 'lucide-react'
import { NewsItem } from '../../types'

const NEWS: NewsItem[] = [
  {
    version: '1.0.0',
    date: '18 May 2026',
    items: [
      { type: 'add', text: 'Initial release of ZAILON Universal Mod Launcher' },
      { type: 'add', text: 'Support for UE5, GIMI, ZZMI, SRMI, WWMI, EFMI game profiles' },
      { type: 'add', text: 'GameBanana and Nexus Mods integration in Explore' },
      { type: 'add', text: 'One-click mod install with automatic extraction' },
      { type: 'add', text: 'Profile system — multiple mod sets per game' },
      { type: 'add', text: 'Playtime tracking per game and profile' },
      { type: 'add', text: 'Discord Rich Presence support' },
      { type: 'add', text: 'NSFW filter (disabled by default)' },
      { type: 'add', text: 'Offline mode — works without internet except Explore' },
      { type: 'add', text: 'Auto game detection via Steam and Epic Games' },
      { type: 'add', text: 'Created by @souanpt' },
    ],
  },
]

const TYPE_META = {
  add: { icon: Zap, color: '#e8b84b', label: 'New', bg: 'rgba(232,184,75,0.08)' },
  fix: { icon: Bug, color: '#60d875', label: 'Fix', bg: 'rgba(96,216,117,0.08)' },
  improve: { icon: ArrowUp, color: '#60b4f7', label: 'Improved', bg: 'rgba(96,180,247,0.08)' },
  remove: { icon: Trash2, color: '#f76060', label: 'Removed', bg: 'rgba(247,96,96,0.08)' },
}

export function NewsView() {
  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto scrollbar-hide">
      <div className="mb-4">
        <h1 className="font-display font-bold text-lg text-white tracking-wide">Release Notes</h1>
        <p className="text-[10px] text-white/30 font-mono">ZAILON Universal Mod Launcher</p>
      </div>

      <div className="space-y-6">
        {NEWS.map(release => (
          <div key={release.version}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm text-gold">{release.version}</span>
                <span className="text-[9px] font-mono text-white/30 bg-white/[0.05] px-2 py-0.5 rounded-full">Latest</span>
              </div>
              <div className="flex-1 h-px bg-white/[0.05]" />
              <span className="text-[9px] text-white/25 font-mono">{release.date}</span>
            </div>

            <div className="space-y-1">
              {release.items.map((item, i) => {
                const meta = TYPE_META[item.type]
                const Icon = meta.icon
                return (
                  <div key={i} className="flex items-start gap-2.5 py-1.5 px-2.5 rounded-lg"
                    style={{ backgroundColor: meta.bg }}>
                    <Icon size={11} className="flex-shrink-0 mt-0.5" style={{ color: meta.color }} />
                    <p className="text-[10px] font-body text-white/75 leading-relaxed">{item.text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-white/[0.05]">
        <p className="text-[9px] text-white/20 text-center font-mono">Created by @souanpt · github.com/Sankaiii/Zailon</p>
      </div>
    </div>
  )
}
