import { ZodError } from "zod";
import Logger from "./logger";

export type ActionState<T> = {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export const handleActionError = (error: unknown): ActionState<never> => {
  Logger.error("Server Action Error", error);

  if (error instanceof ZodError) {
    return {
      success: false,
      error: "Error de validación",
      fieldErrors: error.flatten().fieldErrors,
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: false,
    error: "Error desconocido en el servidor",
  };
};

export const createActionResponse = <T>(data: T): ActionState<T> => {
  return {
    success: true,
    data,
  };
};
