const User = require("../models/user");
const Classroom = require("../models/classroom");
const Assignment = require("../models/assignment");
const Quiz = require("../models/quiz");
const Chatroom = require("../models/chatroom");
const mongoose = require("mongoose");
const Class = require("../models/class");

exports.getStudentReportForParent = async (req, res, next) => {
  try {
    const { studentID } = req.params;
    const { classroomID, subjectID, teacherID } = req.query;

    const user = await User.findById(studentID).select("-password");

    // get assignments and quizes of the student for that classroom of the teacher of the subject
    const classroom = await Classroom.findById(classroomID);
    console.log("classroom is : ", classroomID);
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

    const classes = await Class.find({
      classroomID,
      subjectID
    });

    let avgAssMarksPer = 0;
    let avgQuizMarksPer = 0;
    let avgAttendancePer = 0;
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

    if (classes.length > 0) {
      avgAttendancePer = (
        (classes.reduce(
          (total, classs) =>
            total +
              classs.attendance.find((sub) => sub.studentID.toString() == studentID).isPresent == true ? 1 : 0,
          0
        ) /
          classes.reduce(
            (total, classs) => total + classs.attendance.find((sub) => sub.studentID.toString() == studentID).isPresent == true ? 1 : 1, 0
          )
        ) *
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
      avgAttendancePer,
      assignments: assignments.map((ass) => {
        return {
          totalMarks: ass.totalMarks,
          title: ass.title,
          marksObtained: ass.submissions.find(
            (sub) => sub.studentID.toString() == studentID
          ).marks,
        };
      }),
      quizes: quizes.map((ass) => {
        return {
          totalMarks: ass.totalMarks,
          title: ass.title,
          marksObtained: ass.submissions.find(
            (sub) => sub.studentID.toString() == studentID
          ).marks,
        };
      }),

      attendance: classes.map((cls) => {
        return {
          className: cls.title,
          startTime: cls.startTime,
          endTime: cls.endTime,
          attendancePercentage: cls.attendance.find(
            (att) => att.studentID.toString() == studentID
          )
        }
      })
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

exports.getChilSubjects = async (req, res, next) => {
  try {
    const { studentID } = req.params;

    // Fetch classrooms and populate teachers' subjects and details
    const classrooms = await Classroom.find({ students: studentID })
      .populate("teachers.subject")
      .populate("teachers.teacher");

    // Extract unique subjects, teachers, and classrooms from the data
    const subjects = classrooms.reduce((result, classroom) => {
      if (classroom.teachers && classroom.teachers.length > 0) {
        classroom.teachers.forEach((teacher) => {
          if (teacher.subject) {
            result.push({
              subject: teacher.subject,
              teacher: teacher.teacher,
              classroom: classroom,
            });
          }
        });
      }
      return result;
    }, []);

    // Fetch all classes where the student has attendance records
    const classes = await Class.find({
      attendance: { $elemMatch: { studentID: studentID } },
    });

    // Create a map to track aggregated attendance per subject
    const attendanceMap = new Map();

    // Aggregate attendance records by subject and calculate percentage
    classes.forEach((cls) => {
      const subjectID = cls.subjectID.toString();

      // Initialize attendance data for this subject if not already present
      if (!attendanceMap.has(subjectID)) {
        attendanceMap.set(subjectID, { totalClasses: 0, presentClasses: 0 });
      }

      // Update the aggregated attendance data for the subject
      const attendanceData = attendanceMap.get(subjectID);
      cls.attendance.forEach((record) => {
        if (record.studentID.toString() === studentID.toString()) {
          attendanceData.totalClasses++;
          if (record.isPresent) {
            attendanceData.presentClasses++;
          }
        }
      });
    });

    // Calculate attendance percentage and store in the map
    attendanceMap.forEach((data, subjectID) => {
      data.avgAttendancePer = (
        (data.presentClasses / data.totalClasses) * 100
      ).toFixed(0);
    });

    // Merge attendance data with subjects, avoiding duplication
    const newarr = subjects.map((item) => {
      const subjectData = attendanceMap.get(item.subject._id.toString());
      if (subjectData) {
        // Subject found in attendance records; merge the data
        return { ...item, avgAttendancePer: subjectData.avgAttendancePer };
      } else {
        // Subject not found in attendance records; return as is
        return item;
      }
    });

    // Send the processed subjects as the response
    res.send({ subjects: newarr });
  } catch (err) {
    next(err);
  }
};


exports.getParentChats;
