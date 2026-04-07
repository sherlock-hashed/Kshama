/**
 * CacheService — LRU + TTL Cache Engine
 *
 * Uses JavaScript's built-in Map which preserves insertion order.
 * - Deleting a key and re-inserting it moves it to the end (most recently used).
 * - The first key in the Map is always the least recently used (LRU).
 *
 * This gives us O(1) get, set, and eviction — the same complexity
 * as a Doubly Linked List + HashMap approach, but with cleaner code.
 *
 * Interview talking points:
 * - LRU Cache (LeetCode #146) implemented in a real project
 * - TTL-based expiration for cache freshness
 * - Stats tracking for observability
 */

class CacheService {
  /**
   * @param {Object} options
   * @param {number} options.capacity - Maximum number of items in the cache (default: 100)
   * @param {number} options.ttl - Time-to-live in seconds (default: 60)
   */
  constructor({ capacity = 100, ttl = 60 } = {}) {
    this.cache = new Map();
    this.capacity = capacity;
    this.ttl = ttl;
    this.stats = {
      hits: 0,
      misses: 0,
    };
  }

  /**
   * Generate a cache key from method and URL.
   * @param {string} method - HTTP method
   * @param {string} url - Request URL path
   * @returns {string} Cache key
   */
  static createKey(method, url) {
    return `${method}:${url}`;
  }

  /**
   * Retrieve a value from the cache.
   *
   * - If the key doesn't exist → MISS
   * - If the key is expired (TTL) → delete it → MISS
   * - If valid → refresh its position (LRU touch) → HIT
   *
   * @param {string} key - The cache key
   * @returns {Object|null} Cached entry or null
   */
  get(key) {
    // Key doesn't exist
    if (!this.cache.has(key)) {
      this.stats.misses++;
      return null;
    }

    const entry = this.cache.get(key);

    // Check TTL expiration
    if (Date.now() >= entry.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // LRU refresh: delete and re-insert to move to end (most recent)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.data;
  }

  /**
   * Store a value in the cache.
   *
   * - If the key already exists → delete it first (refresh position)
   * - If at capacity → evict the LRU item (first key in Map)
   * - Insert at end with TTL expiry timestamp
   *
   * @param {string} key - The cache key
   * @param {*} data - The data to cache
   */
  set(key, data) {
    // If key exists, delete it first to refresh its position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // LRU eviction: if at capacity, delete the oldest entry (first key)
    if (this.cache.size >= this.capacity) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    // Store with expiry timestamp
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl * 1000,
    });
  }

  /**
   * Check if a key exists and is not expired.
   * Does NOT count as a hit/miss and does NOT refresh LRU position.
   *
   * @param {string} key - The cache key
   * @returns {boolean}
   */
  has(key) {
    if (!this.cache.has(key)) return false;

    const entry = this.cache.get(key);
    if (Date.now() >= entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear the entire cache and reset stats.
   */
  clear() {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Get cache statistics.
   *
   * @returns {{ hits: number, misses: number, size: number }}
   */
  getStats() {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
    };
  }
}

export default CacheService;
