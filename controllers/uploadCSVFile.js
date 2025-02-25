const fs = require("fs");
const csv = require("csv-parser");
const User = require("../models/user");
const Level = require("../models/level");
const Classroom = require("../models/classroom");
const Subject = require("../models/subject");
const mongoose = require("mongoose");

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
    try {
        for (const row of results) {
            try {
                let { ["Subject Name"]: Subject_Name, ["Level Name"]: Level_Name } = row;

                // ✅ Step 1: Validate and Normalize Input Data
                if (!Subject_Name || !Level_Name) {
                    console.warn("Skipping row due to missing required fields:", row);
                    continue;
                }

                // Normalize the names (trim to avoid extra spaces)
                Subject_Name = Subject_Name.trim();
                Level_Name = Level_Name.trim();

                console.log(`Processing Subject: ${Subject_Name} for Level: ${Level_Name}`);

                // ✅ Step 2: Check if Level Exists
                let level = await Level.findOne({ name: Level_Name });
                if (!level) {
                    console.log(`Creating new level: ${Level_Name}`);
                    level = new Level({ name: Level_Name });
                    await level.save();
                    console.log(`Level created successfully: ${Level_Name}`);
                }
                const levelID = level._id;

                // ✅ Step 3: Check if the combination of Subject and Level already exists.
                const existingSubject = await Subject.findOne({ name: Subject_Name, levelID: levelID });
                if (existingSubject) {
                    console.warn(`Skipping: Subject '${Subject_Name}' already exists in level '${Level_Name}'.`);
                    continue;
                }

                console.log(`Adding new subject: ${Subject_Name} under level: ${Level_Name}`);

                // ✅ Step 4: Insert New Subject
                const newSubject = new Subject({
                    name: Subject_Name,
                    levelID: levelID,
                });
                await newSubject.save();
                console.log(`✅ Subject added: ${Subject_Name} for Level: ${Level_Name}`);
            } catch (error) {
                console.error("❌ Error processing row:", row, error);
                continue;
            }
        }
    } catch (error) {
        console.error("❌ Fatal error processing CSV:", error);
    }
};



// Function to process Student CSV
const processStudentCSV = async (results) => {
    for (const row of results) {
        try {
            const {
                ["Roll Number"]: RollNo,
                ["Student Phone"]: StudentPhone,
                ["Card Number"]: CardNumber,
                ["Student Name"]: Name,
                ["Student Email"]: Email,
                Gender,
                ["Guardian Name"]: FatherName,
                ["Level Name"]: LevelName,
                ["Guardian Email"]: GuardianEmail,
                ["Guardian Phone"]: GuardianPhone,
            } = row;

            // 1. Validate RollNo
            if (!RollNo || RollNo.trim() === "") {
                console.warn("Skipping row due to missing Roll Number:", row);
                continue;
            }

            // Convert RollNo to string
            const rollNumberString = RollNo.trim();

            // 2. Validate other required fields
            if (!Name || !LevelName || !FatherName) {
                console.warn("Skipping row due to missing required fields:", row);
                continue;
            }

            // 3. Check or create Level
            let level = await Level.findOne({ name: LevelName });
            if (!level) {
                level = new Level({ name: LevelName });
                await level.save();
            }
            const levelID = level._id;

            // Default email values if empty
            const studentEmail = Email && Email.trim() !== "" ? Email : `${rollNumberString}@educativecloud.com`;
            const guardianEmail = GuardianEmail && GuardianEmail.trim() !== "" ? GuardianEmail : `${rollNumberString}.guardian@educativecloud.com`;
            const generatedReferenceNo = CardNumber || `${Date.now()}${Math.floor(Math.random() * 1000)}`;

            // 4. Upsert the Student (userType: "student")
            await User.findOneAndUpdate(
                {
                    $or: [
                        { email: studentEmail },
                        { rollNo: rollNumberString }
                    ]
                },
                {
                    name: Name,
                    email: studentEmail,
                    rollNo: rollNumberString,
                    levelID: levelID,
                    phoneNumber: StudentPhone || "000000",
                    userType: "student",
                    gender: Gender || "Not specified",
                    guardianName: FatherName,
                    guardianEmail: guardianEmail,
                    guardianPhoneNumber: GuardianPhone || "000000",
                    password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO",
                    referenceNo: generatedReferenceNo,
                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                }
            );

            // 5. Upsert the Parent (userType: "parent")
            await User.findOneAndUpdate(
                { email: guardianEmail, userType: "parent" },
                {
                    name: FatherName,
                    email: guardianEmail,
                    phoneNumber: GuardianPhone || "000000",
                    userType: "parent",
                    password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO",
                    rollNo: `${rollNumberString}-Parent`,
                    referenceNo: `${generatedReferenceNo}786`,

                },
                {
                    upsert: true,
                    new: true,
                    setDefaultsOnInsert: true,
                }
            );
        } catch (error) {
            console.error("Error processing row:", row, error);
            continue; // Continue processing the next row
        }
    }
};




