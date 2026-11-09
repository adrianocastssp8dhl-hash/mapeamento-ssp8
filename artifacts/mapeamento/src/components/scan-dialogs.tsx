import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Pencil, Trash2, Clock, User, Hash, Boxes } from "lucide-react";
import {
  useCreateScan, useUpdateScan, useDeleteScan, useGetScan, useListCollaborators,
  getGetScanQueryKey, getListCollaboratorsQueryKey,
} from "@workspace/api-client-react";
import type { Scan } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { errMsg, fmtLong, invalidateAll, isoToLocalInput, localInputToIso, nowLocalInput, num, relative, POLL_MS } from "@/lib/mapa";

const BarcodeScannerDialog = lazy(async () => {
  const module = await import("./barcode-scanner-dialog");
  return { default: module.BarcodeScannerDialog };
});

const schema = z.object({
  collaboratorId: z.string().min(1, "Escolha quem bipou"),
  productId: z.string().trim().min(1, "Informe o código do produto").max(200, "Máximo de 200 caracteres"),
  quantity: z.coerce.number({ invalid_type_error: "Informe um número" }).int("Use um número inteiro").min(1, "Mínimo 1").max(1000000, "Máximo 1.000.000"),
  scannedAt: z.string().min(1, "Informe data e hora"),
});
type Values = z.infer<typeof schema>;

