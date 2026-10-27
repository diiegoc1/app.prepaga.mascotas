import { supabase } from "./compartido/supabaseClient.js";
import { getEmpleadoActual, esActivo } from "./compartido/sesion.js";

document.addEventListener('DOMContentLoaded', ()=>{

const btnRecuperarContraseña = document.getElementById('btnRecuperarContraseña');
const contLogin = document.getElementById('contenedorLogin');
const contRecuperarLogin = document.getElementById('contenedorRecuperarLogin');
const btnVolver = document.getElementById('btnVolver');

btnRecuperarContraseña.addEventListener('click', ()=>{
    contLogin.classList.add('oculto');
    contRecuperarLogin.classList.remove('oculto');
});

btnVolver.addEventListener('click', ()=>{
    contRecuperarLogin.classList.add('oculto');
    contLogin.classList.remove('oculto');
});



const btnIngresar = document.querySelector('.btn-ingresar-login');
const inputUsuario = document.querySelector('.input-login');
const inputContraseña = document.querySelector('.input-contraseña-login');
const modalaviso = document.getElementById('modal-aviso');
const textoAviso = document.getElementById('textoAviso');
const btnX = document.getElementById('btn-x');
const blackout = document.getElementById('blackout');

// Muestra el modal de aviso con el texto que se le pase (por defecto, el de credenciales inválidas)
function mostrarAviso(texto) {
    textoAviso.textContent = texto || 'Usuario o contraseña incorrectos';
    modalaviso.classList.remove('oculto');
    blackout.classList.remove('oculto');
    modalaviso.style.display = 'flex';
    blackout.style.display = 'flex';
}

btnIngresar.addEventListener('click', async function iniciarSesion() {
    const email = inputUsuario.value.trim();
    const contraseña = inputContraseña.value;

    if (!email || !contraseña) {
        
        return;
    }

    btnIngresar.disabled = true;
    btnIngresar.textContent = 'Validando...';

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: contraseña
        });

        if (error || !data.session) {
            mostrarAviso();
            return;
        }

        const perfil = await getEmpleadoActual();
        if (!perfil || !esActivo(perfil)) {
            await supabase.auth.signOut();
            mostrarAviso();
            return;
        }

        sessionStorage.setItem('empleado', JSON.stringify({
            id_empleado: perfil.id_empleado,
            nombre: perfil.nombre,
            rol: perfil.rol
        }));
        window.location.href = 'dashboard.html';
    } catch (err) {
        console.error(err);
        mostrarAviso('Error de conexión. Intentá de nuevo');
    } finally {
        // Solo se ejecuta si no redirigió; si redirige, da igual
        btnIngresar.disabled = false;
        btnIngresar.textContent = 'Ingresar';
    }
});

  [inputUsuario, inputContraseña].forEach(input => {
      input.addEventListener('keydown', e => {
          if (e.key === 'Enter') iniciarSesion();
      });
  });

btnX.addEventListener('click', ()=>{
    modalaviso.classList.add('oculto');
    blackout.classList.add('oculto');
    modalaviso.style.display = '';
    blackout.style.display = '';
});


// ---------- Recuperar contraseña: enviar enlace al correo ----------
const btnEnviarRecuperar = document.getElementById('btnEnviarRecuperar');
const inputMailRecuperar = document.getElementById('inputMailRecuperar');

btnEnviarRecuperar.addEventListener('click', async ()=>{
    const email = inputMailRecuperar.value.trim();

    if (!email) {
        mostrarAviso('Ingresá tu correo electrónico');
        return;
    }

    btnEnviarRecuperar.disabled = true;

    const redirectTo = new URL('restablecer.html', window.location.href).href;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    btnEnviarRecuperar.disabled = false;

    if (error) {
        mostrarAviso('No se pudo enviar el correo. Intentá de nuevo en unos minutos');
    } else {
        inputMailRecuperar.value = '';
        mostrarAviso('Si el correo está registrado, recibirás un enlace de recuperación');
    }
});


});
