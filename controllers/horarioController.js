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
        const sql = "SELECT nombre, horas_max_semana, tipo_contrato FROM maestros WHERE id = ?";
        const sqlOc = "SELECT COUNT(*) as ocupadas FROM horarios_asignados WHERE id_maestro = ?";
        
        db.query(sql, [id_maestro], (e, r) => {
            if(e || r.length===0) return res.json({nombre:'-',maximas:0,ocupadas:0,restantes:0});
            
            let max = r[0].horas_max_semana;
            const contrato = r[0].tipo_contrato;

            // Ajuste de horas según contrato
            if (contrato === 'asignatura' || contrato === 'medio_tiempo') max = 20;
            if (contrato === 'tiempo_completo') max = 22;

            db.query(sqlOc, [id_maestro], (e2, r2) => {
                const oc = r2[0].ocupadas;
                res.json({ 
                    nombre: r[0].nombre, 
                    maximas: max, 
                    ocupadas: oc, 
                    restantes: max - oc,
                    contrato: contrato 
                });
            });
        });
    },

    // 3. ASIGNAR CLASE (FLEXIBLE: PERMITE HUECOS SI SON NECESARIOS)
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

        // Validar Materia en Grupo
        const sqlDup = "SELECT * FROM horarios_asignados WHERE id_grupo = ? AND id_asignatura = ?";
        db.query(sqlDup, [id_grupo, id_asignatura], (errDup, resDup) => {
            if (resDup.length > 0) return res.status(400).json({ exito: false, mensaje: "⛔ Materia ya asignada al grupo." });

            db.query("SELECT creditos, nombre FROM asignaturas WHERE id = ?", [id_asignatura], (err, resCreditos) => {
                const creditos = resCreditos[0].creditos;
                const nombreMat = resCreditos[0].nombre;

                let diasBase = [], diasExtra = [];
                if (creditos === 4) diasBase = ['Lunes', 'Martes', 'Miercoles', 'Jueves'];
                else if (creditos >= 5) diasBase = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
                
                if (creditos === 6) diasExtra = ['Viernes'];
                else if (creditos === 7) diasExtra = ['Jueves', 'Viernes'];
                else if (creditos === 8) diasExtra = ['Miercoles', 'Jueves', 'Viernes'];
                else if (creditos === 9) diasExtra = ['Martes', 'Miercoles', 'Jueves', 'Viernes'];
                else if (creditos === 10) diasExtra = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

                // B. VALIDACIONES DEL MAESTRO
                const validarMaestro = (callback) => {
                    if (!id_maestro) return callback();

                    const sqlM = `SELECT tipo_contrato, (SELECT COUNT(*) FROM horarios_asignados WHERE id_maestro = ?) as ocupadas FROM maestros WHERE id = ?`;
                    
                    db.query(sqlM, [id_maestro, id_maestro], (errM, infoM) => {
                        const contrato = infoM[0].tipo_contrato;
                        const ocupadas = infoM[0].ocupadas;
                        let limiteHoras = 22;

                        if (contrato === 'asignatura' || contrato === 'medio_tiempo') limiteHoras = 20;
                        
                        // 1. REGLA LÍMITE DE HORAS (SE MANTIENE)
                        if ((ocupadas + creditos) > limiteHoras) {
                            return res.status(400).json({ 
                                exito: false, 
                                mensaje: `⛔ LÍMITE EXCEDIDO: El contrato permite máx ${limiteHoras} horas.` 
                            });
                        }

                        // 2. REGLA DE HUECOS (ELIMINADA PARA PERMITIR CASOS MIXTOS)
                        // Hemos quitado el bloque "if (contrato !== 'tiempo_completo')..." 
                        // para permitir que asignes materias aunque queden huecos naturales.
                        
                        callback();
                    });
                };

                validarMaestro(() => {
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

                    const sqlValidar = `SELECT * FROM horarios_asignados WHERE ${condiciones.join(' OR ')}`;
                    db.query(sqlValidar, valoresQuery, (errVal, choques) => {
                        if (choques && choques.length > 0) return res.status(400).json({ exito: false, mensaje: `❌ CHOQUE: Horario ocupado.` });

                        const sqlInsert = `INSERT INTO horarios_asignados (id_aula, id_maestro, id_asignatura, id_grupo, dia_semana, hora_inicio, hora_fin, num_alumnos) VALUES ?`;
                        db.query(sqlInsert, [registros], (errIns) => {
                            if (errIns) return res.status(500).json({ exito: false, mensaje: "Error BD" });
                            logger.registrar(`ASIGNACIÓN: ${nombreMat}`);
                            res.json({ exito: true, mensaje: "✅ Asignación guardada." });
                        });
                    });
                });
            });
        });
    },

    // ... RESTO DE FUNCIONES (COPIAR TAL CUAL LAS TENÍAS) ...
    // Incluye aquí: verHorarioAula, verHorarioMaestro, verHorarioGrupo, 
    // eliminarClase, obtenerVacantes, asignarDocenteAVacante, eliminarAsignacionPorId
    
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
    obtenerVacantes: (req, res) => {
        const sql = `SELECT MIN(h.id) as id, a.nombre as asignatura, g.nombre as grupo, h.id_asignatura, h.id_grupo, MIN(h.hora_inicio) as hora_inicio, MIN(h.hora_fin) as hora_fin FROM horarios_asignados h LEFT JOIN asignaturas a ON h.id_asignatura = a.id LEFT JOIN grupos g ON h.id_grupo = g.id LEFT JOIN aulas au ON h.id_aula = au.id WHERE h.id_maestro IS NULL GROUP BY h.id_asignatura, h.id_grupo, h.hora_inicio ORDER BY g.nombre`;
        db.query(sql, (err, r) => res.json(r));
    },
    asignarDocenteAVacante: (req, res) => {
        const { id_maestro, id_asignatura, id_grupo } = req.body;
        // VALIDACIÓN DE CHOQUES
        const sqlHorarios = "SELECT dia_semana, hora_inicio FROM horarios_asignados WHERE id_asignatura = ? AND id_grupo <=> ?";
        db.query(sqlHorarios, [id_asignatura, id_grupo], (err, horarios) => {
            if(err || horarios.length === 0) return res.status(404).json({mensaje: "No encontrado"});
            let condiciones = [], valores = [id_maestro];
            horarios.forEach(h => { condiciones.push(`(dia_semana=? AND hora_inicio=?)`); valores.push(h.dia_semana, h.hora_inicio); });
            const sqlChoque = `SELECT * FROM horarios_asignados WHERE id_maestro = ? AND (${condiciones.join(' OR ')})`;
            
            db.query(sqlChoque, valores, (errC, ocupado) => {
                if(ocupado.length > 0) return res.status(400).json({ exito: false, mensaje: "⛔ Choque de horario." });
                const sqlUpdate = `UPDATE horarios_asignados SET id_maestro = ? WHERE id_asignatura = ? AND id_grupo <=> ?`;
                db.query(sqlUpdate, [id_maestro, id_asignatura, id_grupo], (errU, r) => res.json({exito:true, mensaje:"Vacante asignada."}));
            });
        });
    },
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