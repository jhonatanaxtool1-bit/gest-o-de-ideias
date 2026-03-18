import { useState, useEffect } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

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
  ideias: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  tarefas: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])
  const isOrganization = location.pathname === '/organizacao'
  const isProfessionalPlanning = location.pathname === '/planejamento-profissional'
  const isPersonalPlanning = location.pathname === '/planejamento-pessoal'
  const isDailyTasks = location.pathname === '/tarefas-diarias'
  const isIdeasVisualization = location.pathname === '/visualizacao-ideias'
  const isIdeiaNew = location.pathname === '/ideia/new'
  const isIdeas = location.pathname === '/ideias'

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? 'bg-accent/15 text-accent' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
    }`

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950 flex-col md:flex-row">
      {/* Mobile Header h-16 roughly */}
      <div className="md:hidden flex-none flex items-center justify-between p-4 border-b border-zinc-800 bg-surface-900 z-30">
        <Link to="/" className="text-lg font-semibold text-white tracking-tight">
          Obsidian Premium
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 -mr-2 text-zinc-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 md:w-56 flex-shrink-0 border-r border-zinc-800 bg-surface-900 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 md:static ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
      >
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <Link to="/" className="text-lg font-semibold text-white tracking-tight">
            Obsidian Premium
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-2 -mr-2 text-zinc-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Segundo Cérebro
          </p>
          <Link to="/ideias" className={linkClass(isIdeas)}>
            {SidebarIcons.ideias}
            Ideias
          </Link>
          <Link to="/visualizacao-ideias" className={linkClass(isIdeasVisualization)}>
            {SidebarIcons.visualizacao}
            Visualização
          </Link>
          <Link to="/ideia/new" className={linkClass(isIdeiaNew)}>
            {SidebarIcons.ideia}
            Criar ideia
          </Link>
          <Link to="/tarefas-diarias" className={linkClass(isDailyTasks)}>
            {SidebarIcons.tarefas}
            Tarefas Diarias
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
        <div className="p-3 border-t border-zinc-800">
          <button
            onClick={() => { logout(); navigate('/login', { replace: true }) }}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
