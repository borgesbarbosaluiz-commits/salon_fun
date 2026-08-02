import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { EmptyState, Section } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { brl, useSalon } from "@/lib/salon-store";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type JsonRecord = Record<string, any>;

type MarketingDashboard = {
  birthday_customers: Array<{
    birth_date: string | null;
    birth_day: number;
    customer_id: string;
    name: string;
    phone: string | null;
  }>;
  birthdays_this_month: number;
  customers_with_birth_date: number;
  inactive_customers: Array<{
    customer_id: string;
    inactive_days: number;
    last_service_name: string | null;
    last_visit_at: string | null;
    name: string;
    phone: string | null;
  }>;
  inactive_threshold_days: number;
  inactive_total: number;
  loyalty_tiers: Array<{
    customer_count: number;
    is_vip: boolean;
    label: string;
    min_visits: number;
  }>;
};

type LoyaltyDashboard = {
  leaderboard: Array<{
    cashback_balance: number;
    completed_visits: number;
    current_tier?: {
      discount_percent: number;
      is_vip: boolean;
      label: string;
      min_visits: number;
    } | null;
    customer_id: string;
    customer_name: string;
    last_reward_at: string | null;
    points_balance: number;
    rank_position: number;
    total_cashback_earned: number;
    total_points_earned: number;
  }>;
  overview: {
    ranked_customers: number;
    total_cashback_earned: number;
    total_completed_visits: number;
    total_points_earned: number;
    vip_customers: number;
  };
  program?: LoyaltyProgramForm | null;
};

type ReferralProgramForm = {
  description: string;
  is_active: boolean;
  required_qualified_referrals: number;
  reward_for_invited: string;
  reward_for_referrer: string;
  reward_service_id: string;
  title: string;
};

type ReferralEventRow = {
  created_at: string;
  customer_id?: string;
  id: string;
  invited_customer_id: string;
  qualified_at: string | null;
  referrer_customer_id: string;
  status: "pending" | "qualified";
};

type ReferralUnlockRow = {
  id: string;
  redeemed_at: string | null;
  referrer_customer_id: string;
  required_qualified_referrals: number;
  reward_description: string;
  reward_service_name: string | null;
  status: "available" | "redeemed";
  threshold_reached: number;
  unlocked_at: string;
};

type AutomationDashboard = {
  overview: {
    at_risk_customers: number;
    due_now_customers: number;
    recovered_customers_last_30d: number;
    smart_rebook_due_customers: number;
    smart_rebooks_sent_last_30d: number;
    winbacks_sent_last_30d: number;
  };
  recent_runs: Array<{
    body: string;
    customer_id: string;
    customer_name: string;
    discount_percent?: number;
    id: string;
    inactive_days?: number;
    notification_id?: string | null;
    recovered: boolean;
    recovered_appointment_at?: string | null;
    sent_at: string;
    service_name?: string | null;
    title: string;
  }>;
  settings: AutomationSettingsForm;
};

type AutomationSettingsForm = {
  is_active: boolean;
  smart_rebook_body_template: string;
  smart_rebook_is_active: boolean;
  smart_rebook_title: string;
  smart_rebook_window_days: number;
  winback_body_template: string;
  winback_discount_percent: number;
  winback_inactive_days: number;
  winback_title: string;
};

type NotificationRow = {
  audience: "salon_customers" | "single_customer";
  body: string;
  created_at: string;
  customer_id: string | null;
  id: string;
  notification_type: string;
  payload: JsonRecord;
  title: string;
};

type NotificationDispatchRow = {
  deactivated_count: number | null;
  error_detail: string | null;
  failed_count: number | null;
  notification_id: string;
  response_status: number | null;
  sent_count: number | null;
  status: string | null;
  updated_at: string | null;
};

type MembershipOfferForm = {
  description: string;
  ends_on: string;
  highlight_text: string;
  id: string;
  is_active: boolean;
  membership_service_id: string;
  membership_sessions_included: number;
  membership_validity_days: number;
  price: number;
  sort_order: number;
  starts_on: string;
  title: string;
};

type MembershipOfferRow = MembershipOfferForm;

type MembershipRequestRow = {
  approved_starts_on: string | null;
  customer_id: string;
  decided_at: string | null;
  id: string;
  membership_id: string | null;
  notes: string | null;
  offer_id: string;
  offer_title_snapshot: string;
  payment_confirmed_at: string | null;
  price_snapshot: number | null;
  requested_at: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
};

type CustomerMembershipRow = {
  created_at: string;
  customer_id: string;
  expires_at: string;
  id: string;
  offer_id: string | null;
  price_snapshot: number | null;
  service_name_snapshot: string;
  sessions_included: number;
  sessions_used: number;
  started_at: string;
  status: "active" | "completed" | "expired" | "cancelled";
  title: string;
};

type LoyaltyProgramForm = {
  cashback_percent: number;
  description: string;
  is_active: boolean;
  points_per_visit: number;
  tier_one_discount_percent: number;
  tier_one_min_visits: number;
  tier_one_name: string;
  tier_two_discount_percent: number;
  tier_two_min_visits: number;
  tier_two_name: string;
  title: string;
  vip_discount_percent: number;
  vip_min_visits: number;
  vip_reward_service_id: string;
  vip_tier_name: string;
};

type SettingsForm = {
  aiAssist: boolean;
  brandColor: string;
  description: string;
  email: string;
  monthlyGoal: number;
  name: string;
  phone: string;
  requireStrongPassword: boolean;
  segment: string;
  twoFactor: boolean;
};

type AiInsight = {
  action: string;
  id: string;
  severity: "alta" | "media" | "boa";
  summary: string;
  title: string;
};

const emptyNotificationForm = {
  audience: "salon_customers" as const,
  body: "",
  customerId: "all",
  notificationType: "panel_update",
  title: "",
};

const emptyMembershipOfferForm: MembershipOfferForm = {
  description: "",
  ends_on: "",
  highlight_text: "Plano ativo no app",
  id: "",
  is_active: true,
  membership_service_id: "",
  membership_sessions_included: 4,
  membership_validity_days: 30,
  price: 0,
  sort_order: 0,
  starts_on: "",
  title: "",
};

const defaultLoyaltyProgramForm: LoyaltyProgramForm = {
  cashback_percent: 5,
  description: "",
  is_active: false,
  points_per_visit: 10,
  tier_one_discount_percent: 5,
  tier_one_min_visits: 3,
  tier_one_name: "Cliente frequente",
  tier_two_discount_percent: 10,
  tier_two_min_visits: 6,
  tier_two_name: "Cliente ouro",
  title: "Clube de fidelidade",
  vip_discount_percent: 15,
  vip_min_visits: 10,
  vip_reward_service_id: "",
  vip_tier_name: "Cliente VIP",
};

const defaultReferralProgramForm: ReferralProgramForm = {
  description: "",
  is_active: false,
  required_qualified_referrals: 10,
  reward_for_invited: "",
  reward_for_referrer: "Beneficio liberado apos a primeira visita da indicacao.",
  reward_service_id: "",
  title: "Indique e ganhe",
};

const defaultAutomationSettingsForm: AutomationSettingsForm = {
  is_active: true,
  smart_rebook_body_template:
    "Quer agendar para {target_weekday} {target_period}? Se quiser, voce tambem pode incluir {combo_service_name}.",
  smart_rebook_is_active: true,
  smart_rebook_title: "Hora do seu proximo {service_name}",
  smart_rebook_window_days: 4,
  winback_body_template:
    "Ja faz {inactive_days} dias desde seu ultimo {service_name}. Volte esta semana e agende com {discount}% OFF pelo app.",
  winback_discount_percent: 10,
  winback_inactive_days: 30,
  winback_title: "Sentimos sua falta",
};

function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("pt-BR");
}

function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pt-BR");
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const lines = [headers.map(escapeCsvCell).join(";"), ...rows.map((row) => row.map(escapeCsvCell).join(";"))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyText(text: string, successMessage: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    toast.error("Nao foi possivel acessar a area de transferencia.");
    return;
  }

  await navigator.clipboard.writeText(text);
  toast.success(successMessage);
}

