const { Provider, SERVICE_CATEGORIES, LICENSED_CATEGORIES } = require("../models/Provider");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { uploadToCloudinary, deleteFromCloudinary } = require("../services/cloudinaryService");
const { ensureAvailabilityStructure } = require("../utils/availabilityHelper");
const { runOcrOnDocument, runOcrOnIdentityDocument } = require("../services/ocrService");

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/providers
// @access  Public — list & filter providers
// ─────────────────────────────────────────────────────────────────────────────
const getProviders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 12,
    category,
    city,
    minRating,
    maxPrice,
    sortBy = "rating",
    search,
    verificationStatus,
  } = req.query;

  const isAdminRequest = req.user?.role === "admin";
  const query = isAdminRequest
    ? (verificationStatus && verificationStatus !== "all"
        ? { verificationStatus }
        : {})
    : {
        verificationStatus: "verified",
        "verification.overallStatus": "verified",
        status: "approved",
        profileCompleted: true,
        isActive: true,
        "availability.isAvailable": true,
      };

  let sortOptions = {};
  if (sortBy === "rating") sortOptions = { "rating.average": -1 };
  else if (sortBy === "experience") sortOptions = { experience: -1 };
  else if (sortBy === "jobs") sortOptions = { completedJobs: -1 };
  else if (sortBy === "newest") sortOptions = { createdAt: -1 };

  const allProviders = await Provider.find(query)
    .populate("userId", "name email phone avatar address")
    .sort(sortOptions)
    .lean();

  const activeProviders = isAdminRequest
    ? allProviders
    : allProviders.filter((provider) => {
        const services = provider.services || [];
        const hasCategory = Boolean(provider.primaryCategory || services[0]?.category);
        const hasCity = Boolean(provider.serviceArea?.city);
        const hasPrice = [provider.startingPrice, provider.hourlyRate, ...services.map((service) => service.basePrice)]
          .some((price) => Number(price || 0) > 0);
        return provider.userId && !provider.userId.isBlocked && services.length > 0 && hasCategory && hasCity && hasPrice;
      });

  const categoryRegex = category ? new RegExp(`^${escapeRegex(category)}$`, "i") : null;
  const cityRegex = city ? new RegExp(escapeRegex(city), "i") : null;
  const minRatingValue = minRating ? parseFloat(minRating) : null;
  const maxPriceValue = maxPrice ? parseFloat(maxPrice) : null;

  const filteredProviders = activeProviders.filter((provider) => {
    // Match requested category against primaryCategory, subCategories, or services[].category
    if (categoryRegex) {
      const offeredCategories = [
        provider.primaryCategory,
        ...(provider.subCategories || []),
        ...(provider.services || []).map((s) => s.category),
      ].filter(Boolean);

      const matchesCategory = offeredCategories.some((cat) => categoryRegex.test(String(cat)));
      if (!matchesCategory) return false;
    }

    if (cityRegex && !cityRegex.test(String(provider.serviceArea?.city || ""))) return false;

    if (minRatingValue !== null && Number(provider.rating?.average || 0) < minRatingValue) return false;

    if (maxPriceValue !== null) {
      const prices = [
        provider.startingPrice,
        provider.hourlyRate,
        ...(provider.services || []).map((service) => service.basePrice),
      ].map((price) => Number(price || 0)).filter((price) => price > 0);
      if (!prices.some((price) => price <= maxPriceValue)) return false;
    }

    return true;
  });

  const searchRegex = search ? new RegExp(escapeRegex(search), "i") : null;
  const visibleProviders = searchRegex
    ? filteredProviders.filter((provider) => {
        const searchable = [
          provider.userId?.name,
          provider.userId?.email,
          provider.userId?.phone,
          provider.primaryCategory,
          ...(provider.subCategories || []),
          ...(provider.skills || []),
          ...(provider.services || []).flatMap((service) => [
            service.name,
            service.category,
            service.description,
          ]),
        ];
        return searchable.some((value) => searchRegex.test(String(value || "")));
      })
    : filteredProviders;

  const start = (page - 1) * limit;
  const providers = visibleProviders.slice(start, start + parseInt(limit));
  const total = visibleProviders.length;

  res.status(200).json(
    new ApiResponse(200, {
      providers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
      categories: SERVICE_CATEGORIES,
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/providers/:id
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const getProviderById = asyncHandler(async (req, res) => {
  const provider = await Provider.findById(req.params.id).populate(
    "userId",
    "name email phone avatar address"
  );
  if (!provider) throw new ApiError(404, "Provider not found.");

  const isOwner = req.user && provider.userId && String(provider.userId._id || provider.userId) === String(req.user._id);
  const isAdmin = req.user?.role === "admin";
  if (!isAdmin && !isOwner) {
    if (
      provider.verificationStatus !== "verified" ||
      provider.verification?.overallStatus !== "verified" ||
      provider.status !== "approved" ||
      !provider.isActive
    ) {
      throw new ApiError(403, "This provider profile is pending verification or is not currently active.");
    }
  }

  // Convert to object and strip raw documents/verification attachments for public response
  const sanitized = provider.toObject ? provider.toObject() : { ...provider };
  if (sanitized.documents) delete sanitized.documents;
  if (sanitized.aadharNumber) delete sanitized.aadharNumber;

  // For verification, keep safe trust badges and statuses only, strip raw evidence and OCR text
  if (sanitized.verification) {
    sanitized.verification = {
      overallStatus: sanitized.verification.overallStatus,
      identity: { status: sanitized.verification.identity?.status },
      experience: {
        status: sanitized.verification.experience?.status,
        yearsOfExperience: sanitized.verification.experience?.yearsOfExperience ?? sanitized.experience,
      },
      skills: {
        status: sanitized.verification.skills?.status,
        skillsList: sanitized.verification.skills?.skillsList || [],
      },
      qualification: {
        status: sanitized.verification.qualification?.status,
        isRequired: sanitized.verification.qualification?.isRequired,
      },
    };
  }

  res.status(200).json(new ApiResponse(200, sanitized, "Provider fetched."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/providers/me
// @access  Private/Provider
// ─────────────────────────────────────────────────────────────────────────────
const getMyProviderProfile = asyncHandler(async (req, res) => {
  const provider = await Provider.findOne({ userId: req.user._id }).populate(
    "userId",
    "name email phone avatar address"
  );
  if (!provider) throw new ApiError(404, "Provider profile not found. Please complete setup.");

  if (!provider.availability?.schedule || provider.availability.schedule.length === 0) {
    provider.availability = ensureAvailabilityStructure(provider.availability || {});
    await provider.save();
  }

  res.status(200).json(new ApiResponse(200, provider, "Provider profile fetched."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/providers/me/availability
// @access  Private/Provider
// ─────────────────────────────────────────────────────────────────────────────
const getMyAvailability = asyncHandler(async (req, res) => {
  const provider = await Provider.findOne({ userId: req.user._id });
  if (!provider) throw new ApiError(404, "Provider profile not found.");

  if (!provider.availability?.schedule || provider.availability.schedule.length === 0) {
    provider.availability = ensureAvailabilityStructure(provider.availability || {});
    await provider.save();
  }

  res.status(200).json(new ApiResponse(200, provider.availability, "Availability fetched."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/providers/me/availability
// @access  Private/Provider
// ─────────────────────────────────────────────────────────────────────────────
const updateMyAvailability = asyncHandler(async (req, res) => {
  const provider = await Provider.findOne({ userId: req.user._id });
  if (!provider) throw new ApiError(404, "Provider profile not found.");

  const {
    isAvailable,
    emergencyAvailability,
    workingDays,
    workingHours,
    schedule,
    specificDates,
  } = req.body;

  if (!provider.availability) {
    provider.availability = {};
  }

  if (isAvailable !== undefined) {
    provider.availability.isAvailable = Boolean(isAvailable);
  }
  if (emergencyAvailability !== undefined) {
    provider.availability.emergencyAvailability = Boolean(emergencyAvailability);
  }

  if (Array.isArray(schedule)) {
    provider.availability.schedule = schedule.map((s) => ({
      day: s.day,
      enabled: Boolean(s.enabled),
      start: s.start || "09:00",
      end: s.end || "18:00",
    }));

    provider.availability.workingDays = schedule
      .filter((s) => s.enabled)
      .map((s) => s.day);

    const enabledDays = schedule.filter((s) => s.enabled);
    if (enabledDays.length > 0) {
      provider.availability.workingHours = {
        start: enabledDays[0].start || "09:00",
        end: enabledDays[0].end || "18:00",
      };
    }
  } else if (Array.isArray(workingDays)) {
    provider.availability.workingDays = workingDays;
  }

  if (workingHours) {
    provider.availability.workingHours = {
      start: workingHours.start || provider.availability.workingHours?.start || "09:00",
      end: workingHours.end || provider.availability.workingHours?.end || "18:00",
    };
  }

  if (Array.isArray(specificDates)) {
    provider.availability.specificDates = specificDates.map((sd) => ({
      date: sd.date,
      isAvailable: Boolean(sd.isAvailable),
      reason: sd.reason || "",
      start: sd.start || "09:00",
      end: sd.end || "18:00",
    }));
  }

  await provider.save();

  res.status(200).json(new ApiResponse(200, provider.availability, "Availability saved successfully."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/providers/me
// @access  Private/Provider
// ─────────────────────────────────────────────────────────────────────────────
const updateProviderProfile = asyncHandler(async (req, res) => {
  const {
    bio,
    experience,
    availability,
    serviceArea,
    services,
    primaryCategory,
    subCategories,
    skills,
    languages,
    hourlyRate,
    startingPrice,
    emergencyService,
    profileCompleted,
  } = req.body;

  const updates = {};
  if (bio !== undefined) updates.bio = bio;
  if (experience !== undefined) updates.experience = experience;
  if (availability !== undefined) {
    updates.availability = ensureAvailabilityStructure(availability);
  }
  if (serviceArea !== undefined) updates.serviceArea = serviceArea;
  if (services !== undefined) updates.services = services;
  if (primaryCategory !== undefined) updates.primaryCategory = primaryCategory;
  if (subCategories !== undefined) updates.subCategories = subCategories;
  if (skills !== undefined) updates.skills = skills;
  if (languages !== undefined) updates.languages = languages;
  if (hourlyRate !== undefined) updates.hourlyRate = hourlyRate;
  if (startingPrice !== undefined) updates.startingPrice = startingPrice;
  if (emergencyService !== undefined) updates.emergencyService = emergencyService;
  if (profileCompleted !== undefined) updates.profileCompleted = profileCompleted;

  const provider = await Provider.findOneAndUpdate(
    { userId: req.user._id },
    updates,
    { new: true, runValidators: true }
  ).populate("userId", "name email phone avatar address");

  if (!provider) throw new ApiError(404, "Provider profile not found.");

  res.status(200).json(new ApiResponse(200, provider, "Provider profile updated."));
});

// @route   PUT /api/providers/me/services
// @route   PUT /api/providers/me/services/:serviceId
// @access  Private/Provider
const updateMyServices = asyncHandler(async (req, res) => {
  const { action, service, serviceId } = req.body;
  const targetServiceId = req.params.serviceId || serviceId || service?._id || service?.id;
  const effectiveAction = action || (req.params.serviceId ? "edit" : undefined);

  if (!["add", "remove", "edit", "update"].includes(effectiveAction)) {
    throw new ApiError(400, "Action must be 'add', 'edit', or 'remove'.");
  }

  const provider = await Provider.findOne({ userId: req.user._id });
  if (!provider) throw new ApiError(404, "Provider profile not found.");

  if (effectiveAction === "add") {
    if (!service?.category || !service?.name || service?.basePrice === undefined || service?.basePrice === "") {
      throw new ApiError(400, "Category, name, and base price are required.");
    }

    if (provider.primaryCategory && service.category !== provider.primaryCategory) {
      throw new ApiError(
        400,
        `As a '${provider.primaryCategory}' provider, you can only offer services under the '${provider.primaryCategory}' category.`
      );
    }

    provider.services.push({
      category: service.category,
      name: service.name.trim(),
      description: service.description ? service.description.trim() : "",
      basePrice: Number(service.basePrice),
      priceUnit: service.priceUnit || "per visit",
    });
  }

  if (effectiveAction === "edit" || effectiveAction === "update") {
    if (!targetServiceId) {
      throw new ApiError(400, "Service ID is required for editing.");
    }

    const item = provider.services.id(targetServiceId);
    if (!item) throw new ApiError(404, "Service not found.");

    if (!service?.category || !service?.name || service?.basePrice === undefined || service?.basePrice === "") {
      throw new ApiError(400, "Category, name, and base price are required.");
    }

    if (provider.primaryCategory && service.category !== provider.primaryCategory) {
      throw new ApiError(
        400,
        `As a '${provider.primaryCategory}' provider, you can only offer services under the '${provider.primaryCategory}' category.`
      );
    }

    item.category = service.category;
    item.name = service.name.trim();
    item.description = service.description ? service.description.trim() : "";
    item.basePrice = Number(service.basePrice);
    item.priceUnit = service.priceUnit || "per visit";
  }

  if (effectiveAction === "remove") {
    const item = provider.services.id(targetServiceId);
    if (!item) throw new ApiError(404, "Service not found.");
    item.deleteOne();
  }

  await provider.save();

  res.status(200).json(new ApiResponse(200, provider.services, "Services updated."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/providers/portfolio
// @access  Private/Provider
// ─────────────────────────────────────────────────────────────────────────────
const addPortfolioItem = asyncHandler(async (req, res) => {
  const { title, description, category } = req.body;
  if (!req.files || req.files.length === 0) throw new ApiError(400, "At least one image is required.");

  const imageUploads = await Promise.all(
    req.files.map((file) => uploadToCloudinary(file.buffer, "portfolio"))
  );

  const images = imageUploads.map((r) => ({ url: r.secure_url, publicId: r.public_id }));

  const provider = await Provider.findOneAndUpdate(
    { userId: req.user._id },
    { $push: { portfolio: { title, description, category, images } } },
    { new: true }
  );

  if (!provider) throw new ApiError(404, "Provider profile not found.");
  res.status(201).json(new ApiResponse(201, provider.portfolio, "Portfolio item added."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/providers/portfolio/:itemId
// @access  Private/Provider
// ─────────────────────────────────────────────────────────────────────────────
const deletePortfolioItem = asyncHandler(async (req, res) => {
  const provider = await Provider.findOne({ userId: req.user._id });
  if (!provider) throw new ApiError(404, "Provider profile not found.");

  const item = provider.portfolio.id(req.params.itemId);
  if (!item) throw new ApiError(404, "Portfolio item not found.");

  // Delete all images from Cloudinary
  await Promise.all(item.images.map((img) => deleteFromCloudinary(img.publicId)));

  item.deleteOne();
  await provider.save();

  res.status(200).json(new ApiResponse(200, null, "Portfolio item deleted."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/providers/documents
// @access  Private/Provider — upload verification docs
// ─────────────────────────────────────────────────────────────────────────────
const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No document file provided.");
  const { type } = req.body;
  if (!type) throw new ApiError(400, "Document type is required.");

  const result = await uploadToCloudinary(req.file.buffer, "documents");

  const provider = await Provider.findOneAndUpdate(
    { userId: req.user._id },
    {
      $push: { documents: { type, url: result.secure_url, publicId: result.public_id } },
      verificationStatus: "under_review",
    },
    { new: true }
  );

  if (!provider) throw new ApiError(404, "Provider profile not found.");
  res.status(201).json(new ApiResponse(201, { documents: provider.documents }, "Document uploaded. Verification pending."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/providers/:id/verify  (Admin)
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
const verifyProvider = asyncHandler(async (req, res) => {
  const { status, reason } = req.body; // "verified" | "rejected" | "pending" | "under_review"
  if (!["verified", "rejected", "pending", "under_review"].includes(status)) {
    throw new ApiError(400, "Status must be 'verified', 'rejected', 'pending', or 'under_review'.");
  }

  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new ApiError(404, "Provider not found.");

  if (!provider.verification) provider.verification = {};

  if (status === "verified") {
    provider.verificationStatus = "verified";
    provider.verification.overallStatus = "verified";
    provider.status = "approved";
    provider.profileCompleted = true;
    provider.isActive = true;

    // Ensure all 4 pillars reflect verified state
    if (!provider.verification.identity) provider.verification.identity = {};
    if (!provider.verification.experience) provider.verification.experience = {};
    if (!provider.verification.skills) provider.verification.skills = {};
    if (!provider.verification.qualification) provider.verification.qualification = {};

    provider.verification.identity.status = "verified";
    provider.verification.experience.status = "verified";
    provider.verification.skills.status = "verified";

    if (LICENSED_CATEGORIES.includes(provider.primaryCategory)) {
      provider.verification.qualification.status = "verified";
      provider.verification.qualification.isRequired = true;
    } else {
      provider.verification.qualification.status = "not_required";
    }

    provider.verification.lastReviewedAt = new Date();
    provider.verification.lastReviewedBy = req.user._id;
  } else if (status === "rejected") {
    provider.verificationStatus = "rejected";
    provider.verification.overallStatus = "rejected";
    provider.status = "rejected";
    provider.isActive = false;
    provider.verification.lastReviewedAt = new Date();
    provider.verification.lastReviewedBy = req.user._id;
    if (reason) {
      provider.verification.adminReviewNotes = reason;
    }
  } else {
    // pending or under_review
    provider.verificationStatus = status;
    provider.verification.overallStatus = status;
    provider.status = "pending";
    provider.isActive = false;
    provider.verification.lastReviewedAt = new Date();
    provider.verification.lastReviewedBy = req.user._id;
  }

  provider.markModified("verification");
  await provider.save();

  await provider.populate("userId", "name email phone avatar");

  res.status(200).json(new ApiResponse(200, provider, `Provider ${status} successfully.`));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/providers/categories
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const getCategories = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, SERVICE_CATEGORIES, "Categories fetched."));
});

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// @route   GET /api/providers/me/verification
// @access  Private/Provider
// @route   GET /api/providers/me/verification
// @access  Private/Provider
const getMyVerification = asyncHandler(async (req, res) => {
  const provider = await Provider.findOne({ userId: req.user._id }).populate("userId", "name email phone address");
  if (!provider) throw new ApiError(404, "Provider profile not found.");

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

      console.log(`[Identity OCR] Auto-processing pending OCR for provider ${provider._id}...`);
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
      console.log(`[Identity OCR] Auto-processed OCR saved to MongoDB for provider ${provider._id}.`);
    } catch (e) {
      console.error(`[Identity OCR] Auto-process error for provider ${provider._id}:`, e.message);
    }
  }

  const qualificationRequired = LICENSED_CATEGORIES.includes(provider.primaryCategory);

  res.status(200).json(
    new ApiResponse(200, {
      verification: provider.verification || {},
      primaryCategory: provider.primaryCategory,
      qualificationRequired,
      licensedCategories: LICENSED_CATEGORIES,
    }, "Verification data fetched.")
  );
});

// @route   PUT /api/providers/me/verification/identity
// @access  Private/Provider
const submitIdentityVerification = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, "At least one identity document is required.");
  }

  const provider = await Provider.findOne({ userId: req.user._id }).populate("userId", "name email phone address");
  if (!provider) throw new ApiError(404, "Provider profile not found.");

  const declaredDocType = req.body.docType || "Government ID (Aadhaar / Voter ID)";
  console.log(`[Identity Upload] Provider ${provider._id} (${provider.userId?.name}) uploading ${req.files.length} document(s)...`);

  // Upload each file to Cloudinary
  const uploadedDocs = await Promise.all(
    req.files.map(async (file) => {
      const result = await uploadToCloudinary(file.buffer, "verification/identity");
      return {
        docType: declaredDocType,
        url: result.secure_url,
        publicId: result.public_id,
        uploadedAt: new Date(),
      };
    })
  );

  if (!provider.verification) provider.verification = {};
  if (!provider.verification.identity) provider.verification.identity = {};

  // Append new docs (don't replace existing)
  if (!provider.verification.identity.documents) {
    provider.verification.identity.documents = [];
  }
  provider.verification.identity.documents.push(...uploadedDocs);
  provider.verification.identity.status = "submitted";

  // Run OCR on the first/primary uploaded identity document
  const primaryFile = req.files[0];
  const userProfile = {
    name: provider.userId?.name || "",
    email: provider.userId?.email || "",
    phone: provider.userId?.phone || "",
    city: provider.userId?.address?.city || provider.serviceArea?.city || "",
  };

  console.log(`[Identity OCR] Triggering OCR for provider ${provider._id} on ${declaredDocType}...`);
  const ocrOutcome = await runOcrOnIdentityDocument(
    primaryFile.buffer,
    primaryFile.mimetype || "image/jpeg",
    userProfile,
    declaredDocType
  );

  console.log(`[Identity OCR] Outcome for provider ${provider._id}: status=${ocrOutcome.status}, confidence=${ocrOutcome.confidence}, nameMatched=${ocrOutcome.nameMatched}, matchStatus=${ocrOutcome.matchStatus}`);

  provider.verification.identity.ocrResult = ocrOutcome;

  // Populate extractedInfo with masked document number
  if (ocrOutcome.extractedEntities) {
    provider.verification.identity.extractedInfo = {
      name: ocrOutcome.extractedEntities.extractedName || "",
      documentNumber: ocrOutcome.extractedEntities.extractedDocNumber || "",
      documentType: ocrOutcome.extractedEntities.extractedDocType || declaredDocType,
      rawSummary: ocrOutcome.extractedEntities.rawSummary || "",
    };
  }

  provider.markModified("verification");
  await provider.save();
  console.log(`[Identity OCR] Successfully saved verification and OCR results to MongoDB for provider ${provider._id}.`);

  res.status(200).json(
    new ApiResponse(200, provider.verification, "Identity document uploaded and analyzed successfully.")
  );
});

// @route   PUT /api/providers/me/verification/experience
// @access  Private/Provider
const submitExperienceVerification = asyncHandler(async (req, res) => {
  const { yearsOfExperience, description, previousWorkDetails, previousEmployerOrClient } = req.body;

  if (!yearsOfExperience && yearsOfExperience !== 0) {
    throw new ApiError(400, "Years of experience is required.");
  }
  if (!description || !description.trim()) {
    throw new ApiError(400, "Experience description is required.");
  }

  const provider = await Provider.findOne({ userId: req.user._id }).populate("userId", "name email");
  if (!provider) throw new ApiError(404, "Provider profile not found.");

  if (!provider.verification) provider.verification = {};
  if (!provider.verification.experience) provider.verification.experience = {};

  provider.verification.experience.yearsOfExperience = Number(yearsOfExperience);
  provider.verification.experience.description = description.trim();
  provider.verification.experience.previousWorkDetails = previousWorkDetails?.trim() || "";
  provider.verification.experience.previousEmployerOrClient = previousEmployerOrClient?.trim() || "";
  provider.verification.experience.status = "submitted";

  // Sync to top-level experience field
  provider.experience = Number(yearsOfExperience);

  // Handle optional evidence files
  if (req.files && req.files.length > 0) {
    const evidenceUploads = await Promise.all(
      req.files.map(async (file) => {
        const result = await uploadToCloudinary(file.buffer, "verification/experience");
        return {
          url: result.secure_url,
          publicId: result.public_id,
          name: file.originalname || "Work Proof",
          docType: req.body.docType || "Experience Evidence",
          uploadedAt: new Date(),
        };
      })
    );
    if (!provider.verification.experience.evidenceUrls) {
      provider.verification.experience.evidenceUrls = [];
    }
    provider.verification.experience.evidenceUrls.push(...evidenceUploads);

    // Run OCR assistance on the first/primary evidence file uploaded
    const primaryFile = req.files[0];
    const declaredData = {
      providerName: provider.userId?.name || "",
      declaredYears: Number(yearsOfExperience),
      declaredEmployer: previousEmployerOrClient?.trim() || "",
      declaredDetails: previousWorkDetails?.trim() || description.trim(),
      primaryCategory: provider.primaryCategory || "",
    };

    const ocrOutcome = await runOcrOnDocument(
      primaryFile.buffer,
      primaryFile.mimetype || "image/jpeg",
      declaredData
    );

    provider.verification.experience.ocrResult = ocrOutcome;
  }

  await provider.save();

  res.status(200).json(
    new ApiResponse(200, provider.verification, "Experience details and evidence submitted successfully.")
  );
});

// @route   PUT /api/providers/me/verification/skills
// @access  Private/Provider
const submitSkillsVerification = asyncHandler(async (req, res) => {
  const { skillsList, portfolioDescription } = req.body;

  if (!Array.isArray(skillsList) || skillsList.length === 0) {
    throw new ApiError(400, "At least one skill is required.");
  }

  const provider = await Provider.findOne({ userId: req.user._id });
  if (!provider) throw new ApiError(404, "Provider profile not found.");

  if (!provider.verification) provider.verification = {};
  if (!provider.verification.skills) provider.verification.skills = {};

  provider.verification.skills.skillsList = skillsList.map((s) => ({
    name: (s.name || "").trim(),
    yearsOfExperience: Number(s.yearsOfExperience || 0),
  }));
  provider.verification.skills.portfolioDescription = portfolioDescription?.trim() || "";
  provider.verification.skills.status = "submitted";

  // Sync to top-level skills array
  provider.skills = skillsList.map((s) => (s.name || "").trim()).filter(Boolean);

  await provider.save();

  res.status(200).json(
    new ApiResponse(200, provider.verification, "Skills submitted successfully.")
  );
});

// @route   PUT /api/providers/me/verification/qualification
// @access  Private/Provider
const submitQualificationVerification = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, "At least one certificate document is required.");
  }

  const provider = await Provider.findOne({ userId: req.user._id });
  if (!provider) throw new ApiError(404, "Provider profile not found.");

  const uploadedCerts = await Promise.all(
    req.files.map(async (file) => {
      const result = await uploadToCloudinary(file.buffer, "verification/certificates");
      return {
        docType: req.body.docType || "Certificate",
        url: result.secure_url,
        publicId: result.public_id,
        uploadedAt: new Date(),
      };
    })
  );

  if (!provider.verification) provider.verification = {};
  if (!provider.verification.qualification) provider.verification.qualification = {};

  if (!provider.verification.qualification.certificates) {
    provider.verification.qualification.certificates = [];
  }
  provider.verification.qualification.certificates.push(...uploadedCerts);
  provider.verification.qualification.status = "submitted";

  await provider.save();

  res.status(200).json(
    new ApiResponse(200, provider.verification, "Qualification certificates uploaded successfully.")
  );
});

// @route   POST /api/providers/me/verification/submit
// @access  Private/Provider — submit all for admin review
const submitForReview = asyncHandler(async (req, res) => {
  const provider = await Provider.findOne({ userId: req.user._id });
  if (!provider) throw new ApiError(404, "Provider profile not found.");

  const v = provider.verification || {};

  // Validate minimum requirements
  if (!v.identity || v.identity.status === "not_submitted") {
    throw new ApiError(400, "Identity documents must be submitted before requesting review.");
  }
  if (!v.experience || v.experience.status === "not_submitted") {
    throw new ApiError(400, "Experience details must be submitted before requesting review.");
  }
  if (!v.skills || v.skills.status === "not_submitted") {
    throw new ApiError(400, "Skills must be submitted before requesting review.");
  }

  // Check qualification requirement for licensed categories
  if (LICENSED_CATEGORIES.includes(provider.primaryCategory)) {
    if (!v.qualification || !["submitted", "verified"].includes(v.qualification.status)) {
      throw new ApiError(
        400,
        `${provider.primaryCategory} is a licensed trade. Qualification certificates are required.`
      );
    }
  }

  if (!provider.verification) provider.verification = {};
  provider.verification.overallStatus = "under_review";

  await provider.save();

  res.status(200).json(
    new ApiResponse(200, provider.verification, "Verification submitted for admin review.")
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/providers/me/settings
// @access  Private/Provider
// ─────────────────────────────────────────────────────────────────────────────
const getMySettings = asyncHandler(async (req, res) => {
  const provider = await Provider.findOne({ userId: req.user._id }).populate(
    "userId",
    "name email phone avatar"
  );
  if (!provider) throw new ApiError(404, "Provider profile not found.");

  const defaultNotifications = {
    bookingRequests: true,
    messages: true,
    payments: true,
    verification: true,
    announcements: true,
    emailNotifications: true,
    smsNotifications: false,
  };

  const settings = {
    notificationPreferences: {
      ...defaultNotifications,
      ...(provider.notificationPreferences ? (provider.notificationPreferences.toObject ? provider.notificationPreferences.toObject() : provider.notificationPreferences) : {}),
    },
    emergencyService: Boolean(provider.emergencyService),
    serviceRadius: provider.serviceArea?.radius ?? 20,
    isAvailable: provider.availability?.isAvailable !== false,
    emergencyAvailability: Boolean(provider.availability?.emergencyAvailability),
    verificationStatus: provider.verificationStatus,
    status: provider.status,
    user: provider.userId,
  };

  res.status(200).json(new ApiResponse(200, settings, "Provider settings fetched."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/providers/me/settings
// @access  Private/Provider
// ─────────────────────────────────────────────────────────────────────────────
const updateMySettings = asyncHandler(async (req, res) => {
  const provider = await Provider.findOne({ userId: req.user._id });
  if (!provider) throw new ApiError(404, "Provider profile not found.");

  const {
    notificationPreferences,
    emergencyService,
    serviceRadius,
    isAvailable,
    emergencyAvailability,
  } = req.body;

  if (notificationPreferences && typeof notificationPreferences === "object") {
    if (!provider.notificationPreferences) provider.notificationPreferences = {};
    Object.keys(notificationPreferences).forEach((key) => {
      provider.notificationPreferences[key] = Boolean(notificationPreferences[key]);
    });
  }

  if (emergencyService !== undefined) {
    provider.emergencyService = Boolean(emergencyService);
  }

  if (serviceRadius !== undefined && Number(serviceRadius) >= 0) {
    if (!provider.serviceArea) provider.serviceArea = {};
    provider.serviceArea.radius = Number(serviceRadius);
  }

  if (isAvailable !== undefined) {
    if (!provider.availability) provider.availability = {};
    provider.availability.isAvailable = Boolean(isAvailable);
  }

  if (emergencyAvailability !== undefined) {
    if (!provider.availability) provider.availability = {};
    provider.availability.emergencyAvailability = Boolean(emergencyAvailability);
  }

  await provider.save();

  const defaultNotifications = {
    bookingRequests: true,
    messages: true,
    payments: true,
    verification: true,
    announcements: true,
    emailNotifications: true,
    smsNotifications: false,
  };

  const updatedSettings = {
    notificationPreferences: {
      ...defaultNotifications,
      ...(provider.notificationPreferences ? (provider.notificationPreferences.toObject ? provider.notificationPreferences.toObject() : provider.notificationPreferences) : {}),
    },
    emergencyService: Boolean(provider.emergencyService),
    serviceRadius: provider.serviceArea?.radius ?? 20,
    isAvailable: provider.availability?.isAvailable !== false,
    emergencyAvailability: Boolean(provider.availability?.emergencyAvailability),
    verificationStatus: provider.verificationStatus,
    status: provider.status,
  };

  res.status(200).json(new ApiResponse(200, updatedSettings, "Settings updated successfully."));
});

module.exports = {
  getProviders,
  getProviderById,
  getMyProviderProfile,
  updateProviderProfile,
  updateMyServices,
  addPortfolioItem,
  deletePortfolioItem,
  uploadDocument,
  verifyProvider,
  getCategories,
  getMyAvailability,
  updateMyAvailability,
  getMyVerification,
  submitIdentityVerification,
  submitExperienceVerification,
  submitSkillsVerification,
  submitQualificationVerification,
  submitForReview,
  getMySettings,
  updateMySettings,
};
