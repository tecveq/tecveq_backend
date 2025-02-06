const fs = require("fs");
const csv = require("csv-parser");
const User = require("../models/user");
const Level = require("../models/level");
const Classroom = require("../models/classroom");
const Subject = require("../models/subject");

// Function to determine CSV type
const determineCSVType = (headers) => {
    if (headers.includes("Roll Number") && headers.includes("Student Name")) {
        return "student";
    }
    if (headers.includes("Teacher Name") && headers.includes("Teacher Email")) {
        return "teacher";
    }
    if (headers.includes("classroom_name") && headers.includes("level_name")) {
        return "classroom";
    }
    if (headers.includes("Subject Name") && headers.includes("Level Name")) {
        return "subject";
    }
    return null;
};

// Unified CSV Import Function
exports.addCSVFile = async (req, res, next) => {
    if (!req.file) {
        return res.status(400).send("No file uploaded.");
    }

    const results = [];
    let fileType = null;

    // Read CSV file
    const stream = fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("headers", (headers) => {
            fileType = determineCSVType(headers);
        })
        .on("data", (data) => results.push(data))
        .on("end", async () => {
            if (!fileType) {
                return res.status(400).send("Invalid CSV format.");
            }

            try {
                if (fileType === "student") {
                    await processStudentCSV(results);
                } else if (fileType === "teacher") {
                    await processTeacherCSV(results);
                } else if (fileType === "classroom") {
                    await processClassroomCSV(results, req.user);
                } else if (fileType === "subject") {
                    await processSubjectCSV(results);
                }

                res.send("CSV file processed successfully.");
            } catch (error) {
                console.error("Error processing CSV:", error);
                res.status(500).send("Error processing CSV file.");
            }
        });

    stream.on("error", (error) => {
        console.error("CSV Stream Error:", error);
        res.status(500).send("Error reading CSV file.");
    });
};

// Function to process Subject CSV


const processSubjectCSV = async (results) => {
    for (const row of results) {
        const {
            ["Subject Name"]: Subject_Name,
            ["Level Name"]: Level_Name,

        } = row;

        if (!Subject_Name || !Level_Name) {
            console.warn("Skipping row due to missing required fields:", row);
            continue;
        }

        let level = await Level.findOne({ name: Level_Name });


        if (level) {
            console.warn("Skipping row as Level, Student, and Parent already exist:", row);
            continue;
        }

        if (!level) {
            level = new Level({ name: Level_Name });
            await level.save();
        }

        const levelID = level._id;

        const subject = new Subject({
            name: Subject_Name,
            levelID: levelID,
        });

        if (!subject) {
            const newSubjectWithLevel = new Subject({
                name: Subject_Name,
                levelID: levelID,

            });

            await newSubjectWithLevel.save();
        }
    }
};
// Function to process Student CSV
const processStudentCSV = async (results) => {
    for (const row of results) {
        const {
            ["Roll Number"]: RollNo,
            ["Student Phone"]: StudentPhone,
            ["Card Number"]: CardNumber,
            ["Student Name"]: Name,
            ["Student Email"]: Email,
            Gender,
            ["Guardian Name"]: FatherName,
            LevelName,
            ["Guardian Email"]: GuardianEmail,
            ["Guardian Phone"]: GuardianPhone,
        } = row;

        if (!RollNo || !Email || !Name || !LevelName || !GuardianEmail || !FatherName) {
            console.warn("Skipping row due to missing required fields:", row);
            continue;
        }

        let level = await Level.findOne({ name: LevelName });

        const userExists = await User.findOne({ $or: [{ email: Email }, { rollNo: RollNo }] });
        const parentExists = await User.findOne({ email: GuardianEmail, userType: "parent" });

        if (level && userExists && parentExists) {
            console.warn("Skipping row as Level, Student, and Parent already exist:", row);
            continue;
        }

        if (!level) {
            level = new Level({ name: LevelName });
            await level.save();
        }

        const levelID = level._id;

        if (!userExists) {
            const newUser = new User({
                name: Name,
                email: Email,
                rollNo: RollNo,
                levelID: levelID,
                phoneNumber: StudentPhone || "000000",
                userType: "student",
                gender: Gender || "Not specified",
                guardianName: FatherName,
                guardianPhoneNumber: GuardianPhone || "000000",
                password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO", // Dummy password
                referenceNo: CardNumber || "Not Defined",
            });

            await newUser.save();
        }

        if (!parentExists) {
            const newParent = new User({
                name: FatherName,
                email: GuardianEmail,
                phoneNumber: GuardianPhone || "Not specified",
                userType: "parent",
                password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO", // Dummy password
            });

            await newParent.save();
        }
    }
};

