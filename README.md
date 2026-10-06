# InkWave – custom t-shirt store

A demo online shop for custom printed t-shirts, built with React, Vite and Three.js. It has a product catalog, a design studio (2D editor with a 3D preview), a cart, a bulk-quote form and an AI Designer that creates designs from a chat.

This is a demo: checkout and forms run in the browser only, and nothing is charged or sent.

## Requirements

- [Node.js](https://nodejs.org/) 20.19 or newer (22 LTS or newer recommended)
- An [Anthropic API key](https://platform.claude.com) if you want to use the AI Designer (optional)

## Getting started

```bash
git clone https://github.com/mrcedev/Tshirt-ida.git
cd Tshirt-ida
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Turning on the AI Designer (optional)

The rest of the site works without this step.

1. Create a file called `.env.local` in the project folder.
2. Add your key to it:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. Restart `npm run dev`.

`.env.local` is ignored by git and the key is only used on the server, so it never reaches the browser. Each visitor can make up to 20 AI designs per hour.

## Scripts

| Command           | What it does                                         |
| ----------------- | ---------------------------------------------------- |
| `npm run dev`     | Starts the development server with live reload      |
| `npm run build`   | Builds the production site into `dist/`             |
| `npm run preview` | Serves the built `dist/` folder to test it locally  |

## Deploying

`npm run build` makes a static site in `dist/` that you can upload to any static host (Netlify, Vercel, GitHub Pages and others).

The AI Designer's `/api/ai-design` route runs only under `npm run dev` and `npm run preview`. To use it on real hosting, wrap `createDesign()` from `server/aiDesign.js` in a serverless function on your host and set `ANTHROPIC_API_KEY` there.

## Project structure

```
public/          static files, including the 3D shirt model (models/shirt.glb)
server/          AI Designer API (Vite plugin + Claude API call)
src/
  components/    shared UI (navbar, 3D preview, AI chat panel, ...)
  context/       cart state (saved in localStorage)
  data/          product catalog
  lib/           pricing, garment data, design rendering
  pages/         Home, Shop, Product, Designer, Cart, Bulk Quote
```
