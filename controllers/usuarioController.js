// controllers/usuarioController.js
const db = require('../config/db');
const logger = require('../models/loggerModel');

const usuarioController = {

    // 1. LISTAR TODOS LOS USUARIOS (Para ver a quién borrar)
    listarUsuarios: (req, res) => {
        // Traemos a todos MENOS al que está solicitando (para que no se borre a sí mismo)
        // Pero por simplicidad, traemos a todos.
        const sql = "SELECT id, nombre, email, rol, tipo_contrato FROM maestros ORDER BY nombre";
        
        db.query(sql, (err, resultados) => {
            if (err) return res.status(500).json({ error: "Error al listar usuarios" });
            res.json(resultados);
        });
    },

    // 2. ELIMINAR USUARIO
    eliminarUsuario: (req, res) => {
        const id = req.params.id;

        // Primero obtenemos el nombre para el Log
        db.query("SELECT nombre, email FROM maestros WHERE id = ?", [id], (err, datos) => {
            if (err || datos.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
            
            const nombreBorrado = datos[0].nombre;
            const emailBorrado = datos[0].email;

            // Ahora sí, lo borramos
            // Nota: Al borrar al maestro, MySQL borrará en cascada sus horarios asignados (gracias al ON DELETE CASCADE)
            const sqlDelete = "DELETE FROM maestros WHERE id = ?";

            db.query(sqlDelete, [id], (err, result) => {
                if (err) return res.status(500).send("Error al eliminar");

                // --- ARCHIVO SECUENCIAL ---
                logger.registrar(`USUARIO ELIMINADO: ${nombreBorrado} (${emailBorrado}) fue dado de baja por el Subdirector.`);

                res.json({ exito: true, mensaje: "🗑️ Usuario eliminado correctamente." });
            });
        });
    }
};

module.exports = usuarioController;