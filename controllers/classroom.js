const Classroom = require("../models/classroom");

exports.createClassroom = async (req, res, next) => {
  try {
    const data = req.body;

    const classroom = new Classroom(data);

    await classroom.save();

    return res.status(201).send(classroom._doc);
  } catch (err) {
    next(err);
  }
};
exports.getClassrooms = async (req, res, next) => {
  try {
    const classrooms = await Classroom.find();

    return res.status(200).send(classrooms);
  } catch (err) {
    next(err);
  }
};
exports.getClassroomById = async (req, res, next) => {
  try {
    const classroom = await Classroom.findById(req.params.id);

    return res.status(200).send(classroom);
  } catch (err) {
    next(err);
  }
};
exports.updateClassroom = async (req, res, next) => {
  try {
    const classroom = await Classroom.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    return res.status(200).send(classroom._doc);
  } catch (err) {
    next(err);
  }
};
exports.deleteClassroom = async (req, res, next) => {
  try {
    await Classroom.findByIdAndDelete(req.params.id);

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};
