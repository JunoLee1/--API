import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { adminApi } from '@/services/admin.service'
import type { AdminUserDto, ListUsersQuery, UpdateUserRoleDto, PlayerWithoutAccountDto } from '@/types/admin'
import type { Role, CoachingRole, FrontOfficeRole } from '@/types/auth'
import {
  ROLE_LABEL,
  COACHING_ROLE_LABEL,
  FRONT_OFFICE_ROLE_LABEL,
} from '@/types/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { MoreHorizontal, UserPlus, ChevronDown } from 'lucide-react'
import { useConfirm } from '@/lib/confirm-dialog'

const ALL_ROLES: Role[] = ['FRONT_OFFICE', 'COACHING_STAFF', 'PLAYER', 'AGENT']
const COACHING_ROLES: CoachingRole[] = [
  'HEAD_COACH', 'ASSISTANT_COACH', 'DEFENSIVE_COACH', 'ATTACKING_COACH',
  'PHYSICAL_COACH', 'SET_PIECE_COACH', 'GOALKEEPER_COACH', 'MEDICAL', 'MEDICAL_DIRECTOR',
]
const FRONT_OFFICE_ROLES: FrontOfficeRole[] = [
  'GM', 'TD', 'CONTRACT_MANAGER', 'SCOUT', 'EQUIPMENT_MANAGER', 'TACTICAL_ANALYST',
]

function subRoleLabel(user: AdminUserDto): string {
  if (user.role === 'COACHING_STAFF' && user.coachingRole) return COACHING_ROLE_LABEL[user.coachingRole]
  if (user.role === 'FRONT_OFFICE' && user.frontOfficeRole) return FRONT_OFFICE_ROLE_LABEL[user.frontOfficeRole]
  return ''
}

