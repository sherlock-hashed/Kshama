# 🚀 Caching Proxy Server

A **CLI-based caching proxy server** built with Node.js that forwards HTTP requests to an origin server, caches GET responses using an **LRU + TTL** eviction strategy, and provides real-time **observability** through colored logging, cache statistics, and response-time headers.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **LRU Eviction** | Least Recently Used eviction when cache hits capacity limit |
| **TTL Expiration** | Time-to-live for cached entries — stale data is auto-expired |
| **HTTP Method Filtering** | Only caches `GET` requests; `POST/PUT/DELETE` are forwarded directly |
| **Cache Stats Endpoint** | `GET /__cache_stats` returns real-time hit/miss/size metrics |
| **Clear Cache** | Via CLI (`--clear-cache`) or API (`DELETE /__clear_cache`) |
| **Performance Headers** | `X-Cache: HIT/MISS/BYPASS` and `X-Response-Time` on every response |
| **Colored CLI Logging** | Green HITs, red MISSes, yellow FORWARDs in the terminal |
| **Docker Support** | Lightweight Alpine-based Docker image with CLI flag passthrough |
| **Env Fallback** | `.env` support with CLI flags as the primary configuration source |

---

## 📦 Tech Stack

- **Runtime:** Node.js 18+ (native `fetch`)
- **Framework:** Express.js
- **CLI:** Commander.js
- **Logging:** Chalk
- **Testing:** Jest
- **Containerization:** Docker

---

## 🏗️ Architecture

```
┌──────────┐     ┌────────────────────────┐     ┌──────────────┐
│  Client   │────▶│    Caching Proxy       │────▶│   Origin     │
│  Request  │     │    Server (Express)    │     │   Server     │
└──────────┘     └──────────┬─────────────┘     └──────────────┘
                            │
                   ┌────────▼────────┐
                   │   CacheService  │
                   │  (LRU + TTL)    │
                   │  JavaScript Map │
                   └─────────────────┘
```

**Request Flow:**
1. Client sends request to proxy
2. **If `GET`:** Check cache → HIT (return cached) or MISS (fetch, cache, return)
3. **If non-`GET`:** Forward directly to origin (X-Cache: BYPASS)
4. Every response includes `X-Cache` and `X-Response-Time` headers

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- npm

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd caching-proxy

# Install dependencies
npm install

# (Optional) Copy example env file
cp .env.example .env
```

### Usage

```bash
# Start the proxy server
node src/index.js --port 3000 --origin http://dummyjson.com

# With custom TTL and capacity
node src/index.js --port 3000 --origin http://dummyjson.com --ttl 120 --capacity 200

# Clear cache of a running server
node src/index.js --clear-cache --port 3000

# View help
node src/index.js --help
```

### CLI Flags

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-p, --port <number>` | Number | `3000` | Port for the proxy server |
| `-o, --origin <url>` | String | — | Origin server URL (**required**) |
| `-t, --ttl <seconds>` | Number | `60` | Cache TTL in seconds |
| `-c, --capacity <number>` | Number | `100` | Max cached items (LRU limit) |
| `--clear-cache` | Boolean | `false` | Clear cache and exit |

> **Priority:** CLI flags → Environment variables (`.env`) → Defaults

---

## 🔌 API Endpoints

### Proxy
Any request to `http://localhost:<port>/<path>` is forwarded to `<origin>/<path>`.

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/__cache_stats` | Returns `{ hits, misses, size }` |
| `DELETE` | `/__clear_cache` | Clears cache, returns confirmation |

**Example:**
```bash
# Get cache stats
curl http://localhost:3000/__cache_stats

# Clear cache
curl -X DELETE http://localhost:3000/__clear_cache
```

---

## 🧪 Testing

```bash
# Run all tests
npm test
```

**Test Coverage:**
| # | Test | What it verifies |
|---|------|------------------|
| 1 | Basic set/get | Values are stored and retrieved correctly |
| 2 | Cache miss | Non-existent keys return `null` |
| 3 | TTL expiration | Expired entries return `null` |
| 4 | LRU eviction | Oldest item is evicted at capacity |
| 5 | LRU refresh | Accessing an item prevents its eviction |
| 6 | Clear cache | All entries and stats are reset |
| 7 | Stats tracking | Hit/miss counters increment correctly |
| 8 | Key overwrite | Existing keys update value and position |
| 9 | Cache key format | `createKey()` generates correct `METHOD:URL` keys |

---

## 🐳 Docker

### Build

```bash
docker build -t caching-proxy .
```

### Run

```bash
# Option 1: Using environment variables (recommended for production/cloud)
docker run -p 3000:3000 \
  -e ORIGIN=http://dummyjson.com \
  -e PORT=3000 \
  -e TTL=60 \
  -e CAPACITY=100 \
  caching-proxy

# Option 2: Override CMD with CLI flags (for local testing)
docker run -p 3000:3000 caching-proxy \
  node src/index.js --port 3000 --origin http://dummyjson.com --ttl 60 --capacity 100
```

> Uses `CMD` with environment variable support. Compatible with both local Docker and cloud platforms (Render, Railway, etc.) that configure apps via env vars.

---

## 📁 Project Structure

```
caching-proxy/
├── src/
│   ├── index.js              # CLI entry point (Commander)
│   ├── server.js             # Express proxy server
│   ├── cache/
│   │   └── CacheService.js   # LRU + TTL cache engine
│   └── utils/
│       └── logger.js         # Chalk-powered colored logger
├── tests/
│   └── cache.test.js         # Jest unit tests
├── Dockerfile                # Docker container config
├── .dockerignore             # Docker build exclusions
├── .env.example              # Environment variable template
├── .gitignore
├── package.json
└── README.md
```

---

## 🔑 Key Design Decisions

### LRU Cache with JavaScript `Map`
JavaScript's `Map` preserves insertion order. By deleting a key and re-inserting it, we move it to the "most recently used" position. The first key in `Map.keys()` is always the LRU candidate. This gives us **O(1)** get, set, and eviction — matching the Doubly Linked List + HashMap approach with cleaner code.

### Cache Key Format
Cache keys are formatted as `METHOD:URL` (e.g., `GET:/products`). This ensures different HTTP methods to the same URL don't collide.

### HTTP Method Filtering
Only `GET` requests are cached because they are idempotent. `POST`, `PUT`, `DELETE`, and `PATCH` requests modify server state and should never be served from cache.

---

## 📄 License

ISC
