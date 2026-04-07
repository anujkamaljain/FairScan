#!/usr/bin/env node
const { execSync } = require("child_process");

const blockedFilePatterns = [
  /^\.env(\..+)?$/i,
  /(^|\/)credentials\.json$/i,
  /(^|\/)service-account.*\.json$/i,
  /(^|\/).*secret.*\.(json|txt|pem|key)$/i,
  /(^|\/)id_rsa(\.pub)?$/i
];

const trackedFiles = execSync("git ls-files", { encoding: "utf8" })
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const violations = trackedFiles.filter((filePath) =>
  blockedFilePatterns.some((pattern) => pattern.test(filePath.replace(/\\/g, "/")))
);

if (violations.length) {
  console.error("Blocked tracked secret-like files detected:");
  violations.forEach((filePath) => console.error(`- ${filePath}`));
  process.exit(1);
}

console.log("Secret file tracking check passed.");
