import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ImageAssetField } from "@/components/dashboard/image-asset-field";
import { PageHeader } from "@/components/dashboard/primitives";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { resolveSalonAssetUrl, uploadSalonAssetFiles } from "@/lib/salon-media-assets";
import { brl, useSalon } from "@/lib/salon-store";
import type { Service } from "@/lib/salon-types";

export const Route = createFileRoute("/dashboard/gestao/servicos")({
  component: ServicesCatalogPage,
});

function createEmptyService(categoryId = ""): Service {
  return {
    active: true,
    categoryId,
    description: "",
    duration: 60,
    id: "",
    imageUrl: "",
    name: "",
    price: 100,
  };
}

export function ServicesCatalogPage() {
  const {
    services,
    categories,
    salonId,
    createOrUpdateCategory,
    createOrUpdateService,
    deleteService,
  } = useSalon();
  const [filter, setFilter] = useState("todas");
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catId, setCatId] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [form, setForm] = useState<Service>(createEmptyService(categories[0]?.id ?? ""));

  const visible = useMemo(
    () =>
      filter === "todas" ? services : services.filter((service) => service.categoryId === filter),
    [filter, services],
  );

  const openNewServiceDialog = () => {
    if (!categories.length) {
      toast.info("Crie a primeira categoria antes de cadastrar um servico.");
      setCatId("");
      setCatName("");
      setCatOpen(true);
      return;
    }

    setForm(createEmptyService(categories[0]?.id ?? ""));
    setOpen(true);
  };

  const handleSaveService = async () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do servico.");
      return;
    }

    if (!form.categoryId) {
      toast.error("Crie ou selecione uma categoria antes de salvar o servico.");
      return;
    }

    try {
      await createOrUpdateService(form);
      toast.success(form.id ? "Servico atualizado" : "Servico criado");
      setOpen(false);
      setForm(createEmptyService(categories[0]?.id ?? ""));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar o servico.");
    }
  };

  const handleSaveCategory = async () => {
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
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar a categoria.");
    }
  };

  const handleUploadImage = async (file: File) => {
    if (!salonId) {
      toast.error("Salao ainda nao carregado.");
      return;
    }

    setIsUploadingImage(true);
    try {
      const [uploadedPath] = await uploadSalonAssetFiles({
        files: [file],
        folder: "services",
        salonId,
      });

      setForm((current) => ({ ...current, imageUrl: uploadedPath ?? current.imageUrl }));
      toast.success("Imagem do servico enviada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar a imagem.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Servicos"
        subtitle="Catalogo do salao com foto, categoria, duracao e preco real do app cliente"
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
              Novo servico
            </Button>
          </>
        }
      />

      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("todas")}
          className={`rounded-full border px-4 py-2 text-xs font-medium ${
            filter === "todas" ? "border-primary bg-accent text-accent-foreground" : "border-border"
          }`}
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
            className={`rounded-full border px-4 py-2 text-xs font-medium ${
              filter === category.id
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border"
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((service) => {
          const imageUrl = resolveSalonAssetUrl(service.imageUrl);

          return (
            <div key={service.id} className="panel flex flex-col overflow-hidden p-0">
              {imageUrl ? (
                <div className="aspect-[16/10] border-b border-border/70 bg-secondary/20">
                  <img src={imageUrl} alt={service.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center border-b border-border/70 bg-secondary/20 px-6 text-center text-xs text-muted-foreground">
                  Esse servico ainda nao tem foto para aparecer no app cliente.
                </div>
              )}

              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-medium">{service.name}</h3>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">
                    {categories.find((category) => category.id === service.categoryId)?.name}
                  </span>
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  {service.description || "Sem descricao."}
                </p>
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
                          toast.success(checked ? "Servico ativado" : "Servico inativado");
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Nao foi possivel atualizar o servico.",
                          );
                        }
                      }}
                    />
                    {service.active ? "Ativo" : "Inativo"}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setForm(service);
                        setOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        try {
                          await deleteService(service.id);
                          toast.success("Servico excluido");
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Nao foi possivel excluir o servico.",
                          );
                        }
                      }}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setForm(createEmptyService(categories[0]?.id ?? ""));
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {form.id ? "Editar servico" : "Novo servico"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(value) => setForm({ ...form, categoryId: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  <Label>Duracao (min)</Label>
                  <Input
                    type="number"
                    value={form.duration}
                    onChange={(event) =>
                      setForm({ ...form, duration: Number(event.target.value) || 0 })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Preco (R$)</Label>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(event) =>
                      setForm({ ...form, price: Number(event.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Descricao</Label>
                <Textarea
                  rows={5}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>
            </div>

            <ImageAssetField
              label="Foto do servico"
              description="Essa imagem aparece no app cliente na agenda e nos destaques da home."
              value={form.imageUrl ?? ""}
              previewUrl={resolveSalonAssetUrl(form.imageUrl)}
              onChange={(value) => setForm((current) => ({ ...current, imageUrl: value }))}
              onClear={() => setForm((current) => ({ ...current, imageUrl: "" }))}
              onUpload={(file) => void handleUploadImage(file)}
              isUploading={isUploadingImage}
              uploadLabel="Enviar foto do servico"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
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
            <Button variant="outline" onClick={() => setCatOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveCategory()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
