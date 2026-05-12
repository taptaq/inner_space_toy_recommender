import assert from "node:assert/strict";
import test from "node:test";

import {
  BODY_PERSONA_QUESTIONS,
  resolveBodyPersonaResult,
} from "./body-persona.ts";

test("BODY_PERSONA_QUESTIONS exposes a ten-question long-term preference quiz", () => {
  assert.equal(BODY_PERSONA_QUESTIONS.length, 10);
  assert.equal(
    BODY_PERSONA_QUESTIONS.every((question) => question.options.length >= 3),
    true,
  );
  assert.equal(
    new Set(BODY_PERSONA_QUESTIONS.map((question) => question.id)).size,
    BODY_PERSONA_QUESTIONS.length,
  );
});

test("resolveBodyPersonaResult returns a stable free summary for slow, private answers", () => {
  const result = resolveBodyPersonaResult({
    answers: {
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
    },
  });

  assert.equal(result.primaryPersonaCode, "starlit_guard");
  assert.equal(result.hiddenRouteCode, "daily_object");
  assert.equal(result.hiddenPowerGrade, "S");
  assert.match(result.freeSummary.title, /隐私安全型/);
  assert.match(result.freeSummary.why, /隐私|慢热|安全感/);
});

test("resolveBodyPersonaResult returns a fast-start profile for direct answers", () => {
  const result = resolveBodyPersonaResult({
    answers: {
      entry_anchor: "ready_when_right",
      spark_trigger: "clear_signal",
      seen_shape: "easy_to_store",
      secret_feeling: "playful_contrast",
      mismatch_reaction: "stronger_if_right",
      relax_context: "self_controlled_vibe",
      rhythm_metaphor: "clear_beat",
      control_need: "guided_simple",
      private_hesitation: "fear_no_surprise",
      long_term_route: "direct_less_trial",
    },
  });

  assert.equal(result.primaryPersonaCode, "comet_spark");
  assert.equal(result.hiddenPowerGrade === "S", false);
  assert.match(result.freeSummary.title, /直接点燃型/);
});

test("resolveBodyPersonaResult returns zero_profile when no hidden power is selected", () => {
  const result = resolveBodyPersonaResult({
    answers: {
      spark_trigger: "clear_signal",
      mismatch_reaction: "stronger_if_right",
      rhythm_metaphor: "clear_beat",
      control_need: "guided_simple",
    },
  });

  assert.equal(result.hiddenRouteCode, "zero_profile");
  assert.equal(result.hiddenPowerGrade, "B");
  assert.equal(result.coLivingComfortGrade, "low");
});
