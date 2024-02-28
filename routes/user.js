const express = require("express");
const userRouter = express.Router();
const controller = require("../controllers/user");

// Login route
userRouter.post("/login", controller.login);

// Register route
userRouter.post("/register", controller.register);

// Logout route
userRouter.get("/logout", controller.logout);

// get users not in classroom
userRouter.get("/not-in-classroom/:levelID", controller.getUsersNotInClassroom);

// get users
userRouter.get("/", controller.getUsers);

// accept user
userRouter.put("/accept/:id", controller.acceptUser);

// reject user
userRouter.delete("/reject/:id", controller.rejectUser);

// get all students
userRouter.get("/students", controller.getAllStudents);

// get students of teacher
userRouter.get("/students-of-teacher", controller.getStudentsOfTeacher);

// get student report for teacher
userRouter.get(
  "/student-report/:studentID",
  controller.getStudentReportForTeacher
);

// get student report for admin
userRouter.get(
  "/student-report-admin/:studentID",
  controller.getStudentReportsForAdmin
);

// get subjects of student
userRouter.get("/student-subjects/:studentID", controller.getStudentSubjects);

// get assignments and quizes of student of a subject
userRouter.get(
  "/student-assignments-quizes/:studentID/:subjectID",
  controller.getStudentGradesForSubject
);

// get teachers for admin
userRouter.get("/admin/teachers", controller.getTeachersForAdmin);

module.exports = userRouter;
