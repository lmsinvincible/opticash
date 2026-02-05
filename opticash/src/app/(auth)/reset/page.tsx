"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/lib/config";
import { resetPassword } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"request" | "update">("request");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const type = params.get("type");
    if (access_token && refresh_token && type === "recovery") {
      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(() => setMode("update"))
        .catch(() => {
          // fallback to request mode
        });
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const baseUrl =
        typeof window !== "undefined"
          ? process.env.NEXT_PUBLIC_APP_URL || window.location.origin
          : "https://opticash-six.vercel.app";
      await resetPassword(email, `${baseUrl}/reset`);
      toast.success("Email envoyé si le compte existe.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Mot de passe mis à jour");
      window.location.href = routes.auth.login;
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
          <CardTitle>
            {mode === "request" ? "Réinitialiser le mot de passe" : "Choisir un nouveau mot de passe"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "request" ? (
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
          ) : (
            <form className="space-y-4" onSubmit={handleUpdate}>
              <div className="space-y-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
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
                <Label htmlFor="confirm">Confirmer le mot de passe</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Confirmez votre mot de passe"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                />
              </div>
              <Button className="w-full" disabled={loading}>
                {loading ? "Mise à jour..." : "Mettre à jour"}
              </Button>
            </form>
          )}
          <div className="text-xs text-muted-foreground">
            <Link href={routes.auth.login}>Retour à la connexion</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
