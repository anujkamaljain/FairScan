const mongoose = require("mongoose");

const datasetSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    sourceType: {
      type: String,
      enum: ["upload", "warehouse", "api"],
      default: "upload"
    },
    status: {
      type: String,
      enum: ["draft", "processing", "ready", "archived"],
      default: "draft"
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    rowCount: {
      type: Number,
      default: 0
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    fileName: {
      type: String
    },
    fileType: {
      type: String
    },
    fileStorage: {
      provider: {
        type: String,
        enum: ["local", "gcs"],
        default: "local"
      },
      bucket: {
        type: String
      },
      objectPath: {
        type: String
      },
      gcsUri: {
        type: String
      },
      sizeBytes: {
        type: Number,
        default: 0
      },
      uploadedAt: {
        type: Date
      }
    },
    dataSnapshot: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Dataset", datasetSchema);
