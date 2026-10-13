"use client";

import { useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  cropToWebp,
  makeLqip,
  uploadImage,
  type CropRect,
} from "@/lib/images/client-crop";
import { imageUrl } from "@/lib/menu/image";
import { cn } from "@/lib/utils";
import { ImageCropper } from "./image-cropper";

export type ImageValue = { key: string | null; lqip: string | null };

// Spec §6: icon 400×400 square, hero max 1600 on the long edge (we use 4:3).
const KINDS = {
  icon: {
    aspect: 1,
    maxWidth: 400,
    quality: 0.8,
    title: "Thumbnail (square)",
    hint: "Shown small on the menu list.",
  },
  hero: {
    aspect: 4 / 3,
    maxWidth: 1600,
    quality: 0.82,
    title: "Large photo (4:3)",
    hint: "Shown big at the top of the dish page.",
  },
} as const;

export function ImageField({
  kind,
  itemId,
  value,
  onChange,
  label,
}: {
  kind: "icon" | "hero";
  itemId: string;
  value: ImageValue;
  onChange: (v: ImageValue) => void;
  label: string;
}) {
  const cfg = KINDS[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<{
    bitmap: ImageBitmap;
    url: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (file.type === "image/svg+xml")
      return toast.error(
        "SVG files aren't supported. Use a photo (JPG, PNG, WebP, HEIC).",
      );
    try {
      const bitmap = await createImageBitmap(file); // honours phone EXIF rotation
      setSource({ bitmap, url: URL.createObjectURL(file) });
    } catch {
      toast.error("Couldn't open that file. Try a JPG or PNG photo.");
    }
  };

  const close = () => {
    if (source) {
      URL.revokeObjectURL(source.url);
      source.bitmap.close();
    }
    setSource(null);
  };

  const confirm = async (crop: CropRect) => {
    if (!source) return;
    setBusy(true);
    try {
      const [rendition, lqip] = await Promise.all([
        cropToWebp(source.bitmap, crop, cfg.maxWidth, cfg.aspect, cfg.quality),
        makeLqip(source.bitmap, crop, cfg.aspect),
      ]);
      const { key } = await uploadImage(kind, rendition.blob, itemId);
      onChange({ key, lqip });
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div
        className={cn(
          "bg-muted relative overflow-hidden rounded-xl border",
          kind === "icon" ? "size-32" : "aspect-[4/3] w-full max-w-sm",
        )}
        style={
          value.lqip
            ? { backgroundImage: `url(${value.lqip})`, backgroundSize: "cover" }
            : undefined
        }
      >
        {value.key ? (
          // eslint-disable-next-line @next/next/no-img-element -- no next/image on Workers
          <img
            src={imageUrl(value.key)}
            alt={`${label} preview`}
            className="size-full object-cover"
          />
        ) : (
          <div className="text-muted-foreground flex size-full items-center justify-center p-2 text-center text-xs">
            {cfg.hint}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={`Choose ${label.toLowerCase()}`}
        data-testid={`file-${kind}`}
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => inputRef.current?.click()}
        >
          <ImageUp aria-hidden="true" className="size-4" />
          {value.key ? "Replace photo" : "Add photo"}
        </Button>
        {value.key && (
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => onChange({ key: null, lqip: null })}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Remove
          </Button>
        )}
      </div>
      {source && (
        <ImageCropper
          bitmap={source.bitmap}
          objectUrl={source.url}
          aspect={cfg.aspect}
          title={cfg.title}
          description={cfg.hint}
          busy={busy}
          onCancel={close}
          onConfirm={(crop) => void confirm(crop)}
        />
      )}
    </div>
  );
}
