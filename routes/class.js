const classController = require("../controllers/class");
const classRouter = require("express").Router();

classRouter.post("/", classController.createClass);

classRouter.get("/", classController.getClasses);

// reschedule class
classRouter.put("/:id", classController.rescheduleClass);

// cancel class
classRouter.delete("/:id", classController.cancelClass);

module.exports = classRouter;
