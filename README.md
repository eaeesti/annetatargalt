# Anneta Targalt

This is the code for the Anneta Targalt donation platform that runs at https://annetatargalt.ee/.

The backend runs on [Strapi 4](https://strapi.io/) in the `/backend` directory.

The frontend runs on [Next.js 13](https://nextjs.org/), [HeadlessUI](https://headlessui.com/) and [TailwindCSS](https://tailwindcss.com/) in the `/frontend` directory.

The old platform can be found at https://github.com/eaeesti/annetatargalt-old.

## Setup

### Getting started

1\. Clone the repository:

```bash
git clone https://github.com/eaeesti/annetatargalt.git
cd annetatargalt
```

2\. Run the setup command:

```bash
yarn setup
```

### Backend

1\. Navgate to the backend directory:

```bash
cd backend
```

2\. Create an `.env` file for environment values. You can use the `.env.example` file as a reference.

3\. Fill them in. Here are some pointers:

#### Keys

More info here: https://docs.strapi.io/dev-docs/configurations/server

- `APP_KEYS`: generate four keys using `openssl rand -base64 16` and separate them with commas
- `API_TOKEN_SALT`: generate using `openssl rand -base64 16`
- `ADMIN_JWT_SECRET`: generate using `openssl rand -base64 16`
- `TRANSFER_TOKEN_SALT`: generate using `openssl rand -base64 16`
- `JWT_SECRET`: generate using `openssl rand -base64 16`

#### Cloudinary

Create an account at https://cloudinary.com/ and get the three keys from there.

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

### Frontend

1\. Navgate to the frontend directory. From `/backend`:

```bash
cd ../frontend
```

2\. Create the `.env` file from `.env.example`:

```ini
NEXT_PUBLIC_STRAPI_API_TOKEN=your-api-token
NEXT_PUBLIC_STRAPI_API_URL=http://127.0.0.1:1337
```

3\. To get the API token, run Strapi and generate it:

Settings (left sidebar) → API Tokens (second sidebar) → Create new API Token (top right)

- Name: Public API Token
- Token duration: Unlimited
- Type: Custom

Under Permissions, give the token access `find` and `findOne` access for the following:

- `Blog-author`
- `Blog-post`
- `Cause`
- `Global` (does not have `findOne`)
- `Organization`
- `Page`
- `Special-page`

Click Save and place the token you are given to `.env` under `NEXT_PUBLIC_STRAPI_API_TOKEN`.

4\. Close Strapi and go the repository root directory:

```bash
cd ..
```

5\. Run both the frontend and backend at the same time:

```bash
yarn develop
```
