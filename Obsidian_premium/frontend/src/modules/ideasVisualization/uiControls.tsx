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
    <div className="absolute left-3 top-3 md:left-5 md:top-5 z-20 flex items-center gap-1.5 md:gap-2 rounded-xl border border-zinc-700 bg-zinc-900/85 p-1.5 md:p-2 backdrop-blur">
      {(['tree', 'force', 'cluster'] as const).map((entry) => (
        <button
          key={entry}
          type="button"
          onClick={() => onChangeMode(entry)}
          className={`rounded-lg px-2.5 py-1 md:px-3 md:py-1.5 text-xs md:text-sm transition-colors ${
            mode === entry
              ? 'bg-accent/20 text-accent border border-accent/40'
              : 'text-zinc-300 border border-zinc-700 hover:bg-zinc-800'
          }`}
        >
          {MODE_LABEL[entry]}
        </button>
      ))}
    </div>
  )
}

export { MODE_LABEL, type ViewMode }
