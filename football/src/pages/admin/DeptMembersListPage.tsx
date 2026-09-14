import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { departmentApi, type Department } from '@/services/department.service'
import { Users, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export function DeptMembersListPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [depts, setDepts] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    departmentApi.list()
      .then(d => setDepts(d.filter(dept => dept.isActive)))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">{t('nav.item.myTeamMembers')}</h1>
      <div className="space-y-6">
        {depts.map(dept => {
          const activeChildren = (dept.children ?? []).filter(c => c.isActive)

          return (
            <div key={dept.id}>
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {dept.name}
                </h2>
              </div>

              {activeChildren.length === 0 ? (
                <button
                  type="button"
                  onClick={() => navigate(`/admin/department-members/${dept.id}`)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                >
                  <span className="font-medium">{dept.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ) : (
                <div className="space-y-1 pl-2">
                  {activeChildren.map(team => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => navigate(`/admin/department-members/${team.id}`)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                    >
                      <span className="font-medium">{team.name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {depts.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('deptMember.empty')}</p>
        )}
      </div>
    </div>
  )
}
