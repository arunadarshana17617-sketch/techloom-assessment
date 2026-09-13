import { useState, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import client from "./api/client";
import AdminPage from "./AdminPage";

const STATUS_STYLES = {
  Pending: "bg-gray-100 text-gray-700",
  Reserved: "bg-amber-100 text-amber-800",
  Paid: "bg-emerald-100 text-emerald-800",
  Cancelled: "bg-gray-200 text-gray-700",
  Expired: "bg-orange-100 text-orange-800",
  Failed: "bg-red-100 text-red-700",
  Refunded: "bg-violet-100 text-violet-800",
};

function formatMoney(n) {
  return `$${Number(n).toFixed(2)}`;
}

function generateKey() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `key-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ProductImage({ product, className }) {
  const [failed, setFailed] = useState(false);

  if (!product.imageUrl || failed) {
    return (
      <div
        className={`${className} bg-bg border border-border flex items-center justify-center text-ink/30`}
      >
        <span className="font-display text-2xl">{product.name?.charAt(0).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <img
      src={product.imageUrl}
      alt={product.name}
      onError={() => setFailed(true)}
      className={`${className} object-cover`}
    />
  );
}

function StoreApp() {
  const [view, setView] = useState("shop"); // 'shop' | 'history'

  // Product discovery state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Product details modal
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Cart
  const [cart, setCart] = useState([]); // [{ productId, name, price, quantity, availableStock }]
  const [cartOpen, setCartOpen] = useState(false);

  // Checkout / active order
  const [customerName, setCustomerName] = useState("Guest");
  const [checkoutKey, setCheckoutKey] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [payingOutcome, setPayingOutcome] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Order history
  const [historyName, setHistoryName] = useState("");
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [actionError, setActionError] = useState("");

  // Tick every second while a reservation is active, to show the countdown
  useEffect(() => {
    if (!currentOrder || currentOrder.status !== "Reserved") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [currentOrder]);

  async function fetchCategories() {
    try {
      const res = await client.get("/products/meta/categories");
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchProducts() {
    setLoadingProducts(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (inStockOnly) params.inStock = "true";

      const res = await client.get("/products", { params });
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchProducts, 300); // debounce search typing
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, minPrice, maxPrice, inStockOnly]);

  function addToCart(product, quantity = 1) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product._id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product._id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          price: product.price,
          quantity,
          availableStock: product.availableStock,
        },
      ];
    });
    setCartOpen(true);
  }

  function updateCartQuantity(productId, quantity) {
    if (quantity < 1) return;
    setCart((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  const cartTotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [cart]
  );
  const cartCount = useMemo(
    () => cart.reduce((sum, i) => sum + i.quantity, 0),
    [cart]
  );

  async function handleCheckout() {
    if (cart.length === 0) return;
    setCheckingOut(true);
    setCheckoutError("");
    const key = checkoutKey || generateKey();
    setCheckoutKey(key);
    try {
      const res = await client.post("/orders/checkout", {
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        idempotencyKey: key,
        customerName: customerName || "Guest",
      });
      setCurrentOrder(res.data);
      setCart([]);
      fetchProducts();
    } catch (err) {
      setCheckoutError(err.response?.data?.error || "Checkout failed. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  }

  async function handlePay(outcome) {
    if (!currentOrder) return;
    setPayingOutcome(outcome);
    setCheckoutError("");
    try {
      const res = await client.post(`/orders/${currentOrder._id}/pay`, {
        outcome,
        paymentAttemptId: generateKey(),
      });
      setCurrentOrder(res.data);
      fetchProducts();
    } catch (err) {
      setCheckoutError(err.response?.data?.error || "Payment could not be processed.");
    } finally {
      setPayingOutcome(null);
    }
  }

  async function handleCancelCurrentOrder() {
    if (!currentOrder) return;
    try {
      const res = await client.post(`/orders/${currentOrder._id}/cancel`);
      setCurrentOrder(res.data);
      fetchProducts();
    } catch (err) {
      setCheckoutError(err.response?.data?.error || "Could not cancel the order.");
    }
  }

  function startNewOrder() {
    setCurrentOrder(null);
    setCheckoutKey(null);
    setCheckoutError("");
  }

  async function fetchOrders() {
    setLoadingOrders(true);
    setActionError("");
    try {
      const params = {};
      if (historyName) params.customerName = historyName;
      const res = await client.get("/orders", { params });
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    if (view === "history") fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function handleCancelOrder(orderId) {
    setActionError("");
    try {
      await client.post(`/orders/${orderId}/cancel`);
      fetchOrders();
    } catch (err) {
      setActionError(err.response?.data?.error || "Could not cancel this order.");
    }
  }

  async function handleRefundOrder(orderId) {
    setActionError("");
    try {
      await client.post(`/orders/${orderId}/refund`, { reason: "Customer requested refund" });
      fetchOrders();
    } catch (err) {
      setActionError(err.response?.data?.error || "Could not refund this order.");
    }
  }

  const secondsLeft = currentOrder?.expiresAt
    ? Math.max(0, Math.floor((new Date(currentOrder.expiresAt).getTime() - now) / 1000))
    : 0;

  return (
    <div className="min-h-screen bg-bg text-ink font-body">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <h1 className="font-display text-xl font-semibold text-primary-dark whitespace-nowrap">
            Techloom Store
          </h1>

          <nav className="hidden sm:flex items-center gap-1 ml-2">
            <button
              onClick={() => setView("shop")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                view === "shop" ? "bg-primary text-white" : "text-ink/70 hover:bg-bg"
              }`}
            >
              Shop
            </button>
            <button
              onClick={() => setView("history")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                view === "history" ? "bg-primary text-white" : "text-ink/70 hover:bg-bg"
              }`}
            >
              Order History
            </button>
          </nav>

          {view === "shop" && (
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          )}

          <button
            onClick={() => setCartOpen(true)}
            className="relative ml-auto shrink-0 border border-border rounded-md px-3 py-1.5 text-sm font-medium hover:bg-bg transition"
          >
            Cart
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-accent text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* mobile nav */}
        <div className="sm:hidden flex border-t border-border">
          <button
            onClick={() => setView("shop")}
            className={`flex-1 py-2 text-sm font-medium ${
              view === "shop" ? "text-primary border-b-2 border-primary" : "text-ink/60"
            }`}
          >
            Shop
          </button>
          <button
            onClick={() => setView("history")}
            className={`flex-1 py-2 text-sm font-medium ${
              view === "history" ? "text-primary border-b-2 border-primary" : "text-ink/60"
            }`}
          >
            Order History
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {view === "shop" ? (
          <ShopView
            products={products}
            categories={categories}
            loading={loadingProducts}
            category={category}
            setCategory={setCategory}
            minPrice={minPrice}
            setMinPrice={setMinPrice}
            maxPrice={maxPrice}
            setMaxPrice={setMaxPrice}
            inStockOnly={inStockOnly}
            setInStockOnly={setInStockOnly}
            onViewDetails={setSelectedProduct}
            onAddToCart={(p) => addToCart(p, 1)}
          />
        ) : (
          <HistoryView
            historyName={historyName}
            setHistoryName={setHistoryName}
            onSearch={fetchOrders}
            orders={orders}
            loading={loadingOrders}
            actionError={actionError}
            onCancel={handleCancelOrder}
            onRefund={handleRefundOrder}
            secondsLeftFor={(o) =>
              Math.max(0, Math.floor((new Date(o.expiresAt).getTime() - Date.now()) / 1000))
            }
          />
        )}
      </main>

      {/* Product details modal */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(qty) => {
            addToCart(selectedProduct, qty);
            setSelectedProduct(null);
          }}
        />
      )}

      {/* Cart / checkout drawer */}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          cartTotal={cartTotal}
          onClose={() => setCartOpen(false)}
          onUpdateQuantity={updateCartQuantity}
          onRemove={removeFromCart}
          customerName={customerName}
          setCustomerName={setCustomerName}
          currentOrder={currentOrder}
          checkoutError={checkoutError}
          checkingOut={checkingOut}
          payingOutcome={payingOutcome}
          secondsLeft={secondsLeft}
          onCheckout={handleCheckout}
          onPay={handlePay}
          onCancelCurrentOrder={handleCancelCurrentOrder}
          onStartNewOrder={startNewOrder}
        />
      )}
    </div>
  );
}

function ShopView({
  products,
  categories,
  loading,
  category,
  setCategory,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  inStockOnly,
  setInStockOnly,
  onViewDetails,
  onAddToCart,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
      {/* Filters */}
      <aside className="bg-surface border border-border rounded-lg p-4 h-fit space-y-4">
        <h2 className="font-display font-semibold text-sm text-ink/80">Filter</h2>

        <div>
          <label className="text-xs font-medium text-ink/60 block mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-border rounded-md px-2 py-1.5 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-ink/60 block mb-1">Price range</label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-1/2 border border-border rounded-md px-2 py-1.5 text-sm"
            />
            <input
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-1/2 border border-border rounded-md px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="rounded border-border"
          />
          In stock only
        </label>
      </aside>

      {/* Product grid */}
      <div>
        {loading ? (
          <p className="text-sm text-ink/50">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-ink/50">No products match your filters.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <div
                key={p._id}
                className="bg-surface border border-border rounded-lg p-4 flex flex-col"
              >
                <ProductImage product={p} className="w-full h-32 rounded-md mb-3" />
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-semibold text-sm leading-snug">{p.name}</h3>
                  <span className="text-[11px] bg-bg border border-border rounded-full px-2 py-0.5 text-ink/60 shrink-0">
                    {p.category}
                  </span>
                </div>
                <p className="text-xs text-ink/50 mt-1 line-clamp-2">{p.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-display font-semibold">{formatMoney(p.price)}</span>
                  <span className={`text-xs ${p.availableStock > 0 ? "text-success" : "text-danger"}`}>
                    {p.availableStock > 0 ? `${p.availableStock} in stock` : "Out of stock"}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onViewDetails(p)}
                    className="flex-1 border border-border rounded-md py-1.5 text-sm hover:bg-bg transition"
                  >
                    View
                  </button>
                  <button
                    onClick={() => onAddToCart(p)}
                    disabled={p.availableStock <= 0}
                    className="flex-1 bg-primary text-white rounded-md py-1.5 text-sm hover:bg-primary-dark transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add to cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductDetailsModal({ product, onClose, onAddToCart }) {
  const [qty, setQty] = useState(1);

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-surface rounded-lg max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-ink/40 hover:text-ink"
          aria-label="Close"
        >
          ✕
        </button>
        <ProductImage product={product} className="w-full h-40 rounded-md mb-3" />
        <span className="text-[11px] bg-bg border border-border rounded-full px-2 py-0.5 text-ink/60">
          {product.category}
        </span>
        <h2 className="font-display text-lg font-semibold mt-2">{product.name}</h2>
        <p className="text-sm text-ink/60 mt-2">{product.description}</p>

        <div className="mt-4 flex items-center justify-between">
          <span className="font-display text-xl font-semibold">{formatMoney(product.price)}</span>
          <span className={`text-sm ${product.availableStock > 0 ? "text-success" : "text-danger"}`}>
            {product.availableStock > 0 ? `${product.availableStock} available` : "Out of stock"}
          </span>
        </div>

        {product.availableStock > 0 && (
          <>
            <div className="mt-4 flex items-center gap-3">
              <label className="text-sm text-ink/60">Quantity</label>
              <input
                type="number"
                min={1}
                max={product.availableStock}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                className="w-20 border border-border rounded-md px-2 py-1 text-sm"
              />
            </div>
            <button
              onClick={() => onAddToCart(qty)}
              className="mt-4 w-full bg-primary text-white rounded-md py-2 text-sm font-medium hover:bg-primary-dark transition"
            >
              Add to cart
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CartDrawer({
  cart,
  cartTotal,
  onClose,
  onUpdateQuantity,
  onRemove,
  customerName,
  setCustomerName,
  currentOrder,
  checkoutError,
  checkingOut,
  payingOutcome,
  secondsLeft,
  onCheckout,
  onPay,
  onCancelCurrentOrder,
  onStartNewOrder,
}) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-surface w-full max-w-md h-full p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">
            {currentOrder ? "Your order" : "Your cart"}
          </h2>
          <button onClick={onClose} className="text-ink/40 hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>

        {!currentOrder ? (
          <>
            {cart.length === 0 ? (
              <p className="text-sm text-ink/50">Your cart is empty.</p>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.productId} className="flex items-center gap-3 border-b border-border pb-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-ink/50">{formatMoney(item.price)} each</p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => onUpdateQuantity(item.productId, Number(e.target.value))}
                      className="w-14 border border-border rounded-md px-2 py-1 text-sm text-center"
                    />
                    <button
                      onClick={() => onRemove(item.productId)}
                      className="text-danger text-xs hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <div className="pt-2">
                  <label className="text-xs font-medium text-ink/60 block mb-1">Your name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Guest"
                    className="w-full border border-border rounded-md px-2 py-1.5 text-sm"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 font-display font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(cartTotal)}</span>
                </div>

                {checkoutError && <p className="text-sm text-danger">{checkoutError}</p>}

                <button
                  onClick={onCheckout}
                  disabled={checkingOut}
                  className="w-full bg-primary text-white rounded-md py-2 text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50"
                >
                  {checkingOut ? "Reserving stock..." : "Checkout"}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[currentOrder.status]}`}>
                {currentOrder.status}
              </span>
              {currentOrder.status === "Reserved" && (
                <span className="text-xs text-ink/50">
                  Reservation expires in {mins}:{secs.toString().padStart(2, "0")}
                </span>
              )}
            </div>

            <div className="space-y-2 border-b border-border pb-3">
              {currentOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>
                    {item.product?.name || "Item"} × {item.quantity}
                  </span>
                  <span>{formatMoney(item.priceAtOrder * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-display font-semibold">
              <span>Total</span>
              <span>{formatMoney(currentOrder.totalAmount)}</span>
            </div>

            {checkoutError && <p className="text-sm text-danger">{checkoutError}</p>}

            {currentOrder.status === "Reserved" && secondsLeft > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-ink/50">Simulate the payment outcome:</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => onPay("success")}
                    disabled={!!payingOutcome}
                    className="bg-success text-white rounded-md py-2 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {payingOutcome === "success" ? "..." : "Success"}
                  </button>
                  <button
                    onClick={() => onPay("failure")}
                    disabled={!!payingOutcome}
                    className="bg-danger text-white rounded-md py-2 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {payingOutcome === "failure" ? "..." : "Fail"}
                  </button>
                  <button
                    onClick={() => onPay("timeout")}
                    disabled={!!payingOutcome}
                    className="bg-accent text-white rounded-md py-2 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {payingOutcome === "timeout" ? "..." : "Timeout"}
                  </button>
                </div>
                <button
                  onClick={onCancelCurrentOrder}
                  className="w-full border border-border rounded-md py-2 text-sm hover:bg-bg transition"
                >
                  Cancel order
                </button>
              </div>
            )}

            {currentOrder.status === "Reserved" && secondsLeft <= 0 && (
              <p className="text-sm text-ink/50">
                This reservation has expired. Refresh to see the updated status.
              </p>
            )}

            {currentOrder.status !== "Reserved" && (
              <button
                onClick={onStartNewOrder}
                className="w-full bg-primary text-white rounded-md py-2 text-sm font-medium hover:bg-primary-dark transition"
              >
                Start a new order
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryView({
  historyName,
  setHistoryName,
  onSearch,
  orders,
  loading,
  actionError,
  onCancel,
  onRefund,
  secondsLeftFor,
}) {
  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Filter by customer name (optional)"
          value={historyName}
          onChange={(e) => setHistoryName(e.target.value)}
          className="flex-1 border border-border rounded-md px-3 py-1.5 text-sm"
        />
        <button
          onClick={onSearch}
          className="bg-primary text-white rounded-md px-4 py-1.5 text-sm font-medium hover:bg-primary-dark transition"
        >
          Search
        </button>
      </div>

      {actionError && <p className="text-sm text-danger mb-3">{actionError}</p>}

      {loading ? (
        <p className="text-sm text-ink/50">Loading orders...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-ink/50">No orders found.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const canCancel = ["Reserved", "Paid"].includes(o.status);
            const canRefund =
              !o.refund?.isRefunded && ["Cancelled", "Failed", "Paid"].includes(o.status);
            return (
              <div key={o._id} className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{o.customerName}</p>
                    <p className="text-xs text-ink/50">
                      {new Date(o.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[o.status]}`}>
                    {o.status}
                  </span>
                </div>

                <div className="mt-3 space-y-1 border-t border-border pt-3">
                  {o.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>
                        {item.product?.name || "Item"} × {item.quantity}
                      </span>
                      <span>{formatMoney(item.priceAtOrder * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between font-display font-semibold mt-2">
                  <span>Total</span>
                  <span>{formatMoney(o.totalAmount)}</span>
                </div>

                {o.refund?.isRefunded && (
                  <p className="text-xs text-violet-700 mt-2">
                    Refunded {formatMoney(o.refund.refundedAmount)} — {o.refund.reason}
                  </p>
                )}

                {o.status === "Reserved" && secondsLeftFor(o) > 0 && (
                  <p className="text-xs text-ink/50 mt-2">
                    Reservation expires in {Math.floor(secondsLeftFor(o) / 60)}:
                    {(secondsLeftFor(o) % 60).toString().padStart(2, "0")}
                  </p>
                )}

                {(canCancel || canRefund) && (
                  <div className="flex gap-2 mt-3">
                    {canCancel && (
                      <button
                        onClick={() => onCancel(o._id)}
                        className="flex-1 border border-border rounded-md py-1.5 text-sm hover:bg-bg transition"
                      >
                        Cancel
                      </button>
                    )}
                    {canRefund && (
                      <button
                        onClick={() => onRefund(o._id)}
                        className="flex-1 border border-border rounded-md py-1.5 text-sm hover:bg-bg transition"
                      >
                        Refund
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StoreApp />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}