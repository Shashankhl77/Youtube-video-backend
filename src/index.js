require("dotenv").config(); // ✅ FIRST

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const downloadRoutes = require("./routes/downloadRoutes");

const app = express();
const server = http.createServer(app);

// ✅ ensure downloads folder exists
const downloadPath = path.join(__dirname, "downloads");
if (!fs.existsSync(downloadPath)) {
  fs.mkdirSync(downloadPath);
}

// ✅ Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ✅ Middlewares
app.use(cors());
app.use(express.json());

// ✅ Serve files
app.use("/downloads", express.static(downloadPath));

// ✅ Share io
app.set("io", io);

// ✅ Routes
app.use("/api", downloadRoutes);

// ✅ Socket events
io.on("connection", (socket) => {
  console.log("⚡ Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// ✅ Health check
app.get("/", (req, res) => {
  res.send("🚀 Video Downloader API is running...");
});

// ✅ Start server
const PORT = process.env.PORT || 7008;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});