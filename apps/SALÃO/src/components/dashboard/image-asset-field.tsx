import { useRef, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ImageAssetFieldProps = {
  accept?: string;
  description?: string;
  emptyLabel?: string;
  inputPlaceholder?: string;
  isUploading?: boolean;
  label: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onUpload: (file: File) => Promise<void> | void;
  previewUrl?: string | null;
  uploadLabel?: string;
  value: string;
};

export function ImageAssetField({
  accept = "image/png,image/jpeg,image/webp,image/svg+xml",
  description,
  emptyLabel = "Nenhuma imagem definida ainda.",
  inputPlaceholder = "Cole uma URL publica ou envie pelo botao abaixo",
  isUploading = false,
  label,
  onChange,
  onClear,
  onUpload,
  previewUrl,
  uploadLabel = "Enviar imagem",
  value,
}: ImageAssetFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    await onUpload(file);
  };

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs">{label}</Label>
        {onClear ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Limpar
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[24px] border border-border/70 bg-secondary/20">
        {previewUrl ? (
          <div className="aspect-[4/3]">
            <img src={previewUrl} alt={label} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center px-6 text-center text-xs text-muted-foreground">
            {emptyLabel}
          </div>
        )}
      </div>

      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? "Enviando..." : uploadLabel}
        </Button>
      </div>

      <Input
        value={value}
        placeholder={inputPlaceholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
