const passport = require("passport");
const User = require("../models/user");
const Classroom = require("../models/classroom");
const Class = require("../models/class");
const bcrypt = require("bcryptjs");
const Assignment = require("../models/assignment");
const Quiz = require("../models/quiz");

exports.register = async (req, res, next) => {
  try {
    const data = req.body;

    const foundUser = await User.findOne({ email: data.email });

    if (foundUser) {
      return res.status(401).send("User already exists");
    }

    if (data.userType != "student" && data.userType != "teacher") {
      return res.status(400).send("Invalid user type");
    }

    if (
      !data.name ||
      !data.email ||
      !data.password ||
      !data.userType ||
      !data.phoneNumber
    ) {
      return res.status(400).send("All fields are required");
    }

    if (data.userType === "student") {
      if (!data.levelID) {
        return res.status(400).send("Level is required");
      }
      if (
        !data.guardianName ||
        !data.guardianEmail ||
        !data.guardianPhoneNumber
      ) {
        return res.status(400).send("Guardian details are required");
      }
    }

    if (data.userType === "teacher") {
      if (!data.qualification || !data.cv) {
        return res.status(400).send("Qualification and CV are required");
      }
    }

    data["password"] = bcrypt.hashSync(data.password, 8);

    const user = new User(req.body);

    await user.save();

    res.send({ ...user._doc, password: undefined });
  } catch (err) {
    next(err);
  }
};
exports.login = (req, res, next) => {
  passport.authenticate("local", function (err, foundUser, info) {
    if (err) {
      return next(err);
    }
    if (!foundUser) {
      return res.status(400).send(info.message);
    }
    req.logIn(foundUser, function (err) {
      if (err) {
        return next(err);
      }
      return res.send(foundUser);
    });
  })(req, res, next);
};

exports.logout = (req, res) => {
  try {
    req.logout();
    res.send("Logged out");
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, req.body, {
      new: true,
    });

    return res.status(200).send(user._doc);
  } catch (err) {
    next(err);
  }
};

exports.getUsersNotInClassroom = async (req, res, next) => {
  try {
    const { levelID } = req.params;

    const classroomsWithLevel = await Classroom.find({ levelID });

    // Extract user IDs from the classrooms
    const usersInClassroom = classroomsWithLevel.reduce((users, classroom) => {
      users.push(
        ...classroom.students,
        ...classroom.teachers.map((teacher) => teacher.teacher)
      );
      return users;
    }, []);

    // Find users not in any classroom with the given levelID
    const usersNotInClassroom = await User.find({
      $and: [
        { _id: { $nin: usersInClassroom } },
        {
          $or: [
            { userType: { $ne: "student" } },
            { $and: [{ userType: "student" }, { levelID }] },
          ],
        },
      ],
      userType: { $ne: "admin" }, // Exclude users with userType "admin"
    });
    const result = {
      students: usersNotInClassroom.filter(
        (user) => user.userType === "student"
      ),
      teachers: usersNotInClassroom.filter(
        (user) => user.userType === "teacher"
      ),
    };
    res.send(result);
  } catch (error) {
    next(error);
  }
};

exports.getAllStudents = async (req, res, next) => {
  try {
    const users = await User.find({ userType: "student" });
    res.send(users);
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find({ userType: { $ne: "admin" } });
    res.send(users);
  } catch (error) {
    next(error);
  }
};

exports.acceptUser = async (req, res, next) => {
  try {
    const { userID } = req.params;
    const user = await User.findByIdAndUpdate(
      userID,
      { isAccepted: true },
      { new: true }
    );
    res.send(user._doc);
  } catch (error) {
    next(error);
  }
};

exports.rejectUser = async (req, res, next) => {
  try {
    const { userID } = req.params;
    const user = await User.findByIdAndDelete(userID);
    res.send(user._doc);
  } catch (error) {
    next(error);
  }
};

