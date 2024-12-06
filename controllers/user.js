const passport = require("passport");
const User = require("../models/user");
const Classroom = require("../models/classroom");
const Class = require("../models/class");
const bcrypt = require("bcryptjs");
const Assignment = require("../models/assignment");
const Quiz = require("../models/quiz");
const Device = require("../models/devices");
const mongoose = require("mongoose");
const Activity = require("../models/activities");
const Level = require("../models/level");

exports.register = async (req, res, next) => {
  try {
    const data = req.body;

    // Check if the user already exists
    const foundUser = await User.findOne({ email: data.email });
    if (foundUser) {
      return res.status(401).send("User already exists");
    }

    // Validate userType
    if (data.userType !== "student" && data.userType !== "teacher") {
      return res.status(400).send("Invalid user type");
    }

    // Validate required fields
    if (!data.name || !data.email || !data.password || !data.userType || !data.phoneNumber) {
      return res.status(400).send("All fields are required");
    }

    // Additional validations for student
    if (data.userType === "student") {
      if (!data.levelID) {
        return res.status(400).send("Level is required");
      }
      if (!data.guardianName || !data.guardianEmail || !data.guardianPhoneNumber) {
        return res.status(400).send("Guardian details are required");
      }
    }

    // Optional fields for teacher
    // if (data.userType === "teacher") {
    //   if (!data.qualification || !data.cv) {
    //     return res.status(400).send("Qualification and CV are required");
    //   }
    // }

    // Hash password
    data["password"] = bcrypt.hashSync(data.password, 8);

    // Save user data
    const user = new User(data);
    await user.save();

    // Create parent account for student
    if (data.userType === "student") {
      const parent = await User.findOne({ email: data.guardianEmail });
      if (!parent) {
        const parentAccount = new User({
          name: data.guardianName,
          email: data.guardianEmail,
          password: bcrypt.hashSync("123456", 8),
          userType: "parent",
          phoneNumber: data.guardianPhoneNumber,
        });
        await parentAccount.save();
      }
    }

    res.send({ ...user._doc, password: undefined });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  passport.authenticate("local", async function (err, foundUser, info) {
    if (err) {
      return next(err);
    }
    if (!foundUser) {
      return res.status(400).send(info.message);
    }

    try {
      // Assuming `levelId` is stored in foundUser
      const level = await Level.findOne(foundUser.levelId).lean();
      const levelName = level ? level.name : null;

      console.log(levelName , "level name is ");
      

      req.logIn(foundUser, function (err) {
        if (err) {
          return next(err);
        }
        // Attach levelName to the response
        return res.send({
          ...foundUser.toObject(), // Convert Mongoose document to plain object
          levelName,
        });
      });
    } catch (fetchError) {
      return next(fetchError);
    }
  })(req, res, next);
};

exports.logout = (req, res, next) => {
  try {
    req.logout((err) => {
      if (err) {
        next(err);
      }
    });
    res.send("Logged out");
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    if (req.body.email) {
      // email is not allowed to be updated
      delete req.body.email;
    }

    if (req.body.guardianEmail) {
      // guardian email is not allowed to be updated
      delete req.body.guardianEmail;
    }

    const user = await User.findByIdAndUpdate(req.user._id, req.body, {
      new: true,
    });

    return res.status(200).send(user._doc);
  } catch (err) {
    next(err);
  }
};

exports.getUsersNotInClassroom = async (req, res, next) => {
  // console.log(req.user);
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
    // console.log(userID);
    const user = await User.findByIdAndUpdate(
      userID,
      { isAccepted: true },
      { new: true }
    );
    res.send(user?._doc);
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
    // const { classroomID, subjectID } = req.query;

    const teacherID = req.user._id;

    const classrooms = await Classroom.find({
      teachers: {
        $elemMatch: {
          teacher: teacherID,
          // ...(subjectID && { subject: subjectID }),
        },
      },
      // ...(classroomID && { _id: classroomID }),
    })
      .populate("students")
      .populate("teachers.subject");

    const students = [];

    // finding classes for attendance
    // const classes = await Class.find({
    //   classroomID: { $in: classrooms.map((clas) => clas._id) },
    // }).populate("students");

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

    const pipeline = [
      {
        $match: {
          classroomID: mongoose.Types.ObjectId(classroomID),
          subjectID: mongoose.Types.ObjectId(subjectID),
        },
      },
      {
        $project: {
          matchedAttendance: {
            $filter: {
              input: "$attendance",
              as: "attendance",
              cond: {
                $eq: ["$$attendance.studentID", mongoose.Types.ObjectId(studentID)],
              },
            },
          },
          title: 1,
          startTime: 1,
          endTime: 1,
          createdBy: 1,
          oneTime: 1,
          classroomID: 1,
          subjectID: 1,
          teacher: 1,
          meetLink: 1,
        },
      },
    ];


    const classes = await Class.aggregate(pipeline);

    // console.log("classes are : ", classes);

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

    let avgAttendencePer = 0;
    let avgAssMarksPer = 0;
    let avgQuizMarksPer = 0;

    if (classes.length > 0) {
      let presentCount = 0;
      let absentCount = 0;
      classes.map((item) => {
        if (item.matchedAttendance.length > 0) {
          if (item.matchedAttendance[0].isPresent) {
            presentCount++
          } else {
            absentCount++;
          }
        }
      })
      avgAttendencePer = (presentCount / classes.length) * 100;
    }
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
          feedback: ass.submissions.find(
            (sub) => sub.studentID.toString() == studentID
          ).feedback,
        };
      }),
      quizes: quizes.map((ass) => {
        return {
          totalMarks: ass.totalMarks,
          marksObtained: ass.submissions.find(
            (sub) => sub.studentID.toString() == studentID
          ).marks,
          feedback: ass.submissions.find(
            (sub) => sub.studentID.toString() == studentID
          ).feedback,
        };
      }),
      attendance: { classes, avgAttendencePer }
    });
  } catch (error) {
    next(error);
  }
};

