import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errMsg } from "@/lib/mapa";

export function PageHeader({ eyebrow, title, desc, actions }: { eyebrow: string; title: string; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="rise flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-7">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sidebar-primary mb-2">{eyebrow}</p>
        <h1 className="font-display text-3xl md:text-[2.6rem] font-extrabold leading-none">{title}</h1>
        {desc && <p className="mt-3 max-w-xl text-sm text-muted-foreground">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function ErrorState({ error, onRetry, title = "Não foi possível carregar" }: { error: unknown; onRetry: () => void; title?: string }) {
  return (
    <div data-testid="state-error" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 flex flex-col sm:flex-row gap-4 sm:items-center">
      <div className="h-10 w-10 shrink-0 rounded-lg bg-destructive/10 text-destructive grid place-items-center"><AlertTriangle className="h-5 w-5" /></div>
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{errMsg(error)}</p>
      </div>
      <Button variant="outline" onClick={onRetry} data-testid="button-retry"><RotateCw className="h-4 w-4 mr-2" />Tentar de novo</Button>
    </div>
  );
}

export function EmptyState({ title, children, action, icon }: { title: string; children: ReactNode; action?: ReactNode; icon: ReactNode }) {
  return (
    <div data-testid="state-empty" className="rise relative overflow-hidden rounded-xl border border-dashed border-input bg-card/60 px-6 py-12 text-center">
      <div className="relative mx-auto mb-5 h-16 w-24 text-foreground/15">
        <div className="barcode-strip absolute inset-0 rounded-sm" />
        <div className="laser absolute left-[-8px] right-[-8px] top-2 h-[2px] bg-sidebar-primary shadow-[0_0_0_1px_hsl(var(--sidebar-primary)/.2)]" />
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-8 w-8 rounded-full bg-card border grid place-items-center text-primary">{icon}</div>
      </div>
      <h3 className="font-display text-xl font-bold mt-4">{title}</h3>
      <div className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{children}</div>
      {action && <div className="mt-5 flex justify-center gap-2">{action}</div>}
    </div>
  );
}

export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" data-testid="state-loading">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-12 w-full" style={{ opacity: 1 - i * 0.12 }} />)}
    </div>
  );
}

export function LiveDot({ fetching }: { fetching: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground" data-testid="status-live">
      <span className={`h-1.5 w-1.5 rounded-full ${fetching ? "bg-sidebar-primary pulse-dot" : "bg-chart-3"}`} />
      {fetching ? "atualizando" : "atualizado a cada 15 s"}
    </span>
  );
}
