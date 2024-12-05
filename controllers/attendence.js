const Class = require("../models/class");
const Attendance = require("../models/attendence"); // Import the Attendance model

exports.createAttendence = async (req, res, next) => {
    const { id } = req.params;
    const { data } = req.body; 

    console.log(id, "class id is");

    try {
        const classSession = await Class.findOne({ classroomID: id });

        if (!classSession) {
            return res.status(404).json({ message: "Class session not found" });
        }

        // Check if attendance for this class and date already exists
        const existingAttendance = await Attendance.findOne({
            entityId: classSession._id,
            Date: { $gte: new Date().setHours(0, 0, 0, 0) }, // Check for attendance marked today
        });

        if (existingAttendance) {
            return res.status(400).json({ message: "Attendance has already been marked for today" });
        }

        // Proceed with creating the attendance record if no existing attendance is found
        const attendanceRecord = new Attendance({
            entityId: classSession._id,
            entityType: "classroom",
            Date: new Date(),
            students: data.map(student => ({
                studentID: student.studentID,
                isPresent: student.isPresent,
                late: student.late,
            })),
        });

        await attendanceRecord.save();

        return res.status(201).json({ message: "Attendance created successfully" });
    } catch (error) {
        next(error);
    }
};