exports.getStudentGradesForSubject = async (req, res, next) => {
  try {
    // get subjectID from params
    const { subjectID, studentID } = req.params;

    const userAssignmentsAndQuizzes = await Classroom.aggregate([
      {
        $match: {
          students: mongoose.Types.ObjectId(studentID),
        },
      },
      {
        $lookup: {
          from: "assignments",
          localField: "_id",
          foreignField: "classroomID",
          as: "assignments",
        },
      },
      {
        $lookup: {
          from: "quizzes",
          localField: "_id",
          foreignField: "classroomID",
          as: "quizzes",
        },
      },
      {
        $unwind: {
          path: "$assignments",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: "$quizzes",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $match: {
          $or: [
            {
              "assignments.submissions.marks": { $exists: true, $ne: null },
              "assignments.subjectID": mongoose.Types.ObjectId(subjectID),
            },
            {
              "quizzes.submissions.marks": { $exists: true, $ne: null },
              "quizzes.subjectID": mongoose.Types.ObjectId(subjectID),
            }]
        },
      },
      {
        $group: {
          _id: null,
          assignments: {
            $addToSet: {
              _id: "$assignments._id",
              totalMarks: "$assignments.totalMarks",
              obtainedMarks: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: "$assignments.submissions",
                          as: "submission",
                          cond: {
                            $eq: [
                              "$$submission.studentID",
                              mongoose.Types.ObjectId(studentID),
                            ],
                          },
                        },
                      },
                      as: "submission",
                      in: "$$submission.marks",
                    },
                  },
                  0,
                ],
              },
              grade: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: "$assignments.submissions",
                          as: "submission",
                          cond: {
                            $eq: [
                              "$$submission.studentID",
                              mongoose.Types.ObjectId(studentID),
                            ],
                          },
                        },
                      },
                      as: "submission",
                      in: "$$submission.grade",
                    },
                  },
                  0,
                ],
              },
            },
          },
          quizzes: {
            $addToSet: {
              _id: "$quizzes._id",
              totalMarks: "$quizzes.totalMarks",
              obtainedMarks: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: "$quizzes.submissions",
                          as: "submission",
                          cond: {
                            $eq: [
                              "$$submission.studentID",
                              mongoose.Types.ObjectId(studentID),
                            ],
                          },
                        },
                      },
                      as: "submission",
                      in: "$$submission.marks",
                    },
                  },
                  0,
                ],
              },
              grade: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: "$quizzes.submissions",
                          as: "submission",
                          cond: {
                            $eq: [
                              "$$submission.studentID",
                              mongoose.Types.ObjectId(studentID),
                            ],
                          },
                        },
                      },
                      as: "submission",
                      in: "$$submission.grade",
                    },
                  },
                  0,
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          assignments: 1,
          quizzes: 1,
        },
      },
    ]);



    const pipeline = [
      {
        $match: {
          // classroomID: mongoose.Types.ObjectId(classroomID),
          subjectID: mongoose.Types.ObjectId(subjectID),
        },
      },
      {
        $project: {
          matchedAttendance: {
            $filter: {
              input: "$attendance",
              as: "attendance",
              cond: {
                $eq: ["$$attendance.studentID", mongoose.Types.ObjectId(studentID)],
              },
            },
          },
          title: 1,
          startTime: 1,
          endTime: 1,
          createdBy: 1,
          oneTime: 1,
          classroomID: 1,
          subjectID: 1,
          teacher: 1,
          meetLink: 1,
        },
      },
    ];


    const classes = await Class.aggregate(pipeline);


    // console.log("data is : ", userAssignmentsAndQuizzes[0]);

    let avgAttendencePer = 0;
    let avgQuizMarksPer = 0;
    let avgAssMarksPer = 0;

    if (classes.length > 0) {
      let presentCount = 0;
      let absentCount = 0;
      classes.map((item) => {
        if (item.matchedAttendance.length > 0) {
          if (item.matchedAttendance[0].isPresent) {
            presentCount++
          } else {
            absentCount++;
          }
        }
      })
      avgAttendencePer = (presentCount / classes.length) * 100;
    }

    if (userAssignmentsAndQuizzes.length > 0) {
      if (userAssignmentsAndQuizzes[0].quizzes.length > 0) {

        // avgQuizMarksPer =
        // (userAssignmentsAndQuizzes[0].quizzes.reduce(
        //     (total, assignment) => total + assignment.obtainedMarks,
        //     0
        //   ) /
        //   userAssignmentsAndQuizzes[0].quizzes.reduce(
        //     (total, assignment) => total + assignment.totalMarks,
        //     0
        //   )) *
        //   100;

        const totalObtainedMarks = userAssignmentsAndQuizzes[0].quizzes.reduce(
          (total, assignment) => total + (assignment.obtainedMarks || 0),
          0
        );

        const totalMarks = userAssignmentsAndQuizzes[0].quizzes.reduce(
          (total, assignment) => total + (assignment.totalMarks || 0),
          0
        );

        avgQuizMarksPer = (totalObtainedMarks / totalMarks) * 100;

        // console.log(" assignment marks per are : ", avgQuizMarksPer);

      }
      if (userAssignmentsAndQuizzes[0].assignments.length > 0) {

        // avgAssMarksPer =
        //   (userAssignmentsAndQuizzes[0].assignments.reduce(
        //     (total, assignment) => total + assignment.obtainedMarks,
        //     0
        //   ) /
        //     userAssignmentsAndQuizzes[0].assignments.reduce(
        //       (total, assignment) => total + assignment.totalMarks,
        //       0
        //     )) *
        //   100;
        const totalObtainedMarks = userAssignmentsAndQuizzes[0].assignments.reduce(
          (total, assignment) => total + (assignment.obtainedMarks || 0),
          0
        );

        const totalMarks = userAssignmentsAndQuizzes[0].assignments.reduce(
          (total, assignment) => total + (assignment.totalMarks || 0),
          0
        );

        avgAssMarksPer = (totalObtainedMarks / totalMarks) * 100;

      }

    }


    res.send({
      quizes: {
        data:
          userAssignmentsAndQuizzes.length > 0
            ? userAssignmentsAndQuizzes[0].quizzes
            : [],
        avgMarksPer: avgQuizMarksPer.toFixed(0),
        avgGrade:
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
      assignments: {
        data:
          userAssignmentsAndQuizzes.length > 0
            ? userAssignmentsAndQuizzes[0].assignments
            : [],
        avgMarksPer: avgAssMarksPer.toFixed(0),
        avgGrade:
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
      attendance: { avgAttendencePer, classes }
    });
  } catch (err) {
    next(err);
  }
};

