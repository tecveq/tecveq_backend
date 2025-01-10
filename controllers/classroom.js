const Classroom = require("../models/classroom");
const Subject = require("../models/subject");
const Class = require("../models/class");
const Chatroom = require("../models/chatroom");
const Level = require("../models/level");
const classroomRepository = require("../repositories/classroomRepository");

exports.createClassroom = async (req, res, next) => {
  try {
    const data = req.body;

    const { headTeacher } = data;


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

    const teachers = data.teachers;
    const students = data.students;

    let subject;
    let level;

    //check if user is a teacher
    if (currUser.userType == "teacher") {
      if (!data.subject) {
        return res.status(400).send("Subject is required");
      }
      //check if subject exists
      subject = await Subject.findOne({ _id: data.subject });

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

      // check if level exists
      level = await Level.findOne({ _id: data.levelID });
      if (!level) {
        return res.status(400).send("Level does not exist");
      }

      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        const classroom = await Classroom.findOne({ students: student });
        // if (classroom) {
        //   return res
        //     .status(400)
        //     .send("Student is already in another classroom");
        // }
      }
      //check if teacher is already in another classroom

      for (let i = 0; i < teachers.length; i++) {
        const teacher = teachers[i].teacher;
        if (!teachers[i].subject) {
          console.log("here in array loop")
          return res.status(400).send("Subject is required");
        }
        const classroom = await Classroom.findOne({
          "teachers.teacher": teacher,
        });
        // if (classroom) {
        //   return res
        //     .status(400)
        //     .send("Teacher is already in another classroom");
        // }
      }
    }

    if (headTeacher) {
      data.teachers = data.teachers.map((teacher) => ({
        ...teacher,
        type: teacher.teacher === headTeacher ? "head" : "teacher",
      }));
    }

    const classroom = new Classroom({ ...data, createdBy: currUser._id });

    await classroom.save();

    await teachers.map(async (tea) => {
      const chatname = `${data.name} ${currUser.userType == "teacher"
        ? " - " + subject.name
        : (await Subject.findOne({ _id: tea.subject })).name
        }`;

      await Chatroom.create({
        participants: [...students, tea.teacher],
        name: chatname,
        messages: [],
        classroomID: classroom._id,
      });
    });

    return res.status(201).send(classroom._doc);
  } catch (err) {
    next(err);
  }
};
exports.getClassrooms = async (req, res, next) => {
  try {
    const classroomsWithClasses = await Classroom.aggregate([
      // Lookup to populate createdBy details
      {
        $lookup: {
          from: "users", // Name of the users collection
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      {
        $addFields: {
          createdBy: { $arrayElemAt: ["$createdBy", 0] }, // Extract single createdBy object
        },
      },
      // Lookup to populate level details
      {
        $lookup: {
          from: "levels", // Name of the levels collection
          localField: "levelID",
          foreignField: "_id",
          as: "level",
        },
      },
      {
        $addFields: {
          level: { $arrayElemAt: ["$level", 0] }, // Extract single level object
        },
      },
      // Lookup to populate student details
      {
        $lookup: {
          from: "users", // Name of the users collection
          localField: "students",
          foreignField: "_id",
          as: "students",
        },
      },
      // Lookup to populate teacher details
      {
        $lookup: {
          from: "users", // Name of the users collection
          localField: "teachers.teacher",
          foreignField: "_id",
          as: "teacherDetails",
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
      {
        $lookup: {
          from: "subjects", // Name of the subjects collection
          localField: "teachers.subject",
          foreignField: "_id",
          as: "subjectDetails",
        },
      },
      // Format teachers array with populated fields
      {
        $addFields: {
          teachers: {
            $map: {
              input: "$teachers",
              as: "teacher",
              in: {
                type: "$$teacher.type",
                teacher: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$teacherDetails",
                        as: "teacherDetail",
                        cond: { $eq: ["$$teacherDetail._id", "$$teacher.teacher"] },
                      },
                    },
                    0,
                  ],
                },
                subject: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$subjectDetails",
                        as: "subjectDetail",
                        cond: { $eq: ["$$subjectDetail._id", "$$teacher.subject"] },
                      },
                    },
                    0,
                  ],
                },
              },
            },
          },
        },
      },
      // Cleanup fields (optional: remove unnecessary arrays)
      {
        $project: {
          teacherDetails: 0,
          subjectDetails: 0,
        },
      },
    ]);

    res.status(200).json(classroomsWithClasses);
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
// exports.updateClassroom = async (req, res, next) => {
//   // try {
//   //   const { name, students, teachers } = req.body;
//   //   // update only if current user is admin or if the classroom was created by the current user
//   //   const currUser = req.user;
//   //   const classroom = await Classroom.findById(req.params.id);
//   //   if (
//   //     (currUser.userType != "admin" && classroom.createdBy != currUser._id) ||
//   //     (currUser.userType == "teacher" && teachers)
//   //   ) {
//   //     return res.status(401).send("Unauthorized");
//   //   }

