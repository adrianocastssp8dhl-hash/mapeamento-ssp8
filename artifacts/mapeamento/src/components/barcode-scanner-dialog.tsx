import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatOneDReader } from "@zxing/browser";
import { Camera, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function cameraErrorMessage(error: unknown): string {
  const name = error && typeof error === "object" && "name" in error
    ? String(error.name)
    : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "O acesso à câmera foi bloqueado. Permita a câmera nas configurações do navegador e tente novamente.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "Nenhuma câmera foi encontrada neste dispositivo.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "A câmera está em uso por outro aplicativo. Feche-o e tente novamente.";
  }
  return "Não foi possível abrir a câmera. Confira a permissão e tente novamente.";
}

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let accepted = false;
    let lastRejected = "";
    let stopScanner: (() => void) | undefined;
    setStarting(true);
    setCameraError(null);
    setFeedback(null);

    if (!window.isSecureContext) {
      setStarting(false);
      setCameraError("A câmera exige uma conexão segura. Abra o app usando HTTPS.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStarting(false);
      setCameraError("Este navegador não oferece acesso à câmera. Tente no Safari ou Chrome atualizado.");
      return;
    }
    const video = videoRef.current;
    if (!video) {
      setStarting(false);
      setCameraError("Não foi possível iniciar a visualização da câmera.");
      return;
    }

    const reader = new BrowserMultiFormatOneDReader(undefined, {
      delayBetweenScanSuccess: 350,
      delayBetweenScanAttempts: 100,
    });
    reader.decodeFromConstraints(
      {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      video,
      (result, _error, controls) => {
        if (!result || accepted || cancelled) return;
        const code = result.getText();
        if (!/^\d{11}$/.test(code)) {
          if (code !== lastRejected) {
            lastRejected = code;
            setFeedback("O código lido não tem 11 dígitos numéricos. Aponte para o ID correto ou digite-o.");
          }
          return;
        }
        accepted = true;
        controls.stop();
        onDetected(code);
        onOpenChange(false);
      },
    ).then((controls) => {
      stopScanner = () => controls.stop();
      if (cancelled) {
        controls.stop();
        return;
      }
      setStarting(false);
    }).catch((error: unknown) => {
      if (cancelled) return;
      setStarting(false);
      setCameraError(cameraErrorMessage(error));
    });

    return () => {
      cancelled = true;
      stopScanner?.();
    };
  }, [open, attempt, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Ler código pela câmera</DialogTitle>
          <DialogDescription>
            Enquadre o código de barras numérico de 11 dígitos. A câmera traseira será selecionada automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/3] max-h-[52vh] overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Visualização da câmera para leitura do código de barras"
            data-testid="video-barcode-camera"
            className={`h-full w-full object-contain ${cameraError ? "invisible" : ""}`}
          />
          {!cameraError && !starting && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-[10%] top-1/2 h-14 -translate-y-1/2 rounded-md border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.18)]" />
          )}
          {starting && !cameraError && (
            <div className="absolute inset-0 grid place-items-center bg-black/70 px-6 text-center text-sm text-white" role="status" data-testid="status-camera-starting">
              <span><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Solicitando acesso à câmera…</span>
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white" role="alert" data-testid="text-camera-error">
              <span><Camera className="mx-auto mb-3 h-7 w-7 text-white/80" />{cameraError}</span>
            </div>
          )}
        </div>

        {feedback && <p className="text-sm text-destructive" role="status" aria-live="polite" data-testid="text-camera-feedback">{feedback}</p>}
        <p className="text-xs text-muted-foreground">
          No iPhone, abra no Safari e autorize o acesso à câmera. A digitação manual continua disponível.
        </p>
        <DialogFooter className="gap-2 sm:gap-2">
          {cameraError && (
            <Button type="button" variant="outline" disabled={starting} onClick={() => setAttempt((value) => value + 1)} data-testid="button-camera-retry">
              Tentar novamente
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-camera-close">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
