"use client";
// A photo that doesn't come is asked for once more, and if it still doesn't, leaves its place (10 Nov: a story opened
// with a grey box and the caption's words where its photo should be; the photo came on the second try). Photos are
// made smaller at their first view (app/official, app/commons, app/media), which now and then takes too long.
import { useEffect } from "react";

export default function PhotoMend() {
  useEffect(() => {
    const again = new WeakSet<HTMLImageElement>();
    const failed = (img: HTMLImageElement) => {
      if (!again.has(img)) {
        again.add(img);
        // the same address, a moment later: by then the smaller copy is usually made
        setTimeout(() => { const s = img.getAttribute("src"); if (s) img.setAttribute("src", s); }, 1800);
        return;
      }
      const box = img.closest("figure, .pic") ?? img.closest(".phw");
      if (box) box.classList.add("nophoto"); else img.classList.add("nophoto-in");
    };
    const onError = (e: Event) => { if (e.target instanceof HTMLImageElement) failed(e.target); };
    document.addEventListener("error", onError, true);
    // the ones that failed before this was listening
    for (const img of document.images) if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) failed(img);
    return () => document.removeEventListener("error", onError, true);
  }, []);
  return null;
}
