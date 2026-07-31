require("dotenv").config();
const express = require("express");
const cors = require("cors");
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

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
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
