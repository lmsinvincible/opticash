import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Paramètres</h2>
        <p className="text-sm text-muted-foreground">Sécurité, données et confidentialité.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Exporter votre plan en PDF.</p>
          <Button disabled>Exporter PDF</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Données & confidentialité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Vous pouvez demander la suppression totale de vos données à tout moment.</p>
          <Separator />
          <div className="flex items-center justify-between">
            <span>Supprimer toutes mes données</span>
            <Button variant="outline" size="sm">Demander</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sources connectées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Banque principale</span>
            <Button variant="outline" size="sm">Déconnecter</Button>
          </div>
          <div className="flex items-center justify-between">
            <span>FranceConnect</span>
            <Button variant="outline" size="sm">Déconnecter</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
