// App.jsx — Root application component with lazy-loaded routes
// All page components are loaded lazily via React.lazy + Suspense for better
// initial bundle size / performance. ProtectedRoute / PublicRoute remain intact.
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import store from './redux/store';
import { ProtectedRoute, PublicRoute } from './routes/ProtectedRoute';
import { PageSpinner } from './components/common/Spinner';
import { SidebarProvider } from './context/SidebarContext';

// ─── Lazy-loaded page imports ───────────────────────────────────────────────

// Public pages
const Landing       = lazy(() => import('./pages/Landing'));
const Unauthorized  = lazy(() => import('./pages/Unauthorized'));

// Auth
const Login            = lazy(() => import('./pages/auth/Login'));
const Register         = lazy(() => import('./pages/auth/Register'));
const ForgotPassword   = lazy(() => import('./pages/auth/ForgotPassword'));

// Shared
const Profile       = lazy(() => import('./pages/ProfileRouter'));
const Notifications = lazy(() => import('./pages/Notifications'));
const ProviderProfile = lazy(() => import('./pages/ProviderProfile'));

// Customer
const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'));
const ServiceSearch     = lazy(() => import('./pages/customer/ServiceSearch'));
const BookingsList      = lazy(() => import('./pages/customer/BookingsList'));
const BookingDetail     = lazy(() => import('./pages/customer/BookingDetail'));
const BookingCreate     = lazy(() => import('./pages/customer/BookingCreate'));

// Provider
const ProviderDashboard  = lazy(() => import('./pages/provider/DashboardPro'));
const ManageServices     = lazy(() => import('./pages/provider/ManageServices'));
const Earnings           = lazy(() => import('./pages/provider/Earnings'));
const {
  ProviderActiveJobs,
  ProviderAvailability,
  ProviderBookingHistory,
  ProviderBookingRequests,
  ProviderCertificates,
  ProviderNotifications,
  ProviderPortfolio,
  ProviderReviews,
  ProviderSettings,
} = {
  ProviderActiveJobs: lazy(() => import('./pages/provider/ProviderWorkspacePages').then(m => ({ default: m.ProviderActiveJobs }))),
  ProviderAvailability: lazy(() => import('./pages/provider/ProviderWorkspacePages').then(m => ({ default: m.ProviderAvailability }))),
  ProviderBookingHistory: lazy(() => import('./pages/provider/ProviderWorkspacePages').then(m => ({ default: m.ProviderBookingHistory }))),
  ProviderBookingRequests: lazy(() => import('./pages/provider/ProviderWorkspacePages').then(m => ({ default: m.ProviderBookingRequests }))),
  ProviderCertificates: lazy(() => import('./pages/provider/ProviderWorkspacePages').then(m => ({ default: m.ProviderCertificates }))),
  ProviderNotifications: lazy(() => import('./pages/provider/ProviderWorkspacePages').then(m => ({ default: m.ProviderNotifications }))),
  ProviderPortfolio: lazy(() => import('./pages/provider/ProviderWorkspacePages').then(m => ({ default: m.ProviderPortfolio }))),
  ProviderReviews: lazy(() => import('./pages/provider/ProviderWorkspacePages').then(m => ({ default: m.ProviderReviews }))),
  ProviderSettings: lazy(() => import('./pages/provider/ProviderWorkspacePages').then(m => ({ default: m.ProviderSettings }))),
};

// Service Detail
const ServiceDetail      = lazy(() => import('./pages/ServiceDetail'));

// Admin
const AdminLayout       = lazy(() => import('./components/layout/AdminLayout'));
const AdminDashboard    = lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers        = lazy(() => import('./pages/admin/Users'));
const AdminProviders    = lazy(() => import('./pages/admin/Providers'));
const AdminVerification = lazy(() => import('./pages/admin/Verification'));
const AdminBookings     = lazy(() => import('./pages/admin/Bookings'));
const AdminServices     = lazy(() => import('./pages/admin/Services'));
const AdminReviews      = lazy(() => import('./pages/admin/AdminReviews'));
const AdminComplaints   = lazy(() => import('./pages/admin/Complaints'));
const AdminPayments     = lazy(() => import('./pages/admin/Payments'));
const AdminRevenue      = lazy(() => import('./pages/admin/Revenue'));
const AdminNotifications= lazy(() => import('./pages/admin/Notifications'));
const AdminAdmins       = lazy(() => import('./pages/admin/Admins'));
const AdminProfile      = lazy(() => import('./pages/admin/Profile'));

// Chat
const ChatList   = lazy(() => import('./pages/chat/ChatList'));
const ChatWindow = lazy(() => import('./pages/chat/ChatWindow'));
const ProviderProfileEdit = lazy(() => import('./pages/provider/ProviderProfile'));

// ─── React Query client ─────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

