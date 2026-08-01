import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, StatCard } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { brl, useSalon } from "@/lib/salon-store";

export default function ModulePage({
  moduleKey,
  title,
  subtitle,
}: {
  moduleKey: string;
  title: string;
  subtitle: string;
}) {
  const salon = useSalon();
  const {
    appointments,
    clients,
    comandas,
    openComanda,
    orders,
    posts,
    products,
    professionals,
    promotions,
    publishPost,
    settings,
    transactions,
    updateComandaWithItem,
    updateComandaWithPayment,
    updateComandaWithStatus,
    updateOrderStatus,
    incrementProductStock,
    deletePost,
    createOrUpdatePromotion,
    deletePromotion,
  } = salon;
  const [text, setText] = useState("");

  const revenue = transactions
    .filter((transaction) => transaction.type === "entrada")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  async function handleCopyPhone(phone: string, name: string) {
    if (!phone.trim()) {
      toast.error("Este cliente não possui telefone cadastrado.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("O navegador não liberou a área de transferência.");
      return;
    }

    await navigator.clipboard.writeText(phone);
    toast.success(`Contato de ${name} copiado`);
  }

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />

      <section className="mb-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Receita acumulada" value={brl(revenue)} tone="primary" />
        <StatCard label="Clientes na base" value={String(clients.length)} />
        <StatCard label="Atendimentos" value={String(appointments.length)} tone="success" />
        <StatCard label="Meta mensal" value={brl(settings.monthlyGoal)} tone="warning" />
      </section>

      {moduleKey.includes("comissoes") && (
        <div className="space-y-3">
          {professionals.map((professional) => (
            <div key={professional.id} className="panel flex items-center justify-between p-4 text-sm">
              <span>{professional.name} · {professional.commission}%</span>
              <span className="font-medium">
                {brl(
                  appointments
                    .filter((appointment) => appointment.professionalId === professional.id && appointment.status === "concluido")
                    .reduce((sum, appointment) => sum + appointment.price, 0) * (professional.commission / 100),
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {moduleKey.includes("pagamentos") && (
        <div className="space-y-2">
          {transactions.filter((transaction) => transaction.type === "entrada").map((transaction) => (
            <div key={transaction.id} className="panel flex items-center justify-between p-4 text-sm">
              <span>{transaction.description} · {transaction.method}</span>
              <span className="font-medium text-success">{brl(transaction.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {moduleKey.includes("comandas") && (
        <div className="space-y-3">
          {comandas.map((comanda) => (
            <div key={comanda.id} className="panel p-4 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">{comanda.clientName} · {comanda.status}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await updateComandaWithItem(comanda.id);
                        toast.success("Item adicionado");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Não foi possível adicionar o item.");
                      }
                    }}
                  >
                    Add item
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await updateComandaWithPayment(comanda.id);
                        toast.success("Pagamento adicionado");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Não foi possível registrar o pagamento.");
                      }
                    }}
                  >
                    Add pagamento
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await updateComandaWithStatus(comanda.id);
                        toast.success("Comanda fechada");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Não foi possível fechar a comanda.");
                      }
                    }}
                  >
                    Fechar
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {comanda.items.length} itens · total {brl(comanda.items.reduce((sum, item) => sum + item.price, 0))}
              </p>
            </div>
          ))}
          <Button
            variant="outline"
            className="rounded-full"
            onClick={async () => {
              try {
                await openComanda(text || "Cliente avulso");
                setText("");
                toast.success("Comanda aberta");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Não foi possível abrir a comanda.");
              }
            }}
          >
            Abrir comanda
          </Button>
        </div>
      )}

      {moduleKey.includes("inventory") && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-lg font-medium">Estoque</h2>
            {products.map((product) => (
              <div key={product.id} className="panel flex items-center justify-between p-4 text-sm">
                <span>{product.name} · {product.brand}</span>
                <div className="flex items-center gap-3">
                  <span className={product.stock <= product.minStock ? "text-destructive" : ""}>{product.stock} un</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await incrementProductStock(product.id);
                        toast.success("Movimentação registrada");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Não foi possível movimentar o estoque.");
                      }
                    }}
                  >
                    +1
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-medium">Pedidos</h2>
            {orders.map((order) => (
              <div key={order.id} className="panel flex items-center justify-between p-4 text-sm">
                <span>{order.clientName} · {order.productName}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await updateOrderStatus(order);
                      toast.success("Status atualizado");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o pedido.");
                    }
                  }}
                >
                  {order.status}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {moduleKey.includes("feed") && (
        <div className="space-y-4">
          <div className="panel flex gap-2 p-4">
            <Input placeholder="Escreva um post do salão" value={text} onChange={(event) => setText(event.target.value)} />
            <Button
              onClick={async () => {
                if (!text.trim()) {
                  toast.error("Escreva algo.");
                  return;
                }

                try {
                  await publishPost(text);
                  setText("");
                  toast.success("Post publicado");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Não foi possível publicar o post.");
                }
              }}
            >
              Publicar
            </Button>
          </div>
          {posts.map((post) => (
            <div key={post.id} className="panel p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{post.format}</p>
              <p className="font-medium">{post.title}</p>
              <p className="text-sm text-muted-foreground">{post.body}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span>{post.likes} curtidas · {post.comments.length} comentários</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    try {
                      await deletePost(post.id);
                      toast.success("Post excluído");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o post.");
                    }
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {moduleKey.includes("promotions") && (
        <div className="space-y-3">
          {promotions.map((promotion) => (
            <div key={promotion.id} className="panel flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium">{promotion.name} · {promotion.discount}%</p>
                <p className="text-xs text-muted-foreground">{promotion.channel} · {promotion.redemptions} resgates</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={promotion.active}
                  onCheckedChange={async (checked) => {
                    try {
                      await createOrUpdatePromotion({ ...promotion, active: checked });
                      toast.success(checked ? "Campanha ativada" : "Campanha pausada");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a campanha.");
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    try {
                      await deletePromotion(promotion.id);
                      toast.success("Campanha excluída");
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a campanha.");
                    }
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            className="rounded-full"
            onClick={async () => {
              try {
                await createOrUpdatePromotion({
                  active: true,
                  channel: "WhatsApp",
                  discount: 15,
                  id: "",
                  name: "Nova oferta",
                  redemptions: 0,
                });
                toast.success("Campanha criada");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Não foi possível criar a campanha.");
              }
            }}
          >
            Criar campanha
          </Button>
        </div>
      )}

      {moduleKey.includes("birthdays") && (
        <div className="space-y-3">
          {clients.map((client) => (
            <div key={client.id} className="panel flex items-center justify-between p-4 text-sm">
              <span>{client.name} · {client.birthday}</span>
              <Button size="sm" variant="outline" onClick={() => void handleCopyPhone(client.phone, client.name)}>
                Copiar contato
              </Button>
            </div>
          ))}
        </div>
      )}

      {((moduleKey.includes("settings") || moduleKey.includes("billing") || moduleKey.includes("subscriptions") ||
        moduleKey.includes("notifications") || moduleKey.includes("ai") || moduleKey.includes("benefits")) &&
        !moduleKey.includes("promotions")) && (
        <div className="panel space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            Este módulo já está lendo o panorama real do salão. As rotinas operacionais específicas continuam concentradas
            nas áreas de agenda, clientes, equipe, estoque, feed, campanhas e financeiro.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Clientes</p>
              <p className="mt-2 text-2xl font-semibold">{clients.length}</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Transações</p>
              <p className="mt-2 text-2xl font-semibold">{transactions.length}</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Equipe</p>
              <p className="mt-2 text-2xl font-semibold">{professionals.length}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
