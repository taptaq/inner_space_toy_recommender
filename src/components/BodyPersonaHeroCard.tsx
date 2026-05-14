import { Sparkles } from "lucide-react";

import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";

export function BodyPersonaHeroCard({
  report,
}: {
  report: BodyPersonaFullReport;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <div className="relative min-h-56 overflow-hidden rounded-3xl border border-cyan-300/14 bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,0.12),transparent_42%),linear-gradient(180deg,rgba(10,18,35,0.96),rgba(5,10,24,0.98))]">
        {report.personaImageAsset ? (
          <img
            src={report.personaImageAsset}
            alt={report.personaName}
            className="h-full min-h-56 w-full object-cover"
          />
        ) : (
          <>
            <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] [background-size:2.5rem_2.5rem]" />
            <div className="relative z-10 flex h-full min-h-56 items-center justify-center px-6 py-8">
              <div className="max-w-sm text-center">
                <p className="text-sm text-cyan-100/90">{report.personaName}</p>
                <p className="mt-2 text-[13px] leading-6 text-slate-300">
                  星系人格画像素材稍后补上，当前先展示完整人格档案与长期路线建议。
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-3xl border border-white/8 bg-white/[0.035] p-5">
        <div className="flex items-center gap-2 text-cyan-100/80">
          <Sparkles className="h-4 w-4" />
          <p className="text-[11px] tracking-[0.24em]">PERSONA HERO</p>
        </div>
        <h3 className="mt-3 text-2xl font-medium text-white">{report.personaName}</h3>
        <p className="mt-2 text-sm text-cyan-100/80">{report.personaSubtitle}</p>
        <p className="mt-4 text-sm leading-7 text-slate-200">{report.personaManifesto}</p>
        <p className="mt-4 text-[13px] leading-6 text-slate-300">{report.portraitLong}</p>

        {report.strengthTags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {report.strengthTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-cyan-300/18 bg-cyan-300/[0.08] px-3 py-1 text-[11px] text-cyan-50"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <p className="text-[11px] tracking-wide text-cyan-100/84">为什么会是这个类型</p>
          <p className="mt-2 text-[13px] leading-6 text-slate-300">{report.whyYouAreThis}</p>
        </div>
      </div>
    </section>
  );
}
