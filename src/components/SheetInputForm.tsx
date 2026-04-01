import { useState } from "react";
import { Search, Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SheetInputFormProps {
  onSubmit: (sheetId: string) => void;
  isLoading: boolean;
}

const DEFAULT_ID = "1uRNEtACM2Wx5WLxQq_UvBvuIzm874lH737ivA0qotkM";

export function SheetInputForm({ onSubmit, isLoading }: SheetInputFormProps) {
  const [sheetId, setSheetId] = useState(DEFAULT_ID);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = sheetId.trim().replace(/\/$/, "");
    if (id) onSubmit(id);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <FileSpreadsheet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cole o ID da planilha pública do Google Sheets"
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            className="pl-10 h-12 text-sm bg-card border-border"
          />
        </div>
        <Button type="submit" disabled={isLoading || !sheetId.trim()} className="h-12 px-6">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Search className="h-4 w-4 mr-2" />
          )}
          {isLoading ? "Carregando..." : "Conectar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center">
        A planilha deve ser pública (Viewer). Abas no formato "MÊS ANO" (ex: ABRIL 26).
      </p>
    </form>
  );
}
