const classoomRouter = require("express").Router();
const classroomController = require("../controllers/classroom");

classoomRouter.post("/", classroomController.createClassroom);
classoomRouter.get("/", classroomController.getClassrooms);
classoomRouter.get("/:id", classroomController.getClassroomById);
classoomRouter.put("/:id", classroomController.updateClassroom);
classoomRouter.delete("/:id", classroomController.deleteClassroom);

module.exports = classoomRouter;
