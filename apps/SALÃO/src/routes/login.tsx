import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import {
  finishPanelGoogleRedirect,
  getCurrentPanelSession,
  sendPanelPasswordReset,
  signInWithPanelEmailPassword,
  signInWithPanelGoogle,
} from "@/lib/panel-auth";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — SALÃO" },
      { name: "description", content: "Acesso ao painel operacional do salão." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState<"email" | "google" | "reset" | null>(null);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        await finishPanelGoogleRedirect().catch(() => null);
        const session = await getCurrentPanelSession();
        if (active && session?.user && typeof window !== "undefined") {
          window.location.replace("/dashboard");
          return;
        }
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Não foi possível validar a sessão.");
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  async function handleEmailLogin() {
    if (!email.trim() || !password.trim()) {
      toast.error("Informe e-mail e senha.");
      return;
    }

    try {
      setSubmitting("email");
      await signInWithPanelEmailPassword({ email, password });
      toast.success("Sessão iniciada");
      if (typeof window !== "undefined") {
        window.location.replace("/dashboard");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleGoogleLogin() {
    try {
      setSubmitting("google");
      const session = await signInWithPanelGoogle();
      if (session?.user) {
        toast.success("Sessão iniciada");
        if (typeof window !== "undefined") {
          window.location.replace("/dashboard");
        }
        return;
      }

      toast.info("Conclua o fluxo do Google para finalizar o login.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar com Google.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      toast.error("Informe o e-mail para enviar a redefinição.");
      return;
    }

    try {
      setSubmitting("reset");
      await sendPanelPasswordReset(email);
      toast.success("E-mail de redefinição enviado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a redefinição.");
    } finally {
      setSubmitting(null);
    }
  }

  if (checkingSession) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Validando acesso ao painel...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid min-h-screen bg-[radial-gradient(circle_at_top,_rgba(200,125,97,0.12),_transparent_40%),linear-gradient(180deg,#fffaf6_0%,#f8f1ea_100%)] px-6 py-10 text-foreground">
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="flex flex-col justify-center">
            <span className="mb-6 inline-flex w-fit items-center rounded-full border border-border bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              SALÃO
            </span>
            <h1 className="max-w-2xl font-display text-5xl tracking-tight sm:text-6xl">
              Painel conectado à base real do seu salão.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground">
              Agenda, clientes, equipe, campanhas, caixa e estoque em um único fluxo operacional,
              usando a autenticação real do projeto.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-border bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Agenda</p>
                <p className="mt-2 text-sm font-medium">Criação e edição via RPC real</p>
              </div>
              <div className="rounded-3xl border border-border bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Financeiro</p>
                <p className="mt-2 text-sm font-medium">Caixa, despesas e repasses conectados</p>
              </div>
              <div className="rounded-3xl border border-border bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">CRM</p>
                <p className="mt-2 text-sm font-medium">Clientes e planos usando Supabase</p>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-border bg-white/90 p-6 shadow-xl shadow-stone-200/40 sm:p-8">
            <div className="mb-8">
              <p className="text-sm font-medium text-muted-foreground">Acesso do painel</p>
              <h2 className="mt-2 font-display text-3xl tracking-tight">Entrar na operação</h2>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">E-mail</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@empresa.com"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Senha</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Sua senha"
                />
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <Button className="h-11 rounded-full" disabled={submitting !== null} onClick={() => void handleEmailLogin()}>
                {submitting === "email" ? "Entrando..." : "Entrar com e-mail"}
              </Button>
              <Button variant="outline" className="h-11 rounded-full" disabled={submitting !== null} onClick={() => void handleGoogleLogin()}>
                {submitting === "google" ? "Abrindo Google..." : "Entrar com Google"}
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
              <button
                type="button"
                className="font-medium text-primary"
                disabled={submitting !== null}
                onClick={() => void handlePasswordReset()}
              >
                {submitting === "reset" ? "Enviando..." : "Esqueci minha senha"}
              </button>
              <button
                type="button"
                className="text-muted-foreground"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = "/";
                  }
                }}
              >
                Voltar
              </button>
            </div>
          </section>
        </div>
      </div>
      <Toaster position="top-right" />
    </>
  );
}
