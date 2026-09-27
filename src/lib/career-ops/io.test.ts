import { afterEach, describe, expect, it, vi } from "vitest";
import { ioDefault } from "./io";

const respon = (over: Partial<Response> & { status?: number } = {}) =>
  ({
    ok: (over.status ?? 200) < 400,
    status: over.status ?? 200,
    url: "https://example.test/final",
    headers: new Headers(),
    json: async () => ({ ok: true }),
    text: async () => "<html></html>",
    ...over,
  }) as unknown as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ioDefault.fetchJson", () => {
  it("parses a successful JSON response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respon()));
    await expect(ioDefault.fetchJson("https://example.test/a")).resolves.toEqual({ ok: true });
  });

  it("throws on a non-ok response so the caller can leave the row unenriched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respon({ status: 500 })));
    await expect(ioDefault.fetchJson("https://example.test/a")).rejects.toThrow("HTTP 500");
  });

  it("retries a 429 once and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respon({ status: 429 }))
      .mockResolvedValueOnce(respon());
    vi.stubGlobal("fetch", fetchMock);
    await expect(ioDefault.fetchJson("https://example.test/a")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends a browser-like User-Agent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respon());
    vi.stubGlobal("fetch", fetchMock);
    await ioDefault.fetchJson("https://example.test/a");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String((init.headers as Record<string, string>)["User-Agent"])).toContain("Mozilla/5.0");
    expect(init.signal).toBeDefined();
  });
});

describe("ioDefault.fetchHtml", () => {
  it("returns the body and the final URL after redirects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respon({ url: "https://apply.workable.com/indico/j/E7A5F89AC8", text: async () => "<p>hi</p>" }),
      ),
    );
    const out = await ioDefault.fetchHtml("https://apply.workable.com/j/E7A5F89AC8");
    expect(out.html).toBe("<p>hi</p>");
    expect(out.urlAkhir).toBe("https://apply.workable.com/indico/j/E7A5F89AC8");
  });
});
