import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    priceAtOrder: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    items: {
      type: [orderItemSchema],
      required: true,
      validate: (v) => Array.isArray(v) && v.length > 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["Pending", "Reserved", "Paid", "Cancelled", "Expired", "Failed", "Refunded"],
      default: "Pending",
      required: true,
    },
    // 5-minute reservation expiry (same lazy-expiry pattern as Task 01)
    reservedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    // Idempotency: prevent duplicate order/payment submissions
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    paymentAttemptId: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    // Refund tracking (new for Task 02)
    refund: {
      isRefunded: { type: Boolean, default: false },
      refundedAmount: { type: Number, default: 0 },
      refundedAt: { type: Date, default: null },
      reason: { type: String, default: "" },
    },
    customerName: {
      type: String,
      default: "Guest",
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;