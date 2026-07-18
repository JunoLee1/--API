import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/layouts/AppShell'
import { ConfirmProvider } from '@/lib/confirm-dialog'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { PlayersPage } from '@/pages/players/PlayersPage'
import { PlayerDetailPage } from '@/pages/players/PlayerDetailPage'
import { ContractsPage } from '@/pages/contracts/ContractsPage'
import { InjuriesPage } from '@/pages/injuries/InjuriesPage'
import { InjuryDetailPage } from '@/pages/injuries/InjuryDetailPage'
import { InjuryStatsPage } from '@/pages/injuries/InjuryStatsPage'
import { TransfersPage } from '@/pages/transfers/TransfersPage'
import { TrainingPage } from '@/pages/training/TrainingPage'
import { TrainingDetailPage } from '@/pages/training/TrainingDetailPage'
import { TrainingAttendancePage } from '@/pages/training/TrainingAttendancePage'
import { MatchesPage } from '@/pages/matches/MatchesPage'
import { MatchDetailPage } from '@/pages/matches/MatchDetailPage'
import { RankingsPage } from '@/pages/matches/RankingsPage'
import { TacticalAnalysisPage } from '@/pages/tactical/TacticalAnalysisPage'
import { EquipmentPage } from '@/pages/equipment/EquipmentPage'
import { ProspectsPage } from '@/pages/prospects/ProspectsPage'
import { NotificationsPage } from '@/pages/notifications/NotificationsPage'
import { MePage } from '@/pages/me/MePage'
import { UsersPage } from '@/pages/admin/UsersPage'
import { PartnersPage } from '@/pages/admin/PartnersPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { ReportFormPage } from '@/pages/reports/ReportFormPage'
import { ReportDetailPage } from '@/pages/reports/ReportDetailPage'
import { MedicalExpensesPage } from '@/pages/medical-expense/MedicalExpensesPage'
import { HiringRoundsPage } from '@/pages/coaches/HiringRoundsPage'
import { CoachListPage } from '@/pages/coaches/CoachListPage'
import { CoachDetailPage } from '@/pages/coaches/CoachDetailPage'
import { MedicalExpenseFormPage } from '@/pages/medical-expense/MedicalExpenseFormPage'
import { MedicalExpenseDetailPage } from '@/pages/medical-expense/MedicalExpenseDetailPage'
import { SquadPlannerPage } from '@/pages/squad/SquadPlannerPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const loggedIn = localStorage.getItem('loggedIn')
  return loggedIn ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <ConfirmProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <PrivateRoute>
                <AppShell />
              </PrivateRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/players/:id" element={<PlayerDetailPage />} />
            <Route path="/contracts" element={<ContractsPage />} />
            <Route path="/transfers" element={<TransfersPage />} />
            <Route path="/injuries" element={<InjuriesPage />} />
            <Route path="/injuries/:id" element={<InjuryDetailPage />} />
            <Route path="/injuries/stats" element={<InjuryStatsPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/training/attendance" element={<TrainingAttendancePage />} />
            <Route path="/training/:id" element={<TrainingDetailPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/matches/analysis" element={<TacticalAnalysisPage />} />
            <Route path="/squad" element={<SquadPlannerPage />} />
            <Route path="/matches/rankings" element={<RankingsPage />} />
            <Route path="/matches/:id" element={<MatchDetailPage />} />
            <Route path="/equipment" element={<EquipmentPage />} />
            <Route path="/prospects" element={<ProspectsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/me" element={<MePage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/new" element={<ReportFormPage />} />
            <Route path="/reports/:id" element={<ReportDetailPage />} />
            <Route path="/medical-expenses" element={<MedicalExpensesPage />} />
            <Route path="/medical-expenses/new" element={<MedicalExpenseFormPage />} />
            <Route path="/medical-expenses/:id/edit" element={<MedicalExpenseFormPage />} />
            <Route path="/medical-expenses/:id" element={<MedicalExpenseDetailPage />} />
            <Route path="/admin/partners" element={<PartnersPage />} />
            <Route path="/coaches/rounds" element={<HiringRoundsPage />} />
            <Route path="/coaches" element={<CoachListPage />} />
            <Route path="/coaches/:id" element={<CoachDetailPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </ConfirmProvider>
    </BrowserRouter>
  )
}

export default App
