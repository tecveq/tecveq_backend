const express = require("express");
const userRouter = express.Router();
const controller = require("../controllers/user");

// Login route
userRouter.post("/login", controller.login);

// Register route
userRouter.post("/register", controller.register);

module.exports = userRouter;
