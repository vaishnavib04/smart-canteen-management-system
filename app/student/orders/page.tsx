"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type OrderItem = {
  item_id: number;
  name: string;
  quantity: number;
  price_at_order: string;
};

type Order = {
  order_id: number;
  order_date: string;
  status: string;
  total_amount: string;
  slot_id: number | null;
  items: OrderItem[];
};

type Payment = {
  payment_id: number;
  order_id: number;
  amount: string;
  payment_mode: string;
  payment_status: string;
};

type Slot = { slot_id: number; slot_time: string };

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Confirmed: "bg-blue-100 text-blue-800",
  Preparing: "bg-purple-100 text-purple-800",
  Ready: "bg-emerald-100 text-emerald-800",
  Completed: "bg-slate-200 text-slate-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default function StudentOrdersPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok) {
          router.push("/student/login");
          return;
        }
        setName((await me.json()).user.name);

        const [orderRes, payRes, slotRes] = await Promise.all([
          fetch("/api/orders"),
          fetch("/api/payments"),
          fetch("/api/pickup-slots"),
        ]);

        if (!orderRes.ok || !payRes.ok || !slotRes.ok) {
          setError("Could not load your orders. Please refresh the page.");
          return;
        }

        setOrders((await orderRes.json()).orders);
        setPayments((await payRes.json()).payments);
        setSlots((await slotRes.json()).slots);
        setLoaded(true);
      } catch {
        setError("Could not reach the server. Please try again.");
      }
    }
    load();
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/student/login");
  }

  function slotTime(slotId: number | null) {
    if (slotId === null) return "No slot";
    return slots.find((s) => s.slot_id === slotId)?.slot_time ?? "Unknown";
  }

  function paymentFor(orderId: number) {
    return payments.find((p) => p.order_id === orderId);
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-600">
        {error || "Loading..."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
            QuickBite Canteen
          </p>
          <h1 className="text-lg font-bold">{name}&apos;s orders</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/student"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-700"
          >
            Back to menu
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-6">
        {orders.length === 0 && (
          <p className="text-sm text-slate-500">
            You haven&apos;t placed any orders yet.
          </p>
        )}

        {orders.map((order) => {
          const payment = paymentFor(order.order_id);

          return (
            <div
              key={order.order_id}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-bold">Order #{order.order_id}</h2>
                  <p className="text-xs text-slate-500">
                    {new Date(order.order_date).toLocaleString("en-IN")}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    STATUS_STYLES[order.status] ?? "bg-slate-100 text-slate-700"
                  }`}
                >
                  {order.status}
                </span>
              </div>

              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {order.items.map((item) => (
                  <li
                    key={item.item_id}
                    className="flex justify-between py-1.5"
                  >
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <span>
                      ₹
                      {(
                        (Math.round(Number(item.price_at_order) * 100) *
                          item.quantity) /
                        100
                      ).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-3 text-sm">
                <div className="text-slate-600">
                  <p>Pickup: {slotTime(order.slot_id)}</p>
                  <p>
                    Payment:{" "}
                    {payment
                      ? `${payment.payment_mode} (${payment.payment_status})`
                      : "Not paid yet"}
                  </p>
                </div>
                <p className="text-base font-bold">
                  Total ₹{Number(order.total_amount).toFixed(2)}
                </p>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}