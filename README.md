<div align="center">

# ⚙️ Mind Align — Backend

**REST API behind the Mind Align planner: secure authentication, planner data and push notifications.**

![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express_4-000000?logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_6-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_(Neon)-4169E1?logo=postgresql&logoColor=white)

[🌐 Live app](https://mind-align-app.vercel.app) · [🖥️ Frontend repository](https://github.com/larissabenvenuti/Mind-Align-FrontEnd)

</div>

## ⚡ At a glance

- **What it is:** the server side of Mind Align, a personal planner.
- **What it does:** authenticates users (including Google), stores planner data in PostgreSQL and sends scheduled push notifications.
- **My role:** API design, data modeling and implementation.

## 🧭 API overview

Each area of the planner has its own router in `src/routes/`:

| Router | Responsibility |
|---|---|
| `auth` | Sign-up, login and Google sign-in |
| `user` | Account settings: password, name and profile photo |
| `tasks` | Tasks, completion progress and tags |
| `habits` | Habits, marked days, streaks and progress |
| `notes` | Notes |
| `calendar` | Events, including bulk deletion |
| `activity` | Recent activity logs for the dashboard |
| `notification` | Push subscriptions and notification preferences |

<!-- ✏️ Opcional: trocar por tabela método + rota (ex.: POST /auth/login) -->

## 🏗️ Technical highlights

- **Secure authentication:** passwords hashed with `bcryptjs`, **JWT** sessions checked by an auth middleware, and Google ID-token verification.
- **Prisma ORM** with versioned migrations on **PostgreSQL (Neon)**.
- **Push notifications:** Web Push (`web-push`) with a scheduler (`node-cron`) that respects each user's preferences.
- **Express + TypeScript**, organized into routers, middleware, services and lib.
- **Deploy-ready for Vercel** (`vercel.json`); `npm start` applies pending migrations before booting.

## 🛠️ Run locally

```bash
git clone https://github.com/larissabenvenuti/Mind-Align-BackEnd.git
cd Mind-Align-BackEnd
npm install
```

Create a `.env` file in the project root:

```env
DATABASE_URL=
DATABASE_URL_UNPOOLED=
NEON_BRANCH=
GOOGLE_CLIENT_ID=
JWT_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
CRON_SECRET=
FRONTEND_URL=http://localhost:3000
```

Then create the database schema and start the API:

```bash
npm run prisma:migrate
npm run dev
```

The API runs at http://localhost:3333. Other scripts: `npm run build`, `npm start`, `npm run prisma:studio`, `npm run lint`.

### 🔑 Environment variables

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string, used by the app |
| `DATABASE_URL_UNPOOLED` | Neon **direct** connection string, used for migrations |
| `NEON_BRANCH` | Name of the Neon branch in use (e.g. `main`) |
| `GOOGLE_CLIENT_ID` | Same OAuth client ID used by the frontend |
| `JWT_SECRET` | Long random secret that signs the session tokens |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Key pair that identifies the server to push services |
| `VAPID_SUBJECT` | Contact for the push service, as `mailto:you@example.com` or a URL |
| `CRON_SECRET` | Secret that protects the scheduled notification job |
| `FRONTEND_URL` | Frontend origin allowed by CORS (`http://localhost:3000` locally) |

<details>
<summary><b>Database (Neon)</b></summary>

1. Create a free project at [neon.tech](https://neon.tech/).
2. In the dashboard, open **Connect** and copy two connection strings: the **pooled** one into `DATABASE_URL` and the **direct** one (pooling off) into `DATABASE_URL_UNPOOLED`.
3. Use the name of the branch you selected (usually `main`) in `NEON_BRANCH`.

</details>

<details>
<summary><b>JWT_SECRET and CRON_SECRET</b></summary>

Generate a different random value for each:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

</details>

<details>
<summary><b>VAPID keys</b> (push notifications)</summary>

```bash
npx web-push generate-vapid-keys
```

Copy the **Public Key** into `VAPID_PUBLIC_KEY` and the **Private Key** into `VAPID_PRIVATE_KEY`. Set `VAPID_SUBJECT` to something like `mailto:you@example.com`.

The same public key goes in the [frontend](https://github.com/larissabenvenuti/Mind-Align-FrontEnd) as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Never commit the private key.

</details>

<details>
<summary><b>GOOGLE_CLIENT_ID</b></summary>

Create an **OAuth client ID** (Web application) in the [Google Cloud Console](https://console.cloud.google.com/) under *APIs & Services → Credentials*, and use the same ID in the frontend and here.

</details>

## 🚧 Status

In active development. Automated tests are planned.

## 👩‍💻 Author & license

Built by **Larissa Benvenuti**. All rights reserved: no reuse license is granted.