export function ScanFormDialog({ open, onOpenChange, scan }: { open: boolean; onOpenChange: (o: boolean) => void; scan?: Scan | null }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const collabs = useListCollaborators({ query: { queryKey: getListCollaboratorsQueryKey(), refetchInterval: POLL_MS } });
  const create = useCreateScan();
  const update = useUpdateScan();
  const pending = create.isPending || update.isPending;
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { collaboratorId: "", productId: "", quantity: 1, scannedAt: "" } });
  const handleScannedCode = useCallback((code: string) => {
    form.setValue("productId", code, { shouldDirty: true, shouldValidate: true });
  }, [form]);

  useEffect(() => {
    if (!open) return;
    setServerErr(null);
    form.reset(scan
      ? { collaboratorId: String(scan.collaboratorId), productId: scan.productId, quantity: scan.quantity, scannedAt: isoToLocalInput(scan.scannedAt) }
      : { collaboratorId: form.getValues("collaboratorId") || "", productId: "", quantity: 1, scannedAt: nowLocalInput() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scan?.id]);

  const submit = (v: Values, keepOpen = false) => {
    setServerErr(null);
    const data = { collaboratorId: Number(v.collaboratorId), productId: v.productId.trim(), quantity: v.quantity, scannedAt: localInputToIso(v.scannedAt) };
    const opts = {
      onSuccess: (s: Scan) => {
        invalidateAll(qc, s.id);
        toast({ title: scan ? "Bipagem atualizada" : "Bipagem registrada", description: `${s.productId} · ${num(s.quantity)} un. · ${s.collaboratorName}` });
        if (keepOpen) {
          form.reset({ ...v, productId: "", quantity: 1, scannedAt: nowLocalInput() });
          setTimeout(() => form.setFocus("productId"), 0);
        } else onOpenChange(false);
      },
      onError: (e: unknown) => setServerErr(errMsg(e)),
    };
    if (scan) update.mutate({ id: scan.id, data }, opts);
    else create.mutate({ data }, opts);
  };

  const list = collabs.data ?? [];
  return (
    <>
    <Dialog open={open} onOpenChange={(o) => {
      if (pending) return;
      if (!o) setScannerOpen(false);
      onOpenChange(o);
    }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{scan ? `Editar bipagem #${scan.id}` : "Nova bipagem"}</DialogTitle>
          <DialogDescription>{scan ? "Corrija o lançamento. Os totais são recalculados na hora." : "Lance o produto contado. O código é guardado exatamente como digitado, incluindo zeros à esquerda."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => submit(v))} className="space-y-4">
            <FormField control={form.control} name="collaboratorId" render={({ field }) => (
              <FormItem>
                <FormLabel>Colaborador</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={collabs.isLoading}>
                  <FormControl><SelectTrigger data-testid="select-scan-collaborator"><SelectValue placeholder={collabs.isLoading ? "Carregando…" : "Quem bipou?"} /></SelectTrigger></FormControl>
                  <SelectContent>{list.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
                {collabs.isError && <p className="text-xs text-destructive">Falha ao carregar colaboradores.</p>}
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="productId" render={({ field }) => (
              <FormItem>
                <FormLabel>Código do produto</FormLabel>
                <div className="space-y-2">
                  <FormControl><Input {...field} inputMode="text" autoComplete="off" spellCheck={false} placeholder="ex.: 48446539703" className="font-mono text-base h-11 tracking-wide" data-testid="input-scan-product" /></FormControl>
                  <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => setScannerOpen(true)} data-testid="button-open-camera-scanner">
                    <Camera className="h-4 w-4" />Ler com a câmera
                  </Button>
                </div>
                <FormDescription>Exemplo: ID numérico com 11 dígitos. Também pode digitar ou usar um leitor físico.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade</FormLabel>
                  <FormControl><Input type="number" min={1} step={1} {...field} className="font-mono tabular h-11" data-testid="input-scan-quantity" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="scannedAt" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data e hora (Brasília)</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} className="h-11 font-mono" data-testid="input-scan-datetime" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            {serverErr && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="text-scan-error">{serverErr}</p>}
            <DialogFooter className="gap-2 sm:gap-2 pt-2">
              {!scan && (
                <Button type="button" variant="outline" disabled={pending} onClick={form.handleSubmit((v) => submit(v, true))} data-testid="button-scan-save-next">
                  Salvar e bipar outro
                </Button>
              )}
              <Button type="submit" disabled={pending} data-testid="button-scan-save">
                {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{scan ? "Salvar alterações" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    {scannerOpen && (
      <Suspense fallback={
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 text-sm text-white" role="status" data-testid="status-camera-loading">
          <span><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Preparando leitor…</span>
        </div>
      }>
        <BarcodeScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onDetected={handleScannedCode} />
      </Suspense>
    )}
    </>
  );
}

export function DeleteScanDialog({ scan, onOpenChange, onDeleted }: { scan: Scan | null; onOpenChange: (o: boolean) => void; onDeleted?: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const del = useDeleteScan();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setErr(null), [scan?.id]);
  return (
    <AlertDialog open={!!scan} onOpenChange={(o) => !del.isPending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl">Excluir esta bipagem?</AlertDialogTitle>
          <AlertDialogDescription>
            {scan && <>Produto <span className="font-mono font-semibold text-foreground">{scan.productId}</span>, {num(scan.quantity)} un., lançado por {scan.collaboratorName}. Os totais do colaborador e do produto serão reduzidos. Não dá para desfazer.</>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {err && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending} data-testid="button-cancel-delete-scan">Cancelar</AlertDialogCancel>
          <AlertDialogAction data-testid="button-confirm-delete-scan" disabled={del.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              if (!scan) return;
              const id = scan.id;
              del.mutate({ id }, {
                onSuccess: () => {
                  qc.removeQueries({ queryKey: getGetScanQueryKey(id) });
                  invalidateAll(qc);
                  toast({ title: "Bipagem excluída", description: `#${id} removida do registro.` });
                  onOpenChange(false);
                  onDeleted?.();
                },
                onError: (e2) => setErr(errMsg(e2)),
              });
            }}>
            {del.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ScanDetailDialog({ id, onOpenChange, onEdit, onDelete }: { id: number | null; onOpenChange: (o: boolean) => void; onEdit: (s: Scan) => void; onDelete: (s: Scan) => void }) {
  const q = useGetScan(id ?? 0, { query: { queryKey: getGetScanQueryKey(id ?? 0), enabled: id != null, refetchInterval: POLL_MS } });
  const s = q.data;
  return (
    <Dialog open={id != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden">
        <div className="bg-sidebar text-sidebar-foreground px-6 pt-6 pb-5 relative">
          <div className="barcode-strip absolute right-6 top-6 h-8 w-20 text-sidebar-foreground/15" />
          <DialogHeader>
            <DialogDescription className="font-mono text-[11px] uppercase tracking-[0.18em] text-sidebar-primary">Bipagem #{id}</DialogDescription>
            <DialogTitle className="font-mono text-2xl md:text-3xl font-semibold break-all text-sidebar-foreground" data-testid="text-detail-product">
              {s ? s.productId : <Skeleton className="h-8 w-40 bg-sidebar-accent" />}
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="px-6 py-5">
          {q.isError ? (
            <div className="text-sm">
              <p className="text-destructive font-medium">{(q.error as { status?: number })?.status === 404 ? "Esta bipagem não existe mais. Talvez alguém a tenha excluído." : errMsg(q.error)}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => q.refetch()}>Tentar de novo</Button>
            </div>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="flex items-center gap-2 text-muted-foreground"><Boxes className="h-4 w-4" />Quantidade</dt>
              <dd className="font-mono tabular font-semibold text-lg leading-none self-center" data-testid="text-detail-quantity">{s ? num(s.quantity) : <Skeleton className="h-5 w-12" />}</dd>
              <dt className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" />Colaborador</dt>
              <dd data-testid="text-detail-collaborator">{s ? s.collaboratorName : <Skeleton className="h-5 w-28" />}</dd>
              <dt className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" />Bipado em</dt>
              <dd>{s ? <><span className="capitalize">{fmtLong(s.scannedAt)}</span><span className="block text-xs text-muted-foreground">{relative(s.scannedAt)} · horário de Brasília</span></> : <Skeleton className="h-5 w-44" />}</dd>
              <dt className="flex items-center gap-2 text-muted-foreground"><Hash className="h-4 w-4" />Registro</dt>
              <dd className="font-mono text-muted-foreground">{id}</dd>
            </dl>
          )}
        </div>
        {s && (
          <DialogFooter className="px-6 pb-6 gap-2 sm:gap-2">
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => onDelete(s)} data-testid="button-detail-delete"><Trash2 className="h-4 w-4 mr-2" />Excluir</Button>
            <Button onClick={() => onEdit(s)} data-testid="button-detail-edit"><Pencil className="h-4 w-4 mr-2" />Editar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
