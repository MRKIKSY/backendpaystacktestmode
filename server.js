const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const bcrypt = require('bcryptjs');

const jwt = require("jsonwebtoken");
const axios = require("axios");
require("dotenv").config(); // Load .env file

const app = express();
app.use(express.json());
app.use(cors({
    origin: ['https://frontendpaystacktestmode.onrender.com', 'https://backendpaystacktestmode.onrender.com'],
    credentials: true
}));

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Folder to store uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname); // Rename file to avoid conflicts
  },
});
const upload = multer({ storage });

// Models
const SubmissionSchema = new mongoose.Schema({
  email: String,
  username: String,
  comment: String,
  picture: String,
  status: { type: String, default: "Pending" }, // Submission status
});
const Submission = mongoose.model("Submission", SubmissionSchema);

// Middleware for admin authentication
const authenticateAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).send("Access Denied: No Token Provided");

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = verified;
    next();
  } catch (err) {
    res.status(400).send("Invalid Token");
  }
};

// Routes
// 1. Submission API
app.post("/api/submissions", upload.single("picture"), async (req, res) => {
  const { email, username, comment } = req.body;
  const picture = req.file?.filename || null;

  try {
    const submission = new Submission({ email, username, comment, picture });
    await submission.save();
    res.status(201).send("Submission saved successfully");
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error saving submission");
  }
});

app.get("/api/submissions", authenticateAdmin, async (req, res) => {
  try {
    const submissions = await Submission.find();
    res.status(200).json(submissions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Error fetching submissions");
  }
});

// 2. Admin Login
app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;

  if (username === "admin" && password === "password123") {
    const token = jwt.sign({ id: "admin" }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.status(200).json({ token });
  } else {
    res.status(401).send("Invalid credentials");
  }
});

// 3. Payment Verification API
app.post("/verify-payment", async (req, res) => {
  const { reference } = req.body;

  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });

    if (response.data.data.status === "success") {
      res.status(200).json({ message: "Payment successful", data: response.data });
    } else {
      res.status(400).json({ message: "Payment failed" });
    }
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    res.status(500).json({ message: "An error occurred while verifying payment" });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
