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
import { signInWithOAuth, signInWithPassword } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await signInWithPassword(email, password);
      const session = result?.session;
      if (!session) {
        throw new Error("Connexion incomplète. Merci de réessayer.");
      }
      toast.success("Connexion réussie");
      const userId = session.user?.id;
      if (userId) {
        await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", userId);
        const { data: profile } = await supabase
          .from("profiles")
          .select("profile_completed")
          .eq("id", userId)
          .maybeSingle();
        if (profile?.profile_completed) {
          router.push(routes.app.dashboard);
          return;
        }
      }
      router.push("/onboarding");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setOauthLoading(true);
    try {
      const redirectTo = `${window.location.origin}/onboarding`;
      await signInWithOAuth("google", redirectTo);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connexion Google impossible.";
      toast.error(message);
      setOauthLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-6 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Se connecter</CardTitle>
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
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <Button className="w-full" disabled={loading}>
              {loading ? "Connexion..." : "Continuer"}
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={oauthLoading}
          >
            {oauthLoading ? "Redirection..." : "Continuer avec Google"}
          </Button>
          <div className="flex justify-between text-xs text-muted-foreground">
            <Link href={routes.auth.reset}>Mot de passe oublié ?</Link>
            <Link href={routes.auth.signup}>Créer un compte</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
