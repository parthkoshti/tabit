import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
} from "recharts";
import { CalendarRange, ChartColumnIncreasing, ChartPie } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCompactAmount } from "@/lib/format-amount";
import {
  buildTabExpensesChartData,
  buildTabExpensesDonutData,
} from "@/lib/tab-expenses-chart-data";
import {
  TAB_EXPENSES_CHART_RANGE_OPTIONS,
  type TabExpensesChartRange,
} from "@/lib/tab-expenses-chart-range";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type TabExpensesChartType = "stacked-bar" | "donut";

const CHART_TYPE_OPTIONS: {
  value: TabExpensesChartType;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "stacked-bar", label: "Stacked bar", icon: ChartColumnIncreasing },
  { value: "donut", label: "Donut", icon: ChartPie },
];

function ChartTypeSelectItem({
  value,
  label,
  icon: Icon,
}: {
  value: TabExpensesChartType;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      textValue={label}
      className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    >
      <Icon
        aria-hidden
        className="pointer-events-none absolute left-2 h-4 w-4 opacity-70"
      />
      <SelectPrimitive.ItemText>{label}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

type TabExpensesChartProps = {
  tabId: string;
  tabCurrency: string;
  currentUserId: string;
  getMemberUser: (userId: string) => {
    id?: string;
    name?: string | null;
    username?: string | null;
    email?: string | null;
  };
  participants?: Array<{
    id: string;
    displayName?: string | null;
    userId?: string | null;
  }>;
};

function payerLabelFromTooltip(
  name: unknown,
  item: unknown,
  chartConfig: ChartConfig,
): string {
  const entry = item as {
    dataKey?: string | number;
    payload?: { payerKey?: string; label?: string };
  };
  const configKey = String(
    entry.payload?.payerKey ?? entry.dataKey ?? "",
  );
  const fromConfig = chartConfig[configKey]?.label;
  if (typeof fromConfig === "string") return fromConfig;
  if (
    entry.payload?.payerKey &&
    typeof entry.payload.label === "string"
  ) {
    return entry.payload.label;
  }
  if (typeof name === "string" && name) return name;
  return configKey;
}

function TooltipAmountRow({
  payerLabel,
  amount,
  tabCurrency,
}: {
  payerLabel: string;
  amount: number;
  tabCurrency: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-between gap-4">
      <span className="text-muted-foreground">{payerLabel}</span>
      <span className="font-mono font-medium tabular-nums text-foreground">
        {formatCompactAmount(amount, tabCurrency)}
      </span>
    </div>
  );
}

export function TabExpensesChartSkeleton() {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-28" />
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>
      <Card>
        <CardContent className="p-3 pt-4">
          <Skeleton className="h-36 w-full rounded-md" />
        </CardContent>
      </Card>
    </section>
  );
}

export function TabExpensesChart({
  tabId,
  tabCurrency,
  currentUserId,
  getMemberUser,
  participants,
}: TabExpensesChartProps) {
  const [timeRange, setTimeRange] = useState<TabExpensesChartRange>("all-time");
  const [chartType, setChartType] =
    useState<TabExpensesChartType>("stacked-bar");

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses-chart", tabId],
    queryFn: async () => {
      const r = await api.expenses.list(tabId, { filter: "all" });
      return r.success ? (r.expenses ?? []) : [];
    },
    enabled: !!tabId,
  });

  const hasAnyExpenses = useMemo(
    () => (expenses ?? []).some((expense) => !expense.deletedAt),
    [expenses],
  );

  const { data: chartData, payers } = useMemo(
    () =>
      buildTabExpensesChartData(
        expenses ?? [],
        currentUserId,
        getMemberUser,
        participants,
        timeRange,
      ),
    [expenses, currentUserId, getMemberUser, participants, timeRange],
  );

  const donutData = useMemo(
    () => buildTabExpensesDonutData(chartData, payers),
    [chartData, payers],
  );

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    for (const payer of payers) {
      config[payer.key] = {
        label: payer.label,
        color: payer.color,
      };
    }
    return config;
  }, [payers]);

  const hasChartData =
    chartType === "donut"
      ? donutData.length > 0
      : chartData.length > 0 && payers.length > 0;

  if (isLoading) {
    return <TabExpensesChartSkeleton />;
  }

  if (!hasAnyExpenses) {
    return null;
  }

  const activeChartType =
    CHART_TYPE_OPTIONS.find((option) => option.value === chartType) ??
    CHART_TYPE_OPTIONS[0];
  const ActiveChartTypeIcon = activeChartType.icon;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-medium">Spending</h2>
        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={chartType}
            onValueChange={(value) =>
              setChartType(value as TabExpensesChartType)
            }
          >
            <SelectTrigger className="h-8 w-fit max-w-36 shrink-0 justify-start gap-1.5 text-xs">
              <ActiveChartTypeIcon className="h-4 w-4 shrink-0 opacity-70" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHART_TYPE_OPTIONS.map((option) => (
                <ChartTypeSelectItem
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  icon={option.icon}
                />
              ))}
            </SelectContent>
          </Select>
          <Select
            value={timeRange}
            onValueChange={(value) =>
              setTimeRange(value as TabExpensesChartRange)
            }
          >
            <SelectTrigger className="h-8 w-fit max-w-40 shrink-0 text-xs">
              <CalendarRange className="mr-1 h-4 w-4 shrink-0 opacity-70" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAB_EXPENSES_CHART_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Card>
        <CardContent className="p-3 pt-4">
          {!hasChartData ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No spending in this period
            </p>
          ) : chartType === "donut" ? (
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-36 w-full"
            >
              <PieChart>
                <ChartTooltip
                  content={(tooltipProps) => (
                    <ChartTooltipContent
                      {...tooltipProps}
                      hideLabel
                      nameKey="payerKey"
                      formatter={(value, name, item) => {
                        const amount =
                          typeof value === "number" ? value : Number(value);
                        if (!amount) return null;
                        const payerLabel = payerLabelFromTooltip(
                          name,
                          item,
                          chartConfig,
                        );
                        return (
                          <TooltipAmountRow
                            payerLabel={payerLabel}
                            amount={amount}
                            tabCurrency={tabCurrency}
                          />
                        );
                      }}
                    />
                  )}
                />
                <Pie
                  data={donutData}
                  dataKey="amount"
                  nameKey="payerKey"
                  innerRadius={42}
                  outerRadius={58}
                  strokeWidth={2}
                >
                  {donutData.map((slice) => (
                    <Cell key={slice.payerKey} fill={slice.fill} />
                  ))}
                </Pie>
                <ChartLegend
                  content={
                    <ChartLegendContent
                      nameKey="payerKey"
                      className="flex-wrap justify-center gap-x-3 gap-y-1 pt-2 text-[11px]"
                    />
                  }
                />
              </PieChart>
            </ChartContainer>
          ) : (
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-36 w-full"
            >
              <BarChart
                accessibilityLayer
                data={chartData}
                margin={{ left: 0, right: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                />
                <ChartTooltip
                  filterNull
                  content={(tooltipProps) => (
                    <ChartTooltipContent
                      {...tooltipProps}
                      nameKey="dataKey"
                      formatter={(value, name, item) => {
                        const amount =
                          typeof value === "number" ? value : Number(value);
                        if (!amount) return null;
                        const payerLabel = payerLabelFromTooltip(
                          name,
                          item,
                          chartConfig,
                        );
                        return (
                          <TooltipAmountRow
                            payerLabel={payerLabel}
                            amount={amount}
                            tabCurrency={tabCurrency}
                          />
                        );
                      }}
                    />
                  )}
                />
                <ChartLegend
                  content={
                    <ChartLegendContent className="flex-wrap justify-center gap-x-3 gap-y-1 pt-2 text-[11px]" />
                  }
                />
                {payers.map((payer, index) => (
                  <Bar
                    key={payer.key}
                    name={payer.label}
                    dataKey={payer.key}
                    stackId="expenses"
                    fill={`var(--color-${payer.key})`}
                    radius={
                      index === payers.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]
                    }
                  />
                ))}
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
