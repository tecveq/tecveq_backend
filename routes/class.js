const classController = require("../controllers/class");
const classRouter = require("express").Router();

classRouter.post("/", classController.createClass);

classRouter.get("/", classController.getClasses);

module.exports = classRouter;