exports.getStudentSubjects = async (req, res, next) => {
  try {
    const { studentID } = req.params;

    const student = await User.findById(studentID);

    const classrooms = await Classroom.find({ students: student._id })
      .populate("teachers.subject")
      .populate("teachers.teacher");

    const subjects = classrooms.reduce((result, classroom) => {
      if (classroom.teachers && classroom.teachers.length > 0) {
        classroom.teachers.forEach((teacher) => {
          if (teacher.subject) {
            result.push({
              subject: teacher.subject,
              teacher: teacher.teacher.name,
            });
          }
        });
      }
      return result;
    }, []);



    const classes = await Class.find({
      attendance: { $elemMatch: { studentID: studentID } }
    });

    let matched = false;

    let newarr = [];
    subjects.map((item) => {
      classes.map((cls) => {

        if (cls.subjectID.toString() == item.subject._id.toString()) {

          let avgAttendancePer = (
            (classes.reduce((total, classs) => {
              const attendanceRecord = classs.attendance.find(
                (sub) => sub.studentID.toString() === studentID.toString()
              );
              return total + (attendanceRecord && attendanceRecord.isPresent ? 1 : 0);
            }, 0) /
              classes.reduce((total, classs) => {
                const attendanceRecord = classs.attendance.find(
                  (sub) => sub.studentID.toString() === studentID.toString()
                );
                // Count the class if the attendance record for this student exists
                return total + (attendanceRecord ? 1 : 0);
              }, 0)) *
            100
          ).toFixed(0);

          let myobj = { ...item, classs: cls, avgAttendancePer }
          matched = true;
          newarr.push(myobj);
        }
      });
      if (matched) {
        matched = false;
      } else {
        newarr.push(item);
      }
    })

    console.log("new array is : ", newarr);

    res.send({ subjects: newarr });
  } catch (err) {
    next(err);
  }
};

