import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  departmentApi,
  departmentMemberApi,
  type Department,
  type DeptRole,
  type Member,
} from '@/services/department.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { isAdminLike } from '@/lib/permissions'

// ---- DeptRole helpers ----

const DEPT_ROLES: DeptRole[] = ['LEADER', 'DEPUTY', 'MANAGER', 'SENIOR', 'MEMBER', 'INTERN']

const DEPT_ROLE_LABEL_KO: Record<DeptRole, string> = {
  LEADER: '팀장',
  DEPUTY: '부팀장',
  MANAGER: '책임',
  SENIOR: '선임',
  MEMBER: '팀원',
  INTERN: '인턴',
}

const DEPT_ROLE_LABEL_EN: Record<DeptRole, string> = {
  LEADER: 'Leader',
  DEPUTY: 'Deputy',
  MANAGER: 'Manager',
  SENIOR: 'Senior',
  MEMBER: 'Member',
  INTERN: 'Intern',
}

// ---- Error code mapping ----

function messageForCode(code: string, t: (k: string) => string): string {
  const key = `deptMember.error.${code}`
  const translated = t(key)
  // If the key is not found, i18next returns the key itself
  if (translated === key) return t('deptMember.error.generic')
  return translated
}

// ---- Page component ----

export function DepartmentMembersPage() {
  const { deptId: deptIdParam } = useParams<{ deptId: string }>()
  const deptId = Number(deptIdParam)
  const { t, i18n } = useTranslation('common')
  const { user } = useCurrentUser()

  const roleLabel = (r: DeptRole) =>
    i18n.language === 'en' ? DEPT_ROLE_LABEL_EN[r] : DEPT_ROLE_LABEL_KO[r]

  // ---- state ----
  const [dept, setDept] = useState<Department | null>(null)
  const [allDepts, setAllDepts] = useState<Department[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  // Add dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState<DeptRole>('MEMBER')
  const [addSaving, setAddSaving] = useState(false)

  // Head dialog
  const [headOpen, setHeadOpen] = useState(false)
  const [newHeadUserId, setNewHeadUserId] = useState('')
  const [headSaving, setHeadSaving] = useState(false)

  // Transfer dialog
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferUserId, setTransferUserId] = useState<number | null>(null)
  const [transferDeptId, setTransferDeptId] = useState<string>('')
  const [transferRole, setTransferRole] = useState<DeptRole>('MEMBER')
  const [transferSaving, setTransferSaving] = useState(false)

  // ---- data fetch ----
  const fetchMembers = async () => {
    try {
      const [d, ms, ds] = await Promise.all([
        departmentApi.get(deptId),
        departmentMemberApi.list(deptId),
        departmentApi.list(),
      ])
      setDept(d)
      setMembers(ms)
      setAllDepts(ds)
    } catch {
      toast.error(t('deptMember.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchMembers() }, [deptId])

  // ---- permission helpers ----
  const canManage = !!user && (
    isAdminLike(user.role) ||
    members.some(m => m.userId === user.id && (m.role === 'LEADER' || m.role === 'DEPUTY'))
  )

  const headMember = dept?.headId != null
    ? members.find(m => m.userId === dept.headId)
    : null

  // ---- add member ----
  const handleAdd = async () => {
    const uid = parseInt(addUserId, 10)
    if (!addUserId.trim() || isNaN(uid)) {
      toast.error(t('deptMember.error.userIdRequired'))
      return
    }
    setAddSaving(true)
    try {
      await departmentMemberApi.add(deptId, uid, addRole)
      toast.success(t('deptMember.addSuccess'))
      setAddOpen(false)
      setAddUserId('')
      setAddRole('MEMBER')
      void fetchMembers()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast.error(messageForCode(code, t))
    } finally {
      setAddSaving(false)
    }
  }

  // ---- update role inline ----
  const handleRoleChange = async (m: Member, role: DeptRole) => {
    try {
      await departmentMemberApi.updateRole(deptId, m.userId, role)
      void fetchMembers()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast.error(messageForCode(code, t))
    }
  }

  // ---- remove ----
  const handleRemove = async (m: Member) => {
    if (!confirm(t('deptMember.confirmRemove', { name: m.user.name }))) return
    try {
      await departmentMemberApi.remove(deptId, m.userId)
      toast.success(t('deptMember.removeSuccess'))
      void fetchMembers()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      if (code === 'MUST_TRANSFER') {
        // auto-open transfer dialog
        setTransferUserId(m.userId)
        setTransferDeptId('')
        setTransferRole('MEMBER')
        setTransferOpen(true)
      } else {
        toast.error(messageForCode(code, t))
      }
    }
  }

  // ---- transfer ----
  const handleTransfer = async () => {
    if (!transferUserId) return
    const toDeptId = parseInt(transferDeptId, 10)
    if (!transferDeptId || isNaN(toDeptId)) {
      toast.error(t('deptMember.error.targetDeptRequired'))
      return
    }
    setTransferSaving(true)
    try {
      await departmentMemberApi.transfer(deptId, transferUserId, toDeptId, transferRole)
      toast.success(t('deptMember.transferSuccess'))
      setTransferOpen(false)
      setTransferUserId(null)
      void fetchMembers()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast.error(messageForCode(code, t))
    } finally {
      setTransferSaving(false)
    }
  }

  // ---- update head ----
  const handleUpdateHead = async () => {
    const uid = newHeadUserId === '' ? null : parseInt(newHeadUserId, 10)
    if (newHeadUserId !== '' && (isNaN(uid as number))) {
      toast.error(t('deptMember.error.userIdRequired'))
      return
    }
    setHeadSaving(true)
    try {
      await departmentMemberApi.updateHead(deptId, uid)
      toast.success(t('deptMember.headUpdateSuccess'))
      setHeadOpen(false)
      setNewHeadUserId('')
      void fetchMembers()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      toast.error(messageForCode(code, t))
    } finally {
      setHeadSaving(false)
    }
  }

  // ---- render ----

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const transferableDepts = allDepts.filter(d => d.id !== deptId && d.isActive)
  const transferMember = members.find(m => m.userId === transferUserId)

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">{dept?.name ?? '—'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('deptMember.head')}:{' '}
            {headMember
              ? `${headMember.user.name} (${headMember.user.email})`
              : t('deptMember.noHead')}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setNewHeadUserId(''); setHeadOpen(true) }}>
              {t('deptMember.changeHead')}
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              {t('deptMember.addMember')}
            </Button>
          </div>
        )}
      </div>

      {/* Members table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('deptMember.col.name')}</TableHead>
              <TableHead>{t('deptMember.col.email')}</TableHead>
              <TableHead>{t('deptMember.col.role')}</TableHead>
              {canManage && <TableHead className="text-right">{t('deptMember.col.actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 3} className="py-8 text-center text-muted-foreground text-sm">
                  {t('deptMember.empty')}
                </TableCell>
              </TableRow>
            )}
            {members.map(m => (
              <TableRow key={m.userId}>
                <TableCell className="font-medium">
                  {m.user.name}
                  {dept?.headId === m.userId && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {t('deptMember.headBadge')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{m.user.email}</TableCell>
                <TableCell>
                  {canManage ? (
                    <Select
                      value={m.role}
                      onValueChange={(v) => void handleRoleChange(m, v as DeptRole)}
                    >
                      <SelectTrigger size="sm" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPT_ROLES.map(r => (
                          <SelectItem key={r} value={r} label={roleLabel(r)}>
                            {roleLabel(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-sm">{roleLabel(m.role)}</span>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setTransferUserId(m.userId)
                          setTransferDeptId('')
                          setTransferRole('MEMBER')
                          setTransferOpen(true)
                        }}
                      >
                        {t('deptMember.transfer')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => void handleRemove(m)}
                      >
                        {t('action.delete')}
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add member dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deptMember.addMember')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('deptMember.userId')}</Label>
              <Input
                type="number"
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                placeholder={t('deptMember.userIdPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('deptMember.col.role')}</Label>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as DeptRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPT_ROLES.map(r => (
                    <SelectItem key={r} value={r} label={roleLabel(r)}>
                      {roleLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t('action.cancel')}</Button>
            <Button onClick={() => void handleAdd()} disabled={addSaving}>
              {t('action.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change head dialog */}
      <Dialog open={headOpen} onOpenChange={setHeadOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deptMember.changeHead')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('deptMember.newHeadUserId')}</Label>
              <Input
                type="number"
                value={newHeadUserId}
                onChange={(e) => setNewHeadUserId(e.target.value)}
                placeholder={t('deptMember.newHeadPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('deptMember.clearHeadHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHeadOpen(false)}>{t('action.cancel')}</Button>
            <Button onClick={() => void handleUpdateHead()} disabled={headSaving}>
              {t('action.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t('deptMember.transferTitle', { name: transferMember?.user.name ?? '' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t('deptMember.targetDept')}</Label>
              <Select value={transferDeptId} onValueChange={setTransferDeptId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('deptMember.targetDeptPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {transferableDepts.map(d => (
                    <SelectItem key={d.id} value={String(d.id)} label={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('deptMember.col.role')}</Label>
              <Select value={transferRole} onValueChange={(v) => setTransferRole(v as DeptRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPT_ROLES.map(r => (
                    <SelectItem key={r} value={r} label={roleLabel(r)}>
                      {roleLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTransferOpen(false); setTransferUserId(null) }}>
              {t('action.cancel')}
            </Button>
            <Button onClick={() => void handleTransfer()} disabled={transferSaving}>
              {t('deptMember.transfer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
