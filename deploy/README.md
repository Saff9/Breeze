# Sample Vercel project structure
#
# my-breeze-app/
# ├── api/
# │   └── index.ts        ← copy vercel-api.ts here, rename to index.ts
# ├── src/
# │   └── main.bz         ← your Breeze app (must `export func handle(req)`)
# ├── package.json        ← with "breeze-lang" + "@vercel/node" deps
# └── vercel.json         ← copy from templates
#
# For Vercel, your Breeze app must EXPORT a handler instead of calling
# http.listen (Vercel manages the server). Example src/main.bz:
#
#   export func handle(req):
#     method = json.get(req, "method")
#     path = json.get(req, "path")
#     if method == "GET" and path == "/":
#       return ["status", 200, "headers", [["Content-Type","application/json"]], "body", "{\"ok\":true}"]
#     return ["status", 404, "headers", [], "body", "Not found"]
#
# Deploy:
#   npm i -g vercel
#   vercel
