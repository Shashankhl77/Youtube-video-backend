const fs = require("fs");
const { addToQueue } = require("../utils/queue");
const { downloadVideo } = require("../services/ytdlpService");

exports.handleDownload = async (req, res) => {
  try {
    let urlsArray = [];
    const { url, urls, urlsText, type } = req.body;

    if (url) urlsArray.push(url);
    if (urls && Array.isArray(urls)) urlsArray.push(...urls);

    if (urlsText) {
      const list = urlsText.split("\n").map(u => u.trim()).filter(Boolean);
      urlsArray.push(...list);
    }

    if (urlsArray.length === 0) {
      return res.status(400).json({ message: "No URLs provided" });
    }

    urlsArray = [...new Set(urlsArray)];

    const results = await Promise.all(
      urlsArray.map((u) =>
        addToQueue(() => downloadVideo(u, type))
      )
    );

    res.json({
      message: "All downloads completed",
      files: results,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};