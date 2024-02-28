const Subject = require("../models/subject");
const Classroom = require("../models/classroom");
const Class = require("../models/class");
const mongoose = require("mongoose");

exports.createClass = async (req, res, next) => {
  try {
    const data = req.body;
    const classroom = await Classroom.findById(data.classroomID);
    if (!classroom) {
      return res.status(400).send("Classroom does not exist");
    }
    const subject = await Subject.findById(data.subjectID);
    if (!subject) {
      return res.status(400).send("Subject does not exist");
    }

    const teacher = data.teacher.teacherID;
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    // check if start time is on weekend
    if (startTime.getDay() === 0 || startTime.getDay() === 6) {
      return res.status(400).send("Class cannot hold on weekend");
    }

    const teacherHasClass = await Class.findOne({
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
    const students = classroom.students;
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
                  { $lt: ["$startTime", "$endTime"] },
                  { $gt: ["$endTime", "$startTime"] },
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

    const classs = new Class({ ...data, createdBy: req.user._id });
    await classs.save();
    return res.status(201).send(classs._doc);
  } catch (err) {
    next(err);
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
                  { $lt: ["$startTime", "$endTime"] },
                  { $gt: ["$endTime", "$startTime"] },
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

exports.getClasses = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // set end date to 1 week from start date
    // let endDate = new Date(startDate);
    // endDate.setDate(endDate.getDate() + 7);
    // endDate = endDate.toISOString();

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
          $and: [{ "teacher.teacherID": userID }],
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
