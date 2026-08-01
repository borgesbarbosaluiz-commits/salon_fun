import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Toaster } from "@/components/ui/sonner";
import { SalonProvider, useSalon } from "@/lib/salon-store";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel — SALÃO" },
      { name: "description", content: "Painel real de gestão do salão: agenda, clientes, equipe e financeiro." },
      { property: "og:title", content: "Painel — SALÃO" },
      { property: "og:description", content: "Gestão completa do salão em um só lugar." },
    ],
  }),
  component: DashboardRouteComponent,
});

function DashboardRouteComponent() {
  return (
    <SalonProvider>
      <DashboardGate />
      <Toaster position="top-right" />
    </SalonProvider>
  );
}

function DashboardGate() {
  const { authStatus } = useSalon();

  useEffect(() => {
    if (authStatus === "signed_out" && typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }, [authStatus]);

  if (authStatus === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Carregando sessão do painel...
        </div>
      </div>
    );
  }

  if (authStatus === "signed_out") {
    return null;
  }

  return <DashboardShell />;
}
