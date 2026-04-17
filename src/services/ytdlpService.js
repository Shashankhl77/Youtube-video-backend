const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const downloadDir = path.join(__dirname, "../downloads");

if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir);
}

exports.downloadVideo = (url, type = "video", io = null, socketId = null) => {
  return new Promise((resolve, reject) => {
    try {
      const outputTemplate = path.join(downloadDir, "%(title)s.%(ext)s");

      let args = ["-m", "yt_dlp"];

      if (type === "audio") {
        // 🎵 AUDIO MODE
        args.push(
          "-x",                      // extract audio
          "--audio-format", "mp3",   // convert to mp3
          "--audio-quality", "0"
        );
      } else {
        // 🎥 VIDEO MODE (your WORKING config)
        args.push(
          "-f", "bv*+ba/b",
          "--merge-output-format", "mp4",
          "--audio-format", "aac",
          "--audio-quality", "0",
          "--postprocessor-args",
          "ffmpeg:-c:v copy -c:a aac -b:a 192k"
        );
      }

      // common
      args.push("--newline", "-o", outputTemplate, url);

      const process = spawn("python", args);

      let fileName = null;

      process.stderr.on("data", (data) => {
        const output = data.toString();

        const match = output.match(/(\d{1,3}\.?(\d+)?)%/);
        if (match && io && socketId) {
          io.to(socketId).emit("progress", match[1]);
        }

        if (output.includes("Destination:")) {
          const filePath = output.split("Destination:")[1].trim();
          fileName = path.basename(filePath);
        }

        if (output.includes("Merging formats into")) {
          const filePath = output.split("into")[1].trim().replace(/"/g, "");
          fileName = path.basename(filePath);
        }
      });

      process.on("close", (code) => {
        if (code === 0) {
          console.log("✅ Download completed");
          resolve(fileName || (type === "audio" ? "audio.mp3" : "video.mp4"));
        } else {
          reject(new Error("yt-dlp failed"));
        }
      });

      process.on("error", reject);

    } catch (err) {
      reject(err);
    }
  });
};