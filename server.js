const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Serve static files like index.html

// MongoDB connection
mongoose.connect("mongodb://localhost:27017/userDB").then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Schema
const userSchema = new mongoose.Schema({
  firstname: String,
  lastname: String,
  username: { type: String, unique: true },
  password: String,
  image: Buffer,
  dob: Date,
  email: { type: String, unique: true },
  phone: String,
  gender: String,
  qualifications: String,
});

// Model using "users" collection
const User = mongoose.model('users', userSchema);

// Multer config
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const isValid = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    cb(isValid ? null : new Error('Only JPEG/PNG allowed'), isValid);
  },
});

// Serve homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Registration route
app.post('/signup', upload.single('image'), async (req, res) => {
  try {
    const { firstname, lastname, username, password, dob, email, phone, gender, qualifications } = req.body;

    if (!firstname || !lastname || !username || !password || !dob || !email || !phone || !gender || !qualifications) {
      return res.status(400).json({ message: 'All fields required' });
    }

    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) return res.status(400).json({ message: 'Username or email already exists' });

    const user = new User({
      firstname,
      lastname,
      username,
      password,
      image: req.file ? req.file.buffer : null,
      dob: new Date(dob),
      email,
      phone,
      gender,
      qualifications,
    });

    await user.save();
    res.status(201).json({ message: 'Registration successful' });
  } catch (err) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Image size exceeds 2MB' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Login route
app.post('/signin', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || user.password !== password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const imageBase64 = user.image ? user.image.toString('base64') : null;
    const imageUrl = imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null;

    res.json({
      message: 'Login successful',
      user: {
        firstname: user.firstname,
        lastname: user.lastname,
        username: user.username,
        dob: user.dob.toISOString().split('T')[0],
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        qualifications: user.qualifications,
        image: imageUrl,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin search route
app.get('/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    const users = await User.find({
      $or: [
        { username: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } }
      ]
    });

    const results = users.map(user => ({
      firstname: user.firstname,
      lastname: user.lastname,
      username: user.username,
      dob: user.dob.toISOString().split('T')[0],
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      qualifications: user.qualifications,
      image: user.image ? `data:image/jpeg;base64,${user.image.toString('base64')}` : null,
    }));

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Error in search' });
  }
});

// Start server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
