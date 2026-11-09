import { useState } from "react";
import { Link } from "wouter";
import { Plus, ArrowRight, ScanBarcode, Info } from "lucide-react";
import { useGetSummary, useListScans, useListCollaborators, getGetSummaryQueryKey, getListScansQueryKey, getListCollaboratorsQueryKey } from "@workspace/api-client-react";
import type { Scan } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, ErrorState, EmptyState, RowsSkeleton, LiveDot } from "@/components/states";
import { ScanFormDialog, DeleteScanDialog, ScanDetailDialog } from "@/components/scan-dialogs";
import { num, relative, fmtDateTime, POLL_MS, initials } from "@/lib/mapa";

const RECENT = { page: 1, limit: 8 };

export default function OverviewPage() {
  const summary = useGetSummary({ query: { queryKey: getGetSummaryQueryKey(), refetchInterval: POLL_MS } });
  const recent = useListScans(RECENT, { query: { queryKey: getListScansQueryKey(RECENT), refetchInterval: POLL_MS } });
  const collabs = useListCollaborators({ query: { queryKey: getListCollaboratorsQueryKey(), refetchInterval: POLL_MS } });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Scan | null>(null);
  const [deleting, setDeleting] = useState<Scan | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const s = summary.data;

  const stats = [
    { k: "Bipagens", v: s?.totalScans, note: "lançamentos registrados", id: "total-scans" },
    { k: "Unidades", v: s?.totalQuantity, note: "soma das quantidades", id: "total-quantity" },
    { k: "Produtos", v: s?.uniqueProducts, note: "códigos distintos", id: "unique-products" },
    { k: "Colaboradores", v: s?.collaborators, note: "na equipe", id: "collaborators" },
  ];
  const ranked = [...(collabs.data ?? [])].sort((a, b) => b.totalQuantity - a.totalQuantity || b.scanCount - a.scanCount);
  const maxQty = Math.max(1, ...ranked.map((c) => c.totalQuantity));

  return (
    <>
      <PageHeader eyebrow="Turno em andamento" title="Visão geral"
        desc={<>Um único livro de registro para toda a equipe, no lugar das dez abas da planilha.</>}
        actions={<Button size="lg" onClick={() => { setEditing(null); setFormOpen(true); }} data-testid="button-new-scan"><Plus className="h-4 w-4 mr-2" />Nova bipagem</Button>} />

      {summary.isError ? <ErrorState error={summary.error} onRetry={() => summary.refetch()} title="Não foi possível carregar os totais" /> : (
        <section className="grid gap-3 lg:grid-cols-[1.15fr_2fr] mb-8">
          <div className="rise relative overflow-hidden rounded-xl bg-sidebar text-sidebar-foreground p-6">
            <div className="barcode-strip absolute -right-4 bottom-0 h-24 w-56 text-sidebar-foreground/[.06]" />
            <div className="flex items-center justify-between"><p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sidebar-primary">Hoje · Brasília</p><LiveDot fetching={summary.isFetching} /></div>
            <div className="mt-5 flex items-end gap-8">
              <div><div className="font-display text-6xl font-extrabold tabular leading-none" data-testid="text-today-scans">{s ? num(s.todayScans) : <Skeleton className="h-14 w-20 bg-sidebar-accent" />}</div><div className="mt-2 text-sm text-sidebar-foreground/65">bipagens</div></div>
              <div><div className="font-display text-4xl font-bold tabular leading-none text-sidebar-foreground/85" data-testid="text-today-quantity">{s ? num(s.todayQuantity) : <Skeleton className="h-10 w-16 bg-sidebar-accent" />}</div><div className="mt-2 text-sm text-sidebar-foreground/65">unidades</div></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stats.map((st, i) => (
              <div key={st.k} className="rise rounded-xl border bg-card p-4 md:p-5" style={{ animationDelay: `${60 + i * 50}ms` }}>
                <p className="text-xs text-muted-foreground">{st.k}</p>
                <div className="font-display text-3xl md:text-4xl font-bold tabular mt-1" data-testid={`text-${st.id}`}>{s ? num(st.v) : <Skeleton className="h-9 w-16" />}</div>
                <p className="text-[11px] text-muted-foreground mt-1">{st.note}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-xl font-bold">Bipagens recentes</h2>
            <Link href="/bipagens" className="text-sm text-primary inline-flex items-center gap-1 hover:gap-2 transition-all" data-testid="link-all-scans">Ver todas<ArrowRight className="h-4 w-4" /></Link>
          </div>
          {recent.isLoading ? <RowsSkeleton rows={5} /> : recent.isError ? <ErrorState error={recent.error} onRetry={() => recent.refetch()} /> :
            !recent.data || recent.data.items.length === 0 ? (
              <EmptyState icon={<ScanBarcode className="h-4 w-4" />} title="O registro está em branco"
                action={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-2" />Registrar a primeira bipagem</Button>}>
                Nenhum produto foi bipado até agora. Quando a equipe começar a contar, os lançamentos mais novos aparecem aqui primeiro.
              </EmptyState>
            ) : (
              <ol className="rounded-xl border bg-card divide-y">
                {recent.data.items.map((sc, i) => (
                  <li key={sc.id} className="rise" style={{ animationDelay: `${i * 30}ms` }}>
                    <button onClick={() => setDetailId(sc.id)} className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-accent/40 transition-colors" data-testid={`row-recent-scan-${sc.id}`}>
                      <span className="font-mono font-medium flex-1 truncate">{sc.productId}</span>
                      <span className="hidden sm:block text-sm text-muted-foreground truncate max-w-[30%]">{sc.collaboratorName}</span>
                      <span className="font-mono tabular font-semibold w-14 text-right">{num(sc.quantity)}</span>
                      <span className="font-mono text-[11px] text-muted-foreground w-16 text-right" title={fmtDateTime(sc.scannedAt)}>{relative(sc.scannedAt)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-xl font-bold">Equipe</h2>
            <Link href="/colaboradores" className="text-sm text-primary inline-flex items-center gap-1 hover:gap-2 transition-all" data-testid="link-collaborators">Gerenciar<ArrowRight className="h-4 w-4" /></Link>
          </div>
          {collabs.isLoading ? <RowsSkeleton rows={5} /> : collabs.isError ? <ErrorState error={collabs.error} onRetry={() => collabs.refetch()} /> : (
            <ul className="rounded-xl border bg-card p-2">
              {ranked.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nenhum colaborador cadastrado.</li>}
              {ranked.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-2 py-2" data-testid={`row-team-${c.id}`}>
                  <span className="h-7 w-7 rounded-md bg-secondary grid place-items-center font-mono text-[10px] font-semibold">{initials(c.name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm"><span className="truncate">{c.name}</span><span className="font-mono tabular text-xs text-muted-foreground">{num(c.scanCount)} bip. · {num(c.totalQuantity)} un.</span></div>
                    <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary origin-left transition-transform duration-700" style={{ transform: `scaleX(${c.totalQuantity / maxQty})` }} /></div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 rounded-xl border border-dashed p-4 text-xs text-muted-foreground leading-relaxed flex gap-3">
            <Info className="h-4 w-4 shrink-0 text-sidebar-primary mt-0.5" />
            <p>Os dados vieram de uma importação única da planilha original (10 colaboradores, nenhuma bipagem). Não existe sincronização com o Google Sheets: o que é lançado aqui fica só aqui.</p>
          </div>
        </section>
      </div>

      <ScanFormDialog open={formOpen} onOpenChange={setFormOpen} scan={editing} />
      <DeleteScanDialog scan={deleting} onOpenChange={(o) => !o && setDeleting(null)} />
      <ScanDetailDialog id={detailId} onOpenChange={(o) => !o && setDetailId(null)}
        onEdit={(sc) => { setDetailId(null); setEditing(sc); setFormOpen(true); }} onDelete={(sc) => { setDetailId(null); setDeleting(sc); }} />
    </>
  );
}
