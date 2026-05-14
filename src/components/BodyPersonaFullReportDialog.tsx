import { X } from "lucide-react";
import { createPortal } from "react-dom";

import type { BodyPersonaFullReport } from "../lib/body-persona-report.ts";
import { BodyPersonaDimensionGrid } from "./BodyPersonaDimensionGrid.tsx";
import { BodyPersonaHeroCard } from "./BodyPersonaHeroCard.tsx";
import { BodyPersonaHiddenRouteCard } from "./BodyPersonaHiddenRouteCard.tsx";
import { BodyPersonaProductMatchesCard } from "./BodyPersonaProductMatchesCard.tsx";
import { BodyPersonaRouteAdviceCard } from "./BodyPersonaRouteAdviceCard.tsx";

export function BodyPersonaFullReportDialog({
  isOpen,
  report,
  onClose,
}: {
  isOpen: boolean;
  report: BodyPersonaFullReport | null;
  onClose: () => void;
}) {
  if (!isOpen || !report) {
    return null;
  }

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 px-3 py-2 sm:px-4 sm:py-3">
      <div className="relative flex h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-cyan-100/14 bg-slate-950 shadow-[0_24px_90px_rgba(8,47,73,0.34)]">
        <div className="shrink-0 border-b border-cyan-100/10 px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.24em] text-cyan-200/60">
                完整星系人格档案
              </p>
              <h2 className="mt-2 text-xl font-medium text-white">
                {report.reportTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭完整星系人格档案"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-slate-300 transition-colors hover:border-cyan-200/30 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="space-y-4">
            <BodyPersonaHeroCard report={report} />
            <BodyPersonaDimensionGrid report={report} />
            <BodyPersonaHiddenRouteCard report={report} />
            <BodyPersonaRouteAdviceCard report={report} />
            <BodyPersonaProductMatchesCard report={report} />
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? content : createPortal(content, document.body);
}
