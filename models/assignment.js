const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  totalMarks: {
    type: Number,
    required: true,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  files: [
    {
      type: String,
    },
  ],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  classID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  submittedBy: [
    {
      studentID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      feedback: {
        type: String,
      },
      file: {
        type: String,
      },
      marks: {
        type: Number,
      },
      submittedAt: {
        type: Date,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Assignment = mongoose.model("Assignment", assignmentSchema);

module.exports = Assignment;
