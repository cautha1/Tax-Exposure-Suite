import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  LayoutDashboard, Users, FileSpreadsheet, 
  AlertTriangle, FileText, Settings, LogOut, 
  Menu, X, ShieldAlert, BarChart3, Building2 
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/transactions', label: 'Transactions', icon: FileSpreadsheet },
  { href: '/risks', label: 'Tax Risks', icon: ShieldAlert },
  { href: '/reports', label: 'Reports', icon: FileText },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-lg">TaxIntel</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {(mobileMenuOpen || window.innerWidth >= 768) && (
          <motion.div 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
            className={`
              fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-sidebar text-sidebar-foreground 
              flex flex-col border-r border-sidebar-border shadow-2xl md:shadow-none
              ${mobileMenuOpen ? 'block' : 'hidden md:flex'}
            `}
          >
            <div className="p-6 hidden md:flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight">TaxIntel</span>
            </div>

            <div className="px-4 pb-4">
              <div className="p-3 rounded-xl bg-sidebar-accent border border-sidebar-border mb-6">
                <p className="text-xs font-medium text-sidebar-foreground/60 uppercase tracking-wider mb-1">Signed in as</p>
                <p className="text-sm font-semibold truncate">{user?.fullName}</p>
                <p className="text-xs text-sidebar-foreground/70 capitalize mt-0.5">{user?.role}</p>
              </div>
            </div>

            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group
                    ${isActive 
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md' 
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'}
                  `}>
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80'}`} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-sidebar-border space-y-1">
              <Link href="/settings" onClick={() => setMobileMenuOpen(false)} className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                ${location === '/settings' ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent'}
              `}>
                <Settings className="w-5 h-5" />
                <span className="font-medium">Settings</span>
              </Link>
              <button onClick={() => logout()} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-destructive transition-all duration-200">
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-auto bg-slate-50/50">
          {children}
        </div>
      </main>
      
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" 
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}
    </div>
  );
}
