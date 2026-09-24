"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Minimal image-upload helper for the profile dialog.
 *
 * Reads the picked file, downsizes it on a canvas (so the resulting data-URL
 * stays well under the cookie budget), and exposes a preview URL plus the
 * hidden `<input type="file">` ref / click handler.
 *
 * Adapted from the reference component's `use-image-upload`, but resizes to a
 * square-ish thumbnail instead of keeping the raw file, because we persist the
 * image as a data-URL inside an httpOnly cookie rather than uploading it.
 */

const DEFAULT_MAX_DIMENSION = 256;

export function useImageUpload({ maxDimension = DEFAULT_MAX_DIMENSION } = {}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleThumbnailClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setPreviewUrl(typeof reader.result === "string" ? reader.result : null);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          setPreviewUrl(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => {
          setPreviewUrl(typeof reader.result === "string" ? reader.result : null);
        };
        img.src = typeof reader.result === "string" ? reader.result : "";
      };
      reader.readAsDataURL(file);
    },
    [maxDimension],
  );

  const handleRemove = useCallback(() => {
    setPreviewUrl(null);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return {
    previewUrl,
    fileName,
    fileInputRef,
    handleThumbnailClick,
    handleFileChange,
    handleRemove,
  };
}