function normalizeColor(value: string, fallback: string) {
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? { ...(value as JsonRecord) } : {};
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function useMarketingDashboard(enabled: boolean) {
  const [data, setData] = useState<MarketingDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setData(null);
      return;
    }

    setIsLoading(true);
    try {
      const { data: rpcData, error } = await getSupabaseBrowserClient().rpc("get_salon_marketing_dashboard");
      if (error) {
        throw error;
      }

      const payload = toRecord(rpcData);
      setData({
        birthday_customers: toArray<MarketingDashboard["birthday_customers"][number]>(payload.birthday_customers),
        birthdays_this_month: Number(payload.birthdays_this_month ?? 0),
        customers_with_birth_date: Number(payload.customers_with_birth_date ?? 0),
        inactive_customers: toArray<MarketingDashboard["inactive_customers"][number]>(payload.inactive_customers),
        inactive_threshold_days: Number(payload.inactive_threshold_days ?? 30),
        inactive_total: Number(payload.inactive_total ?? 0),
        loyalty_tiers: toArray<MarketingDashboard["loyalty_tiers"][number]>(payload.loyalty_tiers),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar o painel de marketing.");
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, reload: load };
}

function useLoyaltyDashboard(enabled: boolean) {
  const [data, setData] = useState<LoyaltyDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setData(null);
      return;
    }

    setIsLoading(true);
    try {
      const { data: rpcData, error } = await getSupabaseBrowserClient().rpc("get_salon_loyalty_dashboard");
      if (error) {
        throw error;
      }

      const payload = toRecord(rpcData);
      const program = toRecord(payload.program);
      setData({
        leaderboard: toArray<LoyaltyDashboard["leaderboard"][number]>(payload.leaderboard),
        overview: {
          ranked_customers: Number(toRecord(payload.overview).ranked_customers ?? 0),
          total_cashback_earned: Number(toRecord(payload.overview).total_cashback_earned ?? 0),
          total_completed_visits: Number(toRecord(payload.overview).total_completed_visits ?? 0),
          total_points_earned: Number(toRecord(payload.overview).total_points_earned ?? 0),
          vip_customers: Number(toRecord(payload.overview).vip_customers ?? 0),
        },
        program: Object.keys(program).length
          ? {
              cashback_percent: Number(program.cashback_percent ?? 5),
              description: String(program.description ?? ""),
              is_active: Boolean(program.is_active),
              points_per_visit: Number(program.points_per_visit ?? 10),
              tier_one_discount_percent: Number(program.tier_one_discount_percent ?? 5),
              tier_one_min_visits: Number(program.tier_one_min_visits ?? 3),
              tier_one_name: String(program.tier_one_name ?? "Cliente frequente"),
              tier_two_discount_percent: Number(program.tier_two_discount_percent ?? 10),
              tier_two_min_visits: Number(program.tier_two_min_visits ?? 6),
              tier_two_name: String(program.tier_two_name ?? "Cliente ouro"),
              title: String(program.title ?? "Clube de fidelidade"),
              vip_discount_percent: Number(program.vip_discount_percent ?? 15),
              vip_min_visits: Number(program.vip_min_visits ?? 10),
              vip_reward_service_id: String(program.vip_reward_service_id ?? ""),
              vip_tier_name: String(program.vip_tier_name ?? "Cliente VIP"),
            }
          : null,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar a fidelidade.");
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, reload: load };
}

function useAutomationDashboard(enabled: boolean) {
  const [data, setData] = useState<AutomationDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setData(null);
      return;
    }

    setIsLoading(true);
    try {
      const { data: rpcData, error } = await getSupabaseBrowserClient().rpc("get_salon_growth_automation_dashboard");
      if (error) {
        throw error;
      }

      const payload = toRecord(rpcData);
      const settings = toRecord(payload.settings);
      const overview = toRecord(payload.overview);

      setData({
        overview: {
          at_risk_customers: Number(overview.at_risk_customers ?? 0),
          due_now_customers: Number(overview.due_now_customers ?? 0),
          recovered_customers_last_30d: Number(overview.recovered_customers_last_30d ?? 0),
          smart_rebook_due_customers: Number(overview.smart_rebook_due_customers ?? 0),
          smart_rebooks_sent_last_30d: Number(overview.smart_rebooks_sent_last_30d ?? 0),
          winbacks_sent_last_30d: Number(overview.winbacks_sent_last_30d ?? 0),
        },
        recent_runs: toArray<AutomationDashboard["recent_runs"][number]>(payload.recent_runs),
        settings: {
          is_active: Boolean(settings.is_active ?? true),
          smart_rebook_body_template: String(settings.smart_rebook_body_template ?? defaultAutomationSettingsForm.smart_rebook_body_template),
          smart_rebook_is_active: Boolean(settings.smart_rebook_is_active ?? true),
          smart_rebook_title: String(settings.smart_rebook_title ?? defaultAutomationSettingsForm.smart_rebook_title),
          smart_rebook_window_days: Number(settings.smart_rebook_window_days ?? 4),
          winback_body_template: String(settings.winback_body_template ?? defaultAutomationSettingsForm.winback_body_template),
          winback_discount_percent: Number(settings.winback_discount_percent ?? 10),
          winback_inactive_days: Number(settings.winback_inactive_days ?? 30),
          winback_title: String(settings.winback_title ?? defaultAutomationSettingsForm.winback_title),
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar as automacoes.");
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, reload: load };
}

function useNotificationFeed(enabled: boolean, salonId: string | null) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [dispatchById, setDispatchById] = useState<Record<string, NotificationDispatchRow>>({});
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !salonId) {
      setNotifications([]);
      setDispatchById({});
      return;
    }

    setIsLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("salon_customer_notifications")
        .select("id, salon_id, customer_id, audience, notification_type, title, body, payload, created_at")
        .eq("salon_id", salonId)
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) {
        throw error;
      }

      const rows = toArray<NotificationRow>(data);
      setNotifications(rows);

      const notificationIds = rows.map((item) => item.id);
      if (!notificationIds.length) {
        setDispatchById({});
        return;
      }

      const dispatchResult = await supabase.rpc("get_salon_notification_dispatch_snapshot", {
        notification_ids_input: notificationIds,
      });

      if (dispatchResult.error) {
        throw dispatchResult.error;
      }

      const mapped = Object.fromEntries(
        toArray<NotificationDispatchRow>(dispatchResult.data).map((entry) => [entry.notification_id, entry]),
      );
      setDispatchById(mapped);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar as notificacoes.");
    } finally {
      setIsLoading(false);
    }
  }, [enabled, salonId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { dispatchById, isLoading, notifications, reload: load };
}

function useSubscriptionsData(enabled: boolean, salonId: string | null) {
  const [offers, setOffers] = useState<MembershipOfferRow[]>([]);
  const [requests, setRequests] = useState<MembershipRequestRow[]>([]);
  const [memberships, setMemberships] = useState<CustomerMembershipRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !salonId) {
      setOffers([]);
      setRequests([]);
      setMemberships([]);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const [offersResult, requestsResult, membershipsResult] = await Promise.all([
        supabase
          .from("salon_offers")
          .select(
            "id, title, description, highlight_text, price, starts_on, ends_on, is_active, sort_order, membership_service_id, membership_sessions_included, membership_validity_days",
          )
          .eq("salon_id", salonId)
          .eq("kind", "membership")
          .order("sort_order")
          .order("created_at"),
        supabase
          .from("customer_membership_requests")
          .select(
            "id, customer_id, offer_id, offer_title_snapshot, price_snapshot, notes, status, requested_at, decided_at, membership_id, approved_starts_on, payment_confirmed_at",
          )
          .eq("salon_id", salonId)
          .order("requested_at", { ascending: false })
          .limit(40),
        supabase
          .from("customer_memberships")
          .select(
            "id, customer_id, offer_id, title, service_name_snapshot, price_snapshot, sessions_included, sessions_used, started_at, expires_at, status, created_at",
          )
          .eq("salon_id", salonId)
          .order("created_at", { ascending: false })
          .limit(60),
      ]);

      if (offersResult.error) throw offersResult.error;
      if (requestsResult.error) throw requestsResult.error;
      if (membershipsResult.error) throw membershipsResult.error;

      setOffers(
        toArray<JsonRecord>(offersResult.data).map((row) => ({
          description: String(row.description ?? ""),
          ends_on: String(row.ends_on ?? ""),
          highlight_text: String(row.highlight_text ?? ""),
          id: String(row.id),
          is_active: Boolean(row.is_active),
          membership_service_id: String(row.membership_service_id ?? ""),
          membership_sessions_included: Number(row.membership_sessions_included ?? 0),
          membership_validity_days: Number(row.membership_validity_days ?? 0),
          price: Number(row.price ?? 0),
          sort_order: Number(row.sort_order ?? 0),
          starts_on: String(row.starts_on ?? ""),
          title: String(row.title ?? ""),
        })),
      );

      setRequests(
        toArray<MembershipRequestRow>(requestsResult.data).map((row) => ({
          approved_starts_on: row.approved_starts_on ?? null,
          customer_id: String(row.customer_id),
          decided_at: row.decided_at ?? null,
          id: String(row.id),
          membership_id: row.membership_id ?? null,
          notes: row.notes ?? null,
          offer_id: String(row.offer_id),
          offer_title_snapshot: String(row.offer_title_snapshot ?? "Plano"),
          payment_confirmed_at: row.payment_confirmed_at ?? null,
          price_snapshot: row.price_snapshot == null ? null : Number(row.price_snapshot),
          requested_at: String(row.requested_at),
          status: row.status,
        })),
      );

      setMemberships(
        toArray<CustomerMembershipRow>(membershipsResult.data).map((row) => ({
          created_at: String(row.created_at),
          customer_id: String(row.customer_id),
          expires_at: String(row.expires_at),
          id: String(row.id),
          offer_id: row.offer_id ? String(row.offer_id) : null,
          price_snapshot: row.price_snapshot == null ? null : Number(row.price_snapshot),
          service_name_snapshot: String(row.service_name_snapshot ?? ""),
          sessions_included: Number(row.sessions_included ?? 0),
          sessions_used: Number(row.sessions_used ?? 0),
          started_at: String(row.started_at),
          status: row.status,
          title: String(row.title ?? "Plano"),
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar as assinaturas.");
    } finally {
      setIsLoading(false);
    }
  }, [enabled, salonId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { isLoading, memberships, offers, reload: load, requests };
}

function buildAiInsights(input: {
  cashOpen: boolean;
  clientApp: ReturnType<typeof useSalon>["clientApp"];
  marketing: MarketingDashboard | null;
  orders: ReturnType<typeof useSalon>["orders"];
  products: ReturnType<typeof useSalon>["products"];
  professionals: ReturnType<typeof useSalon>["professionals"];
  promotions: ReturnType<typeof useSalon>["promotions"];
  settings: ReturnType<typeof useSalon>["settings"];
  transactions: ReturnType<typeof useSalon>["transactions"];
  appointments: ReturnType<typeof useSalon>["appointments"];
}) {
  const {
    appointments,
    cashOpen,
    clientApp,
    marketing,
    orders,
    products,
    professionals,
    promotions,
    settings,
    transactions,
  } = input;

  const pendingDepositCount = appointments.filter(
    (appointment) =>
      ["pendente", "confirmado"].includes(appointment.status) &&
      clientApp.requireDeposit &&
      appointment.deposit < appointment.price * (clientApp.depositPercent / 100),
  ).length;
  const lowStockProducts = products.filter((product) => product.stock <= product.minStock);
  const inactiveProfessionals = professionals.filter((professional) => !professional.active);
  const openOrders = orders.filter((order) => order.status !== "entregue");
  const weakPromotions = promotions.filter((promotion) => promotion.active && promotion.redemptions === 0);
  const outgoing = transactions.filter((transaction) => transaction.type === "saida").reduce((sum, item) => sum + item.amount, 0);
  const incoming = transactions.filter((transaction) => transaction.type === "entrada").reduce((sum, item) => sum + item.amount, 0);
  const inactiveCustomers = marketing?.inactive_total ?? 0;

  const insights: AiInsight[] = [];

  if (pendingDepositCount > 0) {
    insights.push({
      action: "Reforce o sinal nos agendamentos confirmados que ainda nao cobriram a politica configurada.",
      id: "deposit-risk",
      severity: "alta",
      summary: `${pendingDepositCount} agendamentos ainda estao abaixo do sinal esperado no app cliente.`,
      title: "Risco de no-show com sinal incompleto",
    });
  }

  if (inactiveCustomers > 0) {
    insights.push({
      action: "Dispare winback e valide a automacao para trazer esse publico de volta.",
      id: "inactive-customers",
      severity: "alta",
      summary: `${inactiveCustomers} clientes ja cruzaram a janela de inatividade do salao.`,
      title: "Clientes pedindo retomada",
    });
  }

  if (lowStockProducts.length > 0) {
    insights.push({
      action: "Reposicione estoque dos itens criticos antes do proximo ciclo de atendimento.",
      id: "low-stock",
      severity: "media",
      summary: `${lowStockProducts.length} produtos chegaram ao estoque minimo ou abaixo dele.`,
      title: "Estoque critico encontrado",
    });
  }

  if (openOrders.length > 0) {
    insights.push({
      action: "Feche a fila da loja para nao travar a experiencia do app cliente.",
      id: "store-backlog",
      severity: "media",
      summary: `${openOrders.length} pedidos ainda estao entre novo, separando ou pronto.`,
      title: "Fila da loja aberta",
    });
  }

  if (weakPromotions.length > 0) {
    insights.push({
      action: "Revise o destaque das campanhas ativas e publique copy nova no feed ou push.",
      id: "weak-promotions",
      severity: "media",
      summary: `${weakPromotions.length} campanhas ativas ainda nao geraram resgate registrado.`,
      title: "Campanhas sem tracao",
    });
  }

  if (incoming > 0 && outgoing / incoming > 0.6) {
    insights.push({
      action: "Monitore caixa e custos variaveis antes de ampliar beneficio ou desconto.",
      id: "margin-pressure",
      severity: "alta",
      summary: `As saidas ja consomem ${Math.round((outgoing / incoming) * 100)}% das entradas atuais.`,
      title: "Pressao de margem",
    });
  }

  if (inactiveProfessionals.length > 0) {
    insights.push({
      action: "Revise agenda e servicos habilitados da equipe inativa para nao perder oferta no app.",
      id: "inactive-staff",
      severity: "media",
      summary: `${inactiveProfessionals.length} profissionais estao marcados como inativos no painel.`,
      title: "Capacidade de equipe reduzida",
    });
  }

  if (!cashOpen) {
    insights.push({
      action: "Abra o caixa antes da operacao do dia para manter a leitura financeira consistente.",
      id: "cash-closed",
      severity: "boa",
      summary: "O caixa do dia ainda aparece fechado nesta leitura.",
      title: "Rotina financeira precisa iniciar",
    });
  }

  if (!insights.length) {
    insights.push({
      action: "Continue operando com a rotina atual e valide semanalmente automacoes, estoque e metas.",
      id: "healthy",
      severity: "boa",
      summary: "Nao apareceu nenhum gargalo prioritario com os dados atuais.",
      title: "Operacao equilibrada",
    });
  }

  return {
    insights,
    summary: {
      incoming,
      inactiveCustomers,
      lowStockProducts: lowStockProducts.length,
      monthlyGoal: settings.monthlyGoal,
      openOrders: openOrders.length,
      pendingDepositCount,
    },
  };
}

export function GenericRuntimeModule({ moduleKey }: { moduleKey: string }) {
  if (moduleKey === "dashboard.benefits.index") return <BenefitsOverviewModule />;
  if (moduleKey === "dashboard.benefits.loyalty") return <LoyaltyModule />;
  if (moduleKey === "dashboard.benefits.referrals") return <ReferralsModule />;
  if (moduleKey === "dashboard.benefits.automations") return <AutomationsModule />;
  if (moduleKey === "dashboard.notifications.index") return <NotificationsModule />;
  if (moduleKey === "dashboard.notifications.export") return <NotificationsExportModule />;
  if (moduleKey === "dashboard.subscriptions") return <SubscriptionsModule />;
  if (moduleKey === "dashboard.settings") return <SettingsModule />;
  if (moduleKey === "dashboard.billing") return <BillingModule />;
  if (moduleKey === "dashboard.ai.index") return <AIModule />;
  if (moduleKey === "dashboard.ai.export") return <AIExportModule />;
  if (moduleKey === "dashboard.operations.index") return <OperationsOverviewModule />;

  return (
    <div className="panel space-y-4 p-6">
      <p className="text-sm text-muted-foreground">
        Este modulo ja esta conectado ao panorama real do salao, mas nao recebeu uma tela dedicada ainda.
      </p>
    </div>
  );
}

function BenefitsOverviewModule() {
  const { clientApp, promotions } = useSalon();
  const { data, isLoading } = useMarketingDashboard(true);

  const activePromotions = promotions.filter((promotion) => promotion.active).length;

  return (
    <div className="space-y-8">
      <Section title="Marketing vivo">
        {isLoading && <LoadingPanel text="Carregando leitura comercial..." />}
        {!isLoading && data && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Aniversarios do mes" value={String(data.birthdays_this_month)} />
            <MiniStat label="Clientes inativos" value={String(data.inactive_total)} />
            <MiniStat label="Campanhas ativas" value={String(activePromotions)} />
            <MiniStat label="Tiers de fidelidade" value={String(data.loyalty_tiers.length)} />
          </div>
        )}
      </Section>

      <Section title="Acoes imediatas">
        {data && (data.birthday_customers.length || data.inactive_customers.length) ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="panel space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Aniversariantes prontos para contato</h3>
                <span className="text-xs text-muted-foreground">
                  {data.customers_with_birth_date} com data cadastrada
                </span>
              </div>
              {data.birthday_customers.map((customer) => (
                <div key={customer.customer_id} className="rounded-2xl border border-border p-3 text-sm">
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Dia {customer.birth_day} • {customer.phone || "sem telefone"}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void copyText(
                          `Oi ${customer.name}! Passando para desejar um aniversario especial do ${clientApp.appName}. Se quiser, temos um mimo pronto para sua proxima visita.`,
                          "Mensagem de aniversario copiada",
                        )
                      }
                    >
                      Copiar mensagem
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Clientes para winback</h3>
                <span className="text-xs text-muted-foreground">
                  janela ativa em {data.inactive_threshold_days} dias
                </span>
              </div>
              {data.inactive_customers.map((customer) => (
                <div key={customer.customer_id} className="rounded-2xl border border-border p-3 text-sm">
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {customer.inactive_days} dias sem voltar • ultimo servico: {customer.last_service_name || "atendimento"}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void copyText(
                          `Oi ${customer.name}! Sentimos sua falta no ${clientApp.appName}. Preparamos uma oportunidade para seu proximo ${customer.last_service_name || "atendimento"} direto pelo app.`,
                          "Mensagem de retorno copiada",
                        )
                      }
                    >
                      Copiar winback
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState text="Sem clientes de aniversario ou reativacao no momento." />
        )}
      </Section>

      <Section title="Distribuicao de fidelidade">
        {data?.loyalty_tiers?.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {data.loyalty_tiers.map((tier) => (
              <div key={tier.label} className="panel p-4 text-sm">
                <p className="font-medium">{tier.label}</p>
                <p className="text-xs text-muted-foreground">
                  minimo de {tier.min_visits} visitas
                </p>
                <p className="mt-3 text-2xl font-semibold">{tier.customer_count}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Ative a fidelidade para enxergar tiers e distribuicao real de clientes." />
        )}
      </Section>
    </div>
  );
}

function LoyaltyModule() {
  const { clientApp, clients, refresh, salonId, services } = useSalon();
  const { data, isLoading, reload } = useLoyaltyDashboard(true);
  const [form, setForm] = useState<LoyaltyProgramForm>(defaultLoyaltyProgramForm);
  const [adjustment, setAdjustment] = useState({
    cashbackDelta: 0,
    customerId: "",
    description: "",
    pointsDelta: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);

  useEffect(() => {
    if (data?.program) {
      setForm({
        ...defaultLoyaltyProgramForm,
        ...data.program,
        vip_reward_service_id: data.program.vip_reward_service_id || "",
      });
      return;
    }

    setForm(defaultLoyaltyProgramForm);
  }, [data]);

  const saveProgram = async () => {
    if (!salonId) {
      toast.error("Salao ainda nao carregado.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        cashback_percent: form.cashback_percent,
        description: form.description.trim() || null,
        is_active: form.is_active,
        points_per_visit: form.points_per_visit,
        salon_id: salonId,
        tier_one_discount_percent: form.tier_one_discount_percent,
        tier_one_min_visits: form.tier_one_min_visits,
        tier_one_name: form.tier_one_name.trim(),
        tier_two_discount_percent: form.tier_two_discount_percent,
        tier_two_min_visits: form.tier_two_min_visits,
        tier_two_name: form.tier_two_name.trim(),
        title: form.title.trim(),
        vip_discount_percent: form.vip_discount_percent,
        vip_min_visits: form.vip_min_visits,
        vip_reward_service_id: form.vip_reward_service_id || null,
        vip_tier_name: form.vip_tier_name.trim(),
      };

      const { error } = await getSupabaseBrowserClient()
        .from("salon_loyalty_programs")
        .upsert(payload, { onConflict: "salon_id" });

      if (error) {
        throw error;
      }

      await Promise.all([reload(), refresh()]);
      toast.success("Programa de fidelidade salvo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar a fidelidade.");
    } finally {
      setIsSaving(false);
    }
  };

  const createManualAdjustment = async () => {
    if (!salonId) {
      toast.error("Salao ainda nao carregado.");
      return;
    }

    if (!adjustment.customerId) {
      toast.error("Escolha um cliente.");
      return;
    }

    if (!adjustment.description.trim()) {
      toast.error("Descreva o ajuste.");
      return;
    }

    if (!adjustment.pointsDelta && !adjustment.cashbackDelta) {
      toast.error("Informe pontos ou cashback para o ajuste.");
      return;
    }

    setIsAdjusting(true);
    try {
      const { error } = await getSupabaseBrowserClient().from("customer_loyalty_transactions").insert({
        cashback_delta: adjustment.cashbackDelta,
        completed_visit_delta: 0,
        customer_id: adjustment.customerId,
        description: adjustment.description.trim(),
        loyalty_program_id: null,
        metadata: { source: "owner_panel_manual_adjustment" },
        points_delta: adjustment.pointsDelta,
        salon_id: salonId,
        transaction_kind: "manual_adjustment",
      });

      if (error) {
        throw error;
      }

      setAdjustment({
        cashbackDelta: 0,
        customerId: "",
        description: "",
        pointsDelta: 0,
      });
      await reload();
      toast.success("Ajuste manual registrado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel registrar o ajuste.");
    } finally {
      setIsAdjusting(false);
    }
  };

  return (
    <div className="space-y-8">
      <Section title="Panorama">
        {isLoading && <LoadingPanel text="Carregando fidelidade..." />}
        {!isLoading && data && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Clientes ranqueados" value={String(data.overview.ranked_customers)} />
            <MiniStat label="Clientes VIP" value={String(data.overview.vip_customers)} />
            <MiniStat label="Pontos gerados" value={String(data.overview.total_points_earned)} />
            <MiniStat label="Cashback real" value={brl(data.overview.total_cashback_earned)} />
          </div>
        )}
      </Section>

      <Section
        title="Programa de fidelidade"
        action={
          <Button className="rounded-full" onClick={() => void saveProgram()} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar programa"}
          </Button>
        }
      >
        <div className="panel grid gap-4 p-6">
          {!clientApp.showLoyalty && (
            <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              A fidelidade esta configurada, mas hoje ela esta oculta no app cliente. Ative em "App do cliente".
            </div>
          )}

          <ToggleRow
            label="Programa ativo"
            description="Quando ativo, visitas concluidas passam a gerar pontos, cashback e upgrades de tier."
            checked={form.is_active}
            onChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Titulo">
              <Input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
            </Field>
            <Field label="Servico VIP de recompensa">
              <Select
                value={form.vip_reward_service_id || "none"}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, vip_reward_service_id: value === "none" ? "" : value }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem recompensa extra</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Descricao">
            <Textarea rows={2} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </Field>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Pontos por visita">
              <Input type="number" value={form.points_per_visit} onChange={(event) => setForm((prev) => ({ ...prev, points_per_visit: Number(event.target.value) || 0 }))} />
            </Field>
            <Field label="Cashback (%)">
              <Input type="number" value={form.cashback_percent} onChange={(event) => setForm((prev) => ({ ...prev, cashback_percent: Number(event.target.value) || 0 }))} />
            </Field>
            <Field label="Tier 1 • visitas">
              <Input type="number" value={form.tier_one_min_visits} onChange={(event) => setForm((prev) => ({ ...prev, tier_one_min_visits: Number(event.target.value) || 0 }))} />
            </Field>
            <Field label="Tier 1 • desconto (%)">
              <Input type="number" value={form.tier_one_discount_percent} onChange={(event) => setForm((prev) => ({ ...prev, tier_one_discount_percent: Number(event.target.value) || 0 }))} />
            </Field>
            <Field label="Tier 1 • nome">
              <Input value={form.tier_one_name} onChange={(event) => setForm((prev) => ({ ...prev, tier_one_name: event.target.value }))} />
            </Field>
            <Field label="Tier 2 • visitas">
              <Input type="number" value={form.tier_two_min_visits} onChange={(event) => setForm((prev) => ({ ...prev, tier_two_min_visits: Number(event.target.value) || 0 }))} />
            </Field>
            <Field label="Tier 2 • desconto (%)">
              <Input type="number" value={form.tier_two_discount_percent} onChange={(event) => setForm((prev) => ({ ...prev, tier_two_discount_percent: Number(event.target.value) || 0 }))} />
            </Field>
            <Field label="Tier 2 • nome">
              <Input value={form.tier_two_name} onChange={(event) => setForm((prev) => ({ ...prev, tier_two_name: event.target.value }))} />
            </Field>
            <Field label="VIP • visitas">
              <Input type="number" value={form.vip_min_visits} onChange={(event) => setForm((prev) => ({ ...prev, vip_min_visits: Number(event.target.value) || 0 }))} />
            </Field>
            <Field label="VIP • desconto (%)">
              <Input type="number" value={form.vip_discount_percent} onChange={(event) => setForm((prev) => ({ ...prev, vip_discount_percent: Number(event.target.value) || 0 }))} />
            </Field>
            <Field label="VIP • nome">
              <Input value={form.vip_tier_name} onChange={(event) => setForm((prev) => ({ ...prev, vip_tier_name: event.target.value }))} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Ajuste manual de saldo">
        <div className="panel grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Cliente">
            <Select
              value={adjustment.customerId || "none"}
              onValueChange={(value) => setAdjustment((prev) => ({ ...prev, customerId: value === "none" ? "" : value }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pontos">
            <Input type="number" value={adjustment.pointsDelta} onChange={(event) => setAdjustment((prev) => ({ ...prev, pointsDelta: Number(event.target.value) || 0 }))} />
          </Field>
          <Field label="Cashback">
            <Input type="number" value={adjustment.cashbackDelta} onChange={(event) => setAdjustment((prev) => ({ ...prev, cashbackDelta: Number(event.target.value) || 0 }))} />
          </Field>
          <Field label="Motivo" className="xl:col-span-2">
            <Input value={adjustment.description} onChange={(event) => setAdjustment((prev) => ({ ...prev, description: event.target.value }))} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button className="rounded-full" onClick={() => void createManualAdjustment()} disabled={isAdjusting}>
            {isAdjusting ? "Aplicando..." : "Registrar ajuste"}
          </Button>
        </div>
      </Section>

      <Section title="Leaderboard real">
        {data?.leaderboard?.length ? (
          <div className="space-y-3">
            {data.leaderboard.map((entry) => (
              <div key={entry.customer_id} className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">
                    #{entry.rank_position} • {entry.customer_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.current_tier?.label || "Sem tier"} • {entry.completed_visits} visitas • ultima recompensa {formatDateTimeLabel(entry.last_reward_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{entry.points_balance} pts</p>
                  <p className="text-xs text-muted-foreground">{brl(entry.cashback_balance)} de saldo</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Assim que os atendimentos concluidos gerarem recompensa, o ranking aparece aqui." />
        )}
      </Section>
    </div>
  );
}

function ReferralsModule() {
  const { salonId, services } = useSalon();
  const [form, setForm] = useState<ReferralProgramForm>(defaultReferralProgramForm);
  const [events, setEvents] = useState<ReferralEventRow[]>([]);
  const [unlocks, setUnlocks] = useState<ReferralUnlockRow[]>([]);
  const [customerCodes, setCustomerCodes] = useState<Array<{ id: string; name: string; referral_code: string | null }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  const load = useCallback(async () => {
    if (!salonId) {
      return;
    }

    setIsLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const [programResult, eventsResult, unlocksResult, customersResult] = await Promise.all([
        supabase
          .from("salon_referral_programs")
          .select(
            "title, description, reward_for_referrer, reward_for_invited, is_active, required_qualified_referrals, reward_service_id",
          )
          .eq("salon_id", salonId)
          .maybeSingle(),
        supabase
          .from("salon_referral_events")
          .select("id, referrer_customer_id, invited_customer_id, status, qualified_at, created_at")
          .eq("salon_id", salonId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("salon_referral_reward_unlocks")
          .select(
            "id, referrer_customer_id, reward_service_name, reward_description, required_qualified_referrals, threshold_reached, status, unlocked_at, redeemed_at",
          )
          .eq("salon_id", salonId)
          .order("unlocked_at", { ascending: false })
          .limit(20),
        supabase
          .from("customers")
          .select("id, name, referral_code")
          .eq("salon_id", salonId)
          .order("name"),
      ]);

      if (programResult.error) throw programResult.error;
      if (eventsResult.error) throw eventsResult.error;
      if (unlocksResult.error) throw unlocksResult.error;
      if (customersResult.error) throw customersResult.error;

      const program = toRecord(programResult.data);
      setForm(
        Object.keys(program).length
          ? {
              description: String(program.description ?? ""),
              is_active: Boolean(program.is_active),
              required_qualified_referrals: Number(program.required_qualified_referrals ?? 10),
              reward_for_invited: String(program.reward_for_invited ?? ""),
              reward_for_referrer: String(program.reward_for_referrer ?? ""),
              reward_service_id: String(program.reward_service_id ?? ""),
              title: String(program.title ?? "Indique e ganhe"),
            }
          : defaultReferralProgramForm,
      );
      setEvents(toArray<ReferralEventRow>(eventsResult.data));
      setUnlocks(toArray<ReferralUnlockRow>(unlocksResult.data));
      setCustomerCodes(
        toArray<JsonRecord>(customersResult.data).map((row) => ({
          id: String(row.id),
          name: String(row.name ?? "Cliente"),
          referral_code: row.referral_code == null ? null : String(row.referral_code),
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar as indicacoes.");
    } finally {
      setIsLoading(false);
    }
  }, [salonId]);

  useEffect(() => {
    void load();
  }, [load]);

  const customerNameById = useMemo(
    () => Object.fromEntries(customerCodes.map((item) => [item.id, item.name])),
    [customerCodes],
  );

  const topReferrers = useMemo(() => {
    const grouped = new Map<string, { pending: number; qualified: number }>();
    for (const event of events) {
      const current = grouped.get(event.referrer_customer_id) ?? { pending: 0, qualified: 0 };
      if (event.status === "qualified") {
        current.qualified += 1;
      } else {
        current.pending += 1;
      }
      grouped.set(event.referrer_customer_id, current);
    }

    return [...grouped.entries()]
      .map(([customerId, counts]) => ({
        customerId,
        name: customerNameById[customerId] || "Cliente",
        ...counts,
      }))
      .sort((left, right) => right.qualified - left.qualified || right.pending - left.pending || left.name.localeCompare(right.name))
      .slice(0, 8);
  }, [customerNameById, events]);

  const saveProgram = async () => {
    if (!salonId) {
      toast.error("Salao ainda nao carregado.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await getSupabaseBrowserClient()
        .from("salon_referral_programs")
        .upsert(
          {
            description: form.description.trim() || null,
            is_active: form.is_active,
            required_qualified_referrals: form.required_qualified_referrals,
            reward_for_invited: form.reward_for_invited.trim() || null,
            reward_for_referrer: form.reward_for_referrer.trim(),
            reward_service_id: form.reward_service_id || null,
            salon_id: salonId,
            title: form.title.trim(),
          },
          { onConflict: "salon_id" },
        );

      if (error) {
        throw error;
      }

      await load();
      toast.success("Programa de indicacoes salvo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar o programa.");
    } finally {
      setIsSaving(false);
    }
  };

  const reconcileUnlocks = async () => {
    if (!salonId) {
      toast.error("Salao ainda nao carregado.");
      return;
    }

    setIsReconciling(true);
    try {
      const { data, error } = await getSupabaseBrowserClient().rpc("reconcile_salon_referral_reward_unlocks", {
        target_salon_id: salonId,
      });

      if (error) {
        throw error;
      }

      await load();
      toast.success(`Reconciliacao concluida com ${Number(data ?? 0)} novas recompensas.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel reconciliar recompensas.");
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <div className="space-y-8">
      <Section title="Programa de indicacoes" action={<Button className="rounded-full" onClick={() => void saveProgram()} disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar programa"}</Button>}>
        <div className="panel grid gap-4 p-6">
          <ToggleRow
            label="Programa ativo"
            description="Quando ativo, os clientes podem indicar pelo proprio app e os eventos entram na trilha automatica."
            checked={form.is_active}
            onChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Titulo">
              <Input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
            </Field>
            <Field label="Servico recompensa">
              <Select
                value={form.reward_service_id || "none"}
                onValueChange={(value) => setForm((prev) => ({ ...prev, reward_service_id: value === "none" ? "" : value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem servico vinculado</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Descricao">
            <Textarea rows={2} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Premio para quem indicou">
              <Textarea rows={2} value={form.reward_for_referrer} onChange={(event) => setForm((prev) => ({ ...prev, reward_for_referrer: event.target.value }))} />
            </Field>
            <Field label="Premio para quem chegou">
              <Textarea rows={2} value={form.reward_for_invited} onChange={(event) => setForm((prev) => ({ ...prev, reward_for_invited: event.target.value }))} />
            </Field>
            <Field label="Referrals qualificados por unlock">
              <Input type="number" value={form.required_qualified_referrals} onChange={(event) => setForm((prev) => ({ ...prev, required_qualified_referrals: Number(event.target.value) || 1 }))} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Embaixadores e codigos" action={<Button variant="outline" className="rounded-full" onClick={() => void reconcileUnlocks()} disabled={isReconciling}>{isReconciling ? "Recalculando..." : "Reconciliar recompensas"}</Button>}>
        {isLoading && <LoadingPanel text="Carregando indicacoes..." />}
        {!isLoading && (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="panel space-y-3 p-4">
              <h3 className="font-medium">Top indicadores</h3>
              {topReferrers.length ? topReferrers.map((referrer) => (
                <div key={referrer.customerId} className="rounded-2xl border border-border p-3 text-sm">
                  <p className="font-medium">{referrer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {referrer.qualified} qualificadas • {referrer.pending} pendentes
                  </p>
                </div>
              )) : <EmptyState text="Ainda nao existem indicadores com progresso real." />}
            </div>

            <div className="panel space-y-3 p-4">
              <h3 className="font-medium">Codigos disponiveis</h3>
              {customerCodes.filter((item) => item.referral_code).slice(0, 10).map((customer) => (
                <div key={customer.id} className="rounded-2xl border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.referral_code}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void copyText(customer.referral_code || "", "Codigo copiado")}>
                      Copiar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Fila de eventos">
        {events.length ? (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">
                    {customerNameById[event.referrer_customer_id] || "Cliente"} indicou {customerNameById[event.invited_customer_id] || "novo cliente"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    criado em {formatDateTimeLabel(event.created_at)}
                    {event.qualified_at ? ` • qualificado em ${formatDateTimeLabel(event.qualified_at)}` : ""}
                  </p>
                </div>
                <StatusPill value={event.status === "qualified" ? "Qualificado" : "Pendente"} tone={event.status === "qualified" ? "success" : "warning"} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="As indicacoes do app cliente vao aparecer aqui assim que os clientes comecarem a usar os codigos." />
        )}
      </Section>

      <Section title="Recompensas destravadas">
        {unlocks.length ? (
          <div className="space-y-3">
            {unlocks.map((unlock) => (
              <div key={unlock.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">{customerNameById[unlock.referrer_customer_id] || "Cliente"}</p>
                  <p className="text-xs text-muted-foreground">
                    {unlock.reward_service_name || unlock.reward_description} • lote {unlock.threshold_reached}/{unlock.required_qualified_referrals}
                  </p>
                </div>
                <StatusPill value={unlock.status === "redeemed" ? "Resgatado" : "Disponivel"} tone={unlock.status === "redeemed" ? "default" : "success"} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Nenhuma recompensa foi liberada ainda." />
        )}
      </Section>
    </div>
  );
}

function AutomationsModule() {
  const { salonId } = useSalon();
  const { data, isLoading, reload } = useAutomationDashboard(true);
  const [form, setForm] = useState<AutomationSettingsForm>(defaultAutomationSettingsForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (data?.settings) {
      setForm(data.settings);
    }
  }, [data]);

  const saveSettings = async () => {
    if (!salonId) {
      toast.error("Salao ainda nao carregado.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await getSupabaseBrowserClient()
        .from("salon_growth_automation_settings")
        .upsert(
          {
            is_active: form.is_active,
            salon_id: salonId,
            smart_rebook_body_template: form.smart_rebook_body_template.trim(),
            smart_rebook_is_active: form.smart_rebook_is_active,
            smart_rebook_title: form.smart_rebook_title.trim(),
            smart_rebook_window_days: form.smart_rebook_window_days,
            winback_body_template: form.winback_body_template.trim(),
            winback_discount_percent: form.winback_discount_percent,
            winback_inactive_days: form.winback_inactive_days,
            winback_title: form.winback_title.trim(),
          },
          { onConflict: "salon_id" },
        );

      if (error) {
        throw error;
      }

      await reload();
      toast.success("Automacoes salvas");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar as automacoes.");
    } finally {
      setIsSaving(false);
    }
  };

  const runNow = async () => {
    setIsRunning(true);
    try {
      const { data: rpcData, error } = await getSupabaseBrowserClient().rpc("queue_due_customer_growth_notifications");
      if (error) {
        throw error;
      }

      const payload = toRecord(rpcData);
      await reload();
      toast.success(
        `Fila executada: ${Number(payload.winbackQueued ?? 0)} winbacks e ${Number(payload.smartRebookQueued ?? 0)} smart rebooks.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel disparar a fila de automacoes.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      <Section title="Panorama automatico">
        {isLoading && <LoadingPanel text="Carregando automacoes..." />}
        {!isLoading && data && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Clientes em risco" value={String(data.overview.at_risk_customers)} />
            <MiniStat label="Winbacks prontos" value={String(data.overview.due_now_customers)} />
            <MiniStat label="Smart rebook agora" value={String(data.overview.smart_rebook_due_customers)} />
            <MiniStat label="Recuperados 30d" value={String(data.overview.recovered_customers_last_30d)} />
          </div>
        )}
      </Section>

      <Section
        title="Configuracao"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => void runNow()} disabled={isRunning}>
              {isRunning ? "Processando..." : "Rodar agora"}
            </Button>
            <Button className="rounded-full" onClick={() => void saveSettings()} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar automacoes"}
            </Button>
          </div>
        }
      >
        <div className="panel grid gap-4 p-6">
          <ToggleRow
            label="Automacao de winback ativa"
            description="Clientes inativos entram em fila com oferta automatica."
            checked={form.is_active}
            onChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
          />
          <ToggleRow
            label="Smart rebook ativo"
            description="Clientes recorrentes recebem sugestao de retorno no melhor padrao de horario."
            checked={form.smart_rebook_is_active}
            onChange={(checked) => setForm((prev) => ({ ...prev, smart_rebook_is_active: checked }))}
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Dias para winback">
              <Input type="number" value={form.winback_inactive_days} onChange={(event) => setForm((prev) => ({ ...prev, winback_inactive_days: Number(event.target.value) || 0 }))} />
            </Field>
            <Field label="Desconto do winback (%)">
              <Input type="number" value={form.winback_discount_percent} onChange={(event) => setForm((prev) => ({ ...prev, winback_discount_percent: Number(event.target.value) || 0 }))} />
            </Field>
            <Field label="Janela smart rebook (dias)">
              <Input type="number" value={form.smart_rebook_window_days} onChange={(event) => setForm((prev) => ({ ...prev, smart_rebook_window_days: Number(event.target.value) || 0 }))} />
            </Field>
          </div>
          <Field label="Titulo do winback">
            <Input value={form.winback_title} onChange={(event) => setForm((prev) => ({ ...prev, winback_title: event.target.value }))} />
          </Field>
          <Field label="Corpo do winback">
            <Textarea rows={3} value={form.winback_body_template} onChange={(event) => setForm((prev) => ({ ...prev, winback_body_template: event.target.value }))} />
          </Field>
          <Field label="Titulo do smart rebook">
            <Input value={form.smart_rebook_title} onChange={(event) => setForm((prev) => ({ ...prev, smart_rebook_title: event.target.value }))} />
          </Field>
          <Field label="Corpo do smart rebook">
            <Textarea rows={3} value={form.smart_rebook_body_template} onChange={(event) => setForm((prev) => ({ ...prev, smart_rebook_body_template: event.target.value }))} />
          </Field>
        </div>
      </Section>

      <Section title="Historico recente">
        {data?.recent_runs?.length ? (
          <div className="space-y-3">
            {data.recent_runs.map((run) => (
              <div key={run.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">{run.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {run.title} • {formatDateTimeLabel(run.sent_at)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{run.body}</p>
                </div>
                <StatusPill value={run.recovered ? "Recuperado" : "Aguardando retorno"} tone={run.recovered ? "success" : "warning"} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Ainda nao existe historico de automacoes processadas." />
        )}
      </Section>
    </div>
  );
}

function NotificationsModule() {
  const { clients, salonId } = useSalon();
  const { dispatchById, isLoading, notifications, reload } = useNotificationFeed(true, salonId);
  const [form, setForm] = useState(emptyNotificationForm);
  const [isSending, setIsSending] = useState(false);

  const broadcastCount = notifications.filter((item) => item.audience === "salon_customers").length;
  const directedCount = notifications.filter((item) => item.audience === "single_customer").length;
  const lastSevenDays = notifications.filter((item) => {
    const createdAt = new Date(item.created_at);
    return Date.now() - createdAt.getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const sendNotification = async () => {
    if (!salonId) {
      toast.error("Salao ainda nao carregado.");
      return;
    }

    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Preencha titulo e mensagem.");
      return;
    }

    if (form.audience === "single_customer" && form.customerId === "all") {
      toast.error("Escolha o cliente destinatario.");
      return;
    }

    setIsSending(true);
    try {
      const { error } = await getSupabaseBrowserClient().from("salon_customer_notifications").insert({
        audience: form.audience,
        body: form.body.trim(),
        customer_id: form.audience === "single_customer" ? form.customerId : null,
        notification_type: form.notificationType.trim() || "panel_update",
        payload: {
          createdAt: new Date().toISOString(),
          createdBy: "owner_panel",
          type: form.notificationType.trim() || "panel_update",
        },
        salon_id: salonId,
        title: form.title.trim(),
      });

      if (error) {
        throw error;
      }

      setForm(emptyNotificationForm);
      await reload();
      toast.success("Notificacao enfileirada para o app cliente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar a notificacao.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <Section title="Saude da central">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Ultimas notificacoes" value={String(notifications.length)} />
          <MiniStat label="Broadcasts" value={String(broadcastCount)} />
          <MiniStat label="Direcionadas" value={String(directedCount)} />
          <MiniStat label="Ultimos 7 dias" value={String(lastSevenDays)} />
        </div>
      </Section>

      <Section title="Enviar agora">
        <div className="panel grid gap-4 p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Audiencia">
              <Select
                value={form.audience}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    audience: value as typeof prev.audience,
                    customerId: value === "single_customer" ? prev.customerId : "all",
                  }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salon_customers">Todos os clientes do salao</SelectItem>
                  <SelectItem value="single_customer">Cliente especifico</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tipo">
              <Input value={form.notificationType} onChange={(event) => setForm((prev) => ({ ...prev, notificationType: event.target.value }))} />
            </Field>
            <Field label="Cliente">
              <Select
                value={form.customerId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, customerId: value }))}
                disabled={form.audience !== "single_customer"}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Selecione</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Titulo">
            <Input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
          </Field>
          <Field label="Mensagem">
            <Textarea rows={3} value={form.body} onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))} />
          </Field>
          <div className="flex justify-end">
            <Button className="rounded-full" onClick={() => void sendNotification()} disabled={isSending}>
              {isSending ? "Enviando..." : "Enviar notificacao"}
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Fila real do app">
        {isLoading && <LoadingPanel text="Carregando notificacoes..." />}
        {!isLoading && notifications.length ? (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const dispatch = dispatchById[notification.id];
              const customer = clients.find((item) => item.id === notification.customer_id);

              return (
                <div key={notification.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium">{notification.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {notification.notification_type} • {notification.audience === "single_customer" ? customer?.name || "Cliente" : "Base inteira"} • {formatDateTimeLabel(notification.created_at)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{notification.body}</p>
                  </div>
                  <div className="text-right">
                    <StatusPill
                      value={dispatch?.status ? dispatch.status : "fila"}
                      tone={dispatch?.status === "sent" ? "success" : dispatch?.status === "failed" ? "danger" : "warning"}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      enviados {dispatch?.sent_count ?? 0} • falhas {dispatch?.failed_count ?? 0}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="Nenhuma notificacao foi enviada ainda pelo painel." />
        )}
      </Section>
    </div>
  );
}

function NotificationsExportModule() {
  const { clients, salonId } = useSalon();
  const { notifications } = useNotificationFeed(true, salonId);

  const exportCsvFile = () => {
    if (!notifications.length) {
      toast.info("Nao existe historico para exportar.");
      return;
    }

    downloadCsv(
      "notificacoes-salao.csv",
      ["id", "audiencia", "cliente", "tipo", "titulo", "mensagem", "criado_em"],
      notifications.map((item) => [
        item.id,
        item.audience,
        clients.find((client) => client.id === item.customer_id)?.name || "",
        item.notification_type,
        item.title,
        item.body,
        formatDateTimeLabel(item.created_at),
      ]),
    );
    toast.success("CSV gerado");
  };

  return (
    <div className="space-y-8">
      <Section
        title="Exportacao operacional"
        action={
          <Button className="rounded-full" onClick={exportCsvFile}>
            Baixar CSV
          </Button>
        }
      >
        {notifications.length ? (
          <div className="panel overflow-hidden">
            <div className="grid grid-cols-[140px_150px_1fr_1fr_170px] gap-4 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Audiencia</span>
              <span>Tipo</span>
              <span>Titulo</span>
              <span>Cliente</span>
              <span>Data</span>
            </div>
            {notifications.slice(0, 12).map((item) => (
              <div key={item.id} className="grid grid-cols-[140px_150px_1fr_1fr_170px] gap-4 border-b border-border px-4 py-3 text-sm last:border-b-0">
                <span>{item.audience}</span>
                <span>{item.notification_type}</span>
                <span>{item.title}</span>
                <span>{clients.find((client) => client.id === item.customer_id)?.name || "Base inteira"}</span>
                <span>{formatDateTimeLabel(item.created_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Assim que o salao enviar avisos pelo painel, o historico aparece aqui para exportacao." />
        )}
      </Section>
    </div>
  );
}

function SubscriptionsModule() {
  const { clients, refresh, salonId, services } = useSalon();
  const { isLoading, memberships, offers, reload, requests } = useSubscriptionsData(true, salonId);
  const [form, setForm] = useState<MembershipOfferForm>(emptyMembershipOfferForm);
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const activeOfferCount = offers.filter((offer) => offer.is_active).length;
  const pendingCount = requests.filter((request) => request.status === "pending").length;
  const awaitingPaymentCount = requests.filter((request) => request.status === "approved" && !request.membership_id).length;
  const activeMemberships = memberships.filter((membership) => membership.status === "active");

  const openEditor = (offer?: MembershipOfferForm) => {
    setForm(offer ? { ...offer } : emptyMembershipOfferForm);
    setOpen(true);
  };

  const saveOffer = async () => {
    if (!salonId) {
      toast.error("Salao ainda nao carregado.");
      return;
    }

    if (!form.title.trim()) {
      toast.error("Informe o titulo do plano.");
      return;
    }

    if (!form.membership_service_id) {
      toast.error("Escolha o servico vinculado ao plano.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        description: form.description.trim() || null,
        ends_on: form.ends_on || null,
        highlight_text: form.highlight_text.trim() || null,
        id: form.id || undefined,
        is_active: form.is_active,
        kind: "membership",
        membership_service_id: form.membership_service_id,
        membership_sessions_included: form.membership_sessions_included,
        membership_validity_days: form.membership_validity_days,
        price: form.price,
        salon_id: salonId,
        sort_order: form.sort_order,
        starts_on: form.starts_on || null,
        title: form.title.trim(),
      };

      const query = form.id
        ? getSupabaseBrowserClient().from("salon_offers").update(payload).eq("id", form.id).eq("salon_id", salonId)
        : getSupabaseBrowserClient().from("salon_offers").insert(payload);

      const result = await query;
      if (result.error) {
        throw result.error;
      }

      setOpen(false);
      setForm(emptyMembershipOfferForm);
      await reload();
      toast.success(form.id ? "Plano atualizado" : "Plano criado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar o plano.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteOffer = async (offerId: string) => {
    if (!salonId) {
      return;
    }

    try {
      const { error } = await getSupabaseBrowserClient().from("salon_offers").delete().eq("id", offerId).eq("salon_id", salonId);
      if (error) {
        throw error;
      }

      await reload();
      toast.success("Plano removido");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel remover o plano.");
    }
  };

  const approveRequest = async (requestId: string) => {
    try {
      const { error } = await getSupabaseBrowserClient().rpc("approve_customer_membership_request", {
        notes_input: null,
        request_uuid: requestId,
        starts_on_input: new Date().toISOString().slice(0, 10),
      });
      if (error) {
        throw error;
      }

      await Promise.all([reload(), refresh()]);
      toast.success("Pedido aprovado e aguardando pagamento");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel aprovar a solicitacao.");
    }
  };

  const markPaid = async (requestId: string) => {
    try {
      const { error } = await getSupabaseBrowserClient().rpc("mark_customer_membership_request_paid", {
        request_uuid: requestId,
      });
      if (error) {
        throw error;
      }

      await Promise.all([reload(), refresh()]);
      toast.success("Pagamento confirmado e plano ativado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel ativar o plano.");
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      const supabase = getSupabaseBrowserClient();
      const auth = await supabase.auth.getUser();
      const { error } = await supabase
        .from("customer_membership_requests")
        .update({
          approved_starts_on: null,
          decided_at: new Date().toISOString(),
          decided_by_user_id: auth.data.user?.id ?? null,
          decision_notes: "Rejeitado pelo painel do salao.",
          membership_id: null,
          payment_confirmed_at: null,
          payment_confirmed_by_user_id: null,
          status: "rejected",
        })
        .eq("id", requestId);

      if (error) {
        throw error;
      }

      await reload();
      toast.success("Solicitacao rejeitada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel rejeitar o pedido.");
    }
  };

  return (
    <div className="space-y-8">
      <Section
        title="Visao de carteira"
        action={
          <Button className="rounded-full" onClick={() => openEditor()}>
            Novo plano
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Planos ativos" value={String(activeOfferCount)} />
          <MiniStat label="Pedidos pendentes" value={String(pendingCount)} />
          <MiniStat label="Aguardando pagamento" value={String(awaitingPaymentCount)} />
          <MiniStat label="Carteira ativa" value={String(activeMemberships.length)} />
        </div>
      </Section>

      <Section title="Planos publicados">
        {offers.length ? (
          <div className="space-y-3">
            {offers.map((offer) => (
              <div key={offer.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-medium">{offer.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {offer.membership_sessions_included} sessoes • validade {offer.membership_validity_days} dias • {brl(offer.price)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill value={offer.is_active ? "Publicado" : "Pausado"} tone={offer.is_active ? "success" : "default"} />
                  <Button size="sm" variant="outline" onClick={() => openEditor(offer)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void deleteOffer(offer.id)}>
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Crie o primeiro plano para liberar assinatura real no app cliente." />
        )}
      </Section>

      <Section title="Solicitacoes vindas do app cliente">
        {isLoading && <LoadingPanel text="Carregando pedidos..." />}
        {!isLoading && requests.length ? (
          <div className="space-y-3">
            {requests.map((request) => {
              const customer = clients.find((item) => item.id === request.customer_id);
              return (
                <div key={request.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium">{customer?.name || "Cliente"} • {request.offer_title_snapshot}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.price_snapshot != null ? brl(request.price_snapshot) : "Preco sob consulta"} • pedido em {formatDateTimeLabel(request.requested_at)}
                    </p>
                    {request.notes && <p className="mt-1 text-xs text-muted-foreground">{request.notes}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      value={
                        request.status === "approved" && !request.membership_id
                          ? "Aguardando pagamento"
                          : request.status === "approved"
                            ? "Ativado"
                            : request.status === "pending"
                              ? "Pendente"
                              : request.status
                      }
                      tone={request.status === "pending" ? "warning" : request.status === "approved" ? "success" : "default"}
                    />
                    {request.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => void approveRequest(request.id)}>
                          Aprovar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void rejectRequest(request.id)}>
                          Rejeitar
                        </Button>
                      </>
                    )}
                    {request.status === "approved" && !request.membership_id && (
                      <Button size="sm" variant="outline" onClick={() => void markPaid(request.id)}>
                        Confirmar pagamento
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="Quando o cliente pedir um plano no app, a solicitacao vai aparecer aqui para aprovacao." />
        )}
      </Section>

      <Section title="Carteira ativa">
        {memberships.length ? (
          <div className="space-y-3">
            {memberships.map((membership) => {
              const customer = clients.find((item) => item.id === membership.customer_id);
              const remaining = Math.max(0, membership.sessions_included - membership.sessions_used);
              return (
                <div key={membership.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium">{customer?.name || "Cliente"} • {membership.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {membership.service_name_snapshot} • {remaining}/{membership.sessions_included} sessoes restantes • expira em {formatDateLabel(membership.expires_at)}
                    </p>
                  </div>
                  <StatusPill value={membership.status} tone={membership.status === "active" ? "success" : "default"} />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="Nenhum plano ativo foi ativado ainda." />
        )}
      </Section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {form.id ? "Editar plano" : "Novo plano"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Titulo">
              <Input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
            </Field>
            <Field label="Descricao">
              <Textarea rows={2} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Servico">
                <Select
                  value={form.membership_service_id || "none"}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, membership_service_id: value === "none" ? "" : value }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione</SelectItem>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Destaque do app">
                <Input value={form.highlight_text} onChange={(event) => setForm((prev) => ({ ...prev, highlight_text: event.target.value }))} />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Preco">
                <Input type="number" value={form.price} onChange={(event) => setForm((prev) => ({ ...prev, price: Number(event.target.value) || 0 }))} />
              </Field>
              <Field label="Sessoes">
                <Input type="number" value={form.membership_sessions_included} onChange={(event) => setForm((prev) => ({ ...prev, membership_sessions_included: Number(event.target.value) || 0 }))} />
              </Field>
              <Field label="Validade (dias)">
                <Input type="number" value={form.membership_validity_days} onChange={(event) => setForm((prev) => ({ ...prev, membership_validity_days: Number(event.target.value) || 0 }))} />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Inicio">
                <Input type="date" value={form.starts_on} onChange={(event) => setForm((prev) => ({ ...prev, starts_on: event.target.value }))} />
              </Field>
              <Field label="Fim">
                <Input type="date" value={form.ends_on} onChange={(event) => setForm((prev) => ({ ...prev, ends_on: event.target.value }))} />
              </Field>
            </div>
            <ToggleRow
              label="Plano publicado"
              description="Se desligado, o plano some do app cliente e para de aceitar novos pedidos."
              checked={form.is_active}
              onChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void saveOffer()} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsModule() {
  const { clientApp, refresh, salonId, settings } = useSalon();
  const [form, setForm] = useState<SettingsForm>({
    aiAssist: settings.aiAssist,
    brandColor: settings.brandColor,
    description: settings.description,
    email: settings.email,
    monthlyGoal: settings.monthlyGoal,
    name: settings.name,
    phone: settings.phone,
    requireStrongPassword: settings.requireStrongPassword,
    segment: settings.segment,
    twoFactor: settings.twoFactor,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm({
      aiAssist: settings.aiAssist,
      brandColor: settings.brandColor,
      description: settings.description,
      email: settings.email,
      monthlyGoal: settings.monthlyGoal,
      name: settings.name,
      phone: settings.phone,
      requireStrongPassword: settings.requireStrongPassword,
      segment: settings.segment,
      twoFactor: settings.twoFactor,
    });
  }, [settings]);

  const saveSettings = async () => {
    if (!salonId) {
      toast.error("Salao ainda nao carregado.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await getSupabaseBrowserClient()
        .from("salons")
        .update({
          auto_pilot_enabled: form.aiAssist,
          brand_color: normalizeColor(form.brandColor, settings.brandColor),
          business_type: form.segment.trim() || null,
          description: form.description.trim() || null,
          email: form.email.trim() || null,
          monthly_goal_amount: form.monthlyGoal,
          mfa_totp_enabled: form.twoFactor,
          name: form.name.trim(),
          security_require_strong_password: form.requireStrongPassword,
          whatsapp_phone: form.phone.trim() || null,
        })
        .eq("id", salonId);

      if (error) {
        throw error;
      }

      await refresh();
      toast.success("Ajustes do salao atualizados");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar os ajustes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <Section title="Identidade do salao" action={<Button className="rounded-full" onClick={() => void saveSettings()} disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar ajustes"}</Button>}>
        <div className="panel grid gap-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome do salao">
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </Field>
            <Field label="Segmento">
              <Input value={form.segment} onChange={(event) => setForm((prev) => ({ ...prev, segment: event.target.value }))} />
            </Field>
          </div>
          <Field label="Descricao">
            <Textarea rows={3} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Telefone principal">
              <Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
            </Field>
            <Field label="E-mail">
              <Input value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            </Field>
            <Field label="Cor da marca">
              <Input value={form.brandColor} onChange={(event) => setForm((prev) => ({ ...prev, brandColor: event.target.value }))} />
            </Field>
            <Field label="Meta mensal">
              <Input type="number" value={form.monthlyGoal} onChange={(event) => setForm((prev) => ({ ...prev, monthlyGoal: Number(event.target.value) || 0 }))} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Seguranca e operacao">
        <div className="panel divide-y divide-border p-2">
          <ToggleRow
            label="Autenticacao forte"
            description="Mantem o requisito de senha forte para a operacao."
            checked={form.requireStrongPassword}
            onChange={(checked) => setForm((prev) => ({ ...prev, requireStrongPassword: checked }))}
          />
          <ToggleRow
            label="MFA por TOTP"
            description="Usa a bandeira de dois fatores ja persistida no salao."
            checked={form.twoFactor}
            onChange={(checked) => setForm((prev) => ({ ...prev, twoFactor: checked }))}
          />
          <ToggleRow
            label="Assistente de IA habilitado"
            description="Mantem o motor de recomendacao ativo na leitura executiva."
            checked={form.aiAssist}
            onChange={(checked) => setForm((prev) => ({ ...prev, aiAssist: checked }))}
          />
        </div>
      </Section>

      <Section title="Status do app cliente">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Dominio publico" value={clientApp.customDomain?.trim() ? clientApp.customDomain : "nao definido"} />
          <MiniStat label="White label" value={clientApp.whiteLabelActive ? "ativo" : "inativo"} />
          <MiniStat label="Agendamento online" value={clientApp.allowOnlineBooking ? "ligado" : "desligado"} />
          <MiniStat label="Codigo do salao" value={clientApp.inviteCode} />
        </div>
      </Section>
    </div>
  );
}

function BillingModule() {
  const { cashOpen, clientApp, orders, products, salonId, settings, transactions } = useSalon();
  const { memberships, offers, requests } = useSubscriptionsData(true, salonId);

  const entries = transactions.filter((transaction) => transaction.type === "entrada").reduce((sum, item) => sum + item.amount, 0);
  const exits = transactions.filter((transaction) => transaction.type === "saida").reduce((sum, item) => sum + item.amount, 0);
  const activeMembershipRevenue = memberships
    .filter((membership) => membership.status === "active")
    .reduce((sum, membership) => sum + (membership.price_snapshot ?? 0), 0);
  const lowStockCount = products.filter((product) => product.stock <= product.minStock).length;
  const publishedPlans = offers.filter((offer) => offer.is_active).length;
  const openPlanRequests = requests.filter((request) => request.status === "pending").length;
  const goalProgress = settings.monthlyGoal > 0 ? Math.round((entries / settings.monthlyGoal) * 100) : 0;

  return (
    <div className="space-y-8">
      <Section title="Leitura executiva">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Saldo atual" value={brl(entries - exits)} />
          <MiniStat label="Receita de planos ativos" value={brl(activeMembershipRevenue)} />
          <MiniStat label="Meta mensal batida" value={`${goalProgress}%`} />
          <MiniStat label="Pedidos de plano abertos" value={String(openPlanRequests)} />
        </div>
      </Section>

      <Section title="Saude de receita">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="panel space-y-3 p-4 text-sm">
            <h3 className="font-medium">O que esta sustentando o caixa</h3>
            <MetricLine label="Entradas registradas" value={brl(entries)} />
            <MetricLine label="Saidas registradas" value={brl(exits)} />
            <MetricLine label="Planos publicados" value={String(publishedPlans)} />
            <MetricLine label="Carteira recorrente ativa" value={brl(activeMembershipRevenue)} />
          </div>
          <div className="panel space-y-3 p-4 text-sm">
            <h3 className="font-medium">Estado operacional que afeta faturamento</h3>
            <MetricLine label="Caixa do dia" value={cashOpen ? "aberto" : "fechado"} />
            <MetricLine label="White label do app" value={clientApp.whiteLabelActive ? "ativo" : "inativo"} />
            <MetricLine label="Dominio publico" value={clientApp.customDomain?.trim() || "sem dominio"} />
            <MetricLine label="Itens com estoque critico" value={String(lowStockCount)} />
            <MetricLine label="Pedidos de loja em aberto" value={String(orders.filter((order) => order.status !== "entregue").length)} />
          </div>
        </div>
      </Section>
    </div>
  );
}

function OperationsOverviewModule() {
  const { appointments, blocks, comandas, orders, products, professionals } = useSalon();

  const today = new Date().toISOString().slice(0, 10);
  const todaysAppointments = appointments.filter((appointment) => appointment.date === today);
  const pendingDeposits = todaysAppointments.filter(
    (appointment) => ["pendente", "confirmado"].includes(appointment.status) && appointment.deposit === 0,
  );
  const openTabs = comandas.filter((comanda) => comanda.status === "aberta");
  const lowStock = products.filter((product) => product.stock <= product.minStock);
  const pendingOrders = orders.filter((order) => order.status !== "entregue");
  const inactiveTeam = professionals.filter((professional) => !professional.active);
  const todaysBlocks = blocks.filter((block) => block.date === today);

  return (
    <div className="space-y-8">
      <Section title="Pulso do dia">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Agenda de hoje" value={String(todaysAppointments.length)} />
          <MiniStat label="Sinais pendentes" value={String(pendingDeposits.length)} />
          <MiniStat label="Comandas abertas" value={String(openTabs.length)} />
          <MiniStat label="Pedidos de loja" value={String(pendingOrders.length)} />
        </div>
      </Section>

      <Section title="Fila critica">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="panel space-y-3 p-4 text-sm">
            <h3 className="font-medium">Atencao imediata</h3>
            <MetricLine label="Agendamentos sem sinal hoje" value={String(pendingDeposits.length)} />
            <MetricLine label="Produtos abaixo do minimo" value={String(lowStock.length)} />
            <MetricLine label="Profissionais inativos" value={String(inactiveTeam.length)} />
            <MetricLine label="Bloqueios cadastrados hoje" value={String(todaysBlocks.length)} />
          </div>
          <div className="panel space-y-3 p-4 text-sm">
            <h3 className="font-medium">Resumo de caixa rapido</h3>
            <MetricLine label="Comandas abertas" value={String(openTabs.length)} />
            <MetricLine label="Pedidos aguardando entrega" value={String(pendingOrders.length)} />
            <MetricLine label="Baixo estoque" value={lowStock.map((item) => item.name).slice(0, 3).join(", ") || "sem alerta"} />
          </div>
        </div>
      </Section>
    </div>
  );
}

function AIModule() {
  const salon = useSalon();
  const { data: marketing } = useMarketingDashboard(true);

  const report = useMemo(
    () =>
      buildAiInsights({
        appointments: salon.appointments,
        cashOpen: salon.cashOpen,
        clientApp: salon.clientApp,
        marketing,
        orders: salon.orders,
        products: salon.products,
        professionals: salon.professionals,
        promotions: salon.promotions,
        settings: salon.settings,
        transactions: salon.transactions,
      }),
    [
      marketing,
      salon.appointments,
      salon.cashOpen,
      salon.clientApp,
      salon.orders,
      salon.products,
      salon.professionals,
      salon.promotions,
      salon.settings,
      salon.transactions,
    ],
  );

  const copyPlan = async () => {
    const plan = report.insights
      .map((insight, index) => `${index + 1}. ${insight.title}: ${insight.action}`)
      .join("\n");
    await copyText(plan, "Plano de acao copiado");
  };

  return (
    <div className="space-y-8">
      <Section title="Leitura automatica" action={<Button variant="outline" className="rounded-full" onClick={() => void copyPlan()}>Copiar plano</Button>}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Entradas" value={brl(report.summary.incoming)} />
          <MiniStat label="Clientes inativos" value={String(report.summary.inactiveCustomers)} />
          <MiniStat label="Sinais pendentes" value={String(report.summary.pendingDepositCount)} />
          <MiniStat label="Baixo estoque" value={String(report.summary.lowStockProducts)} />
        </div>
      </Section>

      <Section title="Recomendacoes operacionais">
        <div className="space-y-3">
          {report.insights.map((insight) => (
            <div key={insight.id} className="panel flex flex-wrap items-start justify-between gap-4 p-4 text-sm">
              <div>
                <p className="font-medium">{insight.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{insight.summary}</p>
                <p className="mt-3">{insight.action}</p>
              </div>
              <StatusPill value={insight.severity} tone={insight.severity === "alta" ? "danger" : insight.severity === "media" ? "warning" : "success"} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function AIExportModule() {
  const salon = useSalon();
  const { data: marketing } = useMarketingDashboard(true);
  const report = useMemo(
    () =>
      buildAiInsights({
        appointments: salon.appointments,
        cashOpen: salon.cashOpen,
        clientApp: salon.clientApp,
        marketing,
        orders: salon.orders,
        products: salon.products,
        professionals: salon.professionals,
        promotions: salon.promotions,
        settings: salon.settings,
        transactions: salon.transactions,
      }),
    [
      marketing,
      salon.appointments,
      salon.cashOpen,
      salon.clientApp,
      salon.orders,
      salon.products,
      salon.professionals,
      salon.promotions,
      salon.settings,
      salon.transactions,
    ],
  );

  const exportJson = () => {
    downloadJson("ai-salao-report.json", {
      exportedAt: new Date().toISOString(),
      insights: report.insights,
      summary: report.summary,
    });
    toast.success("Relatorio JSON gerado");
  };

  const exportCsvFile = () => {
    downloadCsv(
      "ai-salao-report.csv",
      ["titulo", "severidade", "resumo", "acao"],
      report.insights.map((insight) => [insight.title, insight.severity, insight.summary, insight.action]),
    );
    toast.success("Relatorio CSV gerado");
  };

  return (
    <div className="space-y-8">
      <Section
        title="Exportar inteligencia operacional"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={exportCsvFile}>
              CSV
            </Button>
            <Button className="rounded-full" onClick={exportJson}>
              JSON
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {report.insights.map((insight) => (
            <div key={insight.id} className="panel p-4 text-sm">
              <p className="font-medium">{insight.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{insight.summary}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Field({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={className ? `grid gap-2 ${className}` : "grid gap-2"}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function StatusPill({
  tone,
  value,
}: {
  tone: "danger" | "default" | "success" | "warning";
  value: string;
}) {
  const className = {
    danger: "bg-destructive/10 text-destructive",
    default: "bg-secondary text-foreground",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
  }[tone];

  return <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${className}`}>{value}</span>;
}

function LoadingPanel({ text }: { text: string }) {
  return <div className="panel p-6 text-sm text-muted-foreground">{text}</div>;
}
