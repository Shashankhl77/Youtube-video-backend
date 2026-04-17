const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const downloadDir = path.join(__dirname, "../downloads");
fs.mkdirSync(downloadDir, { recursive: true });

// 🔥 simple delay (rate-limit)
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

exports.downloadVideo = async (url, type = "video", io = null, socketId = null) => {
  // ⛔ add delay to reduce 429
  await delay(3000);

  return new Promise((resolve, reject) => {
    try {
      const outputTemplate = path.join(downloadDir, "%(title)s.%(ext)s");

      let args = [
        "-m",
        "yt_dlp",

        // 🔥 pretend like mobile app (reduces bot detection)
        "--extractor-args",
        "youtube:player_client=android",

        // 🔥 reduce requests
        "--sleep-interval",
        "2",
        "--max-sleep-interval",
        "5",

        // 🔥 retries
        "--retries",
        "3",

        "--newline"
      ];

      // 🔥 optional cookies (if you add cookies.txt)
      const cookiePath = path.join(__dirname, "../cookies.txt");
      if (fs.existsSync(cookiePath)) {
        args.push("--cookies", cookiePath);
      }

      if (type === "audio") {
        args.push(
          "-f", "bestaudio",
          "-x",
          "--audio-format", "mp3",
          "--audio-quality", "0"
        );
      } else {
        // 🔥 Render-safe video (no ffmpeg required)
        args.push(
          "-f",
          "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
        );
      }

      args.push("-o", outputTemplate, url);

      const process = spawn("python3", args);

      let fileName = null;
      let errorLog = "";

      process.stderr.on("data", (data) => {
        const output = data.toString();
        errorLog += output;

        console.log("YT-DLP:", output);

        // 📊 progress
        const match = output.match(/(\d{1,3}\.?(\d+)?)%/);
        if (match && io && socketId) {
          io.to(socketId).emit("progress", match[1]);
        }

        // 📁 filename
        if (output.includes("Destination:")) {
          const filePath = output.split("Destination:")[1].trim();
          fileName = path.basename(filePath);
        }
      });

      process.on("close", (code) => {
        if (code === 0) {
          console.log("✅ Download completed");

          if (io && socketId) {
            io.to(socketId).emit("completed", fileName);
          }

          resolve(
            fileName || (type === "audio" ? "audio.mp3" : "video.mp4")
          );
        } else {
          console.log("❌ yt-dlp failed:", errorLog);
          reject(new Error(errorLog || "yt-dlp failed"));
        }
      });

      process.on("error", (err) => {
        console.log("❌ Spawn error:", err);
        reject(err);
      });

    } catch (err) {
      reject(err);
    }
  });
};
