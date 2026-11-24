/**
 * Seventeen Syllables of Debugging — one haiku about debugging.
 *
 * The program writes a single haiku (three lines, 5-7-5 syllables)
 * to $MAKEFUN_OUTPUT_DIR/entry.txt (or /output/entry.txt).
 *
 * Why this haiku works: the first two lines put the reader in a
 * concrete late-night scene — a cursor blinking at 3am while the
 * log scrolls past — and the last line turns it: the one true line
 * in all that scrolling was only a typo. The bug was never a
 * mystery, just a misspelling. Every word earns its place; the
 * entry text is the deliverable and is never rewritten by this
 * script.
 */

import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const HAIKU =
  "cursor blinks at three\n" +
  "the log scrolls past one true line\n" +
  "it was a typo";

const EXPECTED_SYLLABLES = [5, 7, 5];
const MAX_CHARS = 200;

/**
 * Count the syllables of one English word by counting groups of
 * vowel sounds: consecutive vowels (a, e, i, o, u, y) count once,
 * a trailing silent "e" drops one, and a word with no vowel group
 * at all still counts as one syllable. This is a heuristic, so the
 * self-test below pins it against every word this haiku actually
 * uses — if the heuristic ever miscounts one of them, the program
 * fails loudly instead of shipping a misshapen haiku.
 */
function countSyllables(word: string): number {
  const lower = word.toLowerCase().replace(/[^a-z]/g, "");
  if (lower.length === 0) return 0;
  if (lower.length <= 3) return 1;
  const withoutSilentE = lower.endsWith("e") ? lower.slice(0, -1) : lower;
  const groups = withoutSilentE.match(/[aeiouy]+/g);
  const count = groups === null ? 0 : groups.length;
  return Math.max(1, count);
}

/** The syllable count every word of this haiku must measure at. */
const WORD_SYLLABLES: Record<string, number> = {
  cursor: 2,
  blinks: 1,
  at: 1,
  three: 1,
  the: 1,
  log: 1,
  scrolls: 1,
  past: 1,
  one: 1,
  true: 1,
  line: 1,
  it: 1,
  was: 1,
  a: 1,
  typo: 2,
};

/**
 * Self-test: the counter must agree with the pinned counts for
 * every word in the haiku. Throws on the first mismatch, naming
 * the word, so a broken counter can never silently pass a bad
 * haiku.
 */
function selfTestSyllableCounter(text: string): void {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  for (const word of words) {
    const expected = WORD_SYLLABLES[word.toLowerCase()];
    if (expected === undefined) {
      throw new Error(
        `self-test: no pinned syllable count for word "${word}" — add it to WORD_SYLLABLES`,
      );
    }
    const counted = countSyllables(word);
    if (counted !== expected) {
      throw new Error(
        `self-test: syllable counter says "${word}" has ${counted} syllable(s), expected ${expected}`,
      );
    }
  }
}

/**
 * One check result. Checks never throw: every rule runs and every
 * failure is reported together, so a broken haiku shows all of its
 * problems in one pass instead of one at a time.
 */
type Check = { name: string; ok: boolean; detail: string };

function checkThreeLines(text: string): Check {
  const lines = text.split("\n");
  const ok = lines.length === 3;
  return {
    name: "three-lines",
    ok,
    detail: ok ? "3 lines" : `haiku must be exactly 3 lines, got ${lines.length}`,
  };
}

function checkLength(text: string): Check {
  const ok = text.length >= 1 && text.length <= MAX_CHARS;
  return {
    name: "length",
    ok,
    detail: ok
      ? `${text.length} chars`
      : `haiku must be 1-${MAX_CHARS} characters, got ${text.length}`,
  };
}

function checkNotWhitespaceOnly(text: string): Check {
  const ok = text.trim().length > 0;
  return {
    name: "non-blank",
    ok,
    detail: ok ? "has content" : "haiku must not be only whitespace",
  };
}

function checkNoBlankLines(text: string): Check {
  const lines = text.split("\n");
  const ok = lines.every((line) => line.trim().length > 0);
  return {
    name: "no-blank-lines",
    ok,
    detail: ok ? "every line has words" : "haiku has a blank line",
  };
}

function checkNoEdgeSpaces(text: string): Check {
  const lines = text.split("\n");
  const ok = lines.every((line) => line === line.trim());
  return {
    name: "no-edge-spaces",
    ok,
    detail: ok ? "no leading/trailing space" : "a line has a leading or trailing space",
  };
}

function checkSyllableShape(text: string): Check {
  const lines = text.split("\n");
  const counts = lines.map((line) =>
    line
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .reduce((sum, word) => sum + countSyllables(word), 0),
  );
  const shape = counts.join("-");
  const ok =
    counts.length === EXPECTED_SYLLABLES.length &&
    counts.every((count, i) => count === EXPECTED_SYLLABLES[i]);
  return {
    name: "syllable-shape",
    ok,
    detail: ok
      ? `syllables ${shape}`
      : `haiku must be ${EXPECTED_SYLLABLES.join("-")} syllables, got ${shape}`,
  };
}

/** Run every check and return the failures, if any. */
function validateHaiku(text: string): Check[] {
  return [
    checkThreeLines(text),
    checkLength(text),
    checkNotWhitespaceOnly(text),
    checkNoBlankLines(text),
    checkNoEdgeSpaces(text),
    checkSyllableShape(text),
  ].filter((c) => !c.ok);
}

/** Write the entry and confirm the file round-trips byte-identical. */
function writeEntry(outDir: string, text: string): string {
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, text, "utf8");
  const roundTripped = readFileSync(outPath, "utf8");
  if (roundTripped !== text) {
    throw new Error(
      `entry.txt did not round-trip: wrote ${text.length} chars, read back ${roundTripped.length}`,
    );
  }
  return outPath;
}

function main(): void {
  // Prove the syllable counter before trusting it with the haiku.
  selfTestSyllableCounter(HAIKU);

  const failures = validateHaiku(HAIKU);
  if (failures.length > 0) {
    const report = failures.map((f) => `  - ${f.name}: ${f.detail}`).join("\n");
    throw new Error(`Haiku failed validation:\n${report}`);
  }

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  const outPath = writeEntry(outDir, HAIKU);
  const lines = HAIKU.split("\n");
  const counts = lines.map((line) =>
    line
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .reduce((sum, word) => sum + countSyllables(word), 0),
  );
  console.log(`Wrote ${HAIKU.length}-char haiku (${lines.length} lines) to ${outPath}`);
  console.log(`Syllable shape: ${counts.join("-")} (expected ${EXPECTED_SYLLABLES.join("-")})`);
}

main();
