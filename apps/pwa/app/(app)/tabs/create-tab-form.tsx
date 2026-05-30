import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { createTabSchema } from "models";
import { useNavigate } from "@/lib/navigation";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";
import { zodFieldErrors } from "@/lib/form-zod";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const userDefaultCurrency = (
    session?.user as { defaultCurrency?: string | null } | undefined
  )?.defaultCurrency;

  const form = useForm({
    defaultValues: {
      name: "",
      currency: userDefaultCurrency ?? "USD",
    },
    validators: {
      onSubmit: ({ value }) => zodFieldErrors(createTabSchema, value),
    },
    onSubmit: async ({ value }) => {
      const result = await api.tabs.create(value.name.trim(), value.currency);

      if (!result.success) {
        form.setErrorMap({ onSubmit: { form: result.error, fields: {} } });
        return;
      }
      if (!result.tabId) {
        form.setErrorMap({
          onSubmit: { form: "Failed to create tab", fields: {} },
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["tabs"] });
      navigate(`/tabs/${result.tabId}`);
    },
  });

  useEffect(() => {
    if (userDefaultCurrency) {
      form.setFieldValue("currency", userDefaultCurrency);
    }
  }, [userDefaultCurrency, form]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="name">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="tab-name">Tab name</Label>
              <Input
                id="tab-name"
                type="text"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="e.g. Trip to NYC"
                required
                disabled={form.state.isSubmitting}
              />
              {field.state.meta.errors[0] ? (
                <p className="text-sm text-destructive">
                  {String(field.state.meta.errors[0])}
                </p>
              ) : null}
            </div>
          )}
        </form.Field>
        <form.Field name="currency">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor="tab-currency">Currency</Label>
              <Select
                value={field.state.value}
                onValueChange={field.handleChange}
                disabled={form.state.isSubmitting}
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
          )}
        </form.Field>
        <div className="flex gap-2">
          <Button type="submit" disabled={form.state.isSubmitting}>
            {form.state.isSubmitting ? "Creating..." : "Create tab"}
          </Button>
        </div>
      </form>
      {form.state.errorMap.onSubmit?.form ? (
        <Alert variant="destructive">
          <AlertDescription>
            {String(form.state.errorMap.onSubmit.form)}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
