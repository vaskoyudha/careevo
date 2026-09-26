/**
 * Pull JSON out of a model response that is not guaranteed to be JSON.
 *
 * Adapted from DeepTutor (HKUDS), v1.6.8. Apache License 2.0.
 * Source: deeptutor/agents/question/pipeline.py (`_parse_quiz_payload`)
 * Source: https://github.com/HKUDS/DeepTutor
 * Source commit: a5eafa89072f6d7290a6854a6afc4ba060053beb
 * Original license: Apache License 2.0
 *
 * Modified for Careevo: Python regex + `raw_decode` → a TypeScript fenced-block
 *   strip plus `JSON.parse` on the extracted span. The `raw_decode` fallback
 *   (first object only, ignore trailing prose) is kept as a bracket-matching
 *   scan because Gemini commonly appends a sentence after the array.
 *
 * It lives in `lib/llm` rather than inside a single feature because *every*
 * model-backed path needs it and the failure it prevents is always the same:
 * a model asked for JSON that wraps its answer in ```json fences, or appends
 * "Hope that helps!", is still answering correctly — treating that as a parse
 * error would report a provider fault for a perfectly good reply.
 */
export function parseJsonMaybeFenced(text: string): unknown {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return null;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : trimmed;

  try {
    return JSON.parse(body);
  } catch {
    // Fall through to the first balanced array/object in the text.
  }

  const start = body.search(/[[{]/);
  if (start === -1) return null;
  const open = body[start];
  const close = open === "[" ? "]" : "}";

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < body.length; i += 1) {
    const ch = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(body.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
