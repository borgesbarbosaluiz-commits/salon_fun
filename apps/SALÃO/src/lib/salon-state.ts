import type {
  Appointment,
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

export interface SalonState {
  appointments: Appointment[];
  blocks: Block[];
  cashOpen: boolean;
  categories: ServiceCategory[];
  clientApp: ClientAppConfig;
  clients: Client[];
  comandas: Comanda[];
  expenses: Expense[];
  orders: ProductOrder[];
  posts: Post[];
  products: Product[];
  professionals: Professional[];
  promotions: Promotion[];
  services: Service[];
  settings: SalonSettings;
  transactions: Transaction[];
}
