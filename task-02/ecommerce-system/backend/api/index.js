import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import productRoutes from "../routes/products.js";
import orderRoutes from "../routes/orders.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Cache the DB connection across serverless invocations (Vercel best practice)
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGODB_URI);
  isConnected = true;
  console.log("MongoDB connected");
}

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: "Database connection failed", details: err.message });
  }
});

app.get("/", (req, res) => {
  res.json({ message: "Techloom E-Commerce API is running" });
});

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

// Local dev only — Vercel handles the listener itself in production
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;