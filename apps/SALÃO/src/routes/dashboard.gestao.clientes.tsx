import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, useSalon } from "@/lib/salon-store";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Client } from "@/lib/salon-types";

export const Route = createFileRoute("/dashboard/gestao/clientes")({
  component: ClientsPage,
});

type MembershipOffer = {
  id: string;
  price: number;
  sessionsIncluded: number;
  title: string;
  validityDays: number;
};

const emptyClient: Client = {
  birthday: "",
  email: "",
  id: "",
  lastVisit: "-",
  name: "",
  phone: "",
  since: new Date().toISOString().slice(0, 10),
  tags: [],
  totalSpent: 0,
  visits: 0,
};

function ClientsPage() {
  const {
    clients,
    createOrUpdateClient,
    deleteClient,
    refresh,
  } = useSalon();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Client>(emptyClient);
  const [planClient, setPlanClient] = useState<Client | null>(null);
  const [membershipOffers, setMembershipOffers] = useState<MembershipOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [assigningPlanId, setAssigningPlanId] = useState<string | null>(null);

  const filteredClients = useMemo(
    () =>
      clients.filter((client) => {
        const haystack = `${client.name} ${client.phone} ${client.email}`.toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
        if (filter === "vip") return client.tags.includes("VIP");
        if (filter === "risco") return client.tags.includes("Em risco");
        if (filter === "plano") return Boolean(client.plan);
        return true;
      }),
    [clients, filter, query],
  );

  const clientsWithPlan = clients.filter((client) => client.plan);

  async function handleSaveClient() {
    if (!form.name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }

    try {
      await createOrUpdateClient(form);
      toast.success(form.id ? "Cliente atualizado" : "Cliente cadastrado");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o cliente.");
    }
  }

  async function handleCopyContact(client: Client) {
    if (!client.phone.trim()) {
      toast.error("Este cliente não possui telefone cadastrado.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("O navegador não liberou a área de transferência.");
      return;
    }

    await navigator.clipboard.writeText(client.phone);
    toast.success(`Contato de ${client.name} copiado`);
  }

  async function handleOpenMembershipDialog(client: Client) {
    try {
      setLoadingOffers(true);
      setPlanClient(client);
      const { data, error } = await getSupabaseBrowserClient()
        .from("salon_offers")
        .select("id, title, price, membership_service_id, membership_sessions_included, membership_validity_days, is_active")
        .eq("kind", "membership")
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at");

      if (error) {
        throw error;
      }

      const offers = (data ?? [])
        .filter((offer) => offer.membership_service_id && offer.membership_sessions_included && offer.membership_validity_days)
        .map(
          (offer) =>
            ({
              id: String(offer.id),
              price: Number(offer.price ?? 0),
              sessionsIncluded: Number(offer.membership_sessions_included ?? 0),
              title: String(offer.title ?? "Plano"),
              validityDays: Number(offer.membership_validity_days ?? 0),
            }) satisfies MembershipOffer,
        );

      setMembershipOffers(offers);
      if (!offers.length) {
        toast.info("Nenhum plano real ativo foi encontrado para este salão.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar os planos.");
      setPlanClient(null);
    } finally {
      setLoadingOffers(false);
    }
  }

  async function handleAssignMembership(offerId: string) {
    if (!planClient) {
      return;
    }

    try {
      setAssigningPlanId(offerId);
      const { error } = await getSupabaseBrowserClient().rpc("assign_customer_membership_package", {
        customer_uuid: planClient.id,
        notes_input: null,
        offer_uuid: offerId,
        starts_on_input: null,
      });

      if (error) {
        throw error;
      }

      await refresh();
      toast.success(`Plano atribuído para ${planClient.name}`);
      setPlanClient(null);
      setMembershipOffers([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atribuir o plano.");
    } finally {
      setAssigningPlanId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="CRM e base de clientes do salão"
        actions={
          <Button
            className="rounded-full"
            onClick={() => {
              setForm(emptyClient);
              setOpen(true);
            }}
          >
            Cadastrar cliente
          </Button>
        }
      />

      <section className="mb-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Base total" value={String(clients.length)} />
        <StatCard label="Com plano ativo" value={String(clientsWithPlan.length)} tone="primary" />
        <StatCard label="Em risco" value={String(clients.filter((client) => client.tags.includes("Em risco")).length)} tone="warning" />
        <StatCard
          label="LTV médio"
          value={brl(clients.reduce((sum, client) => sum + client.totalSpent, 0) / (clients.length || 1))}
        />
      </section>

      <div className="panel mb-6 flex flex-wrap gap-3 p-4">
        <Input
          placeholder="Buscar por nome, telefone ou e-mail"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-sm"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="risco">Em risco</SelectItem>
            <SelectItem value="plano">Com plano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filteredClients.map((client) => (
          <div key={client.id} className="panel flex flex-wrap items-center gap-4 p-4">
            <span className="grid size-10 place-items-center rounded-full bg-secondary text-xs font-semibold">
              {client.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{client.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {client.phone} · {client.visits} atendimentos · {brl(client.totalSpent)}
                {client.plan ? ` · ${client.plan} (${client.planSessions} sessões)` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {client.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void handleCopyContact(client)}>
                Copiar contato
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleOpenMembershipDialog(client)}
              >
                Atribuir plano
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setForm(client);
                  setOpen(true);
                }}
              >
                Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  try {
                    await deleteClient(client.id);
                    toast.success("Cliente excluído");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Não foi possível excluir o cliente.");
                  }
                }}
              >
                Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {form.id ? "Editar cliente" : "Cadastrar cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Aniversário</Label>
                <Input
                  type="date"
                  value={form.birthday}
                  onChange={(event) => setForm({ ...form, birthday: event.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>E-mail</Label>
              <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveClient()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(planClient)} onOpenChange={(value) => !value && setPlanClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Atribuir plano real
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {loadingOffers && (
              <div className="rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground">
                Carregando planos ativos do salão...
              </div>
            )}
            {!loadingOffers && membershipOffers.length === 0 && (
              <div className="rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground">
                Cadastre um plano operacional em benefícios para habilitar esta ação.
              </div>
            )}
            {!loadingOffers && membershipOffers.map((offer) => (
              <button
                key={offer.id}
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-border px-4 py-3 text-left transition-colors hover:bg-secondary"
                onClick={() => void handleAssignMembership(offer.id)}
                disabled={assigningPlanId === offer.id}
              >
                <div>
                  <p className="font-medium">{offer.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {offer.sessionsIncluded} sessões · validade de {offer.validityDays} dias
                  </p>
                </div>
                <span className="text-sm font-medium">{brl(offer.price)}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanClient(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
