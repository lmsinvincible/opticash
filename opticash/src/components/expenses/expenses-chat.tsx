"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, X } from "lucide-react";
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

  const openChat = (prompt?: string) => {
    if (isMobile) {
      setIsOpen(true);
      setIsMobileOpen(true);
    } else {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
    if (prompt) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: prompt }]);
    }
  };

  useEffect(() => {
    const handler = (event?: Event) => {
      const detail =
        event && "detail" in event ? (event as CustomEvent<{ prompt?: string }>).detail : undefined;
      openChat(detail?.prompt);
    };
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
    const nextMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user" as const, content },
    ];
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
    <div ref={containerRef} id="expenses-chat" className="flex h-full flex-col">
      <div className="flex-1 overflow-auto rounded-xl border bg-white px-4 py-4 text-[15px] leading-relaxed text-gray-900">
        <div className="mb-4 flex items-center justify-center gap-3 text-xs text-gray-400">
          <div className="h-px w-12 bg-gray-200" />
          Début de conversation
          <div className="h-px w-12 bg-gray-200" />
        </div>
        <div className="space-y-3">
          {chatMessages.map((msg, index) => (
            <div
              key={`${msg.role}-${index}`}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl"
                    : "bg-gray-100 text-gray-900 rounded-tr-2xl rounded-tl-2xl rounded-br-2xl"
                } transition-all duration-200 ease-out`}
              >
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-full border bg-white px-3 py-2 shadow-sm">
        <input
          ref={inputRef}
          className="flex-1 rounded-full border-none bg-gray-100 px-4 py-2 text-sm placeholder:text-gray-500 focus:outline-none"
          placeholder="Pose ta question…"
          value={chatInput}
          onChange={(event) => setChatInput(event.target.value)}
        />
        <button
          type="button"
          onClick={handleChatSend}
          disabled={chatLoading}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
        </button>
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
              <div className="mb-3 flex items-center justify-between rounded-xl border bg-blue-50 px-3 py-2">
                <h3 className="text-sm font-semibold">Assistant OptiCash</h3>
                <button
                  className="rounded-full p-1 text-gray-500 hover:bg-gray-200"
                  onClick={() => {
                    setIsMobileOpen(false);
                    setIsOpen(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="h-[70vh]">{ChatBody}</div>
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
        <aside className="fixed right-6 top-24 z-30 hidden h-[72vh] w-[380px] flex-col gap-3 lg:flex">
          <div className="rounded-2xl border bg-background p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between rounded-xl border bg-blue-50 px-3 py-2">
              <h3 className="text-base font-semibold">Assistant OptiCash</h3>
              <button
                type="button"
                className="rounded-full p-1 text-gray-500 hover:bg-gray-200"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[60vh]">{ChatBody}</div>
          </div>
        </aside>
      ) : null}
    </>
  );
}
