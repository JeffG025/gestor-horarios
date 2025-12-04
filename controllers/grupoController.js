// controllers/grupoController.js
const db = require('../config/db');
const logger = require('../models/loggerModel');

// --- BANCO DE DATOS PARA NOMBRES ALEATORIOS ---
const nombres = [
    "Hugo", "Martin", "Lucas", "Mateo", "Leo", "Daniel", "Alejandro", "Pablo", "Manuel", "Alvaro", 
    "Adrian", "David", "Mario", "Diego", "Marcos", "Javier", "Izan", "Alex", "Bruno", "Oliver", 
    "Miguel", "Thiago", "Antonio", "Marc", "Carlos", "Angel", "Juan", "Gonzalo", "Gael", "Sergio", 
    "Nicolas", "Dylan", "Gabriel", "Jorge", "Jose", "Adam", "Liam", "Eric", "Samuel", "Dario",
    "Hector", "Luca", "Iker", "Rodrigo", "Saul", "Jesus", "Aitor", "Ruben", "Aaron", "Ivan",
    "Sofia", "Lucia", "Maria", "Paula", "Daniela", "Valeria", "Julia", "Alba", "Martina", "Emma"
];

const apellidos = [
    "Garcia", "Gonzalez", "Rodriguez", "Fernandez", "Lopez", "Martinez", "Sanchez", "Perez", "Gomez", "Martin", 
    "Jimenez", "Ruiz", "Hernandez", "Diaz", "Moreno", "Muñoz", "Alvarez", "Romero", "Alonso", "Gutierrez", 
    "Navarro", "Torres", "Dominguez", "Vazquez", "Ramos", "Gil", "Ramirez", "Serrano", "Blanco", "Molina", 
    "Morales", "Suarez", "Ortega", "Delgado", "Castro", "Ortiz", "Rubio", "Marin", "Sanz", "Nuñez", 
    "Iglesias", "Medina", "Garrido", "Cortes", "Castillo", "Santos", "Lozano", "Guerrero", "Cano", "Prieto", 
    "Mendez", "Cruz", "Calvo", "Gallego", "Vidal", "Leon", "Marquez", "Herrera", "Peña", "Flores", 
    "Cabrera", "Campos", "Vega", "Fuentes", "Carrasco", "Diez", "Caballero", "Nieto", "Reyes", "Aguilar", 
    "Pascual", "Santana", "Herrero", "Lorenzo", "Hidalgo", "Montero", "Ibanez", "Gimenez", "Ferrer", "Duran", 
    "Santiago", "Benitez", "Vargas", "Mora", "Vicente", "Arias", "Carmona", "Crespo", "Roman", "Pastor"
];

const grupoController = {

    // 1. LISTAR GRUPOS
    listar: (req, res) => {
        // Ordenamos por semestre y nombre para que se vea ordenado
        db.query("SELECT * FROM grupos ORDER BY semestre, nombre", (err, resultados) => {
            if (err) return res.status(500).json({ error: "Error BD" });
            res.json(resultados);
        });
    },

    // 2. CREAR GRUPO (CON GENERACIÓN DE ALUMNOS)
    crear: (req, res) => {
        const { nombre, cantidad, semestre } = req.body;
        
        // Validaciones
        if(cantidad > 30) return res.status(400).json({exito: false, mensaje: "⛔ Máximo 30 alumnos."});
        if(cantidad < 10) return res.status(400).json({exito: false, mensaje: "⛔ Mínimo 10 alumnos."});

        const sqlGrupo = "INSERT INTO grupos (nombre, cantidad_alumnos, semestre) VALUES (?, ?, ?)";
        
        db.query(sqlGrupo, [nombre, cantidad, semestre], (err, result) => {
            if (err) return res.status(500).send("Error al crear grupo");
            
            const idGrupo = result.insertId;
            
            // --- GENERAR ALUMNOS ---
            const alumnosGenerados = [];
            for (let i = 0; i < cantidad; i++) {
                const nom = nombres[Math.floor(Math.random() * nombres.length)];
                const ape1 = apellidos[Math.floor(Math.random() * apellidos.length)];
                const ape2 = apellidos[Math.floor(Math.random() * apellidos.length)];
                const nombreCompleto = `${nom} ${ape1} ${ape2}`;
                alumnosGenerados.push([idGrupo, nombreCompleto]);
            }

            // Insertar alumnos
            const sqlAlumnos = "INSERT INTO alumnos (id_grupo, nombre_completo) VALUES ?";
            
            db.query(sqlAlumnos, [alumnosGenerados], (errAlum) => {
                if (errAlum) console.error("Error generando alumnos:", errAlum);
                
                logger.registrar(`GRUPO CREADO: ${nombre} (Semestre ${semestre}, ${cantidad} alumnos)`);
                res.json({ exito: true, mensaje: "Grupo y alumnos creados correctamente" });
            });
        });
    },

    // 3. VER ALUMNOS DE UN GRUPO
    verAlumnos: (req, res) => {
        const idGrupo = req.params.id;
        db.query("SELECT * FROM alumnos WHERE id_grupo = ? ORDER BY nombre_completo", [idGrupo], (err, resultados) => {
            if (err) return res.status(500).json(err);
            res.json(resultados);
        });
    },

    // 4. EDITAR GRUPO
    editar: (req, res) => {
        const { id, nombre, cantidad, semestre } = req.body;

        if(cantidad > 30) return res.status(400).json({exito: false, mensaje: "⛔ Máximo 30 alumnos."});
        if(cantidad < 10) return res.status(400).json({exito: false, mensaje: "⛔ Mínimo 10 alumnos."});

        // Nota: No regeneramos alumnos al editar para no perder datos reales si ya pasaron lista
        const sql = "UPDATE grupos SET nombre = ?, cantidad_alumnos = ?, semestre = ? WHERE id = ?";
        
        db.query(sql, [nombre, cantidad, semestre, id], (err, result) => {
            if (err) return res.status(500).send("Error al actualizar");
            logger.registrar(`GRUPO EDITADO: ID ${id}`);
            res.json({ exito: true, mensaje: "Grupo actualizado correctamente" });
        });
    },

    // 5. ELIMINAR GRUPO
    eliminar: (req, res) => {
        const id = req.params.id;
        const sql = "DELETE FROM grupos WHERE id = ?";
        
        db.query(sql, [id], (err, result) => {
            if (err) return res.status(500).send("Error al eliminar (¿Tiene clases asignadas?)");
            logger.registrar(`GRUPO ELIMINADO: ID ${id}`);
            res.json({ exito: true, mensaje: "Grupo eliminado." });
        });
    }
};

module.exports = grupoController;