import { NextResponse } from 'next/server';
import { exec } from 'child_process';

export async function POST() {
  try {
    console.log('Solicitud recibida para apagar el sistema...');
    
    // Ejecutar comando de apagado de Windows (apagado inmediato)
    exec('shutdown /s /t 0', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error al apagar el sistema: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`stderr al apagar el sistema: ${stderr}`);
        return;
      }
      console.log(`stdout al apagar el sistema: ${stdout}`);
    });

    return NextResponse.json({ success: true, message: 'Comando de apagado enviado correctamente.' });
  } catch (error) {
    console.error('Error al intentar apagar el sistema:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Error al enviar comando de apagado: ' + error.message 
    }, { status: 500 });
  }
}
