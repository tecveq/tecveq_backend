const Activity = require("../models/activities");

exports.initializeSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("a user connected");

    // when user logins in, add activity to save login time and when user logout, update its logout time
    socket.on("login", async (data) => {
      const { userID, device, browser } = data;
      const activity = new Activity({
        userID,
        loginTime: new Date().toISOString(),
        logoutTime: "",
        device,
        browser,
      });
      await activity.save();
    });

    // update logout time when user disconnects for specific userID
    socket.on("logout", async (userID) => {
      await Activity.findOneAndUpdate(
        { userID, logoutTime: "" },
        { logoutTime: new Date().toISOString() }
      );
    });
  });
};
