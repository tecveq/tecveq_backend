const classController = require("../controllers/class");
const { createMeeting, getMeetingDetails } = require("../utils/meeting");
const classRouter = require("express").Router();

classRouter.post("/", classController.createClass);

classRouter.get("/", classController.getClasses);

// today classes for attendence ==> get-classes-for-attendence
classRouter.get("/get-today-classes", classController.getTodayClasses);

// today classes for attendence ==> get-classes-for-attendence
classRouter.put("/get-today-classes/:id", classController.submitAttendence);

// reschedule class
classRouter.put("/:id", classController.rescheduleClass);

// cancel class
classRouter.delete("/:id", classController.cancelClass);

// createMeeting();
// getMeetingDetails();
module.exports = classRouter;
