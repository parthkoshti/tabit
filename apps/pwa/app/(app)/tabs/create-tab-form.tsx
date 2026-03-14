import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURATED_CURRENCIES, getCurrency } from "shared";

export function CreateTabForm() {
  const { data: session } = authClient.useSession();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const userDefaultCurrency = (
    session?.user as { defaultCurrency?: string | null } | undefined
  )?.defaultCurrency;

  useEffect(() => {
    if (userDefaultCurrency) {
      setCurrency(userDefaultCurrency);
    }
  }, [userDefaultCurrency]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await api.tabs.create(name.trim(), currency);

    if (result.success && result.tabId) {
      queryClient.invalidateQueries({ queryKey: ["tabs"] });
      navigate(`/tabs/${result.tabId}`);
    } else {
      setError(result.error ?? "Failed to create tab");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tab-name">Tab name</Label>
          <Input
            id="tab-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Trip to NYC"
            required
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tab-currency">Currency</Label>
          <Select
            value={currency}
            onValueChange={setCurrency}
            disabled={loading}
          >
            <SelectTrigger id="tab-currency">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {CURATED_CURRENCIES.map((code) => {
                const c = getCurrency(code);
                return (
                  <SelectItem key={code} value={code}>
                    {code} - {c?.name ?? code} ({c?.symbol ?? ""})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create tab"}
          </Button>
        </div>
      </form>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
