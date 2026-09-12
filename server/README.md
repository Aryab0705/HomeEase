# 🏠 HomeEase – Home Service Marketplace

> A production-ready MERN full-stack application connecting customers with verified service providers.

---

## 📁 Project Structure

```
server/
├── server.js                  # Entry point — HTTP + Socket.io
├── .env                       # Environment variables (do not commit)
├── .env.example               # Template for environment variables
├── src/
│   ├── app.js                 # Express app — routes, middleware, CORS
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   └── cloudinary.js      # Cloudinary SDK config
│   ├── models/
│   │   ├── User.js            # User schema (customer/provider/admin)
│   │   ├── Provider.js        # Provider profile, services, portfolio
│   │   ├── Service.js         # Service catalogue
│   │   ├── Booking.js         # Booking lifecycle
│   │   ├── Review.js          # 4-dimension rating reviews
│   │   ├── Quote.js           # Provider quotation system
│   │   ├── Payment.js         # Payment records
│   │   ├── Chat.js            # Chat rooms
│   │   ├── Message.js         # Chat messages
│   │   ├── Notification.js    # In-app notifications
│   │   └── Dispute.js         # Dispute management
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication
│   │   ├── roleCheck.js       # RBAC (customer/provider/admin)
│   │   ├── rateLimiter.js     # express-rate-limit
│   │   ├── validate.js        # express-validator result handler
│   │   ├── upload.js          # Multer + Cloudinary
│   │   └── errorHandler.js    # Centralized error handling
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── providerController.js
│   │   ├── serviceController.js
│   │   ├── bookingController.js
│   │   ├── reviewController.js
│   │   ├── chatController.js
│   │   ├── notificationController.js
│   │   ├── disputeController.js
│   │   ├── quoteController.js
│   │   └── adminController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── providerRoutes.js
│   │   ├── serviceRoutes.js
│   │   ├── bookingRoutes.js
│   │   ├── reviewRoutes.js
│   │   ├── chatRoutes.js
│   │   ├── notificationRoutes.js
│   │   ├── disputeRoutes.js
│   │   ├── quoteRoutes.js
│   │   └── adminRoutes.js
│   ├── services/
│   │   ├── emailService.js    # Nodemailer templates
│   │   └── cloudinaryService.js # Upload/delete helpers
│   ├── sockets/
│   │   └── index.js           # Socket.io — chat, notifications, tracking
│   └── utils/
│       ├── ApiResponse.js
│       ├── ApiError.js
│       ├── asyncHandler.js
│       └── generateToken.js
```

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your API keys:

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Random secure string |
| `JWT_REFRESH_SECRET` | Another random secure string |
| `CLOUDINARY_*` | From cloudinary.com dashboard |
| `SMTP_*` | Gmail or SendGrid credentials |

### 3. Run Development Server

```bash
npm run dev
```

Server starts at **http://localhost:5000**

---

## 🔌 API Endpoints

### Authentication — `/api/auth`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/register` | Public | Register customer or provider |
| POST | `/login` | Public | Login, returns access token |
| POST | `/logout` | Private | Clear tokens |
| POST | `/refresh-token` | Public | Get new access token from refresh cookie |
| POST | `/forgot-password` | Public | Send reset email |
| PUT | `/reset-password/:token` | Public | Reset password |
| GET | `/me` | Private | Get current user |

### Users — `/api/users`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/profile` | Private | Get own profile |
| PUT | `/profile` | Private | Update profile |
| PUT | `/change-password` | Private | Change password |
| PUT | `/avatar` | Private | Upload avatar |
| GET | `/` | Admin | List all users |
| PUT | `/:id/block` | Admin | Block/unblock user |
| DELETE | `/:id` | Admin | Delete user |

### Providers — `/api/providers`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Public | List verified providers (filter/sort/search) |
| GET | `/categories` | Public | Get service categories |
| GET | `/:id` | Public | Provider details |
| GET | `/me/profile` | Provider | Own provider profile |
| PUT | `/me/profile` | Provider | Update provider profile |
| POST | `/me/portfolio` | Provider | Add portfolio items |
| DELETE | `/me/portfolio/:itemId` | Provider | Remove portfolio item |
| POST | `/me/documents` | Provider | Upload verification doc |
| PATCH | `/:id/verify` | Admin | Verify / reject provider |

### Services — `/api/services`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Public | List services (filter by category/search) |
| GET | `/:id` | Public | Service details |
| POST | `/` | Admin | Create service |
| PUT | `/:id` | Admin | Update service |
| DELETE | `/:id` | Admin | Delete service |

