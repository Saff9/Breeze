# Dockerfile for any Breeze application.
#
# Usage:
#   docker build -t my-breeze-app .
#   docker run -p 3000:3000 my-breeze-app
#
# This image bundles the Node.js Breeze runtime, so any .bz program
# (including http.listen servers) runs out of the box.

FROM node:20-slim

# curl is required by the http.get / http.post built-ins.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install the Breeze runtime globally.
RUN npm install -g breeze-lang

WORKDIR /app

# Copy the project files. Adjust if your entry point differs.
COPY package.json* ./
COPY breeze.json* ./
COPY src/ ./src/

# Install project dependencies (if any) — non-blocking if no package.json.
RUN if [ -f package.json ]; then npm install --omit=dev || true; fi

# Breeze apps read PORT from the environment.
ENV PORT=3000
EXPOSE 3000

# Run the app. Override the entry point with `docker run ... breeze run <file>`
ENTRYPOINT ["breeze", "run"]
CMD ["src/main.bz"]
