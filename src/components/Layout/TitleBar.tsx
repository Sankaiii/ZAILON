import { Minus, Square, X } from 'lucide-react'

async function invoke(cmd: string) {
  try {
    const { invoke: ti } = await import('@tauri-apps/api/core')
    await ti(cmd)
  } catch {}
}

export function TitleBar() {
  return (
    <div className="flex items-center justify-between h-9 px-4 bg-ink-400/90 border-b border-white/[0.05] flex-shrink-0 select-none"
      data-tauri-drag-region>
      {/* Logo */}
      <div className="flex items-center gap-2.5" data-tauri-drag-region>
        <div className="w-5 h-5 rounded-md bg-gold flex items-center justify-center flex-shrink-0">
          <span className="text-[9px] font-display font-black text-ink-400">Z</span>
        </div>
        <span className="text-sm font-display font-bold tracking-[0.15em] text-gold/90 uppercase">
          ZAILON
        </span>
      </div>

      <div className="flex-1 h-full" data-tauri-drag-region />

      {/* Window controls */}
      <div className="flex items-center gap-1">
        <button onClick={() => invoke('minimize_window')}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors">
          <Minus size={11} className="text-white/50" />
        </button>
        <button onClick={() => invoke('toggle_maximize')}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors">
          <Square size={10} className="text-white/50" />
        </button>
        <button onClick={() => invoke('close_window')}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-500/80 transition-colors group">
          <X size={11} className="text-white/50 group-hover:text-white" />
        </button>
      </div>
    </div>
  )
}
