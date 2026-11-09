import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="rise py-20 text-center">
      <div className="barcode-strip mx-auto h-14 w-40 text-foreground/15" />
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-sidebar-primary">Erro 404</p>
      <h1 className="font-display text-4xl font-extrabold mt-2">Código não reconhecido</h1>
      <p className="mt-3 text-sm text-muted-foreground">Esta página não existe no Mapeamento Geral.</p>
      <Button asChild className="mt-6"><Link href="/" data-testid="link-back-home">Voltar para a visão geral</Link></Button>
    </div>
  );
}