// Function to process Teacher CSV
const processTeacherCSV = async (results) => {
    for (const row of results) {
        const { ["Teacher Phone"]: TeacherPhone, ["Teacher Name"]: Name, ["Teacher Email"]: Email } = row;

        if (!Email || !Name) {
            console.warn("Skipping row due to missing required fields:", row);
            continue;
        }

        const teacherExists = await User.findOne({ email: Email });

        if (teacherExists) {
            console.warn("Skipping row as teacher already exists:", row);
            continue;
        }

        const newTeacher = new User({
            name: Name,
            email: Email,
            phoneNumber: TeacherPhone || "000000",
            gender: "",
            userType: "teacher",
            password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO", // Dummy password
        });

        await newTeacher.save();
    }
};

// Function to process Classroom CSV
const processClassroomCSV = async (results, currUser) => {
    for (const row of results) {
        const { classroom_name, level_name, student_email, teacher_email, subject_name, type } = row;

        if (!classroom_name || !level_name || !student_email || !teacher_email || !subject_name || !type) {
            console.warn("Skipping row due to missing required fields:", row);
            continue;
        }

        let level = await Level.findOne({ name: level_name });
        if (!level) {
            level = new Level({ name: level_name });
            await level.save();
        }

        let classroom = await Classroom.findOne({ name: classroom_name, levelID: level._id });
        if (!classroom) {
            classroom = new Classroom({
                name: classroom_name,
                levelID: level._id,
                students: [],
                teachers: [],
                createdBy: currUser?._id,
            });
            await classroom.save();
        }

        let student = await User.findOne({ email: student_email, userType: "student" });
        if (!student) {
            student = new User({
                name: student_email.split("@")[0],
                email: student_email,
                userType: "student",
                gender: "Not specified",
                password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO",
            });
            await student.save();
        }

        if (!classroom.students.includes(student._id)) {
            classroom.students.push(student._id);
        }

        let teacher = await User.findOne({ email: teacher_email, userType: "teacher" });
        if (!teacher) {
            teacher = new User({
                name: teacher_email.split("@")[0],
                email: teacher_email,
                gender: "Not specified",
                userType: "teacher",
                password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO",
            });
            await teacher.save();
        }

        // ✅ Check if the subject already exists
        let subject = await Subject.findOne({ name: subject_name, levelID: level._id });
        if (!subject) {
            try {
                subject = new Subject({ name: subject_name, levelID: level._id });
                await subject.save();
            } catch (error) {
                if (error.code === 11000) {
                    console.warn(`Skipping duplicate subject: ${subject_name}`);
                    continue; // Skip the duplicate entry
                } else {
                    throw error; // Re-throw unexpected errors
                }
            }
        } else {
            console.warn(`Skipping existing subject: ${subject_name}`);
        }

        // ✅ Prevent duplicate teacher-subject assignments
        const teacherExistsInClassroom = classroom.teachers.some(
            (t) => t.teacher.equals(teacher._id) && t.subject.equals(subject._id) && t.type === type
        );

        if (!teacherExistsInClassroom) {
            classroom.teachers.push({ teacher: teacher._id, subject: subject._id, type });
        } else {
            console.warn(`Skipping duplicate teacher assignment: ${teacher_email} - ${subject_name}`);
        }

        await classroom.save();
    }
};

