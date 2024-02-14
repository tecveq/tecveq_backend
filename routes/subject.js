const subjectRouter = require("express").Router();
const {
  createSubject,
  getSubjects,
  updateSubject,
  deleteSubject,
  getSubjectsOfLevel,
} = require("../controllers/subject");

subjectRouter.post("/", createSubject);
subjectRouter.get("/:id", getSubjectsOfLevel);
subjectRouter.get("/", getSubjects);
subjectRouter.put("/:id", updateSubject);
subjectRouter.delete("/:id", deleteSubject);

module.exports = subjectRouter;
