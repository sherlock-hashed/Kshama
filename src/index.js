#!/usr/bin/env node

/**
 * Caching Proxy — CLI Entry Point
 *
 * A CLI tool that starts a caching proxy server with configurable
 * TTL expiration, LRU eviction, and observability features.
 *
 * Usage:
 *   caching-proxy --port 3000 --origin http://dummyjson.com
 *   caching-proxy --port 3000 --origin http://dummyjson.com --ttl 120 --capacity 200
 *   caching-proxy --clear-cache
 *
 * Priority: CLI flags > Environment variables > Defaults
 */

import { Command } from 'commander';
import dotenv from 'dotenv';
import { startServer } from './server.js';
import { logInfo, logCache, logError } from './utils/logger.js';

// Load .env file (if it exists) — values are fallbacks, CLI flags take priority
dotenv.config();

const program = new Command();

program
  .name('caching-proxy')
  .description('A CLI-based caching proxy server with TTL + LRU eviction and observability.')
  .version('1.0.0')
  .option('-p, --port <number>', 'Port for the proxy server', process.env.PORT || '3000')
  .option('-o, --origin <url>', 'Origin server URL to proxy', process.env.ORIGIN)
  .option('-t, --ttl <seconds>', 'Cache TTL in seconds', process.env.TTL || '60')
  .option('-c, --capacity <number>', 'Max cached items (LRU limit)', process.env.CAPACITY || '100')
  .option('--clear-cache', 'Clear the cache of a running server instance')
  .action(async (options) => {
    // ── Handle --clear-cache ────────────────────────────────────
    if (options.clearCache) {
      const port = parseInt(options.port, 10);
      logInfo(`Clearing cache on port ${port}...`);

      try {
        const response = await fetch(`http://localhost:${port}/__clear_cache`, {
          method: 'DELETE',
        });
        const data = await response.json();
        logCache(data.message);
      } catch (error) {
        logError(`Failed to clear cache. Is the server running on port ${port}?`);
        logError(error.message);
        process.exit(1);
      }
      return;
    }

    // ── Validate required flags ─────────────────────────────────
    if (!options.origin) {
      logError('Missing required flag: --origin <url>');
      logInfo('Example: caching-proxy --port 3000 --origin http://dummyjson.com');
      process.exit(1);
    }

    // ── Parse and validate config ───────────────────────────────
    const config = {
      port: parseInt(options.port, 10),
      origin: options.origin,
      ttl: parseInt(options.ttl, 10),
      capacity: parseInt(options.capacity, 10),
    };

    if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
      logError(`Invalid port: "${options.port}". Must be a number between 1 and 65535.`);
      process.exit(1);
    }

    if (isNaN(config.ttl) || config.ttl < 0) {
      logError(`Invalid TTL: "${options.ttl}". Must be a non-negative number.`);
      process.exit(1);
    }

    if (isNaN(config.capacity) || config.capacity < 1) {
      logError(`Invalid capacity: "${options.capacity}". Must be a positive number.`);
      process.exit(1);
    }

    // ── Start the server ────────────────────────────────────────
    startServer(config);
  });

program.parse(process.argv);
