import express from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";

const router = express.Router();

const RESERVATION_MINUTES = 5;

// Helper: check if an order's reservation has expired, and if so, release stock
async function releaseIfExpired(order) {
  if (
    order.status === "Reserved" &&
    order.reservedUntil &&
    order.reservedUntil < new Date()
  ) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity } },
            { session }
          );
        }
        order.status = "Expired";
        order.reservedUntil = null;
        await order.save({ session });
      });
    } finally {
      session.endSession();
    }
  }
  return order;
}

// CREATE ORDER (checkout) — reserves stock atomically using a DB transaction
router.post("/checkout", async (req, res) => {
  const { items, idempotencyKey } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "Cart is empty" });
  }

  if (idempotencyKey) {
    const existing = await Order.findOne({ paymentAttemptId: idempotencyKey });
    if (existing) {
      return res.status(409).json({ error: "Duplicate order submission", order: existing });
    }
  }

  const session = await mongoose.startSession();

  try {
    let createdOrder;

    await session.withTransaction(async () => {
      const orderItems = [];
      let totalAmount = 0;

      for (const { productId, quantity } of items) {
        if (!quantity || quantity < 1) {
          throw new Error(`Invalid quantity for product ${productId}`);
        }

        const product = await Product.findOneAndUpdate(
          { _id: productId, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { new: true, session }
        );

        if (!product) {
          throw new Error(`Insufficient stock for product ${productId}`);
        }

        orderItems.push({
          product: productId,
          quantity,
          priceAtOrder: product.price,
        });
        totalAmount += product.price * quantity;
      }

      const [order] = await Order.create(
        [
          {
            items: orderItems,
            totalAmount,
            status: "Reserved",
            reservedUntil: new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000),
            paymentAttemptId: idempotencyKey || undefined,
          },
        ],
        { session }
      );

      createdOrder = order;
    });

    const populated = await Order.findById(createdOrder._id).populate("items.product", "name price");
    res.status(201).json(populated);
  } catch (err) {
    res.status(409).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// MOCK PAYMENT
router.post("/:id/pay", async (req, res) => {
  const { outcome, paymentAttemptId } = req.body;

  const session = await mongoose.startSession();

  try {
    let order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order = await releaseIfExpired(order);

    if (order.status !== "Reserved") {
      return res.status(409).json({
        error: `Cannot pay for order with status "${order.status}"`,
      });
    }

    if (paymentAttemptId && order.paymentAttemptId === paymentAttemptId) {
      return res.status(409).json({ error: "Duplicate payment attempt" });
    }

    if (outcome === "success") {
      order.paymentAttemptId = paymentAttemptId || `attempt-${Date.now()}`;
      order.status = "Paid";
      order.reservedUntil = null;
      await order.save();
    } else if (outcome === "fail") {
      await session.withTransaction(async () => {
        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { stock: item.quantity } },
            { session }
          );
        }
        order.paymentAttemptId = paymentAttemptId || `attempt-${Date.now()}`;
        order.status = "Failed";
        order.reservedUntil = null;
        await order.save({ session });
      });
    } else if (outcome === "timeout") {
      const populated = await Order.findById(order._id).populate("items.product", "name price");
      return res.json({ message: "Payment timed out, awaiting expiry", order: populated });
    } else {
      return res.status(400).json({ error: "Invalid outcome" });
    }

    const populated = await Order.findById(order._id).populate("items.product", "name price");
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// CANCEL ORDER
router.post("/:id/cancel", async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order = await releaseIfExpired(order);

    if (!["Reserved", "Pending"].includes(order.status)) {
      return res.status(409).json({
        error: `Cannot cancel order with status "${order.status}"`,
      });
    }

    await session.withTransaction(async () => {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } },
          { session }
        );
      }
      order.status = "Cancelled";
      order.reservedUntil = null;
      await order.save({ session });
    });

    const populated = await Order.findById(order._id).populate("items.product", "name price");
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// GET single order (lazy-checks expiry every time it's read)
router.get("/:id", async (req, res) => {
  try {
    let order = await Order.findById(req.params.id).populate("items.product", "name price");
    if (!order) return res.status(404).json({ error: "Order not found" });
    order = await releaseIfExpired(order);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all orders (order history — includes product names)
router.get("/", async (req, res) => {
  try {
    let orders = await Order.find()
      .sort({ createdAt: -1 })
      .populate("items.product", "name price");
    orders = await Promise.all(orders.map(releaseIfExpired));
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;