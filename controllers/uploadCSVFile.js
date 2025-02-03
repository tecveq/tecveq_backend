const fs = require('fs');
const csv = require('csv-parser');
const User = require('../models/user'); // Adjust the path as needed
const Level = require('../models/level');
const Classroom = require('../models/classroom');
const Subject = require('../models/subject');

// exports.addCSVFile = async (req, res, next) => {
//     if (!req.file) {
//         return res.status(400).send('No file uploaded.');
//     }

//     const results = [];

//     fs.createReadStream(req.file.path)
//         .pipe(csv())
//         .on('data', (data) => results.push(data))
//         .on('end', async () => {
//             try {
//                 for (const row of results) {
//                     const { ['Roll Number']: RollNo, ["Student Phone"]: StudentPhone, ['Card Number']: CardNumber, ["Student Name"]: Name, ["Student Email"]: Email, Gender, ["Guardian Name"]: FatherName, LevelName, ["Guardian Email"]: GuardianEmail, ["Guardian Phone"]: GuardianPhone } = row;

//                     if (!RollNo || !Email || !Name || !LevelName || !GuardianEmail || !FatherName) {
//                         console.warn(`Skipping row due to missing required fields:`, row);
//                         continue; // Move to next row
//                     }

//                     let level = await Level.findOne({ name: LevelName });

//                     const userExists = await User.findOne({ $or: [{ email: Email }, { rollNo: RollNo }] });

//                     const parentExists = await User.findOne({ email: GuardianEmail, userType: "parent" });

//                     if (level && userExists && parentExists) {
//                         console.warn(`Skipping row as Level, Student, and Parent already exist:`, row);
//                         continue; // Move to next row
//                     }

//                     if (!level) {
//                         level = new Level({ name: LevelName });
//                         await level.save();
//                     }

//                     const levelID = level._id;

//                     if (!userExists) {
//                         const newUser = new User({
//                             name: Name,
//                             email: Email,
//                             rollNo: RollNo,
//                             levelID: levelID,
//                             phoneNumber: StudentPhone || "000000",
//                             userType: 'student',
//                             gender: Gender || "Not specified",
//                             guardianName: FatherName,
//                             guardianPhoneNumber: GuardianPhone || "000000",
//                             password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO", // Dummy password
//                             referenceNo: CardNumber || "Not Defined",
//                         });

//                         await newUser.save();
//                     }

//                     if (!parentExists) {
//                         const newParent = new User({
//                             name: FatherName,
//                             email: GuardianEmail,
//                             phoneNumber: GuardianPhone || "Not specified",
//                             userType: 'parent',
//                             password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO", // Dummy password
//                         });

//                         await newParent.save();
//                     }
//                 }

//                 res.send('CSV file processed and valid users added to the database.');
//             } catch (error) {
//                 console.error("Error processing CSV:", error);
//                 res.status(500).send('Error processing CSV file.');
//             }
//         });
// };



exports.addCSVFile = async (req, res, next) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const results = [];

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            try {
                for (const row of results) {
                    const { classroom_name, level_name, student_email, teacher_email, subject_name, type } = row;

                    if (!classroom_name || !level_name || !student_email || !teacher_email || !subject_name || !type) {
                        console.warn(`Skipping row due to missing required fields:`, row);
                        continue;
                    }

                    // Check if the level exists, otherwise create it
                    let level = await Level.findOne({ name: level_name });
                    if (!level) {
                        level = new Level({ name: level_name });
                        await level.save();
                    }

                    // Check if the classroom exists, otherwise create it
                    let classroom = await Classroom.findOne({ name: classroom_name, levelID: level._id });
                    if (!classroom) {
                        classroom = new Classroom({
                            name: classroom_name,
                            levelID: level._id,
                            students: [],
                            teachers: [],
                        });
                        await classroom.save();
                    }

                    // Find or create the student
                    let student = await User.findOne({ email: student_email, userType: "student" });
                    if (!student) {
                        student = new User({
                            name: student_email.split('@')[0], // Using email prefix as a name
                            email: student_email,
                            gender: "male",
                            userType: "student",
                            password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO", // Dummy password
                        });
                        await student.save();
                    }

                    // Add student to the classroom if not already present
                    if (!classroom.students.includes(student._id)) {
                        classroom.students.push(student._id);
                    }

                    // Find or create the teacher
                    let teacher = await User.findOne({ email: teacher_email, userType: "teacher" });
                    if (!teacher) {
                        teacher = new User({
                            name: teacher_email.split('@')[0], // Using email prefix as a name
                            email: teacher_email,
                            userType: "teacher",
                            password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO", // Dummy password
                        });
                        await teacher.save();
                    }

                    // Find or create the subject
                    let subject = await Subject.findOne({ name: subject_name });
                    if (!subject) {
                        subject = new Subject({
                            name: subject_name,
                            levelID: level._id,
                        });
                        await subject.save();
                    }

                    // Add teacher with subject & role (head/teacher) to classroom
                    const existingTeacher = classroom.teachers.find(t => t.teacher.toString() === teacher._id.toString());
                    if (!existingTeacher) {
                        classroom.teachers.push({
                            teacher: teacher._id,
                            subject: subject._id,
                            type: type, // "head" or "teacher"
                        });
                    }

                    // Save updated classroom data
                    await classroom.save();
                }

                res.send('CSV file processed successfully, and data stored in the database.');
            } catch (error) {
                console.error("Error processing CSV:", error);
                res.status(500).send('Error processing CSV file.');
            }
        });
};
