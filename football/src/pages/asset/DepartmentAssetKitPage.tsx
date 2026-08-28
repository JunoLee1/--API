import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { departmentAssetKitApi } from '@/services/department-asset-kit.service'
import { equipmentApi } from '@/services/equipment.service'
import { useExpenseCategories } from '@/hooks/useExpenseCategories'
import type {
  DepartmentAssetKit,
  DepartmentAssetKitItem,
} from '@/types/department-asset-kit'
import type { EquipmentItem } from '@/types/equipment'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'

/**
 * DepartmentAssetKitPage (#373)
 *
 * Route: `/departments/:departmentId/asset-kit`
 *
 * ADMIN / ASSET_MANAGER manages the per-department default asset kit that
 * `HiringDispatch.dispatch()` reads to auto-provision `AssetRequest` DRAFTs
 * for a new employee. Editor UX:
 *   - kit item = pick an EquipmentItem + quantity + optional note
 *   - defaultExpenseCategoryId sets the ExpenseCategory used on every draft
 *   - Save = PUT-upsert (whole-list replacement)
 *   - Delete removes the kit (dispatches for this dept will no-op after that)
 *
 * Note: Redundant client-side validations are intentionally lightweight —
 * the server validates strictly (equipmentItemId existence, duplicates,
 * note length ≤200). We surface the resulting AppError code back to the
 * user rather than duplicating the rules.
 */
export default function DepartmentAssetKitPage() {
  const params = useParams<{ departmentId?: string }>()
  const departmentId = Number(params.departmentId)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [kit, setKit] = useState<DepartmentAssetKit | null>(null)
  const [items, setItems] = useState<DepartmentAssetKitItem[]>([])
  const [defaultExpenseCategoryId, setDefaultExpenseCategoryId] = useState<string>('')
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([])
  const { rows: categories, loading: categoriesLoading } = useExpenseCategories()

  const equipmentById = useMemo(
    () => new Map(equipmentItems.map((e) => [e.id, e])),
    [equipmentItems],
  )

  const load = useCallback(async () => {
    if (!Number.isFinite(departmentId) || departmentId <= 0) return
    setLoading(true)
    try {
      const [existing, allEquipment] = await Promise.all([
        departmentAssetKitApi.get(departmentId),
        equipmentApi.listItems(),
      ])
      setEquipmentItems(allEquipment)
      if (existing) {
        setKit(existing)
        setItems(existing.assetItems)
        setDefaultExpenseCategoryId(String(existing.defaultExpenseCategoryId))
      } else {
        setKit(null)
        setItems([])
        setDefaultExpenseCategoryId('')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ERROR'
      toast.error(`자산 세트 로드 실패: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  const addItem = () => {
    setItems((prev) => [...prev, { equipmentItemId: 0, quantity: 1 }])
  }

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateItem = (idx: number, patch: Partial<DepartmentAssetKitItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error('자산 항목을 최소 1개 이상 추가해주세요')
      return
    }
    const categoryId = Number(defaultExpenseCategoryId)
    if (!Number.isFinite(categoryId) || categoryId <= 0) {
      toast.error('기본 회계 카테고리를 선택해주세요')
      return
    }
    // Local sanity — surface obvious mistakes without a round-trip. Server
    // still enforces canonically.
    for (const it of items) {
      if (!it.equipmentItemId || it.equipmentItemId <= 0) {
        toast.error('선택되지 않은 자산 항목이 있습니다')
        return
      }
      if (!it.quantity || it.quantity <= 0) {
        toast.error('수량은 1 이상이어야 합니다')
        return
      }
    }
    setSaving(true)
    try {
      const saved = await departmentAssetKitApi.upsert(departmentId, {
        assetItems: items.map((it) => ({
          equipmentItemId: it.equipmentItemId,
          quantity: it.quantity,
          ...(it.note && it.note.trim() ? { note: it.note.trim() } : {}),
        })),
        defaultExpenseCategoryId: categoryId,
      })
      setKit(saved)
      setItems(saved.assetItems)
      toast.success('기본 자산 세트를 저장했습니다')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ERROR'
      toast.error(`저장 실패: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    if (!kit) return
    if (!window.confirm('이 부서의 기본 자산 세트를 삭제하시겠습니까?')) return
    setRemoving(true)
    try {
      await departmentAssetKitApi.remove(departmentId)
      setKit(null)
      setItems([])
      setDefaultExpenseCategoryId('')
      toast.success('기본 자산 세트를 삭제했습니다')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ERROR'
      toast.error(`삭제 실패: ${msg}`)
    } finally {
      setRemoving(false)
    }
  }

  if (loading || categoriesLoading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">부서 기본 자산 세트</h1>
          <p className="text-sm text-muted-foreground mt-1">
            부서 ID {departmentId} · {kit ? '수정' : '신규 생성'} · 신입 발령 시
            자동으로 DRAFT 자산 신청을 생성합니다
          </p>
        </div>
        <div className="flex gap-2">
          {kit && (
            <Button variant="outline" onClick={handleRemove} disabled={removing}>
              {removing ? '삭제 중…' : '삭제'}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </header>

      <Card className="p-4 space-y-3">
        <div>
          <Label htmlFor="default-category">기본 회계 카테고리 *</Label>
          <Select
            value={defaultExpenseCategoryId}
            onValueChange={(v) => setDefaultExpenseCategoryId(v)}
          >
            <SelectTrigger id="default-category">
              <SelectValue placeholder="카테고리 선택" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  [{c.code}] {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            자동 생성 DRAFT 의 회계 카테고리 기본값 (신입이 편집 가능)
          </p>
        </div>
      </Card>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">자산 항목 ({items.length})</h2>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="w-4 h-4 mr-1" />
            항목 추가
          </Button>
        </div>
        {items.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            아직 자산 항목이 없습니다. "항목 추가"를 눌러 노트북/사원증 등을 등록하세요.
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => {
              const chosen = equipmentById.get(item.equipmentItemId)
              return (
                <Card key={idx} className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-muted font-mono">
                      #{idx + 1}
                    </span>
                    {chosen?.trackedIndividually && (
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                        개별 관리
                      </span>
                    )}
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(idx)}
                      aria-label="삭제"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`item-equip-${idx}`}>자산 *</Label>
                      <Select
                        value={item.equipmentItemId ? String(item.equipmentItemId) : ''}
                        onValueChange={(v) =>
                          updateItem(idx, { equipmentItemId: Number(v) })
                        }
                      >
                        <SelectTrigger id={`item-equip-${idx}`}>
                          <SelectValue placeholder="자산 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {equipmentItems.map((e) => (
                            <SelectItem key={e.id} value={String(e.id)}>
                              {e.name}
                              {e.category ? ` · ${e.category}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`item-qty-${idx}`}>수량 *</Label>
                      <Input
                        id={`item-qty-${idx}`}
                        type="number"
                        min={1}
                        max={999}
                        value={item.quantity}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          if (Number.isFinite(n)) updateItem(idx, { quantity: n })
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`item-note-${idx}`}>메모 (선택)</Label>
                    <Input
                      id={`item-note-${idx}`}
                      value={item.note ?? ''}
                      onChange={(e) => updateItem(idx, { note: e.target.value })}
                      maxLength={200}
                      placeholder="draft justification 에 붙는 설명 (200자 이내)"
                    />
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
