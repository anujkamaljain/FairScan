const fs = require("fs/promises");
const path = require("path");
const { parse } = require("csv-parse");
const AppError = require("../utils/appError");

const MISSING_SENTINELS = new Set(["", "na", "n/a", "null", "undefined"]);

const inferValueType = (value) => {
  if (value === null || value === undefined || MISSING_SENTINELS.has(String(value).trim().toLowerCase())) {
    return "null";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return "number";
  }

  const strValue = String(value).trim();

  if (strValue.length === 0) {
    return "null";
  }
  if (/^-?\d+(\.\d+)?$/.test(strValue)) {
    return "number";
  }
  if (["true", "false"].includes(strValue.toLowerCase())) {
    return "boolean";
  }
  return "string";
};

const normalizeMissing = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const strValue = String(value).trim();
  if (MISSING_SENTINELS.has(strValue.toLowerCase())) {
    return null;
  }
  return value;
};

const parseCsvFile = (filePath) =>
  new Promise((resolve, reject) => {
    const records = [];
    const parser = parse({
      columns: true,
      trim: true,
      bom: true,
      skip_empty_lines: true,
      relax_column_count: false
    });

    parser.on("readable", () => {
      let row;
      while ((row = parser.read()) !== null) {
        records.push(row);
      }
    });
    parser.on("error", (error) => reject(new AppError(`Malformed CSV: ${error.message}`, 400)));
    parser.on("end", () => resolve(records));

    require("fs").createReadStream(filePath).pipe(parser);
  });

const parseJsonFile = async (filePath) => {
  const content = await fs.readFile(filePath, "utf-8");
  return parseJsonContent(content);
};

const parseCsvContent = (content) =>
  new Promise((resolve, reject) => {
    parse(
      content,
      {
        columns: true,
        trim: true,
        bom: true,
        skip_empty_lines: true,
        relax_column_count: false
      },
      (error, records) => {
        if (error) {
          reject(new AppError(`Malformed CSV: ${error.message}`, 400));
          return;
        }
        resolve(records);
      }
    );
  });

const parseJsonContent = (content) => {
  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new AppError("Malformed JSON payload", 400);
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && Array.isArray(parsed.data)) {
    return parsed.data;
  }

  throw new AppError("JSON must be an array of objects (or { data: [...] })", 400);
};

const buildIngestionSummary = (rows) => {
  ensureObjectRows(rows);
  const columns = validateConsistentSchema(rows);
  const normalizedRows = normalizeRows(rows, columns);
  const missingValues = buildMissingValueSummary(normalizedRows, columns);
  const mixedTypeColumns = detectMixedTypeColumns(normalizedRows, columns);

  return {
    rows: normalizedRows,
    columns,
    summary: {
      rows: normalizedRows.length,
      columns: columns.length,
      missing_values: missingValues,
      mixed_type_columns: mixedTypeColumns
    }
  };
};

const ensureObjectRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AppError("Dataset is empty", 400);
  }
  const invalidRow = rows.find((row) => !row || Array.isArray(row) || typeof row !== "object");
  if (invalidRow) {
    throw new AppError("Dataset contains malformed rows; each row must be an object", 400);
  }
};

const validateConsistentSchema = (rows) => {
  const columns = Object.keys(rows[0]);
  if (columns.length === 0) {
    throw new AppError("Dataset schema is empty", 400);
  }

  const columnSet = new Set(columns);
  rows.forEach((row, index) => {
    const rowColumns = Object.keys(row);
    if (rowColumns.length !== columns.length) {
      throw new AppError(`Malformed row at index ${index}: inconsistent column count`, 400);
    }
    for (const key of rowColumns) {
      if (!columnSet.has(key)) {
        throw new AppError(`Malformed row at index ${index}: unexpected column '${key}'`, 400);
      }
    }
  });

  return columns;
};

const normalizeRows = (rows, columns) =>
  rows.map((row) => {
    const normalized = {};
    columns.forEach((column) => {
      normalized[column] = normalizeMissing(row[column]);
    });
    return normalized;
  });

const buildMissingValueSummary = (rows, columns) => {
  const byColumn = {};
  let total = 0;

  columns.forEach((column) => {
    const missingCount = rows.reduce((count, row) => (row[column] === null ? count + 1 : count), 0);
    byColumn[column] = missingCount;
    total += missingCount;
  });

  return { total, by_column: byColumn };
};

const detectMixedTypeColumns = (rows, columns) => {
  const mixedTypeColumns = [];

  columns.forEach((column) => {
    const types = new Set();
    rows.forEach((row) => {
      const type = inferValueType(row[column]);
      if (type !== "null") {
        types.add(type);
      }
    });
    if (types.size > 1) {
      mixedTypeColumns.push(column);
    }
  });

  return mixedTypeColumns;
};

const parseDatasetFile = async (file) => {
  if (!file) {
    throw new AppError("Dataset file is required", 400);
  }

  const extension = path.extname(file.originalname).toLowerCase();
  let rows = [];

  if (extension === ".csv") {
    rows = await parseCsvFile(file.path);
  } else if (extension === ".json") {
    rows = await parseJsonFile(file.path);
  } else {
    throw new AppError("Unsupported file format. Use CSV or JSON", 400);
  }

  return buildIngestionSummary(rows);
};

const parseDatasetBuffer = async ({ buffer, originalname }) => {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new AppError("Dataset buffer is required", 400);
  }
  if (!originalname) {
    throw new AppError("Dataset file name is required", 400);
  }

  const extension = path.extname(String(originalname)).toLowerCase();
  const content = buffer.toString("utf-8");

  let rows = [];
  if (extension === ".csv") {
    rows = await parseCsvContent(content);
  } else if (extension === ".json") {
    rows = parseJsonContent(content);
  } else {
    throw new AppError("Unsupported file format. Use CSV or JSON", 400);
  }

  return buildIngestionSummary(rows);
};

module.exports = {
  parseDatasetFile,
  parseDatasetBuffer
};
