const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());

// where uploaded files will be stored
const storage = multer.diskStorage({
  destination: "uploads",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

// upload endpoint
app.post("/upload", upload.single("file"), (req, res) => {
  const filePath = `http://localhost:3001/uploads/${req.file.filename}`;
  res.json({ url: filePath });
});

// serve uploads publicly
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(3001, () => console.log("Server running on http://localhost:3001"));
