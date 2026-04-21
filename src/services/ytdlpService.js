const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// 🔥 ffmpeg (Render fix)
let ffmpegPath = null;
try {
  ffmpegPath = require("ffmpeg-static");
} catch (e) {
  console.log("ffmpeg-static not installed");
}

const downloadDir = path.join(__dirname, "../downloads");

// ensure downloads folder exists
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

// retry helper
const retryDownload = async (fn, retries = 2) => {
  try {
    return await fn();
  } catch (err) {
    if (retries === 0) throw err;
    console.log("🔁 Retrying download...");
    return retryDownload(fn, retries - 1);
  }
};

exports.downloadVideo = (url, type = "video", io = null, socketId = null) => {
  return retryDownload(() => {
    return new Promise((resolve, reject) => {
      try {
        if (!url || !url.startsWith("http")) {
          return reject(new Error("Invalid URL"));
        }

        const outputTemplate = path.join(downloadDir, "%(title)s.%(ext)s");

        const pythonCmd = process.platform === "win32" ? "python" : "python3";

        let args = ["-m", "yt_dlp"];

        if (type === "audio") {
          args.push(
            "-x",
            "--audio-format", "mp3",
            "--audio-quality", "0"
          );
        } else {
          args.push(
            "-f", "bv*+ba/b",
            "--merge-output-format", "mp4",
            "--postprocessor-args",
            "ffmpeg:-c:v copy -c:a aac -b:a 192k"
          );
        }

        // 🔥 IMPORTANT FIXES (anti-block)
        args.push(
          "--user-agent", "Mozilla/5.0",
          "--sleep-interval", "2",
          "--max-sleep-interval", "5"
        );

        // 🔥 cookies (REQUIRED for Render)
        const cookiesPath = path.join(__dirname, "../../cookies.txt");
        if (fs.existsSync(cookiesPath)) {
          args.push("--cookies", cookiesPath);
        } else {
          console.log("⚠️ cookies.txt not found");
        }

        // 🔥 JS runtime fix (new yt-dlp requirement)
        args.push("--js-runtimes", "quickjs");

        // 🔥 ffmpeg fix
        if (ffmpegPath) {
          args.push("--ffmpeg-location", ffmpegPath);
        }

        // common args
        args.push("--newline", "-o", outputTemplate, url);

        const child = spawn(pythonCmd, args);

        let fileName = null;
        let errorOutput = "";

        // STDERR
        child.stderr.on("data", (data) => {
          const output = data.toString();
          console.log("YT-DLP:", output);

          errorOutput += output;

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

        // STDOUT
        child.stdout.on("data", (data) => {
          console.log("YT-DLP STDOUT:", data.toString());
        });

        // timeout
        const timeout = setTimeout(() => {
          console.error("⏱ Download timeout");
          child.kill("SIGKILL");
          reject(new Error("Download timeout"));
        }, 1000 * 60 * 3);

        // close
        child.on("close", (code) => {
          clearTimeout(timeout);

          if (code === 0) {
            console.log("✅ Download completed");
            resolve(fileName || (type === "audio" ? "audio.mp3" : "video.mp4"));
          } else {
            console.error("❌ yt-dlp failed:", errorOutput);
            reject(new Error(errorOutput || "yt-dlp failed"));
          }
        });

        child.on("error", (err) => {
          clearTimeout(timeout);
          console.error("❌ Process error:", err);
          reject(err);
        });

      } catch (err) {
        reject(err);
      }
    });
  });
};
