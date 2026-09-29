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

btnIngresar.addEventListener('click', async ()=>{
    const usuario = inputUsuario.value.trim();
    const contraseña = inputContraseña.value.trim();

    if (!usuario || !contraseña) return;

    btnIngresar.disabled = true;

    const { data, error } = await window.supabaseClient.rpc('login_empleado', {
        p_nombre_empleado: usuario,
        p_password: contraseña
    });

    btnIngresar.disabled = false;

    if (!error && data && data.length > 0) {
        sessionStorage.setItem('empleado', JSON.stringify(data[0]));
        window.location.href = 'dashboard.html';
    } else {
        modalaviso.classList.remove('oculto');
        blackout.classList.remove('oculto');
        modalaviso.style.display = 'flex';
        blackout.style.display = 'flex';
    }
});

btnX.addEventListener('click', ()=>{
    modalaviso.classList.add('oculto');
    blackout.classList.add('oculto');
    modalaviso.style.display = '';
    blackout.style.display = '';
});


});