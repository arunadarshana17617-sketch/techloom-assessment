# Task 01 — POS Order & Inventory System

A concurrency-safe Point-of-Sale backend with stock reservation, mock payment simulation, and full order lifecycle management.

## 🔗 Live Links

- **Live App (Frontend)**: https://frontend-beige-five-30.vercel.app
- **Live API (Backend)**: https://backend-dusky-ten-yhsqmecen5.vercel.app/api
- **GitHub Repo**: https://github.com/arunadarshana17617-sketch/techloom-assessment

## 🛠 Tech Stack

| Layer      | Technology                          |
|------------|--------------------------------------|
| Frontend   | React (Vite) + Tailwind CSS          |
| Backend    | Node.js + Express                    |
| Database   | MongoDB (Atlas) via Mongoose         |
| Deployment | Vercel (frontend + backend separately) |

## 📁 Project Structure

```
task-01/POS-system/
├── backend/
│   ├── api/index.js         # Express app entry point (Vercel serverless handler)
│   ├── models/               # Mongoose schemas (Product, Order)
│   ├── routes/                # Product & Order route handlers
│   └── vercel.json            # Vercel deployment config
└── frontend/
    └── src/
        ├── App.jsx             # Main UI (shop, cart, order history)
        └── api.js              # Axios client pointing to live backend
```

## ⚙️ Setup Instructions (Local Development)

### Backend
```bash
cd task-01/POS-system/backend
npm install
```

Create a `.env` file in `backend/`:
```
MONGODB_URI=your_mongodb_atlas_connection_string
PORT=5000
```

Run the server:
```bash
node api/index.js
```

### Frontend
```bash
cd task-01/POS-system/frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and expects the backend at the URL configured in `src/api.js`.

## 🔑 Environment Variables

| Variable       | Description                              | Where       |
|----------------|-------------------------------------------|-------------|
| `MONGODB_URI`  | MongoDB Atlas connection string           | Backend `.env` / Vercel env |
| `PORT`         | Local dev server port (default 5000)      | Backend `.env` (local only) |

## ✅ Features Implemented

- **Product CRUD** — create, view, edit, delete products with name, price, stock
- **Cart & Checkout** — add items to cart, convert to an order
- **Atomic Stock Reservation** — uses MongoDB `findOneAndUpdate` with a `stock >= quantity` filter inside a **database transaction**, so concurrent checkout requests for the same product cannot oversell
- **5-Minute Reservation Expiry** — implemented via a lazy-check pattern (`reservedUntil` timestamp checked on every read), which works correctly on serverless platforms like Vercel where background timers don't persist
- **Mock Payment Gateway** — simulates `success`, `fail`, and `timeout` outcomes via `POST /api/orders/:id/pay`
- **Duplicate Submission Protection** — an `idempotencyKey` prevents the same checkout from creating two orders; a `paymentAttemptId` prevents double-processing a payment
- **Order Lifecycle** — statuses: `Pending`, `Reserved`, `Paid`, `Cancelled`, `Expired`, `Failed`, with transitions enforced in each route handler
- **Order Cancellation** — restores stock via a transaction
- **Order History** — full list of past orders with item names, quantities, totals, and status

## 🧪 How to Test Each Feature

All examples use the **live API**. Replace `<PRODUCT_ID>` with an actual product's `_id` from `GET /api/products`.

### 1. Product CRUD
```bash
curl https://backend-dusky-ten-yhsqmecen5.vercel.app/api/products
```
Or use the "Add Product" / "Edit" / "Delete" controls in the live UI.

### 2. Checkout & Stock Reservation
```bash
curl -X POST https://backend-dusky-ten-yhsqmecen5.vercel.app/api/orders/checkout \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"<PRODUCT_ID>","quantity":2}]}'
```
Check `GET /api/products` before and after — stock should decrease immediately.

### 3. Concurrency Test (No Overselling)
Set a product's stock to a small number (e.g. `2`), then fire two simultaneous checkout requests for `quantity: 2` each — e.g. using two terminals at the same time:

```bash
curl -X POST https://backend-dusky-ten-yhsqmecen5.vercel.app/api/orders/checkout \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"<PRODUCT_ID>","quantity":2}]}'
```

**Expected result**: only ONE request succeeds (`201 Reserved`); the other receives `409 Insufficient stock`. Final stock never goes negative. This is guaranteed by the atomic `findOneAndUpdate` filter (`stock: { $gte: quantity }`) running inside a MongoDB transaction.

### 4. Reservation Expiry
Checkout an item, note the `reservedUntil` timestamp (5 minutes ahead). Wait 5+ minutes, then `GET /api/orders/:id` — the order status will automatically flip to `Expired` and the stock will be restored (lazy-check on read).

### 5. Mock Payment Outcomes
```bash
# Success
curl -X POST https://backend-dusky-ten-yhsqmecen5.vercel.app/api/orders/<ORDER_ID>/pay \
  -H "Content-Type: application/json" -d '{"outcome":"success"}'

# Failure (releases stock)
curl -X POST https://backend-dusky-ten-yhsqmecen5.vercel.app/api/orders/<ORDER_ID>/pay \
  -H "Content-Type: application/json" -d '{"outcome":"fail"}'

# Timeout (leaves order Reserved until it expires)
curl -X POST https://backend-dusky-ten-yhsqmecen5.vercel.app/api/orders/<ORDER_ID>/pay \
  -H "Content-Type: application/json" -d '{"outcome":"timeout"}'
```

### 6. Duplicate Payment Detection
Call `/pay` twice on the same already-`Paid` order — the second call returns `409 Cannot pay for order with status "Paid"`.

### 7. Duplicate Order Detection
Send the same checkout request twice with the same `idempotencyKey` — the second call returns `409 Duplicate order submission`.

### 8. Order Cancellation
```bash
curl -X POST https://backend-dusky-ten-yhsqmecen5.vercel.app/api/orders/<ORDER_ID>/cancel
```
Only works on `Reserved`/`Pending` orders; stock is restored via a transaction.

### 9. Order History
Open the live app → **Order History** tab, or:
```bash
curl https://backend-dusky-ten-yhsqmecen5.vercel.app/api/orders
```

## 🗃 Data Integrity

All multi-step stock mutations (checkout, payment failure, cancellation, expiry) run inside MongoDB **sessions/transactions** (`session.withTransaction`), so a failure partway through automatically rolls back — inventory and order records are never left in an inconsistent state.