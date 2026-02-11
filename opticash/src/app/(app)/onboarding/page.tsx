"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { routes } from "@/lib/config";

type ProfileDraft = {
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: string;
  marital_status: string;
  children_count: number;
  postal_code: string;
  commute_km_year: number | "";
  monthly_income_eur: number | "";
  consent_rgpd: boolean;
};

const defaultDraft: ProfileDraft = {
  first_name: "",
  last_name: "",
  birth_date: "",
  gender: "non_renseigne",
  marital_status: "celibataire",
  children_count: 0,
  postal_code: "",
  commute_km_year: "",
  monthly_income_eur: "",
  consent_rgpd: false,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ProfileDraft>(defaultDraft);
  const [loading, setLoading] = useState(false);
  const stepsTotal = 4;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (!userId) {
        router.replace(routes.auth.login);
        return;
      }
      const pending = localStorage.getItem("opticash:pending_profile");
      if (pending) {
        try {
          const parsed = JSON.parse(pending) as Partial<ProfileDraft>;
          if (mounted) setDraft((prev) => ({ ...prev, ...parsed }));
        } catch {
          // ignore
        }
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "first_name,last_name,birth_date,gender,marital_status,children_count,postal_code,commute_km_year,monthly_income_eur,consent_rgpd,profile_completed"
        )
        .eq("id", userId)
        .maybeSingle();
      if (!mounted) return;
      if (profile?.profile_completed) {
        router.replace(routes.app.dashboard);
        return;
      }
      if (profile) {
        setDraft((prev) => ({
          ...prev,
          first_name: profile.first_name ?? prev.first_name,
          last_name: profile.last_name ?? prev.last_name,
          birth_date: profile.birth_date ?? prev.birth_date,
          gender: profile.gender ?? prev.gender,
          marital_status: profile.marital_status ?? prev.marital_status,
          children_count: profile.children_count ?? prev.children_count,
          postal_code: profile.postal_code ?? prev.postal_code,
          commute_km_year: profile.commute_km_year ?? prev.commute_km_year,
          monthly_income_eur: profile.monthly_income_eur ?? prev.monthly_income_eur,
          consent_rgpd: profile.consent_rgpd ?? prev.consent_rgpd,
        }));
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [router]);

  const progress = useMemo(() => ((step + 1) / stepsTotal) * 100, [step, stepsTotal]);

  const handleNext = async () => {
    if (step < stepsTotal - 1) {
      setStep((prev) => prev + 1);
      return;
    }
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (!userId) {
        toast.error("Session invalide.");
        return;
      }
      if (!draft.consent_rgpd) {
        toast.error("Merci d'accepter le consentement RGPD.");
        return;
      }
      await supabase
        .from("profiles")
        .update({
          ...draft,
          profile_completed: true,
          children_count: Number(draft.children_count) || 0,
          commute_km_year:
            draft.commute_km_year === "" ? null : Number(draft.commute_km_year),
          monthly_income_eur:
            draft.monthly_income_eur === "" ? null : Number(draft.monthly_income_eur),
        })
        .eq("id", userId);
      localStorage.removeItem("opticash:pending_profile");
      localStorage.setItem("opticash:onboarded", "1");
      router.push(routes.app.dashboard);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur onboarding.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Étape {step + 1} / {stepsTotal}</span>
          <span>Ton 1er scan est gratuit</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <Card className="border-emerald-200 bg-white/90">
          <CardHeader>
            <CardTitle className="text-2xl">
              {step === 0 && "Bienvenue, complétons ton profil"}
              {step === 1 && "Ta situation personnelle"}
              {step === 2 && "Données utiles pour les impôts"}
              {step === 3 && "Prêt à lancer ton premier scan ?"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {step === 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prénom</Label>
                  <Input
                    id="first_name"
                    value={draft.first_name}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, first_name: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom</Label>
                  <Input
                    id="last_name"
                    value={draft.last_name}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, last_name: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birth_date">Date de naissance</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={draft.birth_date}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, birth_date: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Sexe</Label>
                  <select
                    id="gender"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={draft.gender}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, gender: event.target.value }))
                    }
                  >
                    <option value="non_renseigne">Non renseigné</option>
                    <option value="femme">Femme</option>
                    <option value="homme">Homme</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="marital_status">Situation familiale</Label>
                  <select
                    id="marital_status"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={draft.marital_status}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, marital_status: event.target.value }))
                    }
                  >
                    <option value="celibataire">Célibataire</option>
                    <option value="marie_pacse">Marié / Pacsé</option>
                    <option value="divorce">Divorcé</option>
                    <option value="veuf">Veuf</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="children_count">Enfants à charge</Label>
                  <Input
                    id="children_count"
                    type="number"
                    min={0}
                    max={10}
                    value={draft.children_count}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        children_count: Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Code postal</Label>
                  <Input
                    id="postal_code"
                    value={draft.postal_code}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, postal_code: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="commute_km_year">Km domicile-travail / an</Label>
                  <Input
                    id="commute_km_year"
                    type="number"
                    min={0}
                    value={draft.commute_km_year}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        commute_km_year: event.target.value === "" ? "" : Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly_income_eur">Revenu mensuel net (approx)</Label>
                  <Input
                    id="monthly_income_eur"
                    type="number"
                    min={0}
                    value={draft.monthly_income_eur}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        monthly_income_eur:
                          event.target.value === "" ? "" : Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground md:col-span-2">
                  <input
                    id="consent_rgpd"
                    type="checkbox"
                    className="mt-1"
                    checked={draft.consent_rgpd}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, consent_rgpd: event.target.checked }))
                    }
                  />
                  <Label htmlFor="consent_rgpd" className="text-xs text-muted-foreground">
                    J&apos;accepte le traitement de mes données conformément au RGPD.
                  </Label>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-2 text-muted-foreground">
                <p>
                  C&apos;est bon ! Tes informations sont prêtes pour personnaliser ton analyse.
                </p>
                <p>Tu peux modifier ces infos à tout moment dans Mon profil.</p>
              </div>
            )}

            <Button
              size="lg"
              className="w-full bg-emerald-600 text-white transition-transform hover:scale-[1.01] hover:bg-emerald-600"
              onClick={handleNext}
              disabled={loading}
            >
              {loading ? "Enregistrement..." : step === stepsTotal - 1 ? "Commencer" : "Continuer"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
