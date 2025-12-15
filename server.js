const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// =======================
// DIRECTORIES
// =======================
const UPLOADS_DIR = path.join(__dirname, "uploads");
const CHUNKS_DIR = path.join(__dirname, "chunks");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR);

// =======================
// NORMAL UPLOAD (SMALL FILES)
// =======================
const normalStorage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const normalUpload = multer({
  storage: normalStorage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

app.post("/upload", normalUpload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// =======================
// CHUNKED UPLOAD (LARGE FILES)
// =======================
const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CHUNKS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB per chunk
});

app.post("/chunk", chunkUpload.single("chunk"), (req, res) => {
  const { fileId, index, total, name } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "Chunk missing" });
  }

  const chunkFolder = path.join(CHUNKS_DIR, fileId);
  if (!fs.existsSync(chunkFolder)) fs.mkdirSync(chunkFolder);

  const chunkPath = path.join(chunkFolder, index);
  fs.renameSync(req.file.path, chunkPath);

  // Merge if last chunk
  if (Number(index) + 1 === Number(total)) {
    const finalFile = path.join(UPLOADS_DIR, `${Date.now()}-${name}`);
    const writeStream = fs.createWriteStream(finalFile);

    for (let i = 0; i < total; i++) {
      const chunkData = fs.readFileSync(path.join(chunkFolder, String(i)));
      writeStream.write(chunkData);
    }

    writeStream.end();
    writeStream.on("close", () => {
      fs.rmSync(chunkFolder, { recursive: true, force: true });
    });

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${path.basename(finalFile)}`;
    return res.json({ done: true, url: fileUrl });
  }

  res.json({ received: true });
});

// =======================
// STATIC FILE SERVE
// =======================
app.use("/uploads", express.static(UPLOADS_DIR));

// =======================
// HEALTH CHECK
// =======================
app.get("/", (req, res) => {
  res.send("Transfer Me backend running 🚀");
});

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
