const Service = require("../models/Service");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const { uploadToCloudinary, deleteFromCloudinary } = require("../services/cloudinaryService");

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/services
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const getServices = asyncHandler(async (req, res) => {
  const { category, search, page = 1, limit = 20 } = req.query;
  const query = { isActive: true };

  if (category) query.category = category;
  if (search) {
    query.$text = { $search: search };
  }

  const services = await Service.find(query)
    .sort({ popularityScore: -1, name: 1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await Service.countDocuments(query);

  res.status(200).json(
    new ApiResponse(200, {
      services,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/services/:id
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const getServiceById = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw new ApiError(404, "Service not found.");
  res.status(200).json(new ApiResponse(200, service));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/services  (Admin)
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
const createService = asyncHandler(async (req, res) => {
  const { name, category, description, basePrice, priceUnit, tags, icon } = req.body;

  let image = { url: "", publicId: "" };
  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, "services");
    image = { url: result.secure_url, publicId: result.public_id };
  }

  const service = await Service.create({
    name,
    category,
    description,
    basePrice,
    priceUnit,
    tags: tags ? tags.split(",").map((t) => t.trim()) : [],
    icon,
    image,
  });

  res.status(201).json(new ApiResponse(201, service, "Service created successfully."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/services/:id  (Admin)
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
const updateService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw new ApiError(404, "Service not found.");

  const { name, category, description, basePrice, priceUnit, tags, icon, isActive } = req.body;

  if (name !== undefined) service.name = name;
  if (category !== undefined) service.category = category;
  if (description !== undefined) service.description = description;
  if (basePrice !== undefined) service.basePrice = basePrice;
  if (priceUnit !== undefined) service.priceUnit = priceUnit;
  if (icon !== undefined) service.icon = icon;
  if (isActive !== undefined) service.isActive = isActive;
  if (tags !== undefined) service.tags = tags.split(",").map((t) => t.trim());

  if (req.file) {
    if (service.image?.publicId) await deleteFromCloudinary(service.image.publicId);
    const result = await uploadToCloudinary(req.file.buffer, "services");
    service.image = { url: result.secure_url, publicId: result.public_id };
  }

  await service.save();
  res.status(200).json(new ApiResponse(200, service, "Service updated successfully."));
});

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/services/:id  (Admin)
// @access  Private/Admin
// ─────────────────────────────────────────────────────────────────────────────
const deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw new ApiError(404, "Service not found.");

  if (service.image?.publicId) await deleteFromCloudinary(service.image.publicId);
  await service.deleteOne();

  res.status(200).json(new ApiResponse(200, null, "Service deleted successfully."));
});

module.exports = { getServices, getServiceById, createService, updateService, deleteService };
