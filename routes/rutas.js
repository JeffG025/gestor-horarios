// routes/rutas.js
const horarioController = require('../controllers/horarioController');
const express = require('express');
const router = express.Router();
const asignaturaController = require('../controllers/asignaturaController');
const authController = require('../controllers/authController');
const maestroController = require('../controllers/maestroController');
const grupoController = require('../controllers/grupoController');
const usuarioController = require('../controllers/usuarioController');
const path = require('path');
const view = (archivo) => path.join(__dirname, '../views', archivo);

router.get('/', (req, res) => res.sendFile(view('login.html')));
router.get('/registro-maestro', (req, res) => res.sendFile(view('registro_maestro.html')));
router.get('/panel-maestro', (req, res) => res.sendFile(view('panel_maestro.html')));
router.get('/panel-subdirector', (req, res) => res.sendFile(view('panel_subdirector.html')));
router.get('/gestion-materias', (req, res) => res.sendFile(view('gestion_materias.html')));
router.get('/gestion-grupos', (req, res) => res.sendFile(view('gestion_grupos.html')));
router.get('/gestion-maestros', (req, res) => res.sendFile(view('gestion_maestros.html')));
router.get('/gestion-vacantes', (req, res) => res.sendFile(view('gestion_vacantes.html')));
router.get('/asignar-clase', (req, res) => res.sendFile(view('asignar_clase.html')));

// Ruta para ver el formulario (GET)

// Ruta para recibir los datos del formulario (POST)
router.post('/api/crear-maestro', maestroController.registrarMaestro);
// Ruta para guardar horarios
router.post('/api/asignar-horario', horarioController.asignarClase);
// Ruta para llenar los <select>
router.get('/api/datos-formulario', horarioController.obtenerDatosFormulario);

// Ruta para ver las horas de un maestro específico
router.get('/api/maestro/:id/horas', horarioController.consultarHorasMaestro);

// Vista del Login
router.get('/', (req, res) => {
    res.sendFile('login.html', { root: './views' }); // La raíz ahora será el Login
});

// Proceso de Login (API)
router.post('/api/login', authController.login);


// Obtener el horario pintado de un aula
router.get('/api/horario/aula/:id_aula', horarioController.verHorarioAula);

// Obtener el horario pintado de un maestro
router.get('/api/horario/maestro/:id_maestro', horarioController.verHorarioMaestro);

// Ruta para borrar una clase
router.delete('/api/grupos/:id', grupoController.eliminar);

// --- RUTAS DEL SUBDIRECTOR ---
// Vista del panel

// API para obtener lista
router.get('/api/usuarios', usuarioController.listarUsuarios);

// API para borrar
router.delete('/api/usuarios/:id', usuarioController.eliminarUsuario);

router.get('/ver-horario-movil', (req, res) => {
    res.sendFile('ver_horario.html', { root: './views' });
});

router.get('/api/asignaturas', asignaturaController.listar); // Reutilizamos o creamos una específica
router.post('/api/asignaturas', asignaturaController.crear);
router.put('/api/asignaturas', asignaturaController.editar);
router.delete('/api/asignaturas/:id', asignaturaController.eliminar);


// APIs CRUD Grupos
router.get('/api/grupos', grupoController.listar);
router.post('/api/grupos', grupoController.crear);
router.delete('/api/grupos/:id', grupoController.eliminar);

// APIs CRUD Grupos
router.get('/api/grupos', grupoController.listar);
router.post('/api/grupos', grupoController.crear);
router.put('/api/grupos', grupoController.editar); // <--- NUEVA RUTA
router.delete('/api/grupos/:id', grupoController.eliminar);

// Ruta para ver horario de un grupo
router.get('/api/horario/grupo/:id_grupo', horarioController.verHorarioGrupo);

// Ruta pública para ver horario de GRUPO en el celular
router.get('/ver-horario-grupo-movil', (req, res) => {
    res.sendFile('ver_horario_grupo.html', { root: './views' });
});

// Ruta para ver lista de alumnos
router.get('/api/grupos/:id/alumnos', grupoController.verAlumnos);

// Ruta pública para ver LISTA en el celular
router.get('/ver-lista-movil', (req, res) => {
    res.sendFile('ver_lista.html', { root: './views' });
});

router.get('/api/maestros', maestroController.listarMaestros);
router.get('/api/maestro/:id/materias', maestroController.verMateriasAsignadas);
router.post('/api/maestro/asignar-materia', maestroController.asignarMateria);
router.delete('/api/maestro/quitar-materia/:id', maestroController.quitarMateria);

// Ruta para eliminar una clase específica desde la gestión de maestros
router.delete('/api/horario/eliminar/:id', horarioController.eliminarAsignacionPorId);

// Rutas para gestión de vacantes
router.get('/api/horario/vacantes', horarioController.obtenerVacantes);
router.put('/api/horario/asignar-vacante', horarioController.asignarDocenteAVacante);


module.exports = router;