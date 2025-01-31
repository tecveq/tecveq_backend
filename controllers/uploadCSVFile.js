const fs = require('fs');
const csv = require('csv-parser');
const User = require('../models/user'); // Adjust the path as needed
const Level = require('../models/level');

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
                    const { ['Roll No']: RollNo, ['Card Number']: CardNumber, Name, Email, Gender, FatherName, LevelName, GuardianEmail, GuardianPhone } = row;

                    if (!RollNo || !Email || !Name || !LevelName || !GuardianEmail || !FatherName) {
                        console.warn(`Skipping row due to missing required fields:`, row);
                        continue; // Move to next row
                    }

                    let level = await Level.findOne({ name: LevelName });

                    const userExists = await User.findOne({ $or: [{ email: Email }, { rollNo: RollNo }] });

                    const parentExists = await User.findOne({ email: GuardianEmail, userType: "parent" });

                    if (level && userExists && parentExists) {
                        console.warn(`Skipping row as Level, Student, and Parent already exist:`, row);
                        continue; // Move to next row
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
                            userType: 'student',
                            gender: Gender || "Not specified",
                            guardianName: FatherName,
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
                            userType: 'parent',
                            password: "$2a$10$5dalLDxkCgHNs9wsO4mbYuL2zGUQVBu320HcXXTdJjocvxLh0laHO", // Dummy password
                        });

                        await newParent.save();
                    }
                }

                res.send('CSV file processed and valid users added to the database.');
            } catch (error) {
                console.error("Error processing CSV:", error);
                res.status(500).send('Error processing CSV file.');
            }
        });
};
