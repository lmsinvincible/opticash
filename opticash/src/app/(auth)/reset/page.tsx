"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/lib/config";
import { resetPassword } from "@/lib/supabase/auth";

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email);
      toast.success("Email envoyé si le compte existe.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-6 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Réinitialiser le mot de passe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <Button className="w-full" disabled={loading}>
              {loading ? "Envoi..." : "Envoyer le lien"}
            </Button>
          </form>
          <div className="text-xs text-muted-foreground">
            <Link href={routes.auth.login}>Retour à la connexion</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
