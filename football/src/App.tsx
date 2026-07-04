import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/layouts/AppShell'
import { ConfirmProvider } from '@/lib/confirm-dialog'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { LoginPage } from '@/pages/auth/LoginPage'

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
            <Route path="/players" element={<PlaceholderPage title="선수 목록" />} />
            <Route path="/players/:id" element={<PlaceholderPage title="선수 상세" />} />
            <Route path="/contracts" element={<PlaceholderPage title="계약 목록" />} />
            <Route path="/transfers" element={<PlaceholderPage title="이적 현황" />} />
            <Route path="/injuries" element={<PlaceholderPage title="부상 현황" />} />
            <Route path="/training" element={<PlaceholderPage title="훈련 일정" />} />
            <Route path="/training/attendance" element={<PlaceholderPage title="출석 현황" />} />
            <Route path="/matches" element={<PlaceholderPage title="경기 목록" />} />
            <Route path="/matches/analysis" element={<PlaceholderPage title="전술 분석" />} />
            <Route path="/admin/users" element={<PlaceholderPage title="사용자 관리" />} />
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