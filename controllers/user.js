const passport = require("passport");
const User = require("../models/user");
const bcrypt = require("bcryptjs");

exports.register = async (req, res, next) => {
  try {
    const data = req.body;

    const foundUser = await User.findOne({ email: data.email });

    if (foundUser) {
      return res.status(401).send("User already exists");
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
