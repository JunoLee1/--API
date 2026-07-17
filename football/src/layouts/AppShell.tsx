import { useEffect, useState, useCallback } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useConfirm } from '@/lib/confirm-dialog'
import { useApiPending } from '@/lib/useApiPending'
import { authApi } from '@/services/auth.service'
import { notificationApi } from '@/services/notification.service'
import { NotificationPopover } from '@/components/common/NotificationPopover'
import { connectSocket, disconnectSocket } from '@/lib/socket'
import { usePlayerNotification } from '@/hooks/usePlayerNotification'
import { usePartnerNotification } from '@/hooks/usePartnerNotification'
import { useReportNotification } from '@/hooks/useReportNotification'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Activity,
  BarChart3,
  Briefcase,
  Building2,
  ChevronRight,
  ClipboardList,
  FileText,
  type LucideIcon,
  Menu,
  Package,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  Stethoscope,
  TrendingUp,
  Trophy,
  UserSearch,
  Users,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  COACHING_ROLE_LABEL,
  FRONT_OFFICE_ROLE_LABEL,
  ROLE_LABEL,
  type CoachingRole,
  type FrontOfficeRole,
  type Role,
} from '@/types/auth'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  section?: '선수 관리' | '계약·영입' | '부상·의료' | '훈련' | '경기·분석' | '관리'
  roles?: Role[]
  coachingRoles?: CoachingRole[]
  frontOfficeRoles?: FrontOfficeRole[]
  description?: string
}


const SECTION_ORDER: Array<NavItem['section'] & string> = [
  '선수 관리',
  '계약·영입',
  '부상·의료',
  '훈련',
  '경기·분석',
  '관리',
]

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: '대시보드', icon: BarChart3, end: true },

  // 선수 관리
  {
    to: '/players',
    label: '선수 목록',
    icon: Users,
    section: '선수 관리',
    end: true,
    roles: ['ADMIN', 'FRONT_OFFICE', 'COACHING_STAFF'],
  },
  {
    to: '/prospects',
    label: '영입 후보',
    icon: UserSearch,
    section: '선수 관리',
    roles: ['ADMIN', 'FRONT_OFFICE', 'COACHING_STAFF'],
  },

  // 계약·영입
  {
    to: '/contracts',
    label: '계약 목록',
    icon: ScrollText,
    section: '계약·영입',
    roles: ['ADMIN', 'FRONT_OFFICE'],
  },
  {
    to: '/transfers',
    label: '이적 현황',
    icon: Activity,
    section: '계약·영입',
    roles: ['ADMIN', 'FRONT_OFFICE'],
  },
  {
    to: '/coaches/rounds',
    label: '코치 채용',
    icon: Briefcase,
    section: '계약·영입',
    roles: ['ADMIN', 'FRONT_OFFICE'],
    frontOfficeRoles: ['GM', 'TD'],
  },

  // 부상·의료
  {
    to: '/injuries',
    label: '부상 현황',
    icon: Stethoscope,
    section: '부상·의료',
    end: true,
    roles: ['ADMIN', 'FRONT_OFFICE', 'COACHING_STAFF'],
  },
  {
    to: '/injuries/stats',
    label: '부상 통계',
    icon: TrendingUp,
    section: '부상·의료',
    roles: ['ADMIN', 'COACHING_STAFF'],
    coachingRoles: ['HEAD_COACH', 'ASSISTANT_COACH', 'MEDICAL', 'MEDICAL_DIRECTOR'],
  },
  {
    to: '/medical-expenses',
    label: '의료비 결재',
    icon: Receipt,
    section: '부상·의료',
    roles: ['ADMIN', 'COACHING_STAFF'],
    coachingRoles: ['MEDICAL', 'MEDICAL_DIRECTOR'],
  },

  // 훈련
  {
    to: '/training',
    label: '훈련 일정',
    icon: ClipboardList,
    section: '훈련',
    end: true,
    roles: ['ADMIN', 'COACHING_STAFF', 'PLAYER'],
  },
  {
    to: '/training/attendance',
    label: '출석 현황',
    icon: Shield,
    section: '훈련',
    roles: ['ADMIN', 'COACHING_STAFF'],
  },

  // 경기·분석
  {
    to: '/matches',
    label: '경기 목록',
    icon: Trophy,
    section: '경기·분석',
    end: true,
    roles: ['ADMIN', 'COACHING_STAFF', 'PLAYER'],
  },
  {
    to: '/matches/analysis',
    label: '전술 분석',
    icon: FileText,
    section: '경기·분석',
    roles: ['ADMIN', 'COACHING_STAFF'],
  },
  {
    to: '/matches/rankings',
    label: '팀 순위',
    icon: BarChart3,
    section: '경기·분석',
  },

  // 관리
  {
    to: '/reports',
    label: '보고서 결재',
    icon: FileText,
    section: '관리',
    roles: ['ADMIN', 'FRONT_OFFICE', 'COACHING_STAFF'],
    frontOfficeRoles: ['GM'],
  },
  {
    to: '/equipment',
    label: '장비 관리',
    icon: Package,
    section: '관리',
    roles: ['ADMIN', 'FRONT_OFFICE', 'COACHING_STAFF'],
  },
  {
    to: '/admin/partners',
    label: '파트너 관리',
    icon: Building2,
    section: '관리',
    roles: ['ADMIN', 'FRONT_OFFICE'],
    frontOfficeRoles: ['EQUIPMENT_MANAGER'],
  },
  {
    to: '/admin/users',
    label: '사용자 관리',
    icon: Settings,
    section: '관리',
    roles: ['ADMIN'],
  },
]

