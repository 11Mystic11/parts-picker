"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Car,
  ClipboardList,
  Upload,
  Settings,
  Users,
  BarChart3,
  LogOut,
  Wrench,
  DollarSign,
  Building2,
  ChevronDown,
  Check,
  DatabaseZap,
  Plug,
  ToggleLeft,
  Megaphone,
  Sun,
  Moon,
  CalendarDays,
  HardHat,
  UserSearch,
  Kanban,
  Package,
  Search,
  ShoppingCart,
  AlertTriangle,
  Shield,
  Car as CarIcon,
  Award,
  // [FEATURE: tech_time_clock] START
  Clock,
  TrendingUp,
  // [FEATURE: tech_time_clock] END
  // [FEATURE: core_return_tracking] START
  RotateCcw,
  // [FEATURE: core_return_tracking] END
  // [FEATURE: canned_inspections] START
  ClipboardCheck,
  // [FEATURE: canned_inspections] END
  Tag,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalChatPanel } from "@/components/global-chat-panel";
import { CommandPalette } from "@/components/command-palette";
import { NotificationBell } from "@/components/notification-bell";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
};

type NavGroup = {
  label?: string;
  roles?: string[];
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    // Technician-only group
    roles: ["technician"],
    items: [
      { label: "My Dashboard",   href: "/dashboard/tech",           icon: HardHat },
      { label: "My Jobs",        href: "/dashboard/ro",             icon: ClipboardList },
      { label: "Announcements",  href: "/dashboard/announcements",  icon: Megaphone },
      // [FEATURE: tech_time_clock] START
      { label: "Time Clock",     href: "/dashboard/tech/time-clock", icon: Clock, roles: ["technician"] },
      // [FEATURE: tech_time_clock] END
    ],
  },
  {
    // Advisor+ group (hidden from technicians)
    roles: ["admin", "manager", "advisor", "developer"],
    items: [
      { label: "Dashboard",      href: "/dashboard",                icon: LayoutDashboard },
      { label: "New RO",         href: "/dashboard/ro/new",         icon: Car },
      { label: "Repair Orders",  href: "/dashboard/ro",             icon: ClipboardList },
      { label: "Customers",      href: "/dashboard/customers",      icon: UserSearch },
      { label: "Lot Vehicles",   href: "/dashboard/lot-vehicles",   icon: Truck },
      { label: "Inspections",    href: "/dashboard/inspections",    icon: ClipboardCheck },
      { label: "Calendar",       href: "/dashboard/calendar",       icon: CalendarDays },
      { label: "Document Ingest",href: "/dashboard/ingest",         icon: Upload },
      { label: "Inventory",      href: "/dashboard/inventory",      icon: Package },
      { label: "Announcements",  href: "/dashboard/announcements",  icon: Megaphone },
      // [FEATURE: core_return_tracking] START
      { label: "Part Returns",   href: "/dashboard/inventory/returns",      icon: RotateCcw, roles: ["admin", "manager", "advisor"] },
      // [FEATURE: core_return_tracking] END
      // [FEATURE: special_orders] START
      { label: "Special Orders", href: "/dashboard/inventory/special-orders", icon: ShoppingCart, roles: ["admin", "manager", "advisor"] },
      // [FEATURE: special_orders] END
      // [FEATURE: backorder_tracking] START
      { label: "Backorders",     href: "/dashboard/inventory/backorders",   icon: AlertTriangle, roles: ["admin", "manager", "advisor"] },
      // [FEATURE: backorder_tracking] END
      // [FEATURE: parts_queue] START
      { label: "Parts Queue",    href: "/dashboard/parts-requests",         icon: Package, roles: ["admin", "manager", "advisor"] },
      // [FEATURE: parts_queue] END
      { label: "Tech Board",     href: "/dashboard/tech-board",             icon: Kanban,   roles: ["admin", "manager", "advisor"] },
      // [FEATURE: warranty_claims] START
      { label: "Warranty Claims",href: "/dashboard/warranty",               icon: Shield, roles: ["admin", "manager", "advisor"] },
      // [FEATURE: warranty_claims] END
      // [FEATURE: loaner_vehicles] START
      { label: "Loaners",        href: "/dashboard/loaners",                icon: CarIcon, roles: ["admin", "manager", "advisor"] },
      // [FEATURE: loaner_vehicles] END
      { label: "Analytics",      href: "/dashboard/analytics",              icon: BarChart3, roles: ["admin", "manager"] },
    ],
  },
  {
    label: "Admin",
    roles: ["admin", "manager"],
    items: [
      { label: "Org Overview",   href: "/dashboard/org",             icon: Building2 },
      { label: "Rules",          href: "/dashboard/admin/rules",     icon: Wrench },
      { label: "Import",         href: "/dashboard/admin/import",    icon: DatabaseZap, roles: ["admin"] },
      { label: "DMS Config",     href: "/dashboard/admin/dms",       icon: Plug,        roles: ["admin"] },
      { label: "Feature Flags",  href: "/dashboard/admin/flags",     icon: ToggleLeft,  roles: ["admin"] },
      { label: "Pricing",        href: "/dashboard/admin/pricing",   icon: DollarSign },
      // [FEATURE: tech_time_clock] START
      { label: "Tech Efficiency", href: "/dashboard/admin/reports/tech-efficiency", icon: TrendingUp, roles: ["admin", "manager"] },
      // [FEATURE: tech_time_clock] END
      // [FEATURE: tech_pay] START
      { label: "Tech Pay",       href: "/dashboard/admin/reports/tech-pay", icon: DollarSign, roles: ["admin", "manager"] },
      // [FEATURE: tech_pay] END
      // [FEATURE: lost_sales] START
      { label: "Lost Sales",     href: "/dashboard/admin/reports/lost-sales", icon: BarChart3, roles: ["admin", "manager"] },
      // [FEATURE: lost_sales] END
      // [FEATURE: purchase_orders] START
      { label: "Purchase Orders", href: "/dashboard/inventory/purchase-orders", icon: ShoppingCart, roles: ["admin", "manager"] },
      // [FEATURE: purchase_orders] END
      // [FEATURE: parts_analytics] START
      { label: "Parts Analytics", href: "/dashboard/analytics/parts", icon: BarChart3, roles: ["admin", "manager"] },
      // [FEATURE: parts_analytics] END
      // [FEATURE: canned_inspections] START
      { label: "Inspections",    href: "/dashboard/admin/inspections", icon: ClipboardCheck, roles: ["admin", "manager"] },
      // [FEATURE: canned_inspections] END
      { label: "Certifications", href: "/dashboard/admin/certifications", icon: Award, roles: ["admin", "manager"] },
      // [FEATURE: fleet_accounts] START
      { label: "Fleet Accounts", href: "/dashboard/admin/fleet-accounts", icon: Building2, roles: ["admin", "manager"] },
      // [FEATURE: fleet_accounts] END
      { label: "Part Tags",      href: "/dashboard/admin/part-tags", icon: Tag,         roles: ["admin", "manager"] },
      { label: "Users",          href: "/dashboard/admin/users",     icon: Users,       roles: ["admin"] },
    ],
  },
  {
    roles: ["admin", "manager", "advisor", "developer"],
    items: [
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

// Tab bar priority items — shown on mobile bottom nav (max 5)
const TAB_BAR_HREFS_ADVISOR = [
  "/dashboard",
  "/dashboard/ro/new",
  "/dashboard/ro",
  "/dashboard/announcements",
  "/dashboard/settings",
];
const TAB_BAR_HREFS_TECH = [
  "/dashboard/tech",
  "/dashboard/ro",
  "/dashboard/announcements",
];

function RooftopSwitcher() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const user = session?.user as any;
  const available: { id: string; name: string }[] = user?.availableRooftops ?? [];
  const currentId: string = user?.rooftopId ?? "";
  const currentName = available.find((r) => r.id === currentId)?.name ?? "Select Rooftop";

  if (available.length <= 1) return null;

  async function switchRooftop(rooftopId: string) {
    if (rooftopId === currentId || switching) return;
    setSwitching(true);
    setOpen(false);
    await update({ rooftopId });
    router.refresh();
    setSwitching(false);
  }

  return (
    <div className="relative px-3 mb-3">
      <button
        onClick={() => setOpen(!open)}
        disabled={switching}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-surface text-sm font-medium text-foreground hover:bg-surface-hover transition-colors",
          switching && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="truncate">{switching ? "Switching…" : currentName}</span>
        </div>
        <ChevronDown className={cn("h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 glass rounded-lg shadow-lg py-1">
          {available.map((r) => (
            <button
              key={r.id}
              onClick={() => switchRooftop(r.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-hover transition-colors text-foreground"
            >
              <Check className={cn("h-4 w-4 flex-shrink-0", r.id === currentId ? "text-primary" : "text-transparent")} />
              <span className="truncate">{r.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const role = (session?.user as any)?.role ?? "advisor";

  useEffect(() => setThemeMounted(true), []);

  const allVisibleItems = navGroups
    .filter((g) => !g.roles || g.roles.includes(role))
    .flatMap((g) => g.items.filter((item) => !item.roles || item.roles.includes(role)));

  const activeHref = allVisibleItems
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const tabBarHrefs = role === "technician" ? TAB_BAR_HREFS_TECH : TAB_BAR_HREFS_ADVISOR;
  const tabBarItems = tabBarHrefs
    .map((href) => allVisibleItems.find((item) => item.href === href))
    .filter((item): item is NavItem => item !== undefined)
    .slice(0, 5);

  function NavLink({ item }: { item: NavItem }) {
    const Icon = item.icon;
    const active = item.href === activeHref;
    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors text-sm",
          active
            ? "bg-surface-hover text-foreground border border-border"
            : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        )}
      >
        <Icon className={cn("h-4 w-4 flex-shrink-0", active && "text-primary")} />
        {item.label}
      </Link>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 glass border-r border-border flex-col shrink-0 z-10">

        {/* Logo */}
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
            <Wrench size={18} />
          </div>
          <span className="font-bold text-lg tracking-tight">Parts Partner</span>
        </div>

        {/* Rooftop switcher */}
        <div className="pt-3">
          <RooftopSwitcher />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-4">
          {navGroups
            .filter((g) => !g.roles || g.roles.includes(role))
            .map((group, gi) => {
              const visibleItems = group.items.filter(
                (item) => !item.roles || item.roles.includes(role)
              );
              if (visibleItems.length === 0) return null;
              return (
                <div key={gi}>
                  {group.label && (
                    <p className="px-3 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group.label}
                    </p>
                  )}
                  <div className="space-y-1">
                    {visibleItems.map((item) => (
                      <NavLink key={item.href} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
              {session?.user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {session?.user?.name ?? "User"}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
            <NotificationBell />
          </div>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-surface-hover mb-1"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {themeMounted && theme === "dark" ? (
              <Sun className="h-4 w-4 mr-2" />
            ) : (
              <Moon className="h-4 w-4 mr-2" />
            )}
            {themeMounted && theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>

          {/* Sign out */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="flex-1 relative flex flex-col min-w-0 overflow-y-auto overflow-x-hidden pb-16 md:pb-0 bg-gray-100 dark:bg-[#000000] z-0">
        {/* Ambient gradient orbs — every page gets these */}
        <div className="pointer-events-none absolute top-[-8%] left-[-5%] w-[55%] h-[55%] bg-primary/5 dark:bg-primary/10 blur-[130px] rounded-full -z-10" aria-hidden />
        <div className="pointer-events-none absolute bottom-[-8%] right-[-5%] w-[45%] h-[45%] bg-primary/3 dark:bg-primary/5 blur-[110px] rounded-full -z-10" aria-hidden />
        {children}
      </main>

      {/* ── Persistent global chat panel ────────────────────────────────── */}
      <GlobalChatPanel />

      {/* ── Global command palette (Ctrl+K / Cmd+K) ─────────────────────── */}
      <CommandPalette />

      {/* ── Bottom tab bar (mobile only) ────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-border flex items-center justify-around h-14"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabBarItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 min-w-0 flex-1",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-[10px] leading-none truncate font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
