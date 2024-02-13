const mongoose = require("mongoose");

const classroomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  students: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  teachers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
});

const Classroom = mongoose.model("Classroom", classroomSchema);

module.exports = Classroom;
