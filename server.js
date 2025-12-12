const express = require("express");
const multer = require("multer");
const { MongoClient } = require("mongodb");
const { v4: uuid } = require("uuid");
const fs = require("fs");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());

const upload = multer({ dest: "uploads/" });

let db;

// connect to MongoDB
async function startDB() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db("fileShareDB");
  console.log("MongoDB connected");
}
startDB();

// upload endpoint
app.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  const fileId = uuid();

  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  await db.collection("files").insertOne({
    fileId,
    originalName: file.originalname,
    path: file.path,
    expiresAt
  });

  const link = `${process.env.BASE_URL}/file/${fileId}`;

  res.json({ success: true, link });
});

// download endpoint
app.get("/file/:id", async (req, res) => {
  const file = await db.collection("files").findOne({ fileId: req.params.id });

  if (!file) return res.status(404).send("File expired or not found");

  res.download(file.path, file.originalName);
});

// auto-delete expired files every hour
setInterval(async () => {
  const now = Date.now();
  const expired = await db.collection("files").find({ expiresAt: { $lt: now } }).toArray();

  expired.forEach(file => {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  });

  await db.collection("files").deleteMany({ expiresAt: { $lt: now } });
  console.log("Expired files cleaned.");
}, 60 * 60 * 1000);

app.listen(3001, () => console.log("Server running on port 3001"));
