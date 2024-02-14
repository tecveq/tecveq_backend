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

module.exports = userRouter;
