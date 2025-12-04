// config/db.js
const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

// USAMOS POOL (PISCINA) EN LUGAR DE CONEXIÓN ÚNICA
// Esto maneja reconexiones automáticas si MySQL se cae
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestor_horarios_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Probamos que el pool funcione pidiendo una conexión prestada
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Error fatal en Pool de MySQL:', err.code);
        console.error('⚠️ Verifica que XAMPP esté encendido.');
    } else {
        console.log('✅ Pool de MySQL listo y conectado.');
        connection.release(); // Devolvemos la conexión a la piscina
    }
});

module.exports = pool;