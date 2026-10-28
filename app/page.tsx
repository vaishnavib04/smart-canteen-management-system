"use client";

import { useEffect, useState } from "react";

type Category = {
  category_id: number;
  name: string;
  category_name?: string;
};

type FoodItem = {
  item_id: number;
  name: string;
  price: number;
  category_name?: string;
  category_id?: number;
  is_available?: number | boolean;
};

type InventoryItem = {
  inventory_id: number;
  item_id: number;
  name: string;
  quantity_available: number;
  reorder_level: number;
  is_available: number | boolean;
  low_stock: number | boolean;
};

type OrderItem = {
  item_id: number;
  name: string;
  quantity: number;
  price_at_order: string | number;
};

type Order = {
  order_id: number;
  order_date: string;
  status: string;
  total_amount: string | number;
  user_id: number;
  user_name: string;
  slot_id: number;
  items: OrderItem[];
};

type SalesSummary = {
  summary: {
    total_orders: number;
    successful_payments: number;
    total_sales: number;
  };
  orders_by_status: { status: string; order_count: number }[];
  daily_sales: {
    sale_date: string;
    order_count: number;
    total_sales: number;
  }[];
  sales_by_payment_mode: {
    payment_mode: string;
    payment_count: number;
    total_amount: number;
  }[];
};

type DashboardData = {
  categories: Category[];
  foodItems: FoodItem[];
  inventory: InventoryItem[];
};

const navigation = [
  { label: "Overview", icon: "◫", href: "#overview" },
  { label: "Food Items", icon: "▤", href: "#food-items" },
  { label: "Categories", icon: "▦", href: "#categories" },
  { label: "Inventory", icon: "▥", href: "#inventory" },
  { label: "Orders", icon: "↗", href: "#orders" },
  { label: "Sales Reports", icon: "▥", href: "#sales" },
];

