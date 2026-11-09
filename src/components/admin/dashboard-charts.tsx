"use client";

import { useState } from "react";
import type { DashboardCharts, RangeData, RangeKey } from "@/lib/data/dashboard";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "./ui";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "all", label: "All time" },
];

type Metric = "orders" | "revenue" | "visitors" | "customers";
const METRICS: { key: Metric; title: string; note: string }[] = [
  { key: "orders", title: "Orders", note: "cancelled not counted" },
  { key: "revenue", title: "Revenue", note: "paid orders" },
  { key: "visitors", title: "Visitors", note: "unique people" },
  { key: "customers", title: "New customers", note: "accounts created" },
];

const num = (n: number) => n.toLocaleString("en-IN");
const show = (m: Metric, n: number) => (m === "revenue" ? formatPrice(n) : num(n));

/*
 * Categorical colours for collections, in the admin's collection order (validated
 * for colour-blind separation on the dark card surface). Grey = past 8 / removed.
 */
const SLICE_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const sliceColor = (i: number) => (i >= 0 ? SLICE_COLORS[i] : "#6b6b66");

/** Dashboard overview: one time filter for every chart; all ranges arrive at once, so switching is instant. */
export function DashboardChartsView({ data }: { data: DashboardCharts }) {
  const [range, setRange] = useState<RangeKey>("week");
  const r = data[range];
  const sub = r.period;

  return (
    <section aria-labelledby="overview-heading" className="mt-3 lg:mt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="overview-heading" className="text-[0.7rem] font-medium uppercase tracking-[0.2em] text-ivory">
          Overview <span className="ml-1 normal-case tracking-normal text-mute">· {sub}</span>
        </h2>
        <div role="tablist" aria-label="Time range" className="flex rounded-lg border border-ink-600/80 bg-ink-850 p-0.5">
          {RANGES.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={range === x.key}
              onClick={() => setRange(x.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs transition-colors",
                range === x.key ? "bg-gold-500/15 text-gold-300" : "text-stone hover:text-ivory",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {METRICS.map((m) => (
          <MetricCard key={m.key} metric={m.key} title={m.title} note={m.note} data={r} range={range} />
        ))}
      </div>

      <CollectionsCard data={r} />
    </section>
  );
}

function MetricCard({ metric, title, note, data, range }: { metric: Metric; title: string; note: string; data: RangeData; range: RangeKey }) {
  const total = data.totals[metric];
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[0.65rem] uppercase tracking-[0.2em] text-stone">{title}</h3>
        <span className="text-[0.7rem] text-mute">{note}</span>
      </div>
      <p className="mt-2 font-serif text-3xl text-ivory tabular-nums">{show(metric, total)}</p>
      {/* key: a new range starts with no bar selected */}
      <BarChart key={range} metric={metric} data={data} />
      {metric === "visitors" && total === 0 && (
        <p className="mt-2 text-xs text-mute">Visitor counting has just started. Numbers appear as people visit the store.</p>
      )}
    </Card>
  );
}

/** Single-series bar chart. Hover (mouse) or tap (phone) a bar for its exact value. */
function BarChart({ metric, data }: { metric: Metric; data: RangeData }) {
  const [active, setActive] = useState<number | null>(null);
  const values = data.buckets.map((b) => b[metric]);
  const max = Math.max(...values, 0);
  const n = values.length;
  // Label every bar up to 12; for 30 days, every 5th.
  const every = n <= 12 ? 1 : 5;
  const a = active !== null ? data.buckets[active] : null;

  return (
    <div className="mt-4">
      <div className="relative h-36" onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}>
        {/* Recessive guide line at the top value */}
        {max > 0 && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-ink-600/70">
            <span className="absolute -top-2 right-0 bg-ink-850 pl-1 text-[0.6rem] text-mute tabular-nums">{show(metric, max)}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 border-t border-ink-600" aria-hidden />

        <div className="absolute inset-0 flex items-end gap-[2px] pt-3" role="list" aria-label={`${metric} by ${data.unit}`}>
          {values.map((v, i) => {
            const b = data.buckets[i];
            return (
              <button
                key={i}
                type="button"
                role="listitem"
                aria-label={`${b.title}: ${show(metric, v)}`}
                onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
                onClick={() => setActive((x) => (x === i ? null : i))}
                // The whole column is the hit target; the bar sits at its foot.
                className="group flex h-full min-w-0 flex-1 items-end justify-center"
              >
                <span
                  className={cn(
                    "block w-full max-w-7 rounded-t-[4px] transition-colors",
                    active === i ? "bg-gold-300" : "bg-gold-500/85 group-hover:bg-gold-400",
                  )}
                  style={{ height: v > 0 && max > 0 ? `max(${(v / max) * 100}%, 3px)` : 0 }}
                />
              </button>
            );
          })}
        </div>

        {a && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute -top-1 z-10 -translate-y-full rounded-lg border border-gold-500/25 bg-ink-950 px-2.5 py-1.5 text-center whitespace-nowrap shadow-lg"
            style={{
              left: `clamp(0%, ${((active + 0.5) / n) * 100}%, 100%)`,
              transform: `translate(${active / n < 0.2 ? "0%" : active / n > 0.8 ? "-100%" : "-50%"}, -100%)`,
            }}
          >
            <span className="block text-[0.65rem] text-stone">{a.title}</span>
            <span className="block text-sm text-ivory tabular-nums">{show(metric, a[metric])}</span>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex gap-[2px]" aria-hidden>
        {data.buckets.map((b, i) => (
          <span key={i} className="min-w-0 flex-1 overflow-visible text-center text-[0.6rem] whitespace-nowrap text-mute">
            {i % every === 0 || i === n - 1 ? b.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Donut + ranked list (the list carries the exact values, so colour is never the only cue). */
function CollectionsCard({ data }: { data: RangeData }) {
  const slices = data.collections;
  const total = slices.reduce((n, s) => n + s.value, 0);
  const [active, setActive] = useState<string | null>(null);

  // Circle of circumference 100 so dash lengths are percentages; a small gap separates slices.
  const R = 15.9155;
  const GAP = slices.length > 1 ? 0.6 : 0;
  // Where each slice starts (running sum of the ones before it).
  const starts = slices.map((_, i) => slices.slice(0, i).reduce((n, x) => n + (x.value / total) * 100, 0));

  return (
    <Card className="mt-3 lg:mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[0.65rem] uppercase tracking-[0.2em] text-stone">Sales by collection</h3>
        <span className="text-[0.7rem] text-mute">ordered value, cancelled not counted</span>
      </div>

      {total === 0 ? (
        <p className="mt-6 mb-2 text-sm text-mute">No sales in this period yet.</p>
      ) : (
        <div className="mt-4 grid items-center gap-6 sm:grid-cols-[11rem_1fr]">
          <div className="relative mx-auto size-44">
            <svg viewBox="0 0 42 42" className="size-full -rotate-90" role="img" aria-label="Share of sales by collection">
              <circle cx="21" cy="21" r={R} fill="none" stroke="var(--color-ink-800)" strokeWidth="5" />
              {slices.map((s, i) => {
                const pct = (s.value / total) * 100;
                const dash = Math.max(pct - GAP, 0.01);
                return (
                  <circle
                    key={s.name}
                    cx="21"
                    cy="21"
                    r={R}
                    fill="none"
                    stroke={sliceColor(s.colorIndex)}
                    strokeWidth={active === s.name ? 6.5 : 5}
                    strokeDasharray={`${dash} ${100 - dash}`}
                    strokeDashoffset={-starts[i]}
                    className="transition-[stroke-width] duration-200"
                    onPointerEnter={() => setActive(s.name)}
                    onPointerLeave={() => setActive(null)}
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              {(() => {
                const s = slices.find((x) => x.name === active);
                return s ? (
                  <>
                    <span className="max-w-24 truncate text-[0.65rem] text-stone">{s.name}</span>
                    <span className="font-serif text-lg text-ivory tabular-nums">{Math.round((s.value / total) * 100)}%</span>
                  </>
                ) : (
                  <>
                    <span className="text-[0.65rem] text-stone">Total</span>
                    <span className="font-serif text-lg text-ivory tabular-nums">{formatPrice(total)}</span>
                  </>
                );
              })()}
            </div>
          </div>

          <ul className="space-y-1">
            {slices.map((s) => {
              const pct = (s.value / total) * 100;
              return (
                <li key={s.name}>
                  <button
                    type="button"
                    onPointerEnter={() => setActive(s.name)}
                    onPointerLeave={() => setActive(null)}
                    onClick={() => setActive((x) => (x === s.name ? null : s.name))}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                      active === s.name ? "bg-ink-800" : "hover:bg-ink-800/60",
                    )}
                  >
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: sliceColor(s.colorIndex) }} />
                    <span className="min-w-0 flex-1 truncate text-ivory">{s.name}</span>
                    <span className="text-stone tabular-nums">{formatPrice(s.value)}</span>
                    <span className="w-10 text-right text-xs text-mute tabular-nums">{pct < 1 ? "<1" : Math.round(pct)}%</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
