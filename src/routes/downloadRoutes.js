// src/routes/downloadRoutes.js
const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { handleDownload } = require("../controllers/downloadController");

router.post("/download", upload.single("file"), handleDownload);

module.exports = router;