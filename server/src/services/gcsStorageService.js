const path = require("path");
const { Storage } = require("@google-cloud/storage");
const env = require("../config/env");

let storageClient;

const isGcsEnabled = () => env.datasetStorageProvider === "gcs" && Boolean(env.gcsBucketName);

const getStorageClient = () => {
  if (storageClient) return storageClient;
  const options = {};
  if (env.gcsProjectId) options.projectId = env.gcsProjectId;
  if (env.gcsKeyFilename) options.keyFilename = env.gcsKeyFilename;
  storageClient = new Storage(options);
  return storageClient;
};

const sanitizeName = (name) => String(name || "dataset").replace(/[^\w.\-]/g, "_");

const buildObjectPath = (originalName) => {
  const now = new Date();
  const datePrefix = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${String(
    now.getUTCDate()
  ).padStart(2, "0")}`;
  const timestamp = now.getTime();
  return `${env.gcsDatasetPrefix}/${datePrefix}/${timestamp}-${sanitizeName(path.basename(originalName))}`;
};

const uploadDatasetFileToGcs = async (file) => {
  if (!isGcsEnabled()) return null;
  if (!file?.path) {
    throw new Error("Dataset file path is missing for GCS upload");
  }

  const objectPath = buildObjectPath(file.originalname);
  const client = getStorageClient();
  const bucket = client.bucket(env.gcsBucketName);

  await bucket.upload(file.path, {
    destination: objectPath,
    metadata: {
      contentType: file.mimetype || "application/octet-stream"
    },
    resumable: false
  });

  return {
    provider: "gcs",
    bucket: env.gcsBucketName,
    objectPath,
    gcsUri: `gs://${env.gcsBucketName}/${objectPath}`,
    sizeBytes: Number(file.size || 0),
    uploadedAt: new Date()
  };
};

const downloadDatasetFileFromGcs = async (fileStorage = {}) => {
  if (!isGcsEnabled()) {
    throw new Error("GCS storage is not enabled");
  }
  if (!fileStorage.objectPath) {
    throw new Error("GCS object path is missing");
  }

  const client = getStorageClient();
  const bucketName = fileStorage.bucket || env.gcsBucketName;
  const bucket = client.bucket(bucketName);
  const file = bucket.file(fileStorage.objectPath);
  const [buffer] = await file.download();
  return buffer;
};

module.exports = {
  isGcsEnabled,
  uploadDatasetFileToGcs,
  downloadDatasetFileFromGcs
};
