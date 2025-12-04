"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { Printer, QrCode } from "lucide-react";

interface ConfigItem {
  id: number;
  name: string;
}

interface QRGeneratorProps {
  areas: ConfigItem[];
}

export default function QRGenerator({ areas }: QRGeneratorProps) {
  const [qrLocation, setQrLocation] = useState("");

  return (
    <section className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Generador de Etiquetas QR
          </h2>
          <p className="text-gray-500">
            Crea códigos QR para pegar en las salas. Al escanearlos, los
            usuarios reportarán fallas con la ubicación ya configurada.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Nombre de la Ubicación / Sala
            </label>
            <select
              value={qrLocation}
              onChange={(e) => setQrLocation(e.target.value)}
              className="w-full border-2 border-gray-200 p-4 rounded-xl text-lg focus:border-sena-blue focus:ring-4 focus:ring-blue-50 transition-all outline-none"
            >
              <option value="" disabled>
                Seleccionar Ubicación...
              </option>
              {areas.map((area) => (
                <option key={area.id} value={area.name}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>

          {qrLocation && (
            <div
              id="printable-qr-label"
              className="bg-gray-50 p-8 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center animate-in zoom-in duration-300"
            >
              <style jsx global>{`
                @media print {
                  @page {
                    margin: 0;
                    size: auto;
                  }
                  body * {
                    visibility: hidden;
                  }
                  #printable-qr-label,
                  #printable-qr-label * {
                    visibility: visible;
                  }
                  #printable-qr-label {
                    position: fixed;
                    left: 0;
                    top: 0;
                    width: 100vw;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: white;
                    z-index: 9999;
                  }
                  .qr-content-wrapper {
                    border: 4px solid #000;
                    border-radius: 30px;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    transform: scale(1.1);
                    width: 600px;
                    height: 600px;
                    box-sizing: border-box;
                  }
                  .print-header {
                    display: block !important;
                    font-size: 28px;
                    font-weight: 900;
                    color: #39a900 !important;
                    text-transform: uppercase;
                    margin-bottom: 10px;
                    text-align: center;
                    line-height: 1;
                  }
                  .print-title-main {
                    display: block !important;
                    font-size: 24px;
                    font-weight: 800;
                    color: #000;
                    text-transform: uppercase;
                    text-align: center;
                    line-height: 1.2;
                  }
                  .print-title-sub {
                    font-size: 20px;
                    font-weight: 800;
                    color: #00324d !important;
                    text-transform: uppercase;
                    display: block;
                  }
                  .print-warning {
                    display: block !important;
                    font-size: 14px;
                    color: #dc2626;
                    font-weight: bold;
                    text-align: center;
                    margin-top: 15px;
                    border: 2px dashed #dc2626;
                    padding: 12px 20px;
                    border-radius: 12px;
                    width: 90%;
                  }
                  /* Ocultar el botón de imprimir en la vista de impresión */
                  #printable-qr-label button {
                    display: none;
                  }
                }
              `}</style>

              <div className="qr-content-wrapper flex flex-col items-center">
                <h2 className="print-header hidden">Mesa de Ayuda TIC</h2>
                <h1 className="hidden print-title-main mb-4 text-center">
                  REPORTE DE FALLA MASIVA
                  <span className="print-title-sub">
                    CONECTIVIDAD / INTERNET
                  </span>
                </h1>

                <div className="bg-white p-2 rounded-lg shadow-sm mb-2 border border-gray-100 print:border-none print:shadow-none">
                  <QRCode
                    value={`${
                      typeof window !== "undefined"
                        ? window.location.origin
                        : ""
                    }/?location=${encodeURIComponent(qrLocation)}`}
                    size={220}
                  />
                </div>
                <p className="font-bold text-gray-800 text-lg mb-1 text-center print:text-xl print:mb-2 uppercase">
                  {qrLocation}
                </p>

                <div className="hidden print-warning">
                  <p className="mb-1 text-red-600 uppercase font-black">
                    ⚠️ Uso exclusivo para fallas de internet
                  </p>
                  <p className="text-black font-medium text-sm leading-tight">
                    Para su correcto funcionamiento, reporte desde
                    <br />
                    su celular con <strong>DATOS MÓVILES</strong> activos.
                  </p>
                </div>

                <p className="text-xs text-gray-400 mb-6 text-center print:hidden">
                  Escanea este código para reportar una falla en esta ubicación
                </p>
              </div>

              <button
                onClick={() => window.print()}
                className="bg-sena-blue hover:bg-blue-800 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
              >
                <Printer className="w-5 h-5" /> Imprimir Etiqueta
              </button>
            </div>
          )}

          {!qrLocation && (
            <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <QrCode className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Escribe una ubicación para generar el código</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
