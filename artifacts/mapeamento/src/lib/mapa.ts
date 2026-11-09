import type { QueryClient } from "@tanstack/react-query";
import {
  getListCollaboratorsQueryKey,
  getListScansQueryKey,
  getGetSummaryQueryKey,
  getListProductsQueryKey,
  getGetScanQueryKey,
} from "@workspace/api-client-react";

export const TZ = "America/Sao_Paulo";
export const POLL_MS = 15000;

const nf = new Intl.NumberFormat("pt-BR");
export const num = (n: number | undefined | null) => nf.format(n ?? 0);

const dtf = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dtLong = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const fmtDateTime = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : dtf.format(d); };
export const fmtLong = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : dtLong.format(d); };

export function relative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (isNaN(diff)) return "";
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  const d = Math.floor(diff / 86400);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/** Parts of a Date in São Paulo time. */
function spParts(d: Date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return { y: g("year"), m: g("month"), d: g("day"), h: g("hour"), min: g("minute") };
}
/** ISO -> value for <input type="datetime-local"> in São Paulo time. */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = spParts(d);
  return `${p.y}-${p.m}-${p.d}T${p.h}:${p.min}`;
}
export const nowLocalInput = () => isoToLocalInput(new Date().toISOString());
/** datetime-local (São Paulo, UTC-03:00, no DST since 2019) -> ISO */
export function localInputToIso(v: string): string {
  return new Date(`${v}:00-03:00`).toISOString();
}
export function todaySP(): string {
  const p = spParts(new Date());
  return `${p.y}-${p.m}-${p.d}`;
}

export function errMsg(e: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  if (!e) return fallback;
  const data = (e as { data?: unknown }).data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of ["error", "message", "detail"]) if (typeof o[k] === "string" && o[k]) return o[k] as string;
  }
  if (typeof data === "string" && data.trim()) return data.trim();
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
export const errStatus = (e: unknown) => (e as { status?: number })?.status;

export function invalidateAll(qc: QueryClient, scanId?: number) {
  qc.invalidateQueries({ queryKey: getListScansQueryKey() });
  qc.invalidateQueries({ queryKey: getListCollaboratorsQueryKey() });
  qc.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
  qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
  if (scanId != null) qc.invalidateQueries({ queryKey: getGetScanQueryKey(scanId) });
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "";
  return (a + b).toUpperCase();
}
