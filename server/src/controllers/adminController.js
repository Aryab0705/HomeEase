const User = require("../models/User");
const { Provider, LICENSED_CATEGORIES } = require("../models/Provider");
const { Booking } = require("../models/Booking");
const Payment = require("../models/Payment");
const Review = require("../models/Review");
const Dispute = require("../models/Dispute");
const Service = require("../models/Service");
const Notification = require("../models/Notification");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const mongoose = require("mongoose");
const { runOcrOnIdentityDocument } = require("../services/ocrService");

// KEEP EXISTING
const getAnalytics = asyncHandler(async (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now - 180 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalProviders,
    totalBookings,
    totalVerifiedProviders,
    pendingVerifications,
    openDisputes,
    totalServices,
  ] = await Promise.all([
    User.countDocuments({ role: { $ne: "admin" } }),
    Provider.countDocuments(),
    Booking.countDocuments(),
    Provider.countDocuments({ verificationStatus: "verified", "verification.overallStatus": "verified", status: "approved" }),
    Provider.countDocuments({
      $or: [
        { verificationStatus: { $in: ["pending", "under_review"] } },
        { "verification.overallStatus": { $in: ["pending", "under_review"] } },
      ],
      status: { $ne: "rejected" },
      verificationStatus: { $ne: "rejected" },
      "verification.overallStatus": { $ne: "rejected" },
    }),
    Dispute.countDocuments({ status: "open" }),
    Service.countDocuments({ isActive: true }),
  ]);

  const revenueAgg = await Payment.aggregate([
    { $match: { status: { $in: ["success", "settled_to_provider"] } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const totalRevenue = revenueAgg[0]?.total || 0;

  const monthlyBookings = await Booking.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo } } },
    {
      $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const monthlyRevenue = await Payment.aggregate([
    { $match: { status: { $in: ["success", "settled_to_provider"] }, createdAt: { $gte: sixMonthsAgo } } },
    {
      $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        revenue: { $sum: "$amount" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const monthlyUsers = await User.aggregate([
    { $match: { createdAt: { $gte: sixMonthsAgo }, role: { $ne: "admin" } } },
    {
      $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  const bookingStatusBreakdown = await Booking.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const categoryBreakdown = await Booking.aggregate([
    { $lookup: { from: "services", localField: "serviceId", foreignField: "_id", as: "service" } },
    { $unwind: "$service" },
    { $group: { _id: "$service.category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const topProviders = await Provider.find({
    verificationStatus: "verified",
    "verification.overallStatus": "verified",
    status: "approved",
  })
    .populate("userId", "name avatar email")
    .sort({ "rating.average": -1, completedJobs: -1 })
    .limit(5);

  const recentBookings = await Booking.find()
    .populate("customerId", "name email")
    .populate({ path: "providerId", populate: { path: "userId", select: "name" } })
    .populate("serviceId", "name category")
    .sort({ createdAt: -1 })
    .limit(10);

  res.status(200).json(
    new ApiResponse(200, {
      overview: {
        totalUsers, totalProviders, totalBookings, totalRevenue,
        totalVerifiedProviders, pendingVerifications, openDisputes, totalServices,
      },
      charts: {
        monthlyBookings, monthlyRevenue, monthlyUsers,
        bookingStatusBreakdown, categoryBreakdown,
      },
      topProviders, recentBookings,
    })
  );
});

const getPendingProviders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const pendingQuery = {
    $or: [
      { verificationStatus: { $in: ["pending", "under_review"] } },
      { "verification.overallStatus": { $in: ["pending", "under_review"] } },
    ],
    status: { $ne: "rejected" },
    verificationStatus: { $ne: "rejected" },
    "verification.overallStatus": { $ne: "rejected" },
  };
  const providers = await Provider.find(pendingQuery)
    .populate("userId", "name email phone avatar createdAt")
    .sort({ createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));
  const total = await Provider.countDocuments(pendingQuery);
  res.status(200).json(new ApiResponse(200, { providers, pagination: { total, page: parseInt(page), limit: parseInt(limit) } }));
});

const getAdminProviders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query;
  const query = {};

  if (status && status !== "all") {
    if (status === "pending" || status === "under_review") {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { verificationStatus: { $in: ["pending", "under_review"] } },
          { "verification.overallStatus": { $in: ["pending", "under_review"] } },
          { status: "pending" },
        ],
        status: { $ne: "rejected" },
        verificationStatus: { $ne: "rejected" },
        "verification.overallStatus": { $ne: "rejected" },
      });
    } else if (status === "verified") {
      query.$and = query.$and || [];
      query.$and.push({
        verificationStatus: "verified",
        "verification.overallStatus": "verified",
        status: "approved",
      });
    } else if (status === "rejected") {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { verificationStatus: "rejected" },
          { "verification.overallStatus": "rejected" },
          { status: "rejected" },
        ],
      });
    } else {
      query.status = status;
    }
  }

  if (search) {
    const matchingUsers = await User.find({
      $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }],
    }).select("_id");
    const userMatchIds = matchingUsers.map((u) => u._id);
    const searchFilter = {
      $or: [
        { userId: { $in: userMatchIds } },
        { primaryCategory: { $regex: search, $options: "i" } },
      ],
    };
    if (query.$and) {
      query.$and.push(searchFilter);
    } else {
      query.$or = searchFilter.$or;
    }
  }

  const providers = await Provider.find(query)
    .populate("userId", "name email phone avatar createdAt")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Provider.countDocuments(query);

  res.status(200).json(
    new ApiResponse(200, {
      providers,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    })
  );
});

const getAdminUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, isBlocked, search } = req.query;
  const query = {};
  if (role) query.role = role;
  if (isBlocked !== undefined) query.isBlocked = isBlocked === "true";
  if (search) {
    query.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }];
  }
  const users = await User.find(query).skip((page - 1) * limit).limit(parseInt(limit)).sort({ createdAt: -1 });
  const total = await User.countDocuments(query);
  res.status(200).json(new ApiResponse(200, { users, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) } }));
});

// NEW HANDLERS

const getDashboardStats = asyncHandler(async (req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startOfYear = new Date();
  startOfYear.setFullYear(startOfYear.getFullYear() - 1);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalUsers,
    totalCustomers,
    totalProviders,
    activeProviders,
    pendingVerifications,
    totalBookings,
    bookingsToday,
    activeBookings,
    completedBookings,
    cancelledBookings,
    totalRevenueAgg,
    revenueTodayAgg,
    monthlyRevenueAgg,
    providerEarningsAgg,
    paymentStatusAgg,
    totalReviews,
    avgRatingAgg,
    openComplaints,
    totalServices,
    
    // charts
    monthlyBookingsChart,
    monthlyRevenueChart,
    monthlyUsersChart,
    monthlyProvidersChart,
    bookingStatusBreakdownChart,
    categoryBreakdownChart,
    dailyBookingsChart,
    dailyRevenueChart,

    // lists
    recentBookings,
    recentProviders,
    recentCustomers,
    pendingProvidersList,
    recentComplaints,
    topProvidersList,

    // activity sources
    recentUsersAct,
    recentProvidersAct,
    recentBookingsAct,
    recentPaymentsAct,
    recentReviewsAct,
    recentComplaintsAct
  ] = await Promise.all([
    // overview counts
    User.countDocuments({ role: { $ne: "admin" } }),
    User.countDocuments({ role: "customer" }),
    Provider.countDocuments(),
    Provider.countDocuments({ verificationStatus: "verified", "verification.overallStatus": "verified", status: "approved", isActive: true }),
    Provider.countDocuments({
      $or: [
        { verificationStatus: { $in: ["pending", "under_review"] } },
        { "verification.overallStatus": { $in: ["pending", "under_review"] } },
      ],
      status: { $ne: "rejected" },
      verificationStatus: { $ne: "rejected" },
      "verification.overallStatus": { $ne: "rejected" },
    }),
    Booking.countDocuments(),
    Booking.countDocuments({ createdAt: { $gte: startOfDay } }),
    Booking.countDocuments({ status: { $in: ["accepted", "on_the_way", "arrived", "site_visit_completed", "customer_decision"] } }),
    Booking.countDocuments({ status: { $in: ["completed", "settled"] } }),
    Booking.countDocuments({ status: "cancelled" }),
    
    // Captured revenue = success + settled_to_provider
    Payment.aggregate([
      { $match: { status: { $in: ["success", "settled_to_provider"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Payment.aggregate([
      { $match: { status: { $in: ["success", "settled_to_provider"] }, createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Payment.aggregate([
      { $match: { status: { $in: ["success", "settled_to_provider"] }, createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),

    // Provider earnings aggregate from settled site visits
    Booking.aggregate([
      { $match: { settlementStatus: "PROVIDER_EARNED" } },
      { 
        $group: { 
          _id: null, 
          total: { $sum: { $ifNull: ["$siteVisitFee", { $ifNull: ["$consultationFee", "$totalAmount"] }] } },
          count: { $sum: 1 }
        } 
      }
    ]),

    // Payment statuses breakdown
    Payment.aggregate([
      {
        $group: {
          _id: "$status",
          total: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      }
    ]),

    Review.countDocuments(),
    Review.aggregate([
      { $group: { _id: null, avg: { $avg: { $ifNull: ["$overallRating", "$rating"] } } } },
    ]),
    Dispute.countDocuments({ status: "open" }),
    Service.countDocuments(),

    // charts
    Booking.aggregate([
      { $match: { createdAt: { $gte: startOfYear } } },
      { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]),
    Payment.aggregate([
      { $match: { status: { $in: ["success", "settled_to_provider"] }, createdAt: { $gte: startOfYear } } },
      { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, revenue: { $sum: "$amount" } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]),
    User.aggregate([
      { $match: { createdAt: { $gte: startOfYear } } },
      { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]),
    Provider.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      { $match: { "user.createdAt": { $gte: startOfYear } } },
      { $group: { _id: { year: { $year: "$user.createdAt" }, month: { $month: "$user.createdAt" } }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]),
    Booking.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Booking.aggregate([
      { $lookup: { from: "services", localField: "serviceId", foreignField: "_id", as: "service" } },
      { $unwind: "$service" },
      { $group: { _id: "$service.category", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]),
    Payment.aggregate([
      { $match: { status: { $in: ["success", "settled_to_provider"] }, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } }, revenue: { $sum: "$amount" } } },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]),

    // lists
    Booking.find()
      .populate("customerId", "name email")
      .populate({ path: "providerId", populate: { path: "userId", select: "name" } })
      .populate("serviceId", "name category")
      .sort({ createdAt: -1 })
      .limit(8),
    Provider.find().populate("userId", "name email avatar createdAt").sort({ createdAt: -1 }).limit(6),
    User.find({ role: "customer" }).sort({ createdAt: -1 }).limit(6),
    Provider.find({
      $or: [
        { verificationStatus: { $in: ["pending", "under_review"] } },
        { "verification.overallStatus": { $in: ["pending", "under_review"] } },
      ],
      status: { $ne: "rejected" },
      verificationStatus: { $ne: "rejected" },
      "verification.overallStatus": { $ne: "rejected" },
    }).populate("userId", "name email").sort({ createdAt: 1 }).limit(5),
    Dispute.find().populate("raisedBy", "name").populate("raisedAgainst", "name").populate("bookingId").sort({ createdAt: -1 }).limit(5),
    Provider.find({ verificationStatus: "verified", "verification.overallStatus": "verified", status: "approved" }).populate("userId", "name email avatar").sort({ "rating.average": -1 }).limit(5),

    // Activity sources
    User.find().sort({ createdAt: -1 }).limit(6),
    Provider.find().populate("userId", "name").sort({ createdAt: -1 }).limit(6),
    Booking.find().populate("customerId", "name").sort({ createdAt: -1 }).limit(8),
    Payment.find().populate("customerId", "name").sort({ createdAt: -1 }).limit(6),
    Review.find().populate("customerId", "name").sort({ createdAt: -1 }).limit(6),
    Dispute.find().sort({ createdAt: -1 }).limit(6),
  ]);

  const totalRevenue = totalRevenueAgg[0]?.total || 0;
  const revenueToday = revenueTodayAgg[0]?.total || 0;
  const monthlyRevenue = monthlyRevenueAgg[0]?.total || 0;
  const totalProviderEarnings = providerEarningsAgg[0]?.total || 0;
  const settledVisitsCount = providerEarningsAgg[0]?.count || 0;
  const platformCommission = Math.max(0, monthlyRevenue * 0.15);
  const avgRating = avgRatingAgg[0]?.avg || 0;

  // Payment breakdown stats
  const successPaymentStat = paymentStatusAgg.find(p => p._id === "success");
  const settledPaymentStat = paymentStatusAgg.find(p => p._id === "settled_to_provider");
  const refundedPaymentStat = paymentStatusAgg.find(p => p._id === "refunded");
  const failedPaymentStat = paymentStatusAgg.find(p => p._id === "failed");
  const pendingPaymentStat = paymentStatusAgg.find(p => p._id === "pending");

  const successfulPaymentsCount = (successPaymentStat?.count || 0) + (settledPaymentStat?.count || 0);
  const refundedPaymentsCount = refundedPaymentStat?.count || 0;
  const refundedAmount = refundedPaymentStat?.total || 0;
  const failedPaymentsCount = failedPaymentStat?.count || 0;
  const pendingPaymentsCount = pendingPaymentStat?.count || 0;

  // Helper for human-readable time ago
  const getTimeAgo = (date) => {
    if (!date) return "Just now";
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diff < 60) return `${Math.max(1, diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // Build real-time activity feed
  const recentActivity = [];
  recentUsersAct.forEach(u => {
    recentActivity.push({
      type: "user_registered",
      title: "New User Registered",
      description: `Customer ${u.name || u.email} created an account.`,
      time: u.createdAt,
      timeAgo: getTimeAgo(u.createdAt),
      icon: "user"
    });
  });
  recentProvidersAct.forEach(p => {
    recentActivity.push({
      type: "provider_registered",
      title: "Provider Registration",
      description: `Provider ${p.userId?.name || "Professional"} (${p.primaryCategory || "Services"}) joined.`,
      time: p.createdAt,
      timeAgo: getTimeAgo(p.createdAt),
      icon: "provider"
    });
  });
  recentBookingsAct.forEach(b => {
    const fee = b.siteVisitFee || b.consultationFee || b.totalAmount || 0;
    const feeStr = fee > 0 ? ` (Visit Fee: ₹${fee})` : "";
    recentActivity.push({
      type: "booking_created",
      title: `Site Visit: ${b.status?.toUpperCase()?.replace(/_/g, " ")}`,
      description: `Booking #${b._id.toString().slice(-6).toUpperCase()}${feeStr} status updated to ${b.status}.`,
      time: b.updatedAt || b.createdAt,
      timeAgo: getTimeAgo(b.updatedAt || b.createdAt),
      icon: "booking"
    });
  });
  recentPaymentsAct.forEach(pm => {
    recentActivity.push({
      type: "payment_recorded",
      title: `Payment ${pm.status?.toUpperCase()?.replace(/_/g, " ")}`,
      description: `₹${pm.amount?.toLocaleString("en-IN")} via ${pm.method || "Razorpay"} - ${pm.status}.`,
      time: pm.createdAt,
      timeAgo: getTimeAgo(pm.createdAt),
      icon: "payment"
    });
  });
  recentReviewsAct.forEach(r => {
    recentActivity.push({
      type: "review_submitted",
      title: "New Review Received",
      description: `Review from ${r.customerId?.name || "Customer"} (${r.overallRating ?? r.rating ?? "?"} stars).`,
      time: r.createdAt,
      timeAgo: getTimeAgo(r.createdAt),
      icon: "review"
    });
  });
  recentComplaintsAct.forEach(c => {
    recentActivity.push({
      type: "complaint_raised",
      title: "Dispute / Complaint Raised",
      description: `Complaint regarding booking #${c.bookingId?.toString().slice(-6).toUpperCase() || "N/A"}.`,
      time: c.createdAt,
      timeAgo: getTimeAgo(c.createdAt),
      icon: "complaint"
    });
  });

  recentActivity.sort((a, b) => new Date(b.time) - new Date(a.time));
  const topRecentActivity = recentActivity.slice(0, 15);

  res.status(200).json(new ApiResponse(200, {
    overview: {
      totalUsers,
      totalCustomers,
      totalProviders,
      activeProviders,
      pendingVerifications,
      totalBookings,
      bookingsToday,
      activeBookings,
      completedBookings,
      cancelledBookings,
      completedSiteVisits: completedBookings,
      cancelledSiteVisits: cancelledBookings,
      totalRevenue,
      revenueToday,
      monthlyRevenue,
      totalProviderEarnings,
      settledVisitsCount,
      platformCommission,
      successfulPaymentsCount,
      refundedPaymentsCount,
      refundedAmount,
      failedPaymentsCount,
      pendingPaymentsCount,
      totalReviews,
      avgRating,
      openComplaints,
      totalServices
    },
    charts: {
      monthlyBookings: monthlyBookingsChart,
      monthlyRevenue: monthlyRevenueChart,
      revenue: monthlyRevenueChart, // alias
      monthlyUsers: monthlyUsersChart,
      monthlyProviders: monthlyProvidersChart,
      providerGrowth: monthlyProvidersChart, // alias
      bookingStatusBreakdown: bookingStatusBreakdownChart,
      categoryBreakdown: categoryBreakdownChart,
      topCategories: categoryBreakdownChart, // alias
      dailyBookings: dailyBookingsChart,
      dailyRevenue: dailyRevenueChart
    },
    recentBookings,
    recentProviders,
    recentCustomers,
    pendingProviders: pendingProvidersList,
    pendingVerificationsList: pendingProvidersList, // alias
    recentComplaints,
    recentActivity: topRecentActivity,
    activityFeed: topRecentActivity, // alias
    topProviders: topProvidersList
  }));
});

const getAdminBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 15, status, search, startDate, endDate } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.scheduledDate = {};
    if (startDate) filter.scheduledDate.$gte = new Date(startDate);
    if (endDate) filter.scheduledDate.$lte = new Date(endDate);
  }

  let matchQuery = { ...filter };
  
  if (search) {
    const matchingCustomers = await User.find({ name: { $regex: search, $options: "i" } }).select("_id");
    const matchingServices = await Service.find({ name: { $regex: search, $options: "i" } }).select("_id");
    
    matchQuery.$or = [
      { customerId: { $in: matchingCustomers.map(c => c._id) } },
      { serviceId: { $in: matchingServices.map(s => s._id) } }
    ];
  }

  const bookings = await Booking.find(matchQuery)
    .populate("customerId", "name email")
    .populate({ path: "providerId", populate: { path: "userId", select: "name" } })
    .populate("serviceId", "name category")
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await Booking.countDocuments(matchQuery);
  const pending = await Booking.countDocuments({ ...filter, status: "pending" });
  const active = await Booking.countDocuments({ ...filter, status: { $in: ["accepted", "on_the_way", "arrived", "site_visit_completed", "customer_decision"] } });
  const completed = await Booking.countDocuments({ ...filter, status: { $in: ["completed", "settled"] } });
  const cancelled = await Booking.countDocuments({ ...filter, status: "cancelled" });
  
  const revenueAgg = await Payment.aggregate([
    { $match: { status: { $in: ["success", "settled_to_provider"] } } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  
  const totalRevenue = revenueAgg[0]?.total || 0;

  res.status(200).json(new ApiResponse(200, {
    bookings,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    summary: { total, pending, active, completed, cancelled, totalRevenue }
  }));
});

const getAdminRevenue = asyncHandler(async (req, res) => {
  const period = req.query.period || "monthly";
  let startDate = new Date();
  let groupBy = {};
  
  if (period === "daily") {
    startDate.setDate(startDate.getDate() - 30);
    groupBy = { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } };
  } else if (period === "weekly") {
    startDate.setDate(startDate.getDate() - 7 * 12);
    groupBy = { year: { $isoWeekYear: "$createdAt" }, week: { $isoWeek: "$createdAt" } };
  } else if (period === "yearly") {
    startDate.setFullYear(startDate.getFullYear() - 5);
    groupBy = { year: { $year: "$createdAt" } };
  } else {
    // monthly default
    startDate.setFullYear(startDate.getFullYear() - 1);
    groupBy = { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } };
  }

  const dataAgg = await Payment.aggregate([
    { $match: { status: { $in: ["success", "settled_to_provider"] }, createdAt: { $gte: startDate } } },
    { 
      $group: { 
        _id: groupBy, 
        revenue: { $sum: "$amount" },
        bookings: { $sum: 1 } 
      } 
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.week": 1, "_id.day": 1 } }
  ]);

  const providerEarningsAgg = await Booking.aggregate([
    { $match: { settlementStatus: "PROVIDER_EARNED", settledAt: { $gte: startDate } } },
    { $group: { _id: null, total: { $sum: { $ifNull: ["$siteVisitFee", { $ifNull: ["$consultationFee", "$totalAmount"] }] } } } }
  ]);
  const totalProviderEarnings = providerEarningsAgg[0]?.total || 0;

  let totalRevenue = 0;
  let totalBookings = 0;

  const data = dataAgg.map(item => {
    let label = "";
    if (period === "daily") label = `${item._id.year}-${item._id.month}-${item._id.day}`;
    else if (period === "weekly") label = `${item._id.year}-W${item._id.week}`;
    else if (period === "yearly") label = `${item._id.year}`;
    else label = `${item._id.year}-${item._id.month}`;

    totalRevenue += item.revenue;
    totalBookings += item.bookings;
    return { label, revenue: item.revenue, bookings: item.bookings, commission: item.revenue * 0.15 };
  });

  res.status(200).json(new ApiResponse(200, {
    period,
    data,
    totals: {
      revenue: totalRevenue,
      bookings: totalBookings,
      commission: totalRevenue * 0.15,
      providerEarnings: totalProviderEarnings
    }
  }));
});

const getAdminComplaints = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const disputes = await Dispute.find(filter)
    .populate("raisedBy", "name email avatar")
    .populate("raisedAgainst", "name email")
    .populate("bookingId", "status totalAmount serviceId")
    .populate("resolvedBy", "name")
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await Dispute.countDocuments(filter);
  const open = await Dispute.countDocuments({ status: "open" });
  const under_review = await Dispute.countDocuments({ status: "under_review" });
  const resolved = await Dispute.countDocuments({ status: "resolved" });
  const closed = await Dispute.countDocuments({ status: "closed" });

  res.status(200).json(new ApiResponse(200, {
    disputes,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    summary: { open, under_review, resolved, closed }
  }));
});

const getAdminReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, minRating, maxRating } = req.query;
  const filter = {};
  if (minRating || maxRating) {
    const range = {};
    if (minRating) range.$gte = Number(minRating);
    if (maxRating) range.$lte = Number(maxRating);
    // Two things going on here:
    //
    // 1. config/db enables `sanitizeFilter` globally, which rewrites any filter
    //    value containing $-keys into `{ $eq: <that object> }` — silently
    //    matching zero documents. Both bounds are coerced to Numbers from the
    //    query string, so the range is safe to mark trusted. (`$expr` is not an
    //    option: sanitizeFilter throws outright on it.)
    // 2. Reviews store the score on `overallRating`, but legacy documents only
    //    have a top-level `rating`. Every other read path coalesces the two via
    //    `$ifNull`, so filtering on `overallRating` alone would drop legacy rows
    //    from the list while still counting them in the summary.
    filter.$or = [
      { overallRating: mongoose.trusted({ ...range }) },
      { overallRating: null, rating: mongoose.trusted({ ...range }) },
    ];
  }

  const reviews = await Review.find(filter)
    .populate("customerId", "name email avatar")
    .populate({ path: "providerId", populate: { path: "userId", select: "name" } })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await Review.countDocuments(filter);

  // `$match: filter` keeps the summary describing the SAME set of reviews the
  // list shows. Without it, filtering to "5 stars only" left the sidebar totals
  // reporting whole-database numbers next to a filtered table.
  const ratingAgg = await Review.aggregate([
    { $match: filter },
    { $group: { _id: { $ifNull: ["$overallRating", "$rating"] }, count: { $sum: 1 } } }
  ]);

  let avgRating = 0;
  let fiveStar = 0, fourStar = 0, threeStar = 0, twoStar = 0, oneStar = 0;
  let totalRatingSum = 0;

  ratingAgg.forEach(r => {
    // Only whole 1-5 scores are counted. A null bucket (neither field set) or a
    // stray fractional legacy value would otherwise add to the sum while being
    // excluded from `allCount`, skewing the average upward.
    const score = Number(r._id);
    if (!Number.isInteger(score) || score < 1 || score > 5) return;
    if (score === 5) fiveStar = r.count;
    else if (score === 4) fourStar = r.count;
    else if (score === 3) threeStar = r.count;
    else if (score === 2) twoStar = r.count;
    else if (score === 1) oneStar = r.count;
    totalRatingSum += score * r.count;
  });
  
  const allCount = fiveStar + fourStar + threeStar + twoStar + oneStar;
  if (allCount > 0) avgRating = totalRatingSum / allCount;

  res.status(200).json(new ApiResponse(200, {
    reviews,
    pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    summary: { total: allCount, avgRating, fiveStar, fourStar, threeStar, twoStar, oneStar }
  }));
});

const getActivityLog = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  const fetchLimit = skip + parseInt(limit);
  
  const [users, providers, bookings, reviews, complaints] = await Promise.all([
    User.find().sort({ createdAt: -1 }).limit(fetchLimit),
    Provider.find().populate("userId", "name").sort({ createdAt: -1 }).limit(fetchLimit),
    Booking.find().sort({ createdAt: -1 }).limit(fetchLimit),
    Review.find().populate("customerId", "name").sort({ createdAt: -1 }).limit(fetchLimit),
    Dispute.find().sort({ createdAt: -1 }).limit(fetchLimit),
  ]);

  const recentActivity = [];
  users.forEach(u => recentActivity.push({ type: "user_registered", title: "New User Registered", description: `User ${u.name || u.email} joined.`, time: u.createdAt, icon: "user" }));
  providers.forEach(p => recentActivity.push({ type: "provider_registered", title: "New Provider Registered", description: `Provider ${p.userId?.name || "Unknown"} registered.`, time: p.createdAt, icon: "provider" }));
  bookings.forEach(b => recentActivity.push({ type: "booking_created", title: "New Booking", description: `Booking created with status ${b.status}.`, time: b.createdAt, icon: "booking" }));
  reviews.forEach(r => recentActivity.push({ type: "review_submitted", title: "Review Submitted", description: `Review from ${r.customerId?.name || "User"} (${r.overallRating ?? r.rating ?? "?"} stars).`, time: r.createdAt, icon: "review" }));
  complaints.forEach(c => recentActivity.push({ type: "complaint_raised", title: "New Complaint", description: `Dispute raised for booking ${c.bookingId}.`, time: c.createdAt, icon: "complaint" }));

  recentActivity.sort((a, b) => b.time - a.time);
  
  const paginatedActivity = recentActivity.slice(skip, skip + parseInt(limit));

  res.status(200).json(new ApiResponse(200, {
    activity: paginatedActivity,
    pagination: { page: parseInt(page), limit: parseInt(limit) }
  }));
});

const globalSearch = asyncHandler(async (req, res) => {
  const q = (req.query.q || "").trim();

  if (q.length < 2) {
    return res.status(200).json(new ApiResponse(200, { users: [], providers: [], bookings: [] }));
  }

  // Escape special regex chars to prevent injection
  const safeQ   = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regexVal = new RegExp(safeQ, "i");

  // â”€â”€ 100% raw MongoDB driver â€” bypasses ALL Mongoose schema validators â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Mongoose 8 triggers field-level validators (match, ref checks) even on .find()
  // when query values are objects like RegExp or { $in: [...] }.
  // Using collection.find() directly avoids this entirely.

  // 1. Search users by name or email
  const rawUsers = await User.collection
    .find({ $or: [{ name: regexVal }, { email: regexVal }] })
    .project({ name: 1, email: 1, role: 1, avatar: 1, isVerified: 1, isBlocked: 1, createdAt: 1 })
    .limit(5)
    .toArray();

  // 2. Find matching provider user IDs
  const providerUserIds = rawUsers
    .filter(u => u.role === "provider")
    .map(u => u._id);

  const extraProviderUsers = await User.collection
    .find({ name: regexVal, role: "provider" })
    .project({ _id: 1 })
    .limit(10)
    .toArray();

  const allProviderUserIds = [
    ...new Set([
      ...providerUserIds.map(String),
      ...extraProviderUsers.map(u => String(u._id)),
    ]),
  ].map(id => new mongoose.Types.ObjectId(id));

  // 3. Fetch provider records (raw)
  const rawProviders = allProviderUserIds.length > 0
    ? await Provider.collection
        .find({ userId: { $in: allProviderUserIds } })
        .project({ userId: 1, primaryCategory: 1, verificationStatus: 1, rating: 1, completedJobs: 1, experience: 1 })
        .limit(5)
        .toArray()
    : [];

  // Manually attach user data to providers
  const userMap = Object.fromEntries(rawUsers.map(u => [String(u._id), u]));
  const providers = rawProviders.map(p => ({
    ...p,
    userId: userMap[String(p.userId)] || { _id: p.userId },
  }));

  // 4. Search bookings by ObjectId or by customer name (raw driver)
  let bookings = [];
  if (mongoose.Types.ObjectId.isValid(q)) {
    bookings = await Booking.collection
      .find({ _id: new mongoose.Types.ObjectId(q) })
      .project({ customerId: 1, serviceId: 1, status: 1, totalAmount: 1, scheduledDate: 1 })
      .limit(5)
      .toArray();
  } else {
    const matchingCustomers = await User.collection
      .find({ name: regexVal })
      .project({ _id: 1 })
      .limit(20)
      .toArray();

    if (matchingCustomers.length > 0) {
      const customerIdList = matchingCustomers.map(c => c._id);
      bookings = await Booking.collection
        .find({ customerId: { $in: customerIdList } })
        .project({ customerId: 1, serviceId: 1, status: 1, totalAmount: 1, scheduledDate: 1 })
        .limit(5)
        .toArray();
    }
  }

  res.status(200).json(new ApiResponse(200, { users: rawUsers, providers, bookings }));
});

const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, resolution, adminNotes } = req.body;

  const updateFields = { status, resolution, adminNotes };
  if (status === "resolved" || status === "closed") {
    updateFields.resolvedBy = req.user._id;
    updateFields.resolvedAt = new Date();
  }

  const dispute = await Dispute.findByIdAndUpdate(
    id,
    { $set: updateFields },
    { new: true, runValidators: true }
  );

  if (!dispute) {
    throw new ApiError(404, "Complaint not found");
  }

  res.status(200).json(new ApiResponse(200, dispute));
});

