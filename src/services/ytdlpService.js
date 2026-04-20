const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const downloadDir = "/tmp/downloads";
fs.mkdirSync(downloadDir, { recursive: true });

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// helper
const runYtDlp = (pythonCmd, args) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonCmd, args);

    let fileName = null;
    let errorLog = "";

    proc.stderr.on("data", (data) => {
      const output = data.toString();
      errorLog += output;

      console.log("YT-DLP:", output);

      if (output.includes("Destination:")) {
        const filePath = output.split("Destination:")[1].trim();
        fileName = path.basename(filePath);
      }
    });

    proc.on("close", (code) => {
      if (code === 0) resolve(fileName);
      else reject(new Error(errorLog));
    });

    proc.on("error", reject);
  });
};

exports.downloadVideo = async (url, type = "video") => {
  await delay(5000); // 🔥 IMPORTANT (docs say 5–10 sec)

  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  const outputTemplate = path.join(downloadDir, "%(title)s.%(ext)s");

  // 🔥 BASE CONFIG (NO COOKIES)
  const baseArgs = [
    "-m", "yt_dlp",
    "--newline",
    "--no-check-certificate",
    "--retries", "3",
    "--sleep-interval", "3",
    "--max-sleep-interval", "6",
    "--geo-bypass",
    "--force-ipv4",

    // 🔥 IMPORTANT: force web client
    "--extractor-args", "youtube:player_client=web"
  ];

  const formatArgs =
    type === "audio"
      ? [
          "-f", "bestaudio",
          "-x",
          "--audio-format", "mp3"
        ]
      : ["-f", "b/bv*+ba/best"];

  const noCookieArgs = [...baseArgs, ...formatArgs, "-o", outputTemplate, url];

  try {
    console.log("🚀 Attempt 1 (no cookies)");
    return await runYtDlp(pythonCmd, noCookieArgs);
  } catch (err1) {
    console.log("⚠️ Retry with cookies...");

    try {
      const secretCookiePath = "/etc/secrets/cookies.txt";
      const tempCookiePath = "/tmp/cookies.txt";

      if (fs.existsSync(secretCookiePath)) {
        const data = fs.readFileSync(secretCookiePath, "utf-8");
        fs.writeFileSync(tempCookiePath, data);

        const cookieArgs = [
          ...baseArgs,
          "--cookies", tempCookiePath,
          ...formatArgs,
          "-o", outputTemplate,
          url
        ];

        console.log("🍪 Attempt 2 (with cookies)");
        return await runYtDlp(pythonCmd, cookieArgs);
      } else {
        throw err1;
      }

    } catch (err2) {
      throw new Error("Download failed (blocked by YouTube)");
    }
  }
};
