import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl, formatDateBR, useSalon } from "@/lib/salon-store";
import type { Transaction } from "@/lib/salon-types";

export const Route = createFileRoute("/dashboard/finance/")({
  component: FinancePage,
});

function FinancePage() {
  const {
    transactions,
    professionals,
    appointments,
    cashOpen,
    createTeamPayout,
    createTransaction,
    setCashOpen,
  } = useSalon();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Transaction>({
    amount: 0,
    category: "Serviço",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    id: "",
    method: "pix",
    type: "entrada",
  });

  const entradas = transactions.filter((transaction) => transaction.type === "entrada").reduce((sum, transaction) => sum + transaction.amount, 0);
  const saidas = transactions.filter((transaction) => transaction.type === "saida").reduce((sum, transaction) => sum + transaction.amount, 0);
  const ticketCount = transactions.filter((transaction) => transaction.type === "entrada").length;

  const payoutAmountOf = (professionalId: string, commission: number) => {
    const revenue = appointments
      .filter((appointment) => appointment.professionalId === professionalId && appointment.status === "concluido")
      .reduce((sum, appointment) => sum + appointment.price, 0);

    return revenue * (commission / 100);
  };

  async function handleToggleCashSession() {
    try {
      await setCashOpen(!cashOpen);
      toast.success(cashOpen ? "Caixa fechado" : "Caixa aberto");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o caixa.");
    }
  }

  async function handleSaveTransaction() {
    if (!form.description.trim()) {
      toast.error("Informe a descrição.");
      return;
    }

    try {
      await createTransaction(form);
      toast.success("Transação registrada");
      setOpen(false);
      setForm({
        amount: 0,
        category: "Serviço",
        date: new Date().toISOString().slice(0, 10),
        description: "",
        id: "",
        method: "pix",
        type: "entrada",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a transação.");
    }
  }

  async function handleCreatePayout(professionalId: string, name: string, commission: number) {
    const professional = professionals.find((item) => item.id === professionalId);
    const payoutAmount = payoutAmountOf(professionalId, commission);

    if (!professional || payoutAmount <= 0) {
      toast.info("Ainda não existe faturamento concluído suficiente para gerar este repasse.");
      return;
    }

    try {
      await createTeamPayout(professional, payoutAmount);
      toast.success(`Repasse criado para ${name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o repasse.");
    }
  }

  return (
    <>
      <PageHeader
        title="Caixa"
        subtitle="Receita, transações e leitura financeira"
        actions={
          <>
            <Button variant="outline" className="rounded-full" onClick={() => void handleToggleCashSession()}>
              {cashOpen ? "Fechar caixa" : "Abrir caixa"}
            </Button>
            <Button className="rounded-full" onClick={() => setOpen(true)}>Nova transação</Button>
          </>
        }
      />

      <section className="mb-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Entradas" value={brl(entradas)} tone="success" />
        <StatCard label="Saídas" value={brl(saidas)} tone="warning" />
        <StatCard label="Saldo" value={brl(entradas - saidas)} tone="primary" />
        <StatCard label="Ticket médio" value={brl(entradas / (ticketCount || 1))} />
      </section>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">Movimentação</h2>
        <span className={`rounded-full px-3 py-1 text-xs ${cashOpen ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}>
          Caixa {cashOpen ? "aberto" : "fechado"}
        </span>
      </div>
      <div className="space-y-2">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="panel flex items-center justify-between p-4 text-sm">
            <div>
              <p className="font-medium">{transaction.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateBR(transaction.date)} · {transaction.category} · {transaction.method}
              </p>
            </div>
            <span className={transaction.type === "entrada" ? "font-medium text-success" : "font-medium text-destructive"}>
              {transaction.type === "entrada" ? "+" : "-"} {brl(transaction.amount)}
            </span>
          </div>
        ))}
      </div>

      <h2 className="mb-4 mt-10 text-lg font-medium">Repasses da equipe</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {professionals.map((professional) => {
          const payoutAmount = payoutAmountOf(professional.id, professional.commission);

          return (
            <div key={professional.id} className="panel flex items-center justify-between p-4 text-sm">
              <div>
                <span>{professional.name} · comissão {professional.commission}%</span>
                <p className="text-xs text-muted-foreground">Sugestão de repasse: {brl(payoutAmount)}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleCreatePayout(professional.id, professional.name, professional.commission)}
              >
                Criar repasse
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Nova transação</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Valor</Label>
                <Input type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>Data</Label>
                <Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value as Transaction["type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Método</Label>
                <Select value={form.method} onValueChange={(value) => setForm({ ...form, method: value as Transaction["method"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                    <SelectItem value="debito">Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveTransaction()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
