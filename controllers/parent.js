const User = require("../models/user");
const Classroom = require("../models/classroom");
const Assignment = require("../models/assignment");
const Quiz = require("../models/quiz");
const Chatroom = require("../models/chatroom");
const mongoose = require("mongoose");

exports.getStudentReportForParent = async (req, res, next) => {
  try {
    const { studentID } = req.params;
    const { classroomID, subjectID, teacherID } = req.query;

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

exports.getParentChats = async (req, res, next) => {
  try {
    const { studentID } = req.params;

    const classrooms = await Classroom.find({ students: studentID });

    const chatrooms = [];

    // Use for...of loop instead of map to allow proper use of async/await
    for (const classroom of classrooms) {
      for (const teac of classroom.teachers) {
        // Check if the chatroom already exists
        const foundChat = await Chatroom.findOne({
          participants: {
            $all: [teac.teacher, req.user._id].map((id) =>
              mongoose.Types.ObjectId(id)
            ),
          },
        });

        if (!foundChat) {
          // Create a new chatroom if not found
          const chatroom = new Chatroom({
            participants: [teac.teacher, req.user._id].map((id) =>
              mongoose.Types.ObjectId(id)
            ),
            messages: [],
          });
          await chatroom.save();
          chatrooms.push(chatroom);
        } else {
          chatrooms.push(foundChat);
        }
      }
    }

    return res.send(chatrooms);
  } catch (err) {
    next(err);
  }
};

exports.getChildrenOfParent = async (req, res, next) => {
  try {
    const { email } = req.params;

    const parent = await User.findOne({ email }).select("-password");

    if (!parent) next({ message: "User not found" });

    const children = await User.find({ guardianEmail: parent.email }).select(
      "-password"
    );

    res.send(children);
  } catch (error) {
    next(error);
  }
};

exports.getParentChats;
