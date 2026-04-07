const { execSync } = require("node:child_process");

const BLOCKED_PATH_PATTERNS = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.[^/]+$/,
  /(^|\/)credentials\.json$/i,
  /(^|\/)service-account\.json$/i,
  /(^|\/)secrets?\/.+/i
];

const ALLOWLIST = new Set([
  "client/.env.example",
  "server/.env.example",
  "services/ml-audit-service/.env.example"
]);

function getTrackedFiles() {
  const raw = execSync("git ls-files", { encoding: "utf8" });
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isBlocked(filePath) {
  if (ALLOWLIST.has(filePath)) return false;
  return BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
}

function main() {
  const trackedFiles = getTrackedFiles();
  const blocked = trackedFiles.filter(isBlocked);

  if (blocked.length > 0) {
    console.error("Tracked secret-like files detected. Remove from git index before shipping:");
    blocked.forEach((item) => console.error(` - ${item}`));
    console.error("\nSuggested fix:");
    console.error("  git rm --cached <file>");
    console.error("  keep it locally and use .env.example for shared config");
    process.exit(1);
  }

  console.log("No tracked secret-like files detected.");
}

main();
