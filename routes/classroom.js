const classoomRouter = require("express").Router();
const classroomController = require("../controllers/classroom");

classoomRouter.post("/", classroomController.createClassroom);
classoomRouter.get("/", classroomController.getClassrooms);
classoomRouter.get("/id/:id", classroomController.getClassroomById);
classoomRouter.put("/:id", classroomController.updateClassroom);
classoomRouter.delete("/:id", classroomController.deleteClassroom);
classoomRouter.get("/teacher", classroomController.getClassroomsOfTeacher);

module.exports = classoomRouter;
