const Subject = require("../models/subject");
const Classroom = require("../models/classroom");
const Class = require("../models/class");

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

    // const teacherHasClass = await Class.findOne({
    // "teacher.teacherID": teacher,
    // //   startTime: { $lt: endTime },
    // //   endTime: { $gt: startTime },
    // $expr: {
    //   $and: [
    //     // { $eq: [{ $dayOfWeek: "$startTime" }, { $dayOfWeek: startTime }] },
    //     {
    //       $or: [
    //         { $lt: [{ $hour: "$startTime" }, { $hour: startTime }] },
    //         { $eq: [{ $hour: "$startTime" }, { $hour: startTime }] },
    //       ],
    //       $and: [
    //         { $lt: [{ $hour: "$startTime" }, { $hour: endTime }] },
    //         { $gte: [{ $minute: "$startTime" }, { $minute: startTime }] },
    //       ],
    //     },
    //     {
    //       $and: [
    //         { $gt: [{ $hour: "$endTime" }, { $hour: startTime }] },
    //         { $lte: [{ $minute: "$endTime" }, { $minute: endTime }] },
    //       ],
    //     },
    //   ],
    // },
    // });

    const teacherHasClass = await Class.findOne({
      "teacher.teacherID": teacher,
      $expr: {
        $and: [
          {
            $cond: {
              if: { $eq: ["$oneTime", false] },
              then: {
                $eq: [{ $dayOfWeek: "$startTime" }, { $dayOfWeek: startTime }],
              },
              else: false, // always true when $oneTime is true
            },
          },
          {
            $or: [
              { $gt: [{ $hour: "$endTime" }, { $hour: startTime }] },
              {
                $and: [
                  { $eq: [{ $hour: "$endTime" }, { $hour: startTime }] },
                  { $gt: [{ $minute: "$endTime" }, { $minute: startTime }] },
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
                  { $lt: [{ $minute: "$startTime" }, { $minute: endTime }] },
                ],
              },
            ],
          },
        ],
      },
    });
    if (teacherHasClass) {
      return res.status(400).send("Teacher already has a class at this time");
    }
    return res.status(200).send(teacherHasClass);
    // // check if teacher already has a class at specified time and date or if class is not one time then check if teacher has a class at the same time and day of the week
    // const teacher = data.teacher.teacherID;
    // const startTime = new Date(data.startTime);
    // const endTime = new Date(data.endTime);
    // const teacherHasClass = await Class.findOne({
    //   "teacher.teacherID": teacher,
    //   startTime: { $lt: endTime },
    //   endTime: { $gt: startTime },
    // });
    // if (teacherHasClass) {
    //   return res.status(400).send("Teacher already has a class at this time");
    // }
    // if (!data.oneTime) {
    //   const day = startTime.getDay();
    //   const teacherHasClass = await Class.findOne({
    //     "teacher.teacherID": teacher,
    //     startTime: { $lt: endTime },
    //     endTime: { $gt: startTime },
    //     startTime: { $day: day },
    //   });
    //   if (teacherHasClass) {
    //     return res.status(400).send("Teacher already has a class at this time");
    //   }
    // }

    const classs = new Class({ ...data, createdBy: req.user._id });
    await classs.save();
    return res.status(201).send(classs._doc);
  } catch (err) {
    next(err);
  }
};

exports.getClasses = async (req, res, next) => {
  try {
    const classes = await Class.find();

    return res.status(200).send(classes);
  } catch (err) {
    next(err);
  }
};
