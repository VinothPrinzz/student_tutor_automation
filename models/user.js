const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  platformId: {
    type: String,
    required: true,
    unique: true,
  },
  platform: {
    type: String,
    enum: ["telegram", "whatsapp"],
    required: true,
  },
  firstName: String,
  lastName: String,
  username: String,
  questionsCount: {
    type: Number,
    default: 0,
  },
  lastInteractionAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);
