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
const attendenceRouter = require("./routes/attendenceRouter");
const feedbackRouter = require("./routes/feedback");
const quizRouter = require("./routes/quiz");
const { io } = require("./utils/socket");
const { checkLoggedIn } = require("./middlewares/checkLoggedIn");
const authRouter = require("./routes/auth");
var app = express();
let isProduction = process.env.NODE_ENV == "production";
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  cors({
    credentials: true,
    origin: isProduction
      ? ["https://your-production-site.com", "*"]  // Production URLs only
      : ["http://localhost:5173", "*"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
    cookie: isProduction
      ? {
        secure: true,
        sameSite: "none",
      }
      : {
        sameSite: "lax", // "none" for cross-origin, "lax" for development
        httpOnly: true, // Prevent JavaScript access to cookies

      },
  })
);
app.use(passport.initialize());
initializingPassport(passport);
app.use(passport.session());
// api routes
app.use("/api/auth/", authRouter);
app.use("/api/level/", levelRouter);
app.use("/api/quiz/", checkLoggedIn, quizRouter);
app.use("/api/user/", checkLoggedIn, userRouter);
app.use("/api/class/", checkLoggedIn, classRouter);
app.use("/api/subject/", checkLoggedIn, subjectRouter);
app.use("/api/feedback/", checkLoggedIn, feedbackRouter);
app.use("/api/classroom/", checkLoggedIn, classoomRouter);
app.use("/api/classroom/attendence", checkLoggedIn, attendenceRouter);
app.use("/api/assignment/", checkLoggedIn, assignmentRouter);
app.use("/api/notification/", checkLoggedIn, notificationRouter);
app.use("/api/announcement/", checkLoggedIn, announcementRouter);
app.use("/api/parent", require("./routes/parent"));
app.use("/api/chatroom/", checkLoggedIn, require("./routes/chatroom"));
app.get("/", (req, res) => {
  // res.sendFile(path.resolve(__dirname, "public", "index.html"));
  return res.send({
    success: true,
    lastCount: 100,
    count: 101,
    message: "Backend live on AWS!",
  });

});
app.get("/developers", (req, res) => {
  // res.sendFile(path.resolve(__dirname, "public", "index.html"));
  return res.send({
    developers: ["Mustafa", "Muneeb", "Hassan"],
  });
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
mongoose.connect(
  db,
  { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: true },
  (err) => {
    if (err) {
      console.log(err);
    } else {
      console.log("Connected to MongoDB");
    }
  }
);
var port = isProduction ? 443 : 4000;
const sslOptions = isProduction
  ? {
    key: fs.readFileSync("/etc/letsencrypt/live/manolms.com/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/manolms.com/fullchain.pem"),
  }
  : undefined;
var server = isProduction
  ? https.createServer(sslOptions, app)
  : http.createServer(app);
io.attach(server);
server.listen(port, () => {
  if (isProduction) {
    console.log(`AWS Server is running on port ${443}`);
  } else {
    console.log(`Server is running on port ${port}`);
  }
});
isProduction &&
  http
    .createServer((req, res) => {
      res.writeHead(301, {
        Location: "https://" + req.headers["host"] + req.url,
      });
      res.end();
    })
    .listen(80);
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










