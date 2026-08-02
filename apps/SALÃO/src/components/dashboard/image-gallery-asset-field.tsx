import { useRef, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ImageGalleryAssetFieldProps = {
  accept?: string;
  description?: string;
  emptyLabel?: string;
  inputPlaceholder?: string;
  isUploading?: boolean;
  label: string;
  maxItems?: number;
  onChange: (value: string[]) => void;
  onUpload: (files: File[]) => Promise<void> | void;
  previewUrls: Array<string | null | undefined>;
  uploadLabel?: string;
  value: string[];
};

export function ImageGalleryAssetField({
  accept = "image/png,image/jpeg,image/webp",
  description,
  emptyLabel = "Nenhuma imagem definida ainda.",
  inputPlaceholder = "Cole uma URL publica ou envie pelo botao abaixo",
  isUploading = false,
  label,
  maxItems = 6,
  onChange,
  onUpload,
  previewUrls,
  uploadLabel = "Enviar imagens",
  value,
}: ImageGalleryAssetFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canAddMore = value.length < maxItems;

  const updateValueAt = (index: number, nextValue: string) => {
    onChange(
      value.map((currentValue, currentIndex) =>
        currentIndex === index ? nextValue : currentValue,
      ),
    );
  };

  const removeValueAt = (index: number) => {
    onChange(value.filter((_, currentIndex) => currentIndex !== index));
  };

  const addEmptySlot = () => {
    if (!canAddMore) {
      return;
    }

    onChange([...value, ""]);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) {
      return;
    }

    await onUpload(files.slice(0, Math.max(0, maxItems - value.length)));
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-xs">{label}</Label>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {value.length}/{maxItems} imagem(ns)
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canAddMore}
          onClick={addEmptySlot}
        >
          Adicionar URL
        </Button>
      </div>

      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}

      {value.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {value.map((imagePath, index) => (
            <div
              key={`${index}-${imagePath}`}
              className="grid gap-3 rounded-[24px] border border-border/70 bg-secondary/20 p-3"
            >
              <div className="overflow-hidden rounded-[18px] border border-border/50 bg-background/80">
                {previewUrls[index] ? (
                  <div className="aspect-[4/3]">
                    <img
                      src={previewUrls[index] ?? undefined}
                      alt={`${label} ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center px-4 text-center text-xs text-muted-foreground">
                    {emptyLabel}
                  </div>
                )}
              </div>

              <Input
                value={imagePath}
                placeholder={inputPlaceholder}
                onChange={(event) => updateValueAt(index, event.target.value)}
              />

              <Button
                type="button"
                variant="ghost"
                className="justify-start text-destructive"
                onClick={() => removeValueAt(index)}
              >
                Remover imagem
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-36 items-center justify-center rounded-[24px] border border-border/70 bg-secondary/20 px-6 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(event) => void handleFileChange(event)}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={isUploading || !canAddMore}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? "Enviando..." : uploadLabel}
        </Button>
      </div>
    </div>
  );
}
