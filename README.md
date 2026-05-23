This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Prerequisites

- Node.js 20+ and npm
- [`gitleaks`](https://github.com/gitleaks/gitleaks) (`brew install gitleaks`) for the pre-commit hook
- [`op`](https://developer.1password.com/docs/cli/get-started/) (1Password CLI), signed in to a Brik account, for the install step

### Install dependencies

`@brikdesigns/*` packages come from GitHub Packages and need a read-scoped PAT. We resolve it from 1Password at install time via [`.env.op`](.env.op) so the token never has to live in shell env:

```bash
op run --env-file=.env.op -- npm install
```

`op run` injects `PACKAGES_READ_TOKEN` into the npm child process; [`.npmrc`](.npmrc) substitutes it into the GitHub Packages auth header for that one run. The token is gone again the moment npm exits. CI builds (GitHub Actions, Netlify) supply `PACKAGES_READ_TOKEN` directly as repo / site env — `op run` is a developer-machine concern only.

If you previously had `PACKAGES_READ_TOKEN` exported from your shell (e.g. via `~/.zshenv` sourcing `~/.secrets/brik-packages.env`), you can leave that in place during the cross-repo cutover (see [`brik-llm#570`](https://github.com/brikdesigns/brik-llm/issues/570)) — `op run` will take precedence, and stripping the shell-env copy lands in a follow-up.

### Install the pre-commit hook

Once per clone, on each machine:

```bash
./scripts/install-hooks.sh
```

### Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
