const chatroomController = require("../controllers/chatroom");
const chatroomRouter = require("express").Router();

chatroomRouter.get("/", chatroomController.getUserChatrooms);
chatroomRouter.get("/:chatroomId", chatroomController.getChatroom);

module.exports = chatroomRouter;
