const subjectRouter = require("express").Router();
const {
  createSubject,
  getSubjects,
  updateSubject,
  deleteSubject,
  getTeacherSubjects,
  getSubjectsOfLevel,
  getTeacherSubjectsOfClassrooms,
} = require("../controllers/subject");

subjectRouter.post("/", createSubject);
subjectRouter.get("/:id", getSubjectsOfLevel);
subjectRouter.get("/", getSubjects);
subjectRouter.get("/teacher-subject/:teacherId", getTeacherSubjects);
subjectRouter.post("/teacher-subjects-of-classrooms", getTeacherSubjectsOfClassrooms);

subjectRouter.put("/:id", updateSubject);
subjectRouter.delete("/:id", deleteSubject);

module.exports = subjectRouter;
