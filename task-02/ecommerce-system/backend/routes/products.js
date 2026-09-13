import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

// CREATE a product
router.post("/", async (req, res) => {
  try {
    const { name, description, price, stock, category, imageUrl } = req.body;

    if (!name || price === undefined || stock === undefined || !category) {
      return res.status(400).json({ error: "name, price, stock, and category are required" });
    }

    const product = await Product.create({
      name,
      description,
      price,
      stock,
      category,
      imageUrl,
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ all products — with search + filter support
// Query params: ?search=shirt&category=Clothing&minPrice=10&maxPrice=100&inStock=true
router.get("/", async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, inStock } = req.query;

    const filter = {};

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (category) {
      filter.category = category;
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    let products = await Product.find(filter).sort({ createdAt: -1 });

    // availableStock is a virtual (stock - reserved), so filter in JS after fetch
    if (inStock === "true") {
      products = products.filter((p) => p.availableStock > 0);
    } else if (inStock === "false") {
      products = products.filter((p) => p.availableStock <= 0);
    }

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ a single product (product details view)
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET distinct categories (useful for filter dropdown in frontend)
router.get("/meta/categories", async (req, res) => {
  try {
    const categories = await Product.distinct("category");
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE a product
router.put("/:id", async (req, res) => {
  try {
    const { name, description, price, stock, category, imageUrl } = req.body;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { name, description, price, stock, category, imageUrl },
      { new: true, runValidators: true }
    );

    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a product
router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;