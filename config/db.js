const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

const pool = mysql.createPool({
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'gestor_horarios_db',
    port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // VITAL: Esto permite la conexión segura en la nube
    ssl: { rejectUnauthorized: false }
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Error conexión BD:', err.message);
    } else {
        console.log('✅ Conectado a la Base de Datos.');
        connection.release();
    }
});
module.exports = pool;