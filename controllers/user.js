const passport = require("passport");
const User = require("../models/user");
const Classroom = require("../models/classroom");
const bcrypt = require("bcryptjs");

exports.register = async (req, res, next) => {
  try {
    const data = req.body;

    const foundUser = await User.findOne({ email: data.email });

    if (foundUser) {
      return res.status(401).send("User already exists");
    }

    if (data.userType != "student" && data.userType != "teacher") {
      return res.status(400).send("Invalid user type");
    }

    if (
      !data.name ||
      !data.email ||
      !data.password ||
      !data.userType ||
      !data.phoneNumber
    ) {
      return res.status(400).send("All fields are required");
    }

    if (data.userType === "student") {
      if (!data.levelID) {
        return res.status(400).send("Level is required");
      }
      if (
        !data.guardianName ||
        !data.guardianEmail ||
        !data.guardianPhoneNumber
      ) {
        return res.status(400).send("Guardian details are required");
      }
    }

    if (data.userType === "teacher") {
      if (!data.qualification || !data.cv) {
        return res.status(400).send("Qualification and CV are required");
      }
    }

    data["password"] = bcrypt.hashSync(data.password, 8);

    const user = new User(req.body);

    await user.save();

    res.send({ ...user._doc, password: undefined });
  } catch (err) {
    next(err);
  }
};
exports.login = (req, res, next) => {
  passport.authenticate("local", function (err, foundUser, info) {
    if (err) {
      return next(err);
    }
    if (!foundUser) {
      return res.status(400).send(info.message);
    }
    req.logIn(foundUser, function (err) {
      if (err) {
        return next(err);
      }
      return res.send(foundUser);
    });
  })(req, res, next);
};

exports.logout = (req, res) => {
  try {
    req.logout();
    res.send("Logged out");
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, req.body, {
      new: true,
    });

    return res.status(200).send(user._doc);
  } catch (err) {
    next(err);
  }
};

exports.getUsersNotInClassroom = async (req, res, next) => {
  try {
    const { levelID } = req.params;

    const classroomsWithLevel = await Classroom.find({ levelID });

    // Extract user IDs from the classrooms
    const usersInClassroom = classroomsWithLevel.reduce((users, classroom) => {
      users.push(
        ...classroom.students,
        ...classroom.teachers.map((teacher) => teacher.teacher)
      );
      return users;
    }, []);

    // Find users not in any classroom with the given levelID
    const usersNotInClassroom = await User.find({
      $and: [
        { _id: { $nin: usersInClassroom } },
        {
          $or: [
            { userType: { $ne: "student" } },
            { $and: [{ userType: "student" }, { levelID }] },
          ],
        },
      ],
      userType: { $ne: "admin" }, // Exclude users with userType "admin"
    });
    const result = {
      students: usersNotInClassroom.filter(
        (user) => user.userType === "student"
      ),
      teachers: usersNotInClassroom.filter(
        (user) => user.userType === "teacher"
      ),
    };
    res.send(result);
  } catch (error) {
    next(error);
  }
};

exports.getAllStudents = async (req, res, next) => {
  try {
    const users = await User.find({ userType: "student" });
    res.send(users);
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find({ userType: { $ne: "admin" } });
    res.send(users);
  } catch (error) {
    next(error);
  }
};

exports.acceptUser = async (req, res, next) => {
  try {
    const { userID } = req.params;
    const user = await User.findByIdAndUpdate(
      userID,
      { isAccepted: true },
      { new: true }
    );
    res.send(user._doc);
  } catch (error) {
    next(error);
  }
};

exports.rejectUser = async (req, res, next) => {
  try {
    const { userID } = req.params;
    const user = await User.findByIdAndDelete(userID);
    res.send(user._doc);
  } catch (error) {
    next(error);
  }
};
