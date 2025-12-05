// config/db.js - MEJORADO
const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306, // Puerto importante
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Esta línea es vital para bases de datos en la nube (SSL)
    ssl: { rejectUnauthorized: false } 
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ ERROR FATAL DE CONEXIÓN A BD:');
        console.error(err.code);
        console.error(err.sqlMessage);
    } else {
        console.log('✅ Conexión exitosa a la Base de Datos Remota.');
        connection.release();
    }
});

module.exports = pool;