import type { DistributionPoint, FinanceExpense } from "./types";

export function getCurrentMonthKey(referenceDate = new Date()) {
  return `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const nextDate = new Date(year, month - 1 + delta, 1);
  return getCurrentMonthKey(nextDate);
}

export function formatFinanceMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function getFinanceDistribution(expenses: FinanceExpense[]): DistributionPoint[] {
  const totals = new Map<string, number>();
  const ids = new Map<string, number>();

  expenses.forEach((expense) => {
    totals.set(expense.category.name, (totals.get(expense.category.name) ?? 0) + expense.amount);
    ids.set(expense.category.name, expense.category.id);
  });

  return Array.from(totals.entries())
    .map(([name, amount]) => ({
      id: ids.get(name) ?? 0,
      name,
      minutes: amount,
    }))
    .sort((left, right) => right.minutes - left.minutes || left.name.localeCompare(right.name));
}

export function getFinanceTotal(expenses: FinanceExpense[]) {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
}
