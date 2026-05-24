import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DistributionPieChart } from "../components/Charts";
import { api } from "../lib/api";
import {
  formatCurrency,
  formatFinanceMonth,
  getCurrentMonthKey,
  getFinanceDistribution,
  getFinanceTotal,
  shiftMonth,
} from "../lib/finance";
import type {
  FinanceCategory,
  FinanceExpense,
  FinanceSubscription,
  FinanceWishlistItem,
} from "../lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: EASE },
};

export function FinancePage({
  categories,
}: {
  categories: FinanceCategory[];
}) {
  const defaultExpenseCategoryId = categories[0]?.id ?? 0;
  const defaultSubscriptionCategoryId = getDefaultSubscriptionCategoryId(categories);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [subscriptions, setSubscriptions] = useState<FinanceSubscription[]>([]);
  const [wishlist, setWishlist] = useState<FinanceWishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftCategoryId, setDraftCategoryId] = useState<number>(defaultExpenseCategoryId);
  const [draftAmount, setDraftAmount] = useState("");
  const [draftDate, setDraftDate] = useState(getTodayString());
  const [subscriptionName, setSubscriptionName] = useState("");
  const [subscriptionCategoryId, setSubscriptionCategoryId] =
    useState<number>(defaultSubscriptionCategoryId);
  const [subscriptionAmount, setSubscriptionAmount] = useState("");
  const [subscriptionBillingDay, setSubscriptionBillingDay] = useState(getTodayDay());
  const [subscriptionStartDate, setSubscriptionStartDate] = useState(getTodayString());
  const [wishlistName, setWishlistName] = useState("");
  const [wishlistLink, setWishlistLink] = useState("");
  const [wishlistPrice, setWishlistPrice] = useState("");

  useEffect(() => {
    if (!categories.some((category) => category.id === draftCategoryId)) {
      setDraftCategoryId(defaultExpenseCategoryId);
    }
    if (!categories.some((category) => category.id === subscriptionCategoryId)) {
      setSubscriptionCategoryId(defaultSubscriptionCategoryId);
    }
  }, [
    categories,
    defaultExpenseCategoryId,
    defaultSubscriptionCategoryId,
    draftCategoryId,
    subscriptionCategoryId,
  ]);

  async function loadFinanceMonth(month = selectedMonth) {
    setLoading(true);
    try {
      const response = await api.getFinance(month);
      setExpenses(response.expenses);
      setSubscriptions(response.subscriptions);
      setWishlist(response.wishlist);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load finance data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadFinanceMonthView() {
      try {
        setLoading(true);
        const response = await api.getFinance(selectedMonth);
        if (!cancelled) {
          setExpenses(response.expenses);
          setSubscriptions(response.subscriptions);
          setWishlist(response.wishlist);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unable to load finance data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFinanceMonthView();
    return () => {
      cancelled = true;
    };
  }, [selectedMonth]);

  const total = useMemo(() => getFinanceTotal(expenses), [expenses]);
  const distribution = useMemo(() => getFinanceDistribution(expenses), [expenses]);
  const orderedMonthlyExpenses = useMemo(() => {
    const manualExpenses = expenses.filter((expense) => expense.source !== "subscription");
    const subscriptionExpenses = expenses.filter((expense) => expense.source === "subscription");
    return [...manualExpenses, ...subscriptionExpenses];
  }, [expenses]);

  async function submitExpense(event: FormEvent) {
    event.preventDefault();
    if (!draftName.trim() || !draftCategoryId || !draftAmount.trim()) {
      return;
    }
    try {
      const createdExpense = await api.createFinanceExpense({
        name: draftName.trim(),
        categoryId: draftCategoryId,
        amount: Number(draftAmount),
        date: draftDate,
      });

      const createdMonth = createdExpense.date.slice(0, 7);
      if (createdMonth !== selectedMonth) {
        setSelectedMonth(createdMonth);
      } else {
        setExpenses((current) =>
          [createdExpense, ...current].sort(
            (left, right) => right.date.localeCompare(left.date) || right.id - left.id,
          ),
        );
      }

      setDraftName("");
      setDraftAmount("");
      setDraftCategoryId(categories[0]?.id ?? 0);
      setDraftDate(getTodayString());
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "Unable to save expense.");
    }
  }

  async function submitSubscription(event: FormEvent) {
    event.preventDefault();
    if (
      !subscriptionName.trim() ||
      !subscriptionCategoryId ||
      !subscriptionAmount.trim() ||
      !subscriptionStartDate
    ) {
      return;
    }

    try {
      await api.createFinanceSubscription({
        name: subscriptionName.trim(),
        categoryId: subscriptionCategoryId,
        amount: Number(subscriptionAmount),
        billingDay: subscriptionBillingDay,
        startDate: subscriptionStartDate,
      });
      setSubscriptionName("");
      setSubscriptionAmount("");
      setSubscriptionBillingDay(getTodayDay());
      setSubscriptionStartDate(getTodayString());
      setSubscriptionCategoryId(defaultSubscriptionCategoryId);
      await loadFinanceMonth();
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "Unable to save subscription.");
    }
  }

  async function removeExpense(expenseId: number) {
    try {
      await api.deleteFinanceExpense(expenseId);
      setExpenses((current) => current.filter((expense) => expense.id !== expenseId));
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "Unable to delete expense.");
    }
  }

  async function cancelSubscription(subscriptionId: number) {
    try {
      await api.updateFinanceSubscription(subscriptionId, {
        endDate: getTodayString(),
      });
      await loadFinanceMonth();
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "Unable to cancel subscription.");
    }
  }

  async function updateSubscriptionCategory(subscriptionId: number, categoryId: number) {
    try {
      const updated = await api.updateFinanceSubscription(subscriptionId, {
        categoryId,
      });
      setSubscriptions((current) =>
        current.map((subscription) =>
          subscription.id === subscriptionId ? updated : subscription,
        ),
      );
      await loadFinanceMonth();
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "Unable to update subscription.");
    }
  }

  async function submitWishlistItem(event: FormEvent) {
    event.preventDefault();
    if (!wishlistName.trim() || !wishlistLink.trim() || !wishlistPrice.trim()) {
      return;
    }

    try {
      const item = await api.createFinanceWishlistItem({
        name: wishlistName.trim(),
        link: wishlistLink.trim(),
        price: Number(wishlistPrice),
      });
      setWishlist((current) => [item, ...current]);
      setWishlistName("");
      setWishlistLink("");
      setWishlistPrice("");
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "Unable to save wishlist item.");
    }
  }

  async function updateWishlistItem(
    wishlistItemId: number,
    field: "name" | "link" | "price",
    value: string,
  ) {
    try {
      const updated = await api.updateFinanceWishlistItem(wishlistItemId, {
        [field]: field === "price" ? Number(value) : value,
      });
      setWishlist((current) =>
        current.map((item) => (item.id === wishlistItemId ? updated : item)),
      );
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "Unable to update wishlist item.");
    }
  }

  async function removeWishlistItem(wishlistItemId: number) {
    try {
      await api.deleteFinanceWishlistItem(wishlistItemId);
      setWishlist((current) => current.filter((item) => item.id !== wishlistItemId));
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "Unable to delete wishlist item.");
    }
  }

  return (
    <section className="page finance-page">
      <motion.div className="page-heading" {...reveal}>
        <div>
          <h2 className="hero-title">Finance</h2>
        </div>
      </motion.div>

      <div className="content-grid finance-grid">
        <motion.section className="surface-card finance-left-column" {...reveal}>
          <div className="surface-header finance-header">
            <div>
              <h3>{formatFinanceMonth(selectedMonth)}</h3>
              <p>{formatCurrency(total)} spent this month</p>
            </div>
            <div className="finance-month-switcher">
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedMonth((current) => shiftMonth(current, -1))}
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedMonth((current) => shiftMonth(current, 1))}
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="surface-header finance-list-header">
            <div>
              <h3>Add expense</h3>
            </div>
          </div>

          <form className="finance-entry-form" onSubmit={submitExpense}>
            <div className="field-row finance-entry-grid">
              <label>
                <span className="metric-label">Expense</span>
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="Coffee with Sam"
                  required
                />
              </label>
              <label>
                <span className="metric-label">Category</span>
                <select
                  value={draftCategoryId}
                  onChange={(event) => setDraftCategoryId(Number(event.target.value))}
                  disabled={categories.length === 0}
                  required
                >
                  {categories.length === 0 ? (
                    <option value={0}>Add categories in settings</option>
                  ) : null}
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field-row finance-entry-grid">
              <label>
                <span className="metric-label">Amount</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={draftAmount}
                  onChange={(event) => setDraftAmount(event.target.value)}
                  placeholder="24.50"
                  required
                />
              </label>
              <label>
                <span className="metric-label">Date</span>
                <input
                  type="date"
                  value={draftDate}
                  onChange={(event) => setDraftDate(event.target.value)}
                  required
                />
              </label>
            </div>

            <div className="editor-actions finance-entry-actions">
              <button type="submit" className="primary-button" disabled={categories.length === 0}>
                <Plus size={16} />
                Add expense
              </button>
            </div>
          </form>
        </motion.section>

        <motion.section className="surface-card finance-chart-card" {...reveal}>
          <div className="surface-header">
            <div>
              <h3>Spending by category</h3>
              <p>{formatFinanceMonth(selectedMonth)}</p>
            </div>
          </div>
          <DistributionPieChart
            items={distribution}
            totalLabel="this month"
            emptyLabel="No spending to chart for this month"
            totalFormatter={formatCurrency}
          />
        </motion.section>
      </div>

      <div className="content-grid finance-panel-grid">
        <motion.section className="surface-card finance-subscriptions-card" {...reveal}>
          <div className="surface-header finance-list-header">
            <div>
              <h3>Subscriptions</h3>
              <p>Recurring charges that flow into each month automatically.</p>
            </div>
          </div>

          <form className="finance-entry-form" onSubmit={submitSubscription}>
            <div className="field-row finance-entry-grid">
              <label>
                <span className="metric-label">Subscription</span>
                <input
                  value={subscriptionName}
                  onChange={(event) => setSubscriptionName(event.target.value)}
                  placeholder="Spotify"
                  required
                />
              </label>
              <label>
                <span className="metric-label">Category</span>
                <select
                  value={subscriptionCategoryId}
                  onChange={(event) => setSubscriptionCategoryId(Number(event.target.value))}
                  disabled={categories.length === 0}
                  required
                >
                  {categories.length === 0 ? (
                    <option value={0}>Add categories in settings</option>
                  ) : null}
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field-row finance-entry-grid finance-subscription-grid">
              <label>
                <span className="metric-label">Amount</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={subscriptionAmount}
                  onChange={(event) => setSubscriptionAmount(event.target.value)}
                  placeholder="15.99"
                  required
                />
              </label>
              <label>
                <span className="metric-label">Billing day</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={subscriptionBillingDay}
                  onChange={(event) => setSubscriptionBillingDay(Number(event.target.value))}
                  required
                />
              </label>
              <label>
                <span className="metric-label">Starts</span>
                <input
                  type="date"
                  value={subscriptionStartDate}
                  onChange={(event) => setSubscriptionStartDate(event.target.value)}
                  required
                />
              </label>
            </div>

            <div className="editor-actions finance-entry-actions">
              <button type="submit" className="secondary-button" disabled={categories.length === 0}>
                <Plus size={16} />
                Add subscription
              </button>
            </div>
          </form>

          {subscriptions.length === 0 ? (
            <div className="empty-state finance-subscriptions-empty">
              <h4>No subscriptions yet.</h4>
              <p>Add recurring items once and they’ll appear in the right months automatically.</p>
            </div>
          ) : (
            <div className="finance-subscription-list">
              {subscriptions.map((subscription) => (
                <div key={subscription.id} className="finance-subscription-row">
                  <div className="finance-expense-main">
                    <strong>{subscription.name}</strong>
                    <span>
                      {formatCurrency(subscription.amount)} on day {subscription.billingDay}
                    </span>
                    <label className="finance-inline-select">
                      <span className="metric-label">Category</span>
                      <select
                        value={subscription.category.id}
                        onChange={(event) =>
                          void updateSubscriptionCategory(subscription.id, Number(event.target.value))
                        }
                        disabled={categories.length === 0}
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="finance-subscription-meta">
                    <span className={`networking-badge ${subscription.isActive ? "upcoming" : "neutral"}`}>
                      {subscription.isActive ? "Active" : "Canceled"}
                    </span>
                    <small>
                      {subscription.isActive
                        ? `Started ${formatDate(subscription.startDate)}`
                        : `Ended ${formatDate(subscription.endDate)}`}
                    </small>
                  </div>
                  {subscription.isActive ? (
                    <button
                      type="button"
                      className="secondary-button finance-cancel-button"
                      onClick={() => void cancelSubscription(subscription.id)}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </motion.section>

        <motion.section className="surface-card finance-expenses-card" {...reveal}>
          <div className="surface-header finance-list-header">
            <div>
              <h3>Monthly expenses</h3>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <h4>Loading expenses.</h4>
            </div>
          ) : error ? (
            <div className="empty-state error-state">
              <h4>Couldn&apos;t load this month.</h4>
              <p>{error}</p>
            </div>
          ) : orderedMonthlyExpenses.length === 0 ? (
            <div className="empty-state">
              <h4>No expenses for {formatFinanceMonth(selectedMonth)}.</h4>
              <p>Log the first spend on the left to start building the month.</p>
            </div>
          ) : (
            <div className="finance-expense-list">
              {orderedMonthlyExpenses.map((expense) => (
                <div key={expense.entryKey} className="finance-expense-row">
                  <div className="finance-expense-main">
                    <strong>{expense.name}</strong>
                    <span>
                      {expense.category.name}
                      {expense.source === "subscription" ? " · Subscription" : ""}
                    </span>
                  </div>
                  <div className="finance-expense-meta">
                    <strong>{formatCurrency(expense.amount)}</strong>
                    <span>{formatDate(expense.date)}</span>
                  </div>
                  {expense.source === "manual" ? (
                    <button
                      type="button"
                      className="icon-button danger"
                      aria-label={`Delete ${expense.name}`}
                      onClick={() => void removeExpense(expense.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <span className="finance-recurring-label">Recurring</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.section>
      </div>

      <motion.section className="surface-card finance-wishlist-card" {...reveal}>
        <div className="surface-header finance-list-header">
          <div>
            <h3>Wishlist</h3>
            <p>Things you want to buy, tracked in a cleaner sheet view.</p>
          </div>
        </div>

        <form className="finance-wishlist-form" onSubmit={submitWishlistItem}>
          <div className="finance-wishlist-table-shell">
            <table className="finance-wishlist-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Link</th>
                  <th>Price</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr className="finance-wishlist-entry-row">
                  <td>
                    <input
                      value={wishlistName}
                      onChange={(event) => setWishlistName(event.target.value)}
                      placeholder="Sony WH-1000XM6"
                      required
                    />
                  </td>
                  <td>
                    <input
                      value={wishlistLink}
                      onChange={(event) => setWishlistLink(event.target.value)}
                      placeholder="https://..."
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={wishlistPrice}
                      onChange={(event) => setWishlistPrice(event.target.value)}
                      placeholder="349.99"
                      required
                    />
                  </td>
                  <td>
                    <button type="submit" className="primary-button finance-wishlist-add">
                      <Plus size={16} />
                      Add
                    </button>
                  </td>
                </tr>
                {wishlist.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="empty-state finance-wishlist-empty">
                        <h4>No wishlist items yet.</h4>
                        <p>Start a running list of bigger purchases here.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  wishlist.map((item) => (
                    <WishlistRow
                      key={item.id}
                      item={item}
                      onSave={updateWishlistItem}
                      onRemove={removeWishlistItem}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </form>
      </motion.section>
    </section>
  );
}

function WishlistRow({
  item,
  onSave,
  onRemove,
}: {
  item: FinanceWishlistItem;
  onSave: (wishlistItemId: number, field: "name" | "link" | "price", value: string) => Promise<void>;
  onRemove: (wishlistItemId: number) => Promise<void>;
}) {
  const [draftName, setDraftName] = useState(item.name);
  const [draftLink, setDraftLink] = useState(item.link);
  const [draftPrice, setDraftPrice] = useState(item.price.toFixed(2));

  useEffect(() => {
    setDraftName(item.name);
    setDraftLink(item.link);
    setDraftPrice(item.price.toFixed(2));
  }, [item]);

  return (
    <tr>
      <td>
        <input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={() => void onSave(item.id, "name", draftName)}
        />
      </td>
      <td>
        <div className="finance-wishlist-link-cell">
          <input
            value={draftLink}
            onChange={(event) => setDraftLink(event.target.value)}
            onBlur={() => void onSave(item.id, "link", draftLink)}
          />
          <a href={item.link} target="_blank" rel="noreferrer" className="text-button">
            Open
          </a>
        </div>
      </td>
      <td>
        <input
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          value={draftPrice}
          onChange={(event) => setDraftPrice(event.target.value)}
          onBlur={() => void onSave(item.id, "price", draftPrice)}
        />
      </td>
      <td>
        <button
          type="button"
          className="icon-button danger"
          aria-label={`Delete ${item.name}`}
          onClick={() => void onRemove(item.id)}
        >
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );
}

function getTodayString() {
  return new Date().toLocaleDateString("en-CA");
}

function getTodayDay() {
  return new Date().getDate();
}

function getDefaultSubscriptionCategoryId(categories: FinanceCategory[]) {
  const subscriptionCategory = categories.find(
    (category) => category.name.trim().toLowerCase() === "subscriptions",
  );
  return subscriptionCategory?.id ?? categories[0]?.id ?? 0;
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
