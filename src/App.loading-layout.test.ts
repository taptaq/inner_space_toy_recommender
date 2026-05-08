import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("loading route keeps the matching page on a full-width layer for fragment positioning", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/App.tsx"), "utf8");

  assert.match(
    source,
    /if \(isLoading && currentRoute !== "\/library"\) \{[\s\S]*MatchingPage/,
  );
  assert.doesNotMatch(
    source,
    /if \(isLoading && currentRoute !== "\/library"\) \{[\s\S]*relative z-10 w-full max-w-md[\s\S]*<MatchingPage/,
  );
});
