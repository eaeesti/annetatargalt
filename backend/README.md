# Backend

TL;DR:

```bash
cd backend
cp .env.example .env # copy env file
# fill in .env.example Strapi section, use `openssl rand -base64 16`

sudo -u postgres createdb annetatargalt
sudo -u postgres psql
create user annetatargalt with encrypted password 'TODO';
grant all privileges on database annetatargalt to annetatargalt;
ALTER DATABASE annetatargalt OWNER TO annetatargalt;
# fill .env.example Postgres section

yarn
yarn build
yarn develop
# create admin account on http://127.0.0.1:1337
yarn strapi import -f data.tar.gz
```

## Setup

1\. Read about [Strapi](https://strapi.io/)

2\. Create an `.env` file for environment values. You can use the `.env.example` file as a reference.

3\. Fill them in. Here are some pointers:

#### Keys

More info here: https://docs.strapi.io/dev-docs/configurations/server

- `APP_KEYS`: generate four keys using `openssl rand -base64 16` and separate them with commas
- `API_TOKEN_SALT`: generate using `openssl rand -base64 16`
- `ADMIN_JWT_SECRET`: generate using `openssl rand -base64 16`
- `TRANSFER_TOKEN_SALT`: generate using `openssl rand -base64 16`
- `JWT_SECRET`: generate using `openssl rand -base64 16`

#### Database

Strapi supports [multiple databases](https://docs.strapi.io/dev-docs/configurations/database), but this project has only been tested with Postgres, so using that is recommended.

Fill in your Postgres details in `.env` and create a new database called `annetatargalt` or whatever you have under `DATABASE_NAME`:

```sql
sudo -u postgres createdb annetatargalt
sudo -u postgres psql
create user annetatargalt with encrypted password 'TODO';
grant all privileges on database annetatargalt to annetatargalt;
ALTER DATABASE annetatargalt OWNER TO annetatargalt;
```

### Strapi

4\. Build and run Strapi:

```bash
yarn build
yarn develop
```

5\. Open `127.0.0.1:1337` and create your admin user.

6\. Close Strapi and seed the data if you have it:

```bash
yarn strapi import -f data.tar.gz
```

Read more about data importing and exporting: https://docs.strapi.io/dev-docs/data-management/import


****



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
