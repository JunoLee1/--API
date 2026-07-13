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
import { TransfersPage } from '@/pages/transfers/TransfersPage'
import { TrainingPage } from '@/pages/training/TrainingPage'
import { TrainingDetailPage } from '@/pages/training/TrainingDetailPage'
import { MatchesPage } from '@/pages/matches/MatchesPage'
import { MatchDetailPage } from '@/pages/matches/MatchDetailPage'
import { UsersPage } from '@/pages/admin/UsersPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('accessToken')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h2 className="text-xl font-semibold text-muted-foreground">{title} — 준비 중</h2>
    </div>
  )
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
            <Route path="/injuries/stats" element={<PlaceholderPage title="부상 통계" />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/training/:id" element={<TrainingDetailPage />} />
            <Route path="/training/attendance" element={<PlaceholderPage title="출석 현황" />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/matches/:id" element={<MatchDetailPage />} />
            <Route path="/matches/analysis" element={<PlaceholderPage title="전술 분석" />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/notifications" element={<PlaceholderPage title="알림 전체 목록" />} />
            <Route path="/me" element={<PlaceholderPage title="내 정보" />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster richColors position="top-right" />
      </ConfirmProvider>
    </BrowserRouter>
  )
}

export default App
