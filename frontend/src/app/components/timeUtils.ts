/**
 * All timestamps from the backend are UTC (ISO 8601, no timezone suffix).
 * We need to append 'Z' so the browser parses them as UTC, then
 * format in Montreal's timezone (America/Toronto = EST/EDT).
 */

const MTL_TZ = 'America/Toronto';

function toUtcDate(iso: string): Date {
  // Backend sends "2025-03-22T14:30:00" (no Z) — treat as UTC
  const s = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
  return new Date(s);
}

export function fmtDate(iso: string): string {
  return toUtcDate(iso).toLocaleDateString('en-CA', {
    timeZone: MTL_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export function fmtTime(iso: string): string {
  return toUtcDate(iso).toLocaleTimeString('en-CA', {
    timeZone: MTL_TZ,
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function fmtDateTime(iso: string): string {
  return toUtcDate(iso).toLocaleString('en-CA', {
    timeZone: MTL_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function timeAgoMtl(iso: string): string {
  const secs = Math.floor((Date.now() - toUtcDate(iso).getTime()) / 1000);
  if (secs < 60)    return `${secs}s ago`;
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}