//   //   if (name) {
//   //     // check if same name classroom exists in the same level
//   //     const classroomFound = await Classroom.findOne({
//   //       name: name,
//   //       _id: { $ne: req.params.id },
//   //       levelID: classroom.levelID,
//   //     });
//   //     if (classroomFound) {
//   //       return res.status(400).send("Classroom already exists");
//   //     }
//   //   }

//   //   classroom.name = name;

//   //   const chatrooms = await Chatroom.find({ classroomID: req.params.id });

//   //   // check all chatrooms and delete the ones that are not in the new list of teachers

//   //   chatrooms.forEach(async (chatroom) => {
//   //     // find if chatroom has participants that are not in the new list of teachers
//   //     if (
//   //       chatroom.participants.some(
//   //         (participant) =>
//   //           !teachers.some((teacher) => teacher.teacher == participant)
//   //       )
//   //     ) {
//   //       await Chatroom.findByIdAndDelete(chatroom._id);
//   //     }

//   //     // remove the students that are not in the new list of students
//   //     chatroom.participants = chatroom.participants.filter((participant) =>
//   //       students.includes(participant)
//   //     );
//   //     await chatroom.save();
//   //   });
//   //   await classroom.save();

//   //   return res.status(200).send(classroom);
//   // } catch (err) {
//   //   next(err);
//   // }

//   try {
//     const data = req.body;

//     if (
//       !data.name ||
//       !data.students ||
//       !data.teachers ||
//       data.students.length < 1 ||
//       data.teachers.length < 1
//     ) {
//       return res.status(400).send("All fields are required");
//     }

//     const currUser = req.user;

//     const classroom = await Classroom.findById(req.params.id);

//     //check if same name classroom exists in the same level
//     const classroomFound = await Classroom.findOne({
//       name: data.name,
//       _id: { $ne: req.params.id },
//       levelID: data.levelID,
//     });
//     if (classroomFound) {
//       return res.status(400).send("Classroom already exists");
//     }

//     const teachers = data.teachers;
//     const students = data.students;

//     let subject;
//     let level;

//     //check if user is a teacher
//     if (currUser.userType == "teacher") {
//       if (!data.subject) {
//         return res.status(400).send("Subject is required");
//       }
//       //check if subject exists
//       subject = await Subject.findOne({ _id: data.subject });

//       if (!subject) {
//         return res.status(400).send("Subject does not exist");
//       }

//       data.teachers = [
//         {
//           teacher: currUser._id,
//           subject: data.subject,
//         },
//       ];
//     } else {
//       if (!data.levelID) {
//         return res.status(400).send("Level is required");
//       }

//       // check if level exists
//       level = await Level.findOne({ _id: data.levelID });
//       if (!level) {
//         return res.status(400).send("Level does not exist");
//       }

//       for (let i = 0; i < students.length; i++) {
//         const student = students[i];
//         const classroom = await Classroom.findOne({
//           students: student,
//           _id: { $ne: req.params.id },
//         });
//         if (classroom) {
//           return res
//             .status(400)
//             .send("Student is already in another classroom");
//         }
//       }
//       //check if teacher is already in another classroom

//       for (let i = 0; i < teachers.length; i++) {
//         const teacher = teachers[i].teacher;
//         const classroom = await Classroom.findOne({
//           "teachers.teacher": teacher,
//           _id: { $ne: req.params.id },
//         });
//         if (classroom) {
//           return res
//             .status(400)
//             .send("Teacher is already in another classroom");
//         }
//       }
//     }

//     // create new chatrooms for teachers which were not in previous classroom
//     await teachers.map(async (tea) => {
//       if (
//         !classroom.teachers.find(
//           (teac) => teac.teacher.toString() == tea.teacher.toString()
//         )
//       ) {
//         const chatname = `${data.name} ${currUser.userType == "teacher"
//           ? " - " + subject.name
//           : (await Subject.findOne({ _id: tea.subject })).name
//           }`;

//         await Chatroom.create({
//           participants: [...students, tea.teacher],
//           name: chatname,
//           messages: [],
//           classroomID: classroom._id,
//         });
//       }
//     });

//     // delete chatrooms which has teacher as participants whihc are not in the new list of teachers
//     const chatrooms = await Chatroom.find({ classroomID: req.params.id });