exports.getStudentsOfTeacher = async (req, res, next) => {
  try {
    const { classroomID, subjectID } = req.query;

    const teacherID = req.user._id;

    // apply filters on classrooms if classroomID and subjectID are provided
    // const classrooms = await Classroom.find({
    //   "teachers.teacher": teacherID,
    //   ...(classroomID && { _id: classroomID }),
    //   ...(subjectID && { "teachers.subject": subjectID }),
    // })

    const classrooms = await Classroom.find({
      teachers: {
        $elemMatch: {
          teacher: teacherID,
          ...(subjectID && { subject: subjectID }),
        },
      },
      ...(classroomID && { _id: classroomID }),
    })
      .populate("students")
      .populate("teachers.subject");

    const students = [];

    // finding classes for attendance
    const classes = await Class.find({
      classroomID: { $in: classrooms.map((clas) => clas._id) },
    }).populate("students");

    classrooms.map((clas) => {
      const found = clas.teachers.find(
        (tea) => tea.teacher.toString() == teacherID
      );

      clas.students.map((student) => {
        return students.push({
          ...student._doc,
          classroom: { _id: clas._id, name: clas.name },
          subject: { _id: found.subject._id, name: found.subject.name },
        });
      });
    });

    res.send(students);
  } catch (error) {
    next(error);
  }
};

exports.getStudentReportForTeacher = async (req, res, next) => {
  try {
    const { studentID } = req.params;
    const { classroomID, subjectID } = req.query;
    const teacherID = req.user._id;

    const user = await User.findById(studentID).select("-password");

    // get assignments and quizes of the student for that classroom of the teacher of the subject
    const classroom = await Classroom.findById(classroomID);
    const teacher = classroom.teachers.find(
      (teacher) =>
        teacher.teacher.toString() == teacherID &&
        teacher.subject.toString() == subjectID
    );

    const assignments = await Assignment.find({
      classroomID,
      subjectID: teacher.subject,
      submissions: { $elemMatch: { studentID } },
      submissions: { $elemMatch: { studentID, marks: { $exists: true } } },
    });

    const quizes = await Quiz.find({
      classroomID,
      subjectID: teacher.subject,
      // match studentID and check if teacher has graded the quiz
      submissions: { $elemMatch: { studentID, marks: { $exists: true } } },
    });

    let avgAssMarksPer = 0;
    let avgQuizMarksPer = 0;
    if (assignments.length > 0) {
      avgAssMarksPer = (
        (assignments.reduce(
          (total, assignment) =>
            total +
            assignment.submissions.find((sub) => sub.studentID == studentID)
              .marks,
          0
        ) /
          assignments.reduce(
            (total, assignment) => total + assignment.totalMarks,
            0
          )) *
        100
      ).toFixed(0);
    }
    if (quizes.length > 0) {
      avgQuizMarksPer = (
        (quizes.reduce(
          (total, quiz) =>
            total +
            quiz.submissions.find((sub) => sub.studentID == studentID).marks,
          0
        ) /
          quizes.reduce((total, quiz) => total + quiz.totalMarks, 0)) *
        100
      ).toFixed(0);
    }

    res.send({
      user: user._doc,
      averageAssignmentMarks: {
        percentage: avgAssMarksPer,
        grade:
          avgAssMarksPer > 90
            ? "A"
            : avgAssMarksPer > 80
            ? "B"
            : avgAssMarksPer > 70
            ? "C"
            : avgAssMarksPer > 60
            ? "D"
            : "F",
      },
      averageQuizMarks: {
        percentage: avgQuizMarksPer,
        grade:
          avgQuizMarksPer > 90
            ? "A"
            : avgQuizMarksPer > 80
            ? "B"
            : avgQuizMarksPer > 70
            ? "C"
            : avgQuizMarksPer > 60
            ? "D"
            : "F",
      },
      assignments: assignments.map((ass) => {
        return {
          totalMarks: ass.totalMarks,
          marksObtained: ass.submissions.find(
            (sub) => sub.studentID.toString() == studentID
          ).marks,
        };
      }),
      quizes: quizes.map((ass) => {
        return {
          totalMarks: ass.totalMarks,
          marksObtained: ass.submissions.find(
            (sub) => sub.studentID.toString() == studentID
          ).marks,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};
