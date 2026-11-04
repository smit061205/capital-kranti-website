"use client";
// The page shown again every few seconds while the engine is at work on it (Instagram's sets), so the editor sees the
// progress without pressing anything.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Renew({ every = 10 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, every * 1000);
    return () => clearInterval(t);
  }, [router, every]);
  return null;
}
