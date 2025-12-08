// controllers/asignaturaController.js
const db = require('../config/db');

const asignaturaController = {
    
    // 1. LISTAR (Ordenamos por Semestre y luego por Nombre)
    listar: (req, res) => {
        db.query("SELECT * FROM asignaturas ORDER BY semestre ASC, nombre ASC", (err, resultados) => {
            if (err) return res.status(500).json(err);
            res.json(resultados);
        });
    },

    // 2. CREAR (Ahora recibe 'semestre')
    crear: (req, res) => {
        const { nombre, creditos, semestre } = req.body;
        
        if (!nombre || !creditos || !semestre) {
            return res.status(400).json({ exito: false, mensaje: "Faltan datos." });
        }

        const sql = "INSERT INTO asignaturas (nombre, creditos, semestre) VALUES (?, ?, ?)";
        db.query(sql, [nombre, creditos, semestre], (err, result) => {
            if (err) return res.status(500).json({ exito: false, mensaje: "Error BD" });
            res.json({ exito: true, mensaje: "Materia creada." });
        });
    },

    // 3. EDITAR (Ahora actualiza 'semestre')
    editar: (req, res) => {
        const { id, nombre, creditos, semestre } = req.body;

        const sql = "UPDATE asignaturas SET nombre = ?, creditos = ?, semestre = ? WHERE id = ?";
        db.query(sql, [nombre, creditos, semestre, id], (err, result) => {
            if (err) return res.status(500).json({ exito: false, mensaje: "Error BD" });
            res.json({ exito: true, mensaje: "Materia actualizada." });
        });
    },

    // 4. ELIMINAR
    eliminar: (req, res) => {
        const id = req.params.id;
        db.query("DELETE FROM asignaturas WHERE id = ?", [id], (err, result) => {
            if (err) return res.status(500).json({ exito: false, mensaje: "No se puede eliminar (quizás ya tiene horarios asignados)." });
            res.json({ exito: true });
        });
    }
};

module.exports = asignaturaController;