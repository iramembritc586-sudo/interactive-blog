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

## Page Agent Integration

This project now embeds [Page Agent](https://github.com/alibaba/page-agent) globally through the root layout, using the official demo IIFE bundle CDN so it can run without changing the app architecture.

### How it works

- `app/layout.tsx` mounts a small client-side loader component.
- `src/components/PageAgentEmbed.tsx` injects the official Page Agent script after hydration.
- By default it loads the official demo bundle:

```txt
https://cdn.jsdelivr.net/npm/page-agent@1.6.0/dist/iife/page-agent.demo.js
```

### Environment variables

You can control the integration with these public environment variables:

```bash
NEXT_PUBLIC_ENABLE_PAGE_AGENT=true
NEXT_PUBLIC_PAGE_AGENT_SCRIPT_URL=https://cdn.jsdelivr.net/npm/page-agent@1.6.0/dist/iife/page-agent.demo.js
```

- Set `NEXT_PUBLIC_ENABLE_PAGE_AGENT=false` to disable Page Agent completely.
- Set `NEXT_PUBLIC_PAGE_AGENT_SCRIPT_URL` if you want to switch to another official Page Agent build later.

> Note: the default script is the Page Agent demo bundle from the upstream project, which uses their demo LLM endpoint intended for technical evaluation.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [Page Agent GitHub Repository](https://github.com/alibaba/page-agent) - official upstream project.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
