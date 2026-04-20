const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const downloadDir = "/tmp/downloads";
fs.mkdirSync(downloadDir, { recursive: true });

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// 🔥 helper to run yt-dlp
const runYtDlp = (pythonCmd, args, io, socketId) => {
  return new Promise((resolve, reject) => {
    const ytProcess = spawn(pythonCmd, args);

    let fileName = null;
    let errorLog = "";

    ytProcess.stdout.on("data", (data) => {
      console.log("STDOUT:", data.toString());
    });

    ytProcess.stderr.on("data", (data) => {
      const output = data.toString();
      errorLog += output;

      console.log("YT-DLP:", output);

      // progress
      const match = output.match(/(\d{1,3}\.?(\d+)?)%/);
      if (match && io && socketId) {
        io.to(socketId).emit("progress", match[1]);
      }

      // filename detection
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
        resolve(fileName);
      } else {
        reject(new Error(errorLog || "yt-dlp failed"));
      }
    });

    ytProcess.on("error", reject);
  });
};

exports.downloadVideo = async (url, type = "video", io = null, socketId = null) => {
  await delay(4000); // 🔥 slightly higher delay = fewer 429

  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  const outputTemplate = path.join(downloadDir, "%(title)s.%(ext)s");

  // 🔥 base args (NO cookies)
  const baseArgs = [
    "-m", "yt_dlp",
    "--newline",
    "--retries", "3",
    "--sleep-interval", "2",
    "--max-sleep-interval", "5",
    "--geo-bypass",
    "--force-ipv4",
    "--no-check-certificate",
    "--user-agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
  ];

  // 🎵 AUDIO
  const formatArgs =
    type === "audio"
      ? [
          "-f", "bestaudio",
          "-x",
          "--audio-format", "mp3",
          "--audio-quality", "0"
        ]
      : ["-f", "b/bv*+ba/best"];

  const finalArgsNoCookie = [...baseArgs, ...formatArgs, "-o", outputTemplate, url];

  try {
    // 🥇 FIRST TRY (NO COOKIES)
    console.log("🚀 Attempt 1: No cookies");
    const result = await runYtDlp(pythonCmd, finalArgsNoCookie, io, socketId);
    return result || (type === "audio" ? "audio.mp3" : "video.mp4");

  } catch (err1) {
    console.log("⚠️ First attempt failed, trying with cookies...");

    // 🥈 SECOND TRY (WITH COOKIES)
    try {
      const secretCookiePath = "/etc/secrets/cookies.txt";
      const tempCookiePath = "/tmp/cookies.txt";

      if (fs.existsSync(secretCookiePath)) {
        const data = fs.readFileSync(secretCookiePath, "utf-8");
        fs.writeFileSync(tempCookiePath, data);

        const finalArgsWithCookie = [
          ...baseArgs,
          "--cookies", tempCookiePath,
          ...formatArgs,
          "-o", outputTemplate,
          url
        ];

        console.log("🍪 Attempt 2: With cookies");

        const result = await runYtDlp(
          pythonCmd,
          finalArgsWithCookie,
          io,
          socketId
        );

        return result || (type === "audio" ? "audio.mp3" : "video.mp4");
      } else {
        throw err1;
      }

    } catch (err2) {
      console.log("❌ Both attempts failed");
      throw new Error(err2.message || "Download failed after retries");
    }
  }
};
