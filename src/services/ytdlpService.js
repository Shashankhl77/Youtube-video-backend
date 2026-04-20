const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const downloadDir = "/tmp/downloads";
fs.mkdirSync(downloadDir, { recursive: true });

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

exports.downloadVideo = async (url, type = "video", io = null, socketId = null) => {
  await delay(3000);

  return new Promise((resolve, reject) => {
    try {
      const outputTemplate = path.join(downloadDir, "%(title)s.%(ext)s");

      const pythonCmd = process.platform === "win32" ? "python" : "python3";

      let args = [
        "-m", "yt_dlp",
        "--newline",
        "--user-agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "--sleep-interval", "2",
        "--max-sleep-interval", "5",
        "--retries", "5",
        "--geo-bypass",
        "--force-ipv4"
      ];

const secretCookiePath = "/etc/secrets/cookies.txt";
const tempCookiePath = "/tmp/cookies.txt";

if (fs.existsSync(secretCookiePath)) {
  const data = fs.readFileSync(secretCookiePath, "utf-8");
  fs.writeFileSync(tempCookiePath, data); // ✅ writable copy
  args.push("--cookies", tempCookiePath);
}

      // 🎵 AUDIO
      if (type === "audio") {
        args.push(
          "-f", "bestaudio",
          "-x",
          "--audio-format", "mp3",
          "--audio-quality", "0"
        );
      } else {
        // 🎥 VIDEO
        args.push(
          "-f",
          "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
        );
      }

      args.push("-o", outputTemplate, url);

      const ytProcess = spawn(pythonCmd, args);

      let fileName = null;
      let errorLog = "";

      ytProcess.stderr.on("data", (data) => {
        const output = data.toString();
        errorLog += output;

        console.log("YT-DLP:", output);

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

      ytProcess.on("close", (code) => {
        if (code === 0) {
          resolve(fileName || (type === "audio" ? "audio.mp3" : "video.mp4"));
        } else {
          reject(new Error(errorLog || "yt-dlp failed"));
        }
      });

      ytProcess.on("error", reject);

    } catch (err) {
      reject(err);
    }
  });
};
