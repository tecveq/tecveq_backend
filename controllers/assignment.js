const Assignment = require("../models/assignment");
const Classroom = require("../models/classroom");

exports.createAssignment = async (req, res, next) => {
  const { title, totalMarks, dueDate, files, classroomID } = req.body;

  //check if classroom exists and teacher is part of that classroom
  const classroom = await Classroom.findById(classroomID);
  if (!classroom) {
    return res.status(404).send();
  }

  const isTeacher = classroom.teachers.find(
    (tea) => tea.teacher.toString() == req.user._id.toString()
  );
  if (!isTeacher) {
    return res.status(403).send();
  }

  const createdBy = req.user._id;
  const assignment = new Assignment({
    title,
    totalMarks,
    dueDate,
    files,
    createdBy,
    classroomID,
  });
  try {
    await assignment.save();
    res.status(201).send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.editAssignment = async (req, res, next) => {
  const { title, totalMarks, dueDate, files } = req.body;
  const { id } = req.params;
  try {
    // check if assignment exists and teacher who created assignment is editing it

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).send();
    }
    if (assignment.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).send();
    }
    assignment.title = title;
    assignment.totalMarks = totalMarks;
    assignment.dueDate = dueDate;
    assignment.files = files;
    await assignment.save();
    res.send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.deleteAssignment = async (req, res, next) => {
  const { id } = req.params;
  try {
    //check if assignment exists and teacher who created assignment is deleting it

    const assignment = await Assignment.findById(id);

    if (!assignment) {
      return res.status(404).send();
    }
    if (assignment.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).send();
    }
    await assignment.remove();
    res.send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentsOfClassroom = async (req, res, next) => {
  const { classroomID } = req.params;
  try {
    const assignments = await Assignment.find({ classroomID });
    res.send(assignments);
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentsOfClassroomOfTeacher = async (req, res, next) => {
  const { classroomID } = req.params;
  const createdBy = req.user._id;
  try {
    const assignments = await Assignment.find({ classroomID, createdBy });
    res.send(assignments);
  } catch (error) {
    next(error);
  }
};

exports.getAllAssignmentsOfTeacher = async (req, res, next) => {
  const createdBy = req.user._id;
  try {
    const assignments = await Assignment.find({ createdBy });
    res.send(assignments);
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).send();
    }
    res.send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.submitAssignment = async (req, res, next) => {
  const { id } = req.params;
  const { file } = req.body;
  const studentID = req.user._id;

  try {
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).send();
    }

    //check if user is part of that classroom
    const classroomID = assignment.classroomID;
    const classroom = await Classroom.findById(classroomID);
    if (!classroom) {
      return res.status(404).send();
    }
    const isStudent = classroom.students.includes(studentID);
    if (!isStudent) {
      return res.status(403).send();
    }

    //check if already submitted
    const alreadySubmitted = assignment.submissions.find(
      (s) => s.studentID.toString() == studentID
    );
    if (alreadySubmitted) {
      return res.status(400).send("Already submitted");
    }

    const submission = {
      studentID,
      file,
      isLate: new Date() > quiz.dueDate,
    };
    assignment.submissions.push(submission);
    await assignment.save();
    res.status(201).send(assignment);
  } catch (error) {
    next(error);
  }
};

exports.gradeAssignments = async (req, res, next) => {
  //grade multiple assignments
  const { id } = req.params;
  const { submissions } = req.body;
  try {
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).send();
    }

    //check if submissions has marks greater than total marks
    const invalidMarks = submissions.find(
      (s) => s.marks > assignment.totalMarks
    );
    if (invalidMarks) {
      return res.status(400).send("Invalid marks");
    }

    // check if teacher who created assignment is grading it
    if (assignment.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).send();
    }

    // find submission in assignment and update only marks, feedback and grade
    const updatedSubmissions = assignment.submissions.map((submission) => {
      const newSubmission = submissions.find(
        (s) => s.studentID.toString() == submission.studentID.toString()
      );

      if (newSubmission) {
        submission.marks = newSubmission.marks;
        submission.feedback = newSubmission.feedback
          ? newSubmission.feedback
          : "";
        submission.grade = "A";
      }
      return submission;
    });

    assignment.submissions = updatedSubmissions;
    await assignment.save();
    res.send(assignment);
  } catch (error) {
    next(error);
  }
};
