import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { equipmentApi, loanApi } from '@/services/equipment.service'
import type { EquipmentItem, EquipmentCategory, EquipmentUnitStatus, EquipmentLoan } from '@/types/equipment'
import {
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  UNIT_STATUS_LABEL,
  UNIT_STATUS_STYLE,
  LOAN_STATUS_LABEL,
  LOAN_STATUS_STYLE,
} from '@/types/equipment'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { usePlayers } from '@/hooks/usePlayers'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Plus, AlertTriangle } from 'lucide-react'
import type { CreateEquipmentItemDto } from '@/types/equipment'

const CATEGORIES: EquipmentCategory[] = [
  'CLOTHING',
  'FOOTWEAR',
  'BALL_AND_TOOLS',
  'REHABILITATION',
  'TACTICAL',
  'OTHER',
]

const UNIT_STATUSES: EquipmentUnitStatus[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED']

interface CreateItemDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreateItemDialog({ open, onOpenChange, onSaved }: CreateItemDialogProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<EquipmentCategory>('CLOTHING')
  const [trackedIndividually, setTrackedIndividually] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [lowStockThreshold, setLowStockThreshold] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) { toast.error('장비 이름을 입력해주세요.'); return }
    setSaving(true)
    try {
      const dto: CreateEquipmentItemDto = {
        name: name.trim(),
        category,
        trackedIndividually,
        ...(quantity && { quantity: Number(quantity) }),
        ...(lowStockThreshold && { lowStockThreshold: Number(lowStockThreshold) }),
      }
      await equipmentApi.createItem(dto)
      toast.success('장비가 등록됐습니다.')
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
        <DialogHeader><DialogTitle>장비 등록</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>이름 *</Label>
            <Input placeholder="예: 훈련용 축구화" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>카테고리 *</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as EquipmentCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="tracked"
              checked={trackedIndividually}
              onChange={(e) => setTrackedIndividually(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="tracked">개별 추적 (고가 장비)</Label>
          </div>
          {!trackedIndividually && (
            <>
              <div className="space-y-1.5">
                <Label>재고 수량</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="수량"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>부족 임계값</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="이 수량 이하 시 알림"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중...' : '등록'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface AssignDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  item: EquipmentItem
  onSaved: () => void
}

function AssignDialog({ open, onOpenChange, item, onSaved }: AssignDialogProps) {
  const { players } = usePlayers()
  const [playerId, setPlayerId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [saving, setSaving] = useState(false)

  const availableUnits = item.units?.filter((u) => u.status === 'AVAILABLE') ?? []

  const handleSave = async () => {
    if (!playerId) { toast.error('선수를 선택해주세요.'); return }
    if (item.trackedIndividually && !unitId) { toast.error('유닛을 선택해주세요.'); return }
    setSaving(true)
    try {
      await equipmentApi.assign(
        playerId,
        item.id,
        item.trackedIndividually ? Number(unitId) : undefined,
      )
      toast.success('장비가 지급됐습니다.')
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
        <DialogHeader><DialogTitle>{item.name} — 지급</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>선수 *</Label>
            <Select value={playerId} onValueChange={(v) => { if (v) setPlayerId(v) }}>
              <SelectTrigger><SelectValue placeholder="선수 선택" /></SelectTrigger>
              <SelectContent>
                {players.map((p) => <SelectItem key={p.id} value={p.id}>{p.playerName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {item.trackedIndividually && (
            <div className="space-y-1.5">
              <Label>유닛 *</Label>
              {availableUnits.length === 0 ? (
                <p className="text-sm text-muted-foreground">사용 가능한 유닛이 없습니다.</p>
              ) : (
                <Select value={unitId} onValueChange={(v) => { if (v) setUnitId(v) }}>
                  <SelectTrigger><SelectValue placeholder="유닛 선택" /></SelectTrigger>
                  <SelectContent>
                    {availableUnits.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>유닛 #{u.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving || (item.trackedIndividually && availableUnits.length === 0)}>
            {saving ? '처리 중...' : '지급'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LoanRequestDialog({ open, onOpenChange, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void
}) {
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [itemId, setItemId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) equipmentApi.listItems().then(setItems).catch(() => null)
  }, [open])

  const handleSave = async () => {
    if (!itemId) { toast.error('장비를 선택해주세요.'); return }
    setSaving(true)
    try {
      await loanApi.request({ equipmentItemId: Number(itemId), ...(notes && { notes }) })
      toast.success('대여 신청이 접수됐습니다.')
      onSaved()
      onOpenChange(false)
    } catch { toast.error('신청에 실패했습니다.') }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>장비 대여 신청</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>장비 선택 *</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder="장비를 선택하세요" /></SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>비고</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '신청 중…' : '신청'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LoansTab({ isKitManager }: { isKitManager: boolean }) {
  const [loans, setLoans] = useState<EquipmentLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [requestOpen, setRequestOpen] = useState(false)

  const loadLoans = () => {
    setLoading(true)
    const fetch = isKitManager ? loanApi.list() : loanApi.my()
    fetch.then(setLoans).catch(() => toast.error('대여 목록을 불러오지 못했습니다.')).finally(() => setLoading(false))
  }

  useEffect(() => { loadLoans() }, [isKitManager])

  const handleAction = async (action: () => Promise<unknown>) => {
    try { await action(); loadLoans() }
    catch { toast.error('처리에 실패했습니다.') }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">
          {isKitManager ? '전체 대여 신청 목록' : '내 대여 신청'}
        </p>
        {!isKitManager && (
          <Button size="sm" onClick={() => setRequestOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />대여 신청
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : loans.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">대여 내역이 없습니다.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>장비</TableHead>
              {isKitManager && <TableHead>신청자</TableHead>}
              <TableHead>신청일</TableHead>
              <TableHead>상태</TableHead>
              {isKitManager && <TableHead>액션</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((loan) => (
              <TableRow key={loan.id}>
                <TableCell className="font-medium">{loan.equipmentItem.name}</TableCell>
                {isKitManager && <TableCell className="text-sm">{loan.requestedBy.nickname}</TableCell>}
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(loan.requestedAt).toLocaleDateString('ko-KR')}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={LOAN_STATUS_STYLE[loan.status]}>
                    {LOAN_STATUS_LABEL[loan.status]}
                  </Badge>
                </TableCell>
                {isKitManager && (
                  <TableCell>
                    <div className="flex gap-1.5">
                      {loan.status === 'REQUESTED' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleAction(() => loanApi.approve(loan.id))}>승인</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleAction(() => loanApi.reject(loan.id))}>거절</Button>
                        </>
                      )}
                      {loan.status === 'APPROVED' && (
                        <Button size="sm" onClick={() => handleAction(() => loanApi.issue(loan.id))}>지급</Button>
                      )}
                      {loan.status === 'ISSUED' && (
                        <Button size="sm" variant="outline" onClick={() => handleAction(() => loanApi.return(loan.id))}>반납 확인</Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <LoanRequestDialog open={requestOpen} onOpenChange={setRequestOpen} onSaved={loadLoans} />
    </div>
  )
}

export function EquipmentPage() {
  const { user } = useCurrentUser()
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [assignItem, setAssignItem] = useState<EquipmentItem | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | 'ALL'>('ALL')

  const canWrite =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE') ||
    (user?.coachingRole === 'MEDICAL')

  const isKitManager =
    user?.role === 'ADMIN' ||
    (user?.role === 'FRONT_OFFICE' && user?.frontOfficeRole === 'EQUIPMENT_MANAGER')

  const fetchItems = () =>
    equipmentApi
      .listItems()
      .then(setItems)
      .catch(() => toast.error('장비 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))

  useEffect(() => { void fetchItems() }, [])

  const handleUnitStatusChange = async (unitId: number, status: EquipmentUnitStatus) => {
    try {
      await equipmentApi.updateUnitStatus(unitId, status)
      toast.success('상태가 변경됐습니다.')
      void fetchItems()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '변경에 실패했습니다.')
    }
  }

  const filtered = categoryFilter === 'ALL' ? items : items.filter((i) => i.category === categoryFilter)

  const isLowStock = (item: EquipmentItem) =>
    !item.trackedIndividually &&
    item.quantity != null &&
    item.lowStockThreshold != null &&
    item.quantity <= item.lowStockThreshold

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">장비 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">장비 재고 및 개별 유닛 현황</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />장비 등록
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="items">
          <TabsList className="mb-4">
            <TabsTrigger value="items">장비 목록</TabsTrigger>
            <TabsTrigger value="loans">대여 신청</TabsTrigger>
          </TabsList>
          <TabsContent value="items">
            <div className="flex items-center gap-3 mb-4">
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as EquipmentCategory | 'ALL')}>
                <SelectTrigger className="w-36 h-8 text-sm bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">전체 카테고리</SelectItem>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">등록된 장비가 없습니다.</div>
            ) : (
              <div className="divide-y border rounded-md">
                {filtered.map((item) => (
                  <div key={item.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{item.name}</span>
                            {isLowStock(item) && (
                              <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                                <AlertTriangle className="h-3 w-3" />재고 부족
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${CATEGORY_STYLE[item.category]}`}>
                              {CATEGORY_LABEL[item.category]}
                            </span>
                            {!item.trackedIndividually && item.quantity != null && (
                              <span className="text-xs text-muted-foreground">
                                재고 {item.quantity}개
                                {item.lowStockThreshold != null && ` / 임계 ${item.lowStockThreshold}`}
                              </span>
                            )}
                            {item.trackedIndividually && item.units && (
                              <span className="text-xs text-muted-foreground">
                                유닛 {item.units.length}개 (
                                사용 가능 {item.units.filter((u) => u.status === 'AVAILABLE').length})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {canWrite && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs shrink-0"
                          onClick={() => setAssignItem(item)}
                        >
                          지급
                        </Button>
                      )}
                    </div>

                    {item.trackedIndividually && item.units && item.units.length > 0 && (
                      <div className="mt-3 ml-2">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="h-7 text-xs">유닛 #</TableHead>
                              <TableHead className="h-7 text-xs">상태</TableHead>
                              <TableHead className="h-7 text-xs">사용 선수</TableHead>
                              {canWrite && <TableHead className="h-7 w-32" />}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {item.units.map((unit) => (
                              <TableRow key={unit.id}>
                                <TableCell className="text-xs py-1.5">{unit.id}</TableCell>
                                <TableCell className="py-1.5">
                                  <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${UNIT_STATUS_STYLE[unit.status]}`}>
                                    {UNIT_STATUS_LABEL[unit.status]}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs py-1.5 text-muted-foreground">
                                  {unit.assignedTo?.playerName ?? '—'}
                                </TableCell>
                                {canWrite && (
                                  <TableCell className="py-1.5">
                                    <Select
                                      value={unit.status}
                                      onValueChange={(v) => handleUnitStatusChange(unit.id, v as EquipmentUnitStatus)}
                                    >
                                      <SelectTrigger className="h-6 text-xs w-28">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {UNIT_STATUSES.map((s) => (
                                          <SelectItem key={s} value={s}>{UNIT_STATUS_LABEL[s]}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canWrite && (
              <CreateItemDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onSaved={() => { setCreateOpen(false); setLoading(true); void fetchItems() }}
              />
            )}

            {assignItem && (
              <AssignDialog
                open={!!assignItem}
                onOpenChange={(v) => { if (!v) setAssignItem(null) }}
                item={assignItem}
                onSaved={() => { setAssignItem(null); void fetchItems() }}
              />
            )}
          </TabsContent>
          <TabsContent value="loans">
            <LoansTab isKitManager={isKitManager} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
