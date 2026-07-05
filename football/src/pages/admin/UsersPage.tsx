import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/services/api'
import type { Role, CoachingRole } from '@/types/auth'
import { ROLE_LABEL, COACHING_ROLE_LABEL } from '@/types/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { UserPlus } from 'lucide-react'

const ROLES: Role[] = ['FRONT_OFFICE', 'COACHING_STAFF', 'PLAYER', 'AGENT']
const COACHING_ROLES: CoachingRole[] = [
  'HEAD_COACH', 'ASSISTANT_COACH', 'DEFENSIVE_COACH', 'ATTACKING_COACH',
  'PHYSICAL_COACH', 'SET_PIECE_COACH', 'GOALKEEPER_COACH', 'MEDICAL',
]

export function UsersPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('FRONT_OFFICE')
  const [coachingRole, setCoachingRole] = useState<CoachingRole | ''>('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!email.trim() || !username.trim() || !nickname.trim() || !password) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }
    if (role === 'COACHING_STAFF' && !coachingRole) {
      toast.error('코칭스태프 역할을 선택해주세요.')
      return
    }
    setSaving(true)
    try {
      await api.post('/auth/users', {
        email: email.trim(),
        username: username.trim(),
        nickname: nickname.trim(),
        password,
        role,
        ...(role === 'COACHING_STAFF' && coachingRole && { coachingRole }),
      })
      toast.success(`${nickname} 계정이 생성됐습니다.`)
      setEmail('')
      setUsername('')
      setNickname('')
      setPassword('')
      setRole('FRONT_OFFICE')
      setCoachingRole('')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '생성에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">사용자 관리</h1>
        <p className="text-sm text-muted-foreground mt-0.5">새 사용자 계정을 생성합니다.</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-lg p-6">
          <div className="flex items-center gap-2 mb-5">
            <UserPlus className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-base font-semibold">신규 계정 생성</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>이메일 *</Label>
                <Input type="email" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>사용자명 *</Label>
                <Input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>닉네임 *</Label>
                <Input placeholder="표시 이름" value={nickname} onChange={(e) => setNickname(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>임시 비밀번호 *</Label>
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>역할 *</Label>
                <Select value={role} onValueChange={(v) => { setRole(v as Role); setCoachingRole('') }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {role === 'COACHING_STAFF' && (
                <div className="space-y-1.5">
                  <Label>코칭 역할 *</Label>
                  <Select value={coachingRole} onValueChange={(v) => setCoachingRole(v as CoachingRole)}>
                    <SelectTrigger><SelectValue placeholder="역할 선택" /></SelectTrigger>
                    <SelectContent>
                      {COACHING_ROLES.map((r) => <SelectItem key={r} value={r}>{COACHING_ROLE_LABEL[r]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Button className="w-full mt-2" onClick={handleCreate} disabled={saving}>
              {saving ? '생성 중...' : '계정 생성'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
