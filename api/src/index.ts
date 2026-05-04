import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { redis } from "./services/redis.js";
import { authRouter } from "./routes/auth.js";
import { instructorsRouter } from "./routes/instructors.js";
import { bookingRouter } from "./routes/booking.js";
import { paymentRouter } from "./routes/payment.js";
import { trackingRouter } from "./routes/tracking.js";
import { reviewsRouter } from "./routes/reviews.js";
import { instructorPanelRouter } from "./routes/instructorPanel.js";
import { clientExtrasRouter } from "./routes/clientExtras.js";
import { startCronJobs } from "./jobs/cron.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "skytrainer-api" });
});

app.use("/auth", authRouter);
app.use("/instructors", instructorsRouter);
app.use("/booking", bookingRouter);
app.use("/payment", paymentRouter);
app.use("/tracking", trackingRouter);
app.use("/reviews", reviewsRouter);
app.use("/instructor", instructorPanelRouter);
app.use("/client", clientExtrasRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

async function main() {
  startCronJobs();
  app.listen(config.port, () => {
    console.log(`Skytrainer API http://0.0.0.0:${config.port}`);
  });
}

const shutdown = async () => {
  await pool.end();
  redis.disconnect();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
