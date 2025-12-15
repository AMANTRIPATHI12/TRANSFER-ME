const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// =========================
// FOLDER SETUP
// =========================
const UPLOADS_DIR = "uploads";
const CHUNKS_DIR = "chunks";

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR);

// =========================
// NORMAL UPLOAD (Render-safe)
// =========================
const normalStorage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const normalUpload = multer({
  storage: normalStorage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB safety
});

// NORMAL UPLOAD ROUTE
app.post("/upload", normalUpload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// =========================
// CHUNKED UPLOAD (LARGE FILES)
// =========================
const chunkUpload = multer({
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB per chunk
});

// CHUNK ROUTE
app.post("/chunk", chunkUpload.single("chunk"), (req, res) => {
  const { fileId, index, total, name } = req.body;

  if (!req.file) return res.status(400).json({ error: "No chunk received" });

  const chunkFolder = path.join(CHUNKS_DIR, fileId);

  if (!fs.existsSync(chunkFolder)) {
    fs.mkdirSync(chunkFolder);
  }

  const chunkPath = path.join(chunkFolder, index);
  fs.renameSync(req.file.path, chunkPath);

  // If last chunk → merge
  if (Number(index) + 1 === Number(total)) {
    const finalFilePath = path.join(UPLOADS_DIR, `${Date.now()}-${name}`);
    const writeStream = fs.createWriteStream(finalFilePath);

    for (let i = 0; i < total; i++) {
      const data = fs.readFileSync(path.join(chunkFolder, String(i)));
      writeStream.write(data);
    }

    writeStream.end();

    writeStream.on("close", () => {
      fs.rmSync(chunkFolder, { recursive: true, force: true });
      console.log("Merged:", finalFilePath);
    });

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${path.basename(finalFilePath)}`;
    return res.json({ done: true, url: fileUrl });
  }

  res.json({ ok: true });
});

// =========================
// STATIC FILE SERVE
// =========================
app.use("/uploads", express.static(path.join(__dirname, UPLOADS_DIR)));

// =========================
// HEALTH CHECK
// =========================
app.get("/", (req, res) => {
  res.send("Transfer Me backend running 🚀");
});

// =========================
// SERVER START
// =========================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
