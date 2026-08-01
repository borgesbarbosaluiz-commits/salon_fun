import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { seedClientApp, seedSettings } from "./salon-seed";
import {
  appendCustomerTabItem,
  appendCustomerTabPayment,
  advanceStoreOrderStatus,
  closeCustomerTab,
  createFinancialTransaction,
  createPost,
  createTeamPayout,
  deleteBlock,
  deleteCategory,
  deleteClient,
  deletePost,
  deleteProfessional,
  deletePromotion,
  deleteService,
  incrementInventoryProduct,
  loadSalonSnapshot,
  markExpensePaid,
  openCustomerTab,
  saveAppointment,
  saveBlock,
  saveCategory,
  saveClient,
  saveClientAppConfig,
  saveExpense,
  saveProfessional,
  savePromotion,
  saveService,
  setAppointmentDeposit,
  setAppointmentPlanConsumption,
  setAppointmentStatus,
  setRecurringExpenseActive,
  toggleCashSession,
} from "./salon-repository";
import type { SalonState } from "./salon-state";
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
import { getCurrentPanelSession, restorePanelSessionFromFirebase, signOutPanelSession } from "./panel-auth";

const initialState: SalonState = {
  appointments: [],
  blocks: [],
  cashOpen: false,
  clientApp: seedClientApp,
  clients: [],
  comandas: [],
  expenses: [],
  orders: [],
  posts: [],
  products: [],
  professionals: [],
  promotions: [],
  services: [],
  categories: [],
  settings: seedSettings,
  transactions: [],
};

type AuthStatus = "authenticated" | "loading" | "signed_out";

interface SalonContextValue extends SalonState {
  authStatus: AuthStatus;
  createOrUpdateAppointment: (value: Appointment) => Promise<void>;
  createOrUpdateCategory: (value: { id?: string; name: string }) => Promise<void>;
  createOrUpdateClient: (value: Client) => Promise<void>;
  createOrUpdateExpense: (value: Expense) => Promise<void>;
  createOrUpdateProfessional: (value: Professional) => Promise<void>;
  createOrUpdatePromotion: (value: Promotion) => Promise<void>;
  createOrUpdateService: (value: Service) => Promise<void>;
  createTransaction: (value: Transaction) => Promise<void>;
  createTeamPayout: (professional: Professional, amount: number) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  deleteProfessional: (professionalId: string) => Promise<void>;
  deletePromotion: (promotionId: string) => Promise<void>;
  deleteService: (serviceId: string) => Promise<void>;
  error: string | null;
  incrementProductStock: (productId: string) => Promise<void>;
  isLoading: boolean;
  isRealData: boolean;
  markExpensePaid: (expense: Expense) => Promise<void>;
  openComanda: (clientName: string) => Promise<void>;
  publishPost: (text: string) => Promise<void>;
  refresh: () => Promise<void>;
  update: <K extends keyof SalonState>(key: K, value: SalonState[K]) => void;
  patch: (partial: Partial<SalonState>) => void;
  reset: () => void;
  saveClientApp: (value: ClientAppConfig) => Promise<void>;
  saveBlock: (value: Block) => Promise<void>;
  setAppointmentDeposit: (appointmentId: string, amount: number) => Promise<void>;
  setAppointmentPlanConsumption: (appointmentId: string, consumed: boolean) => Promise<void>;
  setAppointmentStatus: (appointmentId: string, status: AppointmentStatus) => Promise<void>;
  setCashOpen: (open: boolean) => Promise<void>;
  setExpenseRecurring: (expenseId: string, active: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  updateComandaWithItem: (tabId: string) => Promise<void>;
  updateComandaWithPayment: (tabId: string) => Promise<void>;
  updateComandaWithStatus: (tabId: string) => Promise<void>;
  updateOrderStatus: (order: ProductOrder) => Promise<void>;
}

const SalonContext = createContext<SalonContextValue | null>(null);

export function SalonProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SalonState>(initialState);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const session = await getCurrentPanelSession();

    if (!session?.user?.id) {
      setAuthStatus("signed_out");
      setSalonId(null);
      setUserId(null);
      setState(initialState);
      return;
    }

