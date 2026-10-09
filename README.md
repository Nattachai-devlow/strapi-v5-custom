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

```bash
docker compose up -d
```

- Admin panel: http://localhost:1337/admin
- PostgreSQL runs inside the compose network (data persisted in the `pgdata` volume)

Optionally start pgAdmin 4 (http://localhost:5050, login `admin@admin.com` / `admin`) together with the stack — the database server is pre-registered:

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
  nattachai-devlow/strapi-v5:latest
```

### Build the image yourself

```bash
docker build -t nattachai-devlow/strapi-v5:latest .
```

### Take the image and continue development

The image is published on Docker Hub as
[`nattachai-devlow/strapi-v5`](https://hub.docker.com/r/nattachai-devlow/strapi-v5).
You can pick it up and keep building on top of it in any of the following ways.

**1. Run the prebuilt image (no source code required)**

```bash
docker pull nattachai-devlow/strapi-v5:latest

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
  nattachai-devlow/strapi-v5:latest
```

**2. Extend the image in a new project (recommended)**

Create a `Dockerfile` in your own project and build on top of the published image,
then copy in your additional content-types, plugins or code:

```dockerfile
FROM nattachai-devlow/strapi-v5:latest
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
docker build -t nattachai-devlow/strapi-v5:latest .
docker push nattachai-devlow/strapi-v5:latest
```

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
