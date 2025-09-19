// models/Librarian.js
const mongoose = require("mongoose");

const librarianSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    accessCode: { type: String, required: true }, // special code for librarians
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Librarian", librarianSchema);
