# Frontend

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


****

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
