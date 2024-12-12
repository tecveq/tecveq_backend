const Class = require("../models/class");
const Attendance = require("../models/attendence"); // Import the Attendance model
const Classroom = require("../models/classroom");

exports.createAttendence = async (req, res, next) => {
    const { id } = req.params;
    const { data } = req.body;

    console.log(id, "class id is");

    try {
        const attendanceRecord = new Attendance({
            entityId: id,
            entityType: "classroom",
            Date: new Date(),
            students: data.map(student => ({
                studentID: student.studentID,
                isPresent: student.isPresent,
                late: student.late,
            })),
        });

        // Check if attendance for this class and date already exists
        const existingAttendance = await Attendance.findOne({
            entityId: id,
            Date: { $gte: new Date().setHours(0, 0, 0, 0) }, // Check for attendance marked today
        });

        if (existingAttendance) {
            return res.status(400).json({ message: "Attendance has already been marked for today" });
        }

        await attendanceRecord.save();

        return res.status(201).json({ message: "Attendance created successfully" });
    } catch (error) {
        next(error);
    }
};



