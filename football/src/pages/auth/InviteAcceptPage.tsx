import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '@/services/api'
import type { Role, CoachingRole, FrontOfficeRole } from '@/types/auth'
import { ROLE_LABEL, COACHING_ROLE_LABEL, FRONT_OFFICE_ROLE_LABEL } from '@/types/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface InviteInfo {
  email: string
  role: Role
  coachingRole: CoachingRole | null
  frontOfficeRole: FrontOfficeRole | null
}

interface Country {
  id: number
  name: string
  code: string
}

function roleDisplay(info: InviteInfo) {
  if (info.role === 'COACHING_STAFF' && info.coachingRole) return `${ROLE_LABEL[info.role]} - ${COACHING_ROLE_LABEL[info.coachingRole]}`
  if (info.role === 'FRONT_OFFICE' && info.frontOfficeRole) return `${ROLE_LABEL[info.role]} - ${FRONT_OFFICE_ROLE_LABEL[info.frontOfficeRole]}`
  return ROLE_LABEL[info.role]
}

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [error, setError] = useState<'not_found' | 'expired' | 'used' | null>(null)
  const [countries, setCountries] = useState<Country[]>([])

  const [username, setUsername] = useState('')
  const [nickname, setNickname] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [nationalityId, setNationalityId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmedPassword, setConfirmedPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    void api.get<InviteInfo>(`/auth/invites/${token}`)
      .then(setInvite)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : ''
        if (msg.includes('INVITE_EXPIRED') || msg.includes('410')) setError('expired')
        else if (msg.includes('INVITE_ALREADY_USED')) setError('used')
        else setError('not_found')
      })
    void api.get<Country[] | { data: Country[] }>('/countries')
      .then((res) => setCountries(Array.isArray(res) ? res : res.data))
      .catch(() => {})
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmedPassword) { toast.error('비밀번호가 일치하지 않습니다.'); return }
    if (!nationalityId) { toast.error('국적을 선택해주세요.'); return }
    setSubmitting(true)
    try {
      await api.post(`/auth/invites/${token}/accept`, {
        username, nickname, phoneNumber, dateOfBirth,
        nationalityId: Number(nationalityId),
        password, confirmedPassword,
      })
      toast.success('가입이 완료되었습니다. 로그인해주세요.')
      navigate('/login')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('NICKNAME_TAKEN')) toast.error('이미 사용 중인 닉네임입니다.')
      else if (msg.includes('PASSWORD_MISMATCH')) toast.error('비밀번호가 일치하지 않습니다.')
      else if (msg.includes('INVALID_PHONE_NUMBER')) toast.error('전화번호 형식이 올바르지 않습니다. (010-0000-0000)')
      else if (msg.includes('INVITE_EXPIRED')) { setError('expired'); toast.error('초대 링크가 만료되었습니다.') }
      else if (msg.includes('INVITE_ALREADY_USED')) { setError('used'); toast.error('이미 사용된 초대 링크입니다.') }
      else toast.error('가입 처리 중 오류가 발생했습니다.')
    } finally { setSubmitting(false) }
  }

  if (error) {
    const messages = {
      expired: { title: '초대 링크 만료', desc: '이 초대 링크는 만료되었습니다. 관리자에게 새 초대를 요청해주세요.' },
      used: { title: '이미 사용된 링크', desc: '이 초대 링크는 이미 사용되었습니다. 계정이 있으면 로그인해주세요.' },
      not_found: { title: '유효하지 않은 링크', desc: '초대 링크가 올바르지 않습니다. 이메일을 다시 확인해주세요.' },
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>{messages[error].title}</CardTitle>
            <CardDescription>{messages[error].desc}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate('/login')}>로그인 페이지로</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <p className="text-sm text-muted-foreground animate-pulse">초대 링크 확인 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Football ERP 가입</CardTitle>
          <CardDescription>
            <span className="font-medium text-foreground">{invite.email}</span>으로 초대되었습니다.
          </CardDescription>
          <Badge variant="secondary" className="w-fit">{roleDisplay(invite)}</Badge>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>이름 *</Label>
                <Input placeholder="홍길동" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>닉네임 *</Label>
                <Input placeholder="hong_gd" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>전화번호 *</Label>
                <Input placeholder="010-0000-0000" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>생년월일 *</Label>
                <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>국적 *</Label>
              <Select value={nationalityId} onValueChange={setNationalityId}>
                <SelectTrigger><SelectValue placeholder="국적 선택" /></SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>비밀번호 *</Label>
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>비밀번호 확인 *</Label>
                <Input type="password" placeholder="••••••••" value={confirmedPassword} onChange={(e) => setConfirmedPassword(e.target.value)} required />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '처리 중...' : '가입 완료'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
