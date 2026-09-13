# Task 02 — E-Commerce Checkout & Payment System

## 🔗 Links

- **Live Frontend:** https://techloom-ecommerce-frontend.vercel.app
- **Live Backend API:** https://techloom-ecommerce-backend.vercel.app
- **Admin panel (hidden route):** https://techloom-ecommerce-frontend.vercel.app/admin — passcode: `techloom2026`
- **GitHub Repository:** https://github.com/arunadarshana17617-sketch/techloom-assessment

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Frontend | React (Vite), React Router, Tailwind CSS |
| Database | MongoDB Atlas (Mongoose) |
| Deployment | Vercel (backend + frontend deployed separately) |

## 📁 Folder Structure

```
task-02/ecommerce-system/
├── backend/
│   ├── api/index.js        # Express app entry point (Vercel serverless)
│   ├── models/              # Product & Order schemas
│   ├── routes/               # products.js, orders.js
│   └── vercel.json
└── frontend/
    ├── src/
    │   ├── App.jsx           # Customer-facing store (shop, cart, checkout, order history)
    │   ├── AdminPage.jsx      # Hidden /admin route — product management
    │   └── api/client.js      # Axios instance
    └── vercel.json           # SPA rewrite rules for React Router
```

## ⚙️ Setup — Run Locally

### Backend

```bash
cd task-02/ecommerce-system/backend
npm install
```

Create a `.env` file in `backend/`:
```
MONGODB_URI=your_mongodb_connection_string
PORT=5000
```

Run the server:
```bash
npm run dev
```
Backend runs at `http://localhost:5000`.

### Frontend

```bash
cd task-02/ecommerce-system/frontend
npm install
```

Create a `.env` file in `frontend/`:
```
VITE_API_URL=http://localhost:5000/api
```

Run the dev server:
```bash
npm run dev
```
Frontend runs at `http://localhost:5173`.

## 🔑 Environment Variables

| Variable | Where | Description |
|---|---|---|
| `MONGODB_URI` | backend | MongoDB Atlas connection string |
| `PORT` | backend | Local server port (default 5000) |
| `VITE_API_URL` | frontend | Base URL of the backend API (`/api` included) |

## ✅ How to Test Each Feature

### 1. Product Discovery
- Open the **Shop** tab. Use the search bar to search by product name.
- Use the sidebar filters: category dropdown, min/max price, and "In stock only" checkbox.
- Click **View** on any product to see its full details in a modal.

### 2. Cart & Checkout
- Click **Add to cart** on any product — the cart drawer opens automatically.
- Adjust quantities or remove items directly in the cart.
- Enter a name (optional, defaults to "Guest") and click **Checkout** — this reserves stock and starts a 5-minute countdown, visible in the order panel.

### 3. Mock Payment Gateway
- While an order is `Reserved`, three buttons simulate payment outcomes:
  - **Success** → order becomes `Paid`, stock is permanently deducted.
  - **Fail** → order becomes `Failed`, reserved stock is released.
  - **Timeout** → order becomes `Expired`, reserved stock is released.
- Submitting a second payment with the same order ID returns an error (duplicate-payment protection).
- Submitting the same checkout twice with an unchanged cart returns the original order instead of creating a duplicate (idempotency key protection).

### 4. Cancellation & Refunds
- From **Order History**, a `Reserved` or `Paid` order shows a **Cancel** button — cancelling restores stock.
- A `Cancelled`, `Failed`, or `Paid` order shows a **Refund** button — refunding restores stock (if still `Paid`) and marks the order `Refunded` with a recorded amount and reason.

### 5. Order History
- Open the **Order History** tab to see every order with its current status, items, and total.
- Optionally filter by customer name using the search box at the top.

### 6. Admin — Product Management (bonus, not required by the assessment spec)
- Visit `/admin` directly (not linked in the customer nav) and enter the passcode `techloom2026`.
- Add a new product with name, description, price, stock, category (existing or new), and an optional image — images are picked from your device, resized, and stored as compact base64 data directly in MongoDB (no external storage service needed for this assessment).
- Edit or delete any existing product from the list below the form.

## 🧪 Concurrency & Data Integrity Notes

- Stock reservation uses an atomic `findOneAndUpdate` with a MongoDB `$expr` condition (`stock - reserved >= quantity`), so two simultaneous checkout requests for the same limited-stock item cannot both succeed — one is correctly rejected with a 409 error.
- All multi-step stock/order mutations (checkout, payment, cancel, refund) run inside MongoDB transactions, so a failure partway through rolls back cleanly instead of leaving stock or order data inconsistent.
- Reservations expire lazily: any `Reserved` order past its 5-minute window is transitioned to `Expired` (and its stock released) the next time it's read, rather than relying on a background timer — this keeps the app compatible with Vercel's serverless functions.
- A `withTransactionRetry` helper automatically retries a transaction (up to 4 attempts, with backoff) if MongoDB reports a transient write conflict — this can happen when two requests touch the exact same product document at the same instant. If stock is genuinely unavailable, the user still sees a clean `"Insufficient stock"` message rather than a raw database error.

## ✅ Verification Performed on the Live Production Deployment

Beyond local testing, the following was verified directly against the deployed production URLs before submission:

- **Full checkout → payment → refund flow**, exercised end-to-end on the live frontend against the live backend (not just localhost): add to cart → checkout (`Reserved`, live countdown) → simulate payment success (`Paid`) → refund from Order History (`Refunded`, with amount and reason recorded).
- **Concurrency / overselling test**, run directly against the production API: a test product was created with `stock: 1`, then two checkout requests for that product were fired at the same time from two parallel PowerShell background jobs. Result: exactly one request succeeded (`Reserved`), the other was rejected with `"Insufficient stock"`, and the product's `reserved` count stayed at `1` — confirming no overselling occurs under real concurrent load, not just in theory.