exports.getTeachersForAdmin = async (req, res, next) => {
  try {
    const teachers = await User.find({ userType: "teacher" });
    const classrooms = await Classroom.find({})
      .populate("teachers.subject")
      .populate("teachers.teacher");

    const classes = await Class.find({});

    // teachers.forEach((teach) => {
    //   let teacharr = classes.filter((c) => c.teacher.teacherID.toString() == teach._id.toString());
    //   if (teacharr.length > 0) {
    //     let count = teacharr.reduce((acum, resul) => (resul.teacher.status == "present"? acum.presents = acum.presents + 1 : acum.presents, acum) ,{presents: 0})
    //     console.log(count);
    //   }
    // })

    // get all assignments and quizes of the teacher
    let assignments = await Assignment.find({
      createdBy: { $in: teachers.map((tea) => tea._id) },
      submissions: { $elemMatch: { marks: { $exists: true } } },
    });
    let quizes = await Quiz.find({
      createdBy: { $in: teachers.map((tea) => tea._id) },
      submissions: { $elemMatch: { marks: { $exists: true } } },
    });

    quizes = quizes.map((ass) => {
      const marks =
        (ass.submissions.reduce((total, sub) => {
          return total + sub.marks;
        }, 0) /
          ass.totalMarks /
          ass.submissions.length) *
        100;

      return {
        ...ass._doc,
        average: {
          percentage: marks,
          grade: marks > 90 ? "A" : "B",
        },
      };
    });

    assignments = assignments.map((ass) => {
      const marks =
        (ass.submissions.reduce((total, sub) => {
          return total + sub.marks;
        }, 0) /
          ass.totalMarks /
          ass.submissions.length) *
        100;

      return {
        ...ass._doc,
        average: {
          percentage: marks,
          grade: marks > 90 ? "A" : "B",
        },
      };
    });


    // push all assignments and quize to specific teacher in teachers in classroom
    const teachersInClassroom = classrooms.reduce((result, classroom) => {
      classroom.teachers.forEach((teacher) => {
        if (!result[teacher?.teacher?._id]) {
          result[teacher?.teacher?._id] = [];
        }

        let classData = classes.filter((c) => {
          return (
            c.teacher?.teacherID.toString() == teacher?.teacher?._id.toString() &&
            c.classroomID == classroom?._id?.toString()
          )
        });
        let attendnececount = {};
        attendnececount = classData.reduce((acum, resul) => (resul.teacher.status == "present" ? acum.presents = acum.presents + 1 : acum.presents, acum), { presents: 0 })
        // console.log(attendnececount);

        let ass = assignments.filter((a) => {
          return (
            a.createdBy.toString() == teacher?.teacher?._id.toString() &&
            a.classroomID.toString() == classroom?._id.toString()
          );
        });

        let ass2 =
          ass.reduce((total, asi) => {
            return total + asi.average.percentage;
          }, 0) / ass.length;

        let qui = quizes.filter((a) => {
          return (
            a.createdBy.toString() == teacher?.teacher?._id.toString() &&
            a.classroomID.toString() == classroom?._id.toString()
          );
        });

        let qui2 =
          qui.reduce((total, asi) => {
            return total + asi.average.percentage;
          }, 0) / qui.length;

        result[teacher?.teacher?._id].push({
          attendence: {
            classData,
            attendnececount
          },
          assignments: {
            count: ass.length,
            percentage: ass2,
            grade: ass2 > 90 ? "A" : "B",
          },
          quizes: {
            count: qui.length,
            percentage: qui2,
            grade: qui2 > 90 ? "A" : "B",
          },
          subject: teacher.subject,
          teacher: teacher.teacher,
        });
      });
      return result;
    }, {});

    return res.send(teachersInClassroom);

    // group assignments by createdBy and classroomID
    // const groupedAssignments = assignments.reduce((result, assignment) => {
    //   if (!result[assignment.createdBy]) {
    //     result[assignment.createdBy] = {};
    //   }
    //   if (!result[assignment.createdBy][assignment.classroomID]) {
    //     result[assignment.createdBy][assignment.classroomID] = [];
    //   }
    //   result[assignment.createdBy][assignment.classroomID].push(assignment);
    //   return result;
    // }, {});
    // // group quizes by createdBy and classroomID
    // const groupedQuizes = quizes.reduce((result, quiz) => {
    //   if (!result[quiz.createdBy]) {
    //     result[quiz.createdBy] = {};
    //   }
    //   if (!result[quiz.createdBy][quiz.classroomID]) {
    //     result[quiz.createdBy][quiz.classroomID] = [];
    //   }
    //   result[quiz.createdBy][quiz.classroomID].push(quiz);
    //   return result;
    // }, {});

    // res.send({ groupedAssignments, groupedQuizes });
  } catch (err) {
    console.log("error while getting all teacher si : ", err);
    next(err);
  }
};

