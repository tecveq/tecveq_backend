const LocalStrategy = require("passport-local").Strategy;

const User = require("./models/user");
const bcrypt = require("bcryptjs");

exports.initializingPassport = (passport) => {
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const foundUser = await User.findOne({ email: email });
          console.log(foundUser);
          if (!foundUser) {
            return done(null, false, { message: "User does not exist" });
          } else {
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
