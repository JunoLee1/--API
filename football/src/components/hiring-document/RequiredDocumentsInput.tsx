import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DEFAULT_REQUIRED_DOCS } from '@/types/hiring-document'

interface Props {
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
}

/**
 * Editor for the `requiredDocuments` string array. Free-form input + a
 * "기본 서류 추가" template button that appends the common Korean HR set
 * (신분증 / 통장사본 / 최종학력증명). Trims + de-dupes on add so the array
 * matches what the BE gate expects (Q10 subset check).
 */
export function RequiredDocumentsInput({ value, onChange, disabled }: Props) {
  const [draft, setDraft] = useState('')

  const addOne = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    if (value.includes(trimmed)) return
    onChange([...value, trimmed])
    setDraft('')
  }

  const addTemplate = () => {
    const merged = [...value]
    for (const doc of DEFAULT_REQUIRED_DOCS) {
      if (!merged.includes(doc)) merged.push(doc)
    }
    onChange(merged)
  }

  const remove = (idx: number) => {
    const next = value.slice()
    next.splice(idx, 1)
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            필수 서류가 없습니다. 아래에서 추가하세요.
          </span>
        ) : (
          value.map((doc, i) => (
            <Badge key={`${doc}-${i}`} variant="secondary" className="gap-1">
              {doc}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="ml-1 text-xs text-muted-foreground hover:text-destructive"
                  aria-label={`${doc} 제거`}
                >
                  ×
                </button>
              )}
            </Badge>
          ))
        )}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addOne(draft)
              }
            }}
            placeholder="서류 종류 입력 (예: 신분증)"
            className="flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => addOne(draft)}>
            추가
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={addTemplate}>
            기본 서류 추가
          </Button>
        </div>
      )}
    </div>
  )
}
