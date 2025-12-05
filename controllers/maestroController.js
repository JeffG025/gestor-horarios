// controllers/maestroController.js
const db = require('../config/db'); // Conexión directa para consultas
const maestroModel = require('../models/maestroModel');
const logger = require('../models/loggerModel');
const { admin } = require('../config/firebase'); // ✅ Esto extrae 'admin' del objeto
const maestroController = {

    // 1. REGISTRAR
    registrarMaestro: async (req, res) => {
        const { nombre, email, password, tipo_contrato, horas, rol } = req.body;
        try {
            // Firebase
            const usuarioFirebase = await admin.auth().createUser({
                email: email, password: password, displayName: nombre
            });
            // MySQL
            const datosMySQL = { nombre, email, password, tipo_contrato, horas, rol: rol || 'maestro' };
            
            maestroModel.crear(datosMySQL, (err, result) => {
                if (err) return res.status(500).send("Error BD");
                logger.registrar(`NUEVO USUARIO: ${nombre}`);
                res.json({ exito: true });
            });
        } catch (error) { res.status(500).send(error.message); }
    },

    // 2. LISTAR
    listarMaestros: (req, res) => {
        db.query("SELECT * FROM maestros ORDER BY nombre", (err, resultados) => {
            if (err) return res.status(500).json(err);
            res.json(resultados);
        });
    },

    // 3. VER MATERIAS (ESTA ES LA IMPORTANTE)
    verMateriasAsignadas: (req, res) => {
        const id = req.params.id;
        // Consulta corregida para asegurar nombres de columnas
        const sql = `
            SELECT ma.id as id_relacion, a.nombre, a.creditos 
            FROM maestros_asignaturas ma
            JOIN asignaturas a ON ma.id_asignatura = a.id
            WHERE ma.id_maestro = ?
        `;
        db.query(sql, [id], (err, resultados) => {
            if (err) {
                console.error("Error ver materias:", err);
                return res.status(500).json(err);
            }
            res.json(resultados);
        });
    },

    // 4. ASIGNAR MATERIA (EL BOTÓN VERDE)
    asignarMateria: (req, res) => {
        const { id_maestro, id_asignatura } = req.body;
        
        // Verificar si ya la tiene
        const sqlCheck = "SELECT * FROM maestros_asignaturas WHERE id_maestro = ? AND id_asignatura = ?";
        db.query(sqlCheck, [id_maestro, id_asignatura], (err, existe) => {
            if (existe.length > 0) return res.status(400).json({ exito: false, mensaje: "Ya tiene esa materia asignada." });

            const sql = "INSERT INTO maestros_asignaturas (id_maestro, id_asignatura) VALUES (?, ?)";
            db.query(sql, [id_maestro, id_asignatura], (err, result) => {
                if (err) return res.status(500).send("Error al asignar");
                logger.registrar(`MATERIA ASIGNADA: Docente ${id_maestro} - Materia ${id_asignatura}`);
                res.json({ exito: true });
            });
        });
    },

    // 5. QUITAR MATERIA
    quitarMateria: (req, res) => {
        const id_relacion = req.params.id;
        const sql = "DELETE FROM maestros_asignaturas WHERE id = ?";
        db.query(sql, [id_relacion], (err, r) => {
            if (err) return res.status(500).send("Error");
            res.json({ exito: true });
        });
    }
};

module.exports = maestroController;