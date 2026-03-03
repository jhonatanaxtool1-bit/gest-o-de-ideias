import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { DocumentPage } from '@/pages/DocumentPage'
import { HomePage } from '@/pages/HomePage'
import { OrganizationPage } from '@/pages/OrganizationPage'
import { IdeasPage } from '@/pages/IdeasPage'
import { IdeaEditorPage } from '@/pages/IdeaEditorPage'
import { ProfessionalPlanningPage } from '@/pages/ProfessionalPlanningPage'
import { PersonalPlanningPage } from '@/pages/PersonalPlanningPage'
import { DailyTasksPage } from '@/pages/DailyTasksPage'
import { IdeasVisualizationPage } from '@/pages/IdeasVisualizationPage'
import { ListasPage } from '@/pages/ListasPage'
import { ListNewPage } from '@/pages/ListNewPage'
import { ListEditPage } from '@/pages/ListEditPage'

function App() {
  return (
    <div className="min-h-screen bg-surface-950">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="organizacao" element={<OrganizationPage />} />
          <Route path="ideias" element={<IdeasPage />} />
          <Route path="visualizacao-ideias" element={<IdeasVisualizationPage />} />
          <Route path="listas" element={<ListasPage />} />
          <Route path="lista/new" element={<ListNewPage />} />
          <Route path="lista/:id" element={<ListEditPage />} />
          <Route path="tarefas-diarias" element={<DailyTasksPage />} />
          <Route path="planejamento-profissional" element={<ProfessionalPlanningPage />} />
          <Route path="planejamento-pessoal" element={<PersonalPlanningPage />} />
          <Route path="ideia/:id" element={<IdeaEditorPage />} />
          <Route path="doc/:id" element={<DocumentPage />} />
          <Route path="doc/new" element={<Navigate to="/ideia/new" replace />} />
        </Route>
      </Routes>
    </div>
  )
}

export default App
