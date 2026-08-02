import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ImageAssetField } from "@/components/dashboard/image-asset-field";
import { ImageGalleryAssetField } from "@/components/dashboard/image-gallery-asset-field";
import { EmptyState, Section } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProductionPanelModuleKey } from "@/components/dashboard/production-module-keys";
import {
  appendCustomerTabItemEntry,
  appendCustomerTabPaymentEntry,
  closeCustomerTab,
  createFinancialTransaction,
  createTeamPayout,
  deletePost,
  deleteProduct,
  deletePromotion,
  openCustomerTabEntry,
  registerInventoryMovement,
  saveProduct,
  savePromotion,
  saveSalonPost,
  setStoreOrderStatus,
} from "@/lib/salon-repository";
import {
  resolveInventoryProductAssetUrl,
  resolveInventoryProductAssetUrls,
  resolveSalonAssetUrl,
  uploadInventoryProductImages,
  uploadSalonAssetFiles,
} from "@/lib/salon-media-assets";
import { resolveSalonPostAssetUrls, uploadSalonPostImages } from "@/lib/salon-post-assets";
import { brl, formatDateBR, useSalon } from "@/lib/salon-store";
import type { Product, ProductOrder, Promotion, Transaction } from "@/lib/salon-types";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function daysSinceDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const today = new Date();
  const diff = today.getTime() - date.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function formatComandaMethod(value: string) {
  const labels: Record<string, string> = {
    card: "Cartao",
    cash: "Dinheiro",
    other: "Outro",
    pix: "Pix",
    transfer: "Transferencia",
    voucher: "Voucher",
  };

  return labels[value] ?? value;
}

function formatPostFormat(value: string) {
  const labels: Record<string, string> = {
    before_after: "Antes e depois",
    reel: "Reel",
    standard: "Post",
    story: "Story",
  };

  return labels[value] ?? value;
}

function nextOrderStatus(currentStatus: ProductOrder["status"]) {
  const next: Partial<Record<ProductOrder["status"], ProductOrder["status"]>> = {
    cancelado: "cancelado",
    entregue: "entregue",
    novo: "separando",
    pronto: "entregue",
    separando: "pronto",
  };

  return next[currentStatus] ?? currentStatus;
}

function ModuleField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

type FeedComposerForm = {
  body: string;
  format: "before_after" | "reel" | "standard" | "story";
  imageUrl: string;
  professionalId: string;
  serviceId: string;
  title: string;
  videoUrl: string;
};

const defaultFeedForm: FeedComposerForm = {
  body: "",
  format: "standard",
  imageUrl: "",
  professionalId: "none",
  serviceId: "none",
  title: "",
  videoUrl: "",
};

const MAX_FEED_IMAGES = 5;
const MAX_PRODUCT_IMAGES = 6;

type FeedDraftImage = {
  file: File;
  previewUrl: string;
};

function createEmptyPromotion(): Promotion {
  return {
    active: true,
    channel: "App do cliente",
    description: "",
    discount: 10,
    id: "",
    imageUrl: "",
    name: "",
    redemptions: 0,
  };
}

function createEmptyProduct(): Product {
  return {
    active: true,
    brand: "",
    description: "",
    id: "",
    imageUrls: [],
    maxPurchaseQuantity: 1,
    minStock: 0,
    name: "",
    price: 0,
    stock: 0,
    unit: "un",
  };
}

