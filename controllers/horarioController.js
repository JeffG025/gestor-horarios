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

    asignarClase: (req, res) => {
        let { id_aula, id_maestro, id_asignatura, id_grupo, hora_inicio, num_alumnos } = req.body;
        
        if (id_maestro === "0" || id_maestro === "") id_maestro = null;
        
        // Convertir horas a minutos para comparaciones exactas
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

            // PASO 1: VERIFICAR CHOQUES (Antes de validar huecos)
            // Esto arregla el mensaje de error confuso
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
                    return res.status(400).json({ exito: false, mensaje: `❌ CHOQUE: Ese horario ya está ocupado.` });
                }

                // Si no hay choques, seguimos con las reglas del maestro
                if (!id_maestro) {
                    // Si es vacante, guardamos directo
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
                    
                    // REGLA LÍMITE
                    if ((ocupadas + dias.length) > maxHoras) {
                        return res.status(400).json({ exito: false, mensaje: `⛔ LÍMITE: Docente limitado a ${maxHoras} horas.` });
                    }

                    // REGLA HUECOS (Solo si NO es tiempo completo)
                    if (contrato !== 'tiempo_completo') {
                        const diaCheck = dias[0]; // Validamos con el primer día del bloque
                        const sqlHuecos = "SELECT hora_inicio, hora_fin FROM horarios_asignados WHERE id_maestro = ? AND dia_semana = ? ORDER BY hora_inicio";
                        
                        db.query(sqlHuecos, [id_maestro, diaCheck], (errH, clasesDia) => {
                            if (clasesDia.length > 0) {
                                // Construir línea de tiempo
                                let timeline = clasesDia.map(c => ({
                                    start: toMinutes(c.hora_inicio),
                                    end: toMinutes(c.hora_fin)
                                }));
                                // Agregar la nueva clase
                                timeline.push({ start: toMinutes(hora_inicio), end: toMinutes(hora_fin) });
                                // Ordenar
                                timeline.sort((a, b) => a.start - b.start);

                                let esContinuo = true;
                                for (let i = 0; i < timeline.length - 1; i++) {
                                    // Si el final de una NO es igual al inicio de la siguiente -> Hueco
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
                    if (errIns) return res.status(500).json({ exito: false, mensaje: "Error BD" });
                    logger.registrar(`ASIGNACIÓN: ${nombreMat}`);
                    res.json({ exito: true, mensaje: "✅ Asignación guardada." });
                });
            }
        });
    },

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
    },
    asignarDocenteAVacante: (req, res) => {
        const { id_maestro, id_asignatura, id_grupo } = req.body;
        const sqlUpdate = `UPDATE horarios_asignados SET id_maestro = ? WHERE id_asignatura = ? AND id_grupo <=> ?`;
        db.query(sqlUpdate, [id_maestro, id_asignatura, id_grupo], (err, r) => res.json({exito:true, mensaje:"Vacante asignada."}));
    }
};

module.exports = horarioController;