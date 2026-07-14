import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { partnerApi } from '@/services/partner.service'
import type { Partner, PartnerType, CreatePartnerDto, CreatePartnerContractDto } from '@/types/partner'
import { PARTNER_TYPE_LABEL, CONTRACT_STATUS_LABEL, CONTRACT_STATUS_STYLE } from '@/types/partner'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'

interface CreatePartnerDialogProps {
  open: boolean
  type: PartnerType
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}

function CreatePartnerDialog({ open, type, onOpenChange, onSaved }: CreatePartnerDialogProps) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  const reset = () => { setName(''); setCountry(''); setWebsite(''); setAddress(''); setPhone('') }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('이름을 입력해주세요.'); return }
    setSaving(true)
    try {
      const dto: CreatePartnerDto = {
        type,
        name: name.trim(),
        ...(country && { country }),
        ...(website && { website }),
        ...(address && { address }),
        ...(phone && { phone }),
      }
      await partnerApi.create(dto)
      toast.success(`${PARTNER_TYPE_LABEL[type]}이(가) 등록됐습니다.`)
      reset()
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error('등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{PARTNER_TYPE_LABEL[type]} 등록</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>이름 *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          {type === 'MANUFACTURER' && (
            <>
              <div><Label>국가</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} /></div>
              <div><Label>웹사이트</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} /></div>
            </>
          )}
          {type === 'HOSPITAL' && (
            <>
              <div><Label>주소</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              <div><Label>전화번호</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중…' : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddContractDialog({ partner, open, onOpenChange, onSaved }: {
  partner: Partner; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void
}) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sponsorshipFee, setSponsorshipFee] = useState('')
  const [discountRate, setDiscountRate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!startDate || !endDate) { toast.error('계약 기간을 입력해주세요.'); return }
    setSaving(true)
    try {
      const dto: CreatePartnerContractDto = {
        startDate,
        endDate,
        ...(sponsorshipFee && { sponsorshipFee: Number(sponsorshipFee) }),
        ...(discountRate && { discountRate: Number(discountRate) }),
        ...(notes && { notes }),
      }
      await partnerApi.createContract(partner.id, dto)
      toast.success('계약이 등록됐습니다.')
      onSaved()
      onOpenChange(false)
    } catch {
      toast.error('계약 등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{partner.name} — 계약 추가</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>시작일 *</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><Label>종료일 *</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div><Label>스폰서십 금액 (원)</Label><Input type="number" value={sponsorshipFee} onChange={(e) => setSponsorshipFee(e.target.value)} /></div>
          <div><Label>할인율 (%)</Label><Input type="number" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} /></div>
          <div><Label>비고</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '저장 중…' : '저장'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PartnerRow({ partner, isAdmin, onContractAdded }: {
  partner: Partner; isAdmin: boolean; onContractAdded: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [addContractOpen, setAddContractOpen] = useState(false)

  const latestContract = partner.contracts?.[0]

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <TableCell className="font-medium">{partner.name}</TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {partner.type === 'MANUFACTURER' ? partner.country : partner.address}
        </TableCell>
        <TableCell>
          {latestContract ? (
            <Badge variant="outline" className={CONTRACT_STATUS_STYLE[latestContract.status]}>
              {CONTRACT_STATUS_LABEL[latestContract.status]}
            </Badge>
          ) : <span className="text-muted-foreground text-xs">계약 없음</span>}
        </TableCell>
        <TableCell className="text-right">
          {expanded ? <ChevronUp className="h-4 w-4 inline" /> : <ChevronDown className="h-4 w-4 inline" />}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={4} className="bg-muted/30 p-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold">계약 이력</p>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setAddContractOpen(true) }}>
                  <Plus className="h-3.5 w-3.5 mr-1" />계약 추가
                </Button>
              )}
            </div>
            {!partner.contracts?.length ? (
              <p className="text-sm text-muted-foreground">등록된 계약이 없습니다.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left pb-1">기간</th>
                    <th className="text-left pb-1">스폰서십</th>
                    <th className="text-left pb-1">할인율</th>
                    <th className="text-left pb-1">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {partner.contracts?.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="py-1">{c.startDate.slice(0, 10)} ~ {c.endDate.slice(0, 10)}</td>
                      <td className="py-1">{c.sponsorshipFee != null ? `${c.sponsorshipFee.toLocaleString()}원` : '—'}</td>
                      <td className="py-1">{c.discountRate != null ? `${c.discountRate}%` : '—'}</td>
                      <td className="py-1">
                        <Badge variant="outline" className={CONTRACT_STATUS_STYLE[c.status]}>
                          {CONTRACT_STATUS_LABEL[c.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <AddContractDialog
              partner={partner}
              open={addContractOpen}
              onOpenChange={setAddContractOpen}
              onSaved={onContractAdded}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export function PartnersPage() {
  const { user } = useCurrentUser()
  const isAdmin = user?.role === 'ADMIN'
  const [tab, setTab] = useState<PartnerType>('HOSPITAL')
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const load = () => {
    setLoading(true)
    partnerApi.list(tab).then(setPartners).catch(() => toast.error('목록을 불러오지 못했습니다.')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tab])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">파트너 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">협진병원 및 장비 제조사 계약 관리</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {PARTNER_TYPE_LABEL[tab]} 추가
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as PartnerType)}>
          <TabsList className="mb-4">
            <TabsTrigger value="HOSPITAL">협진병원</TabsTrigger>
            <TabsTrigger value="MANUFACTURER">제조사</TabsTrigger>
          </TabsList>

          {(['HOSPITAL', 'MANUFACTURER'] as PartnerType[]).map((t) => (
            <TabsContent key={t} value={t}>
              {loading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>{t === 'MANUFACTURER' ? '국가' : '주소'}</TableHead>
                      <TableHead>최근 계약</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partners.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">등록된 {PARTNER_TYPE_LABEL[t]}이 없습니다.</TableCell></TableRow>
                    ) : (
                      partners.map((p) => (
                        <PartnerRow key={p.id} partner={p} isAdmin={isAdmin} onContractAdded={load} />
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <CreatePartnerDialog
        open={createOpen}
        type={tab}
        onOpenChange={setCreateOpen}
        onSaved={load}
      />
    </div>
  )
}