export function UsersPage() {
  const confirm = useConfirm()

  const [users, setUsers] = useState<AdminUserDto[]>([])
  const [playersWithoutAccounts, setPlayersWithoutAccounts] = useState<PlayerWithoutAccountDto[]>([])
  const [loading, setLoading] = useState(false)
  const [filterRole, setFilterRole] = useState<Role | ''>('')
  const [filterCoachingRole, setFilterCoachingRole] = useState<CoachingRole | ''>('')
  const [filterFrontOfficeRole, setFilterFrontOfficeRole] = useState<FrontOfficeRole | ''>('')
  const [filterUsername, setFilterUsername] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)

  const [editingUser, setEditingUser] = useState<AdminUserDto | null>(null)
  const [editRole, setEditRole] = useState<Role>('FRONT_OFFICE')
  const [editCoachingRole, setEditCoachingRole] = useState<CoachingRole | ''>('')
  const [editFrontOfficeRole, setEditFrontOfficeRole] = useState<FrontOfficeRole | ''>('')
  const [editSaving, setEditSaving] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [cEmail, setCEmail] = useState('')
  const [cUsername, setCUsername] = useState('')
  const [cNickname, setCNickname] = useState('')
  const [cPassword, setCPassword] = useState('')
  const [cRole, setCRole] = useState<Role>('FRONT_OFFICE')
  const [cCoachingRole, setCCoachingRole] = useState<CoachingRole | ''>('')
  const [cFrontOfficeRole, setCFrontOfficeRole] = useState<FrontOfficeRole | ''>('')
  const [cSaving, setCsaving] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const query: ListUsersQuery = {}
      if (filterUsername.trim()) query.username = filterUsername.trim()
      if (filterRole) query.role = filterRole as Role
      if (filterRole === 'COACHING_STAFF' && filterCoachingRole) query.coachingRole = filterCoachingRole as CoachingRole
      if (filterRole === 'FRONT_OFFICE' && filterFrontOfficeRole) query.frontOfficeRole = filterFrontOfficeRole as FrontOfficeRole
      if (showDeleted) query.isDeleted = true

      const [data, playersData] = await Promise.all([
        adminApi.listUsers(query),
        (!filterRole || filterRole === 'PLAYER') && !showDeleted
          ? adminApi.listPlayersWithoutAccounts(filterUsername.trim() || undefined)
          : Promise.resolve([]),
      ])
      setUsers(data)
      setPlayersWithoutAccounts(playersData)
    } catch {
      toast.error('사용자 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchUsers() }, [filterRole, filterCoachingRole, filterFrontOfficeRole, showDeleted])

  const handleDeactivate = async (user: AdminUserDto) => {
    const ok = await confirm({ title: '비활성화', description: `${user.nickname} 계정을 비활성화하시겠습니까?`, confirmText: '비활성화' })
    if (!ok) return
    try {
      await adminApi.deactivate(user.id)
      toast.success(`${user.nickname} 계정이 비활성화됐습니다.`)
      void fetchUsers()
    } catch { toast.error('비활성화에 실패했습니다.') }
  }

  const handleReactivate = async (user: AdminUserDto) => {
    try {
      await adminApi.reactivate(user.id)
      toast.success(`${user.nickname} 계정이 재활성화됐습니다.`)
      void fetchUsers()
    } catch { toast.error('재활성화에 실패했습니다.') }
  }

  const handleDelete = async (user: AdminUserDto) => {
    const ok = await confirm({ title: '완전 삭제', description: `${user.nickname} 계정을 영구 삭제합니까? 되돌릴 수 없습니다.`, confirmText: '삭제', variant: 'destructive' })
    if (!ok) return
    try {
      await adminApi.deleteUser(user.id)
      toast.success(`${user.nickname} 계정이 삭제됐습니다.`)
      void fetchUsers()
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'USER_HAS_LINKED_DATA') {
        toast.error('연결된 데이터가 있어 삭제할 수 없습니다.')
      } else {
        toast.error('삭제에 실패했습니다.')
      }
    }
  }

  const openEditModal = (user: AdminUserDto) => {
    setEditingUser(user)
    setEditRole(user.role)
    setEditCoachingRole(user.coachingRole ?? '')
    setEditFrontOfficeRole(user.frontOfficeRole ?? '')
  }

  const handleEditSave = async () => {
    if (!editingUser) return
    setEditSaving(true)
    try {
      const dto: UpdateUserRoleDto = {
        role: editRole,
        ...(editRole === 'COACHING_STAFF' && editCoachingRole && { coachingRole: editCoachingRole as CoachingRole }),
        ...(editRole === 'FRONT_OFFICE' && editFrontOfficeRole && { frontOfficeRole: editFrontOfficeRole as FrontOfficeRole }),
      }
      await adminApi.updateRole(editingUser.id, dto)
      toast.success('역할이 변경됐습니다.')
      setEditingUser(null)
      void fetchUsers()
    } catch { toast.error('역할 변경에 실패했습니다.') } finally { setEditSaving(false) }
  }

  const handleCreate = async () => {
    if (!cEmail.trim() || !cUsername.trim() || !cNickname.trim() || !cPassword) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }
    if (cRole === 'COACHING_STAFF' && !cCoachingRole) { toast.error('코칭스태프 역할을 선택해주세요.'); return }
    if (cRole === 'FRONT_OFFICE' && !cFrontOfficeRole) { toast.error('프런트오피스 역할을 선택해주세요.'); return }
    setCsaving(true)
    try {
      await api.post('/auth/users', {
        email: cEmail.trim(),
        username: cUsername.trim(),
        nickname: cNickname.trim(),
        password: cPassword,
        role: cRole,
        ...(cRole === 'COACHING_STAFF' && cCoachingRole && { coachingRole: cCoachingRole }),
        ...(cRole === 'FRONT_OFFICE' && cFrontOfficeRole && { frontOfficeRole: cFrontOfficeRole }),
      })
      toast.success(`${cNickname} 계정이 생성됐습니다.`)
      setCEmail(''); setCUsername(''); setCNickname(''); setCPassword('')
      setCRole('FRONT_OFFICE'); setCCoachingRole(''); setCFrontOfficeRole('')
      void fetchUsers()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '생성에 실패했습니다.')
    } finally { setCsaving(false) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">사용자 관리</h1>
        <p className="text-sm text-muted-foreground mt-0.5">구단 구성원 계정을 관리합니다.</p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">이름 검색</Label>
            <Input
              placeholder="username 검색"
              className="h-8 w-44 text-sm"
              value={filterUsername}
              onChange={(e) => setFilterUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void fetchUsers()}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">역할</Label>
            <Select value={filterRole} onValueChange={(v) => { setFilterRole(v as Role | ''); setFilterCoachingRole(''); setFilterFrontOfficeRole('') }}>
              <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="전체" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">전체</SelectItem>
                {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {filterRole === 'COACHING_STAFF' && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">코칭 역할</Label>
              <Select value={filterCoachingRole} onValueChange={(v) => setFilterCoachingRole(v as CoachingRole | '')}>
                <SelectTrigger className="h-8 w-36 text-sm"><SelectValue placeholder="전체" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  {COACHING_ROLES.map((r) => <SelectItem key={r} value={r}>{COACHING_ROLE_LABEL[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {filterRole === 'FRONT_OFFICE' && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">프런트 역할</Label>
              <Select value={filterFrontOfficeRole} onValueChange={(v) => setFilterFrontOfficeRole(v as FrontOfficeRole | '')}>
                <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="전체" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  {FRONT_OFFICE_ROLES.map((r) => <SelectItem key={r} value={r}>{FRONT_OFFICE_ROLE_LABEL[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="outline" size="sm" className="h-8" onClick={() => setShowDeleted((v) => !v)}>
            {showDeleted ? '활성 계정 보기' : '비활성 계정 보기'}
          </Button>
          <Button size="sm" className="h-8" onClick={() => void fetchUsers()}>검색</Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>닉네임</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>역할</TableHead>
                <TableHead>서브역할</TableHead>
                <TableHead>선수명</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">불러오는 중...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">사용자 없음</TableCell></TableRow>
              ) : users.map((user) => (
                <TableRow key={user.id} className={user.isDeleted ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{user.nickname}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.username}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell><Badge variant="outline">{ROLE_LABEL[user.role]}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{subRoleLabel(user)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.player?.playerName ?? '—'}
                  </TableCell>
                  <TableCell>
                    {user.isDeleted
                      ? <Badge variant="destructive">비활성</Badge>
                      : <Badge variant="secondary">활성</Badge>}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditModal(user)}>역할 변경</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.isDeleted ? (
                          <DropdownMenuItem onClick={() => void handleReactivate(user)}>재활성화</DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => void handleDeactivate(user)} className="text-destructive">비활성화</DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => void handleDelete(user)} className="text-destructive">완전 삭제</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {playersWithoutAccounts.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">계정 없는 선수 ({playersWithoutAccounts.length}명)</h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>선수명</TableHead>
                    <TableHead>포지션</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playersWithoutAccounts.map((p) => (
                    <TableRow key={p.id} className="opacity-60">
                      <TableCell className="font-medium">{p.playerName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.position ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-muted-foreground">{p.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowCreate((v) => !v)}
          >
            <UserPlus className="h-4 w-4" />
            신규 계정 생성
            <ChevronDown className={`h-3 w-3 transition-transform ${showCreate ? 'rotate-180' : ''}`} />
          </Button>

          {showCreate && (
            <Card className="max-w-lg p-6 mt-3">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>이메일 *</Label>
                    <Input type="email" placeholder="user@example.com" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>사용자명 *</Label>
                    <Input placeholder="username" value={cUsername} onChange={(e) => setCUsername(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>닉네임 *</Label>
                    <Input placeholder="표시 이름" value={cNickname} onChange={(e) => setCNickname(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>임시 비밀번호 *</Label>
                    <Input type="password" placeholder="••••••••" value={cPassword} onChange={(e) => setCPassword(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>역할 *</Label>
                    <Select value={cRole} onValueChange={(v) => { setCRole(v as Role); setCCoachingRole(''); setCFrontOfficeRole('') }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {cRole === 'COACHING_STAFF' && (
                    <div className="space-y-1.5">
                      <Label>코칭 역할 *</Label>
                      <Select value={cCoachingRole} onValueChange={(v) => setCCoachingRole(v as CoachingRole)}>
                        <SelectTrigger><SelectValue placeholder="역할 선택" /></SelectTrigger>
                        <SelectContent>
                          {COACHING_ROLES.map((r) => <SelectItem key={r} value={r}>{COACHING_ROLE_LABEL[r]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {cRole === 'FRONT_OFFICE' && (
                    <div className="space-y-1.5">
                      <Label>프런트 역할 *</Label>
                      <Select value={cFrontOfficeRole} onValueChange={(v) => setCFrontOfficeRole(v as FrontOfficeRole)}>
                        <SelectTrigger><SelectValue placeholder="역할 선택" /></SelectTrigger>
                        <SelectContent>
                          {FRONT_OFFICE_ROLES.map((r) => <SelectItem key={r} value={r}>{FRONT_OFFICE_ROLE_LABEL[r]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <Button className="w-full mt-2" onClick={() => void handleCreate()} disabled={cSaving}>
                  {cSaving ? '생성 중...' : '계정 생성'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser?.nickname} 역할 변경</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>역할</Label>
              <Select value={editRole} onValueChange={(v) => { setEditRole(v as Role); setEditCoachingRole(''); setEditFrontOfficeRole('') }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {editRole === 'COACHING_STAFF' && (
              <div className="space-y-1.5">
                <Label>코칭 역할</Label>
                <Select value={editCoachingRole} onValueChange={(v) => setEditCoachingRole(v as CoachingRole)}>
                  <SelectTrigger><SelectValue placeholder="역할 선택" /></SelectTrigger>
                  <SelectContent>
                    {COACHING_ROLES.map((r) => <SelectItem key={r} value={r}>{COACHING_ROLE_LABEL[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editRole === 'FRONT_OFFICE' && (
              <div className="space-y-1.5">
                <Label>프런트 역할</Label>
                <Select value={editFrontOfficeRole} onValueChange={(v) => setEditFrontOfficeRole(v as FrontOfficeRole)}>
                  <SelectTrigger><SelectValue placeholder="역할 선택" /></SelectTrigger>
                  <SelectContent>
                    {FRONT_OFFICE_ROLES.map((r) => <SelectItem key={r} value={r}>{FRONT_OFFICE_ROLE_LABEL[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>취소</Button>
            <Button onClick={() => void handleEditSave()} disabled={editSaving}>
              {editSaving ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
