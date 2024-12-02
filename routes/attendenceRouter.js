const express = require("express");
const authRouter = express.Router();
const controller = require("../controllers/attendence");

// Create Head Attendence
authRouter.post("/get-today-classes/:id", controller.createAttendence);



module.exports = authRouter;
