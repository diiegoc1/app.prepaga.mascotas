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
const btnX = document.getElementById('btn-x');
const blackout = document.getElementById('blackout');

function mostrarAviso() {
    modalaviso.classList.remove('oculto');
    blackout.classList.remove('oculto');
    modalaviso.style.display = 'flex';
    blackout.style.display = 'flex';
}

btnIngresar.addEventListener('click', async ()=>{
    const email = inputUsuario.value.trim();
    const contraseña = inputContraseña.value.trim();

    if (!email || !contraseña) return;

    btnIngresar.disabled = true;

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email,
        password: contraseña
    });

    btnIngresar.disabled = false;

    if (error || !data.session) {
        mostrarAviso();
        return;
    }

    const perfil = await getEmpleadoActual();
    if (!perfil || !esActivo(perfil)) {
        await window.supabaseClient.auth.signOut();
        mostrarAviso();
        return;
    }

    sessionStorage.setItem('empleado', JSON.stringify({
        id_empleado: perfil.id_empleado,
        nombre: perfil.nombre,
        rol: perfil.rol
    }));
    window.location.href = 'dashboard.html';
});

btnX.addEventListener('click', ()=>{
    modalaviso.classList.add('oculto');
    blackout.classList.add('oculto');
    modalaviso.style.display = '';
    blackout.style.display = '';
});


});