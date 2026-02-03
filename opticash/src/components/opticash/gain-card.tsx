import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";

export const GainCard = ({ title, value, subtitle }: { title: string; value: number; subtitle: string }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{formatCents(value)}</div>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
};