// ─── App root ───────────────────────────────────────────────────────────────
const App = () => (
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <BrowserRouter>
        {/* Suspense wraps the entire Routes tree; PageSpinner shows while any
            lazy chunk is being fetched over the network. */}
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            {/* ── Public ──────────────────────────────────────────────────── */}
            <Route path="/"             element={<Landing />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* ── Auth ────────────────────────────────────────────────────── */}
            <Route path="/login"           element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register"        element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

            {/* ── Shared protected ────────────────────────────────────────── */}
            <Route path="/profile"       element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/settings"      element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

            {/* ── Chat ────────────────────────────────────────────────────── */}
            <Route path="/chat"         element={<ProtectedRoute><ChatList /></ProtectedRoute>} />
            <Route path="/chat/:chatId" element={<ProtectedRoute><ChatWindow /></ProtectedRoute>} />

            {/* ── Customer ────────────────────────────────────────────────── */}
            <Route path="/dashboard"      element={<ProtectedRoute roles={['customer']}><CustomerDashboard /></ProtectedRoute>} />
            <Route path="/services"       element={<ProtectedRoute roles={['customer']}><ServiceSearch /></ProtectedRoute>} />
            <Route path="/services/:id"   element={<ServiceDetail />} />
            {/* Public: GET /api/providers/:id needs no auth, and the reviews
                section on this page is the provider's public reputation.
                Booking CTAs still funnel through the customer-guarded routes. */}
            <Route path="/providers/:id"  element={<ProviderProfile />} />
            <Route path="/bookings"       element={<ProtectedRoute roles={['customer']}><BookingsList /></ProtectedRoute>} />
            <Route path="/bookings/new"   element={<ProtectedRoute roles={['customer']}><BookingCreate /></ProtectedRoute>} />
            <Route path="/bookings/:id"   element={<ProtectedRoute roles={['customer']}><BookingDetail /></ProtectedRoute>} />

            {/* ── Provider ────────────────────────────────────────────────── */}
            <Route path="/provider/dashboard"      element={<ProtectedRoute roles={['provider']}><ProviderDashboard /></ProtectedRoute>} />
            <Route path="/provider/bookings"       element={<ProtectedRoute roles={['provider']}><ProviderBookingRequests /></ProtectedRoute>} />
            <Route path="/provider/active-jobs"    element={<ProtectedRoute roles={['provider']}><ProviderActiveJobs /></ProtectedRoute>} />
            <Route path="/provider/history"        element={<ProtectedRoute roles={['provider']}><ProviderBookingHistory /></ProtectedRoute>} />
            <Route path="/provider/bookings/:id"   element={<ProtectedRoute roles={['provider']}><BookingDetail /></ProtectedRoute>} />
            <Route path="/provider/services"       element={<ProtectedRoute roles={['provider']}><ManageServices /></ProtectedRoute>} />
            <Route path="/provider/earnings"       element={<ProtectedRoute roles={['provider']}><Earnings /></ProtectedRoute>} />
            <Route path="/provider/reviews"        element={<ProtectedRoute roles={['provider']}><ProviderReviews /></ProtectedRoute>} />
            <Route path="/provider/portfolio"      element={<ProtectedRoute roles={['provider']}><ProviderPortfolio /></ProtectedRoute>} />
            <Route path="/provider/certificates"   element={<ProtectedRoute roles={['provider']}><ProviderCertificates /></ProtectedRoute>} />
            <Route path="/provider/availability"   element={<ProtectedRoute roles={['provider']}><ProviderAvailability /></ProtectedRoute>} />
            <Route path="/provider/notifications"  element={<ProtectedRoute roles={['provider']}><ProviderNotifications /></ProtectedRoute>} />
            <Route path="/provider/profile"        element={<ProtectedRoute roles={['provider']}><ProviderProfileEdit /></ProtectedRoute>} />
            <Route path="/provider/settings"       element={<ProtectedRoute roles={['provider']}><ProviderSettings /></ProtectedRoute>} />

            {/* ── Admin (nested layout) ────────────────────────────────── */}
            <Route
              path="/admin"
              element={<ProtectedRoute roles={['admin','super_admin']}><AdminLayout /></ProtectedRoute>}
            >
              <Route index                  element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard"       element={<AdminDashboard />} />
              <Route path="users"           element={<AdminUsers />} />
              <Route path="providers"       element={<AdminProviders />} />
              <Route path="verification"    element={<AdminVerification />} />
              <Route path="bookings"        element={<AdminBookings />} />
              <Route path="services"        element={<AdminServices />} />
              <Route path="reviews"         element={<AdminReviews />} />
              <Route path="complaints"      element={<AdminComplaints />} />
              <Route path="payments"        element={<AdminPayments />} />
              <Route path="revenue"         element={<AdminRevenue />} />
              <Route path="notifications"   element={<AdminNotifications />} />
              <Route path="admins"          element={<AdminAdmins />} />
              <Route path="profile"         element={<AdminProfile />} />
            </Route>

            {/* ── Catch-all ───────────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '12px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            },
            success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
      </SidebarProvider>
    </QueryClientProvider>
  </Provider>
);

export default App;
