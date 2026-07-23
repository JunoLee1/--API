import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/services/auth.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DEV_ACCOUNTS: { group: string; accounts: { label: string; email: string }[] }[] = [
  {
    group: '기본',
    accounts: [
      { label: '관리자', email: 'admin@club.com' },
      { label: '단장 (GM)', email: 'gm@club.com' },
      { label: '기술이사 (TD)', email: 'td@club.com' },
      { label: '프런트 (SCOUT)', email: 'fo@club.com' },
      { label: '선수', email: 'player@club.com' },
    ],
  },
  {
    group: '코칭스태프',
    accounts: [
      { label: '감독', email: 'coach@club.com' },
      { label: '수석코치보', email: 'assistant@club.com' },
      { label: '수비코치', email: 'defensive@club.com' },
      { label: '공격코치', email: 'attacking@club.com' },
      { label: '피지컬', email: 'physical@club.com' },
      { label: '세트피스', email: 'setpiece@club.com' },
      { label: 'GK코치', email: 'gk@club.com' },
      { label: '의료진', email: 'medical@club.com' },
      { label: '메디컬팀장', email: 'meddir@club.com' },
    ],
  },
  {
    group: '유소년',
    accounts: [
      { label: '유소년감독', email: 'youth.coach1@club.com' },
      { label: '유소년코치', email: 'youth.coach2@club.com' },
      { label: '학부모 (김)', email: 'guardian1@club.com' },
      { label: '학부모 (이)', email: 'guardian2@club.com' },
    ],
  },
]

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

        <div className="space-y-3">
          <p className="text-xs text-center text-muted-foreground">빠른 로그인 (개발용)</p>
          {DEV_ACCOUNTS.map(({ group, accounts }) => (
            <div key={group} className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wide">{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {accounts.map(({ label, email: e }) => (
                  <Button
                    key={e}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2.5"
                    disabled={loading}
                    onClick={() => void login(e, DEV_PASSWORD)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
