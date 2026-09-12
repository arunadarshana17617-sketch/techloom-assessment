import { useState, useEffect } from "react";
import api from "./api";
import "./index.css";

function App() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cart, setCart] = useState([]);
  const [order, setOrder] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", stock: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", price: "", stock: "" });
  const [tab, setTab] = useState("shop");

  useEffect(() => {
    fetchProducts();
    fetchOrders();
  }, []);

  function notify(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  async function fetchProducts() {
    const res = await api.get("/products");
    setProducts(res.data);
  }

  async function fetchOrders() {
    const res = await api.get("/orders");
    setOrders(res.data);
  }

  async function addProduct(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/products", {
        name: newProduct.name,
        price: Number(newProduct.price),
        stock: Number(newProduct.stock),
      });
      setNewProduct({ name: "", price: "", stock: "" });
      notify("success", "Product added successfully");
      fetchProducts();
    } catch (err) {
      notify("error", err.response?.data?.error || "Failed to add product");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(p) {
    setEditingId(p._id);
    setEditForm({ name: p.name, price: p.price, stock: p.stock });
  }

  async function saveEdit(id) {
    try {
      await api.put(`/products/${id}`, {
        name: editForm.name,
        price: Number(editForm.price),
        stock: Number(editForm.stock),
      });
      setEditingId(null);
      notify("success", "Product updated");
      fetchProducts();
    } catch (err) {
      notify("error", err.response?.data?.error || "Failed to update product");
    }
  }

  async function deleteProduct(id) {
    try {
      await api.delete(`/products/${id}`);
      notify("success", "Product deleted");
      fetchProducts();
    } catch (err) {
      notify("error", err.response?.data?.error || "Failed to delete product");
    }
  }

  function addToCart(product) {
    const existing = cart.find((c) => c.productId === product._id);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.productId === product._id ? { ...c, quantity: c.quantity + 1 } : c
        )
      );
    } else {
      setCart([
        ...cart,
        { productId: product._id, name: product.name, price: product.price, quantity: 1 },
      ]);
    }
  }

  function removeFromCart(productId) {
    setCart(cart.filter((c) => c.productId !== productId));
  }

  async function checkout() {
    setLoading(true);
    try {
      const items = cart.map((c) => ({ productId: c.productId, quantity: c.quantity }));
      const idempotencyKey = `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await api.post("/orders/checkout", { items, idempotencyKey });
      setOrder(res.data);
      setCart([]);
      notify("success", "Order reserved! Complete payment within 5 minutes.");
      fetchProducts();
      fetchOrders();
    } catch (err) {
      notify("error", err.response?.data?.error || "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  async function pay(outcome) {
    setLoading(true);
    try {
      const res = await api.post(`/orders/${order._id}/pay`, { outcome });
      const updatedOrder = res.data.order || res.data;
      setOrder(updatedOrder);
      notify(
        outcome === "success" ? "success" : outcome === "fail" ? "error" : "success",
        outcome === "timeout"
          ? "Payment timed out — reservation will expire automatically"
          : `Payment ${outcome}: order is now ${updatedOrder.status}`
      );
      fetchProducts();
      fetchOrders();
    } catch (err) {
      notify("error", err.response?.data?.error || "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  async function cancelOrder() {
    setLoading(true);
    try {
      const res = await api.post(`/orders/${order._id}/cancel`);
      setOrder(res.data);
      notify("success", "Order cancelled, stock restored");
      fetchProducts();
      fetchOrders();
    } catch (err) {
      notify("error", err.response?.data?.error || "Cancel failed");
    } finally {
      setLoading(false);
    }
  }

  const statusColors = {
    Pending: "bg-gray-200 text-gray-700",
    Reserved: "bg-yellow-100 text-yellow-800",
    Paid: "bg-green-100 text-green-800",
    Cancelled: "bg-gray-200 text-gray-600",
    Expired: "bg-orange-100 text-orange-800",
    Failed: "bg-red-100 text-red-800",
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white px-6 py-4 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">🛒 POS Order & Inventory System</h1>
          <nav className="flex gap-2">
            <button
              onClick={() => setTab("shop")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === "shop" ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
              }`}
            >
              Shop
            </button>
            <button
              onClick={() => setTab("orders")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === "orders" ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
              }`}
            >
              Order History
            </button>
          </nav>
        </div>
      </header>

      {message && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            message.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {message.text}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 py-8">
        {tab === "shop" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h2 className="text-lg font-semibold text-slate-800 mb-3">Add New Product</h2>
                <form onSubmit={addProduct} className="flex flex-wrap gap-3">
                  <input
                    placeholder="Product name"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="flex-1 min-w-[150px] border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                    required
                  />
                  <input
                    placeholder="Price"
                    type="number"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    className="w-28 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                    required
                  />
                  <input
                    placeholder="Stock"
                    type="number"
                    value={newProduct.stock}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                    className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    Add Product
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Inventory</h2>
                <div className="space-y-3">
                  {products.length === 0 && (
                    <p className="text-slate-400 text-sm">No products yet — add one above.</p>
                  )}
                  {products.map((p) => (
                    <div
                      key={p._id}
                      className="flex items-center justify-between border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition"
                    >
                      {editingId === p._id ? (
                        <div className="flex flex-1 gap-2 items-center flex-wrap">
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="border border-slate-300 rounded px-2 py-1 text-sm w-32"
                          />
                          <input
                            type="number"
                            value={editForm.price}
                            onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                            className="border border-slate-300 rounded px-2 py-1 text-sm w-20"
                          />
                          <input
                            type="number"
                            value={editForm.stock}
                            onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                            className="border border-slate-300 rounded px-2 py-1 text-sm w-20"
                          />
                          <button
                            onClick={() => saveEdit(p._id)}
                            className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-md hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="bg-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-md hover:bg-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="font-medium text-slate-800">{p.name}</p>
                            <p className="text-sm text-slate-500">
                              Rs. {p.price.toFixed(2)} &middot;{" "}
                              <span className={p.stock === 0 ? "text-red-500 font-medium" : ""}>
                                {p.stock === 0 ? "Out of stock" : `${p.stock} in stock`}
                              </span>
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => addToCart(p)}
                              disabled={p.stock === 0}
                              className="bg-slate-900 text-white text-xs px-3 py-1.5 rounded-md hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Add to Cart
                            </button>
                            <button
                              onClick={() => startEdit(p)}
                              className="bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-md hover:bg-blue-100"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteProduct(p._id)}
                              className="bg-red-50 text-red-600 text-xs px-3 py-1.5 rounded-md hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Cart</h2>
                {cart.length === 0 ? (
                  <p className="text-slate-400 text-sm">Your cart is empty.</p>
                ) : (
                  <div className="space-y-2">
                    {cart.map((c) => (
                      <div key={c.productId} className="flex justify-between items-center text-sm">
                        <span className="text-slate-700">
                          {c.name} <span className="text-slate-400">x{c.quantity}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600">Rs. {(c.price * c.quantity).toFixed(2)}</span>
                          <button
                            onClick={() => removeFromCart(c.productId)}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-semibold text-slate-800">
                      <span>Total</span>
                      <span>Rs. {cartTotal.toFixed(2)}</span>
                    </div>
                    <button
                      onClick={checkout}
                      disabled={loading}
                      className="w-full mt-3 bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                      {loading ? "Processing..." : "Checkout"}
                    </button>
                  </div>
                )}
              </div>

              {order && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-semibold text-slate-800">Current Order</h2>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[order.status]}`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mb-1">Order ID: {order._id.slice(-8)}</p>
                  <p className="text-sm text-slate-700 mb-4">
                    Total: <span className="font-semibold">Rs. {order.totalAmount.toFixed(2)}</span>
                  </p>

                  {order.status === "Reserved" && (
                    <>
                      <p className="text-xs text-slate-400 mb-3">
                        Simulate a payment gateway outcome:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => pay("success")}
                          disabled={loading}
                          className="bg-green-600 text-white text-xs py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                        >
                          ✓ Success
                        </button>
                        <button
                          onClick={() => pay("fail")}
                          disabled={loading}
                          className="bg-red-600 text-white text-xs py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                        >
                          ✕ Fail
                        </button>
                        <button
                          onClick={() => pay("timeout")}
                          disabled={loading}
                          className="bg-amber-500 text-white text-xs py-2 rounded-md hover:bg-amber-600 disabled:opacity-50"
                        >
                          ⏱ Timeout
                        </button>
                        <button
                          onClick={cancelOrder}
                          disabled={loading}
                          className="bg-slate-200 text-slate-700 text-xs py-2 rounded-md hover:bg-slate-300 disabled:opacity-50"
                        >
                          Cancel Order
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Order History</h2>
              <button
                onClick={fetchOrders}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Refresh
              </button>
            </div>
            {orders.length === 0 ? (
              <p className="text-slate-400 text-sm">No orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="pb-2 pr-4">Order ID</th>
                      <th className="pb-2 pr-4">Items</th>
                      <th className="pb-2 pr-4">Total</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o._id} className="border-b border-slate-100">
                        <td className="py-2 pr-4 text-slate-500">{o._id.slice(-8)}</td>
                        <td className="py-2 pr-4">
                          {o.items.map((it) => it.quantity).reduce((a, b) => a + b, 0)} item(s)
                        </td>
                        <td className="py-2 pr-4 font-medium">Rs. {o.totalAmount.toFixed(2)}</td>
                        <td className="py-2 pr-4">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[o.status]}`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="py-2 text-slate-500">
                          {new Date(o.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;