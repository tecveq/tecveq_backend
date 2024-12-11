const subjectRouter = require("express").Router();
const {
  createSubject,
  getSubjects,
  updateSubject,
  deleteSubject,
  getTeacherSubjects,
  getSubjectsOfLevel,
} = require("../controllers/subject");

subjectRouter.post("/", createSubject);
subjectRouter.get("/:id", getSubjectsOfLevel);
subjectRouter.get("/", getSubjects);
subjectRouter.get("/teacher-subject/:teacherId", getTeacherSubjects);
subjectRouter.put("/:id", updateSubject);
subjectRouter.delete("/:id", deleteSubject);

module.exports = subjectRouter;
