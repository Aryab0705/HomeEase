# 🏠 HomeEase – Home Service Marketplace

> A production-ready MERN full-stack application connecting customers with verified service providers.

---

## 📁 Project Structure

```
Home Ease/
├── server/          # Node.js + Express + MongoDB Backend
│   ├── server.js
│   ├── src/
│   │   ├── config/       # DB + Cloudinary config
│   │   ├── models/       # 11 Mongoose models
│   │   ├── middleware/   # auth, RBAC, rate limit, validate, upload, error
│   │   ├── controllers/  # 11 controllers
│   │   ├── routes/       # 11 route files
│   │   ├── services/     # email + cloudinary services
│   │   ├── sockets/      # Socket.io server
│   │   └── utils/        # ApiResponse, ApiError, asyncHandler, generateToken
│   └── README.md
│
└── client/          # React + Vite Frontend
    ├── src/
    │   ├── pages/        # Landing, Auth, Customer, Provider, Admin, Chat
    │   ├── components/   # common + layout components
    │   ├── redux/        # auth + notification slices
    │   ├── services/     # Axios API + Socket.io client
    │   ├── routes/       # ProtectedRoute + PublicRoute
    │   └── utils/        # helpers (date, currency, status)
    └── index.html
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- MongoDB Atlas account (or local MongoDB)
- (Optional) Cloudinary account for image uploads

### 1. Backend

```bash
cd server
npm install
cp .env.example .env
# Fill in MONGO_URI and JWT secrets at minimum
npm run dev
```
Backend runs at → **http://localhost:5000**

### 2. Frontend

```bash
cd client
npm install
npm run dev
```
Frontend runs at → **http://localhost:5173**

---

## 🔑 Minimum Required .env Values

For the app to run locally, you need at minimum:

```env
# server/.env
MONGO_URI=mongodb+srv://...
JWT_SECRET=any-random-string
JWT_REFRESH_SECRET=another-random-string
```

All other services (Cloudinary, email, Razorpay) are optional for development — the API will work without them, image uploads will fail gracefully.

---

## ✅ Features Implemented

### Backend
- ✅ JWT Auth (Access + Refresh tokens, HTTP-only cookies)
- ✅ Role-Based Access Control (Customer / Provider / Admin)
- ✅ 11 Mongoose Models (User, Provider, Service, Booking, Review, Quote, Payment, Chat, Message, Notification, Dispute)
- ✅ 11 REST API Route Groups with full CRUD
- ✅ Booking lifecycle with status transitions & validation
- ✅ 4-dimension Review & Rating system with aggregate recalculation
- ✅ Provider quotation system
- ✅ Real-time Socket.io chat with typing indicators
- ✅ Cloudinary image upload (avatars, portfolio, before/after images)
- ✅ Nodemailer email templates (password reset, booking confirmation)
- ✅ Admin analytics dashboard API (charts, top providers, revenue)
- ✅ Rate limiting, Helmet, CORS, bcrypt, input validation
- ✅ Centralized error handling (Mongoose, JWT, duplicate key errors)

### Frontend
- ✅ React + Vite + Redux Toolkit
- ✅ Role-aware Navbar + Sidebar
- ✅ Landing page (hero, services, testimonials, CTA, footer)
- ✅ Login + Register pages with form validation
- ✅ Customer Dashboard (stats, recent bookings)
- ✅ Service Search (category filters, provider cards, pagination)
- ✅ Provider Dashboard (earnings, pending requests, stats)
- ✅ Admin Dashboard (analytics charts with Recharts)
- ✅ Real-time Chat with Socket.io
- ✅ Framer Motion animations throughout
- ✅ Responsive mobile design

---

## 📡 API Reference

See [server/README.md](./server/README.md) for full API documentation.

**Base URL:** `http://localhost:5000/api`

| Group | Prefix |
|-------|--------|
| Auth | `/api/auth` |
| Users | `/api/users` |
| Providers | `/api/providers` |
| Services | `/api/services` |
| Bookings | `/api/bookings` |
| Reviews | `/api/reviews` |
| Quotes | `/api/quotes` |
| Payments | `/api/payments` |
| Chat | `/api/chats` |
| Notifications | `/api/notifications` |
| Disputes | `/api/disputes` |
| Admin | `/api/admin` |

---

## 🛡️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, Redux Toolkit |
| Styling | Custom CSS + Tailwind CSS v4 |
| Animations | Framer Motion |
| Charts | Recharts |
| Forms | React Hook Form |
| HTTP | Axios with interceptors |
| Real-time | Socket.io |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas + Mongoose |
| Auth | JWT (access + refresh) |
| Images | Cloudinary |
| Email | Nodemailer |
| Security | Helmet, CORS, bcrypt, Rate Limiting |
