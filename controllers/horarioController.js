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
            
            let max = 0;
            const contrato = r[0].tipo_contrato;

            // REGLAS DE HORAS MÁXIMAS SEGÚN CONTRATO
            if (contrato === 'tiempo_completo') max = 22; // Rango 20-22 (Ponemos el tope)
            else max = 20; // Asignatura/Medio Tiempo (Rango 18-20)

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
        
        // 1. Preparar horas
        let [h, m] = hora_inicio.split(':');
        let hNext = parseInt(h) + 1;
        const hora_fin = `${hNext.toString().padStart(2, '0')}:${m}:00`;

        // 2. Obtener Info de la Materia (Créditos -> Días)
        db.query("SELECT creditos, nombre FROM asignaturas WHERE id = ?", [id_asignatura], (err, resCreditos) => {
            const creditos = resCreditos[0].creditos;
            const nombreMat = resCreditos[0].nombre;

            // Calcular días basados en créditos
            let dias = [];
            if (creditos === 4) dias = ['Lunes', 'Martes', 'Miercoles', 'Jueves'];
            else if (creditos === 5) dias = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
            // (Simplificado para el ejemplo: asumimos clases de 1 hora diaria lun-vie para 5 creditos)
            // Si necesitas lógica más compleja de días, ajusta aquí.

            // 3. VALIDACIONES DEL MAESTRO (Aquí está la lógica que pediste)
            const validarMaestro = (callback) => {
                if (!id_maestro) return callback(); // Si es vacante, pasa directo

                const sqlM = `SELECT tipo_contrato, (SELECT COUNT(*) FROM horarios_asignados WHERE id_maestro = ?) as ocupadas FROM maestros WHERE id = ?`;
                
                db.query(sqlM, [id_maestro, id_maestro], (errM, infoM) => {
                    const contrato = infoM[0].tipo_contrato;
                    const ocupadas = infoM[0].ocupadas;
                    
                    let limiteHoras = 20;
                    let permiteHuecos = false;

                    // REGLA 1: Definir límites y permisos por contrato
                    if (contrato === 'tiempo_completo') {
                        limiteHoras = 22;
                        permiteHuecos = true; // SI puede tener espacios libres
                    } else {
                        // Asignatura o Medio Tiempo
                        limiteHoras = 20;
                        permiteHuecos = false; // NO puede tener espacios libres
                    }

                    // REGLA 2: Validar Límite de Horas
                    if ((ocupadas + dias.length) > limiteHoras) {
                        return res.status(400).json({ 
                            exito: false, 
                            mensaje: `⛔ LÍMITE EXCEDIDO: ${contrato} máx ${limiteHoras} horas.` 
                        });
                    }

                    // REGLA 3: Validar Huecos (Solo para Asignatura/Medio Tiempo)
                    if (!permiteHuecos) {
                        // Buscamos clases del maestro en los días que vamos a insertar
                        // Para simplificar, validamos el primer día (Lunes) como muestra, 
                        // ya que los horarios suelen ser simétricos.
                        const diaCheck = dias[0]; 
                        const sqlHuecos = "SELECT hora_inicio, hora_fin FROM horarios_asignados WHERE id_maestro = ? AND dia_semana = ?";
                        
                        db.query(sqlHuecos, [id_maestro, diaCheck], (errH, clasesDia) => {
                            if (clasesDia.length > 0) {
                                // Ya tiene clases ese día, verificar continuidad
                                let esContinuo = false;
                                
                                // ¿La nueva clase pega con alguna existente?
                                for (let c of clasesDia) {
                                    // Pega al final de una existente (ej: tiene 7-8, nueva es 8-9)
                                    if (c.hora_fin === hora_inicio + ":00") esContinuo = true;
                                    // Pega al inicio de una existente (ej: tiene 8-9, nueva es 7-8)
                                    if (c.hora_inicio === hora_fin) esContinuo = true;
                                }

                                if (!esContinuo) {
                                    return res.status(400).json({ 
                                        exito: false, 
                                        mensaje: `⛔ HUECO DETECTADO: El contrato de ${contrato} exige clases continuas. (Intenta pegar a una clase existente).` 
                                    });
                                }
                            }
                            // Si no tiene clases ese día, es el primer bloque, así que pasa.
                            callback();
                        });
                    } else {
                        // Si es tiempo completo, pasa sin validar huecos
                        callback();
                    }
                });
            };

            // 4. EJECUTAR INSERCIÓN (Si pasa validaciones)
            validarMaestro(() => {
                // Verificar choques de aula o grupo antes de insertar
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
                        return res.status(400).json({ exito: false, mensaje: `❌ CHOQUE: Horario ocupado (Aula, Grupo o Maestro).` });
                    }

                    // Insertar
                    let registros = dias.map(d => [id_aula, id_maestro, id_asignatura, id_grupo, d, hora_inicio, hora_fin, num_alumnos]);
                    const sqlInsert = `INSERT INTO horarios_asignados (id_aula, id_maestro, id_asignatura, id_grupo, dia_semana, hora_inicio, hora_fin, num_alumnos) VALUES ?`;
                    
                    db.query(sqlInsert, [registros], (errIns) => {
                        if (errIns) return res.status(500).json({ exito: false, mensaje: "Error BD al guardar" });
                        logger.registrar(`ASIGNACIÓN: ${nombreMat} (${dias.length} hrs)`);
                        res.json({ exito: true, mensaje: "✅ Asignación guardada." });
                    });
                });
            });
        });
    },

    // ... (Mantén aquí el resto de funciones: verHorarioAula, verHorarioMaestro, etc. COPIA Y PEGA las del archivo anterior)
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
        db.query("DELETE FROM horarios_asignados WHERE id = ?", [id], (e, r) => res.json({ exito: true }));
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