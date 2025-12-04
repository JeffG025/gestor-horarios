// controllers/horarioController.js
const db = require('../config/db');
const logger = require('../models/loggerModel');

const horarioController = {

    // 1. OBTENER DATOS
    obtenerDatosFormulario: (req, res) => {
        const sqlMaestros = "SELECT id, nombre FROM maestros";
        const sqlAulas = "SELECT id, nombre FROM aulas";
        const sqlAsignaturas = "SELECT id, nombre, semestre, creditos FROM asignaturas ORDER BY nombre";
        const sqlGrupos = "SELECT id, nombre, cantidad_alumnos, semestre FROM grupos ORDER BY nombre";

        db.query(sqlMaestros, (err, maestros) => {
            if (err) return res.status(500).json(err);
            db.query(sqlAulas, (err, aulas) => {
                if (err) return res.status(500).json(err);
                db.query(sqlAsignaturas, (err, asignaturas) => {
                    if (err) return res.status(500).json(err);
                    db.query(sqlGrupos, (err, grupos) => {
                        if (err) return res.status(500).json(err);
                        res.json({ maestros, aulas, asignaturas, grupos });
                    });
                });
            });
        });
    },

    // 2. CONSULTAR HORAS
    consultarHorasMaestro: (req, res) => {
        const id_maestro = req.params.id;
        const sql = "SELECT nombre, horas_max_semana FROM maestros WHERE id = ?";
        const sqlOc = "SELECT COUNT(*) as ocupadas FROM horarios_asignados WHERE id_maestro = ?";
        db.query(sql, [id_maestro], (e, r) => {
            if(e || r.length===0) return res.json({nombre:'-',maximas:0,ocupadas:0,restantes:0});
            const max = r[0].horas_max_semana;
            db.query(sqlOc, [id_maestro], (e2, r2) => {
                const oc = r2[0].ocupadas;
                res.json({ nombre: r[0].nombre, maximas: max, ocupadas: oc, restantes: max - oc });
            });
        });
    },

    // 3. ASIGNAR CLASE (CREAR)
    asignarClase: (req, res) => {
        let { id_aula, id_maestro, id_asignatura, id_grupo, hora_inicio, num_alumnos } = req.body;
        
        if (id_maestro === "0" || id_maestro === "") id_maestro = null;
        const alumnos = parseInt(num_alumnos);
        if (!alumnos || alumnos < 10) return res.status(400).json({ exito: false, mensaje: "⛔ Mínimo 10 alumnos." });

        let [h, m] = hora_inicio.split(':');
        let hNext = parseInt(h) + 1;
        let hNext2 = parseInt(h) + 2;
        const hora_fin = `${hNext.toString().padStart(2, '0')}:${m}:00`;
        const hora_inicio_extra = hora_fin; 
        const hora_fin_extra = `${hNext2.toString().padStart(2, '0')}:${m}:00`; 

        // 3.1 Validar Perfil (Si hay maestro)
        const validarPerfil = (cb) => {
            if (!id_maestro) return cb();
            const sqlPerfil = "SELECT * FROM maestros_asignaturas WHERE id_maestro = ? AND id_asignatura = ?";
            db.query(sqlPerfil, [id_maestro, id_asignatura], (errP, resP) => {
                if (resP.length === 0) return res.status(400).json({ exito: false, mensaje: "⛔ Docente NO autorizado para esta materia." });
                cb();
            });
        };

        validarPerfil(() => {
            // 3.2 Validar duplicados
            const sqlDup = "SELECT * FROM horarios_asignados WHERE id_grupo = ? AND id_asignatura = ?";
            db.query(sqlDup, [id_grupo, id_asignatura], (errDup, resDup) => {
                if (resDup.length > 0) return res.status(400).json({ exito: false, mensaje: "⛔ Materia ya asignada al grupo." });

                // 3.3 Créditos
                db.query("SELECT creditos, nombre FROM asignaturas WHERE id = ?", [id_asignatura], (err, resCreditos) => {
                    const creditos = resCreditos[0].creditos;
                    const nombreMat = resCreditos[0].nombre;

                    // 3.4 Horas Maestro
                    const checkMaestro = (cb) => {
                        if (!id_maestro) return cb();
                        db.query(`SELECT m.horas_max_semana, (SELECT COUNT(*) FROM horarios_asignados WHERE id_maestro = ?) as ocupadas FROM maestros m WHERE m.id = ?`, [id_maestro, id_maestro], (e, r) => {
                            if (creditos > (r[0].horas_max_semana - r[0].ocupadas)) return res.status(400).json({ exito: false, mensaje: "⛔ Horas insuficientes." });
                            cb();
                        });
                    };

                    checkMaestro(() => {
                        // 3.5 Días
                        let diasBase = [], diasExtra = [];
                        if (creditos === 4) diasBase = ['Lunes', 'Martes', 'Miercoles', 'Jueves'];
                        else if (creditos >= 5) diasBase = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
                        if (creditos === 6) diasExtra = ['Viernes'];
                        else if (creditos === 7) diasExtra = ['Jueves', 'Viernes'];
                        else if (creditos === 8) diasExtra = ['Miercoles', 'Jueves', 'Viernes'];
                        else if (creditos === 9) diasExtra = ['Martes', 'Miercoles', 'Jueves', 'Viernes'];
                        else if (creditos === 10) diasExtra = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

                        let registros = [], condiciones = [], valoresQuery = [];
                        const add = (dia, ini, fin) => {
                            registros.push([id_aula, id_maestro, id_asignatura, id_grupo, dia, ini, fin, alumnos]);
                            let cond = `(id_aula = ? OR id_grupo = ?`;
                            if (id_maestro) cond += ` OR id_maestro = ?`;
                            cond += `) AND dia_semana = ? AND hora_inicio = ?`;
                            condiciones.push(cond);
                            valoresQuery.push(id_aula, id_grupo);
                            if (id_maestro) valoresQuery.push(id_maestro);
                            valoresQuery.push(dia, ini);
                        };
                        diasBase.forEach(d => add(d, hora_inicio, hora_fin));
                        diasExtra.forEach(d => add(d, hora_inicio_extra, hora_fin_extra));

                        // 3.6 Validar Choque
                        const sqlValidar = `SELECT * FROM horarios_asignados WHERE ${condiciones.join(' OR ')}`;
                        db.query(sqlValidar, valoresQuery, (errVal, choques) => {
                            if (choques && choques.length > 0) {
                                const c = choques[0];
                                return res.status(400).json({ exito: false, mensaje: `❌ CHOQUE: ${c.dia_semana} ${c.hora_inicio} ocupado.` });
                            }

                            const sqlInsert = `INSERT INTO horarios_asignados (id_aula, id_maestro, id_asignatura, id_grupo, dia_semana, hora_inicio, hora_fin, num_alumnos) VALUES ?`;
                            db.query(sqlInsert, [registros], (errIns) => {
                                if (errIns) return res.status(500).json({ exito: false, mensaje: "Error BD" });
                                logger.registrar(`ASIGNACIÓN: ${nombreMat} - Gpo ${id_grupo}`);
                                res.json({ exito: true, mensaje: "✅ Asignación guardada." });
                            });
                        });
                    });
                });
            });
        });
    },

    // 4, 5, 6. VER HORARIOS
    verHorarioAula: (req, res) => {
        const sql = `SELECT h.*, m.nombre as maestro, a.nombre as asignatura, g.nombre as grupo FROM horarios_asignados h LEFT JOIN maestros m ON h.id_maestro = m.id LEFT JOIN asignaturas a ON h.id_asignatura = a.id LEFT JOIN grupos g ON h.id_grupo = g.id WHERE h.id_aula = ?`;
        db.query(sql, [req.params.id_aula], (err, r) => res.json(r));
    },
    verHorarioMaestro: (req, res) => {
        const sql = `SELECT h.*, au.nombre as nombre_aula, a.nombre as asignatura, g.nombre as grupo FROM horarios_asignados h LEFT JOIN aulas au ON h.id_aula = au.id LEFT JOIN asignaturas a ON h.id_asignatura = a.id LEFT JOIN grupos g ON h.id_grupo = g.id WHERE h.id_maestro = ? ORDER BY h.dia_semana, h.hora_inicio`;
        db.query(sql, [req.params.id_maestro], (err, r) => res.json(r));
    },
    verHorarioGrupo: (req, res) => {
        const sql = `SELECT h.*, au.nombre as nombre_aula, m.nombre as maestro, a.nombre as asignatura FROM horarios_asignados h LEFT JOIN aulas au ON h.id_aula = au.id LEFT JOIN maestros m ON h.id_maestro = m.id LEFT JOIN asignaturas a ON h.id_asignatura = a.id WHERE h.id_grupo = ?`;
        db.query(sql, [req.params.id_grupo], (err, r) => res.json(r));
    },

    // 7. ELIMINAR CLASE (BLOQUE)
    eliminarClase: (req, res) => {
        const { id_aula, dia, hora } = req.body;
        const sqlFind = `SELECT id_asignatura, id_grupo FROM horarios_asignados WHERE id_aula = ? AND dia_semana = ? AND hora_inicio = ?`;
        db.query(sqlFind, [id_aula, dia, hora], (err, rows) => {
            if(err || rows.length === 0) return res.json({exito:true});
            const { id_asignatura, id_grupo } = rows[0];
            const sqlDelete = `DELETE FROM horarios_asignados WHERE id_aula = ? AND id_asignatura = ? AND id_grupo <=> ? AND hora_inicio = ?`;
            db.query(sqlDelete, [id_aula, id_asignatura, id_grupo, hora], (e, r) => res.json({ exito: true, mensaje: "Materia eliminada." }));
        });
    },

// 8. OBTENER VACANTES (VERSIÓN CRUDA PARA QUE EL FRONTEND AGRUPE)
    obtenerVacantes: (req, res) => {
        const sql = `
            SELECT 
                h.id, 
                a.nombre as asignatura, 
                g.nombre as grupo, 
                au.nombre as aula,
                h.id_asignatura, 
                h.id_grupo, 
                h.hora_inicio, 
                h.hora_fin, 
                h.dia_semana
            FROM horarios_asignados h
            LEFT JOIN asignaturas a ON h.id_asignatura = a.id
            LEFT JOIN grupos g ON h.id_grupo = g.id
            LEFT JOIN aulas au ON h.id_aula = au.id
            WHERE h.id_maestro IS NULL
            ORDER BY g.nombre, a.nombre, h.dia_semana
        `;
        db.query(sql, (err, r) => {
            if (err) return res.status(500).json(err);
            res.json(r);
        });
    },

    // 9. ASIGNAR VACANTE (FUNCIÓN ÚNICA Y CORRECTA)
    asignarDocenteAVacante: (req, res) => {
        const { id_maestro, id_asignatura, id_grupo } = req.body;

        // A. VALIDAR PERFIL PRIMERO
        const sqlPerfil = "SELECT * FROM maestros_asignaturas WHERE id_maestro = ? AND id_asignatura = ?";
        db.query(sqlPerfil, [id_maestro, id_asignatura], (errP, resP) => {
            if (resP.length === 0) {
                return res.status(400).json({ exito: false, mensaje: "⛔ Docente NO autorizado para esta materia." });
            }

            // B. Buscar horarios (usando <=>)
            const sqlHorarios = "SELECT dia_semana, hora_inicio FROM horarios_asignados WHERE id_asignatura = ? AND id_grupo <=> ?";
            db.query(sqlHorarios, [id_asignatura, id_grupo], (err, horarios) => {
                if (horarios.length === 0) return res.status(404).json({ exito: false, mensaje: "No se encontraron las clases." });

                // C. Validar Choques
                let condiciones = [], valores = [id_maestro];
                horarios.forEach(h => {
                    condiciones.push(`(dia_semana = ? AND hora_inicio = ?)`);
                    valores.push(h.dia_semana, h.hora_inicio);
                });

                const sqlChoque = `SELECT * FROM horarios_asignados WHERE id_maestro = ? AND (${condiciones.join(' OR ')})`;
                db.query(sqlChoque, valores, (errChoque, ocupado) => {
                    if (ocupado.length > 0) {
                        const c = ocupado[0];
                        return res.status(400).json({ exito: false, mensaje: `⛔ CHOQUE: El maestro ya tiene clase el ${c.dia_semana} a las ${c.hora_inicio}.` });
                    }

                    // D. Update
                    const sqlUpdate = `UPDATE horarios_asignados SET id_maestro = ? WHERE id_asignatura = ? AND id_grupo <=> ?`;
                    db.query(sqlUpdate, [id_maestro, id_asignatura, id_grupo], (errU, result) => {
                        logger.registrar(`VACANTE CUBIERTA: Maestro ${id_maestro}`);
                        res.json({ exito: true, mensaje: `✅ Vacante asignada.` });
                    });
                });
            });
        });
    },

    // 10. ELIMINAR POR ID
    eliminarAsignacionPorId: (req, res) => {
        const id = req.params.id;
        const sqlFind = "SELECT id_asignatura, id_grupo, hora_inicio FROM horarios_asignados WHERE id = ?";
        db.query(sqlFind, [id], (err, rows) => {
            if(err || rows.length === 0) { db.query("DELETE FROM horarios_asignados WHERE id = ?", [id]); return res.json({ exito: true }); }
            const info = rows[0];
            const sqlDelete = "DELETE FROM horarios_asignados WHERE id_asignatura = ? AND id_grupo <=> ? AND hora_inicio = ?";
            db.query(sqlDelete, [info.id_asignatura, info.id_grupo, info.hora_inicio], (e, r) => res.json({ exito: true, mensaje: "Clase eliminada." }));
        });
    }
};

module.exports = horarioController;