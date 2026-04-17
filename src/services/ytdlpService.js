const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const downloadDir = path.join(__dirname, "../downloads");

// ensure download folder exists
fs.mkdirSync(downloadDir, { recursive: true });

// delay helper (reduce 429)
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

exports.downloadVideo = async (url, type = "video", io = null, socketId = null) => {
  await delay(3000); // 🔥 reduce bot detection

  return new Promise((resolve, reject) => {
    try {
      const outputTemplate = path.join(downloadDir, "%(title)s.%(ext)s");

      // 🔥 create cookies file from ENV (Render fix)
      const cookiePath = path.join(__dirname, "../cookies.txt");
      if (process.env.COOKIES) {
        fs.writeFileSync(cookiePath, process.env.COOKIES);
      }

      let args = [
        "-m",
        "yt_dlp",

        // 🔥 Anti-bot tricks
        "--extractor-args",
        "youtube:player_client=android",

        "--user-agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",

        "--sleep-interval", "2",
        "--max-sleep-interval", "5",
        "--retries", "5",

        "--no-check-certificate",
        "--geo-bypass",
        "--force-ipv4",

        "--newline"
      ];

      // 🔥 ALWAYS pass cookies
      args.push("--cookies", cookiePath);

      if (type === "audio") {
        args.push(
          "-f", "bestaudio",
          "-x",
          "--audio-format", "mp3",
          "--audio-quality", "0"
        );
      } else {
        // Render-safe video format
        args.push(
          "-f",
          "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
        );
      }

      args.push("-o", outputTemplate, url);

      const process = spawn("python3", args);

      let fileName = null;
      let errorLog = "";

      // stdout logs
      process.stdout.on("data", (data) => {
        console.log("STDOUT:", data.toString());
      });

      // stderr logs (yt-dlp outputs progress here)
      process.stderr.on("data", (data) => {
        const output = data.toString();
        errorLog += output;

        console.log("YT-DLP:", output);

        // 🎯 progress tracking
        const match = output.match(/(\d{1,3}\.?(\d+)?)%/);
        if (match && io && socketId) {
          io.to(socketId).emit("progress", match[1]);
        }

        // 🎯 get filename
        if (output.includes("Destination:")) {
          const filePath = output.split("Destination:")[1].trim();
          fileName = path.basename(filePath);
        }
      });

      // process complete
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

      // spawn error
      process.on("error", (err) => {
        console.log("❌ Spawn error:", err);
        reject(err);
      });

    } catch (err) {
      reject(err);
    }
  });
};