export default function Home() {
  const [data, setData] = useState<DashboardData>({
    categories: [],
    foodItems: [],
    inventory: [],
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [ordersError, setOrdersError] = useState("");
  const [updatingOrder, setUpdatingOrder] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const [
      categoriesResponse,
      foodResponse,
      inventoryResponse,
      ordersResponse,
      salesResponse,
    ] = await Promise.all([
      fetch("/api/categories"),
      fetch("/api/food-items"),
      fetch("/api/inventory"),
      fetch("/api/orders"),
      fetch("/api/sales-summary"),
    ]);

      if (
        !categoriesResponse.ok ||
        !foodResponse.ok ||
        !inventoryResponse.ok
      ) {
        throw new Error("One or more APIs could not load.");
      }

      const [categoriesData, foodData, inventoryData] = await Promise.all([
      categoriesResponse.json(),
      foodResponse.json(),
      inventoryResponse.json(),
    ]);

    setData({
      categories: Array.isArray(categoriesData)
        ? categoriesData
        : categoriesData.categories ?? [],
      foodItems: Array.isArray(foodData)
      ? foodData
      : foodData.food_items ?? foodData.foodItems ?? foodData.items ?? [],
      inventory: Array.isArray(inventoryData.inventory)
        ? inventoryData.inventory
        : [],
    });

    if (ordersResponse.ok) {
      const ordersData = await ordersResponse.json();
      setOrders(Array.isArray(ordersData.orders) ? ordersData.orders : []);
      setOrdersError("");
    } else {
      setOrdersError("Could not load orders.");
    }

    if (salesResponse.ok) {
      setSales(await salesResponse.json());
    } else {
      setSales(null);
    }

    } catch (err) {
      console.error("Dashboard loading failed:", err);
      setError("Unable to load dashboard data. Check that the APIs are running.");
    } finally {
      setLoading(false);
    }
  }

  async function updateOrderStatus(orderId: number, status: string) {
    setUpdatingOrder(orderId);
    setOrdersError("");

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update order.");
      }

      await loadDashboard();
    } catch (err) {
      setOrdersError(
        err instanceof Error ? err.message : "Failed to update order."
      );
    } finally {
      setUpdatingOrder(null);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const lowStockItems = data.inventory.filter(
    (item) =>
      Number(item.quantity_available) <= Number(item.reorder_level)
  );

  const availableItems = data.foodItems.filter(
    (item) => item.is_available === undefined ||
      item.is_available === true ||
      Number(item.is_available) === 1
  );

  const stats = [
    {
      label: "Food Items",
      value: data.foodItems.length,
      icon: "▤",
      color: "blue",
      note: `${availableItems.length} currently available`,
    },
    {
      label: "Categories",
      value: data.categories.length,
      icon: "▦",
      color: "violet",
      note: "Organized menu groups",
    },
    {
      label: "Inventory Items",
      value: data.inventory.length,
      icon: "▥",
      color: "green",
      note: "Tracked stock records",
    },
    {
      label: "Low Stock Alerts",
      value: lowStockItems.length,
      icon: "⚠",
      color: "orange",
      note: lowStockItems.length ? "Items need attention" : "All stock levels look good",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-2xl text-white">
            ♨
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">QuickBite</h1>
            <p className="text-xs text-slate-500">Canteen Management</p>
          </div>
        </div>

        <div className="px-4 pt-7">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Workspace
          </p>

          <nav className="space-y-1">
            {navigation.map((item, index) => (
              <a
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                  index === 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="w-6 text-center text-lg">{item.icon}</span>
                {item.label}
                {item.label === "Inventory" && lowStockItems.length > 0 && (
                  <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                    {lowStockItems.length}
                  </span>
                )}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-2xl bg-slate-900 p-4 text-white">
            <p className="text-sm font-semibold">Inventory health</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              Keep track of stock levels and reorder items before they run out.
            </p>
            <a
              href="#inventory"
              className="mt-4 block rounded-lg bg-white/10 px-3 py-2 text-center text-xs font-semibold hover:bg-white/20"
            >
              View inventory →
            </a>
          </div>
          <p className="px-2 pt-4 text-xs text-slate-400">
            Smart Canteen · Project Dashboard
          </p>
        </div>
      </aside>

      <main className="min-h-screen lg:ml-64">
        <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur-md sm:px-8">
          <div>
            <p className="text-xs font-medium text-slate-400">
              WORKSPACE / OVERVIEW
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">
              Dashboard
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadDashboard}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "↻ Refresh"}
            </button>
            <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 sm:flex">
              SA
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-8 p-5 sm:p-8">
          <section
            id="overview"
            className="relative overflow-hidden rounded-3xl bg-emerald-700 p-7 text-white sm:p-9"
          >
            <div className="relative z-[1] max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">
                SMART CANTEEN MANAGEMENT
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Your canteen, at a glance.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50 sm:text-base">
                Manage your menu, monitor inventory, and keep everyday
                operations organized from one place.
              </p>
              <a
                href="#inventory"
                className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50"
              >
                Check inventory <span className="ml-2">→</span>
              </a>
            </div>
            <div className="pointer-events-none absolute -right-10 -top-24 h-80 w-80 rounded-full border-[45px] border-white/10" />
            <div className="pointer-events-none absolute -bottom-40 right-32 h-80 w-80 rounded-full border-[35px] border-white/10" />
          </section>

          {error && (
            <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
              <p>{error}</p>
              <button
                onClick={loadDashboard}
                className="self-start font-semibold underline sm:self-auto"
              >
                Try again
              </button>
            </div>
          )}

          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h3 className="text-lg font-bold">Overview</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Live counts from your canteen database
                </p>
              </div>
              <span className="text-xs text-slate-400">
                {loading ? "Loading data..." : "API connected"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/30"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      {stat.label}
                    </p>
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${
                        stat.color === "blue"
                          ? "bg-blue-50 text-blue-600"
                          : stat.color === "violet"
                            ? "bg-violet-50 text-violet-600"
                            : stat.color === "green"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-orange-50 text-orange-600"
                      }`}
                    >
                      {stat.icon}
                    </span>
                  </div>
                  <p className="mt-4 text-3xl font-bold tracking-tight">
                    {loading ? "—" : stat.value}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{stat.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section
            id="inventory"
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30"
          >
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h3 className="font-bold">Inventory overview</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Current quantities and reorder thresholds
                </p>
              </div>
              <span className="w-fit rounded-lg bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
                {lowStockItems.length} low-stock item(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Food item</th>
                    <th className="px-6 py-4 font-semibold">Available stock</th>
                    <th className="px-6 py-4 font-semibold">Reorder level</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.inventory.map((item) => {
                    const isLow =
                      Number(item.quantity_available) <=
                      Number(item.reorder_level);

                    return (
                      <tr key={item.inventory_id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-4 font-semibold text-slate-800">
                          {item.name}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-semibold">
                            {item.quantity_available}
                          </span>
                          <span className="ml-1 text-xs text-slate-400">
                            units
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {item.reorder_level} units
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isLow
                                ? "bg-orange-50 text-orange-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isLow ? "bg-orange-500" : "bg-emerald-500"
                              }`}
                            />
                            {isLow ? "Low stock" : "In stock"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {!loading && data.inventory.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 text-center text-slate-500"
                      >
                        No inventory records found.
                      </td>
                    </tr>
                  )}

                  {loading && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 text-center text-slate-400"
                      >
                        Loading inventory...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 px-6 py-3 text-xs text-slate-400">
              Low stock means available quantity is less than or equal to the reorder level.
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section
              id="food-items"
              className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30"
            >
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div>
                  <h3 className="font-bold">Food items</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Items available in your menu
                  </p>
                </div>
                <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
                  {loading ? "—" : data.foodItems.length}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {data.foodItems.slice(0, 5).map((item) => (
                  <div
                    key={item.item_id}
                    className="flex items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg">
                        🍽
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {item.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {item.category_name ?? "Menu item"}
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-bold">
                      ₹{Number(item.price).toFixed(2)}
                    </p>
                  </div>
                ))}

                {!loading && data.foodItems.length === 0 && (
                  <p className="p-6 text-sm text-slate-500">
                    No food items found.
                  </p>
                )}
              </div>
            </section>

            <section
              id="categories"
              className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30"
            >
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div>
                  <h3 className="font-bold">Categories</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Menu groups in your database
                  </p>
                </div>
                <span className="rounded-lg bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700">
                  {loading ? "—" : data.categories.length}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
                {data.categories.map((category, index) => (
                  <div
                    key={category.category_id ?? index}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/30"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-lg text-violet-600">
                      ▦
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {category.name ?? category.category_name ?? "Category"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Menu category
                      </p>
                    </div>
                  </div>
                ))}

                {!loading && data.categories.length === 0 && (
                  <p className="text-sm text-slate-500">
                    No categories found.
                  </p>
                )}
              </div>
            </section>
          </div>

          <section
            id="orders"
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h3 className="font-bold">Order management</h3>
                <p className="mt-1 text-sm text-slate-500">
                  View incoming orders and manage preparation status.
                </p>
              </div>
              <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
                {orders.length} orders
              </span>
            </div>

            {ordersError && (
              <p className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {ordersError}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Order</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Items</th>
                    <th className="px-5 py-4">Total</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Update</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => {
                    const locked =
                      order.status === "Completed" || order.status === "Cancelled";

                    return (
                      <tr key={order.order_id} className="align-top hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <p className="font-bold">#{order.order_id}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {new Date(order.order_date).toLocaleDateString()}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-semibold">{order.user_name}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            Customer ID: {order.user_id}
                          </p>
                        </td>

                        <td className="max-w-xs px-5 py-4">
                          {order.items.map((item, index) => (
                            <p key={`${item.item_id}-${index}`} className="mb-1">
                              {item.name} × {item.quantity}
                            </p>
                          ))}
                        </td>

                        <td className="px-5 py-4 font-bold">
                          ₹{Number(order.total_amount).toFixed(2)}
                        </td>

                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            {order.status}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-2">
                            <select
                              id={`status-${order.order_id}`}
                              defaultValue={order.status}
                              disabled={locked || updatingOrder === order.order_id}
                              className="rounded-lg border border-slate-200 px-2 py-2 text-xs disabled:bg-slate-100"
                            >
                              {[
                                "Pending",
                                "Confirmed",
                                "Preparing",
                                "Ready",
                                "Completed",
                                "Cancelled",
                              ].map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>

                            <button
                              disabled={locked || updatingOrder === order.order_id}
                              onClick={() => {
                                const select = document.getElementById(
                                  `status-${order.order_id}`
                                ) as HTMLSelectElement | null;

                                if (select && select.value !== order.status) {
                                  void updateOrderStatus(order.order_id, select.value);
                                }
                              }}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {updatingOrder === order.order_id
                                ? "Updating..."
                                : locked
                                  ? "Closed"
                                  : "Update status"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                        No orders to display.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            id="sales"
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 p-5">
              <h3 className="font-bold">Sales reports</h3>
              <p className="mt-1 text-sm text-slate-500">
                Sales totals, payment methods and order-status breakdown.
              </p>
            </div>

            {!sales ? (
              <p className="p-6 text-sm text-slate-500">
                Sales summary is unavailable. Try refreshing the dashboard.
              </p>
            ) : (
              <div className="space-y-6 p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-700">Total sales</p>
                    <p className="mt-2 text-2xl font-bold text-emerald-800">
                      ₹{sales.summary.total_sales.toFixed(2)}
                    </p>
                  </div>

                  <div className="rounded-xl bg-blue-50 p-4">
                    <p className="text-sm text-blue-700">Total orders</p>
                    <p className="mt-2 text-2xl font-bold text-blue-800">
                      {sales.summary.total_orders}
                    </p>
                  </div>

                  <div className="rounded-xl bg-violet-50 p-4">
                    <p className="text-sm text-violet-700">Successful payments</p>
                    <p className="mt-2 text-2xl font-bold text-violet-800">
                      {sales.summary.successful_payments}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <h4 className="mb-3 font-semibold">Orders by status</h4>
                    <div className="space-y-3">
                      {sales.orders_by_status.map((item) => (
                        <div
                          key={item.status}
                          className="flex items-center justify-between rounded-lg bg-slate-50 p-3"
                        >
                          <span className="text-sm">{item.status}</span>
                          <span className="font-bold">{item.order_count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 font-semibold">Sales by payment mode</h4>
                    <div className="space-y-3">
                      {sales.sales_by_payment_mode.map((item) => (
                        <div
                          key={item.payment_mode}
                          className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"
                        >
                          <div>
                            <p className="text-sm font-semibold">{item.payment_mode}</p>
                            <p className="text-xs text-slate-400">
                              {item.payment_count} payment(s)
                            </p>
                          </div>
                          <span className="font-bold">
                            ₹{item.total_amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 font-semibold">Daily sales</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[400px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Orders</th>
                          <th className="px-4 py-3">Sales</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sales.daily_sales.map((item) => (
                          <tr key={item.sale_date}>
                            <td className="px-4 py-3">{item.sale_date}</td>
                            <td className="px-4 py-3">{item.order_count}</td>
                            <td className="px-4 py-3 font-semibold">
                              ₹{item.total_sales.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        {sales.daily_sales.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                              No sales recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </section>
          

          <footer className="flex flex-col gap-2 border-t border-slate-200 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>Smart Canteen Pre-Order & Inventory Management System</p>
            <p>Dashboard · Development version</p>
          </footer>
        </div>
      </main>
    </div>
  );
}