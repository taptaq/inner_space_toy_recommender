import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("global clickable controls use pointer cursors while disabled controls do not", () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "src/index.css"),
    "utf8",
  );

  assert.match(source, /button:not\(:disabled\)/);
  assert.match(source, /a\[href\]/);
  assert.match(source, /\[role="button"\]/);
  assert.match(source, /cursor:\s*pointer/);
  assert.match(source, /button:disabled/);
  assert.match(source, /cursor:\s*not-allowed/);
});
