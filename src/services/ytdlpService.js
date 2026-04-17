const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const downloadDir = path.join(__dirname, "../downloads");

// safe folder creation
fs.mkdirSync(downloadDir, { recursive: true });

// small delay to reduce 429
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

exports.downloadVideo = async (url, type = "video", io = null, socketId = null) => {
  await delay(3000); // 🔥 IMPORTANT

  return new Promise((resolve, reject) => {
    try {
      const outputTemplate = path.join(downloadDir, "%(title)s.%(ext)s");

      let args = [
        "-m",
        "yt_dlp",

        // 🔥 reduce bot detection
        "--extractor-args",
        "youtube:player_client=android",

        "--sleep-interval", "2",
        "--max-sleep-interval", "5",
        "--retries", "3",

        "--newline"
      ];

      // 🔥 cookies support (BEST workaround)
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

      process.stdout.on("data", (data) => {
        console.log("STDOUT:", data.toString());
      });

      process.stderr.on("data", (data) => {
        const output = data.toString();
        errorLog += output;

        console.log("YT-DLP:", output);

        // progress
        const match = output.match(/(\d{1,3}\.?(\d+)?)%/);
        if (match && io && socketId) {
          io.to(socketId).emit("progress", match[1]);
        }

        // filename
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
