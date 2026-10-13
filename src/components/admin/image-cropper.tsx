"use client";

import { useCallback, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CropRect } from "@/lib/images/client-crop";

type Props = {
  bitmap: ImageBitmap;
  objectUrl: string;
  aspect: number; // width / height of the crop frame
  title: string;
  description: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (crop: CropRect) => void;
};

const MAX_ZOOM = 4;

/** Drag to position, slider (or wheel) to zoom. The frame shows exactly what will be saved. */
export function ImageCropper({
  bitmap,
  objectUrl,
  aspect,
  title,
  description,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // image top-left relative to frame, px
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);

  // Measure the frame when it actually attaches. A callback ref (not useEffect) is required:
  // the sheet portals its content after opening, so the element doesn't exist on first effect.
  const observer = useRef<ResizeObserver | null>(null);
  const frameRef = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const ro = new ResizeObserver(
      ([e]) =>
        e && setFrame({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(el);
    observer.current = ro;
  }, []);

  // "Cover" scale: the image always fills the frame at zoom 1.
  const cover = frame.w
    ? Math.max(frame.w / bitmap.width, frame.h / bitmap.height)
    : 0;
  const k = cover * zoom;
  const dw = bitmap.width * k;
  const dh = bitmap.height * k;
  const clamp = (o: { x: number; y: number }) => ({
    x: Math.min(0, Math.max(frame.w - dw, o.x)),
    y: Math.min(0, Math.max(frame.h - dh, o.y)),
  });

  // Centre on first measure; keep the centre fixed when zooming.
  const [centred, setCentred] = useState(false);
  if (frame.w && !centred) {
    setCentred(true);
    setOffset({
      x: (frame.w - bitmap.width * cover) / 2,
      y: (frame.h - bitmap.height * cover) / 2,
    });
  }
  const setZoomKeepingCentre = (z: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    const cx = (frame.w / 2 - offset.x) / k; // source px under the frame centre
    const cy = (frame.h / 2 - offset.y) / k;
    const nk = cover * next;
    setZoom(next);
    setOffset(() => {
      const o = { x: frame.w / 2 - cx * nk, y: frame.h / 2 - cy * nk };
      return {
        x: Math.min(0, Math.max(frame.w - bitmap.width * nk, o.x)),
        y: Math.min(0, Math.max(frame.h - bitmap.height * nk, o.y)),
      };
    });
  };

  const confirm = () =>
    onConfirm({
      sx: -offset.x / k,
      sy: -offset.y / k,
      sw: frame.w / k,
      sh: frame.h / k,
    });

  return (
    <Sheet open onOpenChange={(open) => !open && !busy && onCancel()}>
      <SheetContent
        side="bottom"
        className="max-h-[95dvh] overflow-y-auto rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <div
            ref={frameRef}
            data-testid="crop-frame"
            className="bg-muted relative mx-auto w-full max-w-md touch-none overflow-hidden rounded-xl select-none"
            style={{
              aspectRatio: String(aspect),
              cursor: dragging ? "grabbing" : "grab",
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                ox: offset.x,
                oy: offset.y,
              };
              setDragging(true);
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (d)
                setOffset(
                  clamp({
                    x: d.ox + e.clientX - d.x,
                    y: d.oy + e.clientY - d.y,
                  }),
                );
            }}
            onPointerUp={() => {
              drag.current = null;
              setDragging(false);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setDragging(false);
            }}
            onWheel={(e) =>
              setZoomKeepingCentre(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))
            }
          >
            {frame.w > 0 && (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img
                src={objectUrl}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none"
                style={{ left: offset.x, top: offset.y, width: dw, height: dh }}
              />
            )}
            {/* Rule-of-thirds guide */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
            >
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="border border-white/25" />
              ))}
            </div>
          </div>
          <div className="mx-auto flex max-w-md items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11"
              aria-label="Zoom out"
              onClick={() => setZoomKeepingCentre(zoom / 1.25)}
            >
              <Minus aria-hidden="true" className="size-4" />
            </Button>
            <input
              type="range"
              aria-label="Zoom"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoomKeepingCentre(Number(e.target.value))}
              className="accent-foreground h-11 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11"
              aria-label="Zoom in"
              onClick={() => setZoomKeepingCentre(zoom * 1.25)}
            >
              <Plus aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <p className="text-muted-foreground text-center text-xs">
            Drag the photo to position it.
          </p>
        </div>
        <SheetFooter className="flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-12 flex-1"
            disabled={busy || !frame.w}
            onClick={confirm}
          >
            {busy ? "Uploading…" : "Use photo"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
