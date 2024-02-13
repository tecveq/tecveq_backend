const mongoose = require("mongoose");

const classSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  oneTime: {
    type: Boolean,
    required: true,
  },
  classroomID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true,
  },
  teacherStatus: {
    type: String,
    required: true,
    enum: ["present", "absent", "leave"],
  },
  attendance: [
    {
      studentID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      isPresent: {
        type: Boolean,
      },
    },
  ],
});

const Class = mongoose.model("Class", classSchema);

module.exports = Class;
