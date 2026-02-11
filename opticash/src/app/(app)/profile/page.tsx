"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ProfileForm = {
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: string;
  marital_status: string;
  children_count: number;
  postal_code: string;
  phone: string;
  profession: string;
  monthly_income_eur: number | "";
  commute_km_year: number | "";
  has_per: boolean;
  has_assurance_vie: boolean;
  has_pea: boolean;
  consent_rgpd: boolean;
  is_premium: boolean;
  premium_until: string | null;
};

const emptyForm: ProfileForm = {
  first_name: "",
  last_name: "",
  birth_date: "",
  gender: "non_renseigne",
  marital_status: "celibataire",
  children_count: 0,
  postal_code: "",
  phone: "",
  profession: "",
  monthly_income_eur: "",
  commute_km_year: "",
  has_per: false,
  has_assurance_vie: false,
  has_pea: false,
  consent_rgpd: false,
  is_premium: false,
  premium_until: null,
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileForm>(emptyForm);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (!userId) return;
      const { data } = await supabase
        .from("profiles")
        .select(
          `first_name,last_name,birth_date,gender,marital_status,children_count,postal_code,
           phone,profession,monthly_income_eur,commute_km_year,has_per,has_assurance_vie,has_pea,
           consent_rgpd,is_premium,premium_until`
        )
        .eq("id", userId)
        .maybeSingle();
      if (!mounted) return;
      setProfile((prev) => ({
        ...prev,
        ...(data ?? {}),
        children_count: data?.children_count ?? 0,
        monthly_income_eur: data?.monthly_income_eur ?? "",
        commute_km_year: data?.commute_km_year ?? "",
      }));
      setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;
      if (!userId) {
        toast.error("Session invalide.");
        return;
      }
      await supabase
        .from("profiles")
        .update({
          ...profile,
          monthly_income_eur:
            profile.monthly_income_eur === "" ? null : Number(profile.monthly_income_eur),
          commute_km_year:
            profile.commute_km_year === "" ? null : Number(profile.commute_km_year),
          profile_completed: true,
        })
        .eq("id", userId);
      toast.success("Profil mis à jour.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur de mise à jour.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    const data = {
      profile,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "opticash-profile.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer ton compte ? Cette action est irréversible.")) return;
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        toast.error("Session invalide.");
        return;
      }
      const response = await fetch("/api/profile/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Impossible de supprimer le compte.");
      }
      toast.success("Compte supprimé.");
      window.location.href = "/";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur suppression.";
      toast.error(message);
    }
  };

  const handleAiCheck = async () => {
    setAiLoading(true);
    setAiNote(null);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        toast.error("Session invalide.");
        return;
      }
      const response = await fetch("/api/ai/profile-check", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profile),
      });
      if (!response.ok) {
        throw new Error("Analyse IA indisponible.");
      }
      const payload = (await response.json()) as { note: string };
      setAiNote(payload.note);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur IA.";
      toast.error(message);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-background p-6 text-sm text-muted-foreground">
        Chargement du profil...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mon profil</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Prénom</Label>
            <Input
              value={profile.first_name}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, first_name: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Nom</Label>
            <Input
              value={profile.last_name}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, last_name: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Date de naissance</Label>
            <Input
              type="date"
              value={profile.birth_date ?? ""}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, birth_date: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Sexe</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={profile.gender}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, gender: event.target.value }))
              }
            >
              <option value="non_renseigne">Non renseigné</option>
              <option value="femme">Femme</option>
              <option value="homme">Homme</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Situation familiale</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={profile.marital_status}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, marital_status: event.target.value }))
              }
            >
              <option value="celibataire">Célibataire</option>
              <option value="marie_pacse">Marié / Pacsé</option>
              <option value="divorce">Divorcé</option>
              <option value="veuf">Veuf</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Enfants à charge</Label>
            <Input
              type="number"
              min={0}
              value={profile.children_count}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  children_count: Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Code postal</Label>
            <Input
              value={profile.postal_code ?? ""}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, postal_code: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Téléphone</Label>
            <Input
              value={profile.phone ?? ""}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, phone: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Profession / Statut</Label>
            <Input
              value={profile.profession ?? ""}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, profession: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Revenu mensuel net (approx)</Label>
            <Input
              type="number"
              min={0}
              value={profile.monthly_income_eur}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  monthly_income_eur:
                    event.target.value === "" ? "" : Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Km domicile-travail / an</Label>
            <Input
              type="number"
              min={0}
              value={profile.commute_km_year}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  commute_km_year: event.target.value === "" ? "" : Number(event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Produits d’épargne</Label>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profile.has_per}
                  onChange={(event) =>
                    setProfile((prev) => ({ ...prev, has_per: event.target.checked }))
                  }
                />
                PER
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profile.has_assurance_vie}
                  onChange={(event) =>
                    setProfile((prev) => ({
                      ...prev,
                      has_assurance_vie: event.target.checked,
                    }))
                  }
                />
                Assurance-vie
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profile.has_pea}
                  onChange={(event) =>
                    setProfile((prev) => ({ ...prev, has_pea: event.target.checked }))
                  }
                />
                PEA
              </label>
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground md:col-span-2">
            <input
              type="checkbox"
              checked={profile.consent_rgpd}
              onChange={(event) =>
                setProfile((prev) => ({ ...prev, consent_rgpd: event.target.checked }))
              }
            />
            <span>J&apos;accepte le traitement de mes données conformément au RGPD.</span>
          </div>
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Sauvegarde..." : "Modifier mes informations"}
            </Button>
            <Button variant="outline" onClick={handleExport}>
              Exporter mes données
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer mon compte
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Abonnement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>Statut : {profile.is_premium ? "Premium" : "Gratuit"}</div>
          {profile.premium_until ? <div>Fin : {profile.premium_until}</div> : null}
          <Button variant="outline" size="sm">
            Gérer mon abonnement
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vérification IA du profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Je peux vérifier si tes infos sont suffisantes pour optimiser tes impôts.</p>
          <Button onClick={handleAiCheck} disabled={aiLoading}>
            {aiLoading ? "Analyse..." : "Vérifier mes infos"}
          </Button>
          {aiNote ? (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-foreground">
              {aiNote}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
