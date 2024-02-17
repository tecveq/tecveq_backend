const Classroom = require("../models/classroom");
const Subject = require("../models/subject");
const Class = require("../models/class");

exports.createClassroom = async (req, res, next) => {
  try {
    const data = req.body;

    if (
      !data.name ||
      !data.students ||
      !data.teachers ||
      data.students.length < 1 ||
      data.teachers.length < 1
    ) {
      return res.status(400).send("All fields are required");
    }

    const currUser = req.user;

    //check if same name classroom exists in the same level
    const classroomFound = await Classroom.findOne({
      name: data.name,
      levelID: data.levelID,
    });
    if (classroomFound) {
      return res.status(400).send("Classroom already exists");
    }

    //check if user is a teacher
    if (currUser.userType == "teacher") {
      if (!data.subject) {
        return res.status(400).send("Subject is required");
      }
      //check if subject exists
      const subject = await Subject.findOne({ _id: data.subject });
      if (!subject) {
        return res.status(400).send("Subject does not exist");
      }

      data.teachers = [
        {
          teacher: currUser._id,
          subject: data.subject,
        },
      ];
    } else {
      if (!data.levelID) {
        return res.status(400).send("Level is required");
      }
      const students = data.students;
      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        const classroom = await Classroom.findOne({ students: student });
        if (classroom) {
          return res
            .status(400)
            .send("Student is already in another classroom");
        }
      }
      //check if teacher is already in another classroom
      const teachers = data.teachers;
      for (let i = 0; i < teachers.length; i++) {
        const teacher = teachers[i].teacher;
        const classroom = await Classroom.findOne({
          "teachers.teacher": teacher,
        });
        if (classroom) {
          return res
            .status(400)
            .send("Teacher is already in another classroom");
        }
      }
    }

    const classroom = new Classroom({ ...data, createdBy: currUser._id });

    await classroom.save();

    return res.status(201).send(classroom._doc);
  } catch (err) {
    next(err);
  }
};
exports.getClassrooms = async (req, res, next) => {
  try {
    const classroomsWithClasses = await Classroom.aggregate([
      {
        $lookup: {
          from: "users", // Assuming the name of the users collection is "users"
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      {
        $addFields: {
          createdBy: {
            $cond: {
              if: { $isArray: "$createdBy" },
              then: {
                $mergeObjects: [
                  { $arrayElemAt: ["$createdBy", 0] },
                  { password: undefined }, // Exclude the password field
                ],
              },
              else: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: "classes", // Assuming the name of the classes collection is "classes"
          localField: "_id",
          foreignField: "classroomID",
          as: "classes",
        },
      },
    ]);
    res.send(classroomsWithClasses);
  } catch (err) {
    next(err);
  }
};
exports.getClassroomById = async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.id);

    return res.status(200).send(classroom);
  } catch (err) {
    next(err);
  }
};
exports.updateClassroom = async (req, res, next) => {
  try {
    const { name, students, teachers } = req.body;
    // update only if current user is admin or if the classroom was created by the current user
    const currUser = req.user;
    const classroom = await Classroom.findById(req.params.id);
    if (
      (currUser.userType != "admin" && classroom.createdBy != currUser._id) ||
      (currUser.userType == "teacher" && teachers)
    ) {
      return res.status(401).send("Unauthorized");
    }

    // check if same name classroom exists in the same level
    if (name) {
      const classroomFound = await Classroom.findOne({
        name: name,
        levelID: classroom.levelID,
      });
      if (classroomFound) {
        return res.status(400).send("Classroom already exists");
      }
    }

    classroom.name = name ? name : classroom.name;
    classroom.students = students ? students : classroom.students;
    classroom.teachers = teachers ? teachers : classroom.teachers;

    await classroom.save();

    return res.status(200).send(classroom);
  } catch (err) {
    next(err);
  }
};
exports.deleteClassroom = async (req, res, next) => {
  try {
    // delete only if current user is admin or if the classroom was created by the current user
    const currUser = req.user;
    const classroom = await Classroom.findById(req.params.id);
    if (currUser.userType != "admin" && classroom.createdBy != currUser._id) {
      return res.status(401).send("Unauthorized");
    }
    // delete all classes in the classroom
    await Class.deleteMany({ classroomID: req.params.id });
    // delete the classroom
    await Classroom.findByIdAndDelete(req.params.id);

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};
exports.getClassroomsOfTeacher = async (req, res, next) => {
  try {
    const teacherID = req.user._id;

    const classroomsWithClasses = await Classroom.aggregate([
      {
        $lookup: {
          from: "users", // Assuming the name of the users collection is "users"
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      {
        $addFields: {
          createdBy: {
            $cond: {
              if: { $isArray: "$createdBy" },
              then: {
                $mergeObjects: [
                  { $arrayElemAt: ["$createdBy", 0] },
                  { password: undefined }, // Exclude the password field
                ],
              },
              else: null,
            },
          },
        },
      },
      {
        $match: {
          "teachers.teacher": teacherID,
        },
      },
      {
        $lookup: {
          from: "classes", // Assuming the name of the classes collection is "classes"
          localField: "_id",
          foreignField: "classroomID",
          as: "classes",
        },
      },
    ]);

    return res.status(200).send(classroomsWithClasses);
  } catch (err) {
    next(err);
  }
};
