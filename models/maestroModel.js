// models/maestroModel.js
const db = require('../config/db');

const maestroModel = {
    crear: (datos, callback) => {
        // AHORA INCLUIMOS EL CAMPO 'rol' EN LA INSERCIÓN
        const query = 'INSERT INTO maestros (nombre, email, contrasena, tipo_contrato, horas_max_semana, rol) VALUES (?, ?, ?, ?, ?, ?)';
        
        db.query(query, [
            datos.nombre, 
            datos.email, 
            datos.password, 
            datos.tipo_contrato, 
            datos.horas,
            datos.rol // <--- Nuevo dato importante
        ], (err, result) => {
            if (err) callback(err, null);
            else callback(null, result);
        });
    }
};

module.exports = maestroModel;