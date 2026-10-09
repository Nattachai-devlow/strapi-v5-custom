# 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

### `develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-develop)

```
npm run develop
# or
yarn develop
```

### `start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-start)

```
npm run start
# or
yarn start
```

### `build`

Build your admin panel. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-build)

```
npm run build
# or
yarn build
```

## ⚙️ Deployment

Strapi gives you many possible deployment options for your project including [Strapi Cloud](https://cloud.strapi.io). Browse the [deployment section of the documentation](https://docs.strapi.io/dev-docs/deployment) to find the best solution for your use case.

```
yarn strapi deploy
```

## 🐳 Run with Docker

### Quick start (Strapi + PostgreSQL in one command)

The stack has **no default secrets**: it refuses to start until real values are
provided. Copy the example file and fill in strong, unique values first.

```bash
cp .env.example .env
# then edit .env and replace every "tobemodified" value, e.g. with `openssl rand -base64 32`
docker compose up -d
```

- Admin panel: http://localhost:1337/admin
- PostgreSQL runs inside the compose network (data persisted in the `pgdata` volume)

Optionally start pgAdmin 4 (http://localhost:5050, login with `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` from `.env`, which defaults to your database password) together with the stack — the database server is pre-registered:

```bash
docker compose --profile tools up -d
```

PostgreSQL is also exposed on host port **5433** for desktop tools (pgAdmin, DBeaver, …).

The database schema is **synced automatically on every container start**: tables and fields defined by the content-types inside the image are created/added in PostgreSQL without any manual migration. Rebuild the image after changing a `schema.json` and restart the container — the new field appears by itself.

Override the default secrets (APP_KEYS, JWT_SECRET, …) and database credentials by creating a `.env` file next to `docker-compose.yml` (see `.env.example`).

### Use the published image with your own PostgreSQL

```bash
docker run -d --name strapi -p 1337:1337 \
  -e DATABASE_CLIENT=postgres \
  -e DATABASE_HOST=my-postgres-host \
  -e DATABASE_PORT=5432 \
  -e DATABASE_NAME=strapi \
  -e DATABASE_USERNAME=strapi \
  -e DATABASE_PASSWORD=secret \
  -e APP_KEYS="key1,key2" \
  -e ADMIN_JWT_SECRET=change-me \
  -e JWT_SECRET=change-me \
  -e API_TOKEN_SALT=change-me \
  -e TRANSFER_TOKEN_SALT=change-me \
  -e ENCRYPTION_KEY=change-me \
  -v strapi-uploads:/opt/app/public/uploads \
  nattachaiwsm/strapi-v5:latest
```

### Build the image yourself

```bash
docker build -t nattachaiwsm/strapi-v5:latest .
```

### Take the image and continue development

The image is published on Docker Hub as
[`nattachaiwsm/strapi-v5`](https://hub.docker.com/r/nattachaiwsm/strapi-v5).
You can pick it up and keep building on top of it in any of the following ways.

**1. Run the prebuilt image (no source code required)**

```bash
docker pull nattachaiwsm/strapi-v5:latest

docker run -d --name strapi -p 1337:1337 \
  -e DATABASE_CLIENT=postgres \
  -e DATABASE_HOST=my-postgres-host \
  -e DATABASE_PORT=5432 \
  -e DATABASE_NAME=strapi \
  -e DATABASE_USERNAME=strapi \
  -e DATABASE_PASSWORD=secret \
  -e APP_KEYS="key1,key2" \
  -e ADMIN_JWT_SECRET=change-me \
  -e JWT_SECRET=change-me \
  -e API_TOKEN_SALT=change-me \
  -e TRANSFER_TOKEN_SALT=change-me \
  -e ENCRYPTION_KEY=change-me \
  -v strapi-uploads:/opt/app/public/uploads \
  nattachaiwsm/strapi-v5:latest
```

**2. Extend the image in a new project (recommended)**

Create a `Dockerfile` in your own project and build on top of the published image,
then copy in your additional content-types, plugins or code:

```dockerfile
FROM nattachaiwsm/strapi-v5:latest
COPY --chown=node:node ./src ./src
COPY --chown=node:node ./config ./config
RUN npm run build
```

```bash
docker build -t my-strapi .
# run it with a PostgreSQL database, e.g. via the docker run command above
```

**3. Clone this repository and develop locally**

```bash
git clone https://github.com/Nattachai-devlow/strapi-v5-custom.git
cd strapi-v5-custom
npm install
npm run develop        # -> http://localhost:1337/admin
```

After you change a content-type `schema.json`, the database schema is **synced
automatically** on the next `npm run develop` / container start and the admin
types are regenerated — no manual migration is needed. When your changes are
ready, rebuild and re-publish the image:

```bash
docker build -t nattachaiwsm/strapi-v5:latest .
docker push nattachaiwsm/strapi-v5:latest
```

## 🛡️ Security model (IAAA)

The image implements the **IAAA** model — *Identification, Authentication,
Authorization, Accountability* — to close the most common container
vulnerability classes without giving up usability or extensibility. Every
control below is on by default when you use `docker compose`, and each one
maps to a concrete attack it stops.

| Principle | Control | Attack it stops | Where |
| --- | --- | --- | --- |
| **Identification** | Runs only as the non-root `node` service account (fixed UID/GID `1000`, `USER node`); no root shell, no ad-hoc accounts. | Container breakout running as `root` (UID 0), identity drift between hosts | `Dockerfile` |
| | OCI provenance labels (`title`, `version`, `revision`, `base.name`) plus `VERSION` / `VCS_REF` build args bake *what was built, when, and from what* into the image. | Impostor / untracked images | `Dockerfile`, `docker-compose.yml` |
| **Authentication** | No secrets baked into the image. Compose **fails fast** unless `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `ENCRYPTION_KEY` and `POSTGRES_*` are supplied. | Default-credential takeover, secrets leaked into published layers | `docker-compose.yml`, `.env.example` |
| | Base image pinned by **tag + digest**; dependencies installed from the committed `package-lock.json` via `npm ci`. | Swapped/moved base tags, tampered dependencies | `Dockerfile` |
| **Authorization** | Least privilege: non-root user, `cap_drop: [ALL]`, `security_opt: no-new-privileges`, read-only root filesystem with `tmpfs` only for the writable scratch (`/opt/app/.tmp`, `/tmp`); production-only `node_modules`; DB and pgAdmin bound to loopback. | Kernel-capability abuse, privilege escalation, payload write, lateral DB exposure | `Dockerfile`, `docker-compose.yml` |
| | `.dockerignore` keeps `.env`, git metadata, tests, docs and local tool state out of the build context. | Secret / SSH-key leakage into image layers | `.dockerignore` |
| **Accountability** | `tini` as PID 1 — reaps orphans and forwards signals for graceful shutdown; built-in `HEALTHCHECK`; `json-file` log rotation (10 MB × 3); named volumes so data outlives containers. | Zombie accumulation, ungraceful stops, unbounded logs, silent death | `Dockerfile`, `docker-compose.yml` |
| | `HOME` and `XDG_*` point at `/tmp` so the process never writes into the read-only FS or tries to create `/home`. | Runtime "read-only filesystem" crashes | `Dockerfile` |

### Operational notes

- **Startup fails if secrets are missing.** Run `cp .env.example .env`, replace
  every `tobemodified` value (e.g. `openssl rand -base64 32`), then
  `docker compose up -d`. No container is ever exposed with a known default
  password.
- **Read-only root filesystem.** Strapi can only write to the `uploads` volume
  and to the `tmpfs` mounts `/opt/app/.tmp` and `/tmp`. If you add a feature
  that writes elsewhere, add another volume or `tmpfs` mount in
  `docker-compose.yml` — don't disable `read_only`.
- **Identity is UID 1000.** Data volumes are created with UID/GID 1000
  ownership, matching the `node` account. Keep the container user at 1000 (the
  default) so existing volumes keep working; if you change the UID you must
  re-chown your volumes, e.g.
  `docker run --rm -v uploads:/data alpine chown -R 1000:1000 /data`.
- **Extending the image** (see above) — copy your code with
  `--chown=node:node` so the non-root runtime can read it.
- **Keep the base up to date.** When you bump the Node base image, update both
  the tag and its digest in `Dockerfile`:
  ```bash
  docker manifest inspect node:22-alpine --verbose   # grab the new sha256 digest
  ```
- **Scan the result** before publishing:
  ```bash
  docker scout cves nattachaiwsm/strapi-v5:latest
  # or: trivy image --severity HIGH,CRITICAL nattachaiwsm/strapi-v5:latest
  ```
- **Local development** is intentionally not containerized: use
  `npm run develop` with the `DATABASE_*` values from `.env`. The Docker image
  is the production-hardened runtime.

## 📚 Learn more

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>
