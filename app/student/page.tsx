"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type User = { user_id: number; name: string; email: string; role: string };

type FoodItem = {
  item_id: number;
  name: string;
  description: string | null;
  price: string;
  is_available: number;
  category_id: number;
  category_name: string;
  quantity_available: number;
};

type Slot = {
  slot_id: number;
  slot_time: string;
  max_capacity: number;
  booked: number;
  remaining: number;
  is_full: boolean;
};

const PAYMENT_MODES = ["UPI", "Card", "Cash", "Wallet"];

export default function StudentMenuPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [slotId, setSlotId] = useState("");
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [placing, setPlacing] = useState(false);
  // Set when an order was created but its payment has not succeeded yet.
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const me = await fetch("/api/auth/me");
      if (!me.ok) {
        router.push("/student/login");
        return;
      }
      setUser((await me.json()).user);

      const [foodRes, slotRes] = await Promise.all([
        fetch("/api/food-items"),
        fetch("/api/pickup-slots"),
      ]);

      if (!foodRes.ok || !slotRes.ok) {
        setError("Could not load the menu. Please refresh the page.");
        return;
      }

      setItems((await foodRes.json()).food_items);
      setSlots((await slotRes.json()).slots);
    } catch {
      setError("Could not reach the server. Please try again.");
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const locked = pendingOrderId !== null;

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(items.map((i) => i.category_name)))],
    [items]
  );

  const visibleItems = items.filter(
    (i) => category === "All" || i.category_name === category
  );

  const cartLines = items.filter((i) => (cart[i.item_id] ?? 0) > 0);

  const totalCents = cartLines.reduce(
    (sum, i) => sum + Math.round(Number(i.price) * 100) * cart[i.item_id],
    0
  );

  function isOrderable(item: FoodItem) {
    return Number(item.is_available) === 1 && item.quantity_available > 0;
  }

  function setQuantity(item: FoodItem, quantity: number) {
    const clamped = Math.max(0, Math.min(quantity, item.quantity_available));
    setCart((current) => {
      const next = { ...current };
      if (clamped === 0) {
        delete next[item.item_id];
      } else {
        next[item.item_id] = clamped;
      }
      return next;
    });
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/student/login");
  }

  async function placeOrder() {
    setError("");
    setSuccess("");

    if (pendingOrderId === null) {
      if (cartLines.length === 0) {
        setError("Your cart is empty. Add at least one item.");
        return;
      }
      if (!slotId) {
        setError("Please choose a pickup slot.");
        return;
      }
    }

    setPlacing(true);

    try {
      let orderId = pendingOrderId;

      // Step 1: create the order (skipped when only payment is being retried).
      if (orderId === null) {
        const orderRes = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slot_id: Number(slotId),
            items: cartLines.map((i) => ({
              item_id: i.item_id,
              quantity: cart[i.item_id],
            })),
          }),
        });
        const orderData = await orderRes.json();

        if (!orderRes.ok) {
          let message = orderData.error || "Could not place the order.";
          if (orderData.available !== undefined) {
            message += ` (available: ${orderData.available}, requested: ${orderData.requested})`;
          }
          setError(message);
          await loadData(); // refresh stock and slot availability
          return;
        }

        orderId = Number(orderData.order_id);
        setPendingOrderId(orderId);
      }

      // Step 2: record the (simulated) payment.
      const payRes = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, payment_mode: paymentMode }),
      });
      const payData = await payRes.json();

      const alreadyPaid =
        payRes.status === 409 &&
        String(payData.error || "").includes("already exists");

      if (!payRes.ok && !alreadyPaid) {
        setError(
          `Order #${orderId} was created, but payment failed: ${
            payData.error || "unknown error"
          }. Press the button again to retry the payment.`
        );
        return;
      }

      setSuccess(
        `Order #${orderId} placed successfully. Payment mode: ${paymentMode}. Status: Confirmed.`
      );
      setCart({});
      setSlotId("");
      setPendingOrderId(null);
      await loadData();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-600">
        {error || "Loading..."}
      </div>
    );
  }

  const selectClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
            QuickBite Canteen
          </p>
          <h1 className="text-lg font-bold">Hello, {user.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/student/orders"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-700"
          >
            Order history
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-4 flex flex-wrap gap-2">
            {categories.map((name) => (
              <button
                key={name}
                onClick={() => setCategory(name)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  category === name
                    ? "bg-emerald-700 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-300"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {visibleItems.map((item) => {
              const inCart = cart[item.item_id] ?? 0;
              const orderable = isOrderable(item);
              const atLimit = inCart >= item.quantity_available;

              return (
                <div
                  key={item.item_id}
                  className="flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{item.name}</h2>
                    <span className="font-bold text-emerald-700">
                      ₹{Number(item.price).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{item.category_name}</p>
                  <p className="mt-2 flex-1 text-sm text-slate-600">
                    {item.description || "No description available."}
                  </p>
                  <p
                    className={`mt-2 text-xs font-medium ${
                      orderable ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {orderable
                      ? `${item.quantity_available} in stock`
                      : "Currently unavailable"}
                  </p>
                  <button
                    onClick={() => setQuantity(item, inCart + 1)}
                    disabled={!orderable || atLimit || locked}
                    className="mt-3 rounded-xl bg-emerald-700 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {!orderable
                      ? "Unavailable"
                      : atLimit
                        ? "Maximum stock added"
                        : "Add to cart"}
                  </button>
                </div>
              );
            })}
            {visibleItems.length === 0 && (
              <p className="text-sm text-slate-500">No items in this category.</p>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold">Your cart</h2>

          {cartLines.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Your cart is empty.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {cartLines.map((item) => (
                <li key={item.item_id} className="text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{item.name}</span>
                    <span>
                      ₹{((Math.round(Number(item.price) * 100) * cart[item.item_id]) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <button
                      onClick={() => setQuantity(item, cart[item.item_id] - 1)}
                      disabled={locked}
                      className="h-7 w-7 rounded-lg ring-1 ring-slate-300 disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-6 text-center">{cart[item.item_id]}</span>
                    <button
                      onClick={() => setQuantity(item, cart[item.item_id] + 1)}
                      disabled={locked || cart[item.item_id] >= item.quantity_available}
                      className="h-7 w-7 rounded-lg ring-1 ring-slate-300 disabled:opacity-40"
                    >
                      +
                    </button>
                    <button
                      onClick={() => setQuantity(item, 0)}
                      disabled={locked}
                      className="ml-auto text-xs text-red-600 hover:underline disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 font-bold">
            <span>Total</span>
            <span>₹{(totalCents / 100).toFixed(2)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            The final total is calculated by the server when you place the order.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Pickup slot
              </label>
              <select
                className={selectClass}
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                disabled={locked}
              >
                <option value="">Select a slot</option>
                {slots.map((slot) => (
                  <option
                    key={slot.slot_id}
                    value={slot.slot_id}
                    disabled={slot.is_full}
                  >
                    {slot.slot_time} —{" "}
                    {slot.is_full ? "Full" : `${slot.remaining} spots left`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Payment mode (simulated)
              </label>
              <select
                className={selectClass}
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {locked && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Order #{pendingOrderId} is waiting for payment. Press the button
              to retry the payment.
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {success && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {success}
            </p>
          )}

          <button
            onClick={placeOrder}
            disabled={placing}
            className="mt-4 w-full rounded-xl bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {placing
              ? "Please wait..."
              : locked
                ? "Retry payment"
                : "Place order & pay"}
          </button>
        </aside>
      </main>
    </div>
  );
}