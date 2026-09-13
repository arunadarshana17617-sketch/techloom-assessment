import express from "express";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

const router = express.Router();

const RESERVATION_MINUTES = 5;

// Helper: lazy-expire a single order if its reservation time has passed
async function expireIfNeeded(order) {
  if (
    order.status === "Reserved" &&
    order.expiresAt &&
    order.expiresAt.getTime() < Date.now()
  ) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Release reserved stock back to each product
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { reserved: -item.quantity } },
          { session }
        );
      }

      order.status = "Expired";
      await order.save({ session });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
  return order;
}

// CHECKOUT — reserve stock for items in cart, create order with status "Reserved"
// body: { items: [{ productId, quantity }], idempotencyKey, customerName }
router.post("/checkout", async (req, res) => {
  const { items, idempotencyKey, customerName } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array is required" });
  }
  if (!idempotencyKey) {
    return res.status(400).json({ error: "idempotencyKey is required" });
  }

  // Duplicate order detection
  const existing = await Order.findOne({ idempotencyKey }).populate("items.product");
  if (existing) {
    return res.status(200).json(existing); // idempotent: return the same order
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    let totalAmount = 0;
    const orderItems = [];

    for (const { productId, quantity } of items) {
      if (!productId || !quantity || quantity < 1) {
        throw new Error("Each item needs a valid productId and quantity");
      }

      // Atomic conditional update: only reserve if enough available stock exists.
      // This is what prevents overselling under concurrent requests.
      const product = await Product.findOneAndUpdate(
        {
          _id: productId,
          $expr: { $gte: [{ $subtract: ["$stock", "$reserved"] }, quantity] },
        },
        { $inc: { reserved: quantity } },
        { new: true, session }
      );

      if (!product) {
        throw new Error(`Insufficient stock for product ${productId}`);
      }

      orderItems.push({
        product: product._id,
        quantity,
        priceAtOrder: product.price,
      });
      totalAmount += product.price * quantity;
    }

    const now = new Date();
    const order = await Order.create(
      [
        {
          items: orderItems,
          totalAmount,
          status: "Reserved",
          reservedAt: now,
          expiresAt: new Date(now.getTime() + RESERVATION_MINUTES * 60 * 1000),
          idempotencyKey,
          customerName: customerName || "Guest",
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const populatedOrder = await Order.findById(order[0]._id).populate("items.product");
    res.status(201).json(populatedOrder);
  } catch (err) {
    await session.abortTransaction();
    res.status(409).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// MOCK PAYMENT — simulate success / failure / timeout
// body: { outcome: "success" | "failure" | "timeout", paymentAttemptId }
router.post("/:id/pay", async (req, res) => {
  const { outcome, paymentAttemptId } = req.body;
  const validOutcomes = ["success", "failure", "timeout"];

  if (!validOutcomes.includes(outcome)) {
    return res.status(400).json({ error: "outcome must be success, failure, or timeout" });
  }
  if (!paymentAttemptId) {
    return res.status(400).json({ error: "paymentAttemptId is required" });
  }

  let order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  order = await expireIfNeeded(order);

  if (order.status !== "Reserved") {
    return res.status(409).json({
      error: `Cannot process payment — order status is "${order.status}", not "Reserved"`,
    });
  }

  // Duplicate payment detection
  if (order.paymentAttemptId === paymentAttemptId) {
    const populated = await Order.findById(order._id).populate("items.product");
    return res.status(200).json(populated); // idempotent: same attempt already processed
  }
  if (order.paymentAttemptId) {
    return res.status(409).json({ error: "A payment has already been attempted for this order" });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    order.paymentAttemptId = paymentAttemptId;

    if (outcome === "success") {
      order.status = "Paid";
      order.paidAt = new Date();
      // Convert reserved -> actually sold (decrement both stock and reserved)
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: -item.quantity, reserved: -item.quantity } },
          { session }
        );
      }
    } else if (outcome === "failure") {
      order.status = "Failed";
      // Release reserved stock back
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { reserved: -item.quantity } },
          { session }
        );
      }
    } else if (outcome === "timeout") {
      order.status = "Expired";
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { reserved: -item.quantity } },
          { session }
        );
      }
    }

    await order.save({ session });
    await session.commitTransaction();

    const populatedOrder = await Order.findById(order._id).populate("items.product");
    res.json(populatedOrder);
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// CANCEL an order — restore stock for Reserved or Paid orders
router.post("/:id/cancel", async (req, res) => {
  let order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  order = await expireIfNeeded(order);

  if (!["Reserved", "Paid"].includes(order.status)) {
    return res.status(409).json({
      error: `Cannot cancel — order status is "${order.status}"`,
    });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    if (order.status === "Reserved") {
      // stock was only reserved, not deducted yet — release the reservation
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { reserved: -item.quantity } },
          { session }
        );
      }
    } else if (order.status === "Paid") {
      // stock was already deducted — restore it back to available stock
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } },
          { session }
        );
      }
    }

    order.status = "Cancelled";
    await order.save({ session });

    await session.commitTransaction();

    const populatedOrder = await Order.findById(order._id).populate("items.product");
    res.json(populatedOrder);
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// REFUND — simulate a refund for a Paid order that's being cancelled, or an already-Failed/Cancelled order
// body: { reason }
router.post("/:id/refund", async (req, res) => {
  const { reason } = req.body;

  let order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  order = await expireIfNeeded(order);

  if (order.refund.isRefunded) {
    return res.status(409).json({ error: "Order has already been refunded" });
  }

  if (!["Cancelled", "Failed", "Paid"].includes(order.status)) {
    return res.status(409).json({
      error: `Cannot refund — order status is "${order.status}"`,
    });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // If refunding a still-Paid order, restore stock too (treat as cancel + refund)
    if (order.status === "Paid") {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } },
          { session }
        );
      }
      order.status = "Cancelled";
    }

    order.refund = {
      isRefunded: true,
      refundedAmount: order.totalAmount,
      refundedAt: new Date(),
      reason: reason || "Customer requested refund",
    };
    order.status = "Refunded";

    await order.save({ session });
    await session.commitTransaction();

    const populatedOrder = await Order.findById(order._id).populate("items.product");
    res.json(populatedOrder);
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
});

// ORDER HISTORY — get all orders (optionally filter by customerName)
router.get("/", async (req, res) => {
  try {
    const { customerName } = req.query;
    const filter = {};
    if (customerName) filter.customerName = customerName;

    let orders = await Order.find(filter)
      .populate("items.product")
      .sort({ createdAt: -1 });

    // lazy-expire any that are overdue before returning
    orders = await Promise.all(orders.map((o) => expireIfNeeded(o)));

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET a single order
router.get("/:id", async (req, res) => {
  try {
    let order = await Order.findById(req.params.id).populate("items.product");
    if (!order) return res.status(404).json({ error: "Order not found" });

    order = await expireIfNeeded(order);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;