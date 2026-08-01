import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { NewAppointmentDialog } from "@/components/dashboard/NewAppointmentDialog";
import { PageHeader } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { today } from "@/lib/salon-seed";
import { brl, formatDateBR, statusLabels, statusStyles, useSalon } from "@/lib/salon-store";
import type { Appointment, AppointmentStatus } from "@/lib/salon-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/gestao/agendamentos/")({
  component: AgendaPage,
});

const statuses: AppointmentStatus[] = [
  "pendente",
  "confirmado",
  "em_atendimento",
  "concluido",
  "cancelado",
  "faltou",
];

function AgendaPage() {
  const {
    appointments,
    clients,
    services,
    professionals,
    setAppointmentDeposit,
    setAppointmentPlanConsumption,
    setAppointmentStatus,
  } = useSalon();
  const [view, setView] = useState("dia");
  const [date, setDate] = useState(today());
  const [professionalFilter, setProfessionalFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const base = new Date(date);

    return appointments
      .filter((appointment) => {
        const appointmentDate = new Date(appointment.date);
        if (view === "dia" && appointment.date !== date) return false;
        if (view === "semana") {
          const diff = (appointmentDate.getTime() - base.getTime()) / 86400000;
          if (diff < 0 || diff > 6) return false;
        }
        if (view === "mes" && appointment.date.slice(0, 7) !== date.slice(0, 7)) return false;
        if (professionalFilter !== "todos" && appointment.professionalId !== professionalFilter) return false;
        if (statusFilter !== "todos" && appointment.status !== statusFilter) return false;
        return true;
      })
      .sort((left, right) => (left.date + left.time).localeCompare(right.date + right.time));
  }, [appointments, date, professionalFilter, statusFilter, view]);

  async function handleStatusChange(appointmentId: string, status: AppointmentStatus) {
    try {
      await setAppointmentStatus(appointmentId, status);
      toast.success(`Status alterado para ${statusLabels[status]}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o status.");
    }
  }

  async function handlePlanConsumption(appointment: Appointment) {
    if (appointment.status !== "concluido") {
      toast.error("A sessão do plano só pode ser consumida depois que o atendimento estiver concluído.");
      return;
    }

    try {
      await setAppointmentPlanConsumption(appointment.id, !appointment.usedPlanSession);
      toast.success(
        appointment.usedPlanSession
          ? "Sessão do plano estornada"
          : "Sessão do plano consumida",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a sessão do plano.");
    }
  }

  async function handleDepositBlur(appointment: Appointment, value: number) {
    if (Number.isNaN(value) || value === appointment.deposit) {
      return;
    }

    try {
      await setAppointmentDeposit(appointment.id, value);
      toast.success("Sinal atualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o sinal.");
    }
  }

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Gestão completa dos horários do salão"
        actions={
          <Button
            className="rounded-full"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Novo agendamento
          </Button>
        }
      />

      <div className="panel mb-6 flex flex-wrap items-center gap-3 p-4">
        <Tabs value={view} onValueChange={setView}>
          <TabsList>
            <TabsTrigger value="dia">Dia</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-44" />
        <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Profissional" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os profissionais</SelectItem>
            {professionals.map((professional) => (
              <SelectItem key={professional.id} value={professional.id}>
                {professional.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} resultados</span>
      </div>

      <div className="space-y-4">
        {filtered.map((appointment) => {
          const client = clients.find((item) => item.id === appointment.clientId);
          const service = services.find((item) => item.id === appointment.serviceId);
          const professional = professionals.find((item) => item.id === appointment.professionalId);

          return (
            <div key={appointment.id} className="panel p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-20 border-r border-border pr-4">
                  <p className="text-sm font-bold">{appointment.time}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDateBR(appointment.date)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{client?.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {service?.name} · {professional?.name}
                  </p>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-[10px] font-bold uppercase", statusStyles[appointment.status])}>
                  {statusLabels[appointment.status]}
                </span>
                <span className="text-sm font-medium">{brl(appointment.price)}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Select
                  value={appointment.status}
                  onValueChange={(value) => void handleStatusChange(appointment.id, value as AppointmentStatus)}
                >
                  <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sinal</span>
                  <Input
                    key={`${appointment.id}-${appointment.deposit}`}
                    type="number"
                    defaultValue={appointment.deposit}
                    onBlur={(event) => void handleDepositBlur(appointment, Number(event.target.value))}
                    className="h-8 w-24 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  variant={appointment.usedPlanSession ? "secondary" : "outline"}
                  onClick={() => void handlePlanConsumption(appointment)}
                >
                  {appointment.usedPlanSession ? "Estornar sessão do plano" : "Consumir sessão do plano"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(appointment);
                    setOpen(true);
                  }}
                >
                  Editar
                </Button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="panel p-12 text-center text-sm text-muted-foreground">
            Nenhum agendamento com esses filtros.
          </div>
        )}
      </div>

      <NewAppointmentDialog
        key={editing?.id ?? "novo"}
        open={open}
        onOpenChange={setOpen}
        editing={editing}
      />
    </>
  );
}
