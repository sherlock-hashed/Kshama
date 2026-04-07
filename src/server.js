/**
 * Proxy Server — Express-based HTTP proxy with caching layer
 *
 * Request Flow:
 * 1. Client → Proxy Server
 * 2. If GET → check cache → HIT (return cached) or MISS (fetch from origin, cache, return)
 * 3. If non-GET → forward directly to origin (never cache)
 * 4. All responses include X-Cache and X-Response-Time headers
 */

import express from 'express';
import CacheService from './cache/CacheService.js';
import {
  logHit,
  logMiss,
  logForward,
  logInfo,
  logCache,
  logError,
  printBanner,
} from './utils/logger.js';

/**
 * Start the caching proxy server.
 *
 * @param {Object} config
 * @param {number} config.port - Port to listen on
 * @param {string} config.origin - Origin server URL to proxy
 * @param {number} config.ttl - Cache TTL in seconds
 * @param {number} config.capacity - Max cache items (LRU limit)
 */
export function startServer({ port, origin, ttl, capacity }) {
  const app = express();
  const cache = new CacheService({ capacity, ttl });

  // Strip trailing slash from origin to avoid double-slash in URLs
  const originUrl = origin.replace(/\/+$/, '');

  // ─── Middleware ──────────────────────────────────────────────────
  // Parse JSON and text request bodies for POST/PUT/PATCH forwarding
  app.use(express.json());
  app.use(express.text());
  app.use(express.urlencoded({ extended: true }));

  // ─── CORS for Admin Endpoints ───────────────────────────────────
  app.use((req, res, next) => {
    if (req.path.startsWith('/__')) {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
    }
    next();
  });

  // ─── Admin Route: Cache Stats ────────────────────────────────────
  app.get('/__cache_stats', (req, res) => {
    const stats = cache.getStats();
    logInfo(`Cache stats requested → Hits: ${stats.hits}, Misses: ${stats.misses}, Size: ${stats.size}`);
    res.json(stats);
  });

  // ─── Admin Route: Clear Cache ────────────────────────────────────
  app.delete('/__clear_cache', (req, res) => {
    cache.clear();
    logCache('Cache cleared successfully');
    res.json({ message: 'Cache cleared successfully' });
  });

  // ─── Catch-All Proxy Route ───────────────────────────────────────
  app.all('/{*path}', async (req, res) => {
    const start = Date.now();
    const path = req.originalUrl;
    const method = req.method;

    try {
      // ── Non-GET: Forward directly, never cache ──────────────────
      if (method !== 'GET') {
        // Build the body to forward
        let forwardBody = undefined;
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
          if (typeof req.body === 'string') {
            forwardBody = req.body;
          } else if (req.body && Object.keys(req.body).length > 0) {
            forwardBody = JSON.stringify(req.body);
          }
        }

        const response = await fetch(`${originUrl}${path}`, {
          method,
          headers: {
            'Content-Type': req.headers['content-type'] || 'application/json',
            'Accept': req.headers['accept'] || '*/*',
          },
          body: forwardBody,
        });

        const body = await response.text();
        const elapsed = Date.now() - start;

        logForward(method, path, elapsed);

        // Copy relevant headers from origin response
        copyResponseHeaders(response, res);
        res.set('X-Cache', 'BYPASS');
        res.set('X-Response-Time', `${elapsed}ms`);
        res.status(response.status).send(body);
        return;
      }

      // ── GET: Check cache first ──────────────────────────────────
      const cacheKey = CacheService.createKey(method, path);
      const cached = cache.get(cacheKey);

      if (cached) {
        // CACHE HIT — return cached response
        const elapsed = Date.now() - start;
        logHit(method, path, elapsed);

        // Restore original headers from cached response
        if (cached.headers) {
          for (const [key, value] of Object.entries(cached.headers)) {
            res.set(key, value);
          }
        }

        res.set('X-Cache', 'HIT');
        res.set('X-Response-Time', `${elapsed}ms`);
        res.status(cached.status).send(cached.body);
        return;
      }

      // CACHE MISS — fetch from origin
      const response = await fetch(`${originUrl}${path}`, {
        method: 'GET',
        headers: {
          'Accept': req.headers['accept'] || '*/*',
        },
      });

      const body = await response.text();
      const elapsed = Date.now() - start;

      // Extract headers worth caching
      const headersToCache = {};
      const headersToCopy = ['content-type', 'content-language', 'cache-control', 'etag', 'last-modified'];
      for (const header of headersToCopy) {
        const value = response.headers.get(header);
        if (value) headersToCache[header] = value;
      }

      // Store in cache
      cache.set(cacheKey, {
        body,
        status: response.status,
        headers: headersToCache,
      });

      logMiss(method, path, elapsed);

      // Send response to client
      copyResponseHeaders(response, res);
      res.set('X-Cache', 'MISS');
      res.set('X-Response-Time', `${elapsed}ms`);
      res.status(response.status).send(body);

    } catch (error) {
      const elapsed = Date.now() - start;
      logError(`Failed to proxy ${method} ${path}: ${error.message}`);
      res.set('X-Response-Time', `${elapsed}ms`);
      res.status(502).json({
        error: 'Bad Gateway',
        message: `Failed to reach origin server: ${error.message}`,
      });
    }
  });

  // ─── Start Listening (bind to 0.0.0.0 for Docker/Cloud) ────────
  const server = app.listen(port, '0.0.0.0', () => {
    printBanner({ port, origin: originUrl, ttl, capacity });
    logInfo(`Proxying requests to ${originUrl}`);
    logInfo(`Cache stats: GET /__cache_stats`);
    logInfo(`Clear cache: DELETE /__clear_cache`);
  });

  // ─── Graceful Shutdown ──────────────────────────────────────────
  const shutdown = (signal) => {
    logInfo(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      logInfo('Server closed. Goodbye!');
      process.exit(0);
    });
    // Force exit after 10s if connections don't close
    setTimeout(() => {
      logError('Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return app;
}

/**
 * Copy relevant headers from a fetch Response to an Express response.
 * Skips hop-by-hop headers that shouldn't be forwarded.
 *
 * @param {Response} fetchResponse - The fetch API Response
 * @param {import('express').Response} expressResponse - The Express response
 */
function copyResponseHeaders(fetchResponse, expressResponse) {
  const skipHeaders = new Set([
    'transfer-encoding',
    'connection',
    'keep-alive',
    'content-encoding',
    'content-length',
  ]);

  fetchResponse.headers.forEach((value, key) => {
    if (!skipHeaders.has(key.toLowerCase())) {
      expressResponse.set(key, value);
    }
  });
}
