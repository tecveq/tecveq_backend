const Activity = require("../models/activities");
const { Server } = require("socket.io");

// Create a Socket.IO instance
const io = new Server();

io.on("connection", (socket) => {
  console.log("a user connected");

  // when user logins in, add activity to save login time and when user logout, update its logout time
  socket.on("login", async (data) => {
    const { userID, device, browser } = data;
    socket.userID = userID;
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
  socket.on("disconnect", async () => {
    const userID = socket.userID;
    if (userID)
      await Activity.findOneAndUpdate(
        { userID, logoutTime: "" },
        { logoutTime: new Date().toISOString() }
      );
  });
});

// Export the Socket.IO instance
exports.io = io;
