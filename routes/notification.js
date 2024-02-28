const notificationController = require("../controllers/notification");
const notificationRouter = require("express").Router();

notificationRouter.get("/", notificationController.getNotifications);

module.exports = notificationRouter;
