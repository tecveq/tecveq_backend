const Subject = require("../models/subject");
const Classroom = require("../models/classroom");
const Class = require("../models/class");
const Notification = require("../models/notification");
const Attendance = require("../models/attendence");
const User = require("../models/user");

const mongoose = require("mongoose");
const moment = require("moment");
const { createSpace, authorize, getMeetingParticipents } = require("../test-meet");


exports.createClass = async (req, res, next) => {
  try {
    const {
      startTime,
      endTime,
      startEventDate,
      endEventDate,
      classroomID,
      subjectID,
      teacher,
    } = req.body;

    const classroom = await Classroom.findById(classroomID);
    if (!classroom) {
      return res.status(400).json({ error: "Classroom does not exist" });
    }

    const subject = await Subject.findById(subjectID);
    if (!subject) {
      return res.status(400).json({ error: "Subject does not exist" });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (start >= end) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    const startDate = moment(startEventDate);
    const endDate = moment(endEventDate);
    // if (startDate >= endDate) {
    //   return res.status(400).json({ error: "End Date must be after start Date" });
    // }
    const events = [];
    let currentDate = moment(startDate);

    while (currentDate.isSameOrBefore(endDate)) {
      const dayStart = moment(currentDate)
        .set({ hour: start.getHours(), minute: start.getMinutes() })
        .toDate();
      const dayEnd = moment(currentDate)
        .set({ hour: end.getHours(), minute: end.getMinutes() })
        .toDate();

      // Check for conflicts on this specific day
      const teacherConflict = await Class.findOne({
        "teacher.teacherID": teacher.teacherID,
        startTime: { $lt: dayEnd },
        endTime: { $gt: dayStart },
      });

      if (teacherConflict) {
        return res
          .status(400)
          .json({ error: `Teacher has a conflict on ${currentDate.format("YYYY-MM-DD")}` });
      }

      const studentConflict = await Class.findOne({
        classroomID: { $in: classroom.students.map((s) => s.studentID) },
        startTime: { $lt: dayEnd },
        endTime: { $gt: dayStart },
      });

      if (studentConflict) {
        return res
          .status(400)
          .json({ error: `Student has a conflict on ${currentDate.format("YYYY-MM-DD")}` });
      }

      // Store the event
      events.push({
        ...req.body,
        startTime: dayStart,
        endTime: dayEnd,
        createdBy: req.user._id,
      });

      currentDate = currentDate.add(1, "day"); // Move to the next day
    }

    // Bulk save all events
    await Class.insertMany(events);

    return res.status(201).json(events);
  } catch (err) {
    console.error("Error creating class:", err.message, err.stack);
    return res.status(500).json({ error: "An error occurred while creating the class" });
  }
};

exports.rescheduleClass = async (req, res, next) => {
  try {
    const data = req.body;

    const classss = await Class.findById(req.params.id).populate("classroomID");

    if (!classss) {
      return res.status(404).send("Class does not exist");
    }

    const teacher = classss.teacher.teacherID;
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    // check if class start time has passed
    if (startTime < new Date()) {
      return res.status(400).send("Class start time has passed");
    }

    // check if start time is on weekend
    if (startTime.getDay() === 0 || startTime.getDay() === 6) {
      return res.status(400).send("Class cannot hold on weekend");
    }

    const teacherHasClass = await Class.findOne({
      _id: { $ne: req.params.id },
      "teacher.teacherID": teacher,
      $expr: {
        $cond: {
          if: { $eq: ["$oneTime", false] },
          then: {
            $and: [
              {
                $or: [
                  { $gt: [{ $hour: "$endTime" }, { $hour: startTime }] },
                  {
                    $and: [
                      { $eq: [{ $hour: "$endTime" }, { $hour: startTime }] },
                      {
                        $gt: [{ $minute: "$endTime" }, { $minute: startTime }],
                      },
                    ],
                  },
                ],
              },
              {
                $or: [
                  { $lt: [{ $hour: "$startTime" }, { $hour: endTime }] },
                  {
                    $and: [
                      { $eq: [{ $hour: "$startTime" }, { $hour: endTime }] },
                      {
                        $lt: [{ $minute: "$startTime" }, { $minute: endTime }],
                      },
                    ],
                  },
                ],
              },
              {
                $eq: [{ $dayOfWeek: "$startTime" }, { $dayOfWeek: startTime }],
              },
            ],
          },
          else: {
            $and: [
              { $lt: ["$startTime", endTime] },
              { $gt: ["$endTime", startTime] },
            ],
          },
        },
      },
    });
    if (teacherHasClass) {
      return res.status(400).send("Teacher already has a class at this time");
    }

    // check if students of classroomID have class at this time
    const students = classss.classroomID.students;
    const studentsHasClass = await Class.aggregate([
      {
        $lookup: {
          from: "classrooms", // Replace with the actual name of the classrooms collection
          localField: "classroomID",
          foreignField: "_id",
          as: "classroom",
        },
      },
      {
        $match: {
          _id: { $ne: mongoose.Types.ObjectId(req.params.id) },
          "classroom.students": { $in: students },
          $expr: {
            $cond: {
              if: { $eq: ["$oneTime", false] },
              then: {
                $and: [
                  {
                    $or: [
                      { $gt: [{ $hour: "$endTime" }, { $hour: startTime }] },
                      {
                        $and: [
                          {
                            $eq: [{ $hour: "$endTime" }, { $hour: startTime }],
                          },
                          {
                            $gt: [
                              { $minute: "$endTime" },
                              { $minute: startTime },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    $or: [
                      { $lt: [{ $hour: "$startTime" }, { $hour: endTime }] },
                      {
                        $and: [
                          {
                            $eq: [{ $hour: "$startTime" }, { $hour: endTime }],
                          },
                          {
                            $lt: [
                              { $minute: "$startTime" },
                              { $minute: endTime },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    $eq: [
                      { $dayOfWeek: "$startTime" },
                      { $dayOfWeek: startTime },
                    ],
                  },
                ],
              },
              else: {
                $and: [
                  { $lt: ["$startTime", endTime] },
                  { $gt: ["$endTime", startTime] },
                ],
              },
            },
          },
        },
      },
    ]);

    if (studentsHasClass.length > 0) {
      return res.status(400).send("Students already have a class at this time");
    }

    classss.startTime = startTime;
    classss.endTime = endTime;

    await classss.save();

    return res.status(200).send(classss._doc);
  } catch (err) {
    next(err);
  }
};

exports.cancelClass = async (req, res, next) => {
  try {
    // find class by id

    const classs = await Class.findById(req.params.id);
    if (!classs) {
      return res.status(404).send("Class does not exist");
    }
    // check if class start time has passed
    if (classs.startTime < new Date()) {
      return res.status(400).send("Class start time has passed");
    }

    // delete class
    await classs.remove();
    return res.status(200).send(classs._doc);
  } catch (err) {
    next(err);
  }
};

exports.markTeacherPresent = async (req, res, next) => {
  try {

    // find class by id
    const classs = await Class.findByIdAndUpdate(req.params.id, { $set: { "teacher.status": "present" } }, { new: true });

    if (!classs) {
      return res.status(404).send("Class does not exist");
    }

    return res.status(200).send(classs._doc);
  } catch (err) {
    next(err);
  }
};

exports.getClasses = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // set end date to 1 week from start date
    // let endDate = new Date(startDate);
    // endDate.setDate(endDate.getDate() + 7);
    // endDate = endDate.toISOString();
    console.log(startDate, endDate);
    console.log(new Date(startDate), new Date(endDate));

    const date = moment(startDate, moment.ISO_8601, true);

    console.log(date.isValid());

    const userRole = req.user.userType;
    const userId = req.user._id;
    const userID = mongoose.Types.ObjectId(userId); // Replace userId with the actual user ID
    const pipeline = [
      {
        $lookup: {
          from: "classrooms",
          localField: "classroomID",
          foreignField: "_id",
          as: "classroom",
        },
      },
      {
        $unwind: "$classroom",
      },
      {
        $lookup: {
          from: "subjects",
          localField: "subjectID",
          foreignField: "_id",
          as: "subjectID",
        },
      },
      {
        $unwind: "$subjectID",
      },
      {
        $lookup: {
          from: "users", // assuming "users" is the collection name for teachers
          localField: "teacher.teacherID",
          foreignField: "_id",
          as: "teacher.teacherID",
        },
      },
      {
        $unwind: "$teacher.teacherID",
      },
      {
        $match: {
          $expr: {
            $and: [
              {
                $gte: [
                  { $toDate: "$startTime" },
                  { $toDate: new Date(startDate).toDateString() },
                ],
              },
              {
                $lte: [
                  { $toDate: "$endTime" },
                  { $toDate: new Date(endDate).toDateString() },
                ],
              },
            ],
          },
        },
      },
    ];

    // // Match based on user role
    if (userRole === "admin") {
      // If user is admin, return all classes within the date range
      pipeline.push({
        $match: {
          "classroom.students": { $exists: true },
        },
      });
    } else if (userRole === "teacher") {
      // If user is a teacher, return only classes of the teacher within the date range
      pipeline.push({
        $match: {
          "teacher.teacherID._id": userID,
        },
      });
    } else if (userRole === "student") {
      // If user is a student, return only classes of the student within the date range
      pipeline.push({
        $match: {
          "classroom.students": userID,
        },
      });
    }

    // Add any additional pipeline stages as needed

    // Execute the pipeline
    const result = await Class.aggregate(pipeline);

    return res.status(200).send(result);
  } catch (err) {
    next(err);
  }
};

exports.getTodayClasses = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // set end date to 1 week from start date
    // let endDate = new Date(startDate);
    // endDate.setDate(endDate.getDate() + 7);
    // endDate = endDate.toISOString();
    console.log(startDate, endDate);
    console.log(new Date(startDate), new Date(endDate));

    const date = moment(startDate, moment.ISO_8601, true);

    console.log(date.isValid());

    const userRole = req.user.userType;
    const userId = req.user._id;
    const userID = mongoose.Types.ObjectId(userId); // Replace userId with the actual user ID
    const pipeline = [
      {
        $lookup: {
          from: "classrooms",
          localField: "classroomID",
          foreignField: "_id",
          as: "classroom",
        },
      },
      {
        $unwind: "$classroom",
      },
      {
        $lookup: {
          from: "subjects",
          localField: "subjectID",
          foreignField: "_id",
          as: "subjectID",
        },
      },
      {
        $unwind: "$subjectID",
      },
      {
        $lookup: {
          from: "users", // assuming "users" is the collection name for teachers
          localField: "teacher.teacherID",
          foreignField: "_id",
          as: "teacher.teacherID",
        },
      },
      {
        $unwind: "$teacher.teacherID",
      },
      {
        $lookup: {
          from: "users",
          localField: "classroom.students",
          foreignField: "_id",
          as: "classroom.studentdetails",
        },
      },
      // {
      //   $unwind: "$classroom.studentdetails",
      // },
      {
        $match: {
          $expr: {
            $and: [
              {
                $gte: [
                  { $toDate: "$startTime" },
                  { $toDate: new Date(startDate).toDateString() },
                ],
              },
              {
                $lte: [
                  { $toDate: "$endTime" },
                  { $toDate: new Date(endDate).toDateString() },
                ],
              },
            ],
          },
        },
      },
    ];

    // // Match based on user role
    if (userRole === "admin") {
      // If user is admin, return all classes within the date range
      pipeline.push({
        $match: {
          "classroom.students": { $exists: true },
        },
      });
    } else if (userRole === "teacher") {
      // If user is a teacher, return only classes of the teacher within the date range
      pipeline.push({
        $match: {
          "teacher.teacherID._id": userID,
        },
      });
    } else if (userRole === "student") {
      // If user is a student, return only classes of the student within the date range
      pipeline.push({
        $match: {
          "classroom.students": userID,
        },
      });
    }

    // Add any additional pipeline stages as needed

    // Execute the pipeline
    const result = await Class.aggregate(pipeline);

    return res.status(200).send(result);
  } catch (err) {
    next(err);
  }
};



exports.submitAttendence = async (req, res, next) => {
  try {
    const { id } = req.params; // Class ID
    const { data, classroomID } = req.body; // Attendance data submitted by the teacher

    // Fetch the class details
    const studentClass = await Class.findById(id).populate('subjectID');

    console.log(studentClass, "student class details");

    if (!studentClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Update attendance for the class
    await Class.findByIdAndUpdate(id, { attendance: data }, { new: true });

    // Fetch today's start date (ensure it is in UTC)
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)); // Start of the day (00:00:00)
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999)); // End of the day (23:59:59)


    console.log(classroomID, "classroom Id:");


    // Fetch today's head attendance record
    const headAttendance = await Attendance.findOne({
      entityId: classroomID,
      Date: { $gte: todayStart, $lt: todayEnd },
    });

    if (!headAttendance) {
      return res.status(400).json({ message: "No head attendance record found for today" });
    }

    // Compare attendance between head and teacher
    const absentStudents = data
      .filter(student => !student.isPresent)
      .map(student => student.studentID.toString());

    const headPresentStudents = headAttendance.students
      .filter(student => student.isPresent)
      .map(student => student.studentID.toString());

    const discrepancyStudents = absentStudents.filter(student =>
      headPresentStudents.includes(student)
    );

    if (discrepancyStudents.length > 0) {
      // Construct the detailed message for the admin notification
      const classTitle = studentClass.title;
      const subjectName = studentClass.subjectID.name; // Assuming subjectID has a 'name' field

      const admins = await User.findOne({ userType: "admin" });




      const students = await User.find({ _id: { $in: discrepancyStudents } });

      const studentMap = students.reduce((map, student) => {
        map[student._id.toString()] = student.name;
        return map;
      }, {});

      // Step 3: Generate notifications using the lookup map
      const notifications = discrepancyStudents.map(studentID => {
        const studentName = studentMap[studentID] || "Unknown Student";
        return {
          userID: req.user._id, // Admin's User ID
          message: `Student with Id: ${studentID} and Student Name: ${studentName} is marked absent in the class "${classTitle}" for the subject "${subjectName}" but was present in the head attendance.`,
          url: `/students/${studentID}`, // URL to the student's page
          deliveredTo: [`${admins._id}`], // Admin's User ID
        };
      });


      // Send notifications
      await Notification.insertMany(notifications);
    }


    return res.status(200).json({ message: "Class attendance updated successfully!" });
  } catch (error) {
    console.error("Error occurred:", error.message);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

