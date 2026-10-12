"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import {
  Sun,
  Inbox,
  CircleCheckBig,
  SquareKanban,
  CalendarDays,
  LibraryBig,
  Moon,
  Search,
  Settings,
  LogOut,
  RotateCcw,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { ThemeQuickToggle } from "./theme";
import { SidebarPlant } from "@/components/ui/botanical";

/** Las seis secciones principales (Bloque 2). Explorar vive ahora dentro de
 *  Biblioteca; Buscar, Sueño, Revisiones y Ajustes son herramientas secundarias. */
const NAV = [
  { href: "/", label: "Hoy", icon: Sun },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/tareas", label: "Tareas", icon: CircleCheckBig },
  { href: "/proyectos", label: "Proyectos", icon: SquareKanban },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/biblioteca", label: "Biblioteca", icon: LibraryBig },
];

/** Contador del Inbox: discreto, tope «99+». */
function InboxCount({ n, className = "" }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span
      className={`inline-flex min-w-[1.15rem] h-[1.15rem] items-center justify-center rounded-full bg-forest px-1 text-[10px] font-semibold leading-none text-cream tabular-nums ${className}`}
      aria-label={`${n} sin procesar`}
      data-testid="inbox-count"
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

function sectionOf(pathname: string): string | null {
  if (pathname === "/") return "/";
  for (const n of NAV) {
    if (n.href !== "/" && pathname.startsWith(n.href)) return n.href;
  }
  return null;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Recuerda la última URL visitada de cada sección (filtros incluidos) durante la sesión.
 *  El href renderizado es el base (estable para SSR); al hacer clic se redirige a la URL
 *  recordada si existe. */
function useSectionMemory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const section = sectionOf(pathname);
    if (!section) return;
    // `abrir` (detalle de tarea) es estado transitorio: no se recuerda como filtro.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("abrir");
    const full = params.size ? `${pathname}?${params.toString()}` : pathname;
    try {
      sessionStorage.setItem(`nav:${section}`, full);
    } catch {}
  }, [pathname, searchParams]);

  const onNavClick = (base: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return; // respetar abrir en pestaña nueva
    try {
      const saved = sessionStorage.getItem(`nav:${base}`);
      if (saved && saved !== base && !isActive(pathname, base)) {
        e.preventDefault();
        router.push(saved);
      }
    } catch {}
  };

  return { pathname, onNavClick };
}

