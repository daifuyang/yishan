# Build the editor first, then use packages/yishan-tiptap as the build context:
# docker build -f example/Dockerfile -t yishan-tiptap-example .
FROM node:22.22.1-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.9 --activate
COPY package.json README.md LICENSE /tiptap/
COPY dist /tiptap/dist
WORKDIR /tiptap/example

FROM base AS development-dependencies
COPY example/package.json example/pnpm-lock.yaml example/.npmrc ./
RUN pnpm --ignore-workspace install --frozen-lockfile

FROM base AS production-dependencies
COPY example/package.json example/pnpm-lock.yaml example/.npmrc ./
RUN pnpm --ignore-workspace install --frozen-lockfile --prod

FROM development-dependencies AS build
COPY example/app ./app
COPY example/public ./public
COPY example/react-router.config.ts example/tsconfig.json example/vite.config.ts ./
RUN pnpm --ignore-workspace typecheck && pnpm --ignore-workspace build

FROM base AS runtime
COPY example/package.json ./
COPY --from=production-dependencies /tiptap/example/node_modules ./node_modules
COPY --from=build /tiptap/example/build ./build
CMD ["pnpm", "--ignore-workspace", "start"]
