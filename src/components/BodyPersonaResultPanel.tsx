import { LockKeyhole, Sparkles } from "lucide-react";

import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";
import type { BodyPersonaResult } from "../lib/body-persona.ts";

type BodyPersonaPanelStatus = "idle" | "completed_free" | "unlocking" | "unlocked";

type BodyPersonaFreeSummary = BodyPersonaResult["freeSummary"];

function normalizeFullReport(
  value: Record<string, unknown> | null,
): BodyPersonaFullReport | null {
  if (!value) {
    return null;
  }

  const productPicks = Array.isArray(value.productPicks)
    ? value.productPicks
        .map((item) =>
          item && typeof item === "object"
            ? (item as Record<string, unknown>)
            : null,
        )
        .filter((item): item is Record<string, unknown> => !!item)
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : "candidate",
          name: typeof item.name === "string" ? item.name : "未命名产品",
          score: typeof item.score === "number" ? item.score : 0,
          personaScore: typeof item.personaScore === "number" ? item.personaScore : 0,
        }))
    : [];

  return {
    title: typeof value.title === "string" ? value.title : "",
    portrait: typeof value.portrait === "string" ? value.portrait : "",
    hiddenRouteSummary:
      typeof value.hiddenRouteSummary === "string"
        ? value.hiddenRouteSummary
        : "",
    goodFits: Array.isArray(value.goodFits)
      ? value.goodFits.filter((item): item is string => typeof item === "string")
      : [],
    avoidNotes: Array.isArray(value.avoidNotes)
      ? value.avoidNotes.filter((item): item is string => typeof item === "string")
      : [],
    productPicks,
  };
}

export function BodyPersonaResultPanel({
  status,
  freeSummary,
  fullReport,
  onUnlock,
  isUnlocking,
}: {
  status: BodyPersonaPanelStatus;
  freeSummary: BodyPersonaFreeSummary | null;
  fullReport: Record<string, unknown> | null;
  onUnlock: () => void | Promise<void>;
  isUnlocking: boolean;
}) {
  if (!freeSummary) {
    return null;
  }

  const normalizedReport = normalizeFullReport(fullReport);
  const isUnlocked = status === "unlocked" && !!normalizedReport;

  return (
    <section className="relative z-10 overflow-hidden rounded-[1.75rem] border border-cyan-200/14 bg-slate-950/56 p-5 shadow-[0_24px_90px_rgba(8,47,73,0.2)] sm:p-6">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/45 to-transparent" />
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-3xl border border-cyan-300/14 bg-cyan-300/[0.055] p-4">
          <p className="text-[11px] tracking-[0.24em] text-cyan-200/68">
            身体人格画像
          </p>
          <h3 className="mt-2 text-xl font-medium text-white">
            {freeSummary.title}
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-200">
            {isUnlocked && normalizedReport?.portrait
              ? normalizedReport.portrait
              : freeSummary.blurb}
          </p>
          <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.045] p-3">
            <p className="text-[11px] tracking-wide text-cyan-100/80">
              为什么会是这个类型
            </p>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">
              {freeSummary.why}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center gap-2 text-cyan-100/84">
              <Sparkles className="h-3.5 w-3.5" />
              <p className="text-[11px] tracking-wide">当前方向提示</p>
            </div>
            <ul className="space-y-1.5">
              {freeSummary.hints.map((hint, index) => (
                <li
                  key={`${hint}-${index}`}
                  className="text-[13px] leading-6 text-slate-300"
                >
                  {hint}
                </li>
              ))}
            </ul>
          </div>

          {isUnlocked && normalizedReport ? (
            <>
              <div className="rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.05] p-4">
                <p className="text-[11px] tracking-wide text-cyan-100/82">
                  隐藏路线总结
                </p>
                <p className="mt-2 text-[13px] leading-6 text-slate-200">
                  {normalizedReport.hiddenRouteSummary}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-300/14 bg-emerald-400/[0.05] p-4">
                  <p className="text-[11px] tracking-wide text-emerald-100/84">
                    更适合的路线
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {normalizedReport.goodFits.map((item, index) => (
                      <li
                        key={`${item}-${index}`}
                        className="text-[13px] leading-6 text-slate-200"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-rose-300/14 bg-rose-400/[0.05] p-4">
                  <p className="text-[11px] tracking-wide text-rose-100/84">
                    暂不优先
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {normalizedReport.avoidNotes.map((item, index) => (
                      <li
                        key={`${item}-${index}`}
                        className="text-[13px] leading-6 text-slate-200"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {normalizedReport.productPicks.length > 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-[11px] tracking-wide text-cyan-100/82">
                    更贴合你人格路线的产品方向
                  </p>
                  <div className="mt-3 grid gap-2">
                    {normalizedReport.productPicks.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3"
                      >
                        <div>
                          <p className="text-sm text-white">{product.name}</p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            人格匹配分 {product.personaScore}
                          </p>
                        </div>
                        <span className="text-xs text-cyan-100/76">
                          基础分 {product.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.05] p-4">
              <div className="flex items-center gap-2 text-cyan-100/84">
                <LockKeyhole className="h-3.5 w-3.5" />
                <p className="text-[11px] tracking-wide">完整报告已锁定</p>
              </div>
              <p className="mt-2 text-[13px] leading-6 text-slate-300">
                解锁后可以看到完整画像、隐藏路线总结、适配方向和更贴合的人格产品清单。
              </p>
              <button
                type="button"
                onClick={() => void onUnlock()}
                disabled={isUnlocking}
                className="mt-4 inline-flex items-center justify-center rounded-full border border-cyan-300/22 bg-cyan-300/12 px-4 py-2 text-sm text-cyan-50 transition-colors hover:border-cyan-200/40 hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUnlocking ? "正在解锁中" : "解锁完整身体人格报告"}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
