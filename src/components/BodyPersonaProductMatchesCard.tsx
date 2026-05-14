import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";

export function BodyPersonaProductMatchesCard({
  report,
}: {
  report: BodyPersonaFullReport;
}) {
  return (
    <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-5">
      <p className="text-[11px] tracking-[0.24em] text-cyan-100/78">选品方向装载</p>
      <p className="mt-3 text-[13px] leading-6 text-slate-300">
        {report.pickReasonSummary}
      </p>

      {report.topCategoryMatches.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {report.topCategoryMatches.map((match) => (
            <article
              key={match.id}
              className="rounded-2xl border border-white/8 bg-slate-950/55 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-white">{match.label}</p>
                <span className="text-sm text-cyan-100/82">{match.fitScore}</span>
              </div>
              <p className="mt-2 text-[13px] leading-6 text-slate-300">{match.reason}</p>
            </article>
          ))}
        </div>
      ) : null}

      {report.productPicks.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {report.productPicks.map((product) => (
            <article
              key={product.id}
              className="rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.04] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-white">{product.name}</p>
                  {product.categoryLabel ? (
                    <p className="mt-1 text-[11px] text-cyan-100/76">
                      {product.categoryLabel}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-sm text-cyan-100/84">
                    人格匹配分 {product.personaScore}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    基础分 {product.score}
                  </p>
                </div>
              </div>
              {product.reason ? (
                <p className="mt-3 text-[13px] leading-6 text-slate-300">
                  {product.reason}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
