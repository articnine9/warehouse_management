"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Receipt,
  Search,
  Settings,
  Warehouse,
  Box,
  FolderTree,
  Tag,
  ClipboardList,
  PackageCheck,
  Users,
  LogOut,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  User as UserIcon,
  X,
  ShieldCheck,
  Building2,
  Mail,
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import NotificationBell from "./NotificationBell";

const iconMap: Record<string, React.ReactNode> = {
  Dashboard: <LayoutDashboard className="h-4 w-4" />,
  Billing: <Receipt className="h-4 w-4" />,
  Search: <Search className="h-4 w-4" />,
  Settings: <Settings className="h-4 w-4" />,
  Warehouses: <Warehouse className="h-4 w-4" />,
  Racks: <Box className="h-4 w-4" />,
  Categories: <FolderTree className="h-4 w-4" />,
  Products: <Tag className="h-4 w-4" />,
  Inventory: <ClipboardList className="h-4 w-4" />,
  "Employee Issue": <PackageCheck className="h-4 w-4" />,
  Staff: <Users className="h-4 w-4" />,
  "Staff Management": <Users className="h-4 w-4" />,
  "My Warehouse": <Warehouse className="h-4 w-4" />,
  Warehouse: <Warehouse className="h-4 w-4" />,
  Home: <LayoutDashboard className="h-4 w-4" />,
  Profile: <UserIcon className="h-4 w-4" />,
};

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  if (loading || !user) {
    return null;
  }

  const isSettingsActive = [
    "/warehouses",
    "/racks",
    "/categories",
    "/products",
    "/inventory",
  ].some((p) => pathname === p);

  const menuItems =
    user.role === "ADMIN"
      ? [
          { name: "Dashboard", path: "/dashboard" },
           { name: "Inventory", path: "/inventory" },
          { name: "Employee Issue", path: "/employee-issues" },
          // { name: "Billing", path: "/billing" },
          // { name: "Search", path: "/search" },
              { name: "Staff Management", path: "/staff" },
          {
            name: "Settings",
            children: [
              { name: "Warehouses", path: "/warehouses" },
              { name: "Racks", path: "/racks" },
              { name: "Categories", path: "/categories" },
              { name: "Products", path: "/products" },
              { name: "Inventory", path: "/inventory" },
            ],
          },
      
        ]
      : [
          { name: "Dashboard", path: "/dashboard" },
          { name: "Billing", path: "/billing" },
          { name: "Employee Issue", path: "/employee-issues" },
          { name: "Search", path: "/search" },
          { name: "My Warehouse", path: "/staff" },
        ];

  const mobileItems =
    user.role === "ADMIN"
      ? [
          { name: "Home", path: "/dashboard" },
          { name: "Employee Issue", path: "/employee-issues" },
          { name: "Billing", path: "/billing" },
          { name: "Search", path: "/search" },
          { name: "Settings", path: "/warehouses" },
          { name: "Staff", path: "/staff" },
        ]
      : [
          { name: "Home", path: "/dashboard" },
          { name: "Billing", path: "/billing" },
          { name: "Employee Issue", path: "/employee-issues" },
          { name: "Search", path: "/search" },
          { name: "Warehouse", path: "/staff" },
        ];

  return (
    <>
      {/* ─── MOBILE TOP APP BAR ─── */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-2.5 md:hidden print:hidden shadow-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-sm shadow-xs">
            W
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 leading-tight">Warehouse</h1>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
              {user.role}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 active:scale-95 shadow-xs"
            title="Profile"
          >
            {user.name.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      {/* ─── MOBILE BOTTOM NAV (Smooth Scrollable) ─── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden print:hidden shadow-lg">
        <div className="flex items-center gap-1 overflow-x-auto px-2 py-1 scrollbar-none">
          {mobileItems.map((item) => {
            const isActive =
              item.path === "/warehouses"
                ? isSettingsActive
                : pathname === item.path;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={`relative flex min-w-[64px] flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-colors shrink-0 ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {iconMap[item.name] || <LayoutDashboard className="h-4 w-4" />}
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ─── MOBILE PROFILE MODAL / BOTTOM SHEET ─── */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4 md:hidden">
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">Account Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="mt-4 space-y-4">
              {/* User Avatar & Name */}
              <div className="flex items-center gap-3.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white shadow-sm">
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800 text-base truncate">{user.name}</p>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold shrink-0 ${
                    user.role === "ADMIN"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {user.role}
                </span>
              </div>

              {/* Warehouse Details if assigned */}
              {user.warehouse ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                    <Building2 className="h-3.5 w-3.5 text-blue-600" />
                    <span>Assigned Warehouse</span>
                  </div>
                  <p className="mt-1 font-bold text-slate-800 text-sm">
                    {user.warehouse.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Code: <b className="text-slate-700">{user.warehouse.code}</b>
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-500">
                  <span>Role: </span>
                  <b className="text-slate-700">All Warehouses Administrator</b>
                </div>
              )}

              {/* Status */}
              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>Account Status:</span>
                <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>

              {/* Logout button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setProfileModalOpen(false);
                    void logout();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100 active:scale-[0.98]"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Log Out of Account</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DESKTOP SIDEBAR ─── */}
      <aside
        className={`hidden md:flex min-h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300 print:hidden ${
          isOpen ? "w-64" : "w-[72px]"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          {isOpen && (
            <div>
              <h1 className="text-lg font-bold text-slate-800">Warehouse</h1>
              <p className="mt-0.5 text-xs font-medium text-blue-600">
                {user.role}
              </p>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            {isOpen && <NotificationBell />}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              {isOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* User info */}
        <div className="border-b border-slate-100 px-4 py-3">
          {isOpen ? (
            <>
              <p className="font-semibold text-slate-800">{user.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
              {user.warehouse && (
                <p className="mt-1.5 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                  {user.warehouse.name} ({user.warehouse.code})
                </p>
              )}
            </>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="mt-3 flex-1 space-y-1 px-3">
          {menuItems.map((item) => {
            const isActive = item.path
              ? pathname === item.path
              : isSettingsActive;
            const hasChildren = "children" in item && item.children;

            return (
              <div key={item.path || item.name}>
                <Link
                  href={hasChildren ? "#" : item.path}
                  onClick={
                    hasChildren
                      ? () => setSettingsOpen(!settingsOpen)
                      : undefined
                  }
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  {iconMap[item.name] || <Settings className="h-4 w-4" />}
                  {isOpen && (
                    <span className="flex-1 flex items-center justify-between">
                      <span>{item.name}</span>
                    </span>
                  )}
                  {isOpen && hasChildren && (
                    <span className="text-xs text-slate-400">
                      {settingsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </span>
                  )}
                </Link>
                {hasChildren && settingsOpen && isOpen && (
                  <div className="ml-5 mt-1 space-y-0.5 border-l-2 border-slate-100 pl-3">
                    {item.children.map((child) => {
                      const childActive = pathname === child.path;

                      return (
                        <Link
                          key={child.path}
                          href={child.path}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                            childActive
                              ? "bg-blue-50 text-blue-700 font-medium"
                              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                          }`}
                        >
                          {iconMap[child.name] || <Settings className="h-4 w-4" />}
                          <span>{child.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-slate-100 px-3 py-3">
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            {isOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
