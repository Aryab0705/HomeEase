const multer = require("multer");
const ApiError = require("../utils/ApiError");

// Store files in memory so we can stream to Cloudinary
const storage = multer.memoryStorage();

/**
 * File filter — allow images only
 */
const imageFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(415, "Only JPEG, PNG, WebP, and GIF images are allowed."),
      false
    );
  }
};

/**
 * Single avatar/image upload (max 5 MB)
 */
const uploadSingle = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single("image");

/**
 * Multiple images upload (up to 10 files, max 5 MB each)
 */
const uploadMultiple = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).array("images", 10);

/**
 * Express middleware wrapper with proper error handling
 */
const handleUpload = (uploader) => (req, res, next) => {
  uploader(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new ApiError(413, "File size exceeds the limit."));
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return next(new ApiError(413, "Too many files. Maximum allowed exceeded."));
      }
      return next(new ApiError(400, err.message));
    }
    if (err) return next(err);
    next();
  });
};

/**
 * Document filter — allow images AND PDFs (for verification docs / certificates)
 */
const documentFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(415, "Only JPEG, PNG, WebP, GIF images and PDF files are allowed."),
      false
    );
  }
};

/**
 * Single document upload (max 10 MB) — for identity docs, certificates
 */
const uploadDocumentSingle = multer({
  storage,
  fileFilter: documentFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
}).single("document");

/**
 * Multiple document upload (up to 5 files, max 10 MB each)
 */
const uploadDocumentMultiple = multer({
  storage,
  fileFilter: documentFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).array("documents", 5);

module.exports = {
  uploadSingle: handleUpload(uploadSingle),
  uploadMultiple: handleUpload(uploadMultiple),
  uploadDocSingle: handleUpload(uploadDocumentSingle),
  uploadDocMultiple: handleUpload(uploadDocumentMultiple),
};
