# 🐟 Marlin Stream Addons

> ⚠️ **EDUCATIONAL & RESEARCH USE ONLY**: This software is a proof-of-concept demonstrating edge computing with Hono, Cloudflare Workers, and the open Stremio Addon Protocol. It does **not** host, store, or stream any media files. Read [DISCLAIMER.md](./DISCLAIMER.md) for full terms.

A lightweight, zero-bandwidth stream resolver addon for Stremio built with TypeScript, Hono, and Bun, deployable to Cloudflare Workers.

---

## ⚖️ Legal & Non-Hosting Notice

- **Zero-Storage Architecture:** This addon does not store, upload, or proxy any video bytes.
- **Direct Streaming:** All resolved video links point directly to public third-party CDNs.
- **Third-Party Sources:** All search queries are parsed from public third-party web directories. The authors do not control or endorse external content.

---

## 🚀 Quick Start

### Local Development
```bash
bun install
bun run start     # Run locally on http://localhost:7000
bun test          # Run test suite
bun run tunnel    # Optional: share to phone/TV via Cloudflare Quick Tunnel
```

---

## 🖥️ Production Deployment (VPS / Linux Server)

### Option 1: Standalone Bun with Systemd (Recommended, ~50MB RAM)
1. Copy template systemd service:
   ```bash
   sudo cp marlin-addon.service.example /etc/systemd/system/marlin-addon.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now marlin-addon
   ```
2. Check status and healthcheck:
   ```bash
   curl http://localhost:7000/health
   ```

### Option 2: Docker Compose with Auto-SSL (1-Command, Recommended)
Includes Caddy + Let's Encrypt SSL and Addon service in a single stack:
1. Copy environment configuration:
   ```bash
   cp .env.example .env
   # Edit .env and set DOMAIN=<YOUR_VPS_IP>.sslip.io
   nano .env
   ```
2. Start all services:
   ```bash
   docker compose up -d
   ```
3. Buka Portal Konfigurasi:
   Kunjungi `https://<YOUR_VPS_IP>.sslip.io/configure` di browser untuk memilih resolusi dan memasukkan **Access Key** (jika diatur di `.env`).
4. Klik **INSTALL ADDON** untuk memasang langsung ke Stremio.
---

## 📡 Cloudflare Workers (Serverless Alternative)
```bash
bun run deploy
```
*Note: Serverless Cloudflare Workers restricts direct subrequests to raw IP addresses (Oppadrama) and may trigger Cloudflare bot challenges.*

## 📜 License & Disclaimers

Licensed under the [MIT License](./LICENSE). See [DISCLAIMER.md](./DISCLAIMER.md) for limitations of liability.
