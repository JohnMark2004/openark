// server.js
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const Tesseract = require("tesseract.js"); // 👈 local OCR
require("dotenv").config();
const connectDB = require("./db");
const Student = require("./models/Student");
const Librarian = require("./models/Librarian");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// ✅ Connect to MongoDB
connectDB();

const app = express();
const port = 3000;

// Middleware
const corsOptions = {
  origin: "https://openark.onrender.com",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // if you need cookies/auth headers
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"), { index: false }));

// Setup file storage
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|bmp|tiff|pdf/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) cb(null, true);
    else cb(new Error("Only image and PDF files are allowed"));
  },
});

// Make sure folders exist
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("converted")) fs.mkdirSync("converted");

// Hugging Face Summarization Function
async function getAISummary(text) {
  const API_URL =
    "https://api-inference.huggingface.co/models/facebook/bart-large-cnn";
  const HF_TOKEN = process.env.HF_TOKEN;

  if (text.length > 1024) text = text.substring(0, 1024) + "...";

  try {
    const response = await fetch(API_URL, {
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        inputs: text,
        parameters: { max_length: 150, min_length: 50 },
      }),
    });

    if (!response.ok)
      throw new Error(`Hugging Face error: ${response.status}`);

    const result = await response.json();
    return result[0]?.summary_text || "No summary available.";
  } catch (error) {
    console.error("Summarization Error:", error.message);
    return "Summary could not be generated.";
  }
}

// ✅ Tesseract OCR helper
async function extractTextWithTesseract(filePath) {
  console.log("Running OCR with Tesseract.js...");
  try {
    const {
      data: { text, confidence },
    } = await Tesseract.recognize(filePath, "eng");
    return {
      text: text.trim() || "[No text detected]",
      confidence: confidence || null,
    };
  } catch (error) {
    console.error("Tesseract Error:", error.message);
    throw new Error("OCR failed: " + error.message);
  }
}

// Routes
app.get("/", (req, res) => {
  // Serve role selection page first
  res.sendFile(path.join(__dirname, "public", "role-select.html"));
});

// Student Signup
app.post('/api/signup/student', async (req, res) => {
  try {
    const { studentId, username, course, password } = req.body;

    const existing = await Student.findOne({ $or: [{ studentId }, { username }] });
    if (existing) return res.status(400).json({ error: "Student already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const student = new Student({ studentId, username, course, password: hashedPassword });
    await student.save();

    res.json({ success: true, message: "Student created successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Student Login
app.post('/api/login/student', async (req, res) => {
  try {
    const { username, password } = req.body;

    const student = await Student.findOne({ username });
    if (!student) return res.status(400).json({ error: "Invalid credentials" });

    const validPassword = await bcrypt.compare(password, student.password);
    if (!validPassword) return res.status(400).json({ error: "Invalid credentials" });

    res.json({ success: true, user: { username: student.username, role: "student" } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Librarian Signup
app.post('/api/signup/librarian', async (req, res) => {
  try {
    const { email, username, password, accessCode } = req.body;

    const existing = await Librarian.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(400).json({ error: "Librarian already exists" });

    if (process.env.LIBRARIAN_MASTER_CODE && accessCode !== process.env.LIBRARIAN_MASTER_CODE) {
      return res.status(403).json({ error: "Invalid access code" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const librarian = new Librarian({ email, username, password: hashedPassword, accessCode });
    await librarian.save();

    res.json({ success: true, message: "Librarian created successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Librarian Login
app.post('/api/login/librarian', async (req, res) => {
  try {
    const { username, password, accessCode } = req.body;

    const librarian = await Librarian.findOne({ username });
    if (!librarian) return res.status(400).json({ error: "Invalid credentials" });

    const validPassword = await bcrypt.compare(password, librarian.password);
    if (!validPassword) return res.status(400).json({ error: "Invalid credentials" });

    if (process.env.LIBRARIAN_MASTER_CODE && accessCode !== process.env.LIBRARIAN_MASTER_CODE) {
      return res.status(403).json({ error: "Invalid access code" });
    }

    res.json({ success: true, user: { username: librarian.username, role: "librarian" } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Forgot Password (request reset) - works for both student and librarian by username or email
app.post('/api/password/forgot', async (req, res) => {
  try {
    const { identifier } = req.body; // can be username or email
    if (!identifier) return res.status(400).json({ error: 'Identifier is required' });

    // Try to find librarian by email or username first
    let user = await Librarian.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    let userType = 'librarian';
    if (!user) {
      // Fallback to student by username
      user = await Student.findOne({ username: identifier });
      userType = 'student';
    }
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

    user.resetPasswordToken = token;
    user.resetPasswordExpires = expires;
    await user.save();

    // In a real app, send via email. For now return the token in response for development.
    res.json({ success: true, message: 'Reset token generated', token, expires: expires.toISOString(), userType });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset Password using token
app.post('/api/password/reset', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and newPassword are required' });

    // Find user in both collections with valid token
    let user = await Librarian.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: new Date() } });
    if (!user) {
      user = await Student.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: new Date() } });
    }
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password has been reset' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload + OCR route
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    const filePath = req.file.path;
    console.log("Processing:", req.file.originalname);

    // Run local OCR
    const ocrResult = await extractTextWithTesseract(filePath);

    // Save converted text
    const outPath = `converted/${req.file.filename}.txt`;
    fs.writeFileSync(outPath, ocrResult.text);

    // Clean up upload
    fs.unlinkSync(filePath);

    // Optional summary (only if requested)
    let summary = null;
    try {
      if (req.query.summary === 'true') {
        summary = await getAISummary(ocrResult.text);
      }
    } catch (e) {
      console.warn("Summary skipped:", e.message);
    }

    res.json({
      success: true,
      status: "completed",
      text: ocrResult.text,
      download: `/download/${req.file.filename}.txt`,
      confidence: ocrResult.confidence,
      summary,
    });
  } catch (err) {
    console.error("Processing Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download converted text
app.get("/download/:name", (req, res) => {
  const filePath = path.join(__dirname, "converted", req.params.name);
  if (fs.existsSync(filePath)) {
    res.download(filePath, "converted-text.txt");
  } else {
    res.status(404).send("File not found");
  }
});

// Connect to database then start server
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
  });
}).catch((err) => {
  console.error("Failed to start server due to DB error:", err);
  process.exit(1);
});
