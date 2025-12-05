// controllers/maestroController.js
const db = require('../config/db'); 
const maestroModel = require('../models/maestroModel');
const logger = require('../models/loggerModel');

const maestroController = {

    // 1. REGISTRAR (Con Validación de Rangos Estricta)
    registrarMaestro: (req, res) => {
        const { nombre, email, password, tipo_contrato, horas, rol } = req.body;
        
        // A. Validar Datos Básicos
        if (!nombre || !email || !password) {
            return res.status(400).json({ exito: false, mensaje: "Faltan datos obligatorios." });
        }

        // B. Validar Rango de Horas según Contrato (TU SOLICITUD)
        const h = parseInt(horas);
        if (isNaN(h)) return res.status(400).json({ exito: false, mensaje: "Las horas deben ser un número." });

        if (tipo_contrato === 'tiempo_completo') {
            // Tiempo Completo: 20 a 22 horas
            if (h < 20 || h > 22) {
                return res.status(400).json({ exito: false, mensaje: "⛔ Tiempo Completo debe tener entre 20 y 22 horas." });
            }
        } else {
            // Asignatura o Medio Tiempo: 18 a 20 horas
            if (h < 18 || h > 20) {
                return res.status(400).json({ exito: false, mensaje: "⛔ Asignatura/Medio Tiempo debe tener entre 18 y 20 horas." });
            }
        }

        const datosMySQL = { 
            nombre, 
            email, 
            password, 
            tipo_contrato, 
            horas: h, 
            rol: rol || 'maestro' 
        };
        
        maestroModel.crear(datosMySQL, (err, result) => {
            if (err) {
                console.error("Error MySQL:", err);
                return res.status(500).json({ exito: false, mensaje: "Error al guardar (¿Correo duplicado?)" });
            }
            logger.registrar(`NUEVO USUARIO: ${nombre} (${tipo_contrato} - ${h}hrs)`);
            res.json({ exito: true, mensaje: "Usuario creado correctamente." });
        });
    },

    // 2. LISTAR
    listarMaestros: (req, res) => {
        db.query("SELECT * FROM maestros ORDER BY nombre", (err, resultados) => {
            if (err) return res.status(500).json(err);
            res.json(resultados);
        });
    },

    // 3. VER MATERIAS
    verMateriasAsignadas: (req, res) => {
        const id = req.params.id;
        const sql = `
            SELECT ma.id as id_relacion, a.nombre, a.creditos 
            FROM maestros_asignaturas ma
            JOIN asignaturas a ON ma.id_asignatura = a.id
            WHERE ma.id_maestro = ?
        `;
        db.query(sql, [id], (err, resultados) => {
            if (err) return res.status(500).json(err);
            res.json(resultados);
        });
    },

    // 4. ASIGNAR MATERIA
    asignarMateria: (req, res) => {
        const { id_maestro, id_asignatura } = req.body;
        const sqlCheck = "SELECT * FROM maestros_asignaturas WHERE id_maestro = ? AND id_asignatura = ?";
        db.query(sqlCheck, [id_maestro, id_asignatura], (err, existe) => {
            if (existe.length > 0) return res.status(400).json({ exito: false, mensaje: "Ya tiene esa materia asignada." });

            const sql = "INSERT INTO maestros_asignaturas (id_maestro, id_asignatura) VALUES (?, ?)";
            db.query(sql, [id_maestro, id_asignatura], (err, result) => {
                if (err) return res.status(500).send("Error al asignar");
                logger.registrar(`PERFIL ACTUALIZADO: Docente ${id_maestro} - Materia ${id_asignatura}`);
                res.json({ exito: true });
            });
        });
    },

    // 5. QUITAR MATERIA
    quitarMateria: (req, res) => {
        const id_relacion = req.params.id;
        db.query("DELETE FROM maestros_asignaturas WHERE id = ?", [id_relacion], (err, r) => {
            if (err) return res.status(500).send("Error");
            res.json({ exito: true });
        });
    }
};

module.exports = maestroController;