import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { fmtRpFull, fmtRpJt, type FinanceMonth } from "../../data/finance";
import { cn } from "../../utils/cn";

/* ── Geometry ──────────────────────────────────────────────────────── */
const W = 900, H = 200, SLOT = 100, BASE = 200;

interface Pt { x: number; y: number }

function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function TrendChart({ monthly, currentId }: { monthly: FinanceMonth[]; currentId: string }) {
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    const max = Math.max(...monthly.map((m) => m.revenue), 1);
    const y = (v: number) => BASE - (v / max) * 188;
    const linePts: Pt[] = monthly.map((m, i) => ({ x: i * SLOT + 59, y: y(m.netProfit) }));
    const avgNet = monthly.reduce((s, m) => s + m.netProfit, 0) / Math.max(monthly.length, 1);
    return { max, y, linePts, path: smoothPath(linePts), avgNet };
  }, [monthly]);

  const hovered = hover !== null ? monthly[hover] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.14 }}
      className="flex flex-col justify-between rounded-2xl bg-surface-container-lowest p-space-lg shadow-soft"
    >
      {/* Header + legend */}
      <div className="mb-space-md flex flex-col justify-between gap-space-sm sm:flex-row sm:items-center">
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-space-xs">
            <h2 className="text-headline-md text-on-surface">Tren Pendapatan vs Beban & Laba Bersih</h2>
            <span className="rounded bg-surface-container-low px-space-xs py-0.5 text-label-sm text-primary">
              {monthly[0]?.labelLong} – {monthly[monthly.length - 1]?.labelLong}
            </span>
          </div>
          <span className="text-body-sm text-on-surface-variant">
            Evaluasi fluktuasi margin pasca ekspansi cabang Senopati
          </span>
        </div>
        <div className="flex items-center gap-space-sm">
          {[
            { cls: "bg-primary-container", label: "Pendapatan", text: "text-on-surface-variant", round: false },
            { cls: "bg-outline-variant", label: "Beban", text: "text-on-surface-variant", round: false },
            { cls: "bg-primary", label: "Laba Bersih", text: "text-primary", round: true },
          ].map((l) => (
            <div key={l.label} className={cn("flex items-center gap-1.5 text-label-sm", l.text)}>
              <span className={cn("h-3 w-3", l.round ? "rounded-full" : "rounded-sm", l.cls)} />
              <span>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="relative my-space-sm flex h-64 w-full flex-col justify-end">
        {/* Grid lines */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between opacity-40">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-px w-full bg-surface-container-high" />
          ))}
        </div>

        {/* Tooltip */}
        {hovered && hover !== null && (
          <div
            className="pointer-events-none absolute -top-2 z-20 -translate-x-1/2 rounded-xl border border-surface-container bg-surface-container-lowest px-3 py-2 shadow-pop"
            style={{ left: `${Math.min(Math.max(((hover * SLOT + 59) / W) * 100, 12), 88)}%` }}
          >
            <p className="text-[11px] font-bold text-on-surface">{hovered.labelLong}</p>
            <div className="mt-1 space-y-0.5 text-[11px] tnum">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1 text-on-surface-variant"><span className="h-2 w-2 rounded-sm bg-primary-container" />Pendapatan</span>
                <span className="font-semibold text-on-surface">{fmtRpJt(hovered.revenue)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1 text-on-surface-variant"><span className="h-2 w-2 rounded-sm bg-outline-variant" />Beban</span>
                <span className="font-semibold text-on-surface">{fmtRpJt(hovered.hpp + hovered.opex)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1 text-primary"><span className="h-2 w-2 rounded-full bg-primary" />Laba</span>
                <span className="font-bold text-primary">{fmtRpJt(hovered.netProfit)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Vector chart */}
        <svg className="h-52 w-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="revBar" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <linearGradient id="netArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#004ac6" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#004ac6" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Hover slot bands */}
          {monthly.map((m, i) => (
            <rect
              key={`band-${m.id}`}
              x={i * SLOT}
              y={0}
              width={SLOT}
              height={H}
              rx={6}
              className={cn("transition-colors duration-150", hover === i ? "fill-primary/[0.05]" : "fill-transparent")}
            />
          ))}

          {monthly.map((m, i) => {
            const beban = m.hpp + m.opex;
            const rh = (m.revenue / model.max) * 188;
            const bh = (beban / model.max) * 188;
            const isCurrent = m.id === currentId;
            return (
              <g key={m.id}>
                <motion.rect
                  x={i * SLOT + 35}
                  width={22}
                  rx={4}
                  fill={isCurrent ? "#004ac6" : "url(#revBar)"}
                  opacity={isCurrent ? 1 : 0.85}
                  initial={{ height: 0, y: BASE }}
                  animate={{ height: rh, y: BASE - rh }}
                  transition={{ duration: 0.55, delay: 0.15 + i * 0.05, ease: "easeOut" }}
                  style={{ transformBox: "fill-box", transformOrigin: "bottom" }}
                />
                <motion.rect
                  x={i * SLOT + 61}
                  width={22}
                  rx={4}
                  fill={isCurrent ? "#737686" : "#c3c6d7"}
                  opacity={0.65}
                  initial={{ height: 0, y: BASE }}
                  animate={{ height: bh, y: BASE - bh }}
                  transition={{ duration: 0.55, delay: 0.2 + i * 0.05, ease: "easeOut" }}
                  style={{ transformBox: "fill-box", transformOrigin: "bottom" }}
                />
              </g>
            );
          })}

          {/* Net profit smooth trendline */}
          <motion.path
            d={model.path}
            fill="none"
            stroke="#004ac6"
            strokeWidth={3}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, delay: 0.5, ease: "easeInOut" }}
          />

          {/* Current month point */}
          {(() => {
            const idx = monthly.findIndex((m) => m.id === currentId);
            if (idx < 0) return null;
            const pt = model.linePts[idx];
            return (
              <g>
                <circle cx={pt.x} cy={pt.y} r={10} fill="#2563eb" opacity={0.22}>
                  <animate attributeName="r" values="7;12;7" dur="2.2s" repeatCount="indefinite" />
                </circle>
                <motion.circle
                  cx={pt.x} cy={pt.y} r={6} fill="#004ac6" stroke="#fff" strokeWidth={2}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 1.6, type: "spring", stiffness: 400, damping: 18 }}
                />
              </g>
            );
          })()}

          {/* Hover capture */}
          {monthly.map((m, i) => (
            <rect
              key={`cap-${m.id}`}
              x={i * SLOT} y={0} width={SLOT} height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>

        {/* X labels */}
        <div className="flex items-center justify-between pt-space-xs text-[11px] text-label-sm text-on-surface-variant">
          {monthly.map((m) => (
            <span
              key={m.id}
              className={cn("w-16 text-center", m.id === currentId && "font-bold text-primary")}
            >
              {m.id === currentId ? `${m.label} (Now)` : m.label}
            </span>
          ))}
        </div>
      </div>

      {/* Insight bar */}
      <div className="mt-space-sm flex flex-col justify-between gap-space-xs rounded-xl bg-surface-container-low p-space-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-space-xs text-label-md text-on-surface">
          <Activity size={17} className="text-primary" />
          <span>
            Rata-rata Laba Bulanan: <strong className="font-bold text-primary tnum">{fmtRpFull(Math.round(model.avgNet))} / bln</strong>
          </span>
        </div>
        <span className="text-body-sm text-on-surface-variant">
          Profitabilitas konsisten bertumbuh dalam 4 kuartal berturut-turut.
        </span>
      </div>
    </motion.div>
  );
}
