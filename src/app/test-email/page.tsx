"use client";

import React, { useState } from "react";
import { testEmailAction } from "@/features/tickets/actions/testEmailAction";
import { toast } from "sonner";

export default function TestEmailPage() {
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleTestSend = async () => {
    if (!email) {
      toast.error("Por favor ingresa un correo electrónico");
      return;
    }

    setIsPending(true);
    try {
      const result = await testEmailAction(email);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(`Error: ${result.error}`);
        console.error(result.error);
      }
    } catch (error) {
      toast.error("Error al disparar la acción");
      console.error(error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Prueba de Envío de Correo
        </h1>
        <p className="text-gray-600 mb-6 text-sm">
          Ingresa tu dirección de correo para verificar que la configuración de
          Gmail SMTP (Nodemailer) funciona correctamente.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Enviar a:
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <button
            onClick={handleTestSend}
            disabled={isPending}
            className={`w-full py-3 rounded-lg font-bold text-white transition-all shadow-md ${
              isPending
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 hover:shadow-lg active:scale-95"
            }`}
          >
            {isPending ? "Enviando..." : "Enviar Correo de Prueba"}
          </button>
        </div>

        <div className="mt-8 p-4 bg-amber-50 rounded-lg border border-amber-100">
          <h2 className="text-sm font-bold text-amber-800 mb-2">
            Nota Importante:
          </h2>
          <ul className="text-xs text-amber-700 space-y-2 list-disc pl-4">
            <li>
              Asegúrate de haber guardado el archivo <code>.env.local</code>.
            </li>
            <li>
              Si obtienes un error de autenticación, verifica que estés usando
              una <b>Contraseña de Aplicación</b> de Google y no tu contraseña
              habitual.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
