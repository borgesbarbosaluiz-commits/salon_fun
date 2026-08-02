export type ProductionPanelModuleKey =
  | "dashboard.benefits.promotions"
  | "dashboard.birthdays"
  | "dashboard.feed"
  | "dashboard.gestao.comissoes"
  | "dashboard.gestao.pagamentos"
  | "dashboard.inventory"
  | "dashboard.operations.comandas";

const productionPanelModuleKeys = new Set<string>([
  "dashboard.benefits.promotions",
  "dashboard.birthdays",
  "dashboard.feed",
  "dashboard.gestao.comissoes",
  "dashboard.gestao.pagamentos",
  "dashboard.inventory",
  "dashboard.operations.comandas",
]);

export function supportsProductionPanelModule(
  moduleKey: string,
): moduleKey is ProductionPanelModuleKey {
  return productionPanelModuleKeys.has(moduleKey);
}
