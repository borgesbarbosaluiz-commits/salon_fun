export type AppointmentStatus =
  "pendente" | "confirmado" | "em_atendimento" | "concluido" | "cancelado" | "faltou";

export interface Appointment {
  id: string;
  clientId: string;
  professionalId: string;
  serviceId: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  status: AppointmentStatus;
  price: number;
  deposit: number;
  usedPlanSession: boolean;
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthday: string;
  since: string;
  visits: number;
  totalSpent: number;
  lastVisit: string;
  plan?: string;
  planSessions?: number;
  tags: string[];
  notes?: string;
}

export interface Professional {
  id: string;
  name: string;
  role: string;
  phone: string;
  imageUrl?: string;
  commission: number;
  active: boolean;
  serviceIds: string[];
  workdays: string[];
  startTime: string;
  endTime: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  color: string;
}

export interface Service {
  id: string;
  name: string;
  categoryId: string;
  duration: number;
  price: number;
  description: string;
  imageUrl?: string;
  active: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  method: "pix" | "dinheiro" | "credito" | "debito";
  type: "entrada" | "saida";
  amount: number;
}

export interface Expense {
  id: string;
  description: string;
  dueDate: string;
  amount: number;
  recurring: boolean;
  paid: boolean;
}

export interface Post {
  id: string;
  format: "standard" | "before_after" | "reel" | "story";
  title: string;
  body: string;
  createdAt: string;
  likes: number;
  comments: { id: string; author: string; text: string }[];
  imageUrl?: string;
  imageUrls?: string[];
  expiresAt?: string | null;
  professionalId?: string | null;
  serviceId?: string | null;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  description?: string;
  imageUrls?: string[];
  maxPurchaseQuantity?: number;
  price: number;
  stock: number;
  minStock: number;
  unit?: string;
  active: boolean;
}

export interface ProductOrder {
  id: string;
  customerId: string | null;
  clientName: string;
  productName: string;
  total: number;
  itemCount: number;
  orderNumber: number;
  createdAt: string;
  status: "novo" | "separando" | "pronto" | "entregue" | "cancelado";
}

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  discount: number;
  channel: string;
  imageUrl?: string;
  active: boolean;
  redemptions: number;
}

export interface Comanda {
  id: string;
  clientId: string | null;
  clientName: string;
  opened: string;
  items: { id: string; name: string; price: number; quantity: number; unitPrice: number }[];
  payments: { id: string; method: string; amount: number; note?: string | null }[];
  notes?: string;
  total: number;
  paid: number;
  status: "aberta" | "fechada" | "cancelada";
}

export interface Block {
  id: string;
  professionalId: string;
  date: string;
  from: string;
  to: string;
  reason: string;
}

export interface ClientAppConfig {
  appName: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  cornerStyle: "sharp" | "soft" | "round";
  fontStyle: "serif" | "sans" | "mono";
  theme: "claro" | "escuro";
  heroTitle: string;
  heroSubtitle: string;
  heroCta: string;
  heroImage: string;
  logoImage: string;
  galleryCoverImage: string;
  profileCoverImage: string;
  shareImage: string;
  logoText: string;
  showPrices: boolean;
  showTeam: boolean;
  showFeed: boolean;
  showLoyalty: boolean;
  showStore: boolean;
  allowOnlineBooking: boolean;
  requireDeposit: boolean;
  depositPercent: number;
  cancelWindowHours: number;
  autoCancelMinutes: number;
  welcomeMessage: string;
  whiteLabelActive?: boolean;
  customDomain?: string;
  supportPhone: string;
  address: string;
  inviteCode: string;
  highlightBlocks: { id: string; title: string; subtitle: string; emoji: string }[];
}

export interface SalonSettings {
  name: string;
  segment: string;
  description: string;
  phone: string;
  email: string;
  brandColor: string;
  logoText: string;
  monthlyGoal: number;
  twoFactor: boolean;
  requireStrongPassword: boolean;
  aiAssist: boolean;
}
