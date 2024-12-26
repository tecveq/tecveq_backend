const Subject = require("../models/subject");
const Classroom = require("../models/classroom");
const Class = require("../models/class");
const Notification = require("../models/notification");
const Attendance = require("../models/attendence");
const User = require("../models/user");
const AttendanceSettingsSchema = require("../models/settingsModel");

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
      selectedDays, // Array of selected days like ["Monday", "Wednesday", "Friday"]
    } = req.body;

    // Validate classroom
    const classroom = await Classroom.findById(classroomID);
    if (!classroom) {
      return res.status(400).json({ error: "Classroom does not exist" });
    }

    // Validate subject
    const subject = await Subject.findById(subjectID);
    if (!subject) {
      return res.status(400).json({ error: "Subject does not exist" });
    }

    console.log(startTime, "startTime", endTime, "endTime");

    // Validate times
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (start >= end) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    // Convert start and end event dates to moment objects

    const startDate = moment(startEventDate);
    const endDate = moment(endEventDate);

    if (startDate.isAfter(endDate)) {
      return res.status(400).json({ error: "End Date must be after Start Date" });
    }

    const dayMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    // Validate selected days

    if (!Array.isArray(selectedDays) || selectedDays.length === 0) {
      return res.status(400).json({ error: "Please select at least one day." });
    }

    const selectedDayNumbers = selectedDays.map(day => dayMap[day]);

    const events = [];
    let currentDate = moment(startDate);

    const isMultiDay = !moment(startDate).isSame(endDate, 'day');
    const groupID = isMultiDay ? new mongoose.Types.ObjectId() : null;

    // Loop through dates and create classes only on selected days

    while (currentDate.isSameOrBefore(endDate)) {
      if (selectedDayNumbers.includes(currentDate.day())) {
        const dayStart = moment(currentDate)
          .set({ hour: start.getHours(), minute: start.getMinutes() })
          .toDate();

        const dayEnd = moment(currentDate)
          .set({ hour: end.getHours(), minute: end.getMinutes() })
          .toDate();

        // Check for teacher conflicts on this specific day
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

        // Check for student conflicts on this specific day
        const studentConflict = await Class.findOne({
          classroomID: { $in: classroom.students.map(s => s.studentID) },
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
          groupID: groupID,
          createdBy: req.user._id,
        });
      }

      // Move to the next day
      currentDate = currentDate.add(1, "day");
    }

    if (events.length === 0) {
      return res.status(400).json({ error: "No valid classes were scheduled. Please check your selected days." });
    }

    // Bulk save all events
    await Class.insertMany(events);

    return res.status(201).json(events);
  } catch (err) {
    console.error("Error creating class:", err.message, err.stack);
    return res.status(500).json({ error: "An error occurred while creating the class" });
  }
};


exports.updateClass = async (req, res, next) => {
  try {
    const {
      classID,
      startTime,
      endTime,
      startEventDate,
      endEventDate,
      updateSeries, // boolean value true /false
    } = req.body;

    // Validate class
    const existingClass = await Class.findById(classID);
    if (!existingClass) {
      return res.status(404).json({ error: "Class not found" });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);



    const startDate = moment(startEventDate);
    const endDate = moment(startEventDate);

    const updatedStartTime = moment(start)
      .set({
        year: startDate.year(),
        month: startDate.month(),
        date: startDate.date(),
      })
      .toISOString();

    const updatedEndTime = moment(end)
      .set({
        year: startDate.year(),
        month: startDate.month(),
        date: startDate.date(),
      })
      .toISOString();

    // Handle group updates
    if (existingClass.groupID) {
      if (updateSeries) {
        const existingClasses = await Class.find({ groupID: existingClass.groupID });

        existingClasses.forEach(async (cls) => {
          const startDate = new Date(cls.startTime); // Get the existing startTime
          const endDate = new Date(cls.endTime);     // Get the existing endTime

          // Extract date parts
          const startDateOnly = startDate.toISOString().split('T')[0]; // Get only the date
          const endDateOnly = endDate.toISOString().split('T')[0];

          // Format new time
          const newStartTime = `${startDateOnly}T${start.toISOString().split('T')[1]}`;
          const newEndTime = `${endDateOnly}T${end.toISOString().split('T')[1]}`;

          // Update the document
          await Class.updateOne(
            { _id: cls._id },
            {
              startTime: new Date(newStartTime),
              endTime: new Date(newEndTime),
            }
          );
        });

        return res.status(200).json({ message: "All classes updated successfully" });
      } else {
        // Update only the current class
        existingClass.startTime = start;
        existingClass.endTime = end;
        await existingClass.save();
        return res.status(200).json({ message: "Single class updated successfully" });
      }
    } else {
      // Update single class (no groupID)
      existingClass.startTime = updatedStartTime;
      existingClass.endTime = updatedEndTime;
      existingClass.startEventDate = startDate;
      existingClass.endEventDate = startDate; // Same as startEventDate
      await existingClass.save();
      return res.status(200).json({
        data: existingClass,
        message: "Single class updated successfully"
      });
    }
  } catch (err) {
    console.error("Error updating class:", err.message, err.stack);
    return res.status(500).json({ error: "An error occurred while updating the class" });
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
    const { data, classroomID, startTime } = req.body; // Attendance data submitted by the teacher

    // Fetch the class details
    const studentClass = await Class.findById(id).populate('subjectID');


    if (!studentClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Update attendance for the class
    await Class.findByIdAndUpdate(id, { attendance: data }, { new: true });


    const settings = await AttendanceSettingsSchema.findOne()

    if (!settings) {
      console.log("No settings found.");
      return;
    }

    const enableHeadAttendance = settings.mode.enableHeadAttendance;


    if (enableHeadAttendance) {
      const todayStart = new Date(startTime).setHours(0, 0, 0, 0); // Start of the day (00:00:00)
      const todayEnd = new Date(startTime).setHours(23, 59, 59, 999); // End of the day (23:59:59)

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



        // Fetch students and their guardians

        const students = await User.find({
          _id: { $in: discrepancyStudents },
        });

        //  Create a map of student names and extract guardian IDs

        const studentMap = students.reduce((map, student) => {
          map[student._id.toString()] = student.name;
          return map;
        }, {});

        // Extract guardian IDs from the student records

        const guardianIds = students
          .filter(student => student.guardianId) // Ensure the student has a guardianId
          .map(student => student.guardianId.toString());

        //  Combine admin ID with unique guardian IDs

        const deliveredTo = [admins?._id, ...new Set(guardianIds)]; // Use `Set` to avoid duplicate IDs

        //  Generate notifications using the lookup map

        const notifications = discrepancyStudents.map(studentID => {
          const studentName = studentMap[studentID] || "Unknown Student";
          return {
            userID: req.user._id, // Admin's User ID
            message: ` Student ${studentName} (Id: ${studentID}) is marked absent in the class "${classTitle}" for the subject "${subjectName}" but was present earlier in the head attendance.`,
            url: `/students/${studentID}`, // URL to the student's page
            deliveredTo: deliveredTo, // Deliver to admin and guardians
          };
        });

        // Send notifications
        await Notification.insertMany(notifications);
      }

    }
    // Fetch today's start date (ensure it is in UTC)


    return res.status(200).json({ message: "Class attendance updated successfully!" });
  } catch (error) {
    console.error("Error occurred:", error.message);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

