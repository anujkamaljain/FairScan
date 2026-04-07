require("dotenv").config();

const http = require("http");
const app = require("./app");
const env = require("./config/env");
const connectDatabase = require("./config/database");
const logger = require("./config/logger");

const server = http.createServer(app);

const startServer = async () => {
  try {
    await connectDatabase();
  } catch (error) {
    if (env.dbRequired) {
      logger.error("Unable to start server", { error: error.message });
      process.exit(1);
    }
    logger.warn("Database connection failed; continuing without DB in non-production mode.");
  }

  server.listen(env.port, () => {
    logger.info(`Server listening on port ${env.port}`);
  });
};

startServer();

const mongoose = require("mongoose");

const shutdown = (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await mongoose.disconnect();
      logger.info("MongoDB disconnected");
    } catch (err) {
      logger.error("Error disconnecting MongoDB", { error: err.message });
    }
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
