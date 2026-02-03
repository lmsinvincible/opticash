import { formatCents } from "@/lib/money";
import type { Evidence } from "@/types/opticash";

export const EvidenceRow = ({ evidence }: { evidence: Evidence }) => {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
      <div>
        <p className="font-medium">{evidence.label}</p>
        <p className="text-xs text-muted-foreground">{evidence.date}</p>
      </div>
      <span className="font-semibold">{formatCents(evidence.amount)}</span>
    </div>
  );
};