    const snapshot = await loadSalonSnapshot(session.user.id);
    if (!snapshot) {
      setAuthStatus("authenticated");
      setError("Sua conta autenticou, mas ainda não existe salão vinculado a este usuário.");
      setSalonId(null);
      setUserId(session.user.id);
      setState((prev) => ({
        ...initialState,
        clientApp: prev.clientApp,
        settings: {
          ...initialState.settings,
          name: prev.settings.name,
        },
      }));
      return;
    }

    setState((prev) => ({
      ...snapshot.state,
    }));
    setSalonId(snapshot.salon.id);
    setUserId(session.user.id);
    setAuthStatus("authenticated");
    setError(null);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const session = await getCurrentPanelSession();

        if (!session?.user) {
          await restorePanelSessionFromFirebase().catch(() => null);
        }

        if (!active) {
          return;
        }

        await refresh();
      } catch (nextError) {
        if (!active) {
          return;
        }

        setAuthStatus("signed_out");
        setState(initialState);
        setSalonId(null);
        setUserId(null);
        setError(nextError instanceof Error ? nextError.message : "Não foi possível carregar o painel.");
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [refresh]);

  const update = useCallback(<K extends keyof SalonState>(key: K, value: SalonState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const patch = useCallback((partial: Partial<SalonState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => setState(initialState), []);

  const ensureSalonId = useCallback(() => {
    if (!salonId) {
      throw new Error("O salão autenticado não foi carregado ainda.");
    }

    return salonId;
  }, [salonId]);

  const runRemote = useCallback(
    async (operation: () => Promise<void>) => {
      setError(null);
      try {
        await operation();
        await refresh();
      } catch (nextError) {
        const message =
          nextError instanceof Error ? nextError.message : "Não foi possível concluir esta ação.";
        setError(message);
        throw new Error(message);
      }
    },
    [refresh],
  );

  const createOrUpdateCategory = useCallback(
    async (value: { id?: string; name: string }) => {
      await runRemote(async () => {
        await saveCategory(ensureSalonId(), value);
      });
    },
    [ensureSalonId, runRemote],
  );

  const createOrUpdateService = useCallback(
    async (value: Service) => {
      await runRemote(async () => {
        const categoryName =
          state.categories.find((category) => category.id === value.categoryId)?.name ?? "Categoria";
        await saveService(ensureSalonId(), value, categoryName);
      });
    },
    [ensureSalonId, runRemote, state.categories],
  );

  const createOrUpdateClient = useCallback(
    async (value: Client) => {
      await runRemote(async () => {
        await saveClient(ensureSalonId(), value);
      });
    },
    [ensureSalonId, runRemote],
  );

  const createOrUpdateProfessional = useCallback(
    async (value: Professional) => {
      await runRemote(async () => {
        await saveProfessional(ensureSalonId(), value);
      });
    },
    [ensureSalonId, runRemote],
  );

  const saveBlockRecord = useCallback(
    async (value: Block) => {
      await runRemote(async () => {
        await saveBlock(ensureSalonId(), value);
      });
    },
    [ensureSalonId, runRemote],
  );

  const saveClientAppRecord = useCallback(
    async (value: ClientAppConfig) => {
      await runRemote(async () => {
        await saveClientAppConfig(ensureSalonId(), value);
      });
    },
    [ensureSalonId, runRemote],
  );

  const createOrUpdateAppointment = useCallback(
    async (value: Appointment) => {
      await runRemote(async () => {
        await saveAppointment(value);
      });
    },
    [runRemote],
  );

  const setAppointmentStatusRecord = useCallback(
    async (appointmentId: string, status: AppointmentStatus) => {
      await runRemote(async () => {
        await setAppointmentStatus(appointmentId, status);
      });
    },
    [runRemote],
  );

  const setAppointmentDepositRecord = useCallback(
    async (appointmentId: string, amount: number) => {
      await runRemote(async () => {
        await setAppointmentDeposit(appointmentId, amount);
      });
    },
    [runRemote],
  );

  const setAppointmentPlanConsumptionRecord = useCallback(
    async (appointmentId: string, consumed: boolean) => {
      await runRemote(async () => {
        await setAppointmentPlanConsumption(appointmentId, consumed);
      });
    },
    [runRemote],
  );

  const createTransactionRecord = useCallback(
    async (value: Transaction) => {
      await runRemote(async () => {
        await createFinancialTransaction(ensureSalonId(), value);
      });
    },
    [ensureSalonId, runRemote],
  );

  const createTeamPayoutRecord = useCallback(
    async (professional: Professional, amount: number) => {
      await runRemote(async () => {
        await createTeamPayout(ensureSalonId(), {
          amount,
          professionalId: professional.id,
          title: `Repasse ${professional.name}`,
        });
      });
    },
    [ensureSalonId, runRemote],
  );

  const setCashOpen = useCallback(
    async (open: boolean) => {
      await runRemote(async () => {
        await toggleCashSession(ensureSalonId(), open);
      });
    },
    [ensureSalonId, runRemote],
  );

  const createOrUpdateExpense = useCallback(
    async (value: Expense) => {
      await runRemote(async () => {
        await saveExpense(ensureSalonId(), value);
      });
    },
    [ensureSalonId, runRemote],
  );

  const markExpensePaidRecord = useCallback(
    async (value: Expense) => {
      await runRemote(async () => {
        await markExpensePaid(ensureSalonId(), value);
      });
    },
    [ensureSalonId, runRemote],
  );

  const setExpenseRecurring = useCallback(
    async (expenseId: string, active: boolean) => {
      await runRemote(async () => {
        await setRecurringExpenseActive(ensureSalonId(), expenseId, active);
      });
    },
    [ensureSalonId, runRemote],
  );

  const publishPost = useCallback(
    async (text: string) => {
      await runRemote(async () => {
        await createPost(ensureSalonId(), text.slice(0, 40), text);
      });
    },
    [ensureSalonId, runRemote],
  );

  const removePost = useCallback(
    async (postId: string) => {
      await runRemote(async () => {
        await deletePost(ensureSalonId(), postId);
      });
    },
    [ensureSalonId, runRemote],
  );

  const createOrUpdatePromotion = useCallback(
    async (value: Promotion) => {
      await runRemote(async () => {
        await savePromotion(ensureSalonId(), value);
      });
    },
    [ensureSalonId, runRemote],
  );

  const removePromotion = useCallback(
    async (promotionId: string) => {
      await runRemote(async () => {
        await deletePromotion(ensureSalonId(), promotionId);
      });
    },
    [ensureSalonId, runRemote],
  );

  const incrementProductStock = useCallback(
    async (productId: string) => {
      await runRemote(async () => {
        await incrementInventoryProduct(productId);
      });
    },
    [runRemote],
  );

  const updateOrderStatus = useCallback(
    async (order: ProductOrder) => {
      await runRemote(async () => {
        await advanceStoreOrderStatus(order.id, order.status);
      });
    },
    [runRemote],
  );

  const openComanda = useCallback(
    async (clientName: string) => {
      await runRemote(async () => {
        await openCustomerTab(ensureSalonId(), clientName);
      });
    },
    [ensureSalonId, runRemote],
  );

  const updateComandaWithItem = useCallback(
    async (tabId: string) => {
      await runRemote(async () => {
        await appendCustomerTabItem(ensureSalonId(), tabId, "Item adicional", 60);
      });
    },
    [ensureSalonId, runRemote],
  );

  const updateComandaWithPayment = useCallback(
    async (tabId: string) => {
      await runRemote(async () => {
        await appendCustomerTabPayment(ensureSalonId(), tabId, 60, "pix");
      });
    },
    [ensureSalonId, runRemote],
  );

  const updateComandaWithStatus = useCallback(
    async (tabId: string) => {
      await runRemote(async () => {
        await closeCustomerTab(ensureSalonId(), tabId);
      });
    },
    [ensureSalonId, runRemote],
  );

  const deleteClientRecord = useCallback(
    async (clientId: string) => {
      await runRemote(async () => {
        await deleteClient(ensureSalonId(), clientId);
      });
    },
    [ensureSalonId, runRemote],
  );

  const deleteCategoryRecord = useCallback(
    async (categoryId: string) => {
      await runRemote(async () => {
        await deleteCategory(ensureSalonId(), categoryId);
      });
    },
    [ensureSalonId, runRemote],
  );

  const deleteServiceRecord = useCallback(
    async (serviceId: string) => {
      await runRemote(async () => {
        await deleteService(ensureSalonId(), serviceId);
      });
    },
    [ensureSalonId, runRemote],
  );

  const deleteProfessionalRecord = useCallback(
    async (professionalId: string) => {
      await runRemote(async () => {
        await deleteProfessional(ensureSalonId(), professionalId);
      });
    },
    [ensureSalonId, runRemote],
  );

  const deleteBlockRecord = useCallback(
    async (blockId: string) => {
      await runRemote(async () => {
        await deleteBlock(ensureSalonId(), blockId);
      });
    },
    [ensureSalonId, runRemote],
  );

  const signOut = useCallback(async () => {
    await signOutPanelSession();
    setAuthStatus("signed_out");
    setSalonId(null);
    setUserId(null);
    setState(initialState);
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      authStatus,
      createOrUpdateAppointment,
      createOrUpdateCategory,
      createOrUpdateClient,
      createOrUpdateExpense,
      createOrUpdateProfessional,
      createOrUpdatePromotion,
      createOrUpdateService,
      createTeamPayout: createTeamPayoutRecord,
      createTransaction: createTransactionRecord,
      deleteBlock: deleteBlockRecord,
      deleteCategory: deleteCategoryRecord,
      deleteClient: deleteClientRecord,
      deletePost: removePost,
      deleteProfessional: deleteProfessionalRecord,
      deletePromotion: removePromotion,
      deleteService: deleteServiceRecord,
      error,
      incrementProductStock,
      isLoading: authStatus === "loading",
      isRealData: authStatus === "authenticated" && Boolean(salonId && userId),
      markExpensePaid: markExpensePaidRecord,
      openComanda,
      patch,
      publishPost,
      refresh,
      reset,
      saveClientApp: saveClientAppRecord,
      saveBlock: saveBlockRecord,
      setAppointmentDeposit: setAppointmentDepositRecord,
      setAppointmentPlanConsumption: setAppointmentPlanConsumptionRecord,
      setAppointmentStatus: setAppointmentStatusRecord,
      setCashOpen,
      setExpenseRecurring,
      signOut,
      update,
      updateComandaWithItem,
      updateComandaWithPayment,
      updateComandaWithStatus,
      updateOrderStatus,
    }),
    [
      authStatus,
      createOrUpdateAppointment,
      createOrUpdateCategory,
      createOrUpdateClient,
      createOrUpdateExpense,
      createOrUpdateProfessional,
      createOrUpdatePromotion,
      createOrUpdateService,
      createTeamPayoutRecord,
      createTransactionRecord,
      deleteBlockRecord,
      deleteCategoryRecord,
      deleteClientRecord,
      deleteProfessionalRecord,
      deleteServiceRecord,
      error,
      incrementProductStock,
      markExpensePaidRecord,
      openComanda,
      patch,
      publishPost,
      refresh,
      removePost,
      removePromotion,
      reset,
      saveClientAppRecord,
      saveBlockRecord,
      salonId,
      setAppointmentDepositRecord,
      setAppointmentPlanConsumptionRecord,
      setAppointmentStatusRecord,
      setCashOpen,
      setExpenseRecurring,
      signOut,
      state,
      update,
      updateComandaWithItem,
      updateComandaWithPayment,
      updateComandaWithStatus,
      updateOrderStatus,
      userId,
    ],
  );

  return <SalonContext.Provider value={value}>{children}</SalonContext.Provider>;
}

export function useSalon() {
  const ctx = useContext(SalonContext);
  if (!ctx) throw new Error("useSalon deve ser usado dentro de SalonProvider");
  return ctx;
}

export const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export const formatDateBR = (iso: string) => {
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
};

export const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  em_atendimento: "Em atendimento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  faltou: "Faltou",
};

export const statusStyles: Record<string, string> = {
  pendente: "bg-warning-soft text-warning",
  confirmado: "bg-success-soft text-success",
  em_atendimento: "bg-info-soft text-info",
  concluido: "bg-muted text-muted-foreground",
  cancelado: "bg-destructive/10 text-destructive",
  faltou: "bg-destructive/10 text-destructive",
};
