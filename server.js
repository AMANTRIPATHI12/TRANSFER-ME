const express = require("express");
const multer = require("multer");
const fs = require("fs");
const cors = require("cors");
const { v4: uuid } = require("uuid");
require("dotenv").config();

const app = express();
app.use(cors());

// 2GB limit
const MAX_SIZE = 2 * 1024 * 1024 * 1024;

// Multer setup
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: MAX_SIZE }
});

// Upload
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, msg: "No file uploaded" });

  const file = req.file;
  const fileId = uuid();

  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

  // Save metadata manually (no MongoDB)
  const db = JSON.parse(fs.readFileSync("files.json", "utf8") || "{}");
  db[fileId] = {
    originalName: file.originalname,
    path: file.path,
    expiresAt
  };
  fs.writeFileSync("files.json", JSON.stringify(db, null, 2));

  const link = `${process.env.BASE_URL}/file/${fileId}`;
  res.json({ success: true, link });
});

// Download
app.get("/file/:id", (req, res) => {
  const db = JSON.parse(fs.readFileSync("files.json", "utf8") || "{}");
  const file = db[req.params.id];

  if (!file) return res.status(404).send("File not found or expired");

  res.download(file.path, file.originalName);
});

// Auto delete every hour
setInterval(() => {
  const db = JSON.parse(fs.readFileSync("files.json", "utf8") || "{}");
  const now = Date.now();

  for (const id in db) {
    if (db[id].expiresAt < now) {
      if (fs.existsSync(db[id].path)) fs.unlinkSync(db[id].path);
      delete db[id];
    }
  }

  fs.writeFileSync("files.json", JSON.stringify(db, null, 2));
}, 60 * 60 * 1000);

app.listen(3001, () => console.log("Server started on 3001"));
