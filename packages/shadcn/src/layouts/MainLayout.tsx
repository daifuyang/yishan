import { Link, Outlet, useLocation } from 'react-router'
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function MainLayout() {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  const navItems = [
      { path: '/', label: '首页' },
      { path: '/pro-table', label: '表格组件' },
      { path: '/query-filter', label: '筛选组件' },
    ]

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link 
              to="/" 
              className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"
            >
              Shadcn Components
            </Link>
            
            <div className="flex items-center gap-2">
              {navItems.map((item) => (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive(item.path) ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "transition-colors",
                      isActive(item.path) && "shadow-sm"
                    )}
                  >
                    {item.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
      
      <main className="flex-1">
        <Outlet />
      </main>
      
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              © 2024 Shadcn Components. Built with React Router & Shadcn UI.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>版本 v1.0.0</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}