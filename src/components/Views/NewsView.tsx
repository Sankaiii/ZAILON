import { Zap, Bug, ArrowUp, Clock, Package } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useT } from '../../i18n'

const NEWS = [
  {
    version: '1.1.0', date: 'Prochainement', planned: true,
    items: [
      { type: 'add', text: 'Builds desktop natifs — .exe, .AppImage, .dmg via GitHub Releases' },
      { type: 'add', text: 'Discord Rich Presence en jeu avec App ID configurable' },
      { type: 'add', text: 'Auto-update intégré — mise à jour depuis les paramètres' },
      { type: 'add', text: 'Resources GitHub — fonds et icônes par jeu chargés automatiquement' },
      { type: 'add', text: 'Support .7z et .rar pour l\'installation de mods' },
      { type: 'add', text: 'Détection automatique améliorée — Steam, Epic, GOG, EA' },
      { type: 'improve', text: 'GameBanana — filtres NSFW et pagination avancée' },
      { type: 'improve', text: 'Interface — animations fluides et thèmes personnalisables' },
    ],
  },
  {
    version: '1.0.0', date: '21 Mai 2026', planned: false,
    items: [
      { type: 'add', text: 'Lancement initial de ZAILON Universal Mod Launcher' },
      { type: 'add', text: 'Détection automatique de jeux (NTE, Genshin, Star Rail, WuWa, Cyberpunk...)' },
      { type: 'add', text: 'Ajout manuel de jeux avec sélection du .exe' },
      { type: 'add', text: 'Scan réel des mods depuis le dossier mods configuré' },
      { type: 'add', text: 'Activation / désactivation des mods (renommage DISABLED_)' },
      { type: 'add', text: 'Installation de mods depuis GameBanana directement dans le launcher' },
      { type: 'add', text: 'Bouton JOUER fonctionnel — lance le vrai .exe du jeu' },
      { type: 'add', text: 'Suivi du temps de jeu réel par jeu (commence à 0)' },
      { type: 'add', text: 'Changement de langue — FR, EN, DE, ES, JA, ZH, KO' },
      { type: 'add', text: 'Filtre NSFW désactivé par défaut dans Explore' },
      { type: 'add', text: 'Données persistantes — mods, jeux et temps de jeu sauvegardés localement' },
      { type: 'add', text: 'Build Windows (.exe), Linux (.AppImage, .deb), macOS (.dmg)' },
      { type: 'add', text: 'Créé par @souanpt' },
    ],
  },
]

const TYPE_META = {
  add: { icon: Zap, color: '#e8b84b', bg: 'rgba(232,184,75,0.07)' },
  fix: { icon: Bug, color: '#60d875', bg: 'rgba(96,216,117,0.07)' },
  improve: { icon: ArrowUp, color: '#60b4f7', bg: 'rgba(96,180,247,0.07)' },
}

export function NewsView() {
  const { language } = useStore()
  const t = useT(language)

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto scrollbar-hide">
      <div className="mb-4">
        <h1 className="font-display font-bold text-xl text-white tracking-wide">{t('news')}</h1>
        <p className="text-xs text-white/30 font-mono">ZAILON Universal Mod Launcher · by @souanpt</p>
      </div>

      <div className="space-y-6">
        {NEWS.map((release) => (
          <div key={release.version}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base text-gold">{release.version}</span>
                {release.planned ? (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-ink-400 bg-gold/80 px-2 py-0.5 rounded-full">
                    <Clock size={8} /> Planifié
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-white/30 bg-white/[0.05] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Package size={8} /> Stable
                  </span>
                )}
              </div>
              <div className="flex-1 h-px bg-white/[0.05]" />
              <span className="text-[10px] text-white/25 font-mono">{release.date}</span>
            </div>
            <div className="space-y-1">
              {release.items.map((item, i) => {
                const meta = TYPE_META[item.type as keyof typeof TYPE_META] ?? TYPE_META.add
                const Icon = meta.icon
                return (
                  <div key={i} className="flex items-start gap-2.5 py-1.5 px-2.5 rounded-lg" style={{ backgroundColor: meta.bg }}>
                    <Icon size={12} className="flex-shrink-0 mt-0.5" style={{ color: meta.color }} />
                    <p className="text-xs font-body text-white/75 leading-relaxed">{item.text}</p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-white/[0.05]">
        <p className="text-[10px] text-white/20 text-center font-mono">Créé par @souanpt · github.com/Sankaiii/ZAILON</p>
      </div>
    </div>
  )
}
