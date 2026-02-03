import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import type { PlanItem } from "@/types/opticash";

export const PlanItemCard = ({ item }: { item: PlanItem }) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">{item.title}</h3>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </div>
        <Badge variant="secondary">{item.priority}</Badge>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge>{formatCents(item.yearlyGain)}/an</Badge>
          <Badge variant="outline">Effort: {item.effort}</Badge>
          <Badge variant="outline">Risque: {item.risk}</Badge>
        </div>
        <Button size="sm" variant="outline">
          {item.ctaLabel}
        </Button>
      </CardContent>
    </Card>
  );
};
