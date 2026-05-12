import { X } from "lucide-react";

import type {
  BodyPersonaAnswers,
  BodyPersonaQuestion,
  BodyPersonaQuestionId,
  BodyPersonaAnswerValue,
} from "../lib/body-persona.ts";

export function BodyPersonaQuizDialog({
  questions,
  answers,
  onClose,
  onChangeAnswer,
  onSubmit,
  isSubmitting,
}: {
  questions: readonly BodyPersonaQuestion[];
  answers: BodyPersonaAnswers;
  onClose: () => void;
  onChangeAnswer: (
    questionId: BodyPersonaQuestionId,
    value: BodyPersonaAnswerValue,
  ) => void;
  onSubmit: () => void | Promise<void>;
  isSubmitting: boolean;
}) {
  const completedCount = questions.filter((question) => answers[question.id]).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/82 px-4 py-5 backdrop-blur-xl">
      <div className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-[1.75rem] border border-cyan-100/14 bg-slate-950 p-5 shadow-[0_24px_90px_rgba(8,47,73,0.34)] sm:p-6">
        <div className="sticky top-0 z-10 mb-5 flex items-start justify-between gap-4 overflow-hidden rounded-[1.25rem] border border-cyan-100/12 bg-slate-950/88 px-5 py-4 shadow-[0_18px_38px_rgba(2,8,23,0.34)] ring-1 ring-white/[0.02] backdrop-blur-2xl sm:px-6 sm:py-5">
          <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-100/30 to-transparent" />
          <div>
            <p className="text-[11px] tracking-[0.24em] text-cyan-200/60">
              身体人格测试
            </p>
            <h3 className="mt-2 text-lg font-medium text-white">
              {questions.length} 道题，定位你长期更适合的装备路线
            </h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              已完成 {completedCount} / {questions.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
            aria-label="关闭身体人格测试"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {questions.map((question, index) => (
            <section
              key={question.id}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
            >
              <div className="mb-3 flex items-start gap-3">
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-cyan-300/18 bg-cyan-300/10 px-2 text-[11px] text-cyan-100/84">
                  {index + 1}
                </span>
                <div>
                  <h4 className="text-sm font-medium leading-6 text-white">
                    {question.title}
                  </h4>
                </div>
              </div>
              <div className="grid gap-2">
                {question.options.map((option) => {
                  const isSelected = answers[question.id] === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onChangeAnswer(question.id, option.value)}
                      className={[
                        "rounded-2xl border px-3 py-3 text-left text-sm leading-6 transition-colors",
                        isSelected
                          ? "border-cyan-300/32 bg-cyan-300/12 text-cyan-50"
                          : "border-white/8 bg-white/[0.028] text-slate-300 hover:border-cyan-300/18 hover:bg-cyan-300/[0.06]",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-cyan-100/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-400">
            免费先看基础画像，再决定要不要解锁完整身体人格报告。
          </p>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={isSubmitting || completedCount < questions.length}
            className="inline-flex items-center justify-center rounded-full border border-cyan-300/22 bg-cyan-300/12 px-4 py-2 text-sm text-cyan-50 transition-colors hover:border-cyan-200/40 hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "正在生成中" : "生成我的身体人格结果"}
          </button>
        </div>
      </div>
    </div>
  );
}
