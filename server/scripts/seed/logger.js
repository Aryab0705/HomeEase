/**
 * scripts/seed/logger.js — Colored Console Logger for Seed Scripts
 *
 * Uses ANSI escape codes — no external dependencies required.
 */

// ANSI color codes
const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  cyan:    "\x1b[36m",
  red:     "\x1b[31m",
  white:   "\x1b[37m",
  gray:    "\x1b[90m",
};

const log = {
  info:    (msg) => console.log(`${C.blue}ℹ${C.reset}  ${msg}`),
  success: (msg) => console.log(`${C.green}✔${C.reset}  ${msg}`),
  skip:    (msg) => console.log(`${C.gray}⏩ ${msg}${C.reset}`),
  warn:    (msg) => console.log(`${C.yellow}⚠${C.reset}  ${msg}`),
  error:   (msg) => console.error(`${C.red}✖${C.reset}  ${msg}`),
  section: (msg) => {
    const line = "─".repeat(50);
    console.log(`\n${C.cyan}${C.bold}${line}${C.reset}`);
    console.log(`${C.cyan}${C.bold}  ${msg}${C.reset}`);
    console.log(`${C.cyan}${C.bold}${line}${C.reset}`);
  },
  summary: (rows) => {
    const line = "━".repeat(52);
    console.log(`\n${C.green}${C.bold}${line}${C.reset}`);
    rows.forEach(([label, value]) =>
      console.log(`${C.bold}  ${label.padEnd(16)}${C.reset}${value}`)
    );
    console.log(`${C.green}${C.bold}${line}${C.reset}\n`);
  },
};

module.exports = log;