function FeedPostGalleryCard({
  commentsCount,
  createdAt,
  expiresAt,
  format,
  galleryUrls,
  likes,
  onDelete,
  professionalName,
  serviceName,
  title,
  body,
}: {
  body: string;
  commentsCount: number;
  createdAt: string;
  expiresAt?: string | null;
  format: string;
  galleryUrls: string[];
  likes: number;
  onDelete: () => void;
  professionalName?: string | null;
  serviceName?: string | null;
  title: string;
}) {
  return (
    <div className="panel grid gap-5 p-5 text-sm lg:grid-cols-[280px_1fr_auto]">
      <div
        className={
          galleryUrls.length > 1
            ? "grid grid-cols-2 gap-2"
            : "overflow-hidden rounded-[28px] border border-border/70 bg-secondary/30"
        }
      >
        {galleryUrls.length ? (
          galleryUrls.slice(0, 4).map((imageUrl, index) => {
            const extraCount = galleryUrls.length - 4;
            const showCounter = extraCount > 0 && index === 3;

            return (
              <div
                key={`${title}-${index}`}
                className={`relative overflow-hidden rounded-[24px] border border-border/60 bg-secondary/30 ${
                  galleryUrls.length === 1
                    ? "aspect-[4/5]"
                    : galleryUrls.length === 3 && index === 0
                      ? "row-span-2 aspect-[4/5]"
                      : "aspect-square"
                }`}
              >
                <img
                  src={imageUrl}
                  alt={title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {showCounter ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-foreground/55 text-lg font-semibold text-background">
                    +{extraCount}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center rounded-[28px] border border-dashed border-border/70 bg-secondary/20 px-6 text-center text-xs text-muted-foreground">
            Este conteudo foi publicado sem imagem visivel.
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{title}</span>
          <span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
            {formatPostFormat(format)}
          </span>
          {galleryUrls.length ? (
            <span className="rounded-full border border-border/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {galleryUrls.length} foto{galleryUrls.length > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Publicado em {formatDateBR(createdAt)}
          {expiresAt ? ` - expira ${new Date(expiresAt).toLocaleString("pt-BR")}` : ""}
        </p>
        <p className="max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">
          {body || "Sem legenda adicional."}
        </p>
        {serviceName || professionalName ? (
          <div className="flex flex-wrap gap-2">
            {serviceName ? (
              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
                Servico: {serviceName}
              </span>
            ) : null}
            {professionalName ? (
              <span className="rounded-full bg-secondary px-3 py-1 text-[11px] text-muted-foreground">
                Profissional: {professionalName}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 lg:flex-col lg:items-end">
        <span className="text-xs text-muted-foreground">
          {likes} curtidas - {commentsCount} comentarios
        </span>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
          Excluir
        </Button>
      </div>
    </div>
  );
}

function useSalonRefreshRunner() {
  const { refresh, salonId } = useSalon();

  return async (action: (currentSalonId: string) => Promise<void>, successMessage: string) => {
    if (!salonId) {
      throw new Error("Salao ainda nao carregado.");
    }

    await action(salonId);
    await refresh();
    toast.success(successMessage);
  };
}

function PaymentsModule() {
  const run = useSalonRefreshRunner();
  const { appointments, clients, professionals, services, transactions } = useSalon();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    from: "",
    method: "todos",
    search: "",
    to: "",
    type: "todos",
  });
  const [form, setForm] = useState<Transaction>({
    amount: 0,
    category: "Servico",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    id: "",
    method: "pix",
    type: "entrada",
  });

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      if (filters.type !== "todos" && transaction.type !== filters.type) {
        return false;
      }

      if (filters.method !== "todos" && transaction.method !== filters.method) {
        return false;
      }

      if (filters.from && transaction.date < filters.from) {
        return false;
      }

      if (filters.to && transaction.date > filters.to) {
        return false;
      }

      if (
        normalizedSearch &&
        !`${transaction.description} ${transaction.category}`
          .toLowerCase()
          .includes(normalizedSearch)
      ) {
        return false;
      }

      return true;
    });
  }, [filters, transactions]);

  const appointmentAlerts = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            ["pendente", "confirmado"].includes(appointment.status) && appointment.deposit <= 0,
        )
        .map((appointment) => ({
          appointment,
          client: clients.find((client) => client.id === appointment.clientId),
          professional: professionals.find(
            (professional) => professional.id === appointment.professionalId,
          ),
          service: services.find((service) => service.id === appointment.serviceId),
        }))
        .slice(0, 6),
    [appointments, clients, professionals, services],
  );

  const totalIncome = filteredTransactions
    .filter((transaction) => transaction.type === "entrada")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpense = filteredTransactions
    .filter((transaction) => transaction.type === "saida")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const saveTransaction = async () => {
    if (!form.description.trim()) {
      toast.error("Informe a descricao do lancamento.");
      return;
    }

    if (form.amount <= 0) {
      toast.error("Informe um valor valido.");
      return;
    }

    try {
      await run(async (currentSalonId) => {
        await createFinancialTransaction(currentSalonId, form);
      }, "Lancamento financeiro registrado.");
      setDialogOpen(false);
      setForm({
        amount: 0,
        category: "Servico",
        date: new Date().toISOString().slice(0, 10),
        description: "",
        id: "",
        method: "pix",
        type: "entrada",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel registrar o lancamento.",
      );
    }
  };

  return (
    <div className="space-y-8">
      <Section
        title="Recebimentos e saidas"
        action={
          <Button className="rounded-full" onClick={() => setDialogOpen(true)}>
            Novo lancamento
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-5">
          <Input
            placeholder="Buscar descricao ou categoria"
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
          />
          <Select
            value={filters.type}
            onValueChange={(value) => setFilters((current) => ({ ...current, type: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saidas</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.method}
            onValueChange={(value) => setFilters((current) => ({ ...current, method: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os metodos</SelectItem>
              <SelectItem value="pix">Pix</SelectItem>
              <SelectItem value="dinheiro">Dinheiro</SelectItem>
              <SelectItem value="credito">Credito</SelectItem>
              <SelectItem value="debito">Debito</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={filters.from}
            onChange={(event) =>
              setFilters((current) => ({ ...current, from: event.target.value }))
            }
          />
          <Input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <MetricCard label="Entradas filtradas" value={brl(totalIncome)} />
          <MetricCard label="Saidas filtradas" value={brl(totalExpense)} />
          <MetricCard label="Saldo filtrado" value={brl(totalIncome - totalExpense)} />
        </div>
      </Section>

      <Section title="Alertas de sinal pendente">
        {appointmentAlerts.length ? (
          <div className="space-y-3">
            {appointmentAlerts.map(({ appointment, client, professional, service }) => (
              <div
                key={appointment.id}
                className="panel flex flex-wrap items-center justify-between gap-4 p-4 text-sm"
              >
                <div>
                  <p className="font-medium">{client?.name ?? "Cliente"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateBR(appointment.date)} {appointment.time} Â·{" "}
                    {service?.name ?? "Servico"} Â· {professional?.name ?? "Profissional"}
                  </p>
                </div>
                <span className="rounded-full bg-warning-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-warning">
                  Sem sinal
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Nao ha recebimentos pendentes sem sinal nesta leitura." />
        )}
      </Section>

      <Section title="Historico financeiro filtrado">
        {filteredTransactions.length ? (
          <div className="space-y-3">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="panel flex flex-wrap items-center justify-between gap-4 p-4 text-sm"
              >
                <div>
                  <p className="font-medium">{transaction.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateBR(transaction.date)} Â· {transaction.category} Â·{" "}
                    {transaction.method}
                  </p>
                </div>
                <span
                  className={
                    transaction.type === "entrada"
                      ? "font-medium text-success"
                      : "font-medium text-destructive"
                  }
                >
                  {transaction.type === "entrada" ? "+" : "-"} {brl(transaction.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Nenhum lancamento atende aos filtros atuais." />
        )}
      </Section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Novo lancamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <ModuleField label="Descricao">
              <Input
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </ModuleField>
            <div className="grid gap-4 md:grid-cols-2">
              <ModuleField label="Categoria">
                <Input
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, category: event.target.value }))
                  }
                />
              </ModuleField>
              <ModuleField label="Valor">
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, amount: Number(event.target.value) || 0 }))
                  }
                />
              </ModuleField>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <ModuleField label="Data">
                <Input
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, date: event.target.value }))
                  }
                />
              </ModuleField>
              <ModuleField label="Tipo">
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, type: value as Transaction["type"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saida</SelectItem>
                  </SelectContent>
                </Select>
              </ModuleField>
              <ModuleField label="Metodo">
                <Select
                  value={form.method}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, method: value as Transaction["method"] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="credito">Credito</SelectItem>
                    <SelectItem value="debito">Debito</SelectItem>
                  </SelectContent>
                </Select>
              </ModuleField>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveTransaction()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CommissionsModule() {
  const run = useSalonRefreshRunner();
  const { appointments, professionals } = useSalon();
  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7));

  const rows = useMemo(
    () =>
      professionals.map((professional) => {
        const completedAppointments = appointments.filter(
          (appointment) =>
            appointment.professionalId === professional.id &&
            appointment.status === "concluido" &&
            appointment.date.startsWith(periodMonth),
        );
        const revenue = completedAppointments.reduce(
          (sum, appointment) => sum + appointment.price,
          0,
        );
        const commissionAmount = revenue * (professional.commission / 100);

        return {
          commissionAmount,
          completedAppointments,
          professional,
          revenue,
        };
      }),
    [appointments, periodMonth, professionals],
  );

  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const totalCommission = rows.reduce((sum, row) => sum + row.commissionAmount, 0);

  const createPayoutRecord = async (
    professionalId: string,
    name: string,
    commissionAmount: number,
  ) => {
    const professional = professionals.find((item) => item.id === professionalId);
    if (!professional || commissionAmount <= 0) {
      toast.info("Nao existe comissao calculada para gerar repasse neste periodo.");
      return;
    }

    try {
      await run(async (currentSalonId) => {
        await createTeamPayout(currentSalonId, {
          amount: commissionAmount,
          professionalId: professional.id,
          title: `Repasse ${name} ${periodMonth}`,
        });
      }, `Repasse criado para ${name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel criar o repasse.");
    }
  };

  return (
    <div className="space-y-8">
      <Section title="Periodo de comissao">
        <div className="grid gap-4 md:grid-cols-4">
          <Input
            type="month"
            value={periodMonth}
            onChange={(event) => setPeriodMonth(event.target.value)}
          />
          <MetricCard label="Receita concluida" value={brl(totalRevenue)} />
          <MetricCard label="Comissao projetada" value={brl(totalCommission)} />
          <MetricCard
            label="Profissionais com movimento"
            value={String(rows.filter((row) => row.completedAppointments.length > 0).length)}
          />
        </div>
      </Section>

      <Section title="Equipe e repasses">
        <div className="space-y-3">
          {rows.map(({ commissionAmount, completedAppointments, professional, revenue }) => (
            <div
              key={professional.id}
              className="panel flex flex-wrap items-center justify-between gap-4 p-4 text-sm"
            >
              <div>
                <p className="font-medium">{professional.name}</p>
                <p className="text-xs text-muted-foreground">
                  {completedAppointments.length} atendimentos concluidos Â·{" "}
                  {professional.commission}% de comissao
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                  <p className="font-medium">{brl(revenue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Repasse sugerido</p>
                  <p className="font-medium">{brl(commissionAmount)}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void createPayoutRecord(professional.id, professional.name, commissionAmount)
                  }
                >
                  Criar repasse
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function PromotionsModule() {
  const run = useSalonRefreshRunner();
  const { promotions, salonId } = useSalon();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [form, setForm] = useState<Promotion>(createEmptyPromotion());

  const publishedCount = promotions.filter((promotion) => promotion.active).length;
  const campaignsWithImage = promotions.filter((promotion) => promotion.imageUrl?.trim()).length;

  const resetPromotionForm = () => {
    setForm(createEmptyPromotion());
    setIsUploadingImage(false);
  };

  const saveCampaign = async () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome da campanha.");
      return;
    }

    if (form.discount <= 0) {
      toast.error("Informe o desconto da campanha.");
      return;
    }

    try {
      await run(
        async (currentSalonId) => {
          await savePromotion(currentSalonId, form);
        },
        form.id ? "Campanha atualizada." : "Campanha criada.",
      );
      setDialogOpen(false);
      resetPromotionForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar a campanha.");
    }
  };

  const uploadPromotionImage = async (file: File) => {
    if (!salonId) {
      toast.error("Salao ainda nao carregado.");
      return;
    }

    setIsUploadingImage(true);
    try {
      const [uploadedPath] = await uploadSalonAssetFiles({
        files: [file],
        folder: "offers",
        salonId,
      });

      setForm((current) => ({ ...current, imageUrl: uploadedPath ?? current.imageUrl }));
      toast.success("Imagem da campanha enviada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar a imagem.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeCampaign = async (promotionId: string) => {
    try {
      await run(async (currentSalonId) => {
        await deletePromotion(currentSalonId, promotionId);
      }, "Campanha excluida.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel excluir a campanha.");
    }
  };

  return (
    <div className="space-y-8">
      <Section
        title="Campanhas e ofertas"
        action={
          <Button
            className="rounded-full"
            onClick={() => {
              resetPromotionForm();
              setDialogOpen(true);
            }}
          >
            Nova campanha
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Campanhas ativas" value={String(publishedCount)} />
          <MetricCard label="Campanhas totais" value={String(promotions.length)} />
          <MetricCard label="Campanhas com imagem" value={String(campaignsWithImage)} />
        </div>
      </Section>

      <Section title="Lista de campanhas">
        {promotions.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {promotions.map((promotion) => {
              const imageUrl = resolveSalonAssetUrl(promotion.imageUrl);

              return (
                <div key={promotion.id} className="panel overflow-hidden p-0">
                  {imageUrl ? (
                    <div className="aspect-[16/8] border-b border-border/70 bg-secondary/20">
                      <img
                        src={imageUrl}
                        alt={promotion.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[16/8] items-center justify-center border-b border-border/70 bg-secondary/20 px-6 text-center text-xs text-muted-foreground">
                      Essa campanha ainda nao tem imagem para aparecer no app cliente.
                    </div>
                  )}

                  <div className="grid gap-4 p-5 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{promotion.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {promotion.channel} - {promotion.discount}% de desconto
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                          promotion.active
                            ? "bg-success-soft text-success"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {promotion.active ? "Ativa" : "Pausada"}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {promotion.description || "Sem descricao para o app cliente."}
                    </p>

                    <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setForm({
                            ...promotion,
                            description: promotion.description ?? "",
                            imageUrl: promotion.imageUrl ?? "",
                          });
                          setDialogOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void run(
                            async (currentSalonId) => {
                              await savePromotion(currentSalonId, {
                                ...promotion,
                                active: !promotion.active,
                              });
                            },
                            promotion.active ? "Campanha pausada." : "Campanha reativada.",
                          )
                        }
                      >
                        {promotion.active ? "Pausar" : "Reativar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => void removeCampaign(promotion.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="Nenhuma campanha foi configurada ainda." />
        )}
      </Section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetPromotionForm();
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {form.id ? "Editar campanha" : "Nova campanha"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="grid gap-4">
              <ModuleField label="Nome">
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </ModuleField>
              <div className="grid gap-4 md:grid-cols-2">
                <ModuleField label="Canal">
                  <Input
                    value={form.channel}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, channel: event.target.value }))
                    }
                  />
                </ModuleField>
                <ModuleField label="Desconto (%)">
                  <Input
                    type="number"
                    value={form.discount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        discount: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </ModuleField>
              </div>
              <ModuleField label="Descricao para o app">
                <Textarea
                  rows={5}
                  value={form.description ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </ModuleField>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, active: event.target.checked }))
                  }
                />
                Campanha ativa
              </label>
            </div>

            <ImageAssetField
              label="Imagem da campanha"
              description="Essa imagem aparece no app cliente junto da oferta ativa."
              value={form.imageUrl ?? ""}
              previewUrl={resolveSalonAssetUrl(form.imageUrl)}
              onChange={(value) => setForm((current) => ({ ...current, imageUrl: value }))}
              onClear={() => setForm((current) => ({ ...current, imageUrl: "" }))}
              onUpload={(file) => void uploadPromotionImage(file)}
              isUploading={isUploadingImage}
              uploadLabel="Enviar imagem da campanha"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveCampaign()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeedModule() {
  const run = useSalonRefreshRunner();
  const { posts, professionals, services } = useSalon();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...defaultFeedForm });
  const [selectedImages, setSelectedImages] = useState<FeedDraftImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedImagesRef = useRef<FeedDraftImage[]>([]);

  const storyCount = posts.filter((post) => post.format === "story").length;
  const totalInteractions = posts.reduce((sum, post) => sum + post.likes + post.comments.length, 0);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => {
    return () => {
      selectedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  const clearSelectedImages = () => {
    setSelectedImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      selectedImagesRef.current = [];
      return [];
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetComposer = () => {
    setForm({ ...defaultFeedForm });
    clearSelectedImages();
  };

  const removeSelectedImage = (indexToRemove: number) => {
    setSelectedImages((current) =>
      current.filter((image, index) => {
        const shouldKeep = index !== indexToRemove;
        if (!shouldKeep) {
          URL.revokeObjectURL(image.previewUrl);
        }

        return shouldKeep;
      }),
    );
  };

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    setSelectedImages((current) => {
      const availableSlots = MAX_FEED_IMAGES - current.length;
      if (availableSlots <= 0) {
        toast.info(`Voce pode publicar ate ${MAX_FEED_IMAGES} fotos por post.`);
        return current;
      }

      const acceptedFiles = files.slice(0, availableSlots);
      if (acceptedFiles.length < files.length) {
        toast.info(`Somente ${MAX_FEED_IMAGES} fotos podem ser exibidas em cada post.`);
      }

      return [
        ...current,
        ...acceptedFiles.map((file) => ({
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ];
    });

    event.target.value = "";
  };

  const savePostRecord = async () => {
    if (!form.title.trim()) {
      toast.error("Informe o titulo do post.");
      return;
    }

    if (!selectedImages.length && !form.imageUrl.trim()) {
      toast.error("Adicione pelo menos uma foto do post ou uma URL de capa.");
      return;
    }

    if (form.format === "reel" && !form.videoUrl.trim()) {
      toast.error("Informe o video do reel.");
      return;
    }

    try {
      await run(
        async (currentSalonId) => {
          const uploadedImages = selectedImages.length
            ? await uploadSalonPostImages(
                currentSalonId,
                selectedImages.map((image) => image.file),
              )
            : [];
          const imageUrls = uploadedImages.length
            ? uploadedImages
            : form.imageUrl.trim()
              ? [form.imageUrl.trim()]
              : [];

          await saveSalonPost(currentSalonId, {
            body: form.body,
            format: form.format as "before_after" | "reel" | "standard" | "story",
            imageUrl: imageUrls[0] ?? "",
            imageUrls,
            professionalId: form.professionalId === "none" ? null : form.professionalId,
            serviceId: form.serviceId === "none" ? null : form.serviceId,
            title: form.title,
            videoUrl: form.videoUrl || null,
          });
        },
        form.format === "story" ? "Story publicado." : "Post publicado.",
      );
      setDialogOpen(false);
      resetComposer();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel publicar o conteudo.");
    }
  };

  const deletePostRecord = async (postId: string) => {
    try {
      await run(async (currentSalonId) => {
        await deletePost(currentSalonId, postId);
      }, "Conteudo removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel excluir o conteudo.");
    }
  };

  return (
    <div className="space-y-8">
      <Section
        title="Feed e stories"
        action={
          <Button
            className="rounded-full"
            onClick={() => {
              resetComposer();
              setDialogOpen(true);
            }}
          >
            Publicar conteudo
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Conteudos publicados" value={String(posts.length)} />
          <MetricCard label="Stories ativos" value={String(storyCount)} />
          <MetricCard label="Interacoes" value={String(totalInteractions)} />
          <MetricCard
            label="Formatos em uso"
            value={String(new Set(posts.map((post) => post.format)).size)}
          />
        </div>
      </Section>

      <Section title="Feed do app cliente">
        {posts.length ? (
          <div className="space-y-3">
            {posts.map((post) => {
              const galleryUrls = resolveSalonPostAssetUrls(
                post.imageUrls?.length ? post.imageUrls : [post.imageUrl],
              );
              const professionalName = post.professionalId
                ? professionals.find((professional) => professional.id === post.professionalId)
                    ?.name
                : null;
              const serviceName = post.serviceId
                ? services.find((service) => service.id === post.serviceId)?.name
                : null;

              return (
                <FeedPostGalleryCard
                  key={`gallery-${post.id}`}
                  body={post.body}
                  commentsCount={post.comments.length}
                  createdAt={post.createdAt}
                  expiresAt={post.expiresAt}
                  format={post.format}
                  galleryUrls={galleryUrls}
                  likes={post.likes}
                  onDelete={() => void deletePostRecord(post.id)}
                  professionalName={professionalName}
                  serviceName={serviceName}
                  title={post.title}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState text="Publique fotos com legenda para alimentar o feed do app cliente." />
        )}
      </Section>

      <Section title="Publicacoes recentes">
        {posts.length ? (
          <div className="space-y-3">
            {posts.map((post) => (
              <div
                key={post.id}
                className="panel flex flex-wrap items-start justify-between gap-4 p-4 text-sm"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{post.title}</span>
                    <span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
                      {post.format}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Publicado em {formatDateBR(post.createdAt)}
                    {post.expiresAt
                      ? ` Â· expira ${new Date(post.expiresAt).toLocaleString("pt-BR")}`
                      : ""}
                  </p>
                  <p className="max-w-3xl text-sm text-muted-foreground">
                    {post.body || "Sem legenda adicional."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {post.likes} curtidas Â· {post.comments.length} comentarios
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => void deletePostRecord(post.id)}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Ainda nao existe conteudo publicado no feed do salao." />
        )}
      </Section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            resetComposer();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Publicar conteudo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <ModuleField label="Titulo">
                <Input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </ModuleField>
              <ModuleField label="Formato">
                <Select
                  value={form.format}
                  onValueChange={(value) => setForm((current) => ({ ...current, format: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Post padrao</SelectItem>
                    <SelectItem value="before_after">Antes e depois</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                    <SelectItem value="reel">Reel</SelectItem>
                  </SelectContent>
                </Select>
              </ModuleField>
            </div>
            <ModuleField label="Legenda">
              <Textarea
                rows={4}
                value={form.body}
                onChange={(event) =>
                  setForm((current) => ({ ...current, body: event.target.value }))
                }
              />
            </ModuleField>
            <ModuleField label="Fotos do post">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                multiple
                className="hidden"
                onChange={handleImageSelection}
              />
              <div className="rounded-[28px] border border-dashed border-border/70 bg-secondary/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Galeria que aparece no app cliente</p>
                    <p className="text-xs text-muted-foreground">
                      Envie ate {MAX_FEED_IMAGES} fotos em JPG, PNG, WEBP ou SVG com no maximo 4 MB
                      cada.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Selecionar fotos
                  </Button>
                </div>

                {selectedImages.length ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedImages.map((image, index) => (
                      <div
                        key={`${image.file.name}-${index}`}
                        className="overflow-hidden rounded-[24px] border border-border/70 bg-background"
                      >
                        <div className="aspect-square">
                          <img
                            src={image.previewUrl}
                            alt={image.file.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">{image.file.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {(image.file.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => removeSelectedImage(index)}
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Nenhuma foto selecionada ainda. Se preferir, voce pode usar uma URL externa no
                    campo abaixo.
                  </p>
                )}
              </div>
            </ModuleField>
            <div className="grid gap-4 md:grid-cols-2">
              <ModuleField label="Imagem ou capa (URL)">
                <Input
                  value={form.imageUrl}
                  placeholder="https://..."
                  onChange={(event) =>
                    setForm((current) => ({ ...current, imageUrl: event.target.value }))
                  }
                />
              </ModuleField>
              <ModuleField label="Video do reel (URL)">
                <Input
                  value={form.videoUrl}
                  placeholder="https://..."
                  onChange={(event) =>
                    setForm((current) => ({ ...current, videoUrl: event.target.value }))
                  }
                />
              </ModuleField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <ModuleField label="Servico relacionado">
                <Select
                  value={form.serviceId}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, serviceId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem servico</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ModuleField>
              <ModuleField label="Profissional em destaque">
                <Select
                  value={form.professionalId}
                  onValueChange={(value) =>
                    setForm((current) => ({ ...current, professionalId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem profissional</SelectItem>
                    {professionals.map((professional) => (
                      <SelectItem key={professional.id} value={professional.id}>
                        {professional.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ModuleField>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void savePostRecord()}>Publicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BirthdaysModule() {
  const { clients, settings } = useSalon();

  const birthdays = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return clients
      .filter((client) => client.birthday)
      .map((client) => {
        const [, month, day] = client.birthday.split("-").map((value) => Number(value));
        const birthdayThisYear = new Date(today.getFullYear(), Math.max(0, month - 1), day || 1);
        if (birthdayThisYear < todayStart) {
          birthdayThisYear.setFullYear(today.getFullYear() + 1);
        }

        const daysUntil = Math.ceil((birthdayThisYear.getTime() - todayStart.getTime()) / 86400000);

        return {
          client,
          daysUntil,
          nextBirthday: birthdayThisYear,
        };
      })
      .sort((left, right) => left.daysUntil - right.daysUntil);
  }, [clients]);

  const inactiveClients = useMemo(
    () =>
      clients
        .map((client) => ({
          client,
          inactiveDays:
            client.lastVisit && client.lastVisit !== "-" ? daysSinceDate(client.lastVisit) : null,
        }))
        .filter((entry) => entry.inactiveDays != null && entry.inactiveDays >= 45)
        .sort((left, right) => (right.inactiveDays ?? 0) - (left.inactiveDays ?? 0))
        .slice(0, 10),
    [clients],
  );

  const copyMessage = async (name: string) => {
    const message = `Oi ${name}, aqui e o ${settings.name}. Passando para desejar um aniversario especial e deixar um presente reservado para voce no app do salao.`;

    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      toast.error("Nao foi possivel acessar a area de transferencia.");
      return;
    }

    await navigator.clipboard.writeText(message);
    toast.success(`Mensagem preparada para ${name}.`);
  };

  const openWhatsapp = (phone: string, name: string) => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      toast.error(`O cliente ${name} nao possui telefone valido.`);
      return;
    }

    const message = encodeURIComponent(`Oi ${name}, aqui e o ${settings.name}. Feliz aniversario!`);
    window.open(
      `https://wa.me/${normalizedPhone}?text=${message}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="space-y-8">
      <Section title="Proximos aniversarios">
        {birthdays.length ? (
          <div className="space-y-3">
            {birthdays.slice(0, 12).map(({ client, daysUntil, nextBirthday }) => (
              <div
                key={client.id}
                className="panel flex flex-wrap items-center justify-between gap-4 p-4 text-sm"
              >
                <div>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {client.birthday} Â· proximo em {nextBirthday.toLocaleDateString("pt-BR")} Â·{" "}
                    {daysUntil <= 0 ? "hoje" : `${daysUntil} dia(s)`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => void copyMessage(client.name)}>
                    Copiar mensagem
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openWhatsapp(client.phone, client.name)}
                  >
                    WhatsApp
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Nenhum aniversario cadastrado para os clientes atuais." />
        )}
      </Section>

      <Section title="Clientes em risco de retorno">
        {inactiveClients.length ? (
          <div className="space-y-3">
            {inactiveClients.map(({ client, inactiveDays }) => (
              <div
                key={client.id}
                className="panel flex flex-wrap items-center justify-between gap-4 p-4 text-sm"
              >
                <div>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Ultima visita em {client.lastVisit} Â· {inactiveDays} dias sem retornar
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => void copyMessage(client.name)}>
                    Copiar abordagem
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openWhatsapp(client.phone, client.name)}
                  >
                    Contatar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Nenhum cliente passou do limiar de reativacao nesta leitura." />
        )}
      </Section>
    </div>
  );
}

function InventoryModule() {
  const run = useSalonRefreshRunner();
  const { orders, products, salonId } = useSalon();
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<ProductOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [form, setForm] = useState<Product>(createEmptyProduct());
  const [movement, setMovement] = useState({
    movementType: "in",
    productId: products[0]?.id ?? "",
    quantity: 1,
    reason: "",
  });

  const lowStockProducts = products.filter((product) => product.stock <= product.minStock);
  const openOrders = orders.filter((order) => !["entregue", "cancelado"].includes(order.status));

  const resetProductForm = () => {
    setForm(createEmptyProduct());
    setIsUploadingImages(false);
  };

  const openNewProductDialog = () => {
    resetProductForm();
    setProductDialogOpen(true);
  };

  const saveCurrentProduct = async () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }

    try {
      await run(
        async (currentSalonId) => {
          await saveProduct(currentSalonId, {
            ...form,
            imageUrls: Array.from(
              new Set((form.imageUrls ?? []).map((imagePath) => imagePath.trim()).filter(Boolean)),
            ).slice(0, MAX_PRODUCT_IMAGES),
          });
        },
        form.id ? "Produto atualizado." : "Produto criado.",
      );
      setProductDialogOpen(false);
      resetProductForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar o produto.");
    }
  };

  const uploadProductImages = async (files: File[]) => {
    if (!salonId) {
      toast.error("Salao ainda nao carregado.");
      return;
    }

    setIsUploadingImages(true);
    try {
      const uploadedPaths = await uploadInventoryProductImages({
        files,
        salonId,
      });

      setForm((current) => ({
        ...current,
        imageUrls: Array.from(
          new Set(
            [...(current.imageUrls ?? []), ...uploadedPaths]
              .map((imagePath) => imagePath.trim())
              .filter(Boolean),
          ),
        ).slice(0, MAX_PRODUCT_IMAGES),
      }));
      toast.success("Imagens do produto enviadas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar as imagens.");
    } finally {
      setIsUploadingImages(false);
    }
  };

  const removeProductRecord = async (productId: string) => {
    try {
      await run(async (currentSalonId) => {
        await deleteProduct(currentSalonId, productId);
      }, "Produto excluido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel excluir o produto.");
    }
  };

  const saveMovement = async () => {
    if (!movement.productId) {
      toast.error("Selecione um produto.");
      return;
    }

    if (movement.quantity < 0) {
      toast.error("Informe uma quantidade valida.");
      return;
    }

    try {
      await run(async () => {
        await registerInventoryMovement({
          movementType: movement.movementType as "adjustment" | "in" | "out",
          productId: movement.productId,
          quantity: movement.quantity,
          reason: movement.reason,
        });
      }, "Movimentacao de estoque registrada.");
      setMovementOpen(false);
      setMovement({
        movementType: "in",
        productId: products[0]?.id ?? "",
        quantity: 1,
        reason: "",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel movimentar o estoque.",
      );
    }
  };

  const advanceOrder = async (order: ProductOrder) => {
    const status = nextOrderStatus(order.status);
    if (status === order.status) {
      return;
    }

    try {
      await run(async () => {
        await setStoreOrderStatus({
          orderId: order.id,
          status,
        });
      }, `Pedido #${order.orderNumber} atualizado para ${status}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel atualizar o pedido.");
    }
  };

  const cancelOrder = async () => {
    if (!orderToCancel) {
      return;
    }

    if (!cancelReason.trim()) {
      toast.error("Informe o motivo do cancelamento.");
      return;
    }

    try {
      await run(async () => {
        await setStoreOrderStatus({
          cancellationReason: cancelReason,
          orderId: orderToCancel.id,
          status: "cancelado",
        });
      }, `Pedido #${orderToCancel.orderNumber} cancelado.`);
      setCancelOpen(false);
      setOrderToCancel(null);
      setCancelReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel cancelar o pedido.");
    }
  };

  return (
    <div className="space-y-8">
      <Section
        title="Estoque e pedidos"
        action={
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-full" variant="outline" onClick={openNewProductDialog}>
              Novo produto
            </Button>
            <Button className="rounded-full" onClick={() => setMovementOpen(true)}>
              Movimentar estoque
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            label="Produtos ativos"
            value={String(products.filter((product) => product.active).length)}
          />
          <MetricCard label="Estoque critico" value={String(lowStockProducts.length)} />
          <MetricCard label="Pedidos abertos" value={String(openOrders.length)} />
          <MetricCard label="Pedidos totais" value={String(orders.length)} />
        </div>
      </Section>

      <Section title="Catalogo da loja e estoque">
        {products.length ? (
          <div className="space-y-3">
            {products.map((product) => {
              const imageUrl = resolveInventoryProductAssetUrl(product.imageUrls?.[0]);

              return (
                <div
                  key={product.id}
                  className="panel flex flex-wrap items-center justify-between gap-4 p-4 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex size-20 items-center justify-center overflow-hidden rounded-[24px] bg-secondary/20 text-[10px] text-muted-foreground">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        "sem foto"
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{product.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {product.brand || "Sem marca"} - minimo {product.minStock} -{" "}
                        {product.unit || "un"} - max. {product.maxPurchaseQuantity || 1}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {product.description || "Sem descricao para o app cliente."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <span
                      className={
                        product.stock <= product.minStock
                          ? "font-medium text-destructive"
                          : "font-medium"
                      }
                    >
                      {product.stock} {product.unit || "un"}
                    </span>
                    <span className="text-xs text-muted-foreground">{brl(product.price)}</span>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                        product.active
                          ? "bg-success-soft text-success"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {product.active ? "Ativo" : "Inativo"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setForm({
                          ...product,
                          brand: product.brand ?? "",
                          description: product.description ?? "",
                          imageUrls: product.imageUrls ?? [],
                          maxPurchaseQuantity: product.maxPurchaseQuantity ?? 1,
                          unit: product.unit ?? "un",
                        });
                        setProductDialogOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void run(
                          async (currentSalonId) => {
                            await saveProduct(currentSalonId, {
                              ...product,
                              active: !product.active,
                            });
                          },
                          product.active ? "Produto inativado." : "Produto reativado.",
                        )
                      }
                    >
                      {product.active ? "Inativar" : "Reativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => void removeProductRecord(product.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="Nenhum produto foi carregado para a loja e o estoque." />
        )}
      </Section>

      <Section title="Pedidos da loja">
        {orders.length ? (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="panel flex flex-wrap items-center justify-between gap-4 p-4 text-sm"
              >
                <div>
                  <p className="font-medium">
                    Pedido #{order.orderNumber} - {order.clientName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.productName} - {order.itemCount} item(ns) -{" "}
                    {formatDateBR(order.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
                    {order.status}
                  </span>
                  <span className="font-medium">{brl(order.total)}</span>
                  {!["entregue", "cancelado"].includes(order.status) ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => void advanceOrder(order)}>
                        Avancar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          setOrderToCancel(order);
                          setCancelOpen(true);
                        }}
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Ainda nao existem pedidos no fluxo da loja." />
        )}
      </Section>

      <Dialog
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);
          if (!open) {
            resetProductForm();
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {form.id ? "Editar produto" : "Novo produto"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <ModuleField label="Nome">
                  <Input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </ModuleField>
                <ModuleField label="Marca">
                  <Input
                    value={form.brand}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, brand: event.target.value }))
                    }
                  />
                </ModuleField>
              </div>
              <ModuleField label="Descricao para o app">
                <Textarea
                  rows={4}
                  value={form.description ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </ModuleField>
              <div className="grid gap-4 md:grid-cols-2">
                <ModuleField label="Preco (R$)">
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, price: Number(event.target.value) || 0 }))
                    }
                  />
                </ModuleField>
                <ModuleField label="Unidade">
                  <Input
                    value={form.unit ?? "un"}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, unit: event.target.value || "un" }))
                    }
                  />
                </ModuleField>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <ModuleField label="Estoque atual">
                  <Input
                    type="number"
                    value={form.stock}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, stock: Number(event.target.value) || 0 }))
                    }
                  />
                </ModuleField>
                <ModuleField label="Estoque minimo">
                  <Input
                    type="number"
                    value={form.minStock}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        minStock: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </ModuleField>
                <ModuleField label="Maximo por compra">
                  <Input
                    type="number"
                    value={form.maxPurchaseQuantity ?? 1}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxPurchaseQuantity: Number(event.target.value) || 1,
                      }))
                    }
                  />
                </ModuleField>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, active: event.target.checked }))
                  }
                />
                Produto ativo na loja do app cliente
              </label>
            </div>

            <ImageGalleryAssetField
              label="Galeria do produto"
              description="As imagens ficam publicas na loja do app cliente. Use a primeira como capa principal."
              value={form.imageUrls ?? []}
              previewUrls={resolveInventoryProductAssetUrls(form.imageUrls ?? [])}
              onChange={(value) => setForm((current) => ({ ...current, imageUrls: value }))}
              onUpload={(files) => void uploadProductImages(files)}
              isUploading={isUploadingImages}
              uploadLabel="Enviar imagens do produto"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveCurrentProduct()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Movimentar estoque</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <ModuleField label="Produto">
              <Select
                value={movement.productId}
                onValueChange={(value) =>
                  setMovement((current) => ({ ...current, productId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ModuleField>
            <div className="grid gap-4 md:grid-cols-2">
              <ModuleField label="Movimento">
                <Select
                  value={movement.movementType}
                  onValueChange={(value) =>
                    setMovement((current) => ({ ...current, movementType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Entrada</SelectItem>
                    <SelectItem value="out">Saida</SelectItem>
                    <SelectItem value="adjustment">Ajuste para estoque final</SelectItem>
                  </SelectContent>
                </Select>
              </ModuleField>
              <ModuleField
                label={movement.movementType === "adjustment" ? "Estoque final" : "Quantidade"}
              >
                <Input
                  type="number"
                  value={movement.quantity}
                  onChange={(event) =>
                    setMovement((current) => ({
                      ...current,
                      quantity: Number(event.target.value) || 0,
                    }))
                  }
                />
              </ModuleField>
            </div>
            <ModuleField label="Motivo">
              <Textarea
                rows={3}
                value={movement.reason}
                onChange={(event) =>
                  setMovement((current) => ({ ...current, reason: event.target.value }))
                }
              />
            </ModuleField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveMovement()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Cancelar pedido</DialogTitle>
          </DialogHeader>
          <ModuleField label="Motivo do cancelamento">
            <Textarea
              rows={3}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </ModuleField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={() => void cancelOrder()}>
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ComandasModule() {
  const run = useSalonRefreshRunner();
  const { clients, comandas, products, services } = useSalon();
  const [openDialog, setOpenDialog] = useState(false);
  const [itemDialog, setItemDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [activeTabId, setActiveTabId] = useState("");
  const [tabForm, setTabForm] = useState({
    clientId: "avulso",
    notes: "",
  });
  const [itemForm, setItemForm] = useState({
    amount: 0,
    description: "",
    inventoryProductId: "manual",
    quantity: 1,
    serviceId: "manual",
    sourceType: "manual",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    method: "pix",
    note: "",
  });

  const openTabs = comandas.filter((comanda) => comanda.status === "aberta");

  const resetItemForm = () => {
    setItemForm({
      amount: 0,
      description: "",
      inventoryProductId: "manual",
      quantity: 1,
      serviceId: "manual",
      sourceType: "manual",
    });
  };

  const openNewItemDialog = (tabId: string) => {
    setActiveTabId(tabId);
    resetItemForm();
    setItemDialog(true);
  };

  const openNewPaymentDialog = (tabId: string, balance: number) => {
    setActiveTabId(tabId);
    setPaymentForm({
      amount: Math.max(0, balance),
      method: "pix",
      note: "",
    });
    setPaymentDialog(true);
  };

  const selectedService = services.find((service) => service.id === itemForm.serviceId);
  const selectedProduct = products.find((product) => product.id === itemForm.inventoryProductId);

  const saveTab = async () => {
    try {
      await run(async (currentSalonId) => {
        await openCustomerTabEntry(currentSalonId, {
          clientId: tabForm.clientId === "avulso" ? null : tabForm.clientId,
          notes: tabForm.notes,
        });
      }, "Comanda aberta.");
      setOpenDialog(false);
      setTabForm({
        clientId: "avulso",
        notes: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel abrir a comanda.");
    }
  };

  const saveItem = async () => {
    if (!activeTabId) {
      return;
    }

    const sourceType = itemForm.sourceType;
    const description =
      sourceType === "service"
        ? (selectedService?.name ?? "")
        : sourceType === "product"
          ? (selectedProduct?.name ?? "")
          : itemForm.description;
    const amount =
      sourceType === "service"
        ? (selectedService?.price ?? 0)
        : sourceType === "product"
          ? (selectedProduct?.price ?? 0)
          : itemForm.amount;

    if (!description.trim()) {
      toast.error("Informe o item ou selecione servico/produto.");
      return;
    }

    if (amount <= 0) {
      toast.error("Informe um valor valido para o item.");
      return;
    }

    try {
      await run(async (currentSalonId) => {
        await appendCustomerTabItemEntry(currentSalonId, {
          amount,
          inventoryProductId: sourceType === "product" ? (selectedProduct?.id ?? null) : null,
          itemName: description,
          quantity: itemForm.quantity,
          serviceId: sourceType === "service" ? (selectedService?.id ?? null) : null,
          tabId: activeTabId,
        });
      }, "Item adicionado a comanda.");
      setItemDialog(false);
      resetItemForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel adicionar o item.");
    }
  };

  const savePayment = async () => {
    if (!activeTabId) {
      return;
    }

    if (paymentForm.amount <= 0) {
      toast.error("Informe um valor valido para o pagamento.");
      return;
    }

    try {
      await run(async (currentSalonId) => {
        await appendCustomerTabPaymentEntry(currentSalonId, {
          amount: paymentForm.amount,
          method: paymentForm.method,
          note: paymentForm.note,
          tabId: activeTabId,
        });
      }, "Pagamento registrado na comanda.");
      setPaymentDialog(false);
      setPaymentForm({
        amount: 0,
        method: "pix",
        note: "",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel registrar o pagamento.",
      );
    }
  };

  const closeTab = async (tabId: string) => {
    try {
      await run(async (currentSalonId) => {
        await closeCustomerTab(currentSalonId, tabId);
      }, "Comanda fechada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel fechar a comanda.");
    }
  };

  return (
    <div className="space-y-8">
      <Section
        title="Comandas e consumos"
        action={
          <Button className="rounded-full" onClick={() => setOpenDialog(true)}>
            Abrir comanda
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Comandas abertas" value={String(openTabs.length)} />
          <MetricCard label="Comandas totais" value={String(comandas.length)} />
          <MetricCard
            label="Saldo em aberto"
            value={brl(openTabs.reduce((sum, tab) => sum + Math.max(0, tab.total - tab.paid), 0))}
          />
        </div>
      </Section>

      <Section title="Fluxo operacional da comanda">
        {comandas.length ? (
          <div className="space-y-3">
            {comandas.map((comanda) => {
              const remaining = Math.max(0, comanda.total - comanda.paid);

              return (
                <div key={comanda.id} className="panel space-y-4 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {comanda.clientName} Â· {comanda.status}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Aberta as {comanda.opened}
                        {comanda.notes ? ` Â· ${comanda.notes}` : ""}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-right">
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-medium">{brl(comanda.total)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pago</p>
                        <p className="font-medium">{brl(comanda.paid)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className="font-medium">{brl(remaining)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Itens
                      </p>
                      {comanda.items.length ? (
                        <div className="space-y-2">
                          {comanda.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-4 text-xs"
                            >
                              <span>
                                {item.name} Â· {item.quantity}x
                              </span>
                              <span>{brl(item.price)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Nenhum item registrado.</p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-border p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Pagamentos
                      </p>
                      {comanda.payments.length ? (
                        <div className="space-y-2">
                          {comanda.payments.map((payment) => (
                            <div
                              key={payment.id}
                              className="flex items-center justify-between gap-4 text-xs"
                            >
                              <span>
                                {formatComandaMethod(payment.method)}
                                {payment.note ? ` Â· ${payment.note}` : ""}
                              </span>
                              <span>{brl(payment.amount)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Nenhum pagamento registrado.
                        </p>
                      )}
                    </div>
                  </div>

                  {comanda.status === "aberta" && (
                    <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openNewItemDialog(comanda.id)}
                      >
                        Adicionar item
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openNewPaymentDialog(comanda.id, remaining)}
                      >
                        Registrar pagamento
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void closeTab(comanda.id)}>
                        Fechar comanda
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="Nenhuma comanda foi aberta neste salao ainda." />
        )}
      </Section>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Abrir comanda</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <ModuleField label="Cliente">
              <Select
                value={tabForm.clientId}
                onValueChange={(value) =>
                  setTabForm((current) => ({ ...current, clientId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avulso">Cliente avulso</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ModuleField>
            <ModuleField label="Observacao">
              <Textarea
                rows={3}
                value={tabForm.notes}
                onChange={(event) =>
                  setTabForm((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </ModuleField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveTab()}>Abrir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Adicionar item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <ModuleField label="Origem">
              <Select
                value={itemForm.sourceType}
                onValueChange={(value) =>
                  setItemForm((current) => ({
                    ...current,
                    amount: 0,
                    description: "",
                    inventoryProductId: "manual",
                    serviceId: "manual",
                    sourceType: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="service">Servico</SelectItem>
                  <SelectItem value="product">Produto</SelectItem>
                </SelectContent>
              </Select>
            </ModuleField>
            {itemForm.sourceType === "service" && (
              <ModuleField label="Servico">
                <Select
                  value={itemForm.serviceId}
                  onValueChange={(value) =>
                    setItemForm((current) => ({ ...current, serviceId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Selecione</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ModuleField>
            )}
            {itemForm.sourceType === "product" && (
              <ModuleField label="Produto">
                <Select
                  value={itemForm.inventoryProductId}
                  onValueChange={(value) =>
                    setItemForm((current) => ({ ...current, inventoryProductId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Selecione</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ModuleField>
            )}
            {itemForm.sourceType === "manual" && (
              <div className="grid gap-4 md:grid-cols-2">
                <ModuleField label="Descricao">
                  <Input
                    value={itemForm.description}
                    onChange={(event) =>
                      setItemForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </ModuleField>
                <ModuleField label="Valor unitario">
                  <Input
                    type="number"
                    value={itemForm.amount}
                    onChange={(event) =>
                      setItemForm((current) => ({
                        ...current,
                        amount: Number(event.target.value) || 0,
                      }))
                    }
                  />
                </ModuleField>
              </div>
            )}
            <ModuleField label="Quantidade">
              <Input
                type="number"
                value={itemForm.quantity}
                onChange={(event) =>
                  setItemForm((current) => ({
                    ...current,
                    quantity: Number(event.target.value) || 1,
                  }))
                }
              />
            </ModuleField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void saveItem()}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Registrar pagamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <ModuleField label="Valor">
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      amount: Number(event.target.value) || 0,
                    }))
                  }
                />
              </ModuleField>
              <ModuleField label="Metodo">
                <Select
                  value={paymentForm.method}
                  onValueChange={(value) =>
                    setPaymentForm((current) => ({ ...current, method: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="card">Cartao</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                    <SelectItem value="voucher">Voucher</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </ModuleField>
            </div>
            <ModuleField label="Observacao">
              <Textarea
                rows={3}
                value={paymentForm.note}
                onChange={(event) =>
                  setPaymentForm((current) => ({ ...current, note: event.target.value }))
                }
              />
            </ModuleField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void savePayment()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function ProductionPanelModule({ moduleKey }: { moduleKey: ProductionPanelModuleKey }) {
  if (moduleKey === "dashboard.gestao.pagamentos") return <PaymentsModule />;
  if (moduleKey === "dashboard.gestao.comissoes") return <CommissionsModule />;
  if (moduleKey === "dashboard.benefits.promotions") return <PromotionsModule />;
  if (moduleKey === "dashboard.feed") return <FeedModule />;
  if (moduleKey === "dashboard.birthdays") return <BirthdaysModule />;
  if (moduleKey === "dashboard.inventory") return <InventoryModule />;
  if (moduleKey === "dashboard.operations.comandas") return <ComandasModule />;

  return null;
}
