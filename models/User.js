// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  studentId: { type: String, unique: true, sparse: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  course: { type: String },
  role: { type: String, enum: ['student', 'librarian'], required: true },
  accessCode: { type: String } // for librarians
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