// ─────────────────────────────────────────────────────────────────────────────
// Payments & Transactions
// ─────────────────────────────────────────────────────────────────────────────
const getAdminPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 15, status, method, search } = req.query;
  const query = {};

  if (status && status !== "all") {
    if (status === "captured") {
      query.status = { $in: ["success", "settled_to_provider"] };
    } else {
      query.status = status;
    }
  }
  if (method && method !== "all") query.method = method;

  if (search) {
    const matchingUsers = await User.find({
      $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }],
    }).select("_id");
    query.customerId = { $in: matchingUsers.map((u) => u._id) };
  }

  const payments = await Payment.find(query)
    .populate("customerId", "name email avatar")
    .populate({ path: "providerId", populate: { path: "userId", select: "name email" } })
    .populate("bookingId", "scheduledDate status serviceId siteVisitFee consultationFee settlementStatus totalAmount")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Payment.countDocuments(query);

  const totalsAgg = await Payment.aggregate([
    {
      $group: {
        _id: "$status",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const successAmt = totalsAgg.find((t) => t._id === "success")?.totalAmount || 0;
  const settledAmt = totalsAgg.find((t) => t._id === "settled_to_provider")?.totalAmount || 0;
  const refundAmt = totalsAgg.find((t) => t._id === "refunded")?.totalAmount || 0;

  const summary = {
    totalRevenue: successAmt + settledAmt,
    capturedCount: (totalsAgg.find((t) => t._id === "success")?.count || 0) + (totalsAgg.find((t) => t._id === "settled_to_provider")?.count || 0),
    successfulCount: totalsAgg.find((t) => t._id === "success")?.count || 0,
    settledToProviderCount: totalsAgg.find((t) => t._id === "settled_to_provider")?.count || 0,
    settledToProviderAmount: settledAmt,
    refundedCount: totalsAgg.find((t) => t._id === "refunded")?.count || 0,
    refundedAmount: refundAmt,
    pendingCount: totalsAgg.find((t) => t._id === "pending")?.count || 0,
    failedCount: totalsAgg.find((t) => t._id === "failed")?.count || 0,
  };

  res.status(200).json(
    new ApiResponse(200, {
      payments,
      summary,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Service & Category Management
// ─────────────────────────────────────────────────────────────────────────────
const createService = asyncHandler(async (req, res) => {
  const { name, category, description, basePrice, priceUnit, tags } = req.body;

  const existing = await Service.findOne({ name });
  if (existing) throw new ApiError(409, "A service with this name already exists.");

  const service = await Service.create({
    name,
    category,
    description,
    basePrice,
    priceUnit: priceUnit || "per visit",
    tags: tags || [],
  });

  res.status(201).json(new ApiResponse(201, service, "Service created successfully."));
});

const updateService = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const service = await Service.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!service) throw new ApiError(404, "Service not found.");

  res.status(200).json(new ApiResponse(200, service, "Service updated successfully."));
});

const toggleServiceStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const service = await Service.findById(id);
  if (!service) throw new ApiError(404, "Service not found.");

  service.isActive = !service.isActive;
  await service.save();

  res.status(200).json(new ApiResponse(200, service, `Service ${service.isActive ? "activated" : "deactivated"}.`));
});

// ─────────────────────────────────────────────────────────────────────────────
// Verification Detail & Action
// ─────────────────────────────────────────────────────────────────────────────
const getVerificationRequests = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status = "all" } = req.query;

  let query = {};
  if (status === "pending" || status === "under_review") {
    query = {
      $or: [
        { verificationStatus: { $in: ["pending", "under_review"] } },
        { "verification.overallStatus": { $in: ["pending", "under_review"] } },
      ],
      status: { $ne: "rejected" },
      verificationStatus: { $ne: "rejected" },
      "verification.overallStatus": { $ne: "rejected" },
    };
  } else if (status === "verified") {
    query = {
      verificationStatus: "verified",
      "verification.overallStatus": "verified",
      status: "approved",
    };
  } else if (status === "rejected") {
    query = {
      $or: [
        { verificationStatus: "rejected" },
        { "verification.overallStatus": "rejected" },
        { status: "rejected" },
      ],
    };
  }

  const providers = await Provider.find(query)
    .populate("userId", "name email phone avatar createdAt")
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Provider.countDocuments(query);

  res.status(200).json(
    new ApiResponse(200, {
      providers,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin Notifications & Broadcast
// ─────────────────────────────────────────────────────────────────────────────
const sendAdminNotification = asyncHandler(async (req, res) => {
  const { title, message, targetRole } = req.body;

  if (!title || !message) throw new ApiError(400, "Title and message are required.");

  let userQuery = {};
  if (targetRole && targetRole !== "all") {
    userQuery.role = targetRole;
  }

  const users = await User.find(userQuery).select("_id");
  const notifications = users.map((user) => ({
    userId: user._id,
    title,
    message,
    type: "system",
  }));

  if (notifications.length > 0) {
    await Notification.insertMany(notifications);
  }

  res.status(200).json(
    new ApiResponse(200, { count: notifications.length }, `Announcement sent to ${notifications.length} users.`)
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Super Admin — Admin Management
// ─────────────────────────────────────────────────────────────────────────────
const getAdmins = asyncHandler(async (req, res) => {
  const admins = await User.find({ role: { $in: ["admin", "super_admin"] } })
    .select("-password")
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, admins, "Admins fetched."));
});

const createAdminAccount = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  const assignedRole = role === "super_admin" ? "super_admin" : "admin";

  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "User with this email already exists.");

  const admin = await User.create({
    name,
    email,
    password,
    phone,
    role: assignedRole,
    isVerified: true,
  });

  res.status(201).json(
    new ApiResponse(201, {
      _id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      createdAt: admin.createdAt,
    }, "Admin account created successfully.")
  );
});

const toggleAdminBlock = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (String(id) === String(req.user._id)) {
    throw new ApiError(400, "You cannot suspend your own account.");
  }

  const admin = await User.findById(id);
  if (!admin || !["admin", "super_admin"].includes(admin.role)) {
    throw new ApiError(404, "Admin user not found.");
  }

  admin.isBlocked = !admin.isBlocked;
  await admin.save();

  res.status(200).json(new ApiResponse(200, admin, `Admin account ${admin.isBlocked ? "suspended" : "activated"}.`));
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin — Granular Verification
// ─────────────────────────────────────────────────────────────────────────────
const getProviderVerificationDetail = asyncHandler(async (req, res) => {
  const provider = await Provider.findById(req.params.id)
    .populate("userId", "name email phone avatar address createdAt");
  if (!provider) throw new ApiError(404, "Provider not found.");

  // Auto-process pending OCR if identity documents were uploaded but OCR has not yet run
  if (
    provider.verification?.identity?.documents?.length > 0 &&
    (!provider.verification.identity.ocrResult ||
      provider.verification.identity.ocrResult.status === "pending" ||
      !provider.verification.identity.ocrResult.extractedEntities?.extractedName)
  ) {
    try {
      const primaryDoc = provider.verification.identity.documents[0];
      const userProfile = {
        name: provider.userId?.name || "",
        email: provider.userId?.email || "",
        phone: provider.userId?.phone || "",
        city: provider.userId?.address?.city || provider.serviceArea?.city || "",
      };

      console.log(`[Admin API] Auto-processing pending OCR for Provider ${provider._id}...`);
      const ocrOutcome = await runOcrOnIdentityDocument(
        primaryDoc.url,
        "image/jpeg",
        userProfile,
        primaryDoc.docType || "Government ID"
      );

      provider.verification.identity.ocrResult = ocrOutcome;
      if (ocrOutcome.extractedEntities) {
        provider.verification.identity.extractedInfo = {
          name: ocrOutcome.extractedEntities.extractedName || "",
          documentNumber: ocrOutcome.extractedEntities.extractedDocNumber || "",
          documentType: ocrOutcome.extractedEntities.extractedDocType || primaryDoc.docType,
          rawSummary: ocrOutcome.extractedEntities.rawSummary || "",
        };
      }

      provider.markModified("verification");
      await provider.save();
      console.log(`[Admin API] Auto-processed OCR saved to MongoDB for Provider ${provider._id}.`);
    } catch (e) {
      console.error(`[Admin API] Auto-process error for Provider ${provider._id}:`, e.message);
    }
  }

  const qualificationRequired = LICENSED_CATEGORIES.includes(provider.primaryCategory);

  res.status(200).json(
    new ApiResponse(200, {
      provider,
      qualificationRequired,
      licensedCategories: LICENSED_CATEGORIES,
    }, "Provider verification detail fetched.")
  );
});

const adminVerifyCategory = asyncHandler(async (req, res) => {
  const { category, action, notes } = req.body;

  const validCategories = ["identity", "experience", "skills", "qualification"];
  if (!validCategories.includes(category)) {
    throw new ApiError(400, "Category must be one of: identity, experience, skills, qualification.");
  }

  const validActions = ["verify", "reject", "mismatch"];
  if (!validActions.includes(action)) {
    throw new ApiError(400, "Action must be one of: verify, reject, mismatch.");
  }

  // 'mismatch' only valid for identity
  if (action === "mismatch" && category !== "identity") {
    throw new ApiError(400, "Mismatch action is only valid for identity verification.");
  }

  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new ApiError(404, "Provider not found.");

  if (!provider.verification) provider.verification = {};
  if (!provider.verification[category]) provider.verification[category] = {};

  const statusMap = { verify: "verified", reject: "rejected", mismatch: "mismatch" };
  provider.verification[category].status = statusMap[action];
  provider.verification[category].reviewedAt = new Date();
  provider.verification[category].reviewedBy = req.user._id;
  if (notes) provider.verification[category].adminNotes = notes;

  // Evaluate overall status impact
  if (action === "reject" || action === "mismatch") {
    // If any pillar is rejected or mismatched, provider cannot remain verified
    provider.verification.overallStatus = "under_review";
    provider.verificationStatus = "under_review";
    provider.status = "pending";
    provider.isActive = false;
  } else if (action === "verify") {
    const isLicensed = LICENSED_CATEGORIES.includes(provider.primaryCategory);
    const idOk = provider.verification.identity?.status === "verified";
    const expOk = provider.verification.experience?.status === "verified";
    const skillsOk = provider.verification.skills?.status === "verified";
    const qualOk = !isLicensed || provider.verification.qualification?.status === "verified";

    if (idOk && expOk && skillsOk && qualOk) {
      provider.verification.overallStatus = "verified";
      provider.verificationStatus = "verified";
      provider.status = "approved";
      provider.profileCompleted = true;
      provider.isActive = true;
      provider.verification.lastReviewedAt = new Date();
      provider.verification.lastReviewedBy = req.user._id;
    }
  }

  provider.markModified("verification");
  await provider.save();

  res.status(200).json(
    new ApiResponse(200, {
      verification: provider.verification,
      overallStatus: provider.verification.overallStatus,
      status: provider.status,
      isActive: provider.isActive,
    }, `${category} verification ${statusMap[action]}.`)
  );
});

module.exports = {
  getAnalytics,
  getPendingProviders,
  getAdminProviders,
  getAdminUsers,
  getDashboardStats,
  getAdminBookings,
  getAdminRevenue,
  getAdminComplaints,
  getAdminReviews,
  getActivityLog,
  globalSearch,
  updateComplaintStatus,
  getAdminPayments,
  createService,
  updateService,
  toggleServiceStatus,
  getVerificationRequests,
  sendAdminNotification,
  getAdmins,
  createAdminAccount,
  toggleAdminBlock,
  getProviderVerificationDetail,
  adminVerifyCategory,
};
