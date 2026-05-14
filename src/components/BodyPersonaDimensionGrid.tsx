import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";

export function BodyPersonaDimensionGrid({
  report,
}: {
  report: BodyPersonaFullReport;
}) {
  if (report.dimensionBreakdown.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
      <p className="text-[11px] tracking-[0.24em] text-cyan-100/78">人格维度拆解</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {report.dimensionBreakdown.map((dimension) => (
          <article
            key={dimension.id}
            className="rounded-2xl border border-white/8 bg-slate-950/55 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-white">{dimension.label}</p>
              <span className="text-sm text-cyan-100/84">{dimension.score}</span>
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              {dimension.summary}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
