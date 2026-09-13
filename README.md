# Techloom.ai Software Engineer Intern — Practical Assessment

This repository contains both parts of the 72-hour take-home assessment.

## 🔗 Quick Links

| | Task 01 — POS Order & Inventory System | Task 02 — E-Commerce Checkout & Payment System |
|---|---|---|
| **Live Frontend** | https://frontend-beige-five-30.vercel.app | https://techloom-ecommerce-frontend.vercel.app |
| **Live Backend API** | https://backend-dusky-ten-yhsqmecen5.vercel.app | https://techloom-ecommerce-backend.vercel.app |
| **Admin Panel** | — | https://techloom-ecommerce-frontend.vercel.app/admin (passcode: `techloom2026`) |
| **Details / Setup / Testing Guide** | [`/task-01/README.md`](./task-01/README.md) | [`/task-02/README.md`](./task-02/README.md) |

**Repository:** https://github.com/arunadarshana17617-sketch/techloom-assessment

## 📁 Repository Structure

```
techloom-assessment/
├── task-01/    # POS Order & Inventory System (concurrency-safe backend, React frontend)
└── task-02/    # E-Commerce Checkout & Payment System (product discovery, cart, refunds)
```

Each task folder has its own README with the full tech stack, local setup steps, environment variables, and a feature-by-feature testing guide — see the links above.

Task 02 also includes a bonus, non-required admin panel (hidden `/admin` route, passcode-protected) for adding, editing, and deleting products with image uploads — see [`/task-02/README.md`](./task-02/README.md) for details.

## 🧰 Common Stack

- **Backend:** Node.js / Express, MongoDB Atlas (Mongoose)
- **Frontend:** React (Vite), Tailwind CSS
- **Deployment:** Vercel (backend and frontend deployed as separate projects per task)