import { seedClientApp, seedSettings } from "./salon-seed";
import type { SalonState } from "./salon-state";
import { getSupabaseBrowserClient } from "./supabase-browser";
import type {
  Appointment,
  AppointmentStatus,
  Block,
  Client,
  ClientAppConfig,
  Comanda,
  Expense,
  Post,
  Product,
  ProductOrder,
  Professional,
  Promotion,
  SalonSettings,
  Service,
  ServiceCategory,
  Transaction,
} from "./salon-types";

type LoadedSalonSnapshot = {
  salon: {
    id: string;
    joinCode: string;
    name: string;
    timezone: string;
  };
  state: SalonState;
};

type SaveServiceInput = Service;
type SaveClientInput = Client;
type SaveProfessionalInput = Professional;
type SaveAppointmentInput = Appointment;
type SaveExpenseInput = Expense;
type SavePromotionInput = Promotion;
type SaveTransactionInput = Transaction;

const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const defaultPostImageUrl = "https://placehold.co/1200x800/f5efe8/6f4e37?text=Salao";

const uiToDbAppointmentStatus: Record<AppointmentStatus, string> = {
  cancelado: "cancelled",
  concluido: "completed",
  confirmado: "confirmed",
  em_atendimento: "confirmed",
  faltou: "no_show",
  pendente: "pending",
};

const dbToUiAppointmentStatus: Record<string, AppointmentStatus> = {
  cancelled: "cancelado",
  completed: "concluido",
  confirmed: "confirmado",
  no_show: "faltou",
  pending: "pendente",
};

const uiToDbTransactionMethod: Record<Transaction["method"], string> = {
  credito: "credit_card",
  debito: "debit_card",
  dinheiro: "cash",
  pix: "pix",
};

const dbToUiTransactionMethod: Record<string, Transaction["method"]> = {
  card: "credito",
  cash: "dinheiro",
  credit_card: "credito",
  debit_card: "debito",
  money: "dinheiro",
  pix: "pix",
  transfer: "pix",
  voucher: "credito",
};

const dbToUiOrderStatus: Record<string, ProductOrder["status"]> = {
  cancelled: "entregue",
  completed: "entregue",
  confirmed: "separando",
  pending: "novo",
  ready: "pronto",
};

const uiToDbOrderStatus: Record<ProductOrder["status"], string> = {
  entregue: "completed",
  novo: "pending",
  pronto: "ready",
  separando: "confirmed",
};

function getSupabase() {
  return getSupabaseBrowserClient() as any;
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ensureTrimmedText(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} é obrigatório.`);
  }
  return normalized;
}

function colorFromSeed(value: string) {
  const palette = ["#C87D61", "#B38A6D", "#A35638", "#D4A373", "#8B5E3C", "#9A7B4F"];
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return palette[hash % palette.length];
}

function initialsFromName(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "SL";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function getDateParts(value: string | Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  });
  const parts = formatter.formatToParts(new Date(value));
  const map = new Map(parts.map((part) => [part.type, part.value]));

  return {
    date: `${map.get("year")}-${map.get("month")}-${map.get("day")}`,
    time: `${map.get("hour")}:${map.get("minute")}`,
  };
}

function toIsoFromLocalInput(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function nextDateByCadence(date: string, cadence: "weekly" | "monthly" | "yearly") {
  const next = new Date(`${date}T00:00:00`);

  if (cadence === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (cadence === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }

  return next.toISOString().slice(0, 10);
}

function readSalonString(row: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
}

function readSalonNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = row[key];
    if (value != null && value !== "") {
      const parsed = toNumber(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return fallback;
}

function readSalonBoolean(row: Record<string, unknown>, keys: string[], fallback = false) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return fallback;
}

function readSalonObject(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

function readConfigString(
  config: Record<string, unknown>,
  key: keyof ClientAppConfig | string,
  fallback = "",
) {
  const value = config[String(key)];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readConfigNumber(
  config: Record<string, unknown>,
  key: keyof ClientAppConfig | string,
  fallback = 0,
) {
  const value = config[String(key)];
  if (value == null || value === "") {
    return fallback;
  }

  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readConfigBoolean(
  config: Record<string, unknown>,
  key: keyof ClientAppConfig | string,
  fallback = false,
) {
  const value = config[String(key)];
  return typeof value === "boolean" ? value : fallback;
}

function readConfigChoice<T extends string>(
  config: Record<string, unknown>,
  key: keyof ClientAppConfig | string,
  allowed: readonly T[],
  fallback: T,
) {
  const value = config[String(key)];
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function readConfigBlocks(config: Record<string, unknown>) {
  const value = config["highlightBlocks"];
  if (!Array.isArray(value)) {
    return seedClientApp.highlightBlocks;
  }

  const blocks = value
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const row = item as any;
      const id =
        typeof row["id"] === "string" && row["id"].trim() ? row["id"].trim() : `highlight-${index + 1}`;
      const title =
        typeof row["title"] === "string" && row["title"].trim() ? row["title"].trim() : "Destaque";
      const subtitle =
        typeof row["subtitle"] === "string" && row["subtitle"].trim() ? row["subtitle"].trim() : "Saiba mais";
      const emoji = typeof row.emoji === "string" && row.emoji.trim() ? row.emoji.trim() : "✨";

      return { id, title, subtitle, emoji };
    })
    .filter(Boolean);

  return blocks.length ? (blocks as ClientAppConfig["highlightBlocks"]) : seedClientApp.highlightBlocks;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeColorInput(value: string, fallback: string) {
  const normalized = value.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(normalized) ? normalized.toUpperCase() : fallback;
}

function normalizeDomainInput(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

function normalizeClientAppConfig(input: ClientAppConfig, joinCode: string, settings: SalonSettings): ClientAppConfig {
  return {
    ...seedClientApp,
    ...input,
    accentColor: normalizeColorInput(input.accentColor, seedClientApp.accentColor),
    address: input.address.trim(),
    allowOnlineBooking: Boolean(input.allowOnlineBooking),
    appName: ensureTrimmedText(input.appName, "Nome do app"),
    autoCancelMinutes: clamp(Math.round(toNumber(input.autoCancelMinutes)), 0, 60),
    backgroundColor: normalizeColorInput(input.backgroundColor, seedClientApp.backgroundColor),
    cancelWindowHours: clamp(Math.round(toNumber(input.cancelWindowHours)), 0, 168),
    cornerStyle: ["sharp", "soft", "round"].includes(input.cornerStyle) ? input.cornerStyle : seedClientApp.cornerStyle,
    depositPercent: clamp(Math.round(toNumber(input.depositPercent)), 0, 100),
    fontStyle: ["serif", "sans", "mono"].includes(input.fontStyle) ? input.fontStyle : seedClientApp.fontStyle,
    heroCta: input.heroCta.trim() || seedClientApp.heroCta,
    heroImage: input.heroImage.trim(),
    heroSubtitle: input.heroSubtitle.trim(),
    heroTitle: input.heroTitle.trim() || ensureTrimmedText(input.appName, "Nome do app"),
    highlightBlocks: input.highlightBlocks
      .map((block, index) => ({
        emoji: block.emoji.trim() || "✨",
        id: block.id.trim() || `highlight-${index + 1}`,
        subtitle: block.subtitle.trim() || "Saiba mais",
        title: block.title.trim() || "Destaque",
      }))
      .slice(0, 8),
    inviteCode: joinCode,
    logoText: input.logoText.trim() || settings.logoText,
    primaryColor: normalizeColorInput(input.primaryColor, settings.brandColor || seedClientApp.primaryColor),
    requireDeposit: Boolean(input.requireDeposit),
    showFeed: Boolean(input.showFeed),
    showLoyalty: Boolean(input.showLoyalty),
    showPrices: Boolean(input.showPrices),
    showStore: Boolean(input.showStore),
    showTeam: Boolean(input.showTeam),
    customDomain: normalizeDomainInput(input.customDomain),
    supportPhone: input.supportPhone.trim(),
    tagline: input.tagline.trim(),
    textColor: normalizeColorInput(input.textColor, seedClientApp.textColor),
    theme: ["claro", "escuro"].includes(input.theme) ? input.theme : seedClientApp.theme,
    welcomeMessage: input.welcomeMessage.trim() || seedClientApp.welcomeMessage,
    whiteLabelActive: Boolean(input.whiteLabelActive),
  };
}

function buildSettingsFromSalon(row: Record<string, unknown>): SalonSettings {
  const name = readSalonString(row, ["name"], seedSettings.name);

  return {
    aiAssist: readSalonBoolean(row, ["auto_pilot_enabled", "ai_assist_enabled"], seedSettings.aiAssist),
    brandColor: readSalonString(row, ["brand_color"], seedSettings.brandColor),
    description: readSalonString(row, ["description", "summary"], seedSettings.description),
    email: readSalonString(row, ["email", "contact_email"], seedSettings.email),
    logoText: initialsFromName(name),
    monthlyGoal: readSalonNumber(
      row,
      ["monthly_goal_amount", "monthly_revenue_goal", "monthly_goal"],
      seedSettings.monthlyGoal,
    ),
    name,
    phone: readSalonString(row, ["whatsapp_phone", "phone", "contact_phone"], seedSettings.phone),
    requireStrongPassword: readSalonBoolean(
      row,
      ["security_require_strong_password"],
      seedSettings.requireStrongPassword,
    ),
    segment: readSalonString(row, ["business_type", "segment"], seedSettings.segment),
    twoFactor: readSalonBoolean(row, ["mfa_totp_enabled"], seedSettings.twoFactor),
  };
}

function buildClientAppConfig(
  row: Record<string, unknown>,
  settings: SalonSettings,
  joinCode: string,
) {
  const config = readSalonObject(row, "client_app_config");

  return normalizeClientAppConfig({
    ...seedClientApp,
    accentColor: readConfigString(config, "accentColor", seedClientApp.accentColor),
    address: readConfigString(config, "address", seedClientApp.address),
    allowOnlineBooking: readConfigBoolean(
      config,
      "allowOnlineBooking",
      readSalonBoolean(row, ["booking_policy_enabled"], seedClientApp.allowOnlineBooking),
    ),
    appName: readConfigString(config, "appName", settings.name),
    autoCancelMinutes: readConfigNumber(
      config,
      "autoCancelMinutes",
      readSalonNumber(row, ["booking_policy_auto_cancel_lead_minutes"], seedClientApp.autoCancelMinutes),
    ),
    backgroundColor: readConfigString(config, "backgroundColor", seedClientApp.backgroundColor),
    cancelWindowHours: readConfigNumber(
      config,
      "cancelWindowHours",
      readSalonNumber(
        row,
        ["booking_policy_cancellation_window_hours"],
        seedClientApp.cancelWindowHours,
      ),
    ),
    cornerStyle: readConfigChoice(config, "cornerStyle", ["sharp", "soft", "round"], seedClientApp.cornerStyle),
    depositPercent: readConfigNumber(config, "depositPercent", seedClientApp.depositPercent),
    fontStyle: readConfigChoice(config, "fontStyle", ["serif", "sans", "mono"], seedClientApp.fontStyle),
    heroCta: readConfigString(config, "heroCta", seedClientApp.heroCta),
    heroImage: readConfigString(config, "heroImage", seedClientApp.heroImage),
    heroSubtitle: readConfigString(config, "heroSubtitle", seedClientApp.heroSubtitle),
    heroTitle: readConfigString(config, "heroTitle", settings.name),
    highlightBlocks: readConfigBlocks(config),
    inviteCode: joinCode,
    logoText: readConfigString(config, "logoText", settings.logoText),
    primaryColor: readConfigString(config, "primaryColor", settings.brandColor || seedClientApp.primaryColor),
    requireDeposit: readConfigBoolean(
      config,
      "requireDeposit",
      readSalonBoolean(row, ["booking_policy_requires_deposit"], seedClientApp.requireDeposit),
    ),
    customDomain: readConfigString(config, "customDomain", seedClientApp.customDomain ?? ""),
    showFeed: readConfigBoolean(config, "showFeed", seedClientApp.showFeed),
    showLoyalty: readConfigBoolean(config, "showLoyalty", seedClientApp.showLoyalty),
    showPrices: readConfigBoolean(config, "showPrices", seedClientApp.showPrices),
    showStore: readConfigBoolean(config, "showStore", seedClientApp.showStore),
    showTeam: readConfigBoolean(config, "showTeam", seedClientApp.showTeam),
    supportPhone: readConfigString(config, "supportPhone", settings.phone),
    tagline: readConfigString(config, "tagline", readSalonString(row, ["tagline"], seedClientApp.tagline)),
    textColor: readConfigString(config, "textColor", seedClientApp.textColor),
    theme: readConfigChoice(config, "theme", ["claro", "escuro"], seedClientApp.theme),
    welcomeMessage: readConfigString(
      config,
      "welcomeMessage",
      readSalonString(row, ["tagline", "description", "summary"], seedClientApp.welcomeMessage),
    ),
    whiteLabelActive: readConfigBoolean(config, "whiteLabelActive", seedClientApp.whiteLabelActive ?? false),
  }, joinCode, settings);
}

function unwrapRequired(result: { data: any; error?: { message?: string | null } | null }, message: string) {
  if (result.error) {
    throw new Error(result.error.message?.trim() || message);
  }
  return result.data as any;
}

function unwrapOptional<T>(result: { data: any; error?: { message?: string | null } | null }, fallback: T) {
  if (result.error) {
    return fallback;
  }
  return (result.data ?? fallback) as T;
}

function buildProfessionalHours(rows: any[]) {
  const openRows = rows.filter((row) => row["is_open"] === true);
  const firstOpen = openRows[0] as any;
  const lastOpen = openRows[openRows.length - 1] as any;
  const startTime = typeof firstOpen?.["opens_at"] === "string" ? firstOpen["opens_at"].slice(0, 5) : "09:00";
  const endTime =
    typeof lastOpen?.["closes_at"] === "string"
      ? lastOpen["closes_at"].slice(0, 5)
      : "18:00";

  return {
    endTime,
    startTime,
    workdays: openRows
      .map((row) => weekdayLabels[toNumber(row["weekday"])] ?? null)
      .filter(Boolean) as string[],
  };
}

export async function loadSalonSnapshot(userId: string): Promise<LoadedSalonSnapshot | null> {
  const supabase = getSupabase();
  const salonResult = await supabase.from("salons").select("*").eq("owner_user_id", userId).maybeSingle();
  const salon = unwrapRequired(salonResult, "Não foi possível carregar o salão.");

  if (!salon) {
    return null;
  }

  const salonRow = salon as Record<string, unknown>;
  const salonId = String(salon.id);
  const timeZone = readSalonString(salonRow, ["timezone"], "America/Sao_Paulo");

  const [
    categoriesResult,
    servicesResult,
    staffResult,
    assignmentsResult,
    staffHoursResult,
    blocksResult,
    clientsResult,
    membershipsResult,
    membershipRedemptionsResult,
    appointmentsResult,
    appointmentPaymentsResult,
    financialTransactionsResult,
    payablesResult,
    recurringExpensesResult,
    cashSessionsResult,
    productsResult,
    ordersResult,
    orderItemsResult,
    postsResult,
    commentsResult,
    likesResult,
    offersResult,
    tabsResult,
    tabItemsResult,
    tabPaymentsResult,
  ] = await Promise.all([
    supabase.from("service_categories").select("id, name").eq("salon_id", salonId).order("name"),
    supabase
      .from("services")
      .select("id, name, service_category_id, duration, price, description, is_active")
      .eq("salon_id", salonId)
      .order("name"),
    supabase
      .from("staff_members")
      .select("id, name, role, phone, is_active, commission_rate_percent")
      .eq("salon_id", salonId)
      .order("name"),
    supabase.from("staff_service_assignments").select("staff_member_id, service_id"),
    supabase
      .from("staff_business_hours")
      .select("staff_member_id, weekday, is_open, opens_at, closes_at"),
    supabase
      .from("staff_blocks")
      .select("id, staff_member_id, starts_at, ends_at, reason")
      .eq("salon_id", salonId)
      .order("starts_at"),
    supabase
      .from("customers")
      .select("id, name, phone, email, birthday, notes, tags, created_at")
      .eq("salon_id", salonId)
      .order("name"),
    supabase
      .from("customer_memberships")
      .select("id, customer_id, title, sessions_included, sessions_used, status, expires_at")
      .eq("salon_id", salonId),
    supabase
      .from("customer_membership_redemptions")
      .select("appointment_id, reversed_at")
      .eq("salon_id", salonId),
    supabase
      .from("appointments")
      .select("id, customer_id, service_id, staff_member_id, date, status, notes, deposit_amount, service_price_snapshot")
      .eq("salon_id", salonId)
      .order("date", { ascending: false }),
    supabase
      .from("appointment_payments")
      .select("id, appointment_id, amount, payment_method, paid_at")
      .eq("salon_id", salonId)
      .order("paid_at", { ascending: false }),
    supabase
      .from("salon_financial_transactions")
      .select("id, title, category, entry_type, payment_method, amount, occurred_on, source")
      .eq("salon_id", salonId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("salon_payables")
      .select("id, title, category, amount, due_on, status, payment_method, notes, paid_on")
      .eq("salon_id", salonId)
      .order("due_on"),
    supabase
      .from("salon_recurring_expenses")
      .select("id, title, category, amount, next_due_on, is_active, cadence, payment_method, notes, last_posted_on")
      .eq("salon_id", salonId)
      .order("next_due_on"),
    supabase
      .from("salon_cash_sessions")
      .select("id, session_date, status")
      .eq("salon_id", salonId)
      .order("session_date", { ascending: false })
      .limit(10),
    supabase
      .from("inventory_products")
      .select("id, name, brand, retail_price, current_stock, minimum_stock, is_active")
      .eq("salon_id", salonId)
      .order("name"),
    supabase
      .from("customer_product_orders")
      .select("id, customer_id, status, subtotal_amount, total_items, created_at, order_number")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_product_order_items")
      .select("id, order_id, product_name_snapshot, quantity")
      .eq("salon_id", salonId),
    supabase
      .from("salon_posts")
      .select("id, title, caption, created_at")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false }),
    supabase
      .from("salon_post_comments")
      .select("id, post_id, customer_name, body")
      .order("created_at", { ascending: false }),
    supabase.from("salon_post_likes").select("post_id"),
    supabase
      .from("salon_offers")
      .select("id, title, highlight_text, price, is_active")
      .eq("salon_id", salonId)
      .eq("kind", "promotion")
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("customer_tabs")
      .select("id, customer_id, status, opened_at")
      .eq("salon_id", salonId)
      .order("opened_at", { ascending: false }),
    supabase
      .from("customer_tab_items")
      .select("id, tab_id, description, total")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_tab_payments")
      .select("id, tab_id, method, amount")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false }),
  ]);

  const categoriesRows = unwrapRequired(categoriesResult, "Não foi possível carregar as categorias.") ?? [];
  const servicesRows = unwrapRequired(servicesResult, "Não foi possível carregar os serviços.") ?? [];
  const staffRows = unwrapRequired(staffResult, "Não foi possível carregar a equipe.") ?? [];
  const assignmentsRows = unwrapOptional(assignmentsResult, []);
  const staffHoursRows = unwrapOptional(staffHoursResult, []);
  const blocksRows = unwrapOptional(blocksResult, []);
  const clientsRows = unwrapRequired(clientsResult, "Não foi possível carregar os clientes.") ?? [];
  const membershipsRows = unwrapOptional(membershipsResult, []);
  const membershipRedemptionsRows = unwrapOptional(membershipRedemptionsResult, []);
  const appointmentsRows = unwrapRequired(appointmentsResult, "Não foi possível carregar a agenda.") ?? [];
  const appointmentPaymentsRows = unwrapOptional(appointmentPaymentsResult, []);
  const financialTransactionsRows = unwrapOptional(financialTransactionsResult, []);
  const payablesRows = unwrapOptional(payablesResult, []);
  const recurringExpensesRows = unwrapOptional(recurringExpensesResult, []);
  const cashSessionsRows = unwrapOptional(cashSessionsResult, []);
  const productsRows = unwrapOptional(productsResult, []);
  const ordersRows = unwrapOptional(ordersResult, []);
  const orderItemsRows = unwrapOptional(orderItemsResult, []);
  const postsRows = unwrapOptional(postsResult, []);
  const commentsRows = unwrapOptional(commentsResult, []);
  const likesRows = unwrapOptional(likesResult, []);
  const offersRows = unwrapOptional(offersResult, []);
  const tabsRows = unwrapOptional(tabsResult, []);
  const tabItemsRows = unwrapOptional(tabItemsResult, []);
  const tabPaymentsRows = unwrapOptional(tabPaymentsResult, []);

  const categories: ServiceCategory[] = categoriesRows.map((row: any) => ({
    color: colorFromSeed(String(row.name ?? row.id)),
    id: String(row.id),
    name: String(row.name ?? "Categoria"),
  }));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  const services: Service[] = servicesRows.map((row: any) => ({
    active: row.is_active !== false,
    categoryId: String(row.service_category_id),
    description: typeof row.description === "string" ? row.description : "",
    duration: toNumber(row.duration),
    id: String(row.id),
    name: String(row.name ?? "Serviço"),
    price: toNumber(row.price),
  }));
  const serviceMap = new Map(services.map((service) => [service.id, service]));

  const assignmentsByProfessional = new Map<string, string[]>();
  for (const row of assignmentsRows as any[]) {
    const professionalId = String(row.staff_member_id);
    const current = assignmentsByProfessional.get(professionalId) ?? [];
    current.push(String(row.service_id));
    assignmentsByProfessional.set(professionalId, current);
  }

  const staffHoursByProfessional = new Map<string, Array<Record<string, unknown>>>();
  for (const row of staffHoursRows as any[]) {
    const professionalId = String(row.staff_member_id);
    const current = staffHoursByProfessional.get(professionalId) ?? [];
    current.push(row);
    current.sort((left, right) => toNumber((left as any)["weekday"]) - toNumber((right as any)["weekday"]));
    staffHoursByProfessional.set(professionalId, current);
  }

  const professionals: Professional[] = staffRows.map((row: any) => {
    const hours = buildProfessionalHours(staffHoursByProfessional.get(String(row.id)) ?? []);
    return {
      active: row.is_active !== false,
      commission: toNumber(row.commission_rate_percent),
      endTime: hours.endTime,
      id: String(row.id),
      name: String(row.name ?? "Profissional"),
      phone: typeof row.phone === "string" ? row.phone : "",
      role: typeof row.role === "string" ? row.role : "",
      serviceIds: assignmentsByProfessional.get(String(row.id)) ?? [],
      startTime: hours.startTime,
      workdays: hours.workdays.length ? hours.workdays : ["Seg", "Ter", "Qua", "Qui", "Sex"],
    };
  });
  const professionalMap = new Map(professionals.map((professional) => [professional.id, professional]));

  const activeMembershipByCustomer = new Map<string, any>();
  for (const row of membershipsRows as any[]) {
    if (row.status !== "active") {
      continue;
    }
    const remaining = toNumber(row.sessions_included) - toNumber(row.sessions_used);
    if (remaining <= 0) {
      continue;
    }
    activeMembershipByCustomer.set(String(row.customer_id), row);
  }

  const appointmentRowsByCustomer = new Map<string, any[]>();
  for (const row of appointmentsRows as any[]) {
    const current = appointmentRowsByCustomer.get(String(row.customer_id)) ?? [];
    current.push(row);
    appointmentRowsByCustomer.set(String(row.customer_id), current);
  }

  const paymentAmountByAppointment = new Map<string, number>();
  for (const row of appointmentPaymentsRows as any[]) {
    paymentAmountByAppointment.set(String(row.appointment_id), toNumber(row.amount));
  }

  const consumedAppointmentIds = new Set(
    (membershipRedemptionsRows as any[])
      .filter((row) => !row.reversed_at && row.appointment_id)
      .map((row) => String(row.appointment_id)),
  );

  const spentByCustomer = new Map<string, number>();
  for (const row of appointmentsRows as any[]) {
    const appointmentId = String(row.id);
    const customerId = String(row.customer_id);
    const current = spentByCustomer.get(customerId) ?? 0;
    spentByCustomer.set(customerId, current + (paymentAmountByAppointment.get(appointmentId) ?? 0));
  }

  const clients: Client[] = clientsRows.map((row: any) => {
    const customerId = String(row.id);
    const customerAppointments = appointmentRowsByCustomer.get(customerId) ?? [];
    const completedAppointments = customerAppointments.filter((appointment) => appointment.status === "completed");
    const lastVisitSource = completedAppointments[0] ?? customerAppointments[0] ?? null;
    const membership = activeMembershipByCustomer.get(customerId);

    return {
      birthday:
        typeof row.birthday === "string"
          ? row.birthday
          : "",
      email: typeof row.email === "string" ? row.email : "",
      id: customerId,
      lastVisit: lastVisitSource
        ? getDateParts(String(lastVisitSource.date), timeZone).date
        : "-",
      name: String(row.name ?? "Cliente"),
      notes: typeof row.notes === "string" ? row.notes : "",
      phone: typeof row.phone === "string" ? row.phone : "",
      plan: membership?.title ?? undefined,
      planSessions: membership
        ? Math.max(0, toNumber(membership.sessions_included) - toNumber(membership.sessions_used))
        : undefined,
      since: typeof row.created_at === "string" ? String(row.created_at).slice(0, 10) : "",
      tags: Array.isArray(row.tags) ? row.tags.filter((tag: unknown) => typeof tag === "string") : [],
      totalSpent: spentByCustomer.get(customerId) ?? 0,
      visits: completedAppointments.length,
    };
  });
  const clientMap = new Map(clients.map((client) => [client.id, client]));

  const appointments: Appointment[] = appointmentsRows.map((row: any) => {
    const slot = getDateParts(String(row.date), timeZone);
    const service = serviceMap.get(String(row.service_id));
    return {
      clientId: String(row.customer_id),
      date: slot.date,
      deposit: toNumber(row.deposit_amount),
      id: String(row.id),
      notes: typeof row.notes === "string" ? row.notes : undefined,
      price: toNumber(row.service_price_snapshot ?? service?.price ?? 0),
      professionalId: String(row.staff_member_id),
      serviceId: String(row.service_id),
      status: dbToUiAppointmentStatus[String(row.status)] ?? "pendente",
      time: slot.time,
      usedPlanSession: consumedAppointmentIds.has(String(row.id)),
    };
  });

  const blocks: Block[] = blocksRows.map((row: any) => {
    const startsAt = getDateParts(String(row.starts_at), timeZone);
    const endsAt = getDateParts(String(row.ends_at), timeZone);
    return {
      date: startsAt.date,
      from: startsAt.time,
      id: String(row.id),
      professionalId: String(row.staff_member_id),
      reason: typeof row.reason === "string" ? row.reason : "Bloqueio",
      to: endsAt.time,
    };
  });

  const transactions: Transaction[] = financialTransactionsRows.map((row: any) => ({
    amount: toNumber(row.amount),
    category: typeof row.category === "string" ? row.category : "Geral",
    date: typeof row.occurred_on === "string" ? row.occurred_on : new Date().toISOString().slice(0, 10),
    description: typeof row.title === "string" ? row.title : "Transação",
    id: String(row.id),
    method: dbToUiTransactionMethod[String(row.payment_method ?? "").toLowerCase()] ?? "pix",
    type: row.entry_type === "expense" ? "saida" : "entrada",
  }));

  const expenses: Expense[] = [
    ...(payablesRows as any[]).map(
      (row) =>
        ({
          amount: toNumber(row.amount),
          description: String(row.title ?? "Despesa"),
          dueDate: String(row.due_on ?? new Date().toISOString().slice(0, 10)),
          id: `payable:${row.id}`,
          paid: row.status === "paid",
          recurring: false,
        }) satisfies Expense,
    ),
    ...(recurringExpensesRows as any[]).map(
      (row) =>
        ({
          amount: toNumber(row.amount),
          description: String(row.title ?? "Despesa recorrente"),
          dueDate: String(row.next_due_on ?? new Date().toISOString().slice(0, 10)),
          id: `recurring:${row.id}`,
          paid: false,
          recurring: true,
        }) satisfies Expense,
    ),
  ].sort((left, right) => left.dueDate.localeCompare(right.dueDate));

  const products: Product[] = (productsRows as any[]).map((row) => ({
    brand: typeof row.brand === "string" ? row.brand : "",
    id: String(row.id),
    minStock: toNumber(row.minimum_stock),
    name: String(row.name ?? "Produto"),
    price: toNumber(row.retail_price),
    stock: toNumber(row.current_stock),
  }));

  const orderItemsByOrder = new Map<string, any[]>();
  for (const row of orderItemsRows as any[]) {
    const orderId = String(row.order_id);
    const current = orderItemsByOrder.get(orderId) ?? [];
    current.push(row);
    orderItemsByOrder.set(orderId, current);
  }

  const orders: ProductOrder[] = (ordersRows as any[])
    .filter((row) => row.status !== "cancelled")
    .map((row) => {
      const customer = clientMap.get(String(row.customer_id));
      const items = orderItemsByOrder.get(String(row.id)) ?? [];
      const firstItem = items[0];

      return {
        clientName: customer?.name ?? "Cliente",
        id: String(row.id),
        productName: firstItem?.product_name_snapshot ?? "Pedido",
        status: dbToUiOrderStatus[String(row.status)] ?? "novo",
        total: toNumber(row.subtotal_amount),
      };
    });

  const commentsByPost = new Map<string, Array<Post["comments"][number]>>();
  for (const row of commentsRows as any[]) {
    const postId = String(row.post_id);
    const current = commentsByPost.get(postId) ?? [];
    current.push({
      author: typeof row.customer_name === "string" ? row.customer_name : "Cliente",
      id: String(row.id),
      text: typeof row.body === "string" ? row.body : "",
    });
    commentsByPost.set(postId, current);
  }

  const likesByPost = new Map<string, number>();
  for (const row of likesRows as any[]) {
    const postId = String(row.post_id);
    likesByPost.set(postId, (likesByPost.get(postId) ?? 0) + 1);
  }

  const posts: Post[] = (postsRows as any[]).map((row) => ({
    body: typeof row.caption === "string" ? row.caption : "",
    comments: commentsByPost.get(String(row.id)) ?? [],
    createdAt: typeof row.created_at === "string" ? String(row.created_at).slice(0, 10) : "",
    format: "standard",
    id: String(row.id),
    likes: likesByPost.get(String(row.id)) ?? 0,
    title: String(row.title ?? "Post"),
  }));

  const promotions: Promotion[] = (offersRows as any[]).map((row) => ({
    active: row.is_active !== false,
    channel: typeof row.highlight_text === "string" && row.highlight_text.trim()
      ? row.highlight_text
      : "App do cliente",
    discount: toNumber(row.price),
    id: String(row.id),
    name: String(row.title ?? "Promoção"),
    redemptions: 0,
  }));

  const tabItemsByTab = new Map<string, Comanda["items"]>();
  for (const row of tabItemsRows as any[]) {
    const tabId = String(row.tab_id);
    const current = tabItemsByTab.get(tabId) ?? [];
    current.push({
      id: String(row.id),
      name: String(row.description ?? "Item"),
      price: toNumber(row.total),
    });
    tabItemsByTab.set(tabId, current);
  }

  const tabPaymentsByTab = new Map<string, Comanda["payments"]>();
  for (const row of tabPaymentsRows as any[]) {
    const tabId = String(row.tab_id);
    const current = tabPaymentsByTab.get(tabId) ?? [];
    current.push({
      amount: toNumber(row.amount),
      id: String(row.id),
      method: typeof row.method === "string" ? row.method : "pix",
    });
    tabPaymentsByTab.set(tabId, current);
  }

  const comandas: Comanda[] = (tabsRows as any[]).map((row) => {
    const customer = row.customer_id ? clientMap.get(String(row.customer_id)) : null;
    const opened = getDateParts(String(row.opened_at), timeZone);
    return {
      clientName: customer?.name ?? "Cliente avulso",
      id: String(row.id),
      items: tabItemsByTab.get(String(row.id)) ?? [],
      opened: opened.time,
      payments: tabPaymentsByTab.get(String(row.id)) ?? [],
      status: row.status === "open" ? "aberta" : "fechada",
    };
  });

  const settings = buildSettingsFromSalon(salonRow);
  const clientApp = buildClientAppConfig(salonRow, settings, String(salon.join_code ?? ""));
  const todayKey = getDateParts(new Date(), timeZone).date;
  const cashOpen = (cashSessionsRows as any[]).some(
    (row) => row.status === "open" && row.session_date === todayKey,
  );

  return {
    salon: {
      id: salonId,
      joinCode: String(salon.join_code ?? ""),
      name: settings.name,
      timezone: timeZone,
    },
    state: {
      appointments,
      blocks,
      cashOpen,
      categories,
      clientApp,
      clients,
      comandas,
      expenses,
      orders,
      posts,
      products,
      professionals,
      promotions,
      services,
      settings,
      transactions,
    },
  };
}

export async function saveClientAppConfig(salonId: string, input: ClientAppConfig) {
  const supabase = getSupabase();
  const salonResult = await supabase
    .from("salons")
    .select("id, join_code, brand_color, name, whatsapp_phone")
    .eq("id", salonId)
    .single();
  const salon = unwrapRequired(salonResult, "NÃ£o foi possÃ­vel localizar o salÃ£o.");
  const salonRow = salon as Record<string, unknown>;
  const settings = buildSettingsFromSalon(salonRow);
  const joinCode = readSalonString(salonRow, ["join_code"], input.inviteCode || "");
  const normalized = normalizeClientAppConfig(input, joinCode, settings);

  const clientAppConfigPayload = {
    accentColor: normalized.accentColor,
    address: normalized.address,
    allowOnlineBooking: normalized.allowOnlineBooking,
    appName: normalized.appName,
    autoCancelMinutes: normalized.autoCancelMinutes,
    backgroundColor: normalized.backgroundColor,
    cancelWindowHours: normalized.cancelWindowHours,
    cornerStyle: normalized.cornerStyle,
    depositPercent: normalized.depositPercent,
    fontStyle: normalized.fontStyle,
    heroCta: normalized.heroCta,
    heroImage: normalized.heroImage,
    heroSubtitle: normalized.heroSubtitle,
    heroTitle: normalized.heroTitle,
    highlightBlocks: normalized.highlightBlocks,
    inviteCode: normalized.inviteCode,
    logoText: normalized.logoText,
    primaryColor: normalized.primaryColor,
    customDomain: normalized.customDomain,
    requireDeposit: normalized.requireDeposit,
    showFeed: normalized.showFeed,
    showLoyalty: normalized.showLoyalty,
    showPrices: normalized.showPrices,
    showStore: normalized.showStore,
    showTeam: normalized.showTeam,
    supportPhone: normalized.supportPhone,
    tagline: normalized.tagline,
    textColor: normalized.textColor,
    theme: normalized.theme,
    welcomeMessage: normalized.welcomeMessage,
    whiteLabelActive: normalized.whiteLabelActive,
  };

  const payload = {
    booking_policy_auto_cancel_lead_minutes: normalized.autoCancelMinutes,
    booking_policy_auto_cancel_unconfirmed: normalized.autoCancelMinutes > 0,
    booking_policy_cancellation_window_hours: normalized.cancelWindowHours,
    booking_policy_enabled: normalized.allowOnlineBooking,
    booking_policy_requires_deposit: normalized.requireDeposit,
    brand_color: normalized.primaryColor,
    client_app_config: clientAppConfigPayload,
    name: normalized.appName,
    tagline: normalized.tagline || null,
    whatsapp_phone: normalized.supportPhone || null,
  };

  const result = await supabase.from("salons").update(payload).eq("id", salonId);

  if (result.error) {
    throw new Error(result.error.message || "NÃ£o foi possÃ­vel salvar o app do cliente.");
  }
}

export async function saveCategory(salonId: string, input: { id?: string; name: string }) {
  const supabase = getSupabase();
  const name = ensureTrimmedText(input.name, "Nome da categoria");
  const table = supabase.from("service_categories");

  const result = input.id
    ? await table.update({ name }).eq("id", input.id).eq("salon_id", salonId)
    : await table.insert({ is_active: true, name, salon_id: salonId });

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível salvar a categoria.");
  }
}

export async function deleteCategory(salonId: string, categoryId: string) {
  const result = await getSupabase()
    .from("service_categories")
    .delete()
    .eq("id", categoryId)
    .eq("salon_id", salonId);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível excluir a categoria.");
  }
}

export async function saveService(salonId: string, input: SaveServiceInput, categoryName: string) {
  const supabase = getSupabase();
  const payload = {
    category: categoryName,
    description: input.description?.trim() || null,
    duration: input.duration,
    is_active: input.active,
    name: ensureTrimmedText(input.name, "Nome do serviço"),
    price: input.price,
    salon_id: salonId,
    service_category_id: input.categoryId,
  };
  const table = supabase.from("services");

  const result = input.id
    ? await table.update(payload).eq("id", input.id).eq("salon_id", salonId)
    : await table.insert(payload);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível salvar o serviço.");
  }
}

export async function deleteService(salonId: string, serviceId: string) {
  const result = await getSupabase().from("services").delete().eq("id", serviceId).eq("salon_id", salonId);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível excluir o serviço.");
  }
}

export async function saveClient(salonId: string, input: SaveClientInput) {
  const supabase = getSupabase();
  const payload = {
    birthday: input.birthday || null,
    email: input.email?.trim() || null,
    name: ensureTrimmedText(input.name, "Nome do cliente"),
    notes: input.notes?.trim() || null,
    phone: input.phone?.trim() || null,
    salon_id: salonId,
    tags: input.tags ?? [],
  };
  const table = supabase.from("customers");

  const result = input.id
    ? await table.update(payload).eq("id", input.id).eq("salon_id", salonId)
    : await table.insert(payload);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível salvar o cliente.");
  }
}

export async function deleteClient(salonId: string, clientId: string) {
  const result = await getSupabase().from("customers").delete().eq("id", clientId).eq("salon_id", salonId);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível excluir o cliente.");
  }
}

async function syncProfessionalAssignments(professionalId: string, serviceIds: string[]) {
  const supabase = getSupabase();
  await supabase.from("staff_service_assignments").delete().eq("staff_member_id", professionalId);

  if (!serviceIds.length) {
    return;
  }

  const result = await supabase.from("staff_service_assignments").insert(
    Array.from(new Set(serviceIds)).map((serviceId) => ({
      service_id: serviceId,
      staff_member_id: professionalId,
    })),
  );

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível sincronizar os serviços do profissional.");
  }
}

async function syncProfessionalHours(professionalId: string, workdays: string[], startTime: string, endTime: string) {
  const rows = weekdayLabels.map((label, weekday) => {
    const isOpen = workdays.includes(label);

    return {
      closes_at: isOpen ? `${endTime}:00` : null,
      is_open: isOpen,
      opens_at: isOpen ? `${startTime}:00` : null,
      staff_member_id: professionalId,
      weekday,
    };
  });

  const result = await getSupabase().from("staff_business_hours").upsert(rows);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível salvar a jornada do profissional.");
  }
}

export async function saveProfessional(salonId: string, input: SaveProfessionalInput) {
  const supabase = getSupabase();
  const payload = {
    commission_rate_percent: input.commission,
    is_active: input.active,
    name: ensureTrimmedText(input.name, "Nome do profissional"),
    phone: input.phone?.trim() || null,
    role: input.role?.trim() || null,
    salon_id: salonId,
  };
  const table = supabase.from("staff_members");

  const result = input.id
    ? await table.update(payload).eq("id", input.id).eq("salon_id", salonId).select("id").single()
    : await table.insert(payload).select("id").single();

  if (result.error || !result.data?.id) {
    throw new Error(result.error?.message || "Não foi possível salvar o profissional.");
  }

  const professionalId = String(result.data.id);
  await syncProfessionalAssignments(professionalId, input.serviceIds ?? []);
  await syncProfessionalHours(professionalId, input.workdays ?? [], input.startTime, input.endTime);
}

export async function deleteProfessional(salonId: string, professionalId: string) {
  const result = await getSupabase()
    .from("staff_members")
    .delete()
    .eq("id", professionalId)
    .eq("salon_id", salonId);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível excluir o profissional.");
  }
}

export async function saveBlock(salonId: string, input: Block) {
  const supabase = getSupabase();
  const payload = {
    ends_at: toIsoFromLocalInput(input.date, input.to),
    reason: input.reason?.trim() || null,
    salon_id: salonId,
    staff_member_id: input.professionalId,
    starts_at: toIsoFromLocalInput(input.date, input.from),
  };
  const table = supabase.from("staff_blocks");
  const result = input.id
    ? await table.update(payload).eq("id", input.id).eq("salon_id", salonId)
    : await table.insert(payload);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível salvar o bloqueio.");
  }
}

export async function deleteBlock(salonId: string, blockId: string) {
  const result = await getSupabase().from("staff_blocks").delete().eq("id", blockId).eq("salon_id", salonId);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível remover o bloqueio.");
  }
}

export async function saveAppointment(input: SaveAppointmentInput) {
  const supabase = getSupabase();
  const requestedDate = toIsoFromLocalInput(input.date, input.time);

  const result = input.id
    ? await supabase.rpc("update_management_appointment", {
        appointment_uuid: input.id,
        customer_uuid: input.clientId,
        notes_input: input.notes ?? null,
        payment_preference_input: null,
        requested_date: requestedDate,
        service_uuid: input.serviceId,
        staff_member_uuid: input.professionalId,
      })
    : await supabase.rpc("create_management_appointment", {
        customer_uuid: input.clientId,
        notes_input: input.notes ?? null,
        payment_preference_input: null,
        requested_date: requestedDate,
        service_uuid: input.serviceId,
        staff_member_uuid: input.professionalId,
      });

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível salvar o agendamento.");
  }

  const appointmentId = String(result.data?.id ?? input.id ?? "");
  if (!appointmentId) {
    return;
  }

  const depositResult = await supabase
    .from("appointments")
    .update({ deposit_amount: Math.max(0, input.deposit ?? 0) })
    .eq("id", appointmentId);

  if (depositResult.error) {
    throw new Error(depositResult.error.message || "Não foi possível salvar o sinal do agendamento.");
  }
}

export async function setAppointmentStatus(appointmentId: string, status: AppointmentStatus) {
  const supabase = getSupabase();
  const dbStatus = uiToDbAppointmentStatus[status];

  if (dbStatus === "completed") {
    const result = await supabase.rpc("mark_appointment_completed", {
      appointment_uuid: appointmentId,
    });
    if (result.error) {
      throw new Error(result.error.message || "Não foi possível concluir o atendimento.");
    }
    return;
  }

  if (dbStatus === "cancelled") {
    const result = await supabase.rpc("cancel_appointment", {
      appointment_uuid: appointmentId,
      cancellation_reason_input: "Cancelado pelo salão.",
    });
    if (result.error) {
      throw new Error(result.error.message || "Não foi possível cancelar o agendamento.");
    }
    return;
  }

  const result = await supabase
    .from("appointments")
    .update({
      status: dbStatus,
    })
    .eq("id", appointmentId);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível atualizar o status do agendamento.");
  }
}

export async function setAppointmentDeposit(appointmentId: string, amount: number) {
  const result = await getSupabase()
    .from("appointments")
    .update({ deposit_amount: Math.max(0, amount) })
    .eq("id", appointmentId);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível atualizar o sinal do agendamento.");
  }
}

export async function setAppointmentPlanConsumption(appointmentId: string, consumed: boolean) {
  const supabase = getSupabase();

  if (consumed) {
    const result = await supabase.rpc("consume_customer_membership_package", {
      appointment_uuid: appointmentId,
      membership_uuid: null,
      notes_input: "Sessão consumida pelo painel SALÃO.",
    });

    if (result.error) {
      throw new Error(result.error.message || "Não foi possível consumir a sessão do plano.");
    }

    return;
  }

  const result = await supabase.rpc("reverse_customer_membership_package_consumption", {
    appointment_uuid: appointmentId,
  });

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível estornar a sessão do plano.");
  }
}

export async function createFinancialTransaction(salonId: string, input: SaveTransactionInput) {
  const result = await getSupabase().from("salon_financial_transactions").insert({
    amount: input.amount,
    category: ensureTrimmedText(input.category, "Categoria"),
    entry_type: input.type === "saida" ? "expense" : "income",
    occurred_on: input.date,
    payment_method: uiToDbTransactionMethod[input.method],
    salon_id: salonId,
    source: "manual",
    title: ensureTrimmedText(input.description, "Descrição"),
  });

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível registrar a transação.");
  }
}

export async function createTeamPayout(salonId: string, input: { amount: number; professionalId: string; title: string }) {
  const result = await getSupabase().from("salon_financial_transactions").insert({
    amount: input.amount,
    category: "Comissão",
    entry_type: "expense",
    occurred_on: new Date().toISOString().slice(0, 10),
    payment_method: "pix",
    salon_id: salonId,
    source: "team_payout",
    staff_member_id: input.professionalId,
    title: input.title,
  });

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível criar o repasse.");
  }
}

export async function toggleCashSession(salonId: string, open: boolean) {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const sessionResult = await supabase
    .from("salon_cash_sessions")
    .select("id, opening_amount")
    .eq("salon_id", salonId)
    .eq("session_date", today)
    .maybeSingle();
  const current = unwrapOptional(sessionResult, null as any);

  if (open) {
    if (current?.id) {
      const reopenResult = await supabase
        .from("salon_cash_sessions")
        .update({
          closed_at: null,
          closed_by: null,
          closing_difference_amount: null,
          closing_expected_amount: null,
          closing_reported_amount: null,
          status: "open",
        })
        .eq("id", current.id);

      if (reopenResult.error) {
        throw new Error(reopenResult.error.message || "Não foi possível abrir o caixa.");
      }
      return;
    }

    const insertResult = await supabase.from("salon_cash_sessions").insert({
      opening_amount: 0,
      salon_id: salonId,
      session_date: today,
      status: "open",
    });

    if (insertResult.error) {
      throw new Error(insertResult.error.message || "Não foi possível abrir o caixa.");
    }
    return;
  }

  if (!current?.id) {
    return;
  }

  const dayTransactionsResult = await supabase
    .from("salon_financial_transactions")
    .select("entry_type, amount")
    .eq("salon_id", salonId)
    .eq("occurred_on", today);
  const dayTransactions = unwrapOptional(dayTransactionsResult, []);
  const incomeAmount = (dayTransactions as any[])
    .filter((row) => row.entry_type === "income")
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const expenseAmount = (dayTransactions as any[])
    .filter((row) => row.entry_type === "expense")
    .reduce((sum, row) => sum + toNumber(row.amount), 0);
  const expectedAmount = toNumber(current.opening_amount) + incomeAmount - expenseAmount;

  const closeResult = await supabase
    .from("salon_cash_sessions")
    .update({
      closed_at: new Date().toISOString(),
      closing_difference_amount: 0,
      closing_expected_amount: expectedAmount,
      closing_reported_amount: expectedAmount,
      status: "closed",
    })
    .eq("id", current.id);

  if (closeResult.error) {
    throw new Error(closeResult.error.message || "Não foi possível fechar o caixa.");
  }
}

export async function saveExpense(salonId: string, input: SaveExpenseInput) {
  const supabase = getSupabase();

  if (input.recurring) {
    const recurringId = input.id.startsWith("recurring:") ? input.id.slice(10) : null;
    const payload = {
      amount: input.amount,
      cadence: "monthly",
      category: "Despesa recorrente",
      is_active: true,
      next_due_on: input.dueDate,
      payment_method: "pix",
      salon_id: salonId,
      title: ensureTrimmedText(input.description, "Descrição"),
    };
    const result = recurringId
      ? await supabase.from("salon_recurring_expenses").update(payload).eq("id", recurringId).eq("salon_id", salonId)
      : await supabase.from("salon_recurring_expenses").insert(payload);

    if (result.error) {
      throw new Error(result.error.message || "Não foi possível salvar a despesa recorrente.");
    }
    return;
  }

  const payableId = input.id.startsWith("payable:") ? input.id.slice(8) : null;
  const payload = {
    amount: input.amount,
    category: "Despesa",
    due_on: input.dueDate,
    payment_method: "pix",
    salon_id: salonId,
    status: input.paid ? "paid" : "pending",
    title: ensureTrimmedText(input.description, "Descrição"),
  };
  const result = payableId
    ? await supabase.from("salon_payables").update(payload).eq("id", payableId).eq("salon_id", salonId)
    : await supabase.from("salon_payables").insert(payload);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível salvar a despesa.");
  }
}

export async function setRecurringExpenseActive(salonId: string, expenseId: string, active: boolean) {
  if (!expenseId.startsWith("recurring:")) {
    return;
  }

  const result = await getSupabase()
    .from("salon_recurring_expenses")
    .update({ is_active: active })
    .eq("id", expenseId.slice(10))
    .eq("salon_id", salonId);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível atualizar a recorrência.");
  }
}

export async function markExpensePaid(salonId: string, expense: Expense) {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);

  if (expense.id.startsWith("recurring:")) {
    const recurringId = expense.id.slice(10);
    const recurringResult = await supabase
      .from("salon_recurring_expenses")
      .select("cadence")
      .eq("id", recurringId)
      .eq("salon_id", salonId)
      .maybeSingle();
    const recurring = unwrapRequired(recurringResult, "Não foi possível localizar a recorrência.") as any;
    const cadence = (recurring?.cadence ?? "monthly") as "weekly" | "monthly" | "yearly";

    const updateResult = await supabase
      .from("salon_recurring_expenses")
      .update({
        last_posted_on: today,
        next_due_on: nextDateByCadence(expense.dueDate, cadence),
      })
      .eq("id", recurringId)
      .eq("salon_id", salonId);

    if (updateResult.error) {
      throw new Error(updateResult.error.message || "Não foi possível baixar a despesa recorrente.");
    }

    const transactionResult = await supabase.from("salon_financial_transactions").insert({
      amount: expense.amount,
      category: "Despesa recorrente",
      entry_type: "expense",
      occurred_on: today,
      payment_method: "pix",
      recurring_expense_id: recurringId,
      salon_id: salonId,
      source: "recurring_expense",
      title: expense.description,
    });

    if (transactionResult.error) {
      throw new Error(transactionResult.error.message || "Não foi possível registrar a baixa financeira.");
    }
    return;
  }

  const payableId = expense.id.slice(8);
  const payableResult = await supabase
    .from("salon_payables")
    .update({
      paid_on: today,
      status: "paid",
    })
    .eq("id", payableId)
    .eq("salon_id", salonId);

  if (payableResult.error) {
    throw new Error(payableResult.error.message || "Não foi possível baixar a conta.");
  }

  const transactionResult = await supabase.from("salon_financial_transactions").insert({
    amount: expense.amount,
    category: "Despesa",
    entry_type: "expense",
    occurred_on: today,
    payable_id: payableId,
    payment_method: "pix",
    salon_id: salonId,
    source: "payable",
    title: expense.description,
  });

  if (transactionResult.error) {
    throw new Error(transactionResult.error.message || "Não foi possível registrar a saída no caixa.");
  }
}

export async function incrementInventoryProduct(productId: string) {
  const result = await getSupabase().rpc("register_inventory_movement", {
    movement_type_input: "in",
    product_id_input: productId,
    quantity_input: 1,
    reason_input: "Movimentação pelo painel SALÃO",
    staff_member_id_input: null,
  });

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível movimentar o estoque.");
  }
}

export async function advanceStoreOrderStatus(orderId: string, currentStatus: ProductOrder["status"]) {
  const nextStatus: Record<ProductOrder["status"], string> = {
    entregue: "completed",
    novo: "confirmed",
    pronto: "completed",
    separando: "ready",
  };
  const nextDbStatus = nextStatus[currentStatus];
  const result = await getSupabase().rpc("update_customer_product_order_status", {
    cancellation_reason_input: null,
    order_id_input: orderId,
    status_input: nextDbStatus,
  });

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível avançar o pedido.");
  }
}

export async function createPost(salonId: string, title: string, body: string) {
  const result = await getSupabase().from("salon_posts").insert({
    caption: body.trim() || null,
    image_path: defaultPostImageUrl,
    salon_id: salonId,
    title: ensureTrimmedText(title, "Título do post"),
  });

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível publicar o post.");
  }
}

export async function deletePost(salonId: string, postId: string) {
  const result = await getSupabase().from("salon_posts").delete().eq("id", postId).eq("salon_id", salonId);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível excluir o post.");
  }
}

export async function savePromotion(salonId: string, input: SavePromotionInput) {
  const payload = {
    highlight_text: input.channel?.trim() || null,
    is_active: input.active,
    kind: "promotion",
    price: input.discount,
    salon_id: salonId,
    title: ensureTrimmedText(input.name, "Nome da campanha"),
  };
  const table = getSupabase().from("salon_offers");
  const result = input.id
    ? await table.update(payload).eq("id", input.id).eq("salon_id", salonId)
    : await table.insert(payload);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível salvar a campanha.");
  }
}

export async function deletePromotion(salonId: string, promotionId: string) {
  const result = await getSupabase().from("salon_offers").delete().eq("id", promotionId).eq("salon_id", salonId);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível excluir a campanha.");
  }
}

export async function openCustomerTab(salonId: string, clientName: string) {
  const result = await getSupabase().from("customer_tabs").insert({
    notes: clientName.trim() || "Cliente avulso",
    salon_id: salonId,
    status: "open",
  });

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível abrir a comanda.");
  }
}

export async function appendCustomerTabItem(salonId: string, tabId: string, itemName: string, amount: number) {
  const result = await getSupabase().from("customer_tab_items").insert({
    description: itemName,
    quantity: 1,
    salon_id: salonId,
    tab_id: tabId,
    unit_price: amount,
  });

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível adicionar o item.");
  }
}

export async function appendCustomerTabPayment(salonId: string, tabId: string, amount: number, method = "pix") {
  const supabase = getSupabase();
  const paymentResult = await supabase.from("customer_tab_payments").insert({
    amount,
    method,
    salon_id: salonId,
    tab_id: tabId,
  });

  if (paymentResult.error) {
    throw new Error(paymentResult.error.message || "Não foi possível registrar o pagamento.");
  }

  const transactionResult = await supabase.from("salon_financial_transactions").insert({
    amount,
    category: "Comanda",
    entry_type: "income",
    occurred_on: new Date().toISOString().slice(0, 10),
    payment_method: method,
    salon_id: salonId,
    source: "customer_tab",
    title: "Recebimento de comanda",
  });

  if (transactionResult.error) {
    throw new Error(transactionResult.error.message || "Não foi possível registrar a entrada da comanda.");
  }
}

export async function closeCustomerTab(salonId: string, tabId: string) {
  const result = await getSupabase()
    .from("customer_tabs")
    .update({
      closed_at: new Date().toISOString(),
      status: "closed",
    })
    .eq("id", tabId)
    .eq("salon_id", salonId);

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível fechar a comanda.");
  }
}
