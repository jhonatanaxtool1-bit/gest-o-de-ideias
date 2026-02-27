import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { DocumentPage } from '@/pages/DocumentPage'
import { HomePage } from '@/pages/HomePage'
import { OrganizationPage } from '@/pages/OrganizationPage'
import { IdeasPage } from '@/pages/IdeasPage'
import { IdeaEditorPage } from '@/pages/IdeaEditorPage'
import { ProfessionalPlanningPage } from '@/pages/ProfessionalPlanningPage'
import { DailyTasksPage } from '@/pages/DailyTasksPage'
import { IdeasVisualizationPage } from '@/pages/IdeasVisualizationPage'

function App() {
  return (
    <div className="min-h-screen bg-surface-950">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="organizacao" element={<OrganizationPage />} />
          <Route path="ideias" element={<IdeasPage />} />
          <Route path="visualizacao-ideias" element={<IdeasVisualizationPage />} />
          <Route path="tarefas-diarias" element={<DailyTasksPage />} />
          <Route path="planejamento-profissional" element={<ProfessionalPlanningPage />} />
          <Route path="ideia/:id" element={<IdeaEditorPage />} />
          <Route path="doc/:id" element={<DocumentPage />} />
          <Route path="doc/new" element={<Navigate to="/ideia/new" replace />} />
        </Route>
      </Routes>
    </div>
  )
}

export default App
