const express = require("express");
const authRouter = express.Router();
const controller = require("../controllers/attendence");

// Create Head Attendence
authRouter.post("/add-classroom-attendence/:id", controller.createAttendence);



module.exports = authRouter;
