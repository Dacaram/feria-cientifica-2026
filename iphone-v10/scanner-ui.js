import QrScanner from './vendor/qr-scanner.min.js';
export function makeScanner(onActivated){
  const panel=document.getElementById('qr-dialog'),video=document.getElementById('qr-video'),status=document.getElementById('qr-status'),photo=document.getElementById('qr-photo');
  let scanner=null,open=false,validating=false,previousFocus=null;
  function close(){open=false;scanner?.destroy();scanner=null;video.srcObject?.getTracks().forEach(t=>t.stop());video.srcObject=null;panel.hidden=true;document.body.classList.remove('scanning-qr');previousFocus?.focus();}
  async function decoded(value){
    if(validating||!open)return;validating=true;
    try{if(!window.isSecureContext){status.textContent='La activación necesita HTTPS. Abre la dirección segura del hosting.';return;}const accepted=await FeriaStore.accept(value);if(accepted){close();await onActivated();}else status.textContent='Ese QR no corresponde a esta feria. Usa el QR de activación del Liceo Los Almendros.';}
    catch(e){status.textContent='No se pudo guardar la activación. Abre Safari sin navegación privada y vuelve a intentarlo.';}
    finally{validating=false;}
  }
  async function start(){
    if(open)return;open=true;previousFocus=document.activeElement;panel.hidden=false;document.body.classList.add('scanning-qr');document.getElementById('qr-close').focus();
    if(!window.isSecureContext){status.textContent='La cámara necesita una conexión HTTPS. El hosting debe tener activado el certificado de seguridad.';return;}
    if(!navigator.mediaDevices?.getUserMedia){status.textContent='No hay una cámara disponible. Puedes leer una foto del QR con el botón de abajo.';return;}
    status.textContent='Permite usar la cámara y apunta al QR de la feria.';
    const current=new QrScanner(video,result=>decoded(result.data),{preferredCamera:'environment',maxScansPerSecond:8,returnDetailedScanResult:true});scanner=current;
    try{await current.start();if(!open||scanner!==current){current.destroy();return;}status.textContent='Encuadra el QR dentro de la cámara.';}
    catch(e){if(open)status.textContent='No se pudo abrir la cámara. Revisa el permiso de Safari o usa una foto del QR.';}
  }
  photo.addEventListener('change',async()=>{const file=photo.files?.[0];if(!file)return;status.textContent='Leyendo el QR de la imagen…';try{const result=await QrScanner.scanImage(file,{returnDetailedScanResult:true});await decoded(result.data);}catch(e){status.textContent='No se encontró un QR legible. Prueba con una imagen más nítida y completa.';}finally{photo.value='';}});
  document.getElementById('qr-close').addEventListener('click',close);
  panel.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const controls=[...panel.querySelectorAll('button,input')].filter(e=>!e.disabled);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&open)close();});window.addEventListener('pagehide',close);
  return {start,close};
}
