"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { AtSign, Check, ImagePlus, X } from "lucide-react";
import { saveProfileAction, type ProfileFormState } from "@/actions/profile";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCharacterLimit } from "@/components/ui/profile-dialog/use-character-limit";
import { useImageUpload } from "@/components/ui/profile-dialog/use-image-upload";
import { BIO_MAX_LENGTH, type EditableProfile } from "@/lib/profile/types";

const DEFAULT_COVER = "/profil/cover-default.jpg";

export function EditProfileDialog({
  profile,
  nama,
  username,
  trigger,
}: {
  profile: EditableProfile | null;
  /** Current display name / username, used as fallbacks before first save. */
  nama: string;
  username: string;
  trigger: React.ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? "");
  const [coverUrl, setCoverUrl] = useState(profile?.coverUrl ?? "");

  const {
    value: bio,
    characterCount,
    handleChange: handleBioChange,
    maxLength,
  } = useCharacterLimit({
    maxLength: BIO_MAX_LENGTH,
    initialValue: profile?.bio ?? "",
  });

  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    saveProfileAction,
    { ok: false },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="glass-card glass-card--strong flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border-white/70 p-0 backdrop-blur-xl sm:max-w-lg [&>button:last-child]:top-3.5">
        <DialogHeader className="contents space-y-0 text-left">
          <DialogTitle className="border-b border-gray-200 px-6 py-4 text-base font-medium">
            Edit profile
          </DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">
          Ubah foto, nama, username, website, dan bio profilmu di sini.
        </DialogDescription>

        <form action={formAction} className="flex min-h-0 flex-1 flex-col">
          {/* Hidden data-URL payloads written by the upload widgets below. */}
          <input type="hidden" name="avatarUrl" value={avatarUrl} />
          <input type="hidden" name="coverUrl" value={coverUrl} />

          <div className="min-h-0 overflow-y-auto">
            <UploadCover value={coverUrl} onChange={setCoverUrl} />
            <UploadAvatar
              value={avatarUrl}
              onChange={setAvatarUrl}
              initials={nama.charAt(0)}
            />

            <div className="px-6 pt-4 pb-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${id}-nama`}>Nama tampilan</Label>
                  <Input
                    id={`${id}-nama`}
                    name="nama"
                    defaultValue={nama}
                    placeholder="Raka Pratama"
                    type="text"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${id}-username`}>Username</Label>
                  <div className="flex rounded-lg shadow-sm shadow-black/5">
                    <span className="-z-10 inline-flex items-center rounded-s-lg border border-input bg-background px-3 text-muted-foreground">
                      <AtSign size={16} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <Input
                      id={`${id}-username`}
                      name="username"
                      className="-ms-px rounded-s-none shadow-none"
                      placeholder="raka"
                      defaultValue={profile?.username ?? username}
                      type="text"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${id}-website`}>Website</Label>
                  <div className="flex rounded-lg shadow-sm shadow-black/5">
                    <span className="-z-10 inline-flex items-center rounded-s-lg border border-input bg-background px-3 text-sm text-muted-foreground">
                      https://
                    </span>
                    <Input
                      id={`${id}-website`}
                      name="website"
                      className="-ms-px rounded-s-none shadow-none"
                      placeholder="portofolio.com"
                      defaultValue={profile?.website ?? ""}
                      type="text"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${id}-bio`}>Biography</Label>
                  <Textarea
                    id={`${id}-bio`}
                    name="bio"
                    placeholder="Tulis beberapa kalimat tentang dirimu"
                    defaultValue={bio}
                    maxLength={maxLength}
                    onChange={handleBioChange}
                    aria-describedby={`${id}-description`}
                  />
                  <p
                    id={`${id}-description`}
                    className="text-right text-xs text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="tabular-nums">{maxLength - characterCount}</span> karakter tersisa
                  </p>
                </div>

                {state.message ? (
                  <p
                    className={
                      state.ok
                        ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
                        : "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                    }
                    role="alert"
                  >
                    {state.message}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-gray-200 px-6 py-4">
            <DialogClose asChild>
              <button
                type="button"
                className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-base font-medium text-gray-800 transition duration-300 ease-in-out hover:bg-gray-100"
              >
                Cancel
              </button>
            </DialogClose>
            <button
              type="submit"
              disabled={pending}
              className="grad-btn inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-base font-medium transition duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="size-4" strokeWidth={2} aria-hidden="true" />
              {pending ? "Menyimpan…" : "Save changes"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UploadCover({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [removed, setRemoved] = useState(false);
  const { previewUrl, fileInputRef, handleThumbnailClick, handleFileChange, handleRemove } =
    useImageUpload({ maxDimension: 768 });

  // The preview reflects a just-picked file; otherwise the saved value (or the
  // default cover, unless the user removed it in this session).
  const currentImage = previewUrl || (removed ? null : value || DEFAULT_COVER);

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(event);
    setRemoved(false);
  };

  return (
    <div className="h-32">
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-muted">
        {currentImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="h-full w-full object-cover"
            src={currentImage}
            alt={previewUrl ? "Pratinjau gambar sampul" : "Gambar sampul"}
            width={512}
            height={96}
          />
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center gap-2.5">
          <button
            type="button"
            className="grad-btn z-50 flex size-10 cursor-pointer items-center justify-center rounded-lg outline-offset-2 transition duration-300 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70"
            onClick={handleThumbnailClick}
            aria-label={currentImage ? "Ganti gambar sampul" : "Unggah gambar sampul"}
          >
            <ImagePlus size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          {currentImage ? (
            <button
              type="button"
              className="z-50 flex size-10 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white/90 text-gray-800 outline-offset-2 backdrop-blur-sm transition duration-300 ease-in-out hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70"
              onClick={() => {
                handleRemove();
                setRemoved(true);
                onChange("");
              }}
              aria-label="Hapus gambar sampul"
            >
              <X size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePick}
        className="hidden"
        accept="image/*"
        aria-label="Unggah berkas gambar sampul"
      />
      {/* Sync the (possibly resized) data-URL into the form on every change. */}
      <PreviewSync value={previewUrl} onChange={onChange} />
    </div>
  );
}

function UploadAvatar({
  value,
  onChange,
  initials,
}: {
  value: string;
  onChange: (next: string) => void;
  initials: string;
}) {
  const { previewUrl, fileInputRef, handleThumbnailClick, handleFileChange } =
    useImageUpload({ maxDimension: 256 });

  const currentImage = previewUrl || value;

  return (
    <div className="-mt-10 px-6">
      <div className="relative flex size-20 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-muted shadow-sm shadow-black/10">
        {currentImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentImage}
            className="h-full w-full object-cover"
            width={80}
            height={80}
            alt="Foto profil"
          />
        ) : (
          <span className="text-2xl font-semibold text-muted-foreground uppercase" aria-hidden="true">
            {initials}
          </span>
        )}
        <button
          type="button"
          className="grad-btn absolute right-1 bottom-1 flex size-8 cursor-pointer items-center justify-center rounded-lg outline-offset-2 transition duration-300 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70"
          onClick={handleThumbnailClick}
          aria-label="Ganti foto profil"
        >
          <ImagePlus size={16} strokeWidth={2} aria-hidden="true" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
          aria-label="Unggah foto profil"
        />
      </div>
      <PreviewSync value={previewUrl} onChange={onChange} />
    </div>
  );
}

/** Push a freshly-resized preview data-URL up to the dialog's form state. */
function PreviewSync({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string) => void;
}) {
  useEffect(() => {
    if (value !== null) onChange(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return null;
}
