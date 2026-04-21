const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

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

        // detect OS (Windows vs Linux)
        const pythonCmd = process.platform === "win32" ? "python" : "python3";

        let args = ["-m", "yt_dlp"];

        if (type === "audio") {
          // 🎵 AUDIO
          args.push(
            "-x",
            "--audio-format", "mp3",
            "--audio-quality", "0"
          );
        } else {
          // 🎥 VIDEO
          args.push(
            "-f", "bv*+ba/b",
            "--merge-output-format", "mp4",
            "--postprocessor-args",
            "ffmpeg:-c:v copy -c:a aac -b:a 192k"
          );
        }

        // 🔥 helps avoid bot detection (important for Render)
        args.push("--user-agent", "Mozilla/5.0");

        // common args
        args.push("--newline", "-o", outputTemplate, url);

        const child = spawn(pythonCmd, args);

        let fileName = null;

        // 🔥 STDERR (main logs)
        child.stderr.on("data", (data) => {
          const output = data.toString();
          console.log("YT-DLP:", output);

          // detect actual errors
          if (output.toLowerCase().includes("error")) {
            console.error("YT-DLP ERROR:", output);
          }

          // progress %
          const match = output.match(/(\d{1,3}\.?(\d+)?)%/);
          if (match && io && socketId) {
            io.to(socketId).emit("progress", match[1]);
          }

          // capture filename
          if (output.includes("Destination:")) {
            const filePath = output.split("Destination:")[1].trim();
            fileName = path.basename(filePath);
          }

          if (output.includes("Merging formats into")) {
            const filePath = output.split("into")[1].trim().replace(/"/g, "");
            fileName = path.basename(filePath);
          }
        });

        // 🔥 STDOUT (sometimes yt-dlp prints here)
        child.stdout.on("data", (data) => {
          console.log("YT-DLP STDOUT:", data.toString());
        });

        // ⏱ timeout (3 mins)
        const timeout = setTimeout(() => {
          console.error("⏱ Download timeout");
          child.kill("SIGKILL");
          reject(new Error("Download timeout"));
        }, 1000 * 60 * 3);

        // ✅ success / fail
        child.on("close", (code) => {
          clearTimeout(timeout);

          if (code === 0) {
            console.log("✅ Download completed");
            resolve(fileName || (type === "audio" ? "audio.mp3" : "video.mp4"));
          } else {
            console.error("❌ yt-dlp failed with code:", code);
            reject(new Error("yt-dlp failed"));
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
