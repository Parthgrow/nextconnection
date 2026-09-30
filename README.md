This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Coding agents (MCP)

This repo ships a `.mcp.json` that registers [`next-devtools-mcp`](https://github.com/vercel/next-devtools-mcp). With `npm run dev` running, Claude Code (or any MCP-compatible agent) opened in this folder can read live build/runtime errors, dev logs, routes, page metadata and Server Actions from the Next.js dev server via its built-in `/_next/mcp` endpoint. Approve the `next-devtools` server when prompted and check it with `/mcp`.

### Contacts MCP server

`scripts/mcp-server.ts` is a local MCP server (also registered in `.mcp.json`) that lets Claude Code read and manage your contacts directly in Vercel KV — changes show up in the web app immediately.

1. Add to `.env` (alongside `KV_REST_API_URL` and `KV_REST_API_TOKEN`):
   ```
   NEXTCONNECTION_USER_ID=<your user id>
   ```
   The id is printed by `node --env-file=.env scripts/create-admin.mjs`, or stored in KV at `nextconnection:user:by-email:<your email>`.
2. Run `npm install`, then restart `claude` in this folder and approve the `nextconnection` server (`/mcp` shows its status).

Tools: `list_contacts`, `get_contact`, `add_contact`, `update_contact`, `delete_contact` (requires `confirm: true`), `get_upcoming_actions`, `get_stats`, `set_dream100_deadline`. Try: *"Add Stripe, SWE, applied today, follow up Friday"* or *"What follow-ups are overdue?"*

### Remote MCP server

The deployed app also serves the same tools over HTTP at `/api/mcp`, so Claude Code on any machine can use them without KV credentials:

1. Sign in and open **Connect Claude** (`/settings`), then click **Generate MCP token**. The token is shown once; only its SHA-256 hash is stored, and you can revoke it from the same page.
2. Run the command shown there:
   ```bash
   claude mcp add --transport http nextconnection https://<your-app>/api/mcp \
     --header "Authorization: Bearer <token>"
   ```

Each token acts as the user who created it (the `whoami` tool confirms which account).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
