"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resubmitPaymentProof } from "@/app/(store)/checkout/actions";
import { Button } from "@/components/ui/button";
import { ProofUpload, type ProofValue } from "./payment-parts";

/** A new payment screenshot after the store rejected the first one. */
export function ProofResubmit({ token }: { token: string }) {
  const router = useRouter();
  const [proof, setProof] = useState<ProofValue>({ url: null, reference: "" });
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <ProofUpload value={proof} onChange={setProof} error={error} />
      <Button
        type="button"
        className="w-full"
        disabled={!proof.url || pending}
        onClick={() =>
          start(async () => {
            const res = await resubmitPaymentProof(token, { proofUrl: proof.url, reference: proof.reference });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            toast.success("Screenshot sent. We'll verify it shortly.");
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Send new screenshot"}
      </Button>
    </div>
  );
}
