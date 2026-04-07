/**
 * CacheService Unit Tests
 *
 * Tests the pure cache logic: set/get, TTL expiration, LRU eviction,
 * stats tracking, and cache clearing. No server or network calls needed.
 */

import CacheService from '../src/cache/CacheService.js';

describe('CacheService', () => {

  // ── Test 1: Basic Set and Get ─────────────────────────────────
  test('should successfully save and retrieve data', () => {
    const cache = new CacheService({ capacity: 10, ttl: 60 });

    cache.set('http://api.com/users', { name: 'John' });
    const result = cache.get('http://api.com/users');

    expect(result).toEqual({ name: 'John' });
  });

  // ── Test 2: Cache Miss ────────────────────────────────────────
  test('should return null for a non-existent key', () => {
    const cache = new CacheService({ capacity: 10, ttl: 60 });

    const result = cache.get('http://api.com/nonexistent');

    expect(result).toBeNull();
  });

  // ── Test 3: TTL Expiration ────────────────────────────────────
  test('should return null if data is older than TTL', () => {
    const cache = new CacheService({ capacity: 10, ttl: 0 }); // 0 second TTL

    cache.set('url1', 'data1');

    // TTL is 0 seconds, so the entry expires immediately
    // We need a small delay to ensure Date.now() advances past the expiry
    const result = cache.get('url1');

    // With ttl=0, expiry = Date.now() + 0ms, so it should expire
    // on the very next get() call since Date.now() will be >= expiry
    expect(result).toBeNull();
  });

  // ── Test 4: LRU Eviction ──────────────────────────────────────
  test('should evict the least recently used item when capacity is reached', () => {
    const cache = new CacheService({ capacity: 2, ttl: 60 });

    cache.set('url1', 'data1');
    cache.set('url2', 'data2');
    cache.set('url3', 'data3'); // This should evict url1 (LRU)

    expect(cache.get('url1')).toBeNull();    // Evicted
    expect(cache.get('url2')).toBe('data2'); // Still present
    expect(cache.get('url3')).toBe('data3'); // Still present
  });

  // ── Test 5: LRU Refresh on Access ────────────────────────────
  test('should refresh LRU position on access, preventing eviction', () => {
    const cache = new CacheService({ capacity: 2, ttl: 60 });

    cache.set('url1', 'data1');
    cache.set('url2', 'data2');

    // Access url1 — this refreshes its position (moves to most recent)
    cache.get('url1');

    // Now url2 is the LRU (least recently used), not url1
    cache.set('url3', 'data3'); // Should evict url2 (not url1)

    expect(cache.get('url1')).toBe('data1'); // Preserved (was accessed recently)
    expect(cache.get('url2')).toBeNull();    // Evicted (was LRU)
    expect(cache.get('url3')).toBe('data3'); // Still present
  });

  // ── Test 6: Clear Cache ───────────────────────────────────────
  test('should clear all entries and reset stats', () => {
    const cache = new CacheService({ capacity: 10, ttl: 60 });

    cache.set('url1', 'data1');
    cache.set('url2', 'data2');
    cache.get('url1'); // Generate a hit
    cache.get('missing'); // Generate a miss

    cache.clear();

    const stats = cache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.size).toBe(0);
    expect(cache.get('url1')).toBeNull();
  });

  // ── Test 7: Stats Tracking ────────────────────────────────────
  test('should correctly track hits and misses', () => {
    const cache = new CacheService({ capacity: 10, ttl: 60 });

    cache.set('url1', 'data1');
    cache.set('url2', 'data2');

    cache.get('url1');       // HIT
    cache.get('url2');       // HIT
    cache.get('url1');       // HIT
    cache.get('nonexistent'); // MISS
    cache.get('also-missing'); // MISS

    const stats = cache.getStats();
    expect(stats.hits).toBe(3);
    expect(stats.misses).toBe(2);
    expect(stats.size).toBe(2);
  });

  // ── Test 8: Overwrite Existing Key ────────────────────────────
  test('should overwrite existing key with new value and refresh position', () => {
    const cache = new CacheService({ capacity: 2, ttl: 60 });

    cache.set('url1', 'original');
    cache.set('url2', 'data2');

    // Overwrite url1 — this should also refresh its LRU position
    cache.set('url1', 'updated');

    expect(cache.get('url1')).toBe('updated'); // Value updated

    // url2 is now LRU. Adding url3 should evict url2 (not url1)
    cache.set('url3', 'data3');
    expect(cache.get('url2')).toBeNull();    // Evicted
    expect(cache.get('url1')).toBe('updated'); // Still present
  });

  // ── Bonus Test: createKey static method ───────────────────────
  test('should create correct cache keys', () => {
    expect(CacheService.createKey('GET', '/products')).toBe('GET:/products');
    expect(CacheService.createKey('POST', '/users')).toBe('POST:/users');
  });

});
