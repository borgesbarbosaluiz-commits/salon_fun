import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { brl, useSalon } from "@/lib/salon-store";
import type { Service } from "@/lib/salon-types";

export const Route = createFileRoute("/dashboard/gestao/servicos")({
  component: ServicesCatalogPage,
});

export function ServicesCatalogPage() {
  const {
    services,
    categories,
    createOrUpdateCategory,
    createOrUpdateService,
    deleteService,
  } = useSalon();
  const [filter, setFilter] = useState("todas");
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catId, setCatId] = useState("");
  const [form, setForm] = useState<Service>({
    active: true,
    categoryId: categories[0]?.id ?? "",
    description: "",
    duration: 60,
    id: "",
    name: "",
    price: 100,
  });

  const visible = filter === "todas" ? services : services.filter((service) => service.categoryId === filter);

  async function handleSaveService() {
    if (!form.name.trim()) {
      toast.error("Informe o nome do serviço.");
      return;
    }

    if (!form.categoryId) {
      toast.error("Crie ou selecione uma categoria antes de salvar o serviço.");
      return;
    }

    try {
      await createOrUpdateService(form);
      toast.success(form.id ? "Serviço atualizado" : "Serviço criado");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o serviço.");
    }
  }

  async function handleSaveCategory() {
    if (!catName.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }

    try {
      const payload = catId ? { id: catId, name: catName } : { name: catName };
      await createOrUpdateCategory(payload);
      toast.success(catId ? "Categoria atualizada" : "Categoria criada");
      setCatOpen(false);
      setCatName("");
      setCatId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a categoria.");
    }
  }

  function openNewServiceDialog() {
    if (!categories.length) {
      toast.info("Crie a primeira categoria antes de cadastrar um serviço.");
      setCatId("");
      setCatName("");
      setCatOpen(true);
      return;
    }

    setForm({
      active: true,
      categoryId: categories[0]?.id ?? "",
      description: "",
      duration: 60,
      id: "",
      name: "",
      price: 100,
    });
    setOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Serviços"
        subtitle="Catálogo do salão organizado por categoria"
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setCatId("");
                setCatName("");
                setCatOpen(true);
              }}
            >
              Nova categoria
            </Button>
            <Button className="rounded-full" onClick={openNewServiceDialog}>
              Novo serviço
            </Button>
          </>
        }
      />

      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("todas")}
          className={`rounded-full border px-4 py-2 text-xs font-medium ${filter === "todas" ? "border-primary bg-accent text-accent-foreground" : "border-border"}`}
        >
          Todas
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setFilter(category.id)}
            onDoubleClick={() => {
              setCatId(category.id);
              setCatName(category.name);
              setCatOpen(true);
            }}
            className={`rounded-full border px-4 py-2 text-xs font-medium ${filter === category.id ? "border-primary bg-accent text-accent-foreground" : "border-border"}`}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((service) => (
          <div key={service.id} className="panel flex flex-col p-5">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="font-medium">{service.name}</h3>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">
                {categories.find((category) => category.id === service.categoryId)?.name}
              </span>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">{service.description}</p>
            <div className="mb-4 flex items-center justify-between text-sm">
              <span className="font-display text-2xl">{brl(service.price)}</span>
              <span className="text-muted-foreground">{service.duration} min</span>
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
              <div className="flex items-center gap-2 text-xs">
                <Switch
                  checked={service.active}
                  onCheckedChange={async (checked) => {
                    try {
                      await createOrUpdateService({ ...service, active: checked });
                      toast.success(checked ? "Serviço ativado" : "Serviço inativado");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o serviço.");
                    }
                  }}
                />
                {service.active ? "Ativo" : "Inativo"}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setForm(service); setOpen(true); }}>
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    try {
                      await deleteService(service.id);
                      toast.success("Serviço excluído");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o serviço.");
                    }
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {form.id ? "Editar serviço" : "Novo serviço"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select value={form.categoryId} onValueChange={(value) => setForm({ ...form, categoryId: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Duração (min)</Label>
                <Input
                  type="number"
                  value={form.duration}
                  onChange={(event) => setForm({ ...form, duration: Number(event.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveService()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {catId ? "Editar categoria" : "Nova categoria"}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={catName}
            onChange={(event) => setCatName(event.target.value)}
            placeholder="Nome da categoria"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveCategory()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
