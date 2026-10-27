import { supabase } from "./compartido/supabaseClient.js";

document.addEventListener('DOMContentLoaded', () => {

const inputNueva = document.getElementById('inputNuevaPassword');
const inputRepetir = document.getElementById('inputRepetirPassword');
const btnGuardar = document.getElementById('btnGuardarPassword');
const btnVolver = document.getElementById('btnVolver');
const modalaviso = document.getElementById('modal-aviso');
const textoAviso = document.getElementById('textoAviso');
const btnX = document.getElementById('btn-x');
const blackout = document.getElementById('blackout');

let volverAlLogin = false;

function mostrarAviso(texto, volver = false) {
    volverAlLogin = volver;
    textoAviso.textContent = texto;
    modalaviso.classList.remove('oculto');
    blackout.classList.remove('oculto');
    modalaviso.style.display = 'flex';
    blackout.style.display = 'flex';
}

btnX.addEventListener('click', () => {
    if (volverAlLogin) {
        window.location.href = 'index.html';
        return;
    }
    modalaviso.classList.add('oculto');
    blackout.classList.add('oculto');
    modalaviso.style.display = '';
    blackout.style.display = '';
});

btnVolver.addEventListener('click', () => {
    window.location.href = 'index.html';
});

let sesionLista = false;

function habilitarFormulario() {
    sesionLista = true;
    btnGuardar.disabled = false;
}

supabase.auth.onAuthStateChange((evento, sesion) => {
    if (evento === 'PASSWORD_RECOVERY' || (evento === 'SIGNED_IN' && sesion)) {
        habilitarFormulario();
    }
});

setTimeout(async () => {
    if (sesionLista) return;

    const { data } = await supabase.auth.getSession();
    if (data && data.session) {
        habilitarFormulario();
    } else {
        mostrarAviso('El enlace no es válido o ya venció. Pedí uno nuevo desde el login', true);
    }
}, 1500);

btnGuardar.addEventListener('click', async () => {
    const nueva = inputNueva.value;
    const repetida = inputRepetir.value;

    if (nueva.length < 6) {
        mostrarAviso('La contraseña debe tener al menos 6 caracteres');
        return;
    }
    if (nueva !== repetida) {
        mostrarAviso('Las contraseñas no coinciden');
        return;
    }

    btnGuardar.disabled = true;

    const { error } = await supabase.auth.updateUser({ password: nueva });

    if (error) {
        btnGuardar.disabled = false;
        if (error.code === 'same_password') {
            mostrarAviso('La nueva contraseña debe ser distinta a la anterior');
        } else if (error.code === 'weak_password') {
            mostrarAviso('La contraseña es muy débil. Probá con una más segura');
        } else {
            mostrarAviso('No se pudo cambiar la contraseña. Pedí un enlace nuevo');
        }
        return;
    }

    await supabase.auth.signOut();
    mostrarAviso('Contraseña actualizada. Ya podés ingresar', true);
});

});
