import { Link, useLocation, Outlet } from 'react-router-dom'

export function Layout() {
  const location = useLocation()
  const isOrganization = location.pathname === '/organizacao'
  const isProfessionalPlanning = location.pathname === '/planejamento-profissional'
  const isDailyTasks = location.pathname === '/tarefas-diarias'
  const isIdeasVisualization = location.pathname === '/visualizacao-ideias'

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 flex-shrink-0 border-r border-zinc-800 bg-surface-900 flex flex-col animate-fade-in">
        <div className="p-4 border-b border-zinc-800">
          <Link to="/" className="text-lg font-semibold text-white tracking-tight">
            Obsidian Premium
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          <Link
            to="/visualizacao-ideias"
            className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
              isIdeasVisualization ? 'bg-accent/15 text-accent' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            Segundo Cérebro
          </Link>
          <Link
            to="/tarefas-diarias"
            className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
              isDailyTasks ? 'bg-accent/15 text-accent' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            Tarefas Diarias
          </Link>
          <Link
            to="/planejamento-profissional"
            className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
              isProfessionalPlanning ? 'bg-accent/15 text-accent' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            Planejamento Empresarial
          </Link>
          <div className="pt-2 mt-2 border-t border-zinc-800">
            <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Cadastros
            </p>
            <Link
              to="/organizacao"
              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                isOrganization ? 'bg-accent/15 text-accent' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              Interesses e áreas
            </Link>
          </div>
        </nav>
      </aside>
      <main className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
