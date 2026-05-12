import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BODY_PERSONA_QUESTIONS } from "../lib/body-persona.ts";
import { BodyPersonaQuizDialog } from "./BodyPersonaQuizDialog.tsx";

test("BodyPersonaQuizDialog renders the ten-question flow shell", () => {
  const html = renderToStaticMarkup(
    <BodyPersonaQuizDialog
      questions={BODY_PERSONA_QUESTIONS}
      answers={{}}
      onClose={() => undefined}
      onChangeAnswer={() => undefined}
      onSubmit={() => undefined}
      isSubmitting={false}
    />,
  );

  assert.match(html, /10 道题/);
  assert.match(html, /当你准备开始一段只属于自己的体验时/);
  assert.match(html, /不会紧张、不会被打扰/);
  assert.match(html, /生成我的身体人格结果/);
  assert.doesNotMatch(html, /-mt-5/);
  assert.doesNotMatch(html, /-mx-5/);
  assert.equal(
    html.includes("shadow-[0_18px_38px_rgba(2,8,23,0.34)]"),
    true,
  );
});

test("BodyPersonaQuizDialog marks the active answer and submitting state", () => {
  const html = renderToStaticMarkup(
    <BodyPersonaQuizDialog
      questions={BODY_PERSONA_QUESTIONS}
      answers={{
        entry_anchor: "need_safe_first",
        spark_trigger: "cared_for",
        seen_shape: "fully_hidden",
        secret_feeling: "ordinary_double_use",
        mismatch_reaction: "pause_check",
        relax_context: "solo_quiet",
        rhythm_metaphor: "slow_prelude",
        control_need: "stop_anytime",
        private_hesitation: "fear_discovery",
        long_term_route: "safe_low_key",
      }}
      onClose={() => undefined}
      onChangeAnswer={() => undefined}
      onSubmit={() => undefined}
      isSubmitting
    />,
  );

  assert.match(html, /已完成 10 \/ 10/);
  assert.match(html, /正在生成中/);
  assert.match(html, /aria-pressed="true"/);
});
