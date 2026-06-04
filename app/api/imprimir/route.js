import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ptp from 'pdf-to-printer';

export async function POST(request) {
  try {
    const body = await request.json();
    const { pdfData, filename } = body;

    if (!pdfData) {
      return NextResponse.json({ success: false, message: 'Falta pdfData' }, { status: 400 });
    }

    // 1. Crear un path temporal
    const tempDir = os.tmpdir();
    const safeFilename = filename || `documento-${Date.now()}.pdf`;
    const tempFilePath = path.join(tempDir, safeFilename);

    // 2. Escribir el archivo decodificando el Base64
    const buffer = Buffer.from(pdfData, 'base64');
    fs.writeFileSync(tempFilePath, buffer);

    // 3. Obtener la impresora configurada
    const printerName = process.env.PRINTER_NAME || '';
    const options = {};
    if (printerName.trim() !== '') {
      options.printer = printerName.trim();
    }

    console.log(`Enviando a imprimir archivo: ${tempFilePath} a la impresora: ${printerName || 'PREDETERMINADA'}`);

    // 4. Imprimir
    await ptp.print(tempFilePath, options);

    // 5. Limpiar archivo temporal de forma asíncrona
    try {
      fs.unlinkSync(tempFilePath);
    } catch (err) {
      console.error('No se pudo eliminar el archivo temporal:', err);
    }

    return NextResponse.json({ success: true, message: 'Impresión enviada correctamente a la cola.' });
  } catch (error) {
    console.error('Error en API de impresión local:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Error al imprimir en el servidor local: ' + error.message 
    }, { status: 500 });
  }
}
