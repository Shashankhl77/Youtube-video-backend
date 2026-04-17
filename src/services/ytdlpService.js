const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const downloadDir = path.join(__dirname, "../downloads");

// ✅ safe folder creation
fs.mkdirSync(downloadDir, { recursive: true });

exports.downloadVideo = (url, type = "video", io = null, socketId = null) => {
  return new Promise((resolve, reject) => {
    try {
      const outputTemplate = path.join(downloadDir, "%(title)s.%(ext)s");

      let args = ["-m", "yt_dlp"];

      if (type === "audio") {
        // 🎵 AUDIO MODE (safe everywhere)
        args.push(
          "-f", "bestaudio",
          "-x",
          "--audio-format", "mp3",
          "--audio-quality", "0"
        );
      } else {
        // 🎥 VIDEO MODE (Render-safe, no ffmpeg needed)
        args.push(
          "-f",
          "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
        );
      }

      // common args
      args.push(
        "--newline",
        "-o",
        outputTemplate,
        url
      );

      // ✅ use python3 (important for Render)
      const process = spawn("python3", args);

      let fileName = null;
      let errorLog = "";

      // 🔥 STDERR (progress + logs)
      process.stderr.on("data", (data) => {
        const output = data.toString();
        errorLog += output;

        console.log("YT-DLP:", output);

        // 📊 progress tracking
        const match = output.match(/(\d{1,3}\.?(\d+)?)%/);
        if (match && io && socketId) {
          io.to(socketId).emit("progress", match[1]);
        }

        // 📁 filename detection
        if (output.includes("Destination:")) {
          const filePath = output.split("Destination:")[1].trim();
          fileName = path.basename(filePath);
        }

        if (output.includes("Merging formats into")) {
          const filePath = output.split("into")[1].trim().replace(/"/g, "");
          fileName = path.basename(filePath);
        }
      });

      // 🔥 STDOUT (optional logs)
      process.stdout.on("data", (data) => {
        console.log("STDOUT:", data.toString());
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
