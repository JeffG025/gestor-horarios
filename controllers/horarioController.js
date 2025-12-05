// controllers/horarioController.js
const db = require('../config/db');
const logger = require('../models/loggerModel');

const horarioController = {

    obtenerDatosFormulario: (req, res) => {
        const sqlMaestros = "SELECT id, nombre, tipo_contrato FROM maestros ORDER BY nombre";
        const sqlAulas = "SELECT id, nombre FROM aulas";
        const sqlAsignaturas = "SELECT id, nombre, semestre, creditos FROM asignaturas ORDER BY nombre";
        const sqlGrupos = "SELECT id, nombre, cantidad_alumnos, semestre FROM grupos ORDER BY nombre";

        db.query(sqlMaestros, (err, maestros) => {
            if (err) return res.status(500).json(err);
            db.query(sqlAulas, (err, aulas) => {
                db.query(sqlAsignaturas, (err, asignaturas) => {
                    db.query(sqlGrupos, (err, grupos) => {
                        res.json({ maestros, aulas, asignaturas, grupos });
                    });
                });
            });
        });
    },

    consultarHorasMaestro: (req, res) => {
        const id_maestro = req.params.id;
        const sql = "SELECT nombre, horas_max_semana, tipo_contrato FROM maestros WHERE id = ?";
        const sqlOc = "SELECT COUNT(*) as ocupadas FROM horarios_asignados WHERE id_maestro = ?";
        
        db.query(sql, [id_maestro], (e, r) => {
            if(e || r.length===0) return res.json({nombre:'-',maximas:0,ocupadas:0,restantes:0});
            
            const max = r[0].horas_max_semana;
            const contrato = r[0].tipo_contrato;

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

    // FUNCIÓN PRINCIPAL DE ASIGNACIÓN (Ya corregida previamente)
    asignarClase: (req, res) => {
        let { id_aula, id_maestro, id_asignatura, id_grupo, hora_inicio, num_alumnos } = req.body;
        
        if (id_maestro === "0" || id_maestro === "") id_maestro = null;
        
        const toMinutes = (timeStr) => {
            if(!timeStr) return 0;
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };

        let [h, m] = hora_inicio.split(':');
        let hNext = parseInt(h) + 1;
        const hora_fin = `${hNext.toString().padStart(2, '0')}:${m}:00`;

        db.query("SELECT creditos, nombre FROM asignaturas WHERE id = ?", [id_asignatura], (err, resCreditos) => {
            const creditos = resCreditos[0].creditos;
            const nombreMat = resCreditos[0].nombre;

            let dias = [];
            if (creditos === 4) dias = ['Lunes', 'Martes', 'Miercoles', 'Jueves'];
            else if (creditos >= 5) dias = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

            // 1. VERIFICAR CHOQUES EN AULA/GRUPO
            let condiciones = [], valoresQuery = [];
            dias.forEach(d => {
                let cond = `(id_aula = ? OR id_grupo = ?`;
                if (id_maestro) cond += ` OR id_maestro = ?`;
                cond += `) AND dia_semana = ? AND hora_inicio = ?`;
                condiciones.push(cond);
                valoresQuery.push(id_aula, id_grupo);
                if (id_maestro) valoresQuery.push(id_maestro);
                valoresQuery.push(d, hora_inicio + ":00");
            });

            const sqlValidar = `SELECT * FROM horarios_asignados WHERE ${condiciones.join(' OR ')}`;
            
            db.query(sqlValidar, valoresQuery, (errVal, choques) => {
                if (choques && choques.length > 0) {
                    return res.status(400).json({ exito: false, mensaje: `❌ CHOQUE: Horario ya ocupado.` });
                }

                if (!id_maestro) {
                    guardarEnBD();
                } else {
                    validarReglasMaestro();
                }
            });

            function validarReglasMaestro() {
                const sqlM = `SELECT tipo_contrato, horas_max_semana, (SELECT COUNT(*) FROM horarios_asignados WHERE id_maestro = ?) as ocupadas FROM maestros WHERE id = ?`;
                
                db.query(sqlM, [id_maestro, id_maestro], (errM, infoM) => {
                    const maestro = infoM[0];
                    const contrato = maestro.tipo_contrato;
                    const ocupadas = maestro.ocupadas;
                    const maxHoras = maestro.horas_max_semana;
                    
                    if ((ocupadas + dias.length) > maxHoras) {
                        return res.status(400).json({ exito: false, mensaje: `⛔ LÍMITE: Docente limitado a ${maxHoras} horas.` });
                    }

                    if (contrato !== 'tiempo_completo') {
                        const diaCheck = dias[0];
                        const sqlHuecos = "SELECT hora_inicio, hora_fin FROM horarios_asignados WHERE id_maestro = ? AND dia_semana = ? ORDER BY hora_inicio";
                        
                        db.query(sqlHuecos, [id_maestro, diaCheck], (errH, clasesDia) => {
                            if (clasesDia.length > 0) {
                                let timeline = clasesDia.map(c => ({ start: toMinutes(c.hora_inicio), end: toMinutes(c.hora_fin) }));
                                timeline.push({ start: toMinutes(hora_inicio), end: toMinutes(hora_fin) });
                                timeline.sort((a, b) => a.start - b.start);

                                let esContinuo = true;
                                for (let i = 0; i < timeline.length - 1; i++) {
                                    if (timeline[i].end < timeline[i+1].start) {
                                        esContinuo = false; 
                                        break;
                                    }
                                }
                                if (!esContinuo) {
                                    return res.status(400).json({ exito: false, mensaje: `⛔ HUECO: El contrato exige clases continuas.` });
                                }
                            }
                            guardarEnBD();
                        });
                    } else {
                        guardarEnBD();
                    }
                });
            }

            function guardarEnBD() {
                let registros = dias.map(d => [id_aula, id_maestro, id_asignatura, id_grupo, d, hora_inicio, hora_fin, num_alumnos]);
                const sqlInsert = `INSERT INTO horarios_asignados (id_aula, id_maestro, id_asignatura, id_grupo, dia_semana, hora_inicio, hora_fin, num_alumnos) VALUES ?`;
                db.query(sqlInsert, [registros], (errIns) => {
                    if (errIns) {
                        if (errIns.code === 'ER_DUP_ENTRY' || errIns.errno === 1062) {
                            return res.status(400).json({ exito: false, mensaje: "❌ CHOQUE: Ya existe una clase en ese horario." });
                        }
                        return res.status(500).json({ exito: false, mensaje: `Error BD: ${errIns.sqlMessage}` });
                    }
                    logger.registrar(`ASIGNACIÓN: ${nombreMat}`);
                    res.json({ exito: true, mensaje: "✅ Asignación guardada." });
                });
            }
        });
    },

    // --- NUEVA LÓGICA: ASIGNAR VACANTE (VALIDANDO REGLAS) ---
    asignarDocenteAVacante: (req, res) => {
        const { id_maestro, id_asignatura, id_grupo } = req.body;

        // 1. Obtener Info del Maestro
        const sqlMaestro = "SELECT tipo_contrato, horas_max_semana FROM maestros WHERE id = ?";
        db.query(sqlMaestro, [id_maestro], (errM, resM) => {
            if (errM || resM.length === 0) return res.status(404).json({ exito: false, mensaje: "Maestro no encontrado" });
            
            const { tipo_contrato, horas_max_semana } = resM[0];
            const permiteHuecos = (tipo_contrato === 'tiempo_completo');

            // 2. Obtener Info de la Vacante (Todos los días/horas que implica)
            const sqlVacante = "SELECT dia_semana, hora_inicio, hora_fin FROM horarios_asignados WHERE id_asignatura = ? AND id_grupo <=> ? AND id_maestro IS NULL";
            db.query(sqlVacante, [id_asignatura, id_grupo], (errV, vacantes) => {
                if (errV || vacantes.length === 0) return res.status(404).json({ exito: false, mensaje: "La vacante ya fue ocupada o no existe." });

                // 3. Obtener Horario ACTUAL del Maestro (para validar choques y huecos)
                const sqlHorarioMaestro = "SELECT dia_semana, hora_inicio, hora_fin FROM horarios_asignados WHERE id_maestro = ?";
                db.query(sqlHorarioMaestro, [id_maestro], (errH, horarioActual) => {
                    
                    // A. Validar Límite de Horas
                    const horasTotales = horarioActual.length + vacantes.length;
                    if (horasTotales > horas_max_semana) {
                        return res.status(400).json({ exito: false, mensaje: `⛔ LÍMITE: Tomar esta vacante excedería las ${horas_max_semana} horas permitidas.` });
                    }

                    // Función auxiliar
                    const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

                    // Organizar por días para validar continuidad
                    // Obtenemos lista única de días que tiene la vacante
                    const diasAfectados = [...new Set(vacantes.map(v => v.dia_semana))];

                    for (const dia of diasAfectados) {
                        // Clases que ya tiene el maestro ese día
                        const clasesDia = horarioActual.filter(c => c.dia_semana === dia);
                        // Clases que añadiría la vacante ese día
                        const vacantesDia = vacantes.filter(v => v.dia_semana === dia);

                        // 1. Validar Choques (¿Ya tiene clase a esa hora?)
                        for (const vac of vacantesDia) {
                            const vStart = toMinutes(vac.hora_inicio);
                            const vEnd = toMinutes(vac.hora_fin);
                            
                            for (const actual of clasesDia) {
                                const aStart = toMinutes(actual.hora_inicio);
                                const aEnd = toMinutes(actual.hora_fin);
                                
                                // Si se solapan
                                if (vStart < aEnd && vEnd > aStart) {
                                    return res.status(400).json({ exito: false, mensaje: `❌ CHOQUE: El docente ya tiene clase el ${dia} a las ${vac.hora_inicio}.` });
                                }
                            }
                        }

                        // 2. Validar Huecos (Si no es Tiempo Completo)
                        if (!permiteHuecos) {
                            // Simulamos cómo quedaría el horario uniendo todo
                            const timeline = [
                                ...clasesDia.map(c => ({ start: toMinutes(c.hora_inicio), end: toMinutes(c.hora_fin) })),
                                ...vacantesDia.map(v => ({ start: toMinutes(v.hora_inicio), end: toMinutes(v.hora_fin) }))
                            ].sort((a, b) => a.start - b.start);

                            // Verificar continuidad en la línea de tiempo unida
                            for (let i = 0; i < timeline.length - 1; i++) {
                                // Si el final de una NO es igual al inicio de la siguiente -> Hueco
                                if (timeline[i].end < timeline[i+1].start) {
                                    return res.status(400).json({ 
                                        exito: false, 
                                        mensaje: `⛔ HUECO DETECTADO (${dia}): Al tomar esta vacante quedaría un espacio libre, y el contrato exige horario continuo.` 
                                    });
                                }
                            }
                        }
                    }

                    // SI PASA TODAS LAS REGLAS -> ASIGNAR
                    const sqlUpdate = `UPDATE horarios_asignados SET id_maestro = ? WHERE id_asignatura = ? AND id_grupo <=> ? AND id_maestro IS NULL`;
                    db.query(sqlUpdate, [id_maestro, id_asignatura, id_grupo], (errU, result) => {
                        if (errU) return res.status(500).json({ exito: false, mensaje: "Error BD al asignar vacante" });
                        logger.registrar(`VACANTE TOMADA: Docente ${id_maestro} -> Materia ${id_asignatura}`);
                        res.json({ exito: true, mensaje: "✅ Vacante asignada correctamente." });
                    });
                });
            });
        });
    },

    // ... RESTO DE FUNCIONES IGUALES (Copia verHorarioAula, verHorarioMaestro, etc.) ...
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
    eliminarAsignacionPorId: (req, res) => {
        const id = req.params.id;
        const sqlBuscar = "SELECT id_maestro, id_asignatura, id_grupo, hora_inicio FROM horarios_asignados WHERE id = ?";
        db.query(sqlBuscar, [id], (err, results) => {
            if (err || results.length === 0) return res.status(404).json({ exito: false, mensaje: "Clase no encontrada." });
            const { id_maestro, id_asignatura, id_grupo, hora_inicio } = results[0];
            const sqlEliminar = `DELETE FROM horarios_asignados WHERE id_maestro = ? AND id_asignatura = ? AND id_grupo <=> ? AND hora_inicio = ?`;
            db.query(sqlEliminar, [id_maestro, id_asignatura, id_grupo, hora_inicio], (errDel) => {
                if (errDel) return res.status(500).json({ exito: false, mensaje: "Error al eliminar." });
                res.json({ exito: true, mensaje: "✅ Se eliminó la materia de toda la semana." });
            });
        });
    },
    obtenerVacantes: (req, res) => {
        const sql = `SELECT MIN(h.id) as id, a.nombre as asignatura, g.nombre as grupo, h.id_asignatura, h.id_grupo, MIN(h.hora_inicio) as hora_inicio FROM horarios_asignados h LEFT JOIN asignaturas a ON h.id_asignatura = a.id LEFT JOIN grupos g ON h.id_grupo = g.id WHERE h.id_maestro IS NULL GROUP BY h.id_asignatura, h.id_grupo, h.hora_inicio`;
        db.query(sql, (err, r) => res.json(r));
    }
};

module.exports = horarioController;