import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { today } from "@/lib/salon-seed";
import { useSalon } from "@/lib/salon-store";
import type { Appointment } from "@/lib/salon-types";

interface Props {
  editing?: Appointment | null;
  onOpenChange: (value: boolean) => void;
  open: boolean;
}

export function NewAppointmentDialog({ open, onOpenChange, editing }: Props) {
  const { clients, professionals, services, createOrUpdateAppointment } = useSalon();
  const [clientId, setClientId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(today());
  const [time, setTime] = useState("10:00");
  const [deposit, setDeposit] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setClientId(editing?.clientId ?? clients[0]?.id ?? "");
    setProfessionalId(editing?.professionalId ?? professionals[0]?.id ?? "");
    setServiceId(editing?.serviceId ?? services[0]?.id ?? "");
    setDate(editing?.date ?? today());
    setTime(editing?.time ?? "10:00");
    setDeposit(String(editing?.deposit ?? 0));
    setNotes(editing?.notes ?? "");
  }, [clients, editing, open, professionals, services]);

  async function handleSubmit() {
    const service = services.find((item) => item.id === serviceId);

    if (!clientId || !professionalId || !service) {
      toast.error("Selecione cliente, profissional e serviço.");
      return;
    }

    const record: Appointment = {
      clientId,
      date,
      deposit: Number(deposit) || 0,
      id: editing?.id ?? "",
      notes,
      price: service.price,
      professionalId,
      serviceId,
      status: editing?.status ?? "pendente",
      time,
      usedPlanSession: editing?.usedPlanSession ?? false,
    };

    try {
      setSaving(true);
      await createOrUpdateAppointment(record);
      toast.success(editing ? "Agendamento atualizado" : "Agendamento criado");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o agendamento.");
    } finally {
      setSaving(false);
    }
  }

  const blocked = clients.length === 0 || professionals.length === 0 || services.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {editing ? "Editar agendamento" : "Novo agendamento"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {blocked && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Cadastre ao menos um cliente, um profissional e um serviço para lançar agendamentos reais.
            </div>
          )}

          <div className="grid gap-2">
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Serviço</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder="Selecione um serviço" /></SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} - {service.duration}min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Profissional</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger><SelectValue placeholder="Selecione um profissional" /></SelectTrigger>
              <SelectContent>
                {professionals.map((professional) => (
                  <SelectItem key={professional.id} value={professional.id}>
                    {professional.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Hora</Label>
              <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Sinal (R$)</Label>
              <Input type="number" value={deposit} onChange={(event) => setDeposit(event.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={blocked || saving} onClick={() => void handleSubmit()}>
            {saving ? "Salvando..." : editing ? "Salvar" : "Criar agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
