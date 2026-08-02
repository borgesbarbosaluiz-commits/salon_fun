import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ImageAssetField } from "@/components/dashboard/image-asset-field";
import { PageHeader } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  resolveInventoryProductAssetUrl,
  resolveSalonAssetUrl,
  uploadSalonAssetFiles,
} from "@/lib/salon-media-assets";
import { resolveSalonPostAssetUrl } from "@/lib/salon-post-assets";
import { brl, uid, useSalon } from "@/lib/salon-store";
import type { ClientAppConfig } from "@/lib/salon-types";

export const Route = createFileRoute("/dashboard/client-app")({
  component: ClientApp,
  head: () => ({
    meta: [
      { title: "App do cliente · SALAO" },
      {
        name: "description",
        content: "Personalize cores, textos, blocos e imagens reais do aplicativo do seu salao.",
      },
    ],
  }),
});

const radiusMap = { sharp: "0px", soft: "14px", round: "28px" } as const;
const fontMap = {
  serif: "'Instrument Serif', Georgia, serif",
  sans: "Inter, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

type ClientAppImageField =
  "galleryCoverImage" | "heroImage" | "logoImage" | "profileCoverImage" | "shareImage";

function ClientApp() {
  const {
    clientApp,
    saveClientApp,
    services,
    professionals,
    posts,
    promotions,
    products,
    salonId,
  } = useSalon();
  const [cfg, setCfg] = useState<ClientAppConfig>(clientApp);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<ClientAppImageField | null>(null);

  useEffect(() => {
    setCfg(clientApp);
  }, [clientApp]);

  const set = <K extends keyof ClientAppConfig>(key: K, value: ClientAppConfig[K]) =>
    setCfg((previous) => ({ ...previous, [key]: value }));

  const save = async () => {
    setIsSaving(true);
    try {
      await saveClientApp(cfg);
      toast.success("App do cliente atualizado com dados reais.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Nao foi possivel salvar o app do cliente.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const copyInviteCode = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(cfg.inviteCode);
      }
      toast.success("Codigo do salao copiado.");
    } catch {
      toast.error("Nao foi possivel copiar o codigo.");
    }
  };

  const handleUploadAsset = async (field: ClientAppImageField, folder: string, file: File) => {
    if (!salonId) {
      toast.error("Salao ainda nao carregado.");
      return;
    }

    setUploadingField(field);
    try {
      const [uploadedPath] = await uploadSalonAssetFiles({
        files: [file],
        folder,
        salonId,
      });

      if (uploadedPath) {
        set(field, uploadedPath);
        toast.success("Imagem publicada no app cliente.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar a imagem.");
    } finally {
      setUploadingField(null);
    }
  };

  const dark = cfg.theme === "escuro";
  const surface = dark ? "#161311" : cfg.backgroundColor;
  const text = dark ? "#F5F1EC" : cfg.textColor;
  const heroImageUrl = resolveSalonAssetUrl(cfg.heroImage);
  const logoImageUrl = resolveSalonAssetUrl(cfg.logoImage);
  const galleryCoverImageUrl = resolveSalonAssetUrl(cfg.galleryCoverImage);
  const profileCoverImageUrl = resolveSalonAssetUrl(cfg.profileCoverImage);
  const shareImageUrl = resolveSalonAssetUrl(cfg.shareImage);
  const previewPosts = posts.slice(0, 2);
  const previewServices = services.filter((service) => service.active).slice(0, 3);
  const previewProfessionals = professionals
    .filter((professional) => professional.active)
    .slice(0, 3);
  const previewPromotions = promotions.filter((promotion) => promotion.active).slice(0, 2);
  const previewProducts = products.filter((product) => product.active).slice(0, 2);

  return (
    <>
      <PageHeader
        title="App do cliente"
        subtitle="Controle textos, cores, capas e imagens reais que o app cliente consome em producao"
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setCfg(clientApp);
                toast("Alteracoes descartadas.");
              }}
            >
              Descartar
            </Button>
            <Button className="rounded-full" onClick={() => void save()} disabled={isSaving}>
              {isSaving ? "Publicando..." : "Publicar alteracoes"}
            </Button>
          </>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
        <Tabs defaultValue="marca">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="marca">Marca</TabsTrigger>
            <TabsTrigger value="hero">Hero e capas</TabsTrigger>
            <TabsTrigger value="blocos">Blocos</TabsTrigger>
            <TabsTrigger value="modulos">Modulos</TabsTrigger>
            <TabsTrigger value="reserva">Reserva</TabsTrigger>
            <TabsTrigger value="suporte">Suporte</TabsTrigger>
          </TabsList>

          <TabsContent value="marca" className="space-y-5">
            <div className="panel grid gap-5 p-6">
              <div className="panel divide-y divide-border rounded-3xl border border-border/70">
                <Toggle
                  label="Ativar dominio proprio"
                  checked={Boolean(cfg.whiteLabelActive)}
                  onChange={(value) => set("whiteLabelActive", value)}
                />
                <Field label="Dominio publico do app">
                  <Input
                    value={cfg.customDomain ?? ""}
                    placeholder="painel.seusalao.com"
                    onChange={(event) => set("customDomain", event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome do app">
                  <Input
                    value={cfg.appName}
                    onChange={(event) => set("appName", event.target.value)}
                  />
                </Field>
                <Field label="Logo em texto">
                  <Input
                    value={cfg.logoText}
                    onChange={(event) => set("logoText", event.target.value)}
                  />
                </Field>
              </div>

              <Field label="Tagline">
                <Input
                  value={cfg.tagline}
                  onChange={(event) => set("tagline", event.target.value)}
                />
              </Field>

              <div className="grid gap-6 lg:grid-cols-2">
                <ImageAssetField
                  label="Logo do app"
                  description="Usada como imagem principal de marca no app cliente e na landing publica."
                  value={cfg.logoImage}
                  previewUrl={logoImageUrl}
                  onChange={(value) => set("logoImage", value)}
                  onClear={() => set("logoImage", "")}
                  onUpload={(file) => void handleUploadAsset("logoImage", "client-app/logo", file)}
                  isUploading={uploadingField === "logoImage"}
                  uploadLabel="Enviar logo"
                />
                <ImageAssetField
                  label="Imagem de compartilhamento"
                  description="Essa arte e usada quando o salao e compartilhado pelo cliente ou por links publicos."
                  value={cfg.shareImage}
                  previewUrl={shareImageUrl}
                  onChange={(value) => set("shareImage", value)}
                  onClear={() => set("shareImage", "")}
                  onUpload={(file) =>
                    void handleUploadAsset("shareImage", "client-app/share", file)
                  }
                  isUploading={uploadingField === "shareImage"}
                  uploadLabel="Enviar arte de compartilhamento"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <ColorField
                  label="Primaria"
                  value={cfg.primaryColor}
                  onChange={(value) => set("primaryColor", value)}
                />
                <ColorField
                  label="Destaque"
                  value={cfg.accentColor}
                  onChange={(value) => set("accentColor", value)}
                />
                <ColorField
                  label="Fundo"
                  value={cfg.backgroundColor}
                  onChange={(value) => set("backgroundColor", value)}
                />
                <ColorField
                  label="Texto"
                  value={cfg.textColor}
                  onChange={(value) => set("textColor", value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Cantos">
                  <Select
                    value={cfg.cornerStyle}
                    onValueChange={(value) =>
                      set("cornerStyle", value as ClientAppConfig["cornerStyle"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sharp">Retos</SelectItem>
                      <SelectItem value="soft">Suaves</SelectItem>
                      <SelectItem value="round">Arredondados</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tipografia">
                  <Select
                    value={cfg.fontStyle}
                    onValueChange={(value) =>
                      set("fontStyle", value as ClientAppConfig["fontStyle"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="serif">Serifada</SelectItem>
                      <SelectItem value="sans">Sem serifa</SelectItem>
                      <SelectItem value="mono">Monoespacada</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tema">
                  <Select
                    value={cfg.theme}
                    onValueChange={(value) => set("theme", value as ClientAppConfig["theme"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claro">Claro</SelectItem>
                      <SelectItem value="escuro">Escuro</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="hero" className="space-y-5">
            <div className="panel grid gap-5 p-6">
              <Field label="Titulo do hero">
                <Input
                  value={cfg.heroTitle}
                  onChange={(event) => set("heroTitle", event.target.value)}
                />
              </Field>
              <Field label="Subtitulo">
                <Textarea
                  rows={2}
                  value={cfg.heroSubtitle}
                  onChange={(event) => set("heroSubtitle", event.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Texto do botao principal">
                  <Input
                    value={cfg.heroCta}
                    onChange={(event) => set("heroCta", event.target.value)}
                  />
                </Field>
                <Field label="Mensagem de boas-vindas">
                  <Textarea
                    rows={2}
                    value={cfg.welcomeMessage}
                    onChange={(event) => set("welcomeMessage", event.target.value)}
                  />
                </Field>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <ImageAssetField
                  label="Imagem do hero"
                  description="Banner principal da home do app cliente."
                  value={cfg.heroImage}
                  previewUrl={heroImageUrl}
                  onChange={(value) => set("heroImage", value)}
                  onClear={() => set("heroImage", "")}
                  onUpload={(file) => void handleUploadAsset("heroImage", "client-app/hero", file)}
                  isUploading={uploadingField === "heroImage"}
                  uploadLabel="Enviar hero"
                />
                <ImageAssetField
                  label="Capa da galeria"
                  description="Usada pelo app quando destaca o feed e os trabalhos do salao."
                  value={cfg.galleryCoverImage}
                  previewUrl={galleryCoverImageUrl}
                  onChange={(value) => set("galleryCoverImage", value)}
                  onClear={() => set("galleryCoverImage", "")}
                  onUpload={(file) =>
                    void handleUploadAsset("galleryCoverImage", "client-app/gallery", file)
                  }
                  isUploading={uploadingField === "galleryCoverImage"}
                  uploadLabel="Enviar capa da galeria"
                />
                <ImageAssetField
                  label="Capa do perfil"
                  description="Usada no cabeçalho visual do perfil publico do salao."
                  value={cfg.profileCoverImage}
                  previewUrl={profileCoverImageUrl}
                  onChange={(value) => set("profileCoverImage", value)}
                  onClear={() => set("profileCoverImage", "")}
                  onUpload={(file) =>
                    void handleUploadAsset("profileCoverImage", "client-app/profile", file)
                  }
                  isUploading={uploadingField === "profileCoverImage"}
                  uploadLabel="Enviar capa do perfil"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="blocos" className="space-y-4">
            {cfg.highlightBlocks.map((block, index) => (
              <div key={block.id} className="panel grid gap-3 p-5 sm:grid-cols-[70px_1fr_1fr_auto]">
                <Input
                  value={block.emoji}
                  onChange={(event) =>
                    set(
                      "highlightBlocks",
                      cfg.highlightBlocks.map((currentBlock, currentIndex) =>
                        currentIndex === index
                          ? { ...currentBlock, emoji: event.target.value }
                          : currentBlock,
                      ),
                    )
                  }
                />
                <Input
                  value={block.title}
                  onChange={(event) =>
                    set(
                      "highlightBlocks",
                      cfg.highlightBlocks.map((currentBlock, currentIndex) =>
                        currentIndex === index
                          ? { ...currentBlock, title: event.target.value }
                          : currentBlock,
                      ),
                    )
                  }
                />
                <Input
                  value={block.subtitle}
                  onChange={(event) =>
                    set(
                      "highlightBlocks",
                      cfg.highlightBlocks.map((currentBlock, currentIndex) =>
                        currentIndex === index
                          ? { ...currentBlock, subtitle: event.target.value }
                          : currentBlock,
                      ),
                    )
                  }
                />
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={() =>
                    set(
                      "highlightBlocks",
                      cfg.highlightBlocks.filter((_, currentIndex) => currentIndex !== index),
                    )
                  }
                >
                  Remover
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() =>
                set("highlightBlocks", [
                  ...cfg.highlightBlocks,
                  { id: uid("blk"), title: "Novo bloco", subtitle: "Descricao", emoji: "✦" },
                ])
              }
            >
              Adicionar bloco da home
            </Button>
          </TabsContent>

          <TabsContent value="modulos" className="space-y-5">
            <div className="panel divide-y divide-border p-2">
              <Toggle
                label="Mostrar precos dos servicos"
                checked={cfg.showPrices}
                onChange={(value) => set("showPrices", value)}
              />
              <Toggle
                label="Mostrar equipe"
                checked={cfg.showTeam}
                onChange={(value) => set("showTeam", value)}
              />
              <Toggle
                label="Mostrar feed do salao"
                checked={cfg.showFeed}
                onChange={(value) => set("showFeed", value)}
              />
              <Toggle
                label="Mostrar fidelidade"
                checked={cfg.showLoyalty}
                onChange={(value) => set("showLoyalty", value)}
              />
              <Toggle
                label="Mostrar loja"
                checked={cfg.showStore}
                onChange={(value) => set("showStore", value)}
              />
            </div>

            <div className="panel grid gap-4 p-6 sm:grid-cols-3">
              <StatusCard
                label="Servicos com imagem"
                value={String(services.filter((service) => service.imageUrl?.trim()).length)}
              />
              <StatusCard
                label="Profissionais com foto"
                value={String(
                  professionals.filter((professional) => professional.imageUrl?.trim()).length,
                )}
              />
              <StatusCard label="Posts publicados" value={String(posts.length)} />
            </div>
          </TabsContent>

          <TabsContent value="reserva" className="space-y-5">
            <div className="panel divide-y divide-border p-2">
              <Toggle
                label="Permitir agendamento online"
                checked={cfg.allowOnlineBooking}
                onChange={(value) => set("allowOnlineBooking", value)}
              />
              <Toggle
                label="Exigir sinal na reserva"
                checked={cfg.requireDeposit}
                onChange={(value) => set("requireDeposit", value)}
              />
            </div>

            <div className="panel grid gap-4 p-6 sm:grid-cols-3">
              <Field label="Sinal (%)">
                <Input
                  type="number"
                  value={cfg.depositPercent}
                  onChange={(event) => set("depositPercent", Number(event.target.value))}
                />
              </Field>
              <Field label="Janela de cancelamento (h)">
                <Input
                  type="number"
                  value={cfg.cancelWindowHours}
                  onChange={(event) => set("cancelWindowHours", Number(event.target.value))}
                />
              </Field>
              <Field label="Auto cancelar apos (min)">
                <Input
                  type="number"
                  value={cfg.autoCancelMinutes}
                  onChange={(event) => set("autoCancelMinutes", Number(event.target.value))}
                />
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="suporte" className="space-y-5">
            <div className="panel grid gap-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Telefone de suporte">
                  <Input
                    value={cfg.supportPhone}
                    onChange={(event) => set("supportPhone", event.target.value)}
                  />
                </Field>
                <Field label="Codigo de convite">
                  <div className="flex gap-2">
                    <Input value={cfg.inviteCode} readOnly />
                    <Button variant="outline" onClick={() => void copyInviteCode()}>
                      Copiar
                    </Button>
                  </div>
                </Field>
              </div>
              <Field label="Endereco">
                <Textarea
                  rows={2}
                  value={cfg.address}
                  onChange={(event) => set("address", event.target.value)}
                />
              </Field>
            </div>
          </TabsContent>
        </Tabs>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Pre-visualizacao ao vivo
          </p>
          <div className="mx-auto w-[340px] overflow-hidden rounded-[36px] border-8 border-foreground/90 shadow-xl">
            <div
              className="h-[640px] overflow-y-auto p-4"
              style={{ background: surface, color: text, fontFamily: fontMap[cfg.fontStyle] }}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {logoImageUrl ? (
                    <div className="size-11 overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                      <img
                        src={logoImageUrl}
                        alt={cfg.appName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                  <div>
                    <p className="text-lg font-semibold" style={{ color: cfg.primaryColor }}>
                      {cfg.logoText}
                    </p>
                    <p className="text-[10px] opacity-60">{cfg.appName}</p>
                  </div>
                </div>
                <span className="text-[10px] opacity-60">{cfg.tagline}</span>
              </div>

              <div
                className="relative mb-4 overflow-hidden p-5"
                style={{
                  background: heroImageUrl
                    ? `linear-gradient(180deg, #00000040, #00000095), url(${heroImageUrl}) center/cover`
                    : cfg.primaryColor,
                  borderRadius: radiusMap[cfg.cornerStyle],
                  color: "#fff",
                }}
              >
                <p className="text-xl leading-tight">{cfg.heroTitle}</p>
                <p className="mt-1 text-xs opacity-85">{cfg.heroSubtitle}</p>
                {cfg.allowOnlineBooking ? (
                  <span
                    className="mt-4 inline-block px-4 py-2 text-xs font-medium"
                    style={{
                      background: cfg.accentColor,
                      borderRadius: radiusMap[cfg.cornerStyle],
                      color: "#1b1613",
                    }}
                  >
                    {cfg.heroCta}
                  </span>
                ) : null}
              </div>

              <p className="mb-3 text-xs opacity-70">{cfg.welcomeMessage}</p>

              <div className="mb-4 grid grid-cols-2 gap-2">
                {cfg.highlightBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="p-3"
                    style={{
                      background: dark ? "#221d1a" : "#00000008",
                      borderRadius: radiusMap[cfg.cornerStyle],
                    }}
                  >
                    <span className="text-base">{block.emoji}</span>
                    <p className="text-xs font-medium">{block.title}</p>
                    <p className="text-[10px] opacity-60">{block.subtitle}</p>
                  </div>
                ))}
              </div>

              {galleryCoverImageUrl ? (
                <div
                  className="mb-4 overflow-hidden"
                  style={{
                    background: dark ? "#221d1a" : "#00000008",
                    borderRadius: radiusMap[cfg.cornerStyle],
                  }}
                >
                  <div className="aspect-[16/8]">
                    <img
                      src={galleryCoverImageUrl}
                      alt="Capa da galeria"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-widest opacity-60">Galeria</p>
                    <p className="text-xs">Capa visual do feed e dos trabalhos recentes.</p>
                  </div>
                </div>
              ) : null}

              <p className="mb-2 text-[10px] uppercase tracking-widest opacity-60">Servicos</p>
              <div className="mb-4 space-y-2">
                {previewServices.map((service) => {
                  const serviceImageUrl = resolveSalonAssetUrl(service.imageUrl);

                  return (
                    <div
                      key={service.id}
                      className="flex items-center gap-3 p-3 text-xs"
                      style={{
                        background: dark ? "#221d1a" : "#00000008",
                        borderRadius: radiusMap[cfg.cornerStyle],
                      }}
                    >
                      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-[10px] text-muted-foreground">
                        {serviceImageUrl ? (
                          <img
                            src={serviceImageUrl}
                            alt={service.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          "sem foto"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{service.name}</p>
                        <p className="truncate text-[10px] opacity-60">
                          {service.description || "Sem descricao."}
                        </p>
                      </div>
                      {cfg.showPrices ? (
                        <span style={{ color: cfg.primaryColor }}>{brl(service.price)}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {cfg.showTeam ? (
                <>
                  {profileCoverImageUrl ? (
                    <div
                      className="mb-3 overflow-hidden"
                      style={{
                        background: dark ? "#221d1a" : "#00000008",
                        borderRadius: radiusMap[cfg.cornerStyle],
                      }}
                    >
                      <div className="aspect-[16/7]">
                        <img
                          src={profileCoverImageUrl}
                          alt="Capa do perfil"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                  ) : null}
                  <p className="mb-2 text-[10px] uppercase tracking-widest opacity-60">Equipe</p>
                  <div className="mb-4 flex gap-2">
                    {previewProfessionals.map((professional) => {
                      const professionalImageUrl = resolveSalonAssetUrl(professional.imageUrl);

                      return (
                        <div
                          key={professional.id}
                          className="flex-1 p-2 text-center text-[10px]"
                          style={{
                            background: dark ? "#221d1a" : "#00000008",
                            borderRadius: radiusMap[cfg.cornerStyle],
                          }}
                        >
                          <div className="mx-auto mb-2 flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-white/10">
                            {professionalImageUrl ? (
                              <img
                                src={professionalImageUrl}
                                alt={professional.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>{professional.name.slice(0, 1).toUpperCase()}</span>
                            )}
                          </div>
                          {professional.name.split(" ")[0]}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {previewPromotions.length ? (
                <div className="mb-4 space-y-2">
                  {previewPromotions.map((promotion) => {
                    const promotionImageUrl = resolveSalonAssetUrl(promotion.imageUrl);

                    return (
                      <div
                        key={promotion.id}
                        className="overflow-hidden"
                        style={{
                          background: dark ? "#221d1a" : "#00000008",
                          borderRadius: radiusMap[cfg.cornerStyle],
                        }}
                      >
                        {promotionImageUrl ? (
                          <div className="aspect-[16/8]">
                            <img
                              src={promotionImageUrl}
                              alt={promotion.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : null}
                        <div className="p-3 text-xs">
                          <p className="font-semibold">{promotion.name}</p>
                          <p className="mt-1 opacity-70">
                            {promotion.description ||
                              `${promotion.channel} · ${promotion.discount}% de desconto`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {cfg.showStore ? (
                <div className="mb-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest opacity-60">Loja</p>
                  {previewProducts.length ? (
                    previewProducts.map((product) => {
                      const productImageUrl = resolveInventoryProductAssetUrl(
                        product.imageUrls?.[0],
                      );

                      return (
                        <div
                          key={product.id}
                          className="flex items-center gap-3 p-3 text-xs"
                          style={{
                            background: dark ? "#221d1a" : "#00000008",
                            borderRadius: radiusMap[cfg.cornerStyle],
                          }}
                        >
                          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-[10px] text-muted-foreground">
                            {productImageUrl ? (
                              <img
                                src={productImageUrl}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              "sem foto"
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{product.name}</p>
                            <p className="truncate text-[10px] opacity-60">
                              {product.brand || "Sem marca"} · {product.unit || "un"}
                            </p>
                          </div>
                          <span style={{ color: cfg.primaryColor }}>{brl(product.price)}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div
                      className="p-3 text-xs"
                      style={{
                        background: dark ? "#221d1a" : "#00000008",
                        borderRadius: radiusMap[cfg.cornerStyle],
                      }}
                    >
                      Loja · produtos exclusivos do salao
                    </div>
                  )}
                </div>
              ) : null}

              {cfg.showFeed ? (
                previewPosts.length ? (
                  <div className="mb-3 space-y-3">
                    {previewPosts.map((post) => {
                      const postImageUrl = resolveSalonPostAssetUrl(
                        post.imageUrls?.[0] ?? post.imageUrl,
                      );

                      return (
                        <div
                          key={post.id}
                          className="overflow-hidden"
                          style={{
                            background: dark ? "#221d1a" : "#00000008",
                            borderRadius: radiusMap[cfg.cornerStyle],
                          }}
                        >
                          {postImageUrl ? (
                            <div className="aspect-[4/5]">
                              <img
                                src={postImageUrl}
                                alt={post.title}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : null}
                          <div className="p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold">{post.title}</p>
                              <span className="text-[10px] opacity-60">{post.likes} curtidas</span>
                            </div>
                            <p className="text-[11px] opacity-75">
                              {post.body || "Sem legenda adicional."}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    className="mb-3 p-3 text-xs"
                    style={{
                      background: dark ? "#221d1a" : "#00000008",
                      borderRadius: radiusMap[cfg.cornerStyle],
                    }}
                  >
                    Feed · novidades, historias e transformacoes.
                  </div>
                )
              ) : null}

              {shareImageUrl ? (
                <div
                  className="mt-4 overflow-hidden"
                  style={{
                    background: dark ? "#221d1a" : "#00000008",
                    borderRadius: radiusMap[cfg.cornerStyle],
                  }}
                >
                  <div className="aspect-[16/9]">
                    <img
                      src={shareImageUrl}
                      alt="Imagem de compartilhamento"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-widest opacity-60">
                      Compartilhamento
                    </p>
                    <p className="text-xs">
                      Arte usada quando o salao e compartilhado para novos clientes.
                    </p>
                  </div>
                </div>
              ) : null}

              <p className="mt-4 text-center text-[10px] opacity-50">
                {cfg.supportPhone} · codigo {cfg.inviteCode}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="size-10 cursor-pointer rounded-md border border-border bg-transparent"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-border/70 bg-background/70 p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
    </div>
  );
}
