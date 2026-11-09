import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { keepPreviousData } from "@tanstack/react-query";
import { Plus, Search, X, ChevronLeft, ChevronRight, Pencil, Trash2, ScanBarcode, CalendarRange } from "lucide-react";
import { useListScans, useListCollaborators, getListScansQueryKey, getListCollaboratorsQueryKey } from "@workspace/api-client-react";
import type { Scan, ListScansParams } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, ErrorState, EmptyState, RowsSkeleton, LiveDot } from "@/components/states";
import { ScanFormDialog, DeleteScanDialog, ScanDetailDialog } from "@/components/scan-dialogs";
import { fmtDateTime, num, relative, POLL_MS, todaySP } from "@/lib/mapa";

const LIMIT = 25;

export default function ScansPage() {
  const search = useSearch();
  const init = useMemo(() => new URLSearchParams(search), [search]);
  const [qInput, setQInput] = useState(init.get("q") ?? "");
  const [q, setQ] = useState(init.get("q") ?? "");
  const [collab, setCollab] = useState(init.get("colaborador") ?? "all");
  const [dateFrom, setDateFrom] = useState(init.get("de") ?? "");
  const [dateTo, setDateTo] = useState(init.get("ate") ?? "");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setQInput(init.get("q") ?? ""); setQ(init.get("q") ?? "");
    setCollab(init.get("colaborador") ?? "all"); setDateFrom(init.get("de") ?? ""); setDateTo(init.get("ate") ?? ""); setPage(1);
  }, [init]);

  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Scan | null>(null);
  const [deleting, setDeleting] = useState<Scan | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const rangeInvalid = !!dateFrom && !!dateTo && dateFrom > dateTo;
  const params: ListScansParams = {
    page, limit: LIMIT,
    ...(q ? { q } : {}),
    ...(collab !== "all" ? { collaboratorId: Number(collab) } : {}),
    ...(dateFrom && !rangeInvalid ? { dateFrom } : {}),
    ...(dateTo && !rangeInvalid ? { dateTo } : {}),
  };
  const scans = useListScans(params, { query: { queryKey: getListScansQueryKey(params), refetchInterval: POLL_MS, placeholderData: keepPreviousData } });
  const collabs = useListCollaborators({ query: { queryKey: getListCollaboratorsQueryKey(), refetchInterval: POLL_MS } });

  const data = scans.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.limit || LIMIT))) : 1;
  useEffect(() => { if (data && page > totalPages) setPage(totalPages); }, [data, page, totalPages]);
  const filtered = !!q || collab !== "all" || !!dateFrom || !!dateTo;
  const clear = () => { setQInput(""); setQ(""); setCollab("all"); setDateFrom(""); setDateTo(""); setPage(1); };
  const pageQty = (data?.items ?? []).reduce((a, s) => a + s.quantity, 0);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (s: Scan) => { setDetailId(null); setEditing(s); setFormOpen(true); };
  const openDelete = (s: Scan) => { setDetailId(null); setDeleting(s); };

  return (
    <>
      <PageHeader eyebrow="Registro de contagem" title="Bipagens"
        desc="Cada linha é um lançamento: quem bipou, qual produto, quantas unidades e quando."
        actions={<Button size="lg" onClick={openNew} data-testid="button-new-scan"><Plus className="h-4 w-4 mr-2" />Nova bipagem</Button>} />

      <section className="rise rounded-xl border bg-card p-3 md:p-4 mb-4 grid gap-3 md:grid-cols-[1.4fr_1fr_auto]" style={{ animationDelay: "60ms" }}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Buscar código do produto ou colaborador" className="pl-9 h-10 font-mono text-sm" data-testid="input-search-scans" />
          {qInput && <button onClick={() => setQInput("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground" aria-label="Limpar busca" data-testid="button-clear-search"><X className="h-4 w-4" /></button>}
        </div>
        <Select value={collab} onValueChange={(v) => { setCollab(v); setPage(1); }}>
          <SelectTrigger className="h-10" data-testid="select-filter-collaborator"><SelectValue placeholder="Colaborador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os colaboradores</SelectItem>
            {(collabs.data ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0 hidden md:block" />
          <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="h-10 font-mono text-xs" aria-label="De" data-testid="input-date-from" />
          <span className="text-muted-foreground text-xs">até</span>
          <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="h-10 font-mono text-xs" aria-label="Até" data-testid="input-date-to" />
        </div>
        <div className="md:col-span-3 flex flex-wrap items-center gap-2 text-xs">
          <button className="rounded-full border px-2.5 py-1 hover:bg-muted transition-colors" onClick={() => { const t = todaySP(); setDateFrom(t); setDateTo(t); setPage(1); }} data-testid="button-filter-today">Hoje</button>
          {filtered && <button className="rounded-full px-2.5 py-1 text-sidebar-primary hover:bg-accent transition-colors" onClick={clear} data-testid="button-clear-filters">Limpar filtros</button>}
          {rangeInvalid && <span className="text-destructive">A data inicial é posterior à final — período ignorado.</span>}
          <span className="ml-auto text-muted-foreground">Período inclusivo, horário de Brasília</span>
        </div>
      </section>

      <div className="flex items-center justify-between mb-2 px-1 text-xs text-muted-foreground">
        <span data-testid="text-scan-total">{data ? <><b className="text-foreground tabular">{num(data.total)}</b> {data.total === 1 ? "bipagem" : "bipagens"}{data.items.length > 0 && <> · {num(pageQty)} un. nesta página</>}</> : "\u00a0"}</span>
        <LiveDot fetching={scans.isFetching} />
      </div>

      {scans.isLoading ? <RowsSkeleton rows={8} /> : scans.isError ? <ErrorState error={scans.error} onRetry={() => scans.refetch()} /> :
        !data || data.items.length === 0 ? (
          filtered ? (
            <EmptyState icon={<Search className="h-4 w-4" />} title="Nada com esses filtros" action={<Button variant="outline" onClick={clear}>Limpar filtros</Button>}>
              Nenhuma bipagem corresponde à busca, ao colaborador ou ao período escolhido.
            </EmptyState>
          ) : (
            <EmptyState icon={<ScanBarcode className="h-4 w-4" />} title="Nenhuma bipagem registrada ainda"
              action={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Registrar a primeira</Button>}>
              A planilha foi importada com 10 colaboradores e sem bipagens. Os novos lançamentos criados aqui também são enviados à aba “BIPAGENS DO APP”.
            </EmptyState>
          )
        ) : (
          <div className={`transition-opacity ${scans.isPlaceholderData ? "opacity-60" : ""}`}>
            <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr><th className="text-left font-medium px-4 py-2.5">Produto</th><th className="text-right font-medium px-4">Qtd.</th><th className="text-left font-medium px-4">Colaborador</th><th className="text-left font-medium px-4">Bipado em</th><th className="w-24" /></tr>
                </thead>
                <tbody>
                  {data.items.map((s) => (
                    <tr key={s.id} onClick={() => setDetailId(s.id)} className="group border-t cursor-pointer hover:bg-accent/40 transition-colors" data-testid={`row-scan-${s.id}`}>
                      <td className="px-4 py-3 font-mono font-medium">{s.productId}</td>
                      <td className="px-4 text-right font-mono tabular font-semibold">{num(s.quantity)}</td>
                      <td className="px-4">{s.collaboratorName}</td>
                      <td className="px-4 font-mono text-xs text-muted-foreground">{fmtDateTime(s.scannedAt)}<span className="ml-2 opacity-70">{relative(s.scannedAt)}</span></td>
                      <td className="px-2 text-right">
                        <div className="flex justify-end gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" onClick={(e) => { e.stopPropagation(); openEdit(s); }} data-testid={`button-edit-scan-${s.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Excluir" onClick={(e) => { e.stopPropagation(); openDelete(s); }} data-testid={`button-delete-scan-${s.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="md:hidden space-y-2">
              {data.items.map((s) => (
                <li key={s.id}>
                  <button onClick={() => setDetailId(s.id)} className="w-full text-left rounded-xl border bg-card p-3.5 active:scale-[.99] transition-transform" data-testid={`card-scan-${s.id}`}>
                    <div className="flex justify-between gap-3"><span className="font-mono font-semibold break-all">{s.productId}</span><span className="font-mono tabular font-bold">{num(s.quantity)}<span className="text-xs text-muted-foreground font-normal"> un.</span></span></div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{s.collaboratorName}</span><span className="font-mono">{fmtDateTime(s.scannedAt)}</span></div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-muted-foreground font-mono" data-testid="text-page">Página {data.page} de {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="button-prev-page"><ChevronLeft className="h-4 w-4 mr-1" />Anterior</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} data-testid="button-next-page">Próxima<ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          </div>
        )}

      <ScanFormDialog open={formOpen} onOpenChange={setFormOpen} scan={editing} />
      <DeleteScanDialog scan={deleting} onOpenChange={(o) => !o && setDeleting(null)} />
      <ScanDetailDialog id={detailId} onOpenChange={(o) => !o && setDetailId(null)} onEdit={openEdit} onDelete={openDelete} />
    </>
  );
}
