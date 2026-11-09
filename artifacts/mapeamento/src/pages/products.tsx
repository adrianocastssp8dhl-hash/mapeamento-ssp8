import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, Package, ArrowUpRight, ArrowDownUp } from "lucide-react";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, ErrorState, EmptyState, RowsSkeleton, LiveDot } from "@/components/states";
import { fmtDateTime, num, relative, POLL_MS } from "@/lib/mapa";

type SortKey = "recent" | "quantity" | "scans" | "code";

export default function ProductsPage() {
  const products = useListProducts({ query: { queryKey: getListProductsQueryKey(), refetchInterval: POLL_MS } });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const all = products.data;
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const l = (all ?? []).filter((p) => !t || p.productId.toLowerCase().includes(t));
    const by: Record<SortKey, (a: typeof l[number], b: typeof l[number]) => number> = {
      recent: (a, b) => b.lastScannedAt.localeCompare(a.lastScannedAt),
      quantity: (a, b) => b.totalQuantity - a.totalQuantity,
      scans: (a, b) => b.scanCount - a.scanCount,
      code: (a, b) => a.productId.localeCompare(b.productId, "pt-BR", { numeric: true }),
    };
    return [...l].sort(by[sort]);
  }, [all, q, sort]);

  return (
    <>
      <PageHeader eyebrow="Visão consolidada" title="Produtos"
        desc="Gerado automaticamente a partir das bipagens: cada código aparece uma vez, somando todas as contagens. Para corrigir um total, edite as bipagens do produto." />
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-4">
        <div className="relative sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código do produto" className="pl-9 h-10 font-mono text-sm" data-testid="input-search-products" />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-10 sm:w-52" data-testid="select-sort-products"><ArrowDownUp className="h-3.5 w-3.5 mr-2 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Bipados mais recentemente</SelectItem>
            <SelectItem value="quantity">Mais unidades</SelectItem>
            <SelectItem value="scans">Mais bipagens</SelectItem>
            <SelectItem value="code">Código (A–Z)</SelectItem>
          </SelectContent>
        </Select>
        <div className="sm:ml-auto flex items-center gap-4">
          {all && <span className="text-xs text-muted-foreground" data-testid="text-product-count"><b className="text-foreground tabular">{num(list.length)}</b> de {num(all.length)} produtos</span>}
          <LiveDot fetching={products.isFetching} />
        </div>
      </div>

      {products.isLoading ? <RowsSkeleton rows={8} /> : products.isError ? <ErrorState error={products.error} onRetry={() => products.refetch()} /> :
        list.length === 0 ? (
          q && (all?.length ?? 0) > 0 ? (
            <EmptyState icon={<Search className="h-4 w-4" />} title="Nenhum código encontrado" action={<Button variant="outline" onClick={() => setQ("")}>Limpar busca</Button>}>
              Nenhum produto bipado contém "<span className="font-mono">{q}</span>".
            </EmptyState>
          ) : (
            <EmptyState icon={<Package className="h-4 w-4" />} title="Nenhum produto ainda"
              action={<Button asChild><Link href="/bipagens">Ir para bipagens</Link></Button>}>
              Produtos surgem aqui assim que forem bipados. A planilha importada não trazia nenhum lançamento, então a lista começa vazia.
            </EmptyState>
          )
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="hidden md:grid grid-cols-[1.6fr_.8fr_.8fr_.8fr_1.2fr_auto] gap-4 bg-muted/60 px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>Código</span><span className="text-right">Unidades</span><span className="text-right">Bipagens</span><span className="text-right">Colab.</span><span>Última bipagem</span><span className="w-5" />
            </div>
            <ul className="divide-y">
              {list.map((p) => (
                <li key={p.productId}>
                  <Link href={`/bipagens?q=${encodeURIComponent(p.productId)}`} className="group grid grid-cols-2 md:grid-cols-[1.6fr_.8fr_.8fr_.8fr_1.2fr_auto] gap-x-4 gap-y-1 px-4 py-3 items-center hover:bg-accent/40 transition-colors" data-testid={`row-product-${p.productId}`}>
                    <span className="font-mono font-semibold break-all col-span-2 md:col-span-1">{p.productId}</span>
                    <span className="font-mono tabular md:text-right text-sm"><b>{num(p.totalQuantity)}</b><span className="md:hidden text-muted-foreground"> un.</span></span>
                    <span className="font-mono tabular text-right text-sm text-muted-foreground">{num(p.scanCount)}<span className="md:hidden"> bip.</span></span>
                    <span className="hidden md:block font-mono tabular text-right text-sm text-muted-foreground">{num(p.collaboratorCount)}</span>
                    <span className="hidden md:block font-mono text-xs text-muted-foreground">{fmtDateTime(p.lastScannedAt)} <span className="opacity-70">{relative(p.lastScannedAt)}</span></span>
                    <ArrowUpRight className="hidden md:block h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
    </>
  );
}
