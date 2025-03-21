const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  accountId: {
    type: String,
    required: true,
    index: true,
  },
  accountName: {
    type: String,
    required: true,
  },
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: String,
    required: true,
  },
  editedAnswer: {
    type: String,
    default: null,
  },
  isApproved: {
    type: Boolean,
    default: false,
  },
  isFromImage: {
    type: Boolean,
    default: false,
  },
  imageUrl: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  approvedAt: {
    type: Date,
    default: null,
  },
  approvedBy: {
    type: String,
    default: null,
  },
});

// Update the updatedAt field on save
questionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Question", questionSchema);
