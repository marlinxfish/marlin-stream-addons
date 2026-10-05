# 🐟 Marlin Stream Addons

> ⚠️ **EDUCATIONAL & RESEARCH USE ONLY**: This software is a proof-of-concept demonstrating edge computing with Hono, Cloudflare Workers, and the open Stremio Addon Protocol. It does **not** host, store, or stream any media files. Read [DISCLAIMER.md](./DISCLAIMER.md) for full terms.

A lightweight, zero-bandwidth stream resolver addon for Stremio built with TypeScript, Hono, and Bun, deployable to Cloudflare Workers.

---

## ⚖️ Legal & Non-Hosting Notice

- **Zero-Storage Architecture:** This addon does not store, upload, or proxy any video bytes.
- **Direct Streaming:** All resolved video links point directly to public third-party CDNs.
- **Third-Party Sources:** All search queries are parsed from public third-party web directories. The authors do not control or endorse external content.

---

## 🚀 Getting Started

### Local Development
```bash
bun install
bun run dev      # Local simulator via wrangler
bun test         # Run unit test suite
```

### Production Deployment (Cloudflare Workers)
```bash
bun run deploy
```
Deploy the worker and install the generated manifest URL into Stremio:
`https://<your-worker-subdomain>.workers.dev/manifest.json`

---

## 📜 License & Disclaimers

Licensed under the [MIT License](./LICENSE). See [DISCLAIMER.md](./DISCLAIMER.md) for limitations of liability.
