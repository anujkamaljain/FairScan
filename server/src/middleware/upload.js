const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDirectory = path.join(__dirname, "../../tmp/uploads");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirectory),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const allowedMimeTypes = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/json",
  "text/plain"
]);

const uploadDatasetFile = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedExt = ext === ".csv" || ext === ".json";
    const isAllowedMime = allowedMimeTypes.has(file.mimetype);

    if (isAllowedExt || isAllowedMime) {
      return cb(null, true);
    }
    return cb(new Error("Only CSV and JSON files are supported"));
  }
});

module.exports = {
  uploadDatasetFile
};
