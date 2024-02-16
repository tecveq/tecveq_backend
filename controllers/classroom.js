const Classroom = require("../models/classroom");
const Subject = require("../models/subject");

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
      // check if student is already in another classroom
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

    const classroom = new Classroom(data);

    await classroom.save();

    return res.status(201).send(classroom._doc);
  } catch (err) {
    next(err);
  }
};
exports.getClassrooms = async (req, res, next) => {
  try {
    const classrooms = await Classroom.find();

    return res.status(200).send(classrooms);
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
    const classroom = await Classroom.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    return res.status(200).send(classroom._doc);
  } catch (err) {
    next(err);
  }
};
exports.deleteClassroom = async (req, res, next) => {
  try {
    await Classroom.findByIdAndDelete(req.params.id);

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};
