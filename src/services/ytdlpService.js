const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const downloadDir = path.join(__dirname, "../downloads");
fs.mkdirSync(downloadDir, { recursive: true });

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

exports.downloadVideo = async (url, type = "video", io = null, socketId = null) => {
  await delay(4000); // 🔥 avoid rate limit

  return new Promise((resolve, reject) => {
    try {
      const outputTemplate = path.join(downloadDir, "%(title)s.%(ext)s");

      let args = [
        "-m",
        "yt_dlp",

        // 🔥 pretend mobile app (important)
        "--extractor-args",
        "youtube:player_client=android",

        // 🔥 reduce bot detection
        "--sleep-interval", "2",
        "--max-sleep-interval", "6",
        "--retries", "3",

        "--newline"
      ];

      // 🔥 cookies (VERY IMPORTANT)
      const cookiePath = path.join(__dirname, "../cookies.txt");
      if (fs.existsSync(cookiePath)) {
        args.push("--cookies", cookiePath);
      }

      if (type === "audio") {
        args.push(
          "-f", "bestaudio",
          "-x",
          "--audio-format", "mp3"
        );
      } else {
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

        console.log("YT:", output);

        const match = output.match(/(\d{1,3}\.?(\d+)?)%/);
        if (match && io && socketId) {
          io.to(socketId).emit("progress", match[1]);
        }

        if (output.includes("Destination:")) {
          const filePath = output.split("Destination:")[1].trim();
          fileName = path.basename(filePath);
        }
      });

      process.on("close", (code) => {
        if (code === 0) {
          resolve(fileName || "video.mp4");
        } else {
          reject(new Error(errorLog));
        }
      });

      process.on("error", reject);

    } catch (err) {
      reject(err);
    }
  });
};
