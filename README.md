# PDF Generator

A web app that takes a **name** and **two photos** and generates a one-page A4 PDF. Built with Next.js, deployable on Vercel.

## How it works

1. Enter a name (appears as the PDF heading).
2. Upload two photos (JPEG, PNG, or WebP).
3. Click **Generate PDF** — the file downloads automatically.

Photos are laid out side-by-side or stacked, whichever makes them larger. The PDF is generated server-side using [pdf-lib](https://pdf-lib.js.org/) and [sharp](https://sharp.pixelplumbing.com/).

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

import it at [vercel.com/new](https://vercel.com/new). No environment variables are needed — it works out of the box.

## Good to know

- **Privacy:** photos are processed in memory on the server. Nothing is stored.
- **Limits:** each photo can be up to 10 MB. The name must be under 60 characters.
- **Fonts:** the bundled DejaVuSans-Bold covers Latin (including West African letters), Greek, and Cyrillic.
