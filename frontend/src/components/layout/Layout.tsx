import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Globe, Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  // 点完菜单要收起来，否则抽屉一直盖着刚跳过去的页面
  useEffect(() => setMenuOpen(false), [pathname])

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 md:hidden" />
          <DialogPrimitive.Content data-nav-drawer="" className="fixed inset-y-0 left-0 z-50 outline-none md:hidden">
            <DialogPrimitive.Title className="sr-only">导航菜单</DialogPrimitive.Title>
            <Sidebar />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:hidden">
          <button
            type="button"
            aria-label="打开菜单"
            onClick={() => setMenuOpen(true)}
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Globe className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">SocialHub</span>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
