import express from "express";
import cors from "cors";
import "dotenv/config";

import authRouter from "./routes/authRouter";
import activityRouter from "./routes/activityRouter";
import tasksRouter from "./routes/tasksRouter";

const app = express();

const allowedOrigins = new Set([
  "https://mind-align.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...(process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  }),
);

app.use(express.json());

app.use(authRouter);
app.use(activityRouter);
app.use(tasksRouter);

const PORT = Number(process.env.PORT) || 3333;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});