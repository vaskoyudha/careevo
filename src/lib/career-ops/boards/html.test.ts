import { describe, expect, it } from "vitest";
import {
  ambilNextData,
  bersihkanPlaceholder,
  htmlKeTeks,
  metaOgDescription,
  potongDivId,
} from "./html";

describe("htmlKeTeks", () => {
  it("turns paragraphs and breaks into text with newlines", () => {
    expect(htmlKeTeks("<p>One</p><p>Two</p>")).toBe("One\nTwo");
    expect(htmlKeTeks("a<br>b")).toBe("a\nb");
  });

  it("decodes named and numeric entities", () => {
    expect(htmlKeTeks("R&amp;D &lt;x&gt; &nbsp; &#39;q&#39;")).toBe("R&D <x> 'q'");
  });

  it("drops script and style content entirely", () => {
    expect(htmlKeTeks("<style>p{}</style><script>x()</script>Keep")).toBe("Keep");
  });

  it("collapses runs of spaces but keeps paragraph breaks", () => {
    expect(htmlKeTeks("<p>a    b</p>\n\n\n\n<p>c</p>")).toBe("a b\n\nc");
  });

  it("returns an empty string for empty or non-string input", () => {
    expect(htmlKeTeks("")).toBe("");
    expect(htmlKeTeks(undefined as never)).toBe("");
  });
});

describe("ambilNextData", () => {
  it("parses the Next.js payload", () => {
    const html = '<script id="__NEXT_DATA__" type="application/json">{"a":1}</script>';
    expect(ambilNextData(html)).toEqual({ a: 1 });
  });

  it("returns null when the script tag is absent", () => {
    expect(ambilNextData("<html></html>")).toBeNull();
  });

  it("returns null rather than throwing on invalid JSON", () => {
    expect(ambilNextData('<script id="__NEXT_DATA__">{oops</script>')).toBeNull();
  });
});

describe("metaOgDescription", () => {
  it("reads the content in either attribute order", () => {
    expect(metaOgDescription('<meta property="og:description" content="Hi">')).toBe("Hi");
    expect(metaOgDescription('<meta content="Hi" property="og:description">')).toBe("Hi");
  });

  it("returns null when absent or empty", () => {
    expect(metaOgDescription("<html></html>")).toBeNull();
    expect(metaOgDescription('<meta property="og:description" content="">')).toBeNull();
  });
});

describe("potongDivId", () => {
  it("reads to the matching close tag, not the first one", () => {
    // The Breezy bug this exists for: a non-greedy regex stops after the inner
    // div and returns 79 chars where the real block is 1725.
    const html = '<div id="description"><div>inner</div><p>real body</p></div><footer>x</footer>';
    expect(potongDivId(html, "description")).toBe(
      '<div id="description"><div>inner</div><p>real body</p></div>',
    );
  });

  it("returns null when the id is absent", () => {
    expect(potongDivId("<div>a</div>", "description")).toBeNull();
  });

  it("returns null when the tags never balance", () => {
    expect(potongDivId('<div id="description"><div>open', "description")).toBeNull();
  });
});

describe("bersihkanPlaceholder", () => {
  it("strips Breezy's template tokens", () => {
    expect(
      bersihkanPlaceholder("%BREADCRUMB_JOB_OPENINGS% Fullstack Engineer %BUTTON_APPLY_TO_POSITION%"),
    ).toBe("Fullstack Engineer");
  });

  it("leaves ordinary text alone", () => {
    expect(bersihkanPlaceholder("Good Communication skills.")).toBe("Good Communication skills.");
  });
});
