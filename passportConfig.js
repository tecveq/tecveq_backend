const LocalStrategy = require("passport-local").Strategy;

const User = require("./models/user");
const bcrypt = require("bcryptjs");

exports.initializingPassport = (passport) => {
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
        passReqToCallback: true, // Pass the entire request object to the callback
      },
      async (req, email, password, done) => {
        try {
          const foundUser = await User.findOne({ email: email });
          if (!foundUser) {
            return done(null, false, { message: "User does not exist" });
          } else {
            if (foundUser.userType === "parent") {
              // if (!req.body.currentStudentID) {
              //   return done(null, false, {
              //     message: "Please provide the current student ID",
              //   });
              // }
              // // check if student has guardian with the email provided
              // const student = await User.findOne({
              //   _id: req.body.currentStudentID,
              //   guardianEmail: email,
              // });
              // if (!student) {
              //   return done(null, false, { message: "Student does not exist" });
              // }

              return done(null, {
                ...foundUser._doc,
                studentID: req.body.currentStudentID,
              });
            }
            const validPass = await bcrypt.compare(
              password,
              foundUser.password
            );
            if (!validPass) {
              return done(null, false, { message: "Incorrect password" });
            } else {
              return done(null, foundUser);
            }
          }
        } catch (err) {
          return done(err, false);
        }
      }
    )
  );

  passport.serializeUser(async (user, done) => {
    done(null, user._id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, false);
    }
  });
};
