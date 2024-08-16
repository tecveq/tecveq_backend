if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const session = require("express-session");
const cors = require("cors");
const passport = require("passport"); // authentication
const { initializingPassport } = require("./passportConfig");
const MongoStore = require("connect-mongo");

const userRouter = require("./routes/user");

const mongoose = require("mongoose");

var debug = require("debug")("tyre-project:server");
var http = require("http");
var https = require("https");
var fs = require("fs");
const classoomRouter = require("./routes/classroom");
const announcementRouter = require("./routes/announcements");
const subjectRouter = require("./routes/subject");
const levelRouter = require("./routes/level");
const classRouter = require("./routes/class");
const assignmentRouter = require("./routes/assignment");
const notificationRouter = require("./routes/notification");
const feedbackRouter = require("./routes/feedback");
const quizRouter = require("./routes/quiz");
const { io } = require("./utils/socket");
const { checkLoggedIn } = require("./middlewares/checkLoggedIn");
const authRouter = require("./routes/auth");

var app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(
  cors({
    credentials: true,
    // origin: ["http://localhost:3000",],
    origin: [process.env.CLIENT_BASE_URL],

    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    name: "finSess",
    secret: process.env.TOKEN_SECRET || "IAMCASTUDENT",
    resave: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_CONNECTION,
    }),
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
initializingPassport(passport);
app.use(passport.session());

// api routes
app.use("/api/auth/", authRouter);
app.use("/api/user/", checkLoggedIn, userRouter);
app.use("/api/classroom/", checkLoggedIn, classoomRouter);
app.use("/api/announcement/", checkLoggedIn, announcementRouter);
app.use("/api/subject/", checkLoggedIn, subjectRouter);
app.use("/api/level/", checkLoggedIn, levelRouter);
app.use("/api/class/", checkLoggedIn, classRouter);
app.use("/api/assignment/", checkLoggedIn, assignmentRouter);
app.use("/api/quiz/", checkLoggedIn, quizRouter);
app.use("/api/notification/", checkLoggedIn, notificationRouter);
app.use("/api/feedback/", checkLoggedIn, feedbackRouter);
app.use("/api/chatroom/", checkLoggedIn, require("./routes/chatroom"));
app.use("/api/parent", require("./routes/parent"));

app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "public", "index.html"));
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  console.log(err);
  // render the error page
  res.status(err.status || 500);
  res.send(err);
});

const db = process.env.MONGO_CONNECTION;
mongoose.connect(db, (err) => {
  if (err) {
    console.log(err);
  } else {
    console.log("Connected to MongoDB");
  }
});

var port = normalizePort(process.env.PORT || "3001");
app.set("port", port);

// production
const sslOptions = {
  key: fs.readFileSync("/etc/letsencrypt/live/manolms.com/privkey.pem"),
  cert: fs.readFileSync("/etc/letsencrypt/live/manolms.com/fullchain.pem")
}
/////////////////////////// Production

// development
// var server = http.createServer(app);
////////////////////// developent

// production
var server = http.createServer(sslOptions, app)

////////////////////////// production

// create socket
// const io = require("socket.io")(server, {
//   cors: {
//     origin: process.env.CLIENT_BASE_URL,
//     methods: ["GET", "POST"],
//   },
// });
// initializeSocket(io);
io.attach(server);

// development
// server.listen(port, () =>{
//   console.log(`Server is running on port ${port}`);
// });
////////////////////////////////

// production
server.listen(443, () =>{
  console.log(`AWS Server is running on port ${443}`);
});


http.createServer((req, res) => {
  res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
  res.end();
}).listen(80);

////////////////////////////////

server.on("error", onError);
server.on("listening", onListening);

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  var addr = server.address();
  var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  debug("Listening on " + bind);
}
