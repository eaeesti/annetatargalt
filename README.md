# Anneta Targalt

This is the code for the Anneta Targalt donation platform that runs at https://annetatargalt.ee/.

- **Backend**: [Strapi v5](https://strapi.io/) (TypeScript) in `/backend`
- **Frontend**: [Next.js 15](https://nextjs.org/) and [TailwindCSS](https://tailwindcss.com/) in `/frontend`
- **Admin panel**: Next.js 15 with shadcn/ui in `/admin` (port 3001)

## Setup

### Getting started

1\. Clone the repository:

```
git clone https://github.com/eaeesti/annetatargalt.git
cd annetatargalt
```

2\. Run the setup command:

```
yarn setup
```

### Backend

1\. Navigate to the backend directory:

```
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

Strapi uses Postgres. This project requires **two databases**:

- `DATABASE_NAME`: the main Strapi database (content, users, etc.)
- `DRIZZLE_DATABASE_NAME`: a separate database for donations (managed by Drizzle ORM)

Create both (replace the names with whatever you set in `.env`):

```
sudo -u postgres createdb <DATABASE_NAME>
sudo -u postgres createdb <DRIZZLE_DATABASE_NAME>
```

Fill in your Postgres connection details in `.env`.

4\. Build and run Strapi:

```
yarn build
yarn develop
```

5\. Open `127.0.0.1:1337` and create your admin user.

On first startup, the bootstrap automatically:

- Creates the **Public API Token** for the frontend and writes it to `frontend/.env`
- Grants the **Authenticated** role access to all donation admin endpoints

6\. Close Strapi and seed the data if you have it:

```
yarn strapi import -f data.tar.gz
```

Read more about data importing and exporting: https://docs.strapi.io/dev-docs/data-management/import

### Frontend

The `frontend/.env` file is created automatically by the Strapi bootstrap on first startup with the correct API token. If you need to create it manually, copy `frontend/.env.example` and fill in the values.

### Admin panel

The admin panel at `/admin` is a separate Next.js app running on port 3001. It is included in `yarn develop` and requires no additional setup.

Log in using your Strapi admin credentials. On first login, a users-permissions account is automatically provisioned for you.

### Running everything

From the repository root:

```
yarn develop
```

This starts the frontend (port 3000), backend (port 1337), and admin panel (port 3001) concurrently.
