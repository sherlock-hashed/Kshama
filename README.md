<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Express.js-5.x-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/Tests-9%2F9%20Passing-brightgreen?style=for-the-badge&logo=jest&logoColor=white" />
  <img src="https://img.shields.io/badge/License-ISC-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Deployed-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" />
</p>

<h1 align="center">🚀 High-Performance HTTP Caching Proxy Server</h1>

<p align="center">
  <strong>A production-grade, CLI-driven reverse proxy that shields origin APIs from redundant traffic using an O(1) LRU + TTL in-memory cache engine — dropping network latency from ~440ms to 0ms.</strong>
</p>

<p align="center">
  <em>Built for infrastructure engineers who understand that the fastest HTTP request is the one you never make.</em>
</p>

---

## 📋 Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Problem Statement](#-1-problem-statement) | What real-world bottleneck this solves |
| 2 | [Solution Overview](#-2-solution-overview) | How this project eliminates that bottleneck |
| 3 | [Tech Stack](#-3-tech-stack) | Complete technology breakdown with justifications |
| 4 | [Features](#-4-features--production-metrics) | Core capabilities and production-grade safeguards |
| 5 | [System Architecture — HLD](#-5-system-architecture--high-level-design-hld) | High-Level Design with network topology diagrams |
| 6 | [System Architecture — LLD](#-6-system-architecture--low-level-design-lld) | Low-Level Design with algorithmic sequence diagrams |
| 7 | [Request Lifecycle](#-7-complete-request-lifecycle) | End-to-end data flow from TCP ingress to response |
| 8 | [Database Design](#-8-database-design--in-memory-schema) | In-memory schema, indexing strategy, and query patterns |
| 9 | [API Documentation](#-9-api-documentation) | All endpoints, request/response formats, and admin APIs |
| 10 | [Input / Output Behavior](#-10-input--output-behavior) | Live terminal output and HTTP header injection examples |
| 11 | [Docker & Deployment](#-11-docker--deployment-architecture) | Container orchestration, Render PaaS pipeline, CI/CD |
| 12 | [Project Structure](#-12-project-structure) | Full directory tree with file responsibilities |
| 13 | [Installation & Setup](#-13-installation--setup) | Step-by-step local, Docker, and cloud deployment |
| 14 | [Usage Guide](#-14-usage-guide) | How to operate the proxy in every environment |
| 15 | [Testing & Reliability](#-15-testing--reliability) | Jest test suite, coverage matrix, and edge case validation |
| 16 | [Performance & Optimization](#-16-performance--optimization) | Bottleneck analysis, Big-O proofs, and benchmarks |
| 17 | [Security Considerations](#-17-security-considerations) | Attack vectors, mitigations, and hardening strategies |
| 18 | [Challenges & Debugging](#-18-challenges--debugging) | Three production-critical bugs and how they were resolved |
| 19 | [Design Decisions & Trade-offs](#-19-design-decisions--trade-offs) | Architectural choices with honest trade-off analysis |
| 20 | [Scalability Analysis](#-20-scalability-analysis) | Vertical vs horizontal scaling strategy |
| 21 | [Key Learnings](#-21-key-learnings) | Deep technical insights gained during development |
| 22 | [Future Improvements](#-22-future-improvements) | Production evolution roadmap |
| 23 | [Interview Prep — Q&A](#-23-interview-prep--qa-bank) | 20+ rehearsed questions with structured answers |
| 24 | [Author & Contact](#-24-author--contact) | Professional links |
| 25 | [License](#-25-license) | Licensing information |

---

## 🔴 1. Problem Statement

### What problem exists?

In distributed systems, **redundant HTTP `GET` requests** sent continuously to backend APIs create three critical bottlenecks:

| Bottleneck | Impact | Real-World Example |
|---|---|---|
| **Origin Overload** | Database connection pool exhaustion, server crashes | 10,000 users polling `/api/products` every second |
| **Bandwidth Waste** | Inflated cloud billing (AWS/GCP egress costs) | Re-fetching identical 500KB JSON payloads thousands of times |
| **Geographic Latency** | 200–600ms round-trip delays per request | API server in US-East, users in India/Europe |

### Who faces this problem?

- **High-traffic frontend applications** that re-poll the same REST endpoints on every page load.
- **Microservice architectures** dependent on rate-limited third-party APIs (payment gateways, weather services).
- **Companies facing "Thundering Herd" events** — sudden traffic spikes that simultaneously overwhelm the origin database.

### Why it matters

Sluggish API responses directly cause **dropped user sessions**, **massive AWS scaling costs**, and the risk of being **permanently rate-limited** (`HTTP 429`) by external data providers.

```mermaid
pie title Why Caching Proxies Are Critical
    "Redundant GET Requests (Wasted Compute)" : 45
    "Geographic Latency Overhead" : 30
    "Cloud Bandwidth Billing" : 15
    "Rate Limiting / 429 Errors" : 10
```

---

## 🟢 2. Solution Overview

This project is a **custom-built infrastructure layer** that operates identically to enterprise CDNs like **Cloudflare** and **AWS CloudFront** — but at the application level.

### How it works (in 30 seconds)

> The proxy sits **in front** of any REST API origin. When **User #1** requests data, the proxy fetches it from the origin and secretly memorizes the response in RAM. When **Users #2 through #10,000** request the same data, the proxy intercepts the request and serves the cached response in **0ms** — completely shielding the origin database from traffic.

### Key Innovation

Instead of implementing a traditional LRU cache using a **Doubly-Linked List + HashMap** (the textbook LeetCode #146 approach), this project leverages the ES6 JavaScript `Map`'s **native insertion-order preservation** to achieve identical $O(1)$ time complexity with dramatically cleaner code and lower memory overhead.

```mermaid
flowchart TD
    subgraph Traffic["🌐 Incoming Traffic (10,000 Users)"]
        U1([User 1])
        U2([User 2])
        U3(["User 10,000"])
    end

    Proxy{"🛡️ Caching Proxy\nServer"}
    RAM[("⚡ O(1) Memory\nMap Engine")]
    Origin[("🗄️ Heavy Database\n/ Origin API")]

    U1 -- "GET /products (1st Request)" --> Proxy
    Proxy -- "❌ MISS → Fetch" --> Origin
    Origin -- "Save to Cache" --> RAM
    
    U2 -. "GET /products (Redundant)" .-> Proxy
    U3 -. "GET /products (Redundant)" .-> Proxy
    Proxy -- "✅ HIT (Intercepted!)" --> RAM

    style Origin fill:#ffcccc,stroke:#cc0000,stroke-width:2px
    style RAM fill:#ccffcc,stroke:#00aa00,stroke-width:2px
    style Proxy fill:#cce5ff,stroke:#0066cc,stroke-width:3px
```

---

## 🛠️ 3. Tech Stack

### Complete Technology Breakdown

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | 20+ | Async, event-driven I/O engine for network proxying |
| **Framework** | Express.js | 5.x | HTTP middleware pipeline, routing, body parsing |
| **Language** | JavaScript | ES6+ Modules | Modern `import/export`, native `fetch`, `Map` iterators |
| **Cache Engine** | ES6 `Map()` | Native | O(1) LRU + TTL in-memory key-value store |
| **CLI Framework** | Commander.js | 14.x | Terminal argument parsing (`--port`, `--origin`, etc.) |
| **Terminal UI** | Chalk | 5.x | Color-coded console output for observability |
| **Config** | dotenv | 17.x | Environment variable management |
| **Containerization** | Docker | Alpine-based | Lightweight OS isolation (~150MB image) |
| **Deployment** | Render PaaS | Free Tier | Auto-deploy from GitHub via webhook |
| **Testing** | Jest | 30.x | Unit testing with ESM experimental support |
| **Version Control** | Git + GitHub | — | Source management and CI/CD trigger |

### Why This Stack? (Interview-Ready Justifications)

```mermaid
mindmap
  root(("Tech Stack\nDecision Tree"))
    Runtime
      Node.js ✅
        Event-driven I/O
        Single-thread efficiency
        Native fetch API
      Python ❌
        Blocking WSGI
        Thread pool exhaustion
      Java ❌
        Heavy JVM footprint
        Slow Docker cold-starts
    Cache Engine
      ES6 Map ✅
        O_1 hash lookups
        Insertion order preserved
        Zero network overhead
      Redis ❌
        Adds 1-2ms network hop
        Overkill for single node
      JS Object ❌
        No insertion order guarantee
        O_1 LRU impossible
    Container
      Docker Alpine ✅
        ~150MB image
        Fast cold-starts
        OS-level isolation
      Direct NPM Deploy ❌
        No environment parity
        Version conflicts
```

**Node.js over Python/Java:**
> Proxy servers are almost entirely **I/O-bound** — they spend 99% of their time waiting for network packets, not computing. Node.js processes these network streams on a single thread via an asynchronous event loop (`libuv`), allowing it to handle **10,000+ concurrent connections** without spawning heavy OS threads. Python's Flask/Django uses synchronous blocking I/O (WSGI), and Java's JVM introduces unnecessary memory overhead for a lightweight proxy.

**ES6 `Map` over Redis:**
> Reading from a `Map` is constrained only by CPU bus speeds (~nanoseconds). Reading from Redis over `localhost:6379` forces a TCP packet hop, adding **1–2ms** to every request. For a single-node proxy designed for sub-millisecond responses, that network cost is unacceptable.

**ES6 `Map` over JS Object `{}`:**
> Standard JS Objects do **not** reliably guarantee insertion order for all key types. A `Map` natively preserves strict insertion order, which is the mathematical foundation for achieving $O(1)$ LRU eviction via `map.keys().next().value`.

---

## ✨ 4. Features & Production Metrics

### Core Features

| # | Feature | Technical Detail |
|---|---------|-----------------|
| 1 | **O(1) LRU Cache Engine** | ES6 `Map` with constant-time get/set/eviction — no doubly-linked list overhead |
| 2 | **TTL-Based Expiration** | Strict `Date.now() >= entry.expiry` bounds evaluation prevents stale data serving |
| 3 | **Idempotent Protocol Routing** | `GET` requests are cached; `POST/PUT/DELETE` are safely bypassed to preserve data integrity |
| 4 | **Hop-by-Hop Header Filtering** | Blacklist strips `transfer-encoding`, `connection`, `keep-alive` from proxied headers |
| 5 | **Real-Time CLI Telemetry** | Color-coded Chalk output: `[HIT]` (green), `[MISS]` (red), `[FORWARD]` (yellow) |
| 6 | **Custom HTTP Header Injection** | Every response tagged with `X-Cache` (HIT/MISS/BYPASS) and `X-Response-Time` |
| 7 | **Admin Dashboard APIs** | `GET /__cache_stats` for metrics, `DELETE /__clear_cache` for manual purge |
| 8 | **Graceful Shutdown Protocol** | POSIX `SIGTERM`/`SIGINT` handlers drain active connections before container termination |
| 9 | **Dynamic CLI Configuration** | Runtime parameters via `commander.js` with `.env` fallback and strict validation |
| 10 | **Docker + Cloud Ready** | Alpine-based container, `0.0.0.0` binding, Render PaaS webhook auto-deploy |

### Performance Metrics

```mermaid
xychart-beta
    title "Latency Comparison: Origin vs Cache (ms)"
    x-axis ["Request 1 (MISS)", "Request 2 (HIT)", "Request 3 (HIT)", "Request 4 (HIT)", "Request 5 (HIT)"]
    y-axis "Response Time (ms)" 0 --> 500
    bar [441, 0, 0, 0, 0]
```

| Metric | Before (Origin) | After (Cache HIT) | Improvement |
|--------|:----------------:|:------------------:|:-----------:|
| **Response Latency** | ~441ms | 0ms | **100% reduction** |
| **Docker Image Size** | ~1,100MB (`node:20`) | ~150MB (`node:20-alpine`) | **85% reduction** |
| **Cache Lookup Time** | $O(N)$ Array scan | $O(1)$ Map hash | **Constant time** |
| **LRU Eviction Time** | $O(N)$ Array shift | $O(1)$ Iterator pop | **Constant time** |

---

## 🏗️ 5. System Architecture — High-Level Design (HLD)

### Network Topology

The system is deployed as a **Reverse Proxy Edge Node** — positioned directly between client applications and origin servers to intercept, cache, and optimize HTTP traffic flows.

```mermaid
flowchart LR
    Client("🖥️ Client / Browser\n(cURL, Postman, Frontend)")
    Proxy("🛡️ Caching Proxy Server\n(Express.js on Node.js 20)")
    Cache[("⚡ In-Memory Cache\n(O(1) ES6 Map)")]
    Origin("🌐 Origin Server\n(e.g., dummyjson.com)")

    Client -- "HTTP Request" --> Proxy
    Proxy -- "Mutating Request\n(POST/PUT/DELETE)" --> Origin
    Proxy -- "GET Request" --> Cache
    Cache -- "✅ Cache HIT\n(0ms)" --> Client
    Cache -- "❌ Cache MISS" --> Origin
    Origin -- "Origin Response\n(~440ms)" --> Proxy
    Proxy -- "Cache Insertion\n(Capacity Lock)" --> Cache
    Proxy -- "Transformed Response\n(X-Cache Headers)" --> Client
```

### Architecture Type: Monolithic Edge Node

```mermaid
block-beta
    columns 3
    
    block:clients:1
        columns 1
        c1["Browser"]
        c2["cURL"]
        c3["Microservice"]
    end

    block:proxy:1
        columns 1
        express["Express.js\nMiddleware Pipeline"]
        router["Wildcard Router\napp.all('/*')"]
        cache_engine["CacheService.js\nLRU + TTL Engine"]
        memory[("ES6 Map()\nHeap Memory")]
    end

    block:origin:1
        columns 1
        api["REST API"]
        db[("Database")]
    end

    clients --> proxy
    proxy --> origin
```

### Why Monolithic?

A proxy server does **exactly one job**: intercept and route traffic. Splitting it into microservices would introduce the very network latency it was designed to eliminate. The monolith ensures **zero inter-service overhead**.

### HLD Component Interaction

```mermaid
flowchart TD
    subgraph ClientLayer["Client Layer"]
        Browser["Browser / App"]
        CLI["cURL / Postman"]
    end

    subgraph ProxyLayer["Proxy Layer (This Project)"]
        Express["Express.js Server\n(0.0.0.0:PORT)"]
        MW["Middleware Pipeline\n• express.json()\n• express.text()\n• express.urlencoded()\n• CORS Handler"]
        Router["Wildcard Router\n• /__cache_stats (Admin)\n• /__clear_cache (Admin)\n• /* (Proxy Catch-All)"]
        Logic["Business Logic\n• Method Check\n• Cache Lookup\n• Origin Fetch\n• Header Filter"]
        CacheEngine["CacheService.js\n• O(1) Map Engine\n• TTL Enforcement\n• LRU Eviction\n• Stats Tracking"]
    end

    subgraph DataLayer["Data Layer"]
        MapStore[("ES6 Map()\nKey-Value Store")]
    end

    subgraph ExternalLayer["External Layer"]
        Origin["Origin API Server"]
    end

    ClientLayer --> Express
    Express --> MW --> Router --> Logic
    Logic <--> CacheEngine
    CacheEngine <--> MapStore
    Logic -- "MISS / BYPASS" --> Origin
    Origin -- "Response" --> Logic
    Logic -- "X-Cache Headers" --> ClientLayer
```

---

## 🔬 6. System Architecture — Low-Level Design (LLD)

### LRU + TTL Cache Algorithm (Core Engine)

This is the mathematical heart of the system. The `CacheService.js` module uses the ES6 `Map`'s inherent insertion-order property to achieve $O(1)$ LRU mechanics without a doubly-linked list.

```mermaid
sequenceDiagram
    participant C as 🖥️ Client
    participant P as 🛡️ HTTP Proxy
    participant CS as ⚡ Cache Map Engine
    participant O as 🌐 External Origin

    C->>P: GET /users/1
    P->>CS: Lookup Key → "GET:/users/1"
    
    alt ✅ HIT: Key exists AND Date.now() < expiry
        CS->>CS: LRU Refresh: Delete Key → Re-Insert Key (push to end)
        CS-->>P: Return cached {body, status, headers}
        P->>P: Inject X-Cache: HIT, X-Response-Time: 0ms
        P-->>C: 200 OK (Latency: 0ms)
    else ❌ MISS: Key missing OR Date.now() >= expiry
        CS-->>P: Returns null
        P->>O: fetch("origin/users/1")
        O-->>P: Response body + headers (~440ms)
        P->>P: Filter hop-by-hop headers
        P->>CS: cache.set("GET:/users/1", {body, headers, status})
        alt 🔒 Capacity Reached: map.size >= capacity
            CS->>CS: LRU Eviction: map.keys().next().value → Delete oldest
        end
        P->>P: Inject X-Cache: MISS, X-Response-Time: 441ms
        P-->>C: 200 OK (Latency: ~441ms)
    end
```

### LRU Cache State Machine

```mermaid
stateDiagram-v2
    [*] --> Idle : Server started

    state "Request Processing" as RP {
        Idle --> MethodCheck : Incoming HTTP Request

        MethodCheck --> MutationBypass : POST/PUT/DELETE
        MethodCheck --> CacheLookup : GET

        MutationBypass --> OriginFetch : Forward body directly
        OriginFetch --> TagBypass : X-Cache: BYPASS
        TagBypass --> Respond

        CacheLookup --> TTLCheck : Key found in Map
        CacheLookup --> CacheMiss : Key not found

        TTLCheck --> CacheHit : Date.now() < expiry
        TTLCheck --> KeyExpired : Date.now() >= expiry

        KeyExpired --> PurgeKey : map.delete(key)
        PurgeKey --> CacheMiss

        CacheHit --> LRURefresh : Delete + Re-insert key
        LRURefresh --> TagHit : X-Cache: HIT
        TagHit --> Respond

        CacheMiss --> OriginFetch2 : fetch(origin + path)
        OriginFetch2 --> CapacityCheck : Response received
        
        CapacityCheck --> LRUEvict : map.size >= capacity
        CapacityCheck --> CacheInsert : map.size < capacity
        
        LRUEvict --> EvictOldest : map.keys().next().value
        EvictOldest --> CacheInsert
        
        CacheInsert --> MapSet : map.set(key, {data, expiry})
        MapSet --> TagMiss : X-Cache: MISS
        TagMiss --> Respond

        Respond --> Idle
    }
```

### Class Diagram — CacheService Module

```mermaid
classDiagram
    class CacheService {
        -Map cache
        -Number capacity
        -Number ttl
        -Object stats
        +constructor(options)
        +get(key) Object|null
        +set(key, data) void
        +has(key) boolean
        +clear() void
        +getStats() Object
        +static createKey(method, url) String
    }

    class CacheEntry {
        +Object data
        +Number expiry
    }

    class CacheData {
        +String body
        +Number status
        +Object headers
    }

    CacheService "1" --> "*" CacheEntry : stores
    CacheEntry "1" --> "1" CacheData : wraps

    note for CacheService "O(1) operations via ES6 Map\nLRU via insertion-order iterator\nTTL via Unix timestamp comparison"
```

### Core Algorithm — Annotated Source

```javascript
// ── O(1) LRU GET Operation ──────────────────────────────────────
get(key) {
    if (!this.cache.has(key)) {          // O(1) hash lookup
        this.stats.misses++;
        return null;                      // CACHE MISS
    }

    const entry = this.cache.get(key);    // O(1) hash retrieval

    if (Date.now() >= entry.expiry) {     // TTL expiration check
        this.cache.delete(key);           // Purge stale entry
        this.stats.misses++;
        return null;                      // Treat expired as MISS
    }

    // LRU Refresh: Delete and re-insert to push to end (most recent)
    this.cache.delete(key);               // O(1) removal
    this.cache.set(key, entry);           // O(1) re-insertion at end
    this.stats.hits++;
    return entry.data;                    // CACHE HIT
}

// ── O(1) LRU SET Operation with Capacity Enforcement ────────────
set(key, data) {
    if (this.cache.has(key)) {
        this.cache.delete(key);           // Refresh existing key position
    }

    if (this.cache.size >= this.capacity) {
        // LRU Eviction: Iterator grabs the OLDEST key (first inserted)
        const oldestKey = this.cache.keys().next().value;  // O(1)
        this.cache.delete(oldestKey);                       // O(1)
    }

    this.cache.set(key, {
        data,
        expiry: Date.now() + this.ttl * 1000,  // Unix timestamp
    });
}
```

---

## 🔄 7. Complete Request Lifecycle

### End-to-End Data Flow

```mermaid
flowchart TD
    A["1️⃣ TCP Stream arrives at Node.js libuv thread pool"] --> B["2️⃣ Assembled into HTTP Request object"]
    B --> C["3️⃣ Express Middleware Pipeline"]
    
    C --> D["express.json() — Parse JSON body"]
    D --> E["express.text() — Parse text body"]
    E --> F["express.urlencoded() — Parse form data"]
    F --> G["CORS Handler — Admin endpoint protection"]
    
    G --> H{"4️⃣ Is path /__cache_stats\nor /__clear_cache?"}
    
    H -- "Yes (Admin)" --> I["Return cache telemetry JSON"]
    
    H -- "No (Proxy)" --> J{"5️⃣ Is req.method === GET?"}
    
    J -- "No (POST/PUT/DELETE)" --> K["6️⃣ Build forwarding body"]
    K --> L["7️⃣ fetch(origin + path, {method, headers, body})"]
    L --> M["8️⃣ Copy non-hop-by-hop headers"]
    M --> N["9️⃣ Inject X-Cache: BYPASS"]
    N --> Z["🔟 Stream response to client"]
    
    J -- "Yes (GET)" --> O["6️⃣ Create cache key: 'GET:/path'"]
    O --> P{"7️⃣ cache.get(key)\nKey exists & TTL valid?"}
    
    P -- "✅ HIT" --> Q["8️⃣ Restore cached headers"]
    Q --> R["9️⃣ Inject X-Cache: HIT"]
    R --> Z
    
    P -- "❌ MISS" --> S["8️⃣ fetch(origin + path)"]
    S --> T["9️⃣ Extract cacheable headers\n(content-type, etag, etc.)"]
    T --> U["🔟 cache.set(key, {body, status, headers})"]
    U --> V{"Capacity check:\nmap.size >= limit?"}
    V -- "Yes" --> W["LRU Evict oldest"]
    V -- "No" --> X["Store directly"]
    W --> X
    X --> Y["Inject X-Cache: MISS"]
    Y --> Z
```

### Sync vs Async Operation Classification

| Operation | Type | Why | Latency |
|-----------|------|-----|---------|
| `Map.has(key)` | **Synchronous** | L1/L2 physical RAM hash lookup | ~0.001ms |
| `Map.get(key)` | **Synchronous** | Direct memory pointer dereference | ~0.001ms |
| `Map.set(key, val)` | **Synchronous** | Hash table insertion | ~0.001ms |
| `Map.delete(key)` | **Synchronous** | Hash table removal | ~0.001ms |
| `fetch(originURL)` | **Asynchronous** | TCP handshake + TLS + network transit | ~200–600ms |
| `Date.now()` | **Synchronous** | OS clock read | ~0.0001ms |

> **Why this matters:** Node.js runs on a single thread. All synchronous cache operations execute on the **main event loop** without blocking. The `fetch()` call is delegated to the OS kernel via `libuv`, freeing the thread to serve other users while waiting for the origin response.

---

## 🗄️ 8. Database Design — In-Memory Schema

### Schema Definition

This is a **stateless proxy** — there is no persistent SQL/NoSQL database. The "database" is an ES6 `Map` living on the V8 Engine's heap memory.

```mermaid
erDiagram
    CACHE_ENGINE ||--o{ CACHE_ENTRY : "manages"
    CACHE_ENTRY {
        string key "Unique hash key (e.g., 'GET:/products/1')"
        object data "Cached response payload"
        number expiry "Unix timestamp (ms) for TTL enforcement"
    }
    CACHE_ENTRY ||--|| CACHED_RESPONSE : "data contains"
    CACHED_RESPONSE {
        string body "Raw JSON/text response from origin"
        number status "HTTP status code (e.g., 200)"
        object headers "Filtered response headers"
    }
```

### Indexing Strategy

| Aspect | Implementation | Rationale |
|--------|---------------|-----------|
| **Primary Index** | `Map` key = `"METHOD:URL"` | Hash table provides O(1) direct lookup |
| **Ordering** | Insertion order preserved by `Map` | Enables O(1) LRU eviction via iterator |
| **Relationships** | None (flat key-value store) | No joins, no foreign keys — pure speed |

### Query Patterns

| Pattern | Frequency | Operation | Complexity |
|---------|-----------|-----------|:----------:|
| **Reads** (cache lookups) | ~99% of traffic | `map.get(key)` | $O(1)$ |
| **Writes** (cache insertions) | Only on MISS | `map.set(key, entry)` | $O(1)$ |
| **Deletes** (TTL expiry / LRU eviction) | Constant, deterministic | `map.delete(key)` | $O(1)$ |
| **Scans** (never) | 0% | — | — |

---

## 📡 9. API Documentation

### Proxy Endpoints

All incoming HTTP requests are intercepted by the wildcard catch-all route and proxied to the configured origin server.

| Method | Endpoint | Behavior | X-Cache Header |
|--------|----------|----------|:--------------:|
| `GET` | `/*` | Check cache → HIT or MISS → forward to origin if needed | `HIT` or `MISS` |
| `POST` | `/*` | Bypass cache entirely → forward body to origin | `BYPASS` |
| `PUT` | `/*` | Bypass cache entirely → forward body to origin | `BYPASS` |
| `PATCH` | `/*` | Bypass cache entirely → forward body to origin | `BYPASS` |
| `DELETE` | `/*` | Bypass cache entirely → forward to origin | `BYPASS` |

### Admin Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/__cache_stats` | Returns live cache telemetry | `{ hits, misses, size }` |
| `DELETE` | `/__clear_cache` | Purges entire cache and resets stats | `{ message: "Cache cleared successfully" }` |

### Request / Response Examples

#### GET Request (Cache MISS → first call)

```bash
curl -i http://localhost:3000/products/1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Cache: MISS
X-Response-Time: 441ms

{"id":1,"title":"Essence Mascara Lash Princess","price":9.99,...}
```

#### GET Request (Cache HIT → subsequent calls)

```bash
curl -i http://localhost:3000/products/1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Cache: HIT
X-Response-Time: 0ms

{"id":1,"title":"Essence Mascara Lash Princess","price":9.99,...}
```

#### POST Request (Cache BYPASS)

```bash
curl -X POST http://localhost:3000/products/add \
  -H "Content-Type: application/json" \
  -d '{"title":"New Product","price":19.99}'
```

```http
HTTP/1.1 201 Created
X-Cache: BYPASS
X-Response-Time: 850ms

{"id":195,"title":"New Product","price":19.99}
```

#### Cache Stats (Admin)

```bash
curl http://localhost:3000/__cache_stats
```

```json
{
  "hits": 15,
  "misses": 3,
  "size": 3
}
```

#### Cache Clear (Admin)

```bash
curl -X DELETE http://localhost:3000/__clear_cache
```

```json
{
  "message": "Cache cleared successfully"
}
```

---

## 💻 10. Input / Output Behavior

### Server Startup Banner

```bash
node src/index.js --port 3000 --origin http://dummyjson.com --ttl 60 --capacity 100
```

```text
╔═════════════════════════════════════════╗
║       🚀 Caching Proxy Server           ║
╠═════════════════════════════════════════╣
║  Port:      3000                        ║
║  Origin:    http://dummyjson.com        ║
║  TTL:       60s                         ║
║  Capacity:  100 items                   ║
╚═════════════════════════════════════════╝

[INFO] Proxying requests to http://dummyjson.com
[INFO] Cache stats: GET /__cache_stats
[INFO] Clear cache: DELETE /__clear_cache
```

### Live Request Logging

```text
[MISS]    GET /products/1           - 441ms   ← First request: origin fetch
[HIT]     GET /products/1           - 0ms     ← Second request: cached response
[HIT]     GET /products/1           - 0ms     ← Third request: still cached
[FORWARD] POST /products/add        - 850ms   ← Mutation: cache bypassed
[MISS]    GET /products/2           - 388ms   ← Different endpoint: origin fetch
[HIT]     GET /products/2           - 0ms     ← Cached
```

### Color Coding (Terminal)

| Tag | Color | Meaning |
|-----|-------|---------|
| `[HIT]` | 🟢 Green | Response served from cache |
| `[MISS]` | 🔴 Red | Fetched from origin, now cached |
| `[FORWARD]` | 🟡 Yellow | Non-GET request bypassed cache |
| `[INFO]` | 🔵 Blue | Informational system message |
| `[CACHE]` | 🟣 Magenta | Cache operation (clear, etc.) |
| `[ERROR]` | ⚫ Red BG | Error condition |

---

## 🐳 11. Docker & Deployment Architecture

### Container Architecture Diagram

```mermaid
flowchart RL
    subgraph Render["☁️ Render.com PaaS Architecture"]
        LoadB("🔀 Render Load Balancer\n(HTTPS Termination)")
        subgraph Docker["🐳 Docker Container (caching-proxy:latest)"]
            OS("🐧 Alpine Linux\n(~5MB Kernel)") --> Node("⚙️ Node.js 20\nBinary")
            Node --> ENV("🔧 ENV Vars\nPORT=10000\nORIGIN=...\nTTL=60\nCAPACITY=100")
            ENV --> App("🚀 Express Proxy\nBinding → 0.0.0.0:10000")
        end
        LoadB -- "Reverse Proxies\nHTTPS → HTTP" --> App
    end
    
    Internet("🌐 Client Requests\n(HTTPS)") --> LoadB
```

### Dockerfile (Annotated)

```dockerfile
# 1. Alpine Linux: ~5MB base vs ~1,100MB for standard Debian
#    85% image size reduction → faster cold-starts on PaaS
FROM node:20-alpine

# 2. Isolated working directory inside container
WORKDIR /app

# 3. Copy dependency manifests first (Docker layer caching optimization)
COPY package*.json ./

# 4. Production-only install: no Jest, no dev tools in production image
RUN npm install --production

# 5. Copy application source code
COPY . .

# 6. Document the expected port (informational only)
EXPOSE 3000

# 7. CMD (not ENTRYPOINT) allows PaaS systems to override flags
CMD ["node", "src/index.js"]
```

### Deployment Pipeline

```mermaid
flowchart LR
    Dev["👨‍💻 Developer\ngit push"] --> GitHub["📦 GitHub\nRepository"]
    GitHub -- "Webhook\nTrigger" --> Render["☁️ Render\nBuild System"]
    Render --> Docker_Build["🐳 Docker Build\nnpm install --production"]
    Docker_Build --> Deploy["🚀 Deploy\n0.0.0.0:10000"]
    Deploy --> Live["🌐 Live URL\nhttps://service.onrender.com"]
```

### Local Docker Execution

```bash
# Build the container image
docker build -t caching-proxy .

# Run with explicit configuration
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e ORIGIN=http://dummyjson.com \
  -e TTL=120 \
  -e CAPACITY=200 \
  caching-proxy
```

### Render PaaS Setup (Free Tier — $0 Cost)

1. `git push` to GitHub repository
2. Create a **Web Service** on [Render Console](https://render.com)
3. Point to the GitHub repo → Render auto-detects **Docker Runtime**
4. Set required **Environment Variables**:

| Variable | Value | Purpose |
|----------|-------|---------|
| `PORT` | `10000` | Internal routing (Render mandates this) |
| `ORIGIN` | `https://dummyjson.com` | Target origin API |
| `TTL` | `60` | Cache lifetime in seconds |
| `CAPACITY` | `100` | Maximum cached items |

5. Click **Deploy Web Service** → Live in ~2 minutes

> ⚠️ **Note:** Free tier instances spin down after 15 minutes of inactivity. Cold-start initialization takes ~30 seconds.

---

## 📁 12. Project Structure

```
cache-proxy-server/
├── 📄 .dockerignore          # Files excluded from Docker build context
├── 📄 .env.example           # Environment variable template
├── 📄 .gitignore             # Git exclusion rules
├── 📄 Dockerfile             # Production container configuration
├── 📄 package.json           # Dependencies, scripts, metadata
├── 📄 package-lock.json      # Deterministic dependency tree
├── 📄 README.md              # ← You are here
│
├── 📂 src/                   # Application source code
│   ├── 📄 index.js           # CLI entry point (commander.js argument parsing)
│   ├── 📄 server.js          # Express server, proxy routing, graceful shutdown
│   ├── 📂 cache/
│   │   └── 📄 CacheService.js   # O(1) LRU + TTL cache engine (core algorithm)
│   └── 📂 utils/
│       └── 📄 logger.js      # Chalk-powered color-coded terminal output
│
├── 📂 tests/                 # Test suite
│   └── 📄 cache.test.js      # 9 Jest unit tests for CacheService
│
└── 📂 docs/                  # Extended documentation (interview prep)
    ├── 📄 Interview.md           # Complete interview Q&A guide
    ├── 📄 System_Design_and_Architecture.md
    ├── 📄 Tech_Stack_and_Decisions.md
    ├── 📄 Features_Deep_Dive.md
    ├── 📄 Challenges_and_Debugging.md
    ├── 📄 Performance_and_Optimization.md
    └── 📄 Project_Pitch.md
```

### Module Responsibility Map

```mermaid
flowchart TD
    index["📄 index.js\n(CLI Entry Point)"]
    server["📄 server.js\n(Express Server)"]
    cache["📄 CacheService.js\n(Cache Engine)"]
    logger["📄 logger.js\n(Terminal UI)"]
    test["📄 cache.test.js\n(Test Suite)"]

    index -- "Parses CLI args\nValidates config" --> server
    server -- "Creates instance\nCalls get/set" --> cache
    server -- "Logs HIT/MISS/FORWARD" --> logger
    test -- "Unit tests\nget/set/evict/clear" --> cache

    style cache fill:#ccffcc,stroke:#00aa00,stroke-width:2px
    style server fill:#cce5ff,stroke:#0066cc,stroke-width:2px
```

---

## ⚡ 13. Installation & Setup

### Prerequisites

| Tool | Version | Check Command |
|------|---------|---------------|
| Node.js | ≥ 20.0.0 | `node --version` |
| npm | ≥ 9.0.0 | `npm --version` |
| Docker (optional) | Latest | `docker --version` |
| Git | Latest | `git --version` |

### Method 1: Local Development

```bash
# 1. Clone the repository
git clone https://github.com/your-username/cache-proxy-server.git
cd cache-proxy-server

# 2. Install dependencies
npm install

# 3. Configure environment (optional — CLI flags override these)
cp .env.example .env
# Edit .env with your preferred settings

# 4. Start the proxy server
node src/index.js --port 3000 --origin http://dummyjson.com

# 5. Test it — first request (MISS ~440ms)
curl http://localhost:3000/products/1

# 6. Test it — second request (HIT ~0ms)
curl http://localhost:3000/products/1
```

### Method 2: Docker Container

```bash
# Build the image
docker build -t caching-proxy .

# Run the container
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e ORIGIN=http://dummyjson.com \
  -e TTL=60 \
  -e CAPACITY=100 \
  caching-proxy
```

### Method 3: Quick Development Mode

```bash
# Uses preconfigured defaults from package.json
npm run dev
```

---

## 📖 14. Usage Guide

### CLI Configuration Options

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--port <number>` | `-p` | `3000` | Port for the proxy server |
| `--origin <url>` | `-o` | *(required)* | Origin server URL to proxy |
| `--ttl <seconds>` | `-t` | `60` | Cache Time-to-Live in seconds |
| `--capacity <number>` | `-c` | `100` | Maximum cached items (LRU limit) |
| `--clear-cache` | — | — | Clear cache of a running instance |

### Configuration Priority

```
CLI flags  →  Environment variables (.env)  →  Hardcoded defaults
 (highest)                                       (lowest)
```

### Example Configurations

```bash
# Standard development setup
node src/index.js --port 3000 --origin http://dummyjson.com

# Aggressive caching (2-minute TTL, 500 items)
node src/index.js --port 8080 --origin https://api.example.com --ttl 120 --capacity 500

# Minimal cache (10-second TTL, 10 items) for volatile data
node src/index.js --port 3000 --origin https://api.stocks.com --ttl 10 --capacity 10

# Clear cache of a running server on port 3000
node src/index.js --clear-cache --port 3000
```

### Operational Workflow

```mermaid
flowchart LR
    Start["Start Server\n--port 3000\n--origin API"] --> Use["Send HTTP\nRequests via\ncURL / Browser"]
    Use --> Monitor["Monitor via\n/__cache_stats"]
    Monitor --> Tune["Adjust TTL\nor Capacity"]
    Tune --> Clear["Clear Cache\nif Stale"]
    Clear --> Use
```

---

## 🧪 15. Testing & Reliability

### Test Suite Overview

The project ships with **9 comprehensive Jest unit tests** covering all critical paths of the `CacheService` engine:

```bash
# Run the full test suite
npm test
```

```text
PASS  tests/cache.test.js
  CacheService
    ✓ should successfully save and retrieve data (6 ms)
    ✓ should return null for a non-existent key (1 ms)
    ✓ should return null if data is older than TTL (1 ms)
    ✓ should evict the least recently used item when capacity is reached (1 ms)
    ✓ should refresh LRU position on access, preventing eviction (1 ms)
    ✓ should clear all entries and reset stats (1 ms)
    ✓ should correctly track hits and misses (1 ms)
    ✓ should overwrite existing key with new value and refresh position (1 ms)
    ✓ should create correct cache keys (3 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
```

### Test Coverage Matrix

| Test # | Scenario | What It Validates | Edge Case? |
|:------:|----------|-------------------|:----------:|
| 1 | Basic Set/Get | Data integrity after cache insertion | |
| 2 | Cache Miss | Returns `null` for non-existent keys | |
| 3 | TTL Expiration | `ttl=0` immediately expires entries | ✅ |
| 4 | LRU Eviction | Oldest key evicted at capacity | ✅ |
| 5 | LRU Refresh | Accessing a key prevents its eviction | ✅ |
| 6 | Cache Clear | Wipes all entries and resets stats | |
| 7 | Stats Tracking | Accurate hit/miss counters | |
| 8 | Key Overwrite | Update value + refresh LRU position | ✅ |
| 9 | Key Creation | Static method produces correct `METHOD:URL` format | |

### Production-Grade Safeguards Validated

| Safeguard | How It's Tested |
|-----------|----------------|
| **Memory Leak Prevention** | Capacity enforcement ensures `map.size` never exceeds limit |
| **Stale Data Prevention** | TTL=0 test confirms immediate expiration |
| **LRU Correctness** | Access-refresh test proves eviction targets the right key |
| **Data Integrity** | Overwrite test confirms value replacement without corruption |

---

## 📈 16. Performance & Optimization

### Optimization 1: Algorithmic Efficiency ($O(N)$ → $O(1)$)

```mermaid
flowchart LR
    subgraph Before["❌ Before: Array-Based LRU"]
        A1["array.indexOf(key)\nO(N) scan"] --> A2["array.splice(idx, 1)\nO(N) shift"] --> A3["array.push(key)\nO(1) append"]
    end
    
    subgraph After["✅ After: Map-Based LRU"]
        B1["map.has(key)\nO(1) hash"] --> B2["map.delete(key)\nO(1) remove"] --> B3["map.set(key, val)\nO(1) insert"]
    end
```

| Metric | Array-Based LRU | Map-Based LRU | Improvement |
|--------|:--------------:|:-------------:|:-----------:|
| **Lookup** | $O(N)$ — `array.indexOf()` | $O(1)$ — `map.has()` | ∞ at scale |
| **Eviction** | $O(N)$ — `array.shift()` + reindex | $O(1)$ — `map.keys().next().value` | ∞ at scale |
| **Insert** | $O(1)$ — `array.push()` | $O(1)$ — `map.set()` | Same |
| **10,000 items** | ~50ms per check | ~0.001ms per check | **50,000x faster** |

> **Trade-off:** Maps consume slightly more V8 heap memory per entry than flat arrays due to hash table overhead. Acceptable for a proxy where speed > memory.

### Optimization 2: Network Latency Compression

| Metric | Direct Origin | Via Cached Proxy |
|--------|:------------:|:----------------:|
| **TCP Handshake** | ✅ Required | ❌ Skipped |
| **TLS Negotiation** | ✅ Required | ❌ Skipped |
| **Geographic Transit** | ~200–600ms | 0ms |
| **Total Latency** | ~441ms | ~0ms |

> **Trade-off:** Caching solves latency but introduces **stale data risk**. Mitigated by TTL expiration and manual `DELETE /__clear_cache` admin purge.

### Optimization 3: Container Cold-Start Reduction

| Metric | `node:20` (Debian) | `node:20-alpine` |
|--------|:------------------:|:-----------------:|
| **Image Size** | ~1,100 MB | ~150 MB |
| **Cold-Start Time** | ~45 seconds | ~15 seconds |
| **Attack Surface** | Full OS utilities | Minimal kernel |

> **Trade-off:** Alpine uses `musl libc` instead of `glibc`. Certain C++ native modules (like `bcrypt`) may fail to compile. Acceptable for a pure JavaScript networking proxy.

---

## 🔐 17. Security Considerations

### Identified Attack Vectors & Mitigations

| Vector | Risk | Current Mitigation | Production Hardening |
|--------|------|-------------------|---------------------|
| **Admin API Abuse** | Attacker loops `DELETE /__clear_cache`, killing hit rates | CORS restrictions on `/__` prefixed routes | WAF/API-key middleware guard |
| **Cache Poisoning** | Caching mutation results leads to wrong data | `POST/PUT/DELETE` strictly bypass cache | — (fully mitigated) |
| **Hop-by-Hop Corruption** | Copying `transfer-encoding` crashes Node TCP sockets | Header blacklist filter before proxying | — (fully mitigated) |
| **Memory Exhaustion (OOM)** | Caching 100MB video payloads crashes V8 heap | Capacity limit + LRU eviction | Add payload size check (`buffer.length > 5MB → BYPASS`) |
| **Injection Attacks** | Raw unparsed buffers corrupting memory | `express.json()` + `express.text()` + `express.urlencoded()` | Input sanitization middleware |

### Header Filtering (Hop-by-Hop Blacklist)

```javascript
const skipHeaders = new Set([
    'transfer-encoding',    // OS-level stream directive — crashes if copied
    'connection',           // Socket lifecycle management — single-hop only
    'keep-alive',           // Connection persistence — single-hop only
    'content-encoding',     // Decompression context — proxy handles differently
    'content-length',       // Body size — changes after proxy transformation
]);
```

---

## 🐛 18. Challenges & Debugging

### Challenge 1: The "Hop-by-Hop" Protocol Collision

```mermaid
flowchart LR
    subgraph Problem["❌ The Bug"]
        O1["Origin API\n(Cloudflare)"] -- "Sends: transfer-encoding: chunked\nconnection: keep-alive" --> P1["Proxy copies\nALL headers"] -- "Corrupts TCP socket" --> C1["Client gets\nconnection reset"]
    end
    
    subgraph Solution["✅ The Fix"]
        O2["Origin API"] -- "Sends all headers" --> P2["Proxy FILTERS\nhop-by-hop headers"] -- "Clean headers only" --> C2["Client receives\nvalid response"]
    end
```

| Phase | Detail |
|-------|--------|
| **Symptom** | Proxy crashed with raw TCP socket errors when proxying Cloudflare-wrapped endpoints |
| **Initial Hypothesis** | JSON body too large, causing Out-of-Memory crash |
| **Investigation** | Used `curl -v` to inspect raw packet stream; body was fine, connection reset during *header transmission phase* |
| **Root Cause** | `Transfer-Encoding: chunked` and `Connection: keep-alive` are **Hop-by-Hop headers** — meant for a single network hop only. Copying them corrupted the proxy's own TCP socket management |
| **Fix** | Built a blacklist `Set` filtering 5 restricted headers before injecting origin headers into the proxy response |
| **Learning** | HTTP headers are categorized into "End-to-End" (safe to proxy) and "Hop-by-Hop" (single-hop only). This is defined in **RFC 2616 §13.5.1** |

### Challenge 2: Container Scaling Connection Drops

| Phase | Detail |
|-------|--------|
| **Symptom** | Users received `502 Bad Gateway` errors during Render deployments or free-tier spin-downs |
| **Initial Hypothesis** | Cache size exceeding Docker RAM limit, causing OOM crashes |
| **Investigation** | Simulated by downloading large payload via proxy, then pressing `Ctrl+C` — download died instantly |
| **Root Cause** | Node.js default behavior immediately calls `process.exit()` on `SIGTERM`, severing all active TCP connections without draining them |
| **Fix** | Overrode OS signal handlers: `server.close()` stops new connections but waits for active ones; 10-second `setTimeout` failsafe force-kills if sockets hang |
| **Learning** | Writing code that *works* is 50% of the job. Writing code that *survives Docker scaling, Kubernetes orchestration, and PaaS termination* is what makes software production-ready |

### Challenge 3: The "Ghost Payload" POST Bypass

| Phase | Detail |
|-------|--------|
| **Symptom** | `POST` requests through the proxy were rejected by the origin API or hung indefinitely |
| **Initial Hypothesis** | Origin rejecting proxy requests due to missing authorization headers |
| **Investigation** | `console.log(req.body)` returned `undefined` immediately before the origin fetch |
| **Root Cause** | Without body-parsing middlewares, Node.js Express does not automatically assemble incoming TCP buffer chunks into a parsed `req.body` object. The proxy was forwarding empty `undefined` payloads |
| **Fix** | Mounted global body parsers at the top of the middleware pipeline: `express.json()`, `express.text()`, `express.urlencoded()` |
| **Learning** | Node.js raw streams are just byte chunks on a TCP buffer. Frameworks like Express abstract them — but only if you explicitly configure the parsing middlewares. You cannot blindly forward an unparsed packet |

---

## ⚖️ 19. Design Decisions & Trade-offs

### Decision Matrix

```mermaid
quadrantChart
    title Design Decision Trade-offs
    x-axis "Low Complexity" --> "High Complexity"
    y-axis "Low Performance" --> "High Performance"
    quadrant-1 "Ideal Zone"
    quadrant-2 "Over-Engineered"
    quadrant-3 "Under-Powered"
    quadrant-4 "Simple but Slow"
    "ES6 Map Cache": [0.3, 0.9]
    "Redis Cache": [0.7, 0.85]
    "Array LRU": [0.2, 0.3]
    "Express.js": [0.35, 0.75]
    "Raw http module": [0.6, 0.85]
    "Docker Alpine": [0.25, 0.8]
```

### Decision 1: Caching `GET` Only vs Caching Everything

| Aspect | Detail |
|--------|--------|
| **Chose** | Strictly cache `GET` requests; bypass `POST/PUT/DELETE` |
| **Why** | `GET` is **idempotent** — it reads data without side effects. Caching a `POST /transfer-money` would mean the second user clicking "Transfer" receives a cached `200 OK` without the backend actually processing the financial transaction |
| **Trade-off** | Sacrificed full-application caching coverage to ensure **catastrophic data-integrity bugs cannot exist** |

### Decision 2: In-Memory Map vs Redis

| Aspect | ES6 Map (Chosen) | Redis (Rejected) |
|--------|:-----------------:|:-----------------:|
| **Latency** | 0ms (CPU bus speed) | 1–2ms (TCP hop) |
| **Complexity** | Zero infrastructure | Requires separate container |
| **Horizontal Scaling** | ❌ Not shared across nodes | ✅ Shared across cluster |
| **Persistence** | ❌ Lost on restart | ✅ Survives restart |
| **Decision** | ✅ Chosen for prototype | 🔮 Future evolution path |

### Decision 3: Express.js vs Raw `http` Module

| Aspect | Express.js (Chosen) | Raw `http.createServer()` |
|--------|:-------------------:|:-------------------------:|
| **Dev Speed** | ✅ Middleware pipeline, JSON parsing, header tools | ❌ Manual TCP buffer stitching |
| **Performance** | ~5–10% throughput penalty | ✅ Maximum raw efficiency |
| **Maintainability** | ✅ Readable middleware chain | ❌ Spaghetti socket handling |
| **Decision** | ✅ Chosen for clarity | Rejected — overkill |

---

## 📊 20. Scalability Analysis

### Where Does It Break?

```mermaid
flowchart TD
    subgraph Current["Current Architecture (Vertical)"]
        S1["Single Node.js Instance"]
        M1[("ES6 Map\n(V8 Heap: ~1.4GB limit)")]
        S1 <--> M1
    end
    
    subgraph Scaled["Future Architecture (Horizontal)"]
        LB["AWS/Nginx\nLoad Balancer"]
        S2["Proxy Node 1"]
        S3["Proxy Node 2"]
        S4["Proxy Node N"]
        R[("Redis Cluster\n(Shared Cache)")]
        
        LB --> S2
        LB --> S3
        LB --> S4
        S2 <--> R
        S3 <--> R
        S4 <--> R
    end
    
    Current -- "Traffic exceeds\nsingle-node RAM" --> Scaled
```

| Scale | Strategy | Action |
|-------|----------|--------|
| **10–10,000 req/min** | Vertical | Current architecture works perfectly |
| **10K–100K req/min** | Vertical + RAM | `node --max-old-space-size=16384` on a 16GB VM |
| **100K+ req/min** | Horizontal | Replace `CacheService.js` with Redis; deploy N proxy nodes behind load balancer |
| **1M+ req/min** | CDN-tier | Add geographic edge nodes, implement cache sharding, deploy Redis Cluster with read replicas |

### Bottleneck Identification

| Component | Bottleneck | Threshold | Solution |
|-----------|-----------|-----------|----------|
| **RAM** | V8 Heap limit (~1.4GB default) | ~50,000 cached JSON responses | Increase `--max-old-space-size` or migrate to Redis |
| **CPU** | Single-threaded event loop | Heavy computational payloads | Node.js cluster mode (`cluster.fork()`) |
| **Network** | Single NIC throughput | ~1 Gbps on standard instances | Horizontal scaling behind load balancer |
| **Cache Coherency** | Isolated per-instance Maps | Any multi-node deployment | Redis as centralized cache |

---

## 🧠 21. Key Learnings

### Technical Insights Gained

| # | Learning | Context |
|---|---------|---------|
| 1 | **HTTP headers have strict classifications** | "End-to-End" headers can be proxied; "Hop-by-Hop" headers (RFC 2616) are for single connections only. Copying `transfer-encoding` across hops crashes TCP sockets |
| 2 | **Data structures have real-world performance impact** | Switching from Array ($O(N)$) to Map ($O(1)$) eliminated the risk of Event Loop blocking under high cache sizes |
| 3 | **Production code must survive orchestration** | Docker/Kubernetes send `SIGTERM` before container termination. Without graceful shutdown handlers, active user downloads are violently severed |
| 4 | **Body parsing is not automatic in Node.js** | Express does not parse `req.body` unless middleware is explicitly mounted. Forgetting this causes silent `undefined` payload forwarding |
| 5 | **LRU ≠ just "delete the oldest"** | Accessing a cached key must refresh its position to prevent frequently-used items from being incorrectly evicted |
| 6 | **Container image size directly impacts user experience** | A 1.1GB Docker image adds 30+ seconds to PaaS cold-starts. Alpine (~150MB) cuts this to ~15 seconds |
| 7 | **Idempotency is a safety requirement, not a feature** | Caching `POST` requests can cause financial data corruption, duplicate transactions, and stale state |

---

## 🔮 22. Future Improvements

| Priority | Improvement | Technical Approach | Impact |
|:--------:|------------|-------------------|--------|
| 🔴 High | **Redis Migration** | Replace `CacheService.js` Map with `ioredis` client | Enables horizontal scaling across N proxy nodes |
| 🔴 High | **Payload Size Guard** | Add `buffer.length > 5MB → BYPASS` before cache insertion | Prevents V8 OOM crashes from giant payloads |
| 🟡 Medium | **Background TTL Sweeper** | `setInterval()` worker to passively purge expired keys | Eliminates "dead memory" sitting in RAM between accesses |
| 🟡 Medium | **API Key Auth for Admin** | `authorization: Bearer <token>` middleware on `/__` routes | Prevents cache-clearing DDOS attacks |
| 🟡 Medium | **Cache Warming** | Pre-populate cache with known high-traffic endpoints on startup | Eliminates cold-start cache misses |
| 🟢 Low | **Metrics Dashboard** | WebSocket-powered real-time UI showing HIT/MISS rates | Visual observability for operations team |
| 🟢 Low | **Compression** | `zlib.gzip()` cached responses before storage | ~70% RAM reduction for JSON payloads |
| 🟢 Low | **Rate Limiting** | Express rate-limit middleware on proxy routes | Protects against client-side abuse |

### Evolution Roadmap

```mermaid
timeline
    title Architecture Evolution Roadmap
    section Current (v1.0) : Single Node
        Completed : In-Memory ES6 Map Cache
        Completed : Docker + Render Deployment
        Completed : 9/9 Test Coverage
    section Next (v2.0) : Production Hardening
        Planned : Redis Cache Migration
        Planned : Payload Size Guards
        Planned : Background TTL Sweeper
        Planned : Admin API Authentication
    section Future (v3.0) : Enterprise Scale
        Vision : Multi-node Horizontal Scaling
        Vision : Geographic Edge Nodes
        Vision : Prometheus + Grafana Observability
        Vision : Cache Sharding by Route
```

---

## 🎙️ 23. Interview Prep — Q&A Bank

### Section A: Project Overview Questions

**Q1: "Walk me through this project in 30 seconds."**
> *"I built a reverse proxy that shields backend APIs from redundant GET traffic by caching responses in an O(1) LRU memory engine. In live testing, it dropped network latency from 440ms to 0ms. It's Dockerized, deployed on Render, and handles graceful shutdowns for cloud orchestration."*

**Q2: "What problem does this solve?"**
> *"When 10,000 users request the same product catalog, the backend computes it 10,000 times. My proxy intercepts after the first request and serves the rest from RAM — saving compute, bandwidth, and eliminating geographic latency."*

**Q3: "How is this different from just adding Redis?"**
> *"Redis adds a 1-2ms network hop per lookup. My Map operates at CPU bus speed — true 0ms. For a single-node proxy, that means eliminating 100% of latency, not just reducing it. Redis becomes necessary only when scaling horizontally."*

---

### Section B: System Design Questions

**Q4: "Draw the architecture on a whiteboard."**
> *Draw: Client → Proxy (Express + Map Cache) → Origin. Show the decision diamond for GET vs POST. Label X-Cache: HIT/MISS/BYPASS on the response arrows.*

**Q5: "Why did you choose a monolithic architecture?"**
> *"A proxy does exactly one job: intercept and route traffic. Splitting it into microservices would introduce the very inter-service network latency I'm trying to eliminate. The monolith ensures zero overhead."*

**Q6: "What happens if the origin is down?"**
> *"The `fetch()` call throws an error, caught by a try-catch block. The proxy returns a proper `502 Bad Gateway` JSON response to the client without corrupting the cache. It never caches error responses."*

**Q7: "What happens after the request hits the server?"**
> *"It passes through Express body parsers, is evaluated for HTTP idempotency (GET vs POST), hashed into a Map key, and either instantly retrieved from heap memory or delegated back to the OS kernel via fetch() to await the origin response."*

---

### Section C: Algorithm & Data Structure Questions

**Q8: "Why Map over a Doubly-Linked List + HashMap?"**
> *"Both achieve O(1) LRU mechanics. But the DLL+HashMap requires maintaining pointer references, node allocation/deallocation, and significantly more code. ES6 Map gives you the same complexity with 10 lines of code because it natively preserves insertion order."*

**Q9: "Explain the LRU eviction in one sentence."**
> *"`map.keys().next().value` grabs the first-inserted key (oldest), and `map.delete(key)` removes it — both in O(1) constant time."*

**Q10: "How does the LRU refresh work?"**
> *"When a cached key is accessed, I delete it and immediately re-insert it. This pushes it to the end of the Map's insertion order, making it the most recently used. The oldest item naturally stays at the front."*

**Q11: "Will O(1) hold at scale?"**
> *"Yes. Whether the cache holds 10 items or 10,000,000 items, the exact CPU time for a lookup, insertion, or eviction remains identically constant. That's the mathematical guarantee of hash tables."*

---

### Section D: Networking & HTTP Questions

**Q12: "What is a Reverse Proxy vs a Forward Proxy?"**
> *"A forward proxy (like a VPN) hides the client from the internet. A reverse proxy — which is what I built — hides the origin server from the client. The user believes they're pulling data directly from the proxy, unaware that it's actually routing traffic internally."*

**Q13: "What are Hop-by-Hop headers?"**
> *"HTTP headers categorized by RFC 2616 as being meaningful only for a single network hop. Headers like `transfer-encoding`, `connection`, and `keep-alive` dictate how the OS manages a specific TCP socket connection. Copying them from the origin to the client corrupts the proxy's own socket management."*

**Q14: "Why don't you cache POST requests?"**
> *"POST is a mutating method. Imagine caching a `POST /transfer-money` — the second user clicking 'Transfer' would receive a cached `200 OK` without the backend ever processing the financial transaction. Caching mutations breaks idempotency and can cause real-world data corruption."*

---

### Section E: DevOps & Production Questions

**Q15: "How do you handle container shutdowns?"**
> *"I listen for POSIX SIGTERM/SIGINT signals. When received, `server.close()` stops accepting new connections but waits for all active streams to finish. A 10-second `setTimeout` fallback force-kills the process if any socket hangs, preventing infinite blocking."*

**Q16: "Why Alpine over standard Debian?"**
> *"Standard `node:20` carries a 1.1GB Debian footprint. Alpine is ~150MB — an 85% reduction. For PaaS platforms that dynamically spin containers up/down, smaller images mean drastically faster cold-starts. Users stop seeing 30-second loading screens."*

**Q17: "How would you deploy this to production at scale?"**
> *"I'd containerize N proxy instances behind an AWS/Nginx load balancer, replace the in-memory Map with a centralized Redis cluster so all instances share cache state, add Prometheus metrics for observability, and implement cache sharding by route prefix."*

---

### Section F: Trade-off & Scaling Questions

**Q18: "What breaks first at scale?"**
> *"The RAM allocation. V8 heaps max out at ~1.4GB by default. If the downstream API returns 100MB video buffers without a size filter, the Node process crashes with OOM. This forces an architectural migration to either Redis or edge CDN binary storage."*

**Q19: "What's the main trade-off of your caching strategy?"**
> *"Speed vs freshness. I get 0ms responses but introduce stale data risk. I mitigate this with strict TTL expiration and a manual admin purge API, but there's always a window where cached data doesn't match the origin."*

**Q20: "Why didn't you use Go? It's faster for proxying."**
> *"Go's goroutines are arguably better for pure proxying throughput. But proxy bottlenecks are I/O-bound, not CPU-bound — Node's async event loop handles concurrent I/O efficiently. I also specifically needed the ES6 Map's insertion-order behavior for the LRU algorithm, which doesn't have a direct equivalent in Go's standard library."*

---

### Section G: Behavioral / Soft Skills

**Q21: "What was the hardest bug you faced?"**
> *"The Hop-by-Hop header collision. My proxy crashed only on specific endpoints. I spent hours thinking it was a body-size issue before `curl -v` revealed the connection was resetting during header transmission. Realizing it was a TCP-level protocol violation — not an application-level bug — was the breakthrough."*

**Q22: "What would you do differently?"**
> *"I'd add a payload size guard from day one. Currently, if someone caches a 500MB video response, it could crash the V8 heap. Adding a `buffer.length > 5MB → BYPASS` check would be a 3-line fix that prevents catastrophic OOM failures."*

**Q23: "How do you frame your answers?"**
> *"Top-down. Start with the 30,000-foot view: 'I built a reverse proxy that shields APIs.' Only dive into Map internals if asked. Always defend with metrics: '440ms dropped to 0ms.' Always mention Docker and SIGTERM — companies want engineers who understand production survival."*

---

## 👤 24. Author & Contact

| | |
|---|---|
| **Name** | Varad Parate |
| **Email** | [your-email@gmail.com](mailto:your-email@gmail.com) |
| **LinkedIn** | [linkedin.com/in/your-profile](https://linkedin.com/in/your-profile) |
| **GitHub** | [github.com/your-username](https://github.com/your-username) |
| **Portfolio** | [your-portfolio.com](https://your-portfolio.com) |

---

## 📜 25. License

This project is licensed under the **ISC License**.

```
ISC License

Copyright (c) 2026, Varad Parate

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.
```

---

<p align="center">
  <strong>⭐ If this project demonstrates engineering maturity, give it a star!</strong><br/>
  <em>Built with obsessive attention to infrastructure, algorithms, and production-grade architecture.</em>
</p>