export function AppShell() {
  const { user, loading } = useCurrentUser()
  const navigate = useNavigate()
  const location = useLocation()
  const confirm = useConfirm()
  const apiPending = useApiPending()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [openSection, setOpenSection] = useState<string | null>(() => {
    const found = NAV_ITEMS.find((item) => {
      if (!item.section) return false
      if (item.end) return location.pathname === item.to
      return location.pathname === item.to || location.pathname.startsWith(item.to + '/')
    })
    return found?.section ?? null
  })

  useEffect(() => {
    const activeItem = NAV_ITEMS.find((item) => {
      if (item.end) return location.pathname === item.to
      return location.pathname === item.to || location.pathname.startsWith(item.to + '/')
    })
    if (activeItem?.section) {
      setOpenSection(activeItem.section)
    }
  }, [location.pathname])

  const refreshUnread = useCallback(() => {
    notificationApi
      .my()
      .then((items) => setUnreadCount(items.filter((n) => !n.readAt).length))
      .catch(() => null)
  }, [])

  useEffect(() => {
    if (!user) return
    refreshUnread()
    const timer = setInterval(refreshUnread, 30_000)
    return () => clearInterval(timer)
  }, [user, refreshUnread])

  useEffect(() => {
    if (!user) return
    connectSocket()
    return () => disconnectSocket()
  }, [user])

  usePlayerNotification(refreshUnread)
  usePartnerNotification(user?.role)
  useReportNotification(refreshUnread)

  const clearLocalSession = () => {
    authApi.logout()
    navigate('/login')
  }

  const handleLogout = async () => {
    const ok = await confirm({
      title: '로그아웃',
      description: '정말 로그아웃 하시겠습니까?',
      confirmText: '로그아웃',
    })
    if (!ok) return
    clearLocalSession()
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true
    if (!user) return false
    if (!item.roles.includes(user.role)) return false
    if (item.coachingRoles && user.role === 'COACHING_STAFF') {
      return user.coachingRole !== null && item.coachingRoles.includes(user.coachingRole)
    }
    if (item.frontOfficeRoles && user.role === 'FRONT_OFFICE') {
      return user.frontOfficeRole !== null && item.frontOfficeRoles.includes(user.frontOfficeRole)
    }
    return true
  })

  const navGroups: Array<{ section: string | null; items: NavItem[] }> = []
  const rootItems = visibleNavItems.filter((i) => !i.section)
  if (rootItems.length > 0) navGroups.push({ section: null, items: rootItems })
  for (const s of SECTION_ORDER) {
    const items = visibleNavItems.filter((i) => i.section === s)
    if (items.length > 0) navGroups.push({ section: s, items })
  }

  const isItemActive = (item: NavItem) => {
    if (item.end) return location.pathname === item.to
    return location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  }

  const renderNavLink = (item: NavItem, onClick?: () => void) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={onClick}
      title={item.description}
      className={() => {
        const active = isItemActive(item)
        return `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
          active
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
        }`
      }}
    >
      <item.icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{item.label}</span>
    </NavLink>
  )

  const renderNavGroups = (onClick?: () => void) =>
    navGroups.map((g, idx) => {
      if (g.section === null) {
        return (
          <div key="__root__" className="space-y-1">
            {g.items.map((item) => renderNavLink(item, onClick))}
          </div>
        )
      }
      const isOpen = openSection === g.section
      const hasActive = g.items.some(isItemActive)
      return (
        <div key={g.section} className={idx > 0 ? 'pt-3' : ''}>
          <button
            type="button"
            aria-expanded={isOpen}
            onClick={(e) => {
              setOpenSection(isOpen ? null : g.section)
              e.currentTarget.blur()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold text-foreground/80 hover:bg-accent/50 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset transition-colors"
          >
            <ChevronRight
              className={cn('h-3.5 w-3.5 transition-transform shrink-0', isOpen && 'rotate-90')}
              aria-hidden
            />
            <span className="flex-1 text-left">{g.section}</span>
            {hasActive && !isOpen && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-foreground"
                aria-label="이 섹션에 현재 페이지 있음"
              />
            )}
          </button>
          {isOpen && (
            <div className="space-y-1 mt-1 ml-3 pl-2 border-l border-border/60">
              {g.items.map((item) => renderNavLink(item, onClick))}
            </div>
          )}
        </div>
      )
    })

  const userSubLabel = () => {
    if (!user) return ''
    if (user.role === 'COACHING_STAFF' && user.coachingRole) {
      return COACHING_ROLE_LABEL[user.coachingRole]
    }
    if (user.role === 'FRONT_OFFICE' && user.frontOfficeRole) {
      return FRONT_OFFICE_ROLE_LABEL[user.frontOfficeRole]
    }
    return ROLE_LABEL[user.role]
  }

  const SidebarNav = ({ onNavClick }: { onNavClick?: () => void }) => (
    <>
      <nav
        className={`flex-1 px-3 py-4 transition-opacity ${
          apiPending ? 'opacity-50' : ''
        }`}
        aria-busy={apiPending}
      >
        {renderNavGroups(onNavClick)}
      </nav>

      <div className="border-t p-3">
        {loading || !user ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <NavLink
            to="/me"
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2 py-1.5 rounded-md transition-colors ${
                isActive ? 'bg-accent' : 'hover:bg-accent/50'
              }`
            }
            title="내 정보"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{user.nickname.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{user.nickname}</p>
              <p className="text-xs text-muted-foreground truncate">{userSubLabel()}</p>
            </div>
          </NavLink>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-muted-foreground"
          onClick={() => {
            onNavClick?.()
            void handleLogout()
          }}
        >
          로그아웃
        </Button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex bg-background">
      {/* 데스크탑 사이드바 */}
      <aside className="w-60 border-r bg-card hidden md:flex flex-col">
        <div className="px-4 h-14 border-b flex items-center justify-between shrink-0">
          <h1 className="text-base font-semibold tracking-tight">Football ERP</h1>
          <NotificationPopover
            unreadCount={unreadCount}
            onUnreadCountChange={setUnreadCount}
            iconSize="sm"
          />
        </div>

        <nav
          className={`flex-1 px-3 py-4 transition-opacity ${
            apiPending ? 'opacity-50' : ''
          }`}
          aria-busy={apiPending}
        >
          {renderNavGroups()}
        </nav>

        <div className="border-t p-3">
          {loading || !user ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <NavLink
              to="/me"
              className={({ isActive }) =>
                `flex items-center gap-3 px-2 py-1.5 rounded-md transition-colors ${
                  isActive ? 'bg-accent' : 'hover:bg-accent/50'
                }`
              }
              title="내 정보"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{user.nickname.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{user.nickname}</p>
                <p className="text-xs text-muted-foreground truncate">{userSubLabel()}</p>
              </div>
            </NavLink>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-muted-foreground"
            onClick={() => void handleLogout()}
          >
            로그아웃
          </Button>
        </div>
      </aside>

      {/* 모바일 햄버거 드로어 */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent showCloseButton>
          <SheetHeader>
            <SheetTitle>Football ERP</SheetTitle>
          </SheetHeader>
          <SidebarNav onNavClick={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 모바일 상단 헤더 */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 border-b bg-card shrink-0">
          <Button
            variant="ghost"
            size="icon"
            aria-label="메뉴 열기"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="flex-1 text-base font-semibold tracking-tight">Football ERP</span>
          <NotificationPopover
            unreadCount={unreadCount}
            onUnreadCountChange={setUnreadCount}
            iconSize="md"
          />
        </header>

        <main
          className={`flex-1 overflow-auto transition-opacity ${
            apiPending ? 'pointer-events-none opacity-60' : ''
          }`}
          aria-busy={apiPending}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
