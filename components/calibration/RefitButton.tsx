"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { refitCalibrationAction } from "@/app/calibration/actions";

export function RefitButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setPending(true);
    setMsg(null);
    const res = await refitCalibrationAction();
    setMsg({ ok: res.ok, text: res.message });
    setPending(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" onClick={run} disabled={pending}>
        {pending ? "Updating…" : "Update report"}
      </Button>
      {msg && <span className={`text-small ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>}
    </div>
  );
}
