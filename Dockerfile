FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY wikiduel-contracts/package.json ./wikiduel-contracts/
COPY wikiduel-client/package.json ./wikiduel-client/
COPY wikiduel-server/package.json ./wikiduel-server/
RUN npm ci
COPY wikiduel-contracts ./wikiduel-contracts
COPY wikiduel-client ./wikiduel-client
COPY wikiduel-server ./wikiduel-server
RUN npm run build
# Development resolves contracts from source. The image runs compiled ESM.
RUN node --input-type=module -e "import fs from 'node:fs'; const p='wikiduel-contracts/package.json'; const j=JSON.parse(fs.readFileSync(p)); j.exports['.']={types:'./dist/index.d.ts',default:'./dist/index.js'}; fs.writeFileSync(p,JSON.stringify(j));"
RUN find wikiduel-server/dist wikiduel-contracts/dist -type f \( -name '*.test.*' -o -name '*.tsbuildinfo' \) -delete

FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY wikiduel-contracts/package.json ./wikiduel-contracts/
COPY wikiduel-client/package.json ./wikiduel-client/
COPY wikiduel-server/package.json ./wikiduel-server/
RUN npm ci --omit=dev --workspace=wikiduel-server --workspace=@wikiduel/contracts --include-workspace-root=false

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/wikiduel-contracts/package.json ./wikiduel-contracts/
COPY --from=build /app/wikiduel-contracts/dist ./wikiduel-contracts/dist
COPY --from=build /app/wikiduel-server/package.json ./wikiduel-server/
COPY --from=build /app/wikiduel-server/dist ./wikiduel-server/dist
COPY --from=build /app/wikiduel-server/prompts/production.json ./wikiduel-server/prompts/production.json
COPY --from=build /app/wikiduel-client/dist ./wikiduel-client/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=300s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "wikiduel-server/dist/server.js"]
