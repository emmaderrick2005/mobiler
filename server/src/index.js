require("dotenv").config();
const dns = require("dns");
// Some hosts (Render included) advertise IPv6 DNS records for external
// services but can't actually route IPv6 traffic, so outbound connections
// fail with ENETUNREACH unless IPv4 is tried first. Kept as a general
// safeguard for any outbound call the app makes, not just one provider.
dns.setDefaultResultOrder("ipv4first");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");

const sockets = require("./sockets");
const { sweepExpiredOffers, sweepUnmatched } = require("./services/matching");
const authRoutes = require("./routes/auth");
const agentRoutes = require("./routes/agents");
const requestRoutes = require("./routes/requests");
const verificationRoutes = require("./routes/verification");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" },
});
sockets.init(io);

app.set("trust proxy", 1);
// Verification document images are served cross-origin from the API, so the
// default cross-origin-resource-policy would block the client from loading them.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/verification", verificationRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Cash delivery server listening on port ${PORT}`);
});

// Reassign offers whose accept window has expired.
setInterval(() => {
  sweepExpiredOffers().catch((err) => console.error("sweep error", err));
}, 5000);

// Retry requests that had no eligible agent last time.
setInterval(() => {
  sweepUnmatched().catch((err) => console.error("sweep error", err));
}, 15000);
