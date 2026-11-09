import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Loader2, Users, ArrowUpRight } from "lucide-react";
import { useListCollaborators, useCreateCollaborator, useUpdateCollaborator, useDeleteCollaborator, getListCollaboratorsQueryKey } from "@workspace/api-client-react";
import type { Collaborator } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, ErrorState, EmptyState, RowsSkeleton, LiveDot } from "@/components/states";
import { errMsg, errStatus, initials, invalidateAll, num, POLL_MS } from "@/lib/mapa";

const schema = z.object({ name: z.string().trim().min(1, "Informe um nome").max(120, "Máximo de 120 caracteres") });
type Values = z.infer<typeof schema>;

function CollaboratorDialog({ open, onOpenChange, collab }: { open: boolean; onOpenChange: (o: boolean) => void; collab: Collaborator | null }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateCollaborator();
  const update = useUpdateCollaborator();
  const pending = create.isPending || update.isPending;
  const [err, setErr] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "" } });
  useEffect(() => { if (open) { setErr(null); form.reset({ name: collab?.name ?? "" }); } }, [open, collab, form]);
  const onSubmit = (v: Values) => {
    setErr(null);
    const opts = {
      onSuccess: (c: Collaborator) => { invalidateAll(qc); toast({ title: collab ? "Colaborador atualizado" : "Colaborador adicionado", description: c.name }); onOpenChange(false); },
      onError: (e: unknown) => setErr(errMsg(e)),
    };
    if (collab) update.mutate({ id: collab.id, data: { name: v.name.trim() } }, opts);
    else create.mutate({ data: { name: v.name.trim() } }, opts);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{collab ? "Renomear colaborador" : "Novo colaborador"}</DialogTitle>
          <DialogDescription>{collab ? "O novo nome aparece em todas as bipagens já lançadas por esta pessoa." : "Adicione alguém à equipe de contagem."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} autoFocus autoComplete="off" className="h-11" data-testid="input-collaborator-name" /></FormControl><FormMessage /></FormItem>
            )} />
            {err && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
            <DialogFooter><Button type="submit" disabled={pending} data-testid="button-save-collaborator">{pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{collab ? "Salvar" : "Adicionar"}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function CollaboratorsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const collabs = useListCollaborators({ query: { queryKey: getListCollaboratorsQueryKey(), refetchInterval: POLL_MS } });
  const del = useDeleteCollaborator();
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; collab: Collaborator | null }>({ open: false, collab: null });
  const [deleting, setDeleting] = useState<Collaborator | null>(null);
  const [delErr, setDelErr] = useState<{ msg: string; conflict: boolean } | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (collabs.data ?? []).filter((c) => !t || c.name.toLowerCase().includes(t));
  }, [collabs.data, q]);

  const confirmDelete = () => {
    if (!deleting) return;
    setDelErr(null);
    del.mutate({ id: deleting.id }, {
      onSuccess: () => { invalidateAll(qc); toast({ title: "Colaborador removido", description: deleting.name }); setDeleting(null); },
      onError: (e) => {
        const conflict = errStatus(e) === 409;
        setDelErr({ conflict, msg: conflict ? errMsg(e, "Este colaborador tem bipagens registradas e não pode ser excluído.") : errMsg(e) });
        if (conflict) invalidateAll(qc);
      },
    });
  };

  return (
    <>
      <PageHeader eyebrow="Equipe de contagem" title="Colaboradores"
        desc="Contagens calculadas a partir das bipagens: quantos lançamentos cada pessoa fez e quantas unidades somaram."
        actions={<Button size="lg" onClick={() => setDialog({ open: true, collab: null })} data-testid="button-new-collaborator"><Plus className="h-4 w-4 mr-2" />Novo colaborador</Button>} />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-4">
        <div className="relative sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome" className="pl-9 h-10" data-testid="input-search-collaborators" />
        </div>
        <LiveDot fetching={collabs.isFetching} />
      </div>

      {collabs.isLoading ? <RowsSkeleton rows={10} /> : collabs.isError ? <ErrorState error={collabs.error} onRetry={() => collabs.refetch()} /> :
        list.length === 0 ? (
          <EmptyState icon={<Users className="h-4 w-4" />} title={q ? "Ninguém com esse nome" : "Nenhum colaborador"}
            action={q ? <Button variant="outline" onClick={() => setQ("")}>Limpar busca</Button> : <Button onClick={() => setDialog({ open: true, collab: null })}>Adicionar colaborador</Button>}>
            {q ? "Tente outra parte do nome." : "Cadastre quem faz as contagens para começar a lançar bipagens."}
          </EmptyState>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c, i) => (
              <article key={c.id} className="rise group rounded-xl border bg-card p-4 hover:border-primary/40 transition-colors" style={{ animationDelay: `${i * 25}ms` }} data-testid={`card-collaborator-${c.id}`}>
                <div className="flex items-center gap-3">
                  <span className="h-10 w-10 rounded-lg bg-primary text-primary-foreground grid place-items-center font-mono text-xs font-semibold">{initials(c.name)}</span>
                  <h3 className="flex-1 font-semibold truncate" data-testid={`text-collaborator-name-${c.id}`}>{c.name}</h3>
                  <div className="flex gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Renomear" onClick={() => setDialog({ open: true, collab: c })} data-testid={`button-edit-collaborator-${c.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Excluir" onClick={() => { setDelErr(null); setDeleting(c); }} data-testid={`button-delete-collaborator-${c.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-muted/70 px-3 py-2"><div className="font-mono tabular text-lg font-semibold" data-testid={`text-scan-count-${c.id}`}>{num(c.scanCount)}</div><div className="text-[11px] text-muted-foreground">bipagens</div></div>
                  <div className="rounded-md bg-muted/70 px-3 py-2"><div className="font-mono tabular text-lg font-semibold" data-testid={`text-total-quantity-${c.id}`}>{num(c.totalQuantity)}</div><div className="text-[11px] text-muted-foreground">unidades</div></div>
                </div>
                <Link href={`/bipagens?colaborador=${c.id}`} className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline" data-testid={`link-collaborator-scans-${c.id}`}>
                  {c.scanCount > 0 ? "Ver bipagens" : "Sem bipagens ainda"}<ArrowUpRight className="h-3 w-3" />
                </Link>
              </article>
            ))}
          </div>
        )}

      <CollaboratorDialog open={dialog.open} collab={dialog.collab} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} />
      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o && !del.isPending) { setDeleting(null); setDelErr(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">Excluir {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.scanCount > 0
                ? `Esta pessoa tem ${num(deleting.scanCount)} bipagens registradas. Para preservar o histórico, o sistema não permite excluir colaboradores com lançamentos.`
                : "O colaborador sai da equipe. Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {delErr && (
            <div className={`rounded-md px-3 py-2 text-sm ${delErr.conflict ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive"}`} data-testid="text-delete-collaborator-error">
              <b className="block">{delErr.conflict ? "Exclusão bloqueada" : "Falha ao excluir"}</b>{delErr.msg}
              {delErr.conflict && deleting && <Link href={`/bipagens?colaborador=${deleting.id}`} className="block mt-1 underline">Ver as bipagens desta pessoa</Link>}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending} data-testid="button-cancel-delete-collaborator">Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={del.isPending} onClick={(e) => { e.preventDefault(); confirmDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-collaborator">
              {del.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