### Bookings — `/api/bookings`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | Customer | Create booking |
| GET | `/my` | Customer/Provider | Own bookings |
| GET | `/all` | Admin | All bookings |
| GET | `/:id` | Private | Booking details |
| PATCH | `/:id/status` | Provider/Admin | Update status |
| PATCH | `/:id/cancel` | Customer/Admin | Cancel booking |
| POST | `/:id/work-images` | Provider | Upload before/after images |

**Booking Status Flow:**
```
pending → accepted → on_the_way → arrived → work_started → completed
pending → rejected
accepted → cancelled
```

### Reviews — `/api/reviews`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | Customer | Submit review (completed bookings only) |
| GET | `/my` | Customer | My reviews |
| GET | `/provider/:id` | Public | Provider reviews + stats |
| POST | `/:id/respond` | Provider | Respond to review |
| PATCH | `/:id/visibility` | Admin | Show/hide review |

### Quotes — `/api/quotes`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | Provider | Submit quote |
| GET | `/my` | Provider | My submitted quotes |
| GET | `/booking/:id` | Customer | Quotes for a booking |
| PATCH | `/:id/accept` | Customer | Accept quote (rejects others) |

### Chat — `/api/chats`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Private | My chats |
| POST | `/booking/:bookingId` | Private | Get or create booking chat |
| GET | `/:chatId/messages` | Private | Paginated messages |
| POST | `/:chatId/messages` | Private | Send message / image |

### Notifications — `/api/notifications`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/` | Private | Get notifications + unread count |
| PATCH | `/:id/read` | Private | Mark one as read |
| PATCH | `/read-all` | Private | Mark all as read |
| DELETE | `/:id` | Private | Delete notification |

### Disputes — `/api/disputes`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/` | Customer | Raise dispute |
| GET | `/my` | Private | My disputes |
| GET | `/` | Admin | All disputes |
| PATCH | `/:id/resolve` | Admin | Resolve dispute |

### Admin — `/api/admin`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/analytics` | Admin | Full dashboard analytics |
| GET | `/users` | Admin | User management |
| GET | `/providers/pending` | Admin | Pending verifications |
| PUT | `/users/:id/block` | Admin | Block/unblock user |
| DELETE | `/users/:id` | Admin | Delete user |
| PATCH | `/providers/:id/verify` | Admin | Verify provider |

---

## 🔌 Socket.io Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_chat` | `chatId` | Join a chat room |
| `leave_chat` | `chatId` | Leave a chat room |
| `send_message` | `{chatId, content, type}` | Send text message |
| `typing` | `{chatId, isTyping}` | Typing indicator |
| `join_booking` | `bookingId` | Subscribe to booking updates |
| `booking_status_update` | `{bookingId, status, note}` | Broadcast status |

### Server → Client

| Event | Description |
|-------|-------------|
| `new_message` | Message received in chat |
| `message_notification` | New message alert (offline) |
| `user_typing` | Typing indicator from other user |
| `status_updated` | Booking status changed |

### Auth
Connect with: `{ auth: { token: "<accessToken>" } }`

---

## 🔐 Security Features

- ✅ JWT Access Token (15 min) + Refresh Token (7 days, HTTP-only cookie)
- ✅ Password hashing with bcrypt (12 rounds)
- ✅ Role-based access control (customer / provider / admin)
- ✅ Rate limiting on auth endpoints (10 req/15min)
- ✅ General API rate limiting (100 req/15min)
- ✅ Helmet security headers
- ✅ CORS with origin whitelist
- ✅ Input validation with express-validator
- ✅ Centralized error handling (Mongoose, JWT, duplicates)
- ✅ Blocked user detection on every request

---

## 🧰 Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4 | Web framework |
| mongoose | ^8 | MongoDB ODM |
| jsonwebtoken | ^9 | JWT auth |
| bcryptjs | ^2 | Password hashing |
| socket.io | ^4 | Real-time communication |
| cloudinary | ^2 | Image storage |
| multer | ^1 | File upload middleware |
| nodemailer | ^6 | Email service |
| express-rate-limit | ^7 | Rate limiting |
| express-validator | ^7 | Input validation |
| helmet | ^8 | Security headers |
| cors | ^2 | CORS handling |
| morgan | ^1 | HTTP logging |
| cookie-parser | ^1 | Cookie handling |
| compression | ^1 | Response compression |

---

## 📊 Database Collections

| Collection | Documents |
|------------|-----------|
| users | 3 roles: customer, provider, admin |
| providers | Provider profiles linked to users |
| services | Service catalogue by category |
| bookings | Full booking lifecycle with images |
| reviews | 4-dimension ratings + provider responses |
| quotes | Provider bids on booking requests |
| payments | Payment records (Razorpay ready) |
| chats | Chat rooms linked to bookings |
| messages | Individual messages |
| notifications | In-app notification system |
| disputes | Dispute tracking with resolution |
