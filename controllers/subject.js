const Subject = require("../models/subject");

exports.createSubject = async (req, res, next) => {
  try {
    const data = req.body;

    const found = await Subject.findOne({
      name: data.name,
      levelID: data.levelID,
    });

    if (found) {
      return res.status(400).send("Subject already exists");
    }

    const subject = new Subject(data);
    await subject.save();
    res.status(201).send(subject._doc);
  } catch (err) {
    next(err);
  }
};

exports.getSubjects = async (req, res, next) => {
  try {
    const subjects = await Subject.find()
      .populate({
        path: 'levelID', // Field in the Subject schema referring to Level
        select: 'name', // Select only the 'name' field from the Level schema
      });

    // If you want to format the output to include levelName directly in the subject objects:
    const formattedSubjects = subjects.map(subject => ({
      ...subject._doc, // Spread the existing subject fields
      levelName: subject.levelID ? subject.levelID.name : "Unknown Level", // Add levelName
    }));

    res.status(200).send(formattedSubjects);
  } catch (err) {
    next(err);
  }
};


exports.getSubjectsOfLevel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subjects = await Subject.find({ levelID: id });
    res.status(200).send(subjects);
  } catch (err) {
    next(err);
  }
};

exports.updateSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const subject = await Subject.findByIdAndUpdate(id, data, {
      new: true,
    });
    res.status(200).send(subject._doc);
  } catch (err) {
    next(err);
  }
};

exports.deleteSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Subject.findByIdAndDelete(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