// fazool function he yeh
exports.getStudentReportsForAdmin = async (req, res, next) => {
  try {
    const { studentID } = req.params;

    const student = await User.findById(studentID);

    if (!student) {
      return res.status(404).send("Student not found");
    }

    // get all classrooms of student

    const classroomsWithAssignmentsAndQuizes = await Classroom.aggregate([
      {
        $match: {
          students: mongoose.Types.ObjectId(studentID),
        },
      },
      {
        $lookup: {
          from: "assignments", // Assuming the name of the assignments collection is "assignments"
          localField: "_id",
          foreignField: "classroomID",
          as: "assignments",
        },
      },
      {
        $lookup: {
          from: "quizzes", // Assuming the name of the quizzes collection is "quizzes"
          localField: "_id",
          foreignField: "classroomID",
          as: "quizzes",
        },
      },

      {
        $addFields: {
          assignments: {
            $filter: {
              input: "$assignments",
              as: "assignment",
              cond: { $ifNull: ["$$assignment.submissions.marks", false] },
            },
          },
          quizzes: {
            $filter: {
              input: "$quizzes",
              as: "quiz",
              cond: { $ifNull: ["$$quiz.submissions.marks", false] },
            },
          },
        },
      },
    ]);

    // console.log("report for admin is : ", classroomsWithAssignmentsAndQuizes[0]);

    // get activities of student
    const activities = await Activity.find({ userID: studentID });

    return res.send({ classroomsWithAssignmentsAndQuizes, activities });
  } catch (err) {
    next(err);
  }
};

// update user by admin
exports.updateUserByAdmin = async (req, res, next) => {
  try {
    const { userID } = req.params;
    const user = await User.findByIdAndUpdate(userID, req.body, {
      new: true,
    });
    res.send(user);
  } catch (err) {
    next(err);
  }
};

// delete user by admin
exports.deleteUserByAdmin = async (req, res, next) => {
  try {
    const { userID } = req.params;
    const user = await User.findByIdAndDelete(userID);
    res.send(user);
  } catch (err) {
    next(err);
  }
};

