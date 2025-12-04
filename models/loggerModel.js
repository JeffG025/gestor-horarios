// models/loggerModel.js
const fs = require('fs');
const path = require('path');

// Definimos dónde se guardará el archivo
const logPath = path.join(__dirname, '../logs/auditoria.log');

const logger = {
    registrar: (accion) => {
        const fecha = new Date().toLocaleString();
        // Formato: [FECHA] - ACCION
        const linea = `[${fecha}] - ${accion}\n`;

        // Escribimos al final del archivo (append)
        fs.appendFile(logPath, linea, (err) => {
            if (err) console.error('Error escribiendo log:', err);
        });
    }
};

module.exports = logger;