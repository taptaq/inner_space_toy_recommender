import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";

export function BodyPersonaHiddenRouteCard({
  report,
}: {
  report: BodyPersonaFullReport;
}) {
  return (
    <section className="rounded-3xl border border-cyan-300/14 bg-cyan-300/[0.045] p-5">
      <p className="text-[11px] tracking-[0.24em] text-cyan-100/78">隐藏路线显影</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
          <p className="text-lg text-white">{report.hiddenRouteName}</p>
          <p className="mt-2 text-[13px] leading-6 text-slate-300">
            {report.hiddenRouteSummaryLong}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[11px] tracking-wide text-cyan-100/80">隐藏力</p>
            <p className="mt-2 text-xl text-white">{report.hiddenPowerGrade}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[11px] tracking-wide text-cyan-100/80">共居安心度</p>
            <p className="mt-2 text-xl text-white">{report.coLivingComfortGrade}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <p className="text-[11px] tracking-wide text-cyan-100/80">隐私需求</p>
            <p className="mt-2 text-xl text-white">{report.privacyNeedLevel}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