// subscribe to notifications
exports.subscribeToNotifications = async (req, res, next) => {
  try {
    const currUser = req.user;
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).send("fcmToken is required");
    }

    const foundDevice = await Device.findOne({
      userID: currUser._id,
      fcmToken,
    });

    if (foundDevice) {
      return res.status(200).send(foundDevice);
    }

    const device = new Device({ fcmToken, userID: currUser._id });

    await device.save();

    return res.status(200).send(device);
  } catch (err) {
    next(err);
  }
};

exports.getStudentSubjectsForStudent = async (req, res, next) => {
  try {
    const studentID = req.user._id;

    const classrooms = await Classroom.find({ students: studentID })
      .populate("teachers.subject")
      .populate("teachers.teacher");

    const subjects = classrooms.reduce((result, classroom) => {
      if (classroom.teachers && classroom.teachers.length > 0) {
        classroom.teachers.forEach((teacher) => {
          if (teacher.subject) {
            result.push({
              subject: teacher.subject,
              teacher: teacher.teacher.name,
            });
          }
        });
      }
      return result;
    }, []);

    res.send(subjects);
  } catch (err) {
    next(err);
  }
};

exports.getStudentGradesForSubjectForStudent = async (req, res, next) => {
  try {
    // get subjectID from params
    const { subjectID } = req.params;
    const studentID = req.user._id;

    const userAssignmentsAndQuizzes = await Classroom.aggregate([
      {
        $match: {
          students: mongoose.Types.ObjectId(studentID),
        },
      },
      {
        $lookup: {
          from: "assignments",
          localField: "_id",
          foreignField: "classroomID",
          as: "assignments",
        },
      },
      {
        $lookup: {
          from: "quizzes",
          localField: "_id",
          foreignField: "classroomID",
          as: "quizzes",
        },
      },
      {
        $unwind: {
          path: "$assignments",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$quizzes",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $match: {
          $or: [
            {
              "assignments.subjectID": mongoose.Types.ObjectId(subjectID),
              "assignments.submissions.marks": { $exists: true, $ne: null },
            },
            {
              "quizzes.subjectID": mongoose.Types.ObjectId(subjectID),
              "quizzes.submissions.marks": { $exists: true, $ne: null },
            }
          ]
        },
      },
      {
        $group: {
          _id: null,
          assignments: {
            $addToSet: {
              _id: "$assignments._id",
              deadline: "$assignments.dueDate",
              title: "$assignments.title",
              totalMarks: "$assignments.totalMarks",
              obtainedMarks: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: "$assignments.submissions",
                          as: "submission",
                          cond: {
                            $eq: [
                              "$$submission.studentID",
                              mongoose.Types.ObjectId(studentID),
                            ],
                          },
                        },
                      },
                      as: "submission",
                      in: "$$submission.marks",
                    },
                  },
                  0,
                ],
              },
              submittedAt: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: "$assignments.submissions",
                          as: "submission",
                          cond: {
                            $eq: [
                              "$$submission.studentID",
                              mongoose.Types.ObjectId(studentID),
                            ],
                          },
                        },
                      },
                      as: "submission",
                      in: "$$submission.submittedAt",
                    },
                  },
                  0,
                ],
              },
              feedback: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: "$assignments.submissions",
                          as: "submission",
                          cond: {
                            $eq: [
                              "$$submission.studentID",
                              mongoose.Types.ObjectId(studentID),
                            ],
                          },
                        },
                      },
                      as: "submission",
                      in: "$$submission.feedback",
                    },
                  },
                  0,
                ],
              },
              grade: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: "$assignments.submissions",
                          as: "submission",
                          cond: {
                            $eq: [
                              "$$submission.studentID",
                              mongoose.Types.ObjectId(studentID),
                            ],
                          },
                        },
                      },
                      as: "submission",
                      in: "$$submission.grade",
                    },
                  },
                  0,
                ],
              },
            },
          },
          quizzes: {
            $addToSet: {
              _id: "$quizzes._id",
              deadline: "$quizzes.dueDate",
              title: "$quizzes.title",
              totalMarks: "$quizzes.totalMarks",
              obtainedMarks: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: "$quizzes.submissions",
                          as: "submission",
                          cond: {
                            $eq: [
                              "$$submission.studentID",
                              mongoose.Types.ObjectId(studentID),
                            ],
                          },
                        },
                      },
                      as: "submission",
                      in: "$$submission.marks",
                    },
                  },
                  0,
                ],
              },
              submittedAt: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: "$quizzes.submissions",
                          as: "submission",
                          cond: {
                            $eq: [
                              "$$submission.studentID",
                              mongoose.Types.ObjectId(studentID),
                            ],
                          },
                        },
                      },
                      as: "submission",
                      in: "$$submission.submittedAt",
                    },
                  },
                  0,
                ],
              },
              feedback: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: "$quizzes.submissions",
                          as: "submission",
                          cond: {
                            $eq: [
                              "$$submission.studentID",
                              mongoose.Types.ObjectId(studentID),
                            ],
                          },
                        },
                      },
                      as: "submission",
                      in: "$$submission.feedback",
                    },
                  },
                  0,
                ],
              },
              grade: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: "$quizzes.submissions",
                          as: "submission",
                          cond: {
                            $eq: [
                              "$$submission.studentID",
                              mongoose.Types.ObjectId(studentID),
                            ],
                          },
                        },
                      },
                      as: "submission",
                      in: "$$submission.grade",
                    },
                  },
                  0,
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          assignments: 1,
          quizzes: 1,
        }
      },
    ]);


    const pipeline = [
      {
        $match: {
          // classroomID: mongoose.Types.ObjectId(classroomID),
          subjectID: mongoose.Types.ObjectId(subjectID),
        },
      },
      {
        $project: {
          matchedAttendance: {
            $filter: {
              input: "$attendance",
              as: "attendance",
              cond: {
                $eq: ["$$attendance.studentID", mongoose.Types.ObjectId(studentID)],
              },
            },
          },
          title: 1,
          startTime: 1,
          endTime: 1,
          createdBy: 1,
          oneTime: 1,
          classroomID: 1,
          subjectID: 1,
          teacher: 1,
          meetLink: 1,
        },
      },
    ];


    const classes = await Class.aggregate(pipeline);

    // console.log("class report data is ; ", classes);


    // console.log("report array with quiz", userAssignmentsAndQuizzes[0])

    let avgAttendencePer = 0;
    let avgQuizMarksPer = 0;
    let avgAssMarksPer = 0;

    let presentCount = 0;
    let absentCount = 0;

    if (classes.length > 0) {
      classes.map((item) => {
        if (item.matchedAttendance.length > 0) {
          if (item.matchedAttendance[0].isPresent) {
            presentCount++
          } else {
            absentCount++;
          }
        }
      })
      avgAttendencePer = (presentCount / classes.length) * 100;
    }

    if (userAssignmentsAndQuizzes.length > 0) {
      if (userAssignmentsAndQuizzes[0].quizzes.length > 0) {

        const totalObtainedMarks = userAssignmentsAndQuizzes[0].quizzes.reduce(
          (total, assignment) => total + (assignment.obtainedMarks || 0),
          0
        );

        const totalMarks = userAssignmentsAndQuizzes[0].quizzes.reduce(
          (total, assignment) => total + (assignment.totalMarks || 0),
          0
        );

        avgQuizMarksPer = (totalObtainedMarks / totalMarks) * 100;

      }
      if (userAssignmentsAndQuizzes[0].assignments.length > 0) {


        const totalObtainedMarks = userAssignmentsAndQuizzes[0].assignments.reduce(
          (total, assignment) => total + (assignment.obtainedMarks || 0),
          0
        );

        const totalMarks = userAssignmentsAndQuizzes[0].assignments.reduce(
          (total, assignment) => total + (assignment.totalMarks || 0),
          0
        );

        avgAssMarksPer = (totalObtainedMarks / totalMarks) * 100;

        // console.log(" assignment marks per are : ", avgAssMarksPer);
      }
    }

    res.send({
      quizes: {
        data:
          userAssignmentsAndQuizzes.length > 0
            ? userAssignmentsAndQuizzes[0].quizzes
            : [],
        avgMarksPer: avgQuizMarksPer.toFixed(0),
        avgGrade:
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
      assignments: {
        data:
          userAssignmentsAndQuizzes.length > 0
            ? userAssignmentsAndQuizzes[0].assignments
            : [],
        avgMarksPer: avgAssMarksPer.toFixed(0),
        avgGrade:
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
      attendance: { classes, avgAttendencePer, presentCount, absentCount }
    });
  } catch (err) {
    next(err);
  }
};
