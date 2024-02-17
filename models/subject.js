const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  levelID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Level",
  },
});

const Subject = mongoose.model("Subject", subjectSchema);

module.exports = Subject;
