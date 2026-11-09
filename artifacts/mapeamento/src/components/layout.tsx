import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutGrid, ScanBarcode, Users, Package, Info } from "lucide-react";

const NAV = [
  { href: "/", label: "Visão geral", icon: LayoutGrid },
  { href: "/bipagens", label: "Bipagens", icon: ScanBarcode },
  { href: "/colaboradores", label: "Colaboradores", icon: Users },
  { href: "/produtos", label: "Produtos", icon: Package },
];

export function Layout({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const active = (h: string) => (h === "/" ? loc === "/" : loc.startsWith(h));
  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[232px_1fr]">
      <aside className="hidden md:flex flex-col bg-sidebar text-sidebar-foreground sticky top-0 h-[100dvh] px-4 py-6">
        <Link href="/" className="flex items-center gap-3 px-2 mb-9" data-testid="link-home">
          <div className="relative h-9 w-9 rounded-md bg-sidebar-primary grid place-items-center overflow-hidden">
            <div className="barcode-strip absolute inset-x-1.5 inset-y-2 text-sidebar-primary-foreground/90" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-extrabold text-lg">Mapeamento</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/55">Geral</div>
          </div>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} data-testid={`link-nav-${href.slice(1) || "inicio"}`}
              className={`group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${active(href) ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}`}>
              {active(href) && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-sidebar-primary" />}
              <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />{label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-lg border border-sidebar-border p-3 text-[12px] text-sidebar-foreground/65 leading-relaxed">
          <div className="flex items-center gap-1.5 text-sidebar-foreground font-medium mb-1"><Info className="h-3.5 w-3.5" />Fonte importada</div>
          A planilha original foi importada uma única vez. Daqui em diante, este registro é a fonte oficial — não há sincronização com o Google Sheets.
        </div>
      </aside>

      <header className="md:hidden sticky top-0 z-40 bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center gap-2">
        <div className="h-7 w-7 rounded bg-sidebar-primary relative overflow-hidden"><div className="barcode-strip absolute inset-1.5 text-sidebar-primary-foreground/90" /></div>
        <span className="font-display font-extrabold">Mapeamento Geral</span>
      </header>

      <main className="px-4 py-6 pb-28 md:px-10 md:py-10 md:pb-10 max-w-[1240px] w-full">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground grid grid-cols-4 border-t border-sidebar-border pb-[env(safe-area-inset-bottom)]">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} data-testid={`link-tab-${href.slice(1) || "inicio"}`}
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active(href) ? "text-sidebar-primary" : "text-sidebar-foreground/65"}`}>
            <Icon className="h-5 w-5" />{label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