//     chatrooms.forEach(async (chatroom) => {
//       // find if chatroom has participants that are not in the new list of teachers
//       if (
//         chatroom.participants.some(
//           (participant) =>
//             !teachers.some((teacher) => teacher.teacher == participant)
//         )
//       ) {
//         await Chatroom.findByIdAndDelete(chatroom._id);
//       }

//       // remove the students that are not in the new list of students
//       chatroom.participants = chatroom.participants.filter((participant) =>
//         students.includes(participant)
//       );
//       await chatroom.save();
//     });

//     classroom.name = data.name;
//     classroom.levelID = data.levelID;
//     classroom.students = data.students;
//     classroom.teachers = data.teachers;

//     await classroom.save();

//     await teachers.map(async (tea) => {
//       const chatname = `${data.name} ${currUser.userType == "teacher"
//         ? " - " + subject.name
//         : (await Subject.findOne({ _id: tea.subject })).name
//         }`;

//       await Chatroom.create({
//         participants: [...students, tea.teacher],
//         name: chatname,
//         messages: [],
//         classroomID: classroom._id,
//       });
//     });

//     return res.status(201).send(classroom._doc);
//   } catch (err) {
//     next(err);
//   }
// };
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
    // delete the chatroom
    await Chatroom.deleteMany({ classroomID: req.params.id });

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
          from: "users", // Collection where user data (teachers and students) is stored
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
      {
        $lookup: {
          from: "users", // Assuming students' details are in the "users" collection
          localField: "students",
          foreignField: "_id",
          as: "studentDetails", // Populate student details here
        },
      },
      {
        $lookup: {
          from: "levels", // Reference the levels collection
          localField: "levelID", // Match classroom's levelID with levels collection
          foreignField: "_id", // Match with levels' _id
          as: "levelDetails", // Populate level details
        },
      },
      {
        $addFields: {
          levelName: {
            $cond: {
              if: { $gt: [{ $size: "$levelDetails" }, 0] }, // Check if levelDetails array is not empty
              then: { $arrayElemAt: ["$levelDetails.name", 0] }, // Extract the level name
              else: "", // Set an empty string if no levelID
            },
          },
        },
      },
      {
        $project: {
          "createdBy.password": 0, // Exclude sensitive fields
          "studentDetails.password": 0,
          levelDetails: 0, // Exclude levelDetails array as we already have levelName
        },
      },
    ]);

    return res.status(200).send(classroomsWithClasses);
  } catch (err) {
    next(err);
  }
};




// updateClassroom.js

exports.updateClassroom = async (req, res, next) => {
  try {
    const data = req.body;
    const classroomId = req.params.id;

    if (!data.name || !data.students || !data.teachers || data.students.length < 1 || data.teachers.length < 1) {
      return res.status(400).send("All fields are required");
    }

    const currUser = req.user;
    const existingClassroom = await classroomRepository.findClassroomById(classroomId);

    if (!existingClassroom) {
      return res.status(404).send("Classroom not found");
    }

    const classroomFound = await classroomRepository.findClassroomByNameAndLevel(data.name, data.levelID);
    if (classroomFound && classroomFound._id.toString() !== classroomId) {
      return res.status(400).send("Classroom with the same name already exists in the same level");
    }

    let subject;
    let level;

    if (currUser.userType === "teacher") {
      if (!data.subject) {
        return res.status(400).send("Subject is required");
      }
      subject = await classroomRepository.findSubjectById(data.subject);
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
      level = await classroomRepository.findLevelById(data.levelID);
      if (!level) {
        return res.status(400).send("Level does not exist");
      }

      for (const student of data.students) {
        const studentClassroom = await classroomRepository.findStudentClassroom(student);
        if (studentClassroom && studentClassroom._id.toString() !== classroomId) {
          return res.status(400).send("Student is already in another classroom");
        }
      }

      // for (const teacher of data.teachers) {
      //   const teacherClassroom = await classroomRepository.findTeacherClassroom(teacher.teacher);
      //   if (teacherClassroom && teacherClassroom._id.toString() !== classroomId) {
      //     return res.status(400).send("Teacher is already in another classroom");
      //   }

      //   if (!teacher.subject) {
      //     return res.status(400).send("Subject is required for each teacher");
      //   }
      // }
    }

    if (data.headTeacher) {
      data.teachers = data.teachers.map(teacher => ({
        ...teacher,
        type: teacher.teacher === data.headTeacher ? "head" : "teacher",
      }));
    }

    const updatedClassroom = await classroomRepository.updateClassroomById(classroomId, data);

    return res.status(200).send(updatedClassroom);
  } catch (err) {
    next(err);
  }
};