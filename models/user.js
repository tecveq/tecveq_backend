const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: false,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  profilePic: {
    type: String,
  },
  bio: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  dob: {
    type: Date,
  },
  userType: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
  },
  levelID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Level",
  },
  guardianName: {
    type: String,
  },
  guardianEmail: {
    type: String,
  },
  guardianPhoneNumber: {
    type: String,
  },
  experience: {
    type: String,
  },
  qualification: {
    type: String,
  },
  cv: {
    type: String,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  feesPaid: {
    type: Boolean,
    default: true,
  },
  isAccepted: {
    type: Boolean,
    default: false,
  },
  rollNo: {
    type: String,
  },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