function SecondaryLink({
  href,
  icon: Icon,
  label,
  pathname,
  testid,
  children,
}: {
  href: string;
  icon: typeof Search;
  label: string;
  pathname: string;
  testid?: string;
  children?: React.ReactNode;
}) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      data-testid={testid}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
        active ? "nav-active bg-sage-soft text-forest-deep" : "text-stone hover:bg-beige"
      }`}
    >
      <Icon size={17} aria-hidden /> {label}
      {children}
    </Link>
  );
}

function SidebarInner({ inboxCount }: { inboxCount: number }) {
  const { pathname, onNavClick } = useSectionMemory();
  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-sand sidebar-surface px-4 py-6 sticky top-0 h-dvh">
      <div className="flex items-center justify-between px-2 mb-8">
        <Link href="/" className="flex items-center gap-2.5">
          <LeafLogo className="h-9 w-9" />
          <span className="font-display text-xl text-forest-deep">Mafer OS</span>
        </Link>
        <ThemeQuickToggle />
      </div>
      <nav aria-label="Navegación principal" className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick(href)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "nav-active bg-sage-soft text-forest-deep"
                  : "text-stone hover:bg-beige hover:text-charcoal"
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              {label}
              {href === "/inbox" && <InboxCount n={inboxCount} className="ml-auto" />}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-1 px-2 pb-5 text-sage-deep/55">
        <SidebarPlant className="h-[4.6rem] w-16" />
        <p className="intro-italic text-[13px] text-center leading-snug !text-stone-soft">
          Pequeños pasos, con calma,
          <br />
          todos los días.
        </p>
      </div>
      {/* Herramientas secundarias: no son secciones. */}
      <div className="flex flex-col gap-1 pt-5 border-t border-sand">
        <SecondaryLink href="/buscar" icon={Search} label="Buscar" pathname={pathname}>
          <kbd className="ml-auto text-[10px] text-stone-soft border border-sand rounded px-1.5 py-0.5">⌘K</kbd>
        </SecondaryLink>
        <SecondaryLink href="/revisiones" icon={RotateCcw} label="Revisiones" pathname={pathname} testid="sidebar-revisiones-link" />
        {/* Sin parámetros, Sueño recupera la última selección del dispositivo. */}
        <SecondaryLink href="/sueno" icon={Moon} label="Sueño" pathname={pathname} testid="sidebar-sueno-link" />
        <SecondaryLink href="/ajustes" icon={Settings} label="Ajustes" pathname={pathname} />
        <form action={logoutAction}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone hover:bg-beige">
            <LogOut size={17} aria-hidden /> Salir
          </button>
        </form>
      </div>
    </aside>
  );
}

function BottomNavInner({ inboxCount }: { inboxCount: number }) {
  const { pathname, onNavClick } = useSectionMemory();
  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 sidebar-surface backdrop-blur border-t border-sand pb-safe"
    >
      <div className="grid grid-cols-6">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick(href)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium ${
                active ? "text-forest-deep" : "text-stone-soft"
              }`}
            >
              <span className={`relative rounded-full px-3 py-1 ${active ? "bg-sage-soft" : ""}`}>
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                {href === "/inbox" && <InboxCount n={inboxCount} className="absolute -top-1 right-0.5" />}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TopBarIcon({
  href,
  label,
  icon: Icon,
  pathname,
  testid,
}: {
  href: string;
  label: string;
  icon: typeof Search;
  pathname: string;
  testid: string;
}) {
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-testid={testid}
      className={`flex items-center justify-center h-9 w-9 rounded-full ${
        active ? "bg-sage-soft text-forest-deep" : "text-stone hover:bg-beige"
      }`}
    >
      <Icon size={19} aria-hidden />
    </Link>
  );
}

/** Barra superior del iPhone: tres accesos fijos (Buscar, Sueño, Ajustes).
 *  Revisiones y Salir viven en Ajustes para no saturarla.
 *  usePathname() no necesita Suspense (a diferencia de useSearchParams(), que
 *  sí usan Sidebar/BottomNav vía useSectionMemory) — se renderiza directo,
 *  sin boundary, para que nunca dependa de un fallback que pueda quedarse
 *  en null. */
export function MobileTopBar() {
  const pathname = usePathname();
  return (
    <header className="md:hidden fixed top-0 inset-x-0 z-50 sidebar-surface backdrop-blur border-b border-sand pt-safe">
      <div className="flex items-center justify-between px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2">
          <LeafLogo className="h-7 w-7" />
          <span className="font-display text-base text-forest-deep">Mafer OS</span>
        </Link>
        <div className="flex items-center gap-1">
          <TopBarIcon href="/buscar" label="Buscar" icon={Search} pathname={pathname} testid="mobile-search-link" />
          <TopBarIcon href="/sueno" label="Sueño" icon={Moon} pathname={pathname} testid="mobile-sueno-link" />
          <TopBarIcon href="/ajustes" label="Ajustes" icon={Settings} pathname={pathname} testid="mobile-settings-link" />
        </div>
      </div>
    </header>
  );
}

export function Sidebar({ inboxCount = 0 }: { inboxCount?: number }) {
  return (
    <Suspense fallback={null}>
      <SidebarInner inboxCount={inboxCount} />
    </Suspense>
  );
}

export function BottomNav({ inboxCount = 0 }: { inboxCount?: number }) {
  return (
    <Suspense fallback={null}>
      <BottomNavInner inboxCount={inboxCount} />
    </Suspense>
  );
}

export function LeafLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#dde5d6" />
      <path d="M32 50c0-14 4-24 16-30-1 14-5 25-16 30Z" fill="#45573f" />
      <path d="M32 50c0-14-4-24-16-30 1 14 5 25 16 30Z" fill="#7c9473" />
      <path d="M32 50V22" stroke="#324230" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