// Function to process Teacher CSV
const processTeacherCSV = async (results) => {
    for (const row of results) {
        try {
            const {
                ["Teacher Phone"]: TeacherPhone,
                ["Teacher Name"]: Name,
                ["Teacher Email"]: Email,
                ["Teacher Employee ID"]: TeacherEmployeeID
            } = row;

            // Ensure required fields are present
            if (!Email || !Name) {
                console.warn(" ❌ Skipping row due to missing required fields:", row);
                continue;
            }

            console.log(`Processing Teacher: ${Name}, Email: ${Email}`);

            // Check if the teacher already exists
            const teacherExists = await User.findOne({ email: Email });

            if (teacherExists) {
                console.warn("❌ Skipping row as teacher already exists:", row);
                continue;
            }

            const generatedRollNo = `${Date.now()}${Math.floor(Math.random() * 1000)}`;


            // Create and save new teacher
            const newTeacher = new User({
                name: Name,
                email: Email,
                referenceNo: TeacherEmployeeID,
                phoneNumber: TeacherPhone || "000000",
                gender: "not specified",
                userType: "teacher",
                password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO", // Dummy password
                rollNo: generatedRollNo,
            });

            await newTeacher.save();
            console.log(`Teacher added successfully: ${Name}`);

        } catch (error) {
            console.error(" ❌ Error processing teacher CSV row:", row, error);
            continue;
        }
    }
};


// Function to process Classroom CSV

const processClassroomCSV = async (results, currUser) => {
    for (const row of results) {
        try {
            const { classroom_name, level_name, student_email, teacher_email, subject_name, type } = row;

            if (!classroom_name || !level_name) {
                console.warn("❌ Skipping row due to missing required fields:", row);
                continue;
            }

            let level;
            try {
                level = await Level.findOne({ name: level_name });
                if (!level) {
                    level = new Level({ name: level_name });
                    await level.save();
                    console.log(`✅ Created new level: ${level_name}`);
                }
            } catch (error) {
                console.error(`❌ Error finding/saving level (${level_name}):`, error);
                continue;
            }

            let classroom;
            try {
                classroom = await Classroom.findOne({ name: classroom_name, levelID: level._id });
                if (!classroom) {
                    classroom = new Classroom({
                        name: classroom_name,
                        levelID: level._id,
                        students: [],
                        teachers: [],
                        createdBy: currUser?._id,
                    });
                    await classroom.save();
                    console.log(`✅ Created new classroom: ${classroom_name}`);
                }
            } catch (error) {
                console.error(`❌ Error finding/saving classroom (${classroom_name}):`, error);
                continue;
            }

            const generatedReferenceNo = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

            let student;
            try {
                student = await User.findOne({ email: student_email, userType: "student" });
                if (!student) {
                    student = new User({
                        name: `${student_email.split("@")[0]} student`,
                        email: student_email,
                        userType: "student",
                        gender: "Not specified",
                        password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO",
                        rollNo: student_email.split("@")[0],
                        phoneNumber: "000000",
                        referenceNo: generatedReferenceNo,
                        guardianName: `${student_email.split("@")[0]} guardian`,
                        guardianEmail: student_email.split("@")[0] + ".guardian@educativecloud.com",
                        guardianPhoneNumber: "000000",
                    });
                    await student.save();
                    console.log(`✅ Created new student: ${student_email}`);
                }
            } catch (error) {
                console.error(`❌ Error finding/saving student (${student_email}):`, error);
                continue;
            }

            if (!classroom.students.includes(student._id)) {
                classroom.students.push(student._id);
            }

            if (teacher_email && subject_name && type) {
                console.log(`ℹ️ Processing teacher-subject assignment for: ${teacher_email} - ${subject_name}`);

                let teacher;
                const teacherReferenceNo = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
                const teacherRollNo = `${Date.now()}${Math.floor(Math.random() * 1000)}`;


                try {
                    teacher = await User.findOne({ email: teacher_email, userType: "teacher" });
                    if (!teacher) {
                        teacher = new User({
                            name: teacher_email.split("@")[0],
                            email: teacher_email,
                            gender: "Not specified",
                            userType: "teacher",
                            referenceNo: teacherReferenceNo,
                            password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO",
                            rollNo: teacherRollNo,
                            phoneNumber: "000000",
                        });
                        await teacher.save();
                        console.log(`✅ Created new teacher: ${teacher_email}`);
                    }
                } catch (error) {
                    console.error(`❌ Error finding/saving teacher (${teacher_email}):`, error);
                    continue;
                }

                let subject;
                try {
                    subject = await Subject.findOne({ name: subject_name, levelID: level._id });
                    if (!subject) {
                        subject = new Subject({ name: subject_name, levelID: level._id });
                        await subject.save();
                        console.log(`✅ Created new subject: ${subject_name}`);
                    }
                } catch (error) {
                    if (error.code === 11000) {
                        console.warn(`❌ Skipping duplicate subject: ${subject_name}`);
                    } else {
                        console.error(`❌ Error finding/saving subject (${subject_name}):`, error);
                    }
                    continue;
                }

                const teacherExistsInClassroom = classroom.teachers.some(
                    (t) =>
                        t.teacher.toString() === teacher._id.toString() &&
                        t.subject.toString() === subject._id.toString() &&
                        t.type === type
                );

                if (!teacherExistsInClassroom) {
                    classroom.teachers.push({
                        teacher: new mongoose.Types.ObjectId(teacher._id),
                        subject: new mongoose.Types.ObjectId(subject._id),
                        type: type,
                    });
                    console.log(`✅ Assigned Teacher: ${teacher.email} to Subject: ${subject.name} in Classroom: ${classroom.name}`);
                } else {
                    console.warn(`❌ Skipping duplicate teacher assignment: ${teacher_email} - ${subject_name}`);
                }
            }

            try {
                await classroom.save();
            } catch (error) {
                console.error(`❌ Error saving classroom (${classroom_name}):`, error);
            }
        } catch (error) {
            console.error("❌ Fatal error processing row:", error);
        }
    }
};





