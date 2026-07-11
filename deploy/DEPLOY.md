# Deploying Breeze Applications

Breeze apps run anywhere Node.js runs. This guide covers the four most common
deployment targets: **Docker**, **Vercel**, **Render**, and a raw **VM**.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start: Run Locally](#quick-start-run-locally)
- [1. Deploy with Docker](#1-deploy-with-docker)
- [2. Deploy to Vercel (Serverless)](#2-deploy-to-vercel-serverless)
- [3. Deploy to Render](#3-deploy-to-render)
- [4. Deploy to a VM](#4-deploy-to-a-vm)
- [The Breeze Web App Structure](#the-breeze-web-app-structure)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Install the Breeze runtime (requires Node.js 18+):

```bash
npm install -g breeze-lang
```

Verify it works:

```bash
breeze version
# breeze 1.0.0
```

---

## Quick Start: Run Locally

Clone the example web API and run it:

```bash
cd examples/web-api
breeze run src/main.bz
```

```
Breeze API starting on port 3000...
Endpoints:
  GET  /           health check
  GET  /items      list all items
  POST /items      create an item
  GET  /items/<id> get one item
```

Test it with curl:

```bash
curl http://localhost:3000/items
# [{"id":1,"name":"Learn Breeze","done":false},...]
```

---

## 1. Deploy with Docker

Docker is the most portable option — it works on any cloud, any VM, and any
orchestrator (Kubernetes, ECS, Fly.io, Railway, etc.).

The included [`Dockerfile`](Dockerfile) bundles the Breeze runtime with
Node.js 20.

```bash
cd examples/web-api
docker build -t breeze-api .
docker run -p 3000:3000 -e PORT=3000 breeze-api
```

Your API is now live at `http://localhost:3000`.

### Deploying to a container registry

```bash
# Tag and push to Docker Hub
docker tag breeze-api yourusername/breeze-api:latest
docker push yourusername/breeze-api:latest

# Or GitHub Container Registry
docker tag breeze-api ghcr.io/youruser/breeze-api:latest
docker push ghcr.io/youruser/breeze-api:latest
```

### Cloud platforms that accept Docker images directly

- **Fly.io**: `fly launch` then `fly deploy`
- **Railway**: connect your repo, Railway auto-detects the Dockerfile
- **Google Cloud Run**: `gcloud run deploy --source .`
- **AWS App Runner**: create a service from the ECR image
- **Azure Container Apps**: deploy from any registry

---

## 2. Deploy to Vercel (Serverless)

Vercel runs serverless functions on Node.js. Breeze apps need a thin Node
wrapper that loads the Breeze program and bridges Vercel's request/response
to the Breeze handler.

### Setup

1. Your Breeze app must **export a `handle` function** instead of calling
   `http.listen` (Vercel manages the server):

   ```breeze
   # src/main.bz
   export func handle(req):
     method = json.get(req, "method")
     path = json.get(req, "path")
     if method == "GET" and path == "/":
       return [
         ["status", 200],
         ["headers", [["Content-Type", "application/json"]]],
         ["body", "{\"ok\":true}"]
       ]
     return [
       ["status", 404],
       ["headers", []],
       ["body", "Not found"]
     ]
   ```

2. Copy [`vercel-api.ts`](vercel-api.ts) to `api/index.ts` in your project.

3. Copy [`vercel.json`](vercel.json) to your project root.

4. Add dependencies:

   ```json
   {
     "dependencies": {
       "breeze-lang": "^1.0.0",
       "@vercel/node": "^3.0.0"
     }
   }
   ```

### Deploy

```bash
npm install -g vercel
vercel        # preview deployment
vercel --prod # production deployment
```

Vercel assigns a URL like `https://your-app.vercel.app`. Every request is
routed through `api/index.ts` → your Breeze `handle` function.

> **Note:** Vercel serverless functions have a 10–60 second timeout depending
> on your plan. For long-running processes or WebSocket servers, use Docker
> or Render instead.

---

## 3. Deploy to Render

Render runs long-lived web services, which is perfect for Breeze apps that
use `http.listen`.

### Option A: Blueprint (recommended)

1. Copy [`render.yaml`](render.yaml) to your repo root.
2. Push to GitHub/GitLab.
3. In the Render dashboard: **New → Blueprint** → select your repo.
4. Render reads `render.yaml` and creates the service automatically.

### Option B: Manual

1. Create a new **Web Service** on Render, connected to your repo.
2. Set:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npx breeze run src/main.bz`
3. Render sets the `PORT` environment variable automatically — your Breeze
   app reads it via `env.get("PORT")`.

### Environment variables

Add any config your app needs under **Environment** in the Render dashboard.
Breeze reads them with `env.get("NAME")`.

---

## 4. Deploy to a VM

For a raw Linux VM (DigitalOcean droplet, EC2, Linode, Hetzner, etc.), use
the included [`deploy-vm.sh`](deploy-vm.sh) script. It installs Node.js,
installs Breeze globally, copies your app to `/opt/<name>`, and registers a
systemd service.

```bash
# On the VM (as root):
curl -fsSL https://raw.githubusercontent.com/Saff9/Breeze/main/deploy/deploy-vm.sh | bash -s -- myapp

# Or, from a clone:
sudo ./deploy-vm.sh myapp /path/to/your/breeze/app
```

### Managing the service

```bash
journalctl -u breeze-myapp -f      # follow logs
systemctl restart breeze-myapp     # restart after code updates
systemctl stop breeze-myapp        # stop
systemctl status breeze-myapp      # check status
```

### Updating the app

```bash
# Copy new code to /opt/myapp, then:
sudo systemctl restart breeze-myapp
```

### Reverse proxy (recommended)

Put Nginx or Caddy in front to handle TLS and proxy to port 3000:

```nginx
server {
    listen 80;
    server_name api.example.com;
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

Use `certbot` to add free TLS certificates.

---

## The Breeze Web App Structure

A typical Breeze web app looks like:

```
my-app/
├── src/
│   ├── main.bz          # entry point: reads PORT, calls http.listen
│   ├── routes.bz        # imported helpers (export func ...)
│   └── db.bz            # data layer
├── package.json         # dependencies (breeze-lang)
├── breeze.json          # project manifest
└── README.md
```

### Key patterns

**Reading the port** (works on every platform):

```breeze
port_env = env.get("PORT")
if port_env == none:
  port = 3000
else:
  port = number(port_env)
http.listen(port, handle)
```

**Routing** — match `method` and `path` from the request object:

```breeze
func handle(req):
  method = json.get(req, "method")
  path = json.get(req, "path")
  if method == "GET" and path == "/users":
    return json_response(200, users)
  return not_found("No such route")
```

**JSON responses** — return a list of `[key, value]` pairs:

```breeze
func json_response(status, body):
  return [
    ["status", status],
    ["headers", [["Content-Type", "application/json"]]],
    ["body", json.stringify(body)]
  ]
```

**Reading the request body** — `body` is text, parse it with `json.parse`:

```breeze
body = json.get(req, "body")
parsed = json.parse(body)
name = json.get(parsed, "name")
```

---

## Environment Variables

Breeze reads environment variables via the `env` module:

```breeze
db_url = env.get("DATABASE_URL")
secret = env.get("SECRET_KEY")
if secret == none:
  show "Warning: SECRET_KEY not set"
```

| Platform | Where to set them |
|----------|-------------------|
| Docker | `docker run -e KEY=value ...` or a `.env` file |
| Vercel | Dashboard → Project → Settings → Environment Variables |
| Render | Dashboard → Service → Environment |
| VM | `Environment=` line in the systemd unit, or export in a shell profile |

---

## Troubleshooting

### `breeze: command not found`

Install it globally: `npm install -g breeze-lang`. Or use `npx breeze-lang`.

### `Error: Cannot find module 'breeze-lang'`

Run `npm install breeze-lang` in your project directory.

### Port already in use

Set a different port: `PORT=3001 breeze run src/main.bz`.

### Vercel: handler not found

Your Breeze program must `export func handle(req): ...`. Do **not** call
`http.listen` in a Vercel deployment — Vercel provides the server.

### Render: health check failing

Render pings your service's root path (`/`). Make sure your app responds to
`GET /` with a 200 status. The example app does this.

### Docker: curl not found

The Dockerfile installs curl. If you build a custom image, ensure curl is
present — the `http.get` and `http.post` built-ins use it.

---

Breeze apps are just Node.js apps under the hood. Any Node deployment guide
applies. Happy shipping! 🌬️
