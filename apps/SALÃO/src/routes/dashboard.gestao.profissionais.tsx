import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { today } from "@/lib/salon-seed";
import { brl, formatDateBR, useSalon } from "@/lib/salon-store";
import type { Block, Professional } from "@/lib/salon-types";

export const Route = createFileRoute("/dashboard/gestao/profissionais")({
  component: TeamPage,
});

const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function createEmptyProfessional(): Professional {
  return {
    active: true,
    commission: 40,
    endTime: "19:00",
    id: "",
    name: "",
    phone: "",
    role: "",
    serviceIds: [],
    startTime: "09:00",
    workdays: ["Seg", "Ter", "Qua", "Qui", "Sex"],
  };
}

function TeamPage() {
  const {
    professionals,
    services,
    blocks,
    appointments,
    createOrUpdateProfessional,
    deleteProfessional,
    deleteBlock,
    saveBlock,
  } = useSalon();
  const [open, setOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockProfessionalId, setBlockProfessionalId] = useState(professionals[0]?.id ?? "");
  const [blockDate, setBlockDate] = useState(today());
  const [blockFrom, setBlockFrom] = useState("12:00");
  const [blockTo, setBlockTo] = useState("13:00");
  const [blockReason, setBlockReason] = useState("");
  const [form, setForm] = useState<Professional>(createEmptyProfessional());

  const revenueOf = (professionalId: string) =>
    appointments
      .filter((appointment) => appointment.professionalId === professionalId && appointment.status === "concluido")
      .reduce((sum, appointment) => sum + appointment.price, 0);

  async function handleSaveProfessional() {
    if (!form.name.trim()) {
      toast.error("Informe o nome do profissional.");
      return;
    }

    try {
      await createOrUpdateProfessional(form);
      toast.success(form.id ? "Profissional atualizado" : "Profissional cadastrado");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o profissional.");
    }
  }

  async function handleSaveBlock() {
    if (!blockProfessionalId) {
      toast.error("Selecione um profissional para bloquear a agenda.");
      return;
    }

    const payload: Block = {
      date: blockDate,
      from: blockFrom,
      id: "",
      professionalId: blockProfessionalId,
      reason: blockReason || "Bloqueio",
      to: blockTo,
    };

    try {
      await saveBlock(payload);
      toast.success("Bloqueio criado");
      setBlockOpen(false);
      setBlockReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o bloqueio.");
    }
  }

  return (
    <>
      <PageHeader
        title="Equipe"
        subtitle="Profissionais, horários, comissões e bloqueios"
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                if (!professionals.length) {
                  toast.info("Cadastre um profissional antes de criar bloqueios.");
                  return;
                }
                setBlockProfessionalId(professionals[0]?.id ?? "");
                setBlockOpen(true);
              }}
            >
              Novo bloqueio
            </Button>
            <Button
              className="rounded-full"
              onClick={() => {
                setForm(createEmptyProfessional());
                setOpen(true);
              }}
            >
              Cadastrar profissional
            </Button>
          </>
        }
      />

      <section className="mb-8 grid gap-6 sm:grid-cols-3">
        <StatCard label="Profissionais ativos" value={String(professionals.filter((professional) => professional.active).length)} />
        <StatCard
          label="Comissão média"
          value={`${Math.round(professionals.reduce((sum, professional) => sum + professional.commission, 0) / (professionals.length || 1))}%`}
          tone="primary"
        />
        <StatCard label="Bloqueios ativos" value={String(blocks.length)} tone="warning" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {professionals.map((professional) => (
          <div key={professional.id} className="panel p-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-medium">{professional.name}</h3>
                <p className="text-xs text-muted-foreground">{professional.role} · {professional.phone}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Switch
                  checked={professional.active}
                  onCheckedChange={async (checked) => {
                    try {
                      await createOrUpdateProfessional({ ...professional, active: checked });
                      toast.success(checked ? "Profissional ativado" : "Profissional inativado");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o profissional.");
                    }
                  }}
                />
                {professional.active ? "Ativo" : "Inativo"}
              </div>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
              <div><p className="text-muted-foreground">Comissão</p><p className="font-medium">{professional.commission}%</p></div>
              <div><p className="text-muted-foreground">Jornada</p><p className="font-medium">{professional.startTime}-{professional.endTime}</p></div>
              <div><p className="text-muted-foreground">Faturou</p><p className="font-medium">{brl(revenueOf(professional.id))}</p></div>
            </div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Dias</p>
            <p className="mb-3 text-xs">{professional.workdays.join(" · ")}</p>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Serviços</p>
            <p className="mb-4 text-xs">
              {professional.serviceIds.map((serviceId) => services.find((service) => service.id === serviceId)?.name).filter(Boolean).join(", ") || "Nenhum"}
            </p>
            <div className="flex gap-2 border-t border-border pt-4">
              <Button size="sm" variant="outline" onClick={() => { setForm(professional); setOpen(true); }}>
                Editar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await createOrUpdateProfessional({ ...professional, active: false });
                    toast.success("Profissional inativado");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Não foi possível desligar o profissional.");
                  }
                }}
              >
                Desligar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  try {
                    await deleteProfessional(professional.id);
                    toast.success("Profissional excluído");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Não foi possível excluir o profissional.");
                  }
                }}
              >
                Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-4 mt-10 text-lg font-medium">Bloqueios de agenda</h2>
      <div className="space-y-3">
        {blocks.map((block) => (
          <div key={block.id} className="panel flex items-center justify-between p-4 text-sm">
            <span>
              {professionals.find((professional) => professional.id === block.professionalId)?.name} · {formatDateBR(block.date)} · {block.from}-{block.to} - {block.reason}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={async () => {
                try {
                  await deleteBlock(block.id);
                  toast.success("Bloqueio removido");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Não foi possível remover o bloqueio.");
                }
              }}
            >
              Remover
            </Button>
          </div>
        ))}
        {blocks.length === 0 && <div className="panel p-8 text-center text-sm text-muted-foreground">Nenhum bloqueio ativo.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {form.id ? "Editar profissional" : "Cadastrar profissional"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Função</Label>
                <Input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Início</Label>
                <Input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Fim</Label>
                <Input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Comissão (%)</Label>
              <Input type="number" value={form.commission} onChange={(event) => setForm({ ...form, commission: Number(event.target.value) })} />
            </div>
            <div className="grid gap-2">
              <Label>Dias de trabalho</Label>
              <div className="flex flex-wrap gap-3">
                {weekDays.map((day) => (
                  <label key={day} className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={form.workdays.includes(day)}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          workdays: checked
                            ? Array.from(new Set([...form.workdays, day]))
                            : form.workdays.filter((value) => value !== day),
                        })
                      }
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Serviços atribuídos</Label>
              <div className="grid grid-cols-2 gap-2">
                {services.map((service) => (
                  <label key={service.id} className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={form.serviceIds.includes(service.id)}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          serviceIds: checked
                            ? Array.from(new Set([...form.serviceIds, service.id]))
                            : form.serviceIds.filter((value) => value !== service.id),
                        })
                      }
                    />
                    {service.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveProfessional()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Novo bloqueio</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Label>Profissional</Label>
            <select
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
              value={blockProfessionalId}
              onChange={(event) => setBlockProfessionalId(event.target.value)}
            >
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2">
              <Input type="date" value={blockDate} onChange={(event) => setBlockDate(event.target.value)} />
              <Input type="time" value={blockFrom} onChange={(event) => setBlockFrom(event.target.value)} />
              <Input type="time" value={blockTo} onChange={(event) => setBlockTo(event.target.value)} />
            </div>
            <Input placeholder="Motivo" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveBlock()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
