# Deploy Frontend to Vercel

## 1) Deploy backend first
This app needs Socket.IO + API, so deploy `server/` to Render/Railway/Fly first.

Example backend URL:
`https://lt-mobile-server.onrender.com`

## 2) Configure Vercel project
- Import repo
- Set **Root Directory**: `mobile-app`
- Vercel will use `vercel.json` in this folder

## 3) Set environment variable
In Vercel Project Settings -> Environment Variables:

- `EXPO_PUBLIC_SERVER_URL` = your backend URL

Optional for local LAN dev only:
- `EXPO_PUBLIC_DEV_LAN_URL` = `http://192.168.x.x:3001`

## 4) Deploy
Run deploy from Vercel UI (or `vercel --prod`).

Build uses:
- install: `npm install`
- build: `npm run build:web`
- output: `dist`
