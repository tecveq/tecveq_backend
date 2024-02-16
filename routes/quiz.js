const quizController = require("../controllers/quiz");
const quizRouter = require("express").Router();

quizRouter.post("/", quizController.createQuiz);
quizRouter.put("/:id", quizController.editQuiz);
//delete quiz
quizRouter.delete("/:id", quizController.deleteQuiz);
//get quizes of classroom
quizRouter.get("/:classroomID", quizController.getQuizesOfClassroom);
//get quizes of classroom of teacher
quizRouter.get(
  "/teacher/:classroomID",
  quizController.getQuizesOfClassroomOfTeacher
);
//get all quizes of teacher
quizRouter.get("/teacher", quizController.getAllQuizesOfTeacher);
//get quiz by id
quizRouter.get("/:id", quizController.getQuizById);
//submit quiz
quizRouter.post("/submit/:id", quizController.submitQuiz);
//grade quizes
quizRouter.post("/grade/:id", quizController.gradeQuizes);

module.exports = quizRouter;
