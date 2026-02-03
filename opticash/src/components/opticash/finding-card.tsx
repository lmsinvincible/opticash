import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import type { Finding } from "@/types/opticash";

export const FindingCard = ({ finding }: { finding: Finding }) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">{finding.title}</h3>
          <p className="text-sm text-muted-foreground">{finding.description}</p>
        </div>
        <Badge variant="secondary">{formatCents(finding.yearlyLoss)}/an</Badge>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {finding.evidence.length} preuves disponibles
      </CardContent>
    </Card>
  );
};
