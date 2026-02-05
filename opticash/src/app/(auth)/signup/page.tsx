"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/lib/config";
import { signUp } from "@/lib/supabase/auth";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const baseUrl =
        typeof window !== "undefined"
          ? process.env.NEXT_PUBLIC_APP_URL || window.location.origin
          : undefined;
      const redirectTo = baseUrl ? `${baseUrl}/login` : undefined;
      const { user, session } = await signUp(email, password, redirectTo);
      if (session) {
        toast.success("Compte créé");
        router.push("/onboarding");
      } else if (user) {
        setSubmitted(true);
      }
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
          <CardTitle>Créer un compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitted ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Merci ! Vérifie ta boîte mail pour activer ton compte.</p>
              <Link className="text-primary" href={routes.auth.login}>
                Retour à la connexion
              </Link>
            </div>
          ) : (
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
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="8 caractères minimum"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirmez votre mot de passe"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
              <Button className="w-full" disabled={loading}>
                {loading ? "Création..." : "Créer mon compte"}
              </Button>
            </form>
          )}
          <div className="flex justify-between text-xs text-muted-foreground">
            <Link href={routes.auth.login}>Déjà inscrit ?</Link>
            <Link href={routes.marketing.terms}>CGU</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
