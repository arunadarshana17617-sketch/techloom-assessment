import { useState, useEffect } from "react";
import client from "./api/client";

const ADMIN_PASSCODE = "techloom2026";
const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  stock: "",
  category: "",
  imageUrl: "",
};

function formatMoney(n) {
  return `$${Number(n).toFixed(2)}`;
}

// Reads the chosen file, downsizes it on a canvas, and returns a compact base64 data URL.
// This avoids needing a separate file-storage/cloud service for the assessment.
function resizeImageFile(file, maxWidth = 640) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function ProductThumb({ product, className }) {
  const [failed, setFailed] = useState(false);
  if (!product.imageUrl || failed) {
    return (
      <div className={`${className} bg-bg border border-border flex items-center justify-center text-ink/30`}>
        <span className="font-display text-lg">{product.name?.charAt(0).toUpperCase()}</span>
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

function AdminProductForm({ editingProduct, onSaved, onCancelEdit }) {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    client
      .get("/products/meta/categories")
      .then((res) => setCategories(res.data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (editingProduct) {
      setForm({
        name: editingProduct.name || "",
        description: editingProduct.description || "",
        price: editingProduct.price ?? "",
        stock: editingProduct.stock ?? "",
        category: editingProduct.category || "",
        imageUrl: editingProduct.imageUrl || "",
      });
      setSuccess("");
      setError("");
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editingProduct]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageProcessing(true);
    setError("");
    try {
      const dataUrl = await resizeImageFile(file);
      updateField("imageUrl", dataUrl);
    } catch (err) {
      setError("Could not read that image file.");
    } finally {
      setImageProcessing(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.name || !form.price || !form.stock || !form.category) {
      setError("Name, price, stock, and category are all required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        stock: Number(form.stock),
        category: form.category,
        imageUrl: form.imageUrl,
      };

      if (editingProduct) {
        await client.put(`/products/${editingProduct._id}`, payload);
        setSuccess(`"${form.name}" was updated.`);
      } else {
        await client.post("/products", payload);
        setSuccess(`"${form.name}" was added successfully.`);
        setForm(EMPTY_FORM);
      }

      const res = await client.get("/products/meta/categories");
      setCategories(res.data);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || "Could not save this product.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h2 className="font-display text-lg font-semibold mb-1">
        {editingProduct ? `Edit "${editingProduct.name}"` : "Add a product"}
      </h2>
      <p className="text-sm text-ink/50 mb-4">
        {editingProduct
          ? "Update the details below and save your changes."
          : "New products appear in the shop immediately with their available stock."}
      </p>

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-lg p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-ink/60 block mb-1">Product name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full border border-border rounded-md px-3 py-1.5 text-sm"
            placeholder="e.g. Wireless Keyboard"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-ink/60 block mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            className="w-full border border-border rounded-md px-3 py-1.5 text-sm"
            rows={2}
            placeholder="Short description shown on the product card"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-ink/60 block mb-1">Price</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => updateField("price", e.target.value)}
              className="w-full border border-border rounded-md px-3 py-1.5 text-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink/60 block mb-1">Stock</label>
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => updateField("stock", e.target.value)}
              className="w-full border border-border rounded-md px-3 py-1.5 text-sm"
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-ink/60 block mb-1">Category</label>
          <input
            type="text"
            list="category-options"
            value={form.category}
            onChange={(e) => updateField("category", e.target.value)}
            className="w-full border border-border rounded-md px-3 py-1.5 text-sm"
            placeholder="Choose an existing category or type a new one"
          />
          <datalist id="category-options">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="text-xs font-medium text-ink/60 block mb-1">Product image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full text-sm border border-border rounded-md px-3 py-1.5 file:mr-3 file:border-0 file:bg-bg file:rounded file:px-2 file:py-1 file:text-xs"
          />
          {imageProcessing && <p className="text-xs text-ink/40 mt-1">Processing image...</p>}
          {form.imageUrl && !imageProcessing && (
            <div className="mt-2 flex items-center gap-2">
              <img src={form.imageUrl} alt="Preview" className="w-16 h-16 object-cover rounded-md border border-border" />
              <button
                type="button"
                onClick={() => updateField("imageUrl", "")}
                className="text-xs text-danger hover:underline"
              >
                Remove image
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {success && <p className="text-sm text-success">{success}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting || imageProcessing}
            className="flex-1 bg-primary text-white rounded-md py-2 text-sm font-medium hover:bg-primary-dark transition disabled:opacity-50"
          >
            {submitting ? "Saving..." : editingProduct ? "Save changes" : "Add product"}
          </button>
          {editingProduct && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="border border-border rounded-md px-4 text-sm hover:bg-bg transition"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function AdminProductList({ refreshKey, onEdit }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await client.get("/products");
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
  }, [refreshKey]);

  async function handleDelete(product) {
    const confirmed = window.confirm(`Delete "${product.name}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(product._id);
    setError("");
    try {
      await client.delete(`/products/${product._id}`);
      setProducts((prev) => prev.filter((p) => p._id !== product._id));
    } catch (err) {
      setError(err.response?.data?.error || "Could not delete this product.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-8">
      <h2 className="font-display text-lg font-semibold mb-3">Your products</h2>

      {error && <p className="text-sm text-danger mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-ink/50">Loading products...</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-ink/50">No products yet — add your first one above.</p>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div
              key={p._id}
              className="bg-surface border border-border rounded-lg p-3 flex items-center gap-3"
            >
              <ProductThumb product={p} className="w-12 h-12 rounded-md shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-ink/50">
                  {p.category} · {formatMoney(p.price)} · {p.availableStock} available
                </p>
              </div>
              <button
                onClick={() => onEdit(p)}
                className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-bg transition shrink-0"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(p)}
                disabled={deletingId === p._id}
                className="border border-danger text-danger rounded-md px-3 py-1.5 text-xs hover:bg-danger/5 transition shrink-0 disabled:opacity-50"
              >
                {deletingId === p._id ? "..." : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleUnlock(e) {
    e.preventDefault();
    if (passcode === ADMIN_PASSCODE) {
      setUnlocked(true);
      setError("");
    } else {
      setError("That passcode isn't right.");
    }
  }

  function handleSaved() {
    setEditingProduct(null);
    setRefreshKey((k) => k + 1);
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-bg text-ink font-body flex items-center justify-center p-4">
        <form
          onSubmit={handleUnlock}
          className="bg-surface border border-border rounded-lg p-6 w-full max-w-sm"
        >
          <h1 className="font-display text-lg font-semibold mb-1">Admin access</h1>
          <p className="text-sm text-ink/50 mb-4">Enter the passcode to manage products.</p>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode"
            className="w-full border border-border rounded-md px-3 py-1.5 text-sm mb-3"
            autoFocus
          />
          {error && <p className="text-sm text-danger mb-3">{error}</p>}
          <button
            type="submit"
            className="w-full bg-primary text-white rounded-md py-2 text-sm font-medium hover:bg-primary-dark transition"
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-ink font-body">
      <header className="bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <h1 className="font-display text-xl font-semibold text-primary-dark">
            Techloom Store — Admin
          </h1>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <AdminProductForm
          editingProduct={editingProduct}
          onSaved={handleSaved}
          onCancelEdit={() => setEditingProduct(null)}
        />
        <AdminProductList refreshKey={refreshKey} onEdit={setEditingProduct} />
      </main>
    </div>
  );
}