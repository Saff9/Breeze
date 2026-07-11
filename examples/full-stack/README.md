# Full-Stack Todo App

A complete todo application where **both the backend and frontend are written
in Breeze**.

## Structure

```
backend/    Breeze API server (http.listen, JSON, CRUD)
  main.bz       — the server
  routes.bz     — helpers
  breeze.json   — package manifest

frontend/   Breeze in the browser
  index.html    — loads breeze.js, runs Breeze inline
```

## Run it

**1. Start the backend:**

```bash
cd backend
breeze run main.bz
```

The API runs on `http://localhost:3000`.

**2. Open the frontend:**

Open `frontend/index.html` in your browser. Or serve it:

```bash
cd frontend
python3 -m http.server 8080
# open http://localhost:8080
```

## What it demonstrates

- **Backend**: `http.listen`, `json.parse`/`stringify`/`get`, routing, CRUD
- **Frontend**: `<script type="text/breeze">`, `dom.set`/`dom.on`/`dom.value`,
  `js.call` for fetch/XHR interop, `json.parse`
- **Full-stack**: the Breeze frontend calls the Breeze backend over HTTP

## The import system

The backend uses a local import:

```breeze
import { json_response, not_found, starts_with } from "./routes.bz"
```

For bigger projects, you'd install libraries from GitHub:

```bash
breeze install Saff9/Breeze          # gets the lib/ packages
```

Then import them:

```breeze
import { map, filter, sort } from "list"
import { title_case, pad_left } from "string"
```

See [`lib/`](../../lib) for the available libraries.
