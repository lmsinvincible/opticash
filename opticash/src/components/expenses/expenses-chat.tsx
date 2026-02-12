"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ExpensesChatProps = {
  summary: Record<string, unknown>;
  isPremium?: boolean;
  title?: string;
};

const DEFAULT_PROMPT =
  "Salut ! Je peux t’aider sur tes dépenses. Pose-moi une question, par exemple :\n" +
  "- Combien chez Carrefour ce mois-ci ?\n" +
  "- Résumé de mes dépenses alimentaires\n" +
  "- Fais-moi un PDF de mes dépenses du mois";

export function ExpensesChat({ summary, isPremium = true, title = "Assistant dépenses" }: ExpensesChatProps) {
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (chatMessages.length === 0) {
      setChatMessages([{ role: "assistant", content: DEFAULT_PROMPT }]);
    }
  }, [chatMessages.length]);

  const openChat = () => {
    if (isMobile) {
      setIsOpen(true);
      setIsMobileOpen(true);
    } else {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  };

  useEffect(() => {
    const handler = () => openChat();
    window.addEventListener("opticash:open-chat", handler);
    return () => window.removeEventListener("opticash:open-chat", handler);
  }, [isMobile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = window.localStorage.getItem("opticash:open-chat");
    if (flag === "1") {
      window.localStorage.removeItem("opticash:open-chat");
      openChat();
    }
  }, [isMobile]);

  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get("openChat") === "1") {
      openChat();
    }
  }, [isMobile, searchParams]);

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const content = chatInput.trim();
    const nextMessages = [...chatMessages, { role: "user", content }];
    setChatMessages(nextMessages);
    setChatInput("");

    if (!isPremium && /pdf|export|résumé/i.test(content)) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Cette fonctionnalité est Premium. Passe en Premium pour générer des PDF.",
        },
      ]);
      return;
    }

    setChatLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        toast.error("Session invalide. Merci de vous reconnecter.");
        return;
      }
      const response = await fetch("/api/ai/expenses-chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: nextMessages, summary }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Impossible de contacter l’IA.");
      }
      const payload = (await response.json()) as { reply: string };
      setChatMessages((prev) => [...prev, { role: "assistant", content: payload.reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur IA";
      toast.error(message);
    } finally {
      setChatLoading(false);
    }
  };

  const ChatBody = (
    <div ref={containerRef} id="expenses-chat" className="flex h-full flex-col gap-3">
      <div className="flex-1 space-y-2 overflow-auto rounded-md border p-3 text-sm text-muted-foreground">
        {chatMessages.map((msg, index) => (
          <div
            key={`${msg.role}-${index}`}
            className={
              msg.role === "user"
                ? "rounded-md bg-muted/40 p-2 text-foreground"
                : "rounded-md bg-emerald-50/60 p-2 text-emerald-900"
            }
          >
            {msg.content}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          placeholder="Pose ta question…"
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
        />
        <Button size="sm" onClick={handleChatSend} disabled={chatLoading}>
          {chatLoading ? "Analyse..." : "Envoyer"}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <button
          className="fixed bottom-6 right-6 z-40 rounded-full bg-gradient-to-br from-slate-900 via-indigo-700 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg"
          onClick={() => {
            setIsOpen(true);
            setIsMobileOpen(true);
          }}
        >
          Chat IA
        </button>
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/30">
            <div className="w-full rounded-t-2xl bg-background p-4 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{title}</h3>
                <button
                  className="text-sm text-muted-foreground"
                  onClick={() => {
                    setIsMobileOpen(false);
                    setIsOpen(false);
                  }}
                >
                  Fermer
                </button>
              </div>
              <div className="h-72">{ChatBody}</div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-6 right-6 z-40 hidden rounded-full bg-gradient-to-br from-slate-900 via-indigo-700 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg lg:flex"
        onClick={() => setIsOpen(true)}
      >
        Chat IA
      </button>
      {isOpen ? (
        <aside className="fixed right-6 top-28 z-30 hidden h-[70vh] w-80 flex-col gap-3 lg:flex">
          <div className="rounded-xl border bg-background p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{title}</h3>
              <button
                type="button"
                className="text-xs text-muted-foreground"
                onClick={() => setIsOpen(false)}
              >
                Fermer
              </button>
            </div>
            <div className="h-[58vh]">{ChatBody}</div>
          </div>
        </aside>
      ) : null}
    </>
  );
}
