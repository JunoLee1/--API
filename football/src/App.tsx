import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/layouts/AppShell'
import { ConfirmProvider } from '@/lib/confirm-dialog'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { PlayersPage } from '@/pages/players/PlayersPage'
import { YouthPlayersPage } from '@/pages/players/YouthPlayersPage'
import { PlayerDetailPage } from '@/pages/players/PlayerDetailPage'
import { ContractsPage } from '@/pages/contracts/ContractsPage'
import { InjuriesPage } from '@/pages/injuries/InjuriesPage'
import { InjuryDetailPage } from '@/pages/injuries/InjuryDetailPage'
import { InjuryStatsPage } from '@/pages/injuries/InjuryStatsPage'
import { TransfersPage } from '@/pages/transfers/TransfersPage'
import { PlayerCallupPage } from '@/pages/transfers/PlayerCallupPage'
import { TrainingPage } from '@/pages/training/TrainingPage'
import { TrainingDetailPage } from '@/pages/training/TrainingDetailPage'
import { TrainingAttendancePage } from '@/pages/training/TrainingAttendancePage'
import { TrainingResultsPage } from '@/pages/training/TrainingResultsPage'
import { TrainingReferencePage } from '@/pages/training/TrainingReferencePage'
import { TrainingVideoPage } from '@/pages/training/TrainingVideoPage'
import { CoachAvailabilityPage } from '@/pages/training/CoachAvailabilityPage'
import { CoachDashboardPage } from '@/pages/training/CoachDashboardPage'
import { MatchesPage } from '@/pages/matches/MatchesPage'
import { MatchDetailPage } from '@/pages/matches/MatchDetailPage'
import { MatchLineupPage } from '@/pages/matches/MatchLineupPage'
import { RankingsPage } from '@/pages/matches/RankingsPage'
import { TacticalAnalysisPage } from '@/pages/tactical/TacticalAnalysisPage'
import { EquipmentPage } from '@/pages/equipment/EquipmentPage'
import { ProspectsPage } from '@/pages/prospects/ProspectsPage'
import { NotificationsPage } from '@/pages/notifications/NotificationsPage'
import { MePage } from '@/pages/me/MePage'
import { UsersPage } from '@/pages/admin/UsersPage'
import { PartnersPage } from '@/pages/admin/PartnersPage'
import { TeamsPage } from '@/pages/admin/TeamsPage'
import { SeasonsPage } from '@/pages/admin/SeasonsPage'
import { AuditLogPage } from '@/pages/admin/AuditLogPage'
import { LoginHistoryPage } from '@/pages/admin/LoginHistoryPage'
import SafeguardReportPage from '@/pages/admin/SafeguardReportPage'
import TeamSettingsPage from '@/pages/admin/TeamSettingsPage'
import { ContractDetailPage } from '@/pages/contracts/ContractDetailPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'
import { ReportFormPage } from '@/pages/reports/ReportFormPage'
import { ReportDetailPage } from '@/pages/reports/ReportDetailPage'
import { MedicalExpensesPage } from '@/pages/medical-expense/MedicalExpensesPage'
import { HiringRoundsPage } from '@/pages/coaches/HiringRoundsPage'
import { CoachListPage } from '@/pages/coaches/CoachListPage'
import { CoachDetailPage } from '@/pages/coaches/CoachDetailPage'
import { StaffManagementPage } from '@/pages/coaching-staff/StaffManagementPage'
import { MedicalExpenseFormPage } from '@/pages/medical-expense/MedicalExpenseFormPage'
import { MedicalExpenseDetailPage } from '@/pages/medical-expense/MedicalExpenseDetailPage'
import { SquadPlannerPage } from '@/pages/squad/SquadPlannerPage'
import YouthRegistrationPage from '@/pages/youth/YouthRegistrationPage'
import { GrowthReportsListPage } from '@/pages/players/GrowthReportsListPage'
import IncidentReportPage from '@/pages/youth/IncidentReportPage'
import AcademyFeePage from '@/pages/youth/AcademyFeePage'
import { StaffRecordPage } from '@/pages/admin/StaffRecordPage'
import { MealExpensePage } from '@/pages/admin/MealExpensePage'
import { FinancialReportPage } from '@/pages/admin/FinancialReportPage'

function GrowthReportRedirect() {
  const { playerId } = useParams<{ playerId: string }>()
  return <Navigate to={`/players/${playerId}`} replace />
}

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
            <Route path="/youth-players" element={<YouthPlayersPage />} />
            <Route path="/players/:id" element={<PlayerDetailPage />} />
            <Route path="/contracts" element={<ContractsPage />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />
            <Route path="/transfers" element={<TransfersPage />} />
            <Route path="/player-callups" element={<PlayerCallupPage />} />
            <Route path="/youth-registrations" element={<YouthRegistrationPage />} />
            <Route path="/incident-reports" element={<IncidentReportPage />} />
            <Route path="/academy-fees" element={<AcademyFeePage />} />
            <Route path="/growth-reports" element={<GrowthReportsListPage />} />
            <Route path="/growth-reports/:playerId" element={<GrowthReportRedirect />} />
            <Route path="/injuries" element={<InjuriesPage />} />
            <Route path="/injuries/:id" element={<InjuryDetailPage />} />
            <Route path="/injuries/stats" element={<InjuryStatsPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/training/attendance" element={<TrainingAttendancePage />} />
            <Route path="/training/results" element={<TrainingResultsPage />} />
            <Route path="/training/references" element={<TrainingReferencePage />} />
            <Route path="/training/videos" element={<TrainingVideoPage />} />
            <Route path="/training/coach-availability" element={<CoachAvailabilityPage />} />
            <Route path="/training/dashboard" element={<CoachDashboardPage />} />
            <Route path="/training/:id" element={<TrainingDetailPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/matches/analysis" element={<TacticalAnalysisPage />} />
            <Route path="/squad" element={<SquadPlannerPage />} />
            <Route path="/matches/rankings" element={<RankingsPage />} />
            <Route path="/matches/:id/lineup" element={<MatchLineupPage />} />
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
            <Route path="/coaching-staff/management" element={<StaffManagementPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/teams" element={<TeamsPage />} />
            <Route path="/admin/seasons" element={<SeasonsPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogPage />} />
            <Route path="/admin/login-history" element={<LoginHistoryPage />} />
            <Route path="/safeguard-reports" element={<SafeguardReportPage />} />
            <Route path="/admin/team-settings" element={<TeamSettingsPage />} />
            <Route path="/admin/staff-records" element={<StaffRecordPage />} />
            <Route path="/admin/meal-expenses" element={<MealExpensePage />} />
            <Route path="/admin/financial-report" element={<FinancialReportPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </ConfirmProvider>
    </BrowserRouter>
  )
}

export default App
