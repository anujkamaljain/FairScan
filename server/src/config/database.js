const mongoose = require("mongoose");
const env = require("./env");
const logger = require("./logger");

const connectDatabase = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    logger.info("MongoDB connected");
  } catch (error) {
    logger.error("MongoDB connection failed", { error: error.message });
    throw error;
  }
};

module.exports = connectDatabase;
