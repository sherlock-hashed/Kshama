/**
 * Logger — Chalk-powered colored console output
 *
 * Provides structured, color-coded logging for proxy operations.
 * Makes the CLI output professional and easy to scan.
 */

import chalk from 'chalk';

/**
 * Log a cache HIT — green.
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {number} time - Response time in ms
 */
export function logHit(method, path, time) {
  console.log(
    chalk.green.bold('[HIT]') +
    chalk.white(` ${method} ${path}`) +
    chalk.gray(` - ${time}ms`)
  );
}

/**
 * Log a cache MISS — red.
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {number} time - Response time in ms
 */
export function logMiss(method, path, time) {
  console.log(
    chalk.red.bold('[MISS]') +
    chalk.white(` ${method} ${path}`) +
    chalk.gray(` - ${time}ms`)
  );
}

/**
 * Log a forwarded request (non-GET) — yellow.
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {number} time - Response time in ms
 */
export function logForward(method, path, time) {
  console.log(
    chalk.yellow.bold('[FORWARD]') +
    chalk.white(` ${method} ${path}`) +
    chalk.gray(` - ${time}ms`)
  );
}

/**
 * Log an informational message — blue.
 * @param {string} message
 */
export function logInfo(message) {
  console.log(chalk.blue.bold('[INFO]') + chalk.white(` ${message}`));
}

/**
 * Log a cache operation — magenta.
 * @param {string} message
 */
export function logCache(message) {
  console.log(chalk.magenta.bold('[CACHE]') + chalk.white(` ${message}`));
}

/**
 * Log an error — red background.
 * @param {string} message
 */
export function logError(message) {
  console.log(chalk.bgRed.white.bold(' ERROR ') + chalk.red(` ${message}`));
}

/**
 * Print the startup banner with server configuration.
 * @param {Object} config
 * @param {number} config.port
 * @param {string} config.origin
 * @param {number} config.ttl
 * @param {number} config.capacity
 */
export function printBanner({ port, origin, ttl, capacity }) {
  // Dynamically calculate banner width based on longest content line
  const lines = [
    `  Port:      ${port}`,
    `  Origin:    ${origin}`,
    `  TTL:       ${ttl}s`,
    `  Capacity:  ${capacity} items`,
  ];
  const title = '       🚀 Caching Proxy Server       ';
  const maxLen = Math.max(title.length, ...lines.map(l => l.length));
  const width = maxLen + 4; // padding

  const border = '═'.repeat(width);
  const pad = (text) => text + ' '.repeat(Math.max(0, width - text.length));

  console.log('');
  console.log(chalk.cyan(`╔${border}╗`));
  console.log(chalk.cyan('║') + chalk.white.bold(pad(title)) + chalk.cyan('║'));
  console.log(chalk.cyan(`╠${border}╣`));
  for (const line of lines) {
    const colored = line.replace(
      /:\s+(.+)$/,
      (_, val) => `:  ${chalk.green.bold(val)}`
    );
    const padded = colored + ' '.repeat(Math.max(0, width - line.length));
    console.log(chalk.cyan('║') + padded + chalk.cyan('║'));
  }
  console.log(chalk.cyan(`╚${border}╝`));
  console.log('');
}
