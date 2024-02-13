const Announcement = require("../models/announcement");

exports.createAnnouncement = async (req, res, next) => {
  try {
    const data = req.body;

    const announcement = new Announcement(data);

    await announcement.save();

    return res.status(201).send(announcement._doc);
  } catch (err) {
    next(err);
  }
};
exports.getAnnouncementsByType = async (req, res, next) => {
  try {
    const announcements = await Announcement.find({ type: req.params.type });

    return res.status(200).send(announcements);
  } catch (err) {}
};
exports.getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await Announcement.find();

    return res.status(200).send(announcements);
  } catch (err) {
    next(err);
  }
};

exports.updateAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    return res.status(200).send(announcement._doc);
  } catch (err) {
    next(err);
  }
};

exports.deleteAnnouncement = async (req, res, next) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
};
