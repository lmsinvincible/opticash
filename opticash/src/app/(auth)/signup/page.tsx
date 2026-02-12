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
import { signInWithOAuth, signUp } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("non_renseigne");
  const [maritalStatus, setMaritalStatus] = useState("celibataire");
  const [childrenCount, setChildrenCount] = useState(0);
  const [postalCode, setPostalCode] = useState("");
  const [consentRgpd, setConsentRgpd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      if (!consentRgpd) {
        toast.error("Merci d'accepter le consentement RGPD.");
        return;
      }
      const baseUrl =
        typeof window !== "undefined"
          ? process.env.NEXT_PUBLIC_APP_URL || window.location.origin
          : undefined;
      const redirectTo = baseUrl ? `${baseUrl}/login` : undefined;
      const { user, session } = await signUp(email, password, redirectTo);
      const profilePayload = {
        email,
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate || null,
        gender,
        marital_status: maritalStatus,
        children_count: Number(childrenCount) || 0,
        postal_code: postalCode,
        consent_rgpd: consentRgpd,
      };
      if (session) {
        await supabase
          .from("profiles")
          .update(profilePayload)
          .eq("id", session.user.id);
        toast.success("Compte créé");
        router.push("/onboarding");
      } else if (user) {
        localStorage.setItem("opticash:pending_profile", JSON.stringify(profilePayload));
        setSubmitted(true);
      }
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    placeholder="Prénom"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    placeholder="Nom"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </div>
              </div>
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Date de naissance</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={birthDate}
                    onChange={(event) => setBirthDate(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Sexe</Label>
                  <select
                    id="gender"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={gender}
                    onChange={(event) => setGender(event.target.value)}
                  >
                    <option value="non_renseigne">Non renseigné</option>
                    <option value="femme">Femme</option>
                    <option value="homme">Homme</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="maritalStatus">Situation familiale</Label>
                  <select
                    id="maritalStatus"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={maritalStatus}
                    onChange={(event) => setMaritalStatus(event.target.value)}
                  >
                    <option value="celibataire">Célibataire</option>
                    <option value="marie_pacse">Marié / Pacsé</option>
                    <option value="divorce">Divorcé</option>
                    <option value="veuf">Veuf</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="childrenCount">Enfants à charge</Label>
                  <Input
                    id="childrenCount"
                    type="number"
                    min={0}
                    max={10}
                    value={childrenCount}
                    onChange={(event) => setChildrenCount(Number(event.target.value))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input
                  id="postalCode"
                  placeholder="Ex: 59000"
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                  required
                />
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  id="consentRgpd"
                  type="checkbox"
                  className="mt-1"
                  checked={consentRgpd}
                  onChange={(event) => setConsentRgpd(event.target.checked)}
                />
                <Label htmlFor="consentRgpd" className="text-xs text-muted-foreground">
                  J&apos;accepte le traitement de mes données conformément au RGPD.
                </Label>
              </div>
              <Button className="w-full" disabled={loading}>
                {loading ? "Création..." : "Créer mon compte"}
              </Button>
            </form>
          )}
          {!submitted ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={oauthLoading}
            >
              {oauthLoading ? "Redirection..." : "Continuer avec Google"}
            </Button>
          ) : null}
          <div className="flex justify-between text-xs text-muted-foreground">
            <Link href={routes.auth.login}>Déjà inscrit ?</Link>
            <Link href={routes.marketing.terms}>CGU</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
