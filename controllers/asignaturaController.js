// controllers/asignaturaController.js
const db = require('../config/db');
const logger = require('../models/loggerModel');

const asignaturaController = {

    // 1. LISTAR TODAS
    listar: (req, res) => {
        db.query("SELECT * FROM asignaturas ORDER BY nombre", (err, resultados) => {
            if (err) return res.status(500).json({ error: "Error de BD" });
            res.json(resultados);
        });
    },

    // 2. CREAR NUEVA
    crear: (req, res) => {
        const { nombre, horas, creditos } = req.body;
        const sql = "INSERT INTO asignaturas (nombre, horas_semana, creditos) VALUES (?, ?, ?)";
        
        db.query(sql, [nombre, horas, creditos], (err, result) => {
            if (err) return res.status(500).send("Error al guardar");
            
            logger.registrar(`MATERIA CREADA: ${nombre} (${creditos} créditos)`);
            res.json({ exito: true, mensaje: "Materia creada correctamente" });
        });
    },

    // 3. EDITAR EXISTENTE
    editar: (req, res) => {
        const { id, nombre, horas, creditos } = req.body;
        const sql = "UPDATE asignaturas SET nombre = ?, horas_semana = ?, creditos = ? WHERE id = ?";
        
        db.query(sql, [nombre, horas, creditos, id], (err, result) => {
            if (err) return res.status(500).send("Error al actualizar");
            
            logger.registrar(`MATERIA EDITADA: ID ${id} -> ${nombre}`);
            res.json({ exito: true, mensaje: "Materia actualizada correctamente" });
        });
    },

    // 4. BORRAR
    eliminar: (req, res) => {
        const id = req.params.id;
        const sql = "DELETE FROM asignaturas WHERE id = ?";
        
        db.query(sql, [id], (err, result) => {
            if (err) return res.status(500).send("Error al eliminar");
            
            logger.registrar(`MATERIA ELIMINADA: ID ${id}`);
            res.json({ exito: true, mensaje: "Materia eliminada." });
        });
    }
};

module.exports = asignaturaController;