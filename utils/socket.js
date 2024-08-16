const Activity = require("../models/activities");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

// Create a Socket.IO instance
const io = new Server();

io.on("connection", (socket) => {
  // when user logins in, add activity to save login time and when user logout, update its logout time
  socket.on("login", (data) => {
    try {
      const { userID, device, browser } = data;
      socket.userID = userID;
      if (!userID || !device || !browser) return;
      const activity = new Activity({
        userID,
        loginTime: new Date(),
        device,
        browser,
      });
      activity.save();
    } catch (err) {
      console.log(err);
    }
  });

  // update logout time when user disconnects for specific userID
  socket.on("disconnect", async () => {
    try {
      console.log("disconnect");

      const userID = socket.userID;

      if (userID && mongoose.Types.ObjectId.isValid(userID))
        await Activity.findOneAndUpdate(
          { userID: mongoose.Types.ObjectId(userID), logoutTime: null },
          { logoutTime: new Date() }
        );
    } catch (err) {
      console.log(err);
    }
  });
});

// chat socket
io.of("/chatroom").on("connection", (socket) => {
  console.log("New client connected");

  socket.on("join", (data) => {
    socket.join(data.room);
  });

  socket.on("message", (data) => {
    const newMessage = {
      sentBy: data.message.sentBy,
      time: data.message.time,
      type: data.message.messageType,
      message: data.message.text,
    };

    Chatroom.findOneAndUpdate(
      { _id: data.room },
      {
        $push: { chats: newMessage },
        lastMsg: newMessage,
      },
      { new: true }
    )
      .then((chatroom) => {})
      .catch((err) => {});

    io.of("/chatroom").to(data.room).emit("message", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Export the Socket.IO instance
exports.io = io;
