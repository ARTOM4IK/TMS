# WebCraft: Voxel Sandbox Engine on WebGPU

## Overview

WebCraft is a browser-based voxel sandbox implementation featuring procedural terrain generation, real-time multiplayer synchronization, and a fully custom rendering pipeline using WebGPU. The project serves as both a gaming environment and a demonstration of low-level graphics programming, peer-to-peer networking, and efficient data serialization within a web context.

The system comprises a Node.js backend providing authentication, world persistence, and signaling services, alongside a client-side engine that handles 3D rendering, physics, entity AI, and network communication. All core subsystems are implemented in vanilla JavaScript (ES modules) without reliance on high-level game engines or rendering abstractions.

---

## Technology Stack

### Runtime Environment
- **Node.js** - server-side runtime.
- **WebGPU** - native browser API for low-level GPU access (compute and render pipelines).
- **WebRTC** - peer-to-peer data channels for real-time state synchronization.
- **MongoDB** - document database for persistent world storage.

### Dependencies (Client)
- `wgpu-matrix` - linear algebra library for 3D transformations (mat4, vec3, etc.).
- `zstdify` - Zstandard compression/decompression for chunk payloads.
- **Socket.IO client** - signaling channel for WebRTC connection establishment.

### Dependencies (Server)
- `express` - HTTP routing and middleware.
- `socket.io` - WebSocket-based signaling server.
- `jsonwebtoken` - JWT-based authentication.
- `bcryptjs` - password hashing.
- `nodemailer` - email delivery for password recovery.
- `dotenv` - environment configuration.
- `cors` - cross-origin resource sharing.

### Build & Deployment
- No bundler - ES modules are loaded natively in the browser.
- Static assets (shaders, textures, models) served directly from the `bin/` directory.

---

## Architectural Design

### Client-Side Core

The client is structured as a collection of loosely coupled modules orchestrated by the `Game` class:

- **Rendering Layer (`Renderer`, `Camera`, `EntityRenderer`)** - manages the WebGPU device, command encoding, pipeline creation, and frame submission. Supports skybox rendering, instanced chunk meshes, and animated entity models (both box-based and GLTF-loaded).
- **World System (`World`, `Chunk`, `terrainGenerator`)** - maintains a spatial hash map of chunks (16x256x16 blocks). Terrain is generated via multi-octave Perlin noise with biome-dependent surface composition. Chunks are dynamically meshed on the GPU using compute shaders that perform face culling and vertex assembly.
- **Entity Subsystem (`Player`, `RemotePlayer`, `EntityManager`, `mobs`)** - manages local player state, remote player interpolation, and autonomous mob AI (wandering, chasing, exploding). Mob behavior is governed by finite-state machines with configurable speed and aggression parameters.
- **Physics Controller** - implements discrete collision detection against block voxels using AABB tests. Supports grounded movement, jumping, flying (Homelander role), and friction damping.
- **Network Module (`Multiplayer`)** - establishes WebRTC data channels via a Socket.IO signaling server. Encodes and broadcasts player transforms, block modifications, and laser effects. Uses sequence numbers to deduplicate incoming block updates.
- **UI Components (`InventoryUI`, `ChatConsole`, `PlayerListUI`)** - provide overlay interfaces for inventory management, in-game chat, and player presence display.

### Server-Side Architecture

The backend exposes a REST API (`/api`) for user management, world metadata, and chunk persistence. Key endpoints:

- `/api/register`, `/api/login` - user authentication with JWT.
- `/api/worlds` - CRUD operations for world instances.
- `/api/worlds/:id/chunks` - batch retrieval and individual PUT for compressed chunk data.
- `/api/worlds/:id/players/me` - save/load player state (position, inventory, role).

The Socket.IO server handles WebRTC signaling (offers, answers, ICE candidates) and relays chat messages and administrative commands (`/tp`, `/ban`, etc.). User roles (player, homelander, admin) are resolved from database fields and enforced at the command level.

### Data Persistence

Chunk data is stored as binary blobs compressed with **RLE (run-length encoding)** followed by **Zstandard** compression. This achieves high compression ratios for sparse voxel data typical of terrain. The storage schema includes chunk coordinates, format version, and the compressed payload.

Player states are stored as JSON documents containing position, orientation, inventory slots, and role-specific flags (e.g., flying mode). World metadata includes seed, type, creator, creation timestamp, and a list of active players.

---

## Key Algorithms and Optimizations

### Terrain Generation
- **Heightmap** computed using domain-warped Perlin noise with continent, erosion, and peak layers.
- **Biome classification** based on temperature and moisture values derived from separate noise maps.
- **Cave carving** using 3D noise thresholding, affecting stone layers below the surface.
- **Tree placement** via pseudo-random selection with local density constraints (forest and plains biomes).

### GPU-Driven Mesh Construction
- Each chunk maintains a `faceBuffer` (storage buffer) where compute shaders write quads for visible block faces.
- The compute shader iterates over all blocks in the chunk, checks neighbor solidity, and outputs vertices only for exposed faces.
- Vertex data is packed as `vec3` positions and `uint` material indices, later expanded in the vertex shader.
- The number of generated faces is stored in a counter buffer, enabling dynamic draw call dispatching.

### Network Synchronization
- **Player state** is broadcast every 50 ms via WebRTC data channels using JSON-serialized messages.
- **Block changes** are sent with a monotonically increasing sequence number to prevent processing of duplicate or out-of-order updates.
- **Laser effects** are transmitted as ray origin, direction, and length; clients render them as translucent cylinders with additive blending.

### Culling and Frustum Clipping
- Camera view-projection matrix is uploaded to a uniform buffer; each chunk stores its AABB for early frustum tests on the CPU.
- Chunks outside the view frustum are skipped entirely in the render pass, reducing draw call overhead.

---

## Build and Execution

### Prerequisites
- Node.js with npm.
- MongoDB instance (local or remote).
- WebGPU-capable browser (Chrome 120+, Edge, Opera; Firefox with `dom.webgpu.enabled` flag).

### Installation
```bash
git clone https://github.com/ARTOM4IK/TMS.git
cd webcraft
npm install