require("express-async-errors");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const logger = require("./config/logger");
const routes = require("./routes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { startAuditQueueWorker } = require("./utils/auditQueue");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin.split(",").map((o) => o.trim()),
    credentials: true
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan("combined", {
    stream: {
      write: (message) => logger.http(message.trim())
    }
  })
);

app.use("/api/v1", routes);

startAuditQueueWorker();

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
