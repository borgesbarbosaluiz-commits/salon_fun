import { createFileRoute } from "@tanstack/react-router";

import { ServicesCatalogPage } from "./dashboard.gestao.servicos";

export const Route = createFileRoute("/dashboard/")({
  component: ServicesCatalogPage,
});
