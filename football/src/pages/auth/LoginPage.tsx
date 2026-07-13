import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/services/auth.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DEV_ACCOUNTS = [
  { label: '관리자', email: 'admin@club.com' },
  { label: '코칭스태프', email: 'coach@club.com' },
  { label: '프런트오피스', email: 'fo@club.com' },
  { label: '선수', email: 'player@club.com' },
] as const

const DEV_PASSWORD = 'Password1!'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const login = async (e: string, p: string) => {
    setError(null)
    setLoading(true)
    try {
      await authApi.login(e, p)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void login(email, password)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Football ERP</h1>
          <p className="text-sm text-muted-foreground mt-1">계속하려면 로그인하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="example@club.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </form>

        <div className="space-y-2">
          <p className="text-xs text-center text-muted-foreground">빠른 로그인 (개발용)</p>
          <div className="flex gap-2">
            {DEV_ACCOUNTS.map(({ label, email: e }) => (
              <Button
                key={e}
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                disabled={loading}
                onClick={() => void login(e, DEV_PASSWORD)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
