import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { brl, formatDateBR, useSalon } from "@/lib/salon-store";
import type { Expense } from "@/lib/salon-types";

export const Route = createFileRoute("/dashboard/finance/despesas")({
  component: ExpensesPage,
});

function ExpensesPage() {
  const { expenses, createOrUpdateExpense, markExpensePaid } = useSalon();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<Expense, "id" | "paid">>({
    amount: 0,
    description: "",
    dueDate: new Date().toISOString().slice(0, 10),
    recurring: false,
  });

  const pendingExpenses = expenses.filter((expense) => !expense.paid);
  const pendingTotal = pendingExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  async function handleCreateExpense() {
    if (!form.description.trim()) {
      toast.error("Informe a descrição.");
      return;
    }

    try {
      await createOrUpdateExpense({
        ...form,
        id: "",
        paid: false,
      });
      toast.success(form.recurring ? "Regra recorrente criada" : "Conta criada");
      setOpen(false);
      setForm({
        amount: 0,
        description: "",
        dueDate: new Date().toISOString().slice(0, 10),
        recurring: false,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a despesa.");
    }
  }

  async function handleSettleExpense(expense: Expense) {
    try {
      await markExpensePaid(expense);
      toast.success(expense.recurring ? "Competência lançada" : "Baixa registrada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível dar baixa nesta despesa.");
    }
  }

  return (
    <>
      <PageHeader
        title="Despesas"
        subtitle="Contas a pagar, despesas manuais e regras recorrentes"
        actions={<Button className="rounded-full" onClick={() => setOpen(true)}>Nova conta a pagar</Button>}
      />

      <section className="mb-8 grid gap-6 sm:grid-cols-3">
        <StatCard label="Em aberto" value={brl(pendingTotal)} tone="warning" />
        <StatCard label="Contas pendentes" value={String(pendingExpenses.length)} />
        <StatCard label="Recorrentes ativas" value={String(expenses.filter((expense) => expense.recurring).length)} tone="primary" />
      </section>

      <div className="space-y-3">
        {expenses.map((expense) => (
          <div key={expense.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
            <div>
              <p className="font-medium">{expense.description}</p>
              <p className="text-xs text-muted-foreground">
                Vence {formatDateBR(expense.dueDate)} · {expense.recurring ? "Recorrente" : "Avulsa"} · {expense.paid ? "Pago" : "Em aberto"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{brl(expense.amount)}</span>
              <span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-medium">
                {expense.recurring ? "Regra recorrente" : "Conta avulsa"}
              </span>
              <Button
                size="sm"
                variant={expense.paid ? "ghost" : "outline"}
                disabled={expense.paid}
                onClick={() => void handleSettleExpense(expense)}
              >
                {expense.recurring ? "Lançar competência" : expense.paid ? "Pago" : "Dar baixa"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Nova conta a pagar</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Valor</Label>
                <Input type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label>Vencimento</Label>
                <Input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.recurring} onCheckedChange={(checked) => setForm({ ...form, recurring: checked })} />
              Criar como regra recorrente
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleCreateExpense()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
