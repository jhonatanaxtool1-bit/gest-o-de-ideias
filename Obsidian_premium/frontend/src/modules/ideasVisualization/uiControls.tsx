type ViewMode = 'tree' | 'force' | 'cluster'

const MODE_LABEL: Record<ViewMode, string> = {
  tree: 'Tree',
  force: 'Force',
  cluster: 'Cluster',
}

type IdeasVisualizationControlsProps = {
  mode: ViewMode
  onChangeMode: (mode: ViewMode) => void
}

export function IdeasVisualizationControls({ mode, onChangeMode }: IdeasVisualizationControlsProps) {
  return (
    <>
      <div className="absolute left-5 top-5 z-20 flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/75 p-2 backdrop-blur">
        {(['tree', 'force', 'cluster'] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => onChangeMode(entry)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              mode === entry
                ? 'bg-accent/20 text-accent border border-accent/40'
                : 'text-zinc-300 border border-zinc-700 hover:bg-zinc-800'
            }`}
          >
            {MODE_LABEL[entry]}
          </button>
        ))}
      </div>
      <div className="absolute left-5 top-20 z-20 rounded-xl border border-zinc-700 bg-zinc-900/75 px-3 py-2 text-xs text-zinc-300 backdrop-blur">
        Modo ativo: <span className="font-semibold text-zinc-100">{MODE_LABEL[mode]}</span>
      </div>
    </>
  )
}

export { MODE_LABEL, type ViewMode }
