import { describe, expect, it } from "vitest";
import {
  ambilKonfigurasiGoogle,
  buatUrlOauthGoogle,
  GALAT_OAUTH,
  PATH_CALLBACK_GOOGLE,
  terjemahkanGalatOAuth,
  tentukanRedirectUri,
} from "./google";

/**
 * Test unit untuk sisi protokol Google OAuth.
 *
 * Yang diuji di sini adalah hal yang **tidak terlihat** dari UI dan yang tidak
 * bisa dibuktikan test integrasi tanpa mengetuk Google sungguhan: bentuk URL
 * otorisasi, keputusan "fitur mati" saat kredensial kosong, penerjemahan galat,
 * dan konsekuensi `redirect_uri` yang harus cocok persis.
 *
 * `masukAtauDaftarGoogle` (keputusan bisnis: status akun, role, keunikan) ada di
 * `auth-service` dan diuji lewat integrasi database.
 */

function denganEnv(env: Record<string, string | undefined>, fn: () => void) {
  const asli: Record<string, string | undefined> = {};
  for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]) {
    asli[key] = process.env[key];
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(asli)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const KREDENSIAL = {
  GOOGLE_CLIENT_ID: "123.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "secret",
};

describe("ambilKonfigurasiGoogle", () => {
  it("menyatakan fitur aktif hanya bila client id DAN secret ada", () => {
    denganEnv({ ...KREDENSIAL, GOOGLE_REDIRECT_URI: "" }, () => {
      expect(ambilKonfigurasiGoogle().aktif).toBe(true);
    });

    // Secret tanpa client id, dan sebaliknya, sama-sama tidak cukup: Google
    // menolak pertukaran kode kalau salah satunya kosong, jadi advertised
    // "aktif" di sini hanya akan memunculkan galat nanti.
    denganEnv({ GOOGLE_CLIENT_ID: "123.apps.googleusercontent.com" }, () => {
      expect(ambilKonfigurasiGoogle().aktif).toBe(false);
    });
    denganEnv({ GOOGLE_CLIENT_SECRET: "secret" }, () => {
      expect(ambilKonfigurasiGoogle().aktif).toBe(false);
    });
    denganEnv({}, () => {
      expect(ambilKonfigurasiGoogle().aktif).toBe(false);
    });
  });

  it("memperlakukan whitespace sebagai kosong", () => {
    denganEnv({ GOOGLE_CLIENT_ID: "   ", GOOGLE_CLIENT_SECRET: "   " }, () => {
      const config = ambilKonfigurasiGoogle();
      expect(config.clientId).toBeNull();
      expect(config.aktif).toBe(false);
    });
  });
});

describe("buatUrlOauthGoogle", () => {
  it("meminta hanya scope yang dibutuhkan dan selalu meminta pemilihan akun", () => {
    denganEnv(KREDENSIAL, () => {
      const url = new URL(
        buatUrlOauthGoogle({ redirectUri: "https://careevo.my.id/cb", state: "st-123" }),
      );

      expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
      expect(url.searchParams.get("client_id")).toBe(KREDENSIAL.GOOGLE_CLIENT_ID);
      expect(url.searchParams.get("redirect_uri")).toBe("https://careevo.my.id/cb");
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("state")).toBe("st-123");

      // `openid email profile` sudah cukup: tidak ada scopeSensitivity, dan
      // scopes tambahan butuh verifikasi di Google Cloud Console.
      expect(url.searchParams.get("scope")).toBe("openid email profile");

      // Tanpa `select_account`, Google memakai sesi browser yang ada sehingga
      // di perangkat bersama tombol ini bisa diam-diam masuk sebagai akun lain.
      expect(url.searchParams.get("prompt")).toBe("select_account");
    });
  });

  it("menyertakan state apa adanya — itu yang mengikat callback ke cookie", () => {
    denganEnv(KREDENSIAL, () => {
      const acak = "b".repeat(64);
      const url = new URL(buatUrlOauthGoogle({ redirectUri: "https://a.test/cb", state: acak }));
      expect(url.searchParams.get("state")).toBe(acak);
    });
  });
});

describe("tentukanRedirectUri", () => {
  const request = (url: string, headers: Record<string, string> = {}) =>
    new Request(url, { headers });

  it("memakai GOOGLE_REDIRECT_URI bila diisi", () => {
    denganEnv({ ...KREDENSIAL, GOOGLE_REDIRECT_URI: "https://careevo.my.id/pinned" }, () => {
      expect(tentukanRedirectUri(request("https://lain.test/api/auth/google"))).toBe(
        "https://careevo.my.id/pinned",
      );
    });
  });

  it("menurunkan dari host + skema saat env kosong", () => {
    denganEnv(KREDENSIAL, () => {
      expect(tentukanRedirectUri(request("http://localhost:3000/api/auth/google"))).toBe(
        `http://localhost:3000${PATH_CALLBACK_GOOGLE}`,
      );
    });
  });

  it("mempercayai host sebelum x-forwarded-host", () => {
    // `x-forwarded-host` bisa disuplai klien, jadi ia tidak boleh mengalahkan
    // header yang benar. Mengurutkan terbalik membuat redirect_uri bisa
    // diarahkan ke host attackerschoice — dan kode ditukar untuk URI itu.
    denganEnv(KREDENSIAL, () => {
      const req = request("https://app.test/api/auth/google", {
        host: "careevo.my.id",
        "x-forwarded-host": "evil.test",
      });
      expect(tentukanRedirectUri(req)).toBe(`https://careevo.my.id${PATH_CALLBACK_GOOGLE}`);
    });
  });

  it("memakai x-forwarded-proto di belakang TLS-terminating proxy", () => {
    denganEnv(KREDENSIAL, () => {
      const req = request("http://careevo.my.id/api/auth/google", {
        host: "careevo.my.id",
        "x-forwarded-proto": "https",
      });
      expect(tentukanRedirectUri(req)).toBe(`https://careevo.my.id${PATH_CALLBACK_GOOGLE}`);
    });
  });
});

describe("terjemahkanGalatOAuth", () => {
  it("mengembalikan undefined tanpa kode, sehingga halaman tidak menampilkan galat kosong", () => {
    expect(terjemahkanGalatOAuth(undefined)).toBeUndefined();
    expect(terjemahkanGalatOAuth(null)).toBeUndefined();
    expect(terjemahkanGalatOAuth("")).toBeUndefined();
  });

  it("memetakan setiap kode yang emit oleh handler ke pesan berbahasa manusia", () => {
    // Kode yang ditulis di `callback/google/route.ts` harus punya terjemahan;
    // tanpa ini pengguna melihat pesan generik tanpa知道 apa yang terjadi.
    const dipakaiHandler = [
      "oauth_cancelled",
      "invalid_state",
      "missing_code",
      "oauth_exchange_failed",
      "unverified_email",
      "account_inactive",
      "oauth_not_configured",
      "db_error",
    ];
    for (const kode of dipakaiHandler) {
      expect(GALAT_OAUTH[kode], `kode ${kode} tidak punya pesan`).toBeTruthy();
      expect(terjemahkanGalatOAuth(kode)).toBe(GALAT_OAUTH[kode]);
    }
  });

  it("tidak pernah memantulkan kode tak dikenal ke dalam pesan", () => {
    // Kode berasal dari query string, yaitu input publik. Memantulkannya
    // memunculkan teks yang tidak ditulis repo ini.
    const pesan = terjemahkanGalatOAuth("<script>alert(1)</script>");
    expect(pesan).toBe("Terjadi kesalahan saat masuk dengan Google.");
    expect(pesan).not.toContain("<script>");
  });
});
