const User = require("../models/user");
const Chatroom = require("../models/chatroom");

exports.getUserChatrooms = async (req, res, next) => {
  try {
    const chatrooms = await Chatroom.find({
      participants: req.user._id,
    }).populate("participants");
    res.status(200).json(chatrooms);
  } catch (error) {
    next(error);
  }
};

exports.getChatroom = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const chatroom = await Chatroom.findOne({
      _id: req.params.chatroomId,
      participants: userId,
    }).populate("participants");

    res.status(200).json(chatroom);
  } catch (error) {
    next(error);
  }
};
