"use client";
// A form's button that answers the moment it's pressed (the user, 4 Nov: "even if i click on buttons, it isn't responding
// or responding too late"): while the server does the work it shows the work's name and can't be pressed again.
import { useFormStatus } from "react-dom";

export default function Press({ className, busy, style, children }: {
  className?: string; busy: string; style?: React.CSSProperties; children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} style={style} disabled={pending} aria-busy={pending}>
      {pending ? <><span aria-hidden="true" className="spin" /> {busy}</> : children}
    </button>
  );
}
