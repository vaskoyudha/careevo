import { describe, expect, it } from "vitest";
import { parseJsonMaybeFenced } from "@/lib/llm/json";

/**
 * The parser exists because a model asked for JSON is not a JSON encoder: it
 * wraps answers in ```json fences and appends a friendly sentence. Both are a
 * correct answer, and treating either as a parse failure would report a
 * provider fault for a perfectly good reply — on every single call.
 */
describe("parseJsonMaybeFenced", () => {
  it("parses a bare array", () => {
    expect(parseJsonMaybeFenced('[{"a":1}]')).toEqual([{ a: 1 }]);
  });

  it("parses a fenced object, with and without a language tag", () => {
    expect(parseJsonMaybeFenced('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonMaybeFenced('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("ignores prose after the closing fence", () => {
    expect(parseJsonMaybeFenced('```json\n[{"a":1}]\n```\nSemoga membantu!')).toEqual([{ a: 1 }]);
  });

  it("recovers a bare array with trailing prose", () => {
    expect(parseJsonMaybeFenced('[{"a":1}]\n\nHope that helps!')).toEqual([{ a: 1 }]);
  });

  // The balanced-bracket scan must respect braces inside strings, or a single
  // question containing `}` would truncate the parse. Trailing prose is what
  // makes this matter: with a clean array the direct parse succeeds and the
  // scan never runs.
  it("does not let braces inside a string end the object early", () => {
    expect(parseJsonMaybeFenced('[{"a":"} ] { weird"}]\n\nDone.')).toEqual([
      { a: "} ] { weird" },
    ]);
  });

  it("honours escaped quotes when tracking strings", () => {
    expect(parseJsonMaybeFenced('[{"a":"say \\"hi\\""}]')).toEqual([{ a: 'say "hi"' }]);
  });

  // The fence is checked *first* on purpose. Prose before the block can contain
  // brackets of its own; scanning for the first bracket without honouring the
  // fence would grab those and fail.
  it("prefers a fenced block over brackets in the prose before it", () => {
    expect(
      parseJsonMaybeFenced('Gunakan [kurung] seperti ini:\n```json\n[{"a":1}]\n```'),
    ).toEqual([{ a: 1 }]);
  });

  it("returns null for text that contains no JSON", () => {
    expect(parseJsonMaybeFenced("I cannot do that.")).toBeNull();
    expect(parseJsonMaybeFenced("")).toBeNull();
    expect(parseJsonMaybeFenced("   ")).toBeNull();
  });

  it("returns null for an unterminated value rather than guessing", () => {
    expect(parseJsonMaybeFenced('[{"a":1},')).toBeNull();
  });
});
