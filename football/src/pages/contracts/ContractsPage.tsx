import { useState } from 'react'
import { toast } from 'sonner'
import { contractApi } from '@/services/contract.service'
import type { ContractSummary, ContractStatus } from '@/types/contract'
import {
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_STYLE,
  formatSalary,
} from '@/types/contract'
import { usePlayers } from '@/hooks/usePlayers'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR')
}

function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs ${CONTRACT_STATUS_STYLE[status]}`}
    >
      {CONTRACT_STATUS_LABEL[status]}
    </span>
  )
}

interface CreateContractDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  playerId: string
  onSaved: () => void
}

function CreateContractDialog({ open, onOpenChange, playerId, onSaved }: CreateContractDialogProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [salary, setSalary] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!startDate || !endDate || !salary) {
      toast.error('필수 항목을 모두 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await contractApi.create({ playerId, startDate, endDate, salary: Number(salary) })
      toast.success('계약이 등록됐습니다.')
      onSaved()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>계약 등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>계약 시작일 *</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>계약 종료일 *</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>연봉 (원) *</Label>
            <Input
              type="number"
              placeholder="예: 500000000"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '등록'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ContractsPage() {
  const { user } = useCurrentUser()
  const { players, loading: playersLoading } = usePlayers()
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
  const [contracts, setContracts] = useState<ContractSummary[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const canWrite = user?.role === 'ADMIN' || user?.role === 'FRONT_OFFICE'
  const canChangeStatus = user?.role === 'ADMIN'

  const fetchContracts = (pid: string) => {
    setLoadingContracts(true)
    contractApi
      .byPlayer(pid)
      .then(setContracts)
      .catch(() => toast.error('계약 목록을 불러오지 못했습니다.'))
      .finally(() => setLoadingContracts(false))
  }

  const handlePlayerChange = (pid: string) => {
    setSelectedPlayerId(pid)
    setContracts([])
    fetchContracts(pid)
  }

  const handleStatusChange = async (contractId: number, status: ContractStatus) => {
    try {
      await contractApi.updateStatus(contractId, status)
      toast.success('계약 상태가 변경됐습니다.')
      fetchContracts(selectedPlayerId)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '변경에 실패했습니다.')
    }
  }

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">계약 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">선수를 선택하면 계약 목록이 표시됩니다.</p>
        </div>
      </div>

      <div className="border-b px-6 py-3 flex items-center gap-3 shrink-0 bg-muted/30">
        {playersLoading ? (
          <Skeleton className="h-8 w-56" />
        ) : (
          <Select value={selectedPlayerId} onValueChange={(v) => v && handlePlayerChange(v)}>
            <SelectTrigger className="w-56 h-8 text-sm bg-background">
              <SelectValue placeholder="선수 선택" />
            </SelectTrigger>
            <SelectContent>
              {players.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {canWrite && selectedPlayerId && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            계약 등록
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {!selectedPlayerId ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            선수를 선택해주세요.
          </div>
        ) : loadingContracts ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            {selectedPlayer?.playerName}의 계약이 없습니다.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>계약 시작</TableHead>
                <TableHead>계약 종료</TableHead>
                <TableHead>연봉</TableHead>
                <TableHead>상태</TableHead>
                {canChangeStatus && <TableHead className="w-32">상태 변경</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="tabular-nums">{formatDate(c.startDate)}</TableCell>
                  <TableCell className="tabular-nums">{formatDate(c.endDate)}</TableCell>
                  <TableCell className="tabular-nums font-medium">{formatSalary(c.salary)}</TableCell>
                  <TableCell><ContractStatusBadge status={c.status} /></TableCell>
                  {canChangeStatus && (
                    <TableCell>
                      <Select
                        value={c.status}
                        onValueChange={(v) => handleStatusChange(c.id, v as ContractStatus)}
                      >
                        <SelectTrigger className="h-7 text-xs w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(['ACTIVE', 'EXPIRED', 'TERMINATED'] as ContractStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{CONTRACT_STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {canWrite && selectedPlayerId && (
        <CreateContractDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          playerId={selectedPlayerId}
          onSaved={() => { setCreateOpen(false); fetchContracts(selectedPlayerId) }}
        />
      )}
    </div>
  )
}
