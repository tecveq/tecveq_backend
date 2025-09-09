const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false, // Change to true if using Azure
        trustServerCertificate: true
    },
    port: Number(process.env.DB_PORT),
    connectionTimeout: 30000, // Increase timeout to 30 seconds
    requestTimeout: 30000 // Increase request timeout
};

const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log("Connected to MSSQL Database");
        return pool;
    })
    .catch(err => {
        console.error("Database Connection Failed:", err.message);
        process.exit(1);
    });

module.exports = { sql, poolPromise };