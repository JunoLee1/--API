import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { accountCodeApi } from '@/services/accountCode.service'
import type { AccountCode } from '@/types/account-code'
import { useCurrentUser } from '@/hooks/useCurrentUser'
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
import { Pencil, Trash2, Check, X, Plus } from 'lucide-react'

type AccountCodeType = 'REVENUE' | 'EXPENSE'

const TYPE_LABEL: Record<AccountCodeType, string> = {
  REVENUE: '수익',
  EXPENSE: '지출',
}

const TYPE_STYLE: Record<AccountCodeType, string> = {
  REVENUE: 'border-blue-300 text-blue-700 bg-blue-50',
  EXPENSE: 'border-red-300 text-red-700 bg-red-50',
}

interface EditState {
  id: number
  name: string
  type: AccountCodeType
}

interface AddState {
  code: string
  name: string
  type: AccountCodeType
}

export default function AccountCodesPage() {
  const { user } = useCurrentUser()
  const isAdmin = !!user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role)

  const [codes, setCodes] = useState<AccountCode[]>([])
  const [loading, setLoading] = useState(true)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addState, setAddState] = useState<AddState>({ code: '', name: '', type: 'REVENUE' })
  const [adding, setAdding] = useState(false)

  const load = () => {
    setLoading(true)
    accountCodeApi
      .list()
      .then(setCodes)
      .catch(() => toast.error('계정과목 목록을 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const startEdit = (c: AccountCode) => {
    setEditState({ id: c.id, name: c.name, type: c.type })
  }

  const cancelEdit = () => setEditState(null)

  const saveEdit = async () => {
    if (!editState) return
    setSaving(true)
    try {
      await accountCodeApi.update(editState.id, { name: editState.name, type: editState.type })
      toast.success('수정되었습니다')
      setEditState(null)
      load()
    } catch {
      toast.error('수정에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('삭제하시겠습니까?')) return
    setDeleting(id)
    try {
      await accountCodeApi.delete(id)
      toast.success('삭제되었습니다')
      load()
    } catch {
      toast.error('삭제에 실패했습니다')
    } finally {
      setDeleting(null)
    }
  }

  const handleAdd = async () => {
    if (!addState.code.trim() || !addState.name.trim()) {
      toast.error('코드와 이름을 입력해주세요')
      return
    }
    setAdding(true)
    try {
      await accountCodeApi.create({ code: addState.code.trim(), name: addState.name.trim(), type: addState.type })
      toast.success('추가되었습니다')
      setAddOpen(false)
      setAddState({ code: '', name: '', type: 'REVENUE' })
      load()
    } catch {
      toast.error('추가에 실패했습니다')
    } finally {
      setAdding(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        접근 권한이 없습니다
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">계정과목 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">수익/지출 계정과목을 등록하고 관리합니다</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" />
          추가
        </Button>
      </div>

      {/* 추가 폼 */}
      {addOpen && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <p className="text-sm font-medium">새 계정과목</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label htmlFor="add-code" className="text-xs">코드</Label>
              <Input
                id="add-code"
                className="w-28 h-8 text-sm"
                placeholder="예: REV001"
                value={addState.code}
                onChange={(e) => setAddState((s) => ({ ...s, code: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-name" className="text-xs">이름</Label>
              <Input
                id="add-name"
                className="w-48 h-8 text-sm"
                placeholder="계정과목 이름"
                value={addState.name}
                onChange={(e) => setAddState((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">유형</Label>
              <Select
                value={addState.type}
                onValueChange={(v) => setAddState((s) => ({ ...s, type: v as AccountCodeType }))}
              >
                <SelectTrigger className="w-24 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REVENUE">수익</SelectItem>
                  <SelectItem value="EXPENSE">지출</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={adding}>
                {adding ? '추가 중...' : '저장'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>
                취소
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="border rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            불러오는 중...
          </div>
        ) : codes.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            등록된 계정과목이 없습니다
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-28">코드</TableHead>
                <TableHead>이름</TableHead>
                <TableHead className="w-20">유형</TableHead>
                <TableHead className="w-24 text-right">수정</TableHead>
                <TableHead className="w-20 text-right">삭제</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((c) => {
                const isEditing = editState?.id === c.id
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm tabular-nums">{c.code}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          className="h-7 text-sm w-full max-w-xs"
                          value={editState.name}
                          onChange={(e) => setEditState((s) => s ? { ...s, name: e.target.value } : s)}
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm">{c.name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Select
                          value={editState.type}
                          onValueChange={(v) => setEditState((s) => s ? { ...s, type: v as AccountCodeType } : s)}
                        >
                          <SelectTrigger className="w-20 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="REVENUE">수익</SelectItem>
                            <SelectItem value="EXPENSE">지출</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={`text-xs ${TYPE_STYLE[c.type]}`}>
                          {TYPE_LABEL[c.type]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={saveEdit}
                            disabled={saving}
                          >
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={cancelEdit}
                          >
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => startEdit(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={deleting === c.id}
                        onClick={() => handleDelete(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
