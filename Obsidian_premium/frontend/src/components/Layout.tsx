import { Link, useLocation, Outlet } from 'react-router-dom'

const iconClass = 'h-5 w-5 shrink-0'

const SidebarIcons = {
  visualizacao: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  ideia: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  lista: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  tarefas: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  lembretes: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13 22a2 2 0 0 1-2-2v-2" />
    </svg>
  ),
  empresarial: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
    </svg>
  ),
  pessoal: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  cadastros: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 0 1 0 2.828l-7 7a2 2 0 0 1-2.828 0l-7-7A2 2 0 0 1 3 12V7a4 4 0 0 1 4-4z" />
    </svg>
  ),
}

export function Layout() {
  const location = useLocation()
  const isOrganization = location.pathname === '/organizacao'
  const isProfessionalPlanning = location.pathname === '/planejamento-profissional'
  const isPersonalPlanning = location.pathname === '/planejamento-pessoal'
  const isDailyTasks = location.pathname === '/tarefas-diarias'
  const isIdeasVisualization = location.pathname === '/visualizacao-ideias'
  const isIdeiaNew = location.pathname === '/ideia/new'
  const isListas = location.pathname === '/listas' || location.pathname.startsWith('/lista/')
  const isLembretes = location.pathname === '/lembretes'

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
      active ? 'bg-accent/15 text-accent' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
    }`

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 flex-shrink-0 border-r border-zinc-800 bg-surface-900 flex flex-col animate-fade-in">
        <div className="p-4 border-b border-zinc-800">
          <Link to="/" className="text-lg font-semibold text-white tracking-tight">
            Obsidian Premium
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Segundo Cérebro
          </p>
          <Link to="/visualizacao-ideias" className={linkClass(isIdeasVisualization)}>
            {SidebarIcons.visualizacao}
            Visualização
          </Link>
          <Link to="/ideia/new" className={linkClass(isIdeiaNew)}>
            {SidebarIcons.ideia}
            Criar ideia
          </Link>
          <Link to="/listas" className={linkClass(isListas)}>
            {SidebarIcons.lista}
            Criar lista
          </Link>
          <Link to="/tarefas-diarias" className={linkClass(isDailyTasks)}>
            {SidebarIcons.tarefas}
            Tarefas Diarias
          </Link>
          <Link to="/lembretes" className={linkClass(isLembretes)}>
            {SidebarIcons.lembretes}
            Lembretes
          </Link>
          <Link to="/planejamento-profissional" className={linkClass(isProfessionalPlanning)}>
            {SidebarIcons.empresarial}
            Planejamento Empresarial
          </Link>
          <Link to="/planejamento-pessoal" className={linkClass(isPersonalPlanning)}>
            {SidebarIcons.pessoal}
            Planejamento pessoal
          </Link>
          <div className="pt-2 mt-2 border-t border-zinc-800">
            <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Cadastros
            </p>
            <Link to="/organizacao" className={linkClass(isOrganization)}>
              {SidebarIcons.cadastros}
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
