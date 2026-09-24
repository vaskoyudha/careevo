"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { saveEditableProfile } from "@/lib/profile/store";
import { BIO_MAX_LENGTH, splitName } from "@/lib/profile/types";

export interface ProfileFormState {
  ok: boolean;
  message?: string;
}

/**
 * Persist the editable public profile from the "Edit profile" dialog.
 *
 * The dialog posts a single `FormData`: `nama` (combined display name),
 * `username`, `website`, `bio`, and optional `avatarUrl` / `coverUrl`
 * data-URLs produced client-side. The store owns owner/version/timestamps.
 */
export async function saveProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Masuk ulang dulu." };

  const nama = String(formData.get("nama") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim().slice(0, BIO_MAX_LENGTH);
  const avatarUrl = String(formData.get("avatarUrl") ?? "");
  const coverUrl = String(formData.get("coverUrl") ?? "");

  if (!nama) return { ok: false, message: "Nama tidak boleh kosong." };
  if (!username) return { ok: false, message: "Username tidak boleh kosong." };
  if (!/^[a-zA-Z0-9._-]{3,24}$/.test(username)) {
    return {
      ok: false,
      message: "Username 3–24 karakter, hanya huruf, angka, titik, strip, atau garis bawah.",
    };
  }

  const { firstName, lastName } = splitName(nama);

  await saveEditableProfile(
    { firstName, lastName, username, website, bio, avatarUrl, coverUrl },
    session.email,
  );

  revalidatePath("/profil");
  revalidatePath("/pengaturan");

  return { ok: true, message: "Profil tersimpan." };
}
