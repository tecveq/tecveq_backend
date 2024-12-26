const mongoose = require("mongoose");

// Nested Schema for AttendanceSettingMode
const AttendanceSettingModeSchema = new mongoose.Schema({
  enableHeadAttendance: {
    type: Boolean,
    required: true,
    default: false,
  },
});

// Main Schema for AttendanceSetting
const AttendanceSettingsSchema = new mongoose.Schema({
  mode: {
    type: AttendanceSettingModeSchema,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const AttendanceSetting = mongoose.model("AttendanceSetting", AttendanceSettingsSchema);

module.exports = AttendanceSetting;