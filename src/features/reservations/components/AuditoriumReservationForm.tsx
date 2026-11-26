"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  UserCheck,
  Mail,
  Settings2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";

import { useReservations } from "../hooks/useReservations";
import { Reservation } from "../types";
import {
  getAssignableUsersAction,
  AssignableUser,
  deleteInstructorAssignmentAction,
  assignSpaceCoordinatorAction,
} from "../actions/reservationActions";
import { DEFAULT_SPACE_COORDINATORS } from "../constants";

import { UserProfile } from "@/features/auth/hooks/useUserProfile";
import { Skeleton } from "@/components/Skeleton";
import {
  getAllSpacesMaintenanceConfig,
  DEFAULT_AUDITORIUM_MAINTENANCE,
  getEnvironmentsGlobalConfig,
  DEFAULT_ENVIRONMENTS_CONFIG,
  resolveSpaceDisplayName,
} from "../services/maintenanceService";
import { SpaceMaintenanceConfig, EnvironmentsGlobalConfig } from "../types";
import {
  canAccessNextVigencia,
  FIXED_RESERVATION_RESOURCES,
  getCurrentVigenciaEndDateStr,
  getVisibleSpaceIdsForUser,
  hasCrossSpaceOverlap,
  isDateBeyondCurrentVigencia,
} from "../rules/reservationRules";

interface AuditoriumReservationFormProps {
  user: UserProfile["profile"];
  onCancel: () => void;
  onSuccess: () => void;
  reservationToEdit?: Reservation & { is_reservation?: boolean };
  legacyAssignmentIdToReplace?: number;
  initialSpace?: string;
  initialDate?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  variant?: "default" | "split";
  onSelectionChange?: (selection: {
    spaceId: string;
    date: string;
    startTime: string;
    endTime: string;
  }) => void;
}

// Helper to get local date string YYYY-MM-DD
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function AuditoriumReservationForm({
  user,
  onCancel,
  onSuccess,
  reservationToEdit,
  legacyAssignmentIdToReplace,
  initialSpace,
  initialDate,
  initialStartTime,
  initialEndTime,
  variant = "default",
  onSelectionChange,
}: AuditoriumReservationFormProps) {
  const isSplit = variant === "split";
  const todayStr = getLocalDateString();
  const allowNextVigencia = canAccessNextVigencia(user);
  const currentVigenciaMax = getCurrentVigenciaEndDateStr();
  const visibleSpaceIds = useMemo(
    () => getVisibleSpaceIdsForUser(user),
    [user],
  );
  const [startDate, setStartDate] = useState(
    initialDate && initialDate >= todayStr ? initialDate : todayStr,
  );
  const [finalDate, setFinalDate] = useState(
    initialDate && initialDate >= todayStr ? initialDate : todayStr,
  );

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Helper para verificar si un horario en una fecha específica ya pasó
  const isPastSlot = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return false;
    const [h, m] = timeStr.split(":").map(Number);
    const [y, mon, d] = dateStr.split("-").map(Number);
    const slotDate = new Date(y, mon - 1, d, h, m, 0);
    return slotDate.getTime() <= nowMs;
  };

  // Calcular hora de inicio por defecto futura si la fecha seleccionada es hoy
  const getInitialStartTime = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const nextHour = currentHour >= 7 && currentHour < 21 ? currentHour + 1 : 7;
    return `${nextHour.toString().padStart(2, "0")}:00`;
  };

  const getInitialEndTime = (start: string) => {
    const startH = parseInt(start.split(":")[0]);
    const nextH = Math.min(22, startH + 1);
    return `${nextH.toString().padStart(2, "0")}:00`;
  };

  const [startTime, setStartTime] = useState(
    initialStartTime || getInitialStartTime(),
  );
  const [endTime, setEndTime] = useState(
    initialEndTime ||
      getInitialEndTime(initialStartTime || getInitialStartTime()),
  );
  const [title, setTitle] = useState("");
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [multiDayMode, setMultiDayMode] = useState<"same" | "custom">("same");
  const [customDayTimes, setCustomDayTimes] = useState<
    Record<string, { startTime: string; endTime: string }>
  >({});
  const [isWeeklyRepeat, setIsWeeklyRepeat] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState(2);
  const [selectedSpace, setSelectedSpace] = useState(() => {
    const candidate = String(
      reservationToEdit?.auditorium_id || initialSpace || "1",
    );
    return visibleSpaceIds.includes(candidate)
      ? candidate
      : visibleSpaceIds[0] || "1";
  });
  const [assignedUserId, setAssignedUserId] = useState<string>(
    reservationToEdit?.user_id || user?.id || "",
  );
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [summaryData, setSummaryData] = useState<{
    title: string;
    spaceName: string;
    dates: string;
    timeRange: string;
    status: "APPROVED" | "PENDING";
  } | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (summaryData === null) return;
    if (countdown <= 0) {
      onSuccess();
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [summaryData, countdown, onSuccess]);

  // Calculate effective final date for query (multi-day or weekly repeat)
  const effectiveFinalDate = (() => {
    if (isMultiDay) return finalDate;
    if (isWeeklyRepeat && startDate) {
      const [sY, sM, sD] = startDate.split("-").map(Number);
      const endD = new Date(sY, sM - 1, sD);
      endD.setDate(endD.getDate() + (Math.min(repeatWeeks, 12) - 1) * 7);
      return getLocalDateString(endD);
    }
    return startDate;
  })();

  // Calculate the exact list of target dates
  const targetDates = (() => {
    const dates: string[] = [];
    if (isWeeklyRepeat && startDate) {
      const [sY, sM, sD] = startDate.split("-").map(Number);
      const current = new Date(sY, sM - 1, sD);
      for (let w = 0; w < Math.min(repeatWeeks, 12); w++) {
        dates.push(getLocalDateString(current));
        current.setDate(current.getDate() + 7);
      }
    } else if (isMultiDay && startDate && finalDate) {
      const [sY, sM, sD] = startDate.split("-").map(Number);
      const [eY, eM, eD] = finalDate.split("-").map(Number);
      const current = new Date(sY, sM - 1, sD);
      const end = new Date(eY, eM - 1, eD);
      let safetyCounter = 0;
      while (current <= end && safetyCounter < 31) {
        dates.push(getLocalDateString(current));
        current.setDate(current.getDate() + 1);
        safetyCounter++;
      }
    } else if (startDate) {
      dates.push(startDate);
    }
    return dates;
  })();

  // useReservations Hook
  const {
    reservations,
    currentUserVip,
    loading,
    createBatchReservations,
    createBatchTickets,
    syncTicketWithReservation,
  } = useReservations({
    userId: user?.id || "",
    startDate,
    finalDate: effectiveFinalDate,
  });

  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

  const [spacesMaintenance, setSpacesMaintenance] = useState<
    Record<string, SpaceMaintenanceConfig>
  >({});
  const [envGlobalConfig, setEnvGlobalConfig] =
    useState<EnvironmentsGlobalConfig>(DEFAULT_ENVIRONMENTS_CONFIG);

  const [isEditingRecipient, setIsEditingRecipient] = useState(false);
  const [recipientUserId, setRecipientUserId] = useState<string>("");
  const [recipientEmailInput, setRecipientEmailInput] = useState<string>("");
  const [recipientNameInput, setRecipientNameInput] = useState<string>("");
  const [isSavingRecipient, setIsSavingRecipient] = useState(false);

  const activeSpaceCoord = envGlobalConfig.coordinators?.[selectedSpace] ||
    DEFAULT_SPACE_COORDINATORS[selectedSpace] || {
      user_id: "",
      username: "jeavendano",
      email: "jeavendano@sena.edu.co",
      full_name: "Jorge Eduardo Avendaño (Logística Auditorio)",
      is_vip: true,
    };

  const isSuperAdmin =
    ((user?.role as string) || "").toLowerCase() === "superadmin";

  // Verificar si el usuario actual es Coordinador(a) o Administrador para permitir asignar reservas a terceros
  const canAssignToOthers = (() => {
    const u = user as {
      role?: string;
      job_category?: string;
      perm_manage_assignments?: boolean;
      is_vip?: boolean;
      username?: string;
      email?: string;
    } | null;
    if (!u) return false;
    const role = (u.role || "").toLowerCase();
    const jobCat = (u.job_category || "").toLowerCase();
    const uname = (u.username || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    return (
      ["admin", "superadmin", "coordinator", "vip"].includes(role) ||
      jobCat.includes("coordinador") ||
      !!u.perm_manage_assignments ||
      !!u.is_vip ||
      ["nbarrerac", "egutierrezn", "emgutierrezn", "dasanchezh"].some(
        (allowed) => uname.includes(allowed) || email.includes(allowed),
      )
    );
  })();

  useEffect(() => {
    if (user?.id && !reservationToEdit) {
      const t = setTimeout(() => setAssignedUserId(user.id!), 0);
      return () => clearTimeout(t);
    }
  }, [user?.id, reservationToEdit]);

  useEffect(() => {
    if (!canAssignToOthers) return;
    supabase.auth.getSession().then(({ data }) => {
      getAssignableUsersAction(data.session?.access_token).then((res) => {
        if (res.success && res.users) {
          setAssignableUsers(res.users);
        }
      });
    });
  }, [canAssignToOthers]);

  // Cargar configuración de mantenimiento y estado global de espacios
  useEffect(() => {
    getAllSpacesMaintenanceConfig().then((cfgs) => {
      setSpacesMaintenance(cfgs || {});
    });
    getEnvironmentsGlobalConfig().then((cfg) => {
      setEnvGlobalConfig(cfg);
    });
  }, []);

  // Sincronizar reactivamente cuando initialDate o initialSpace cambian (ej. doble clic en calendario)
  useEffect(() => {
    if (initialDate && !reservationToEdit) {
      const validDate = initialDate >= todayStr ? initialDate : todayStr;
      const t = setTimeout(() => {
        setStartDate(validDate);
        setFinalDate(validDate);
        if (initialStartTime) setStartTime(initialStartTime);
        if (initialEndTime) setEndTime(initialEndTime);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [
    initialDate,
    initialStartTime,
    initialEndTime,
    reservationToEdit,
    todayStr,
  ]);

  useEffect(() => {
    if (initialSpace && !reservationToEdit) {
      const safeSpace = visibleSpaceIds.includes(initialSpace)
        ? initialSpace
        : visibleSpaceIds[0] || "1";
      const t = setTimeout(() => setSelectedSpace(safeSpace), 0);
      return () => clearTimeout(t);
    }
  }, [initialSpace, reservationToEdit, visibleSpaceIds]);

  // Verificar si el espacio seleccionado se encuentra en pausa/remodelación o deshabilitado (bloqueo absoluto hasta habilitar)
  const maintenanceConfig =
    spacesMaintenance[selectedSpace] || DEFAULT_AUDITORIUM_MAINTENANCE;
  const isAuditoriumMaintenanceActive =
    Boolean(spacesMaintenance[selectedSpace]?.is_active) ||
    envGlobalConfig.disabled_special_spaces.includes(selectedSpace);

  // Initialize form if editing
  useEffect(() => {
    if (!reservationToEdit) return;
    const t = setTimeout(() => {
      try {
        if (!reservationToEdit.start_time || !reservationToEdit.end_time)
          return;

        const sDateObj = new Date(reservationToEdit.start_time);
        const eDateObj = new Date(reservationToEdit.end_time);

        const formatDate = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        };

        const formatTime = (d: Date) => {
          const h = String(d.getHours()).padStart(2, "0");
          const m = String(d.getMinutes()).padStart(2, "0");
          return `${h}:${m}`;
        };

        const sDate = formatDate(sDateObj);
        const eDate = formatDate(eDateObj);
        const sTime = formatTime(sDateObj);
        const eTime = formatTime(eDateObj);

        setStartDate(sDate);
        setFinalDate(eDate);
        setStartTime(sTime);
        setEndTime(eTime);
        setTitle(reservationToEdit.title || "");
        setSelectedResources(reservationToEdit.resources || []);
        setDescription(reservationToEdit.description || "");
        setIsMultiDay(sDate !== eDate);
        setSelectedSpace(
          String(reservationToEdit.auditorium_id || initialSpace || "1"),
        );
        if (reservationToEdit.user_id) {
          setAssignedUserId(reservationToEdit.user_id);
        }
      } catch (e) {
        console.error("Error parsing reservation dates:", e);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [reservationToEdit, initialSpace]);

  const getTimesForDate = (dateStr: string) => {
    if (isMultiDay && multiDayMode === "custom" && customDayTimes[dateStr]) {
      return customDayTimes[dateStr];
    }
    return { startTime, endTime };
  };

  // 2. Detectar conflictos visuales UI (Múltiples días o Semanales, respetando horario por día)
  const conflicts = useMemo<Reservation[]>(() => {
    if (isSuccess || isSubmitting) return [];
    if (!startTime || !endTime || !startDate || targetDates.length === 0)
      return [];

    const targetDateSet = new Set(targetDates);

    return reservations.filter((r) => {
      if (reservationToEdit && r.id === reservationToEdit.id) return false;
      if (String(r.auditorium_id) !== String(selectedSpace)) return false;

      const rStart = new Date(r.start_time);
      const rEnd = new Date(r.end_time);
      const rDateStr = getLocalDateString(rStart);

      if (!targetDateSet.has(rDateStr)) return false;

      const dayTimes =
        isMultiDay && multiDayMode === "custom" && customDayTimes[rDateStr]
          ? customDayTimes[rDateStr]
          : { startTime, endTime };

      const [sH, sM] = dayTimes.startTime.split(":").map(Number);
      const [eH, eM] = dayTimes.endTime.split(":").map(Number);

      const rStartHours = rStart.getHours() + rStart.getMinutes() / 60;
      const rEndHours = rEnd.getHours() + rEnd.getMinutes() / 60;
      const selectedStartHours = sH + sM / 60;
      const selectedEndHours = eH + eM / 60;

      return selectedStartHours < rEndHours && selectedEndHours > rStartHours;
    });
  }, [
    startTime,
    endTime,
    startDate,
    reservations,
    reservationToEdit,
    selectedSpace,
    isSuccess,
    isSubmitting,
    targetDates,
    isMultiDay,
    multiDayMode,
    customDayTimes,
  ]);

  // Detección de horarios pasados (evaluando horario específico de cada día)
  const hasPastDateSelected = targetDates.some((d) => d < todayStr);
  const hasPastTimeSelected = targetDates.some((d) => {
    const dayTimes =
      isMultiDay && multiDayMode === "custom" && customDayTimes[d]
        ? customDayTimes[d]
        : { startTime, endTime };
    return isPastSlot(d, dayTimes.startTime);
  });
  const isPastReservation =
    !reservationToEdit && (hasPastDateSelected || hasPastTimeSelected);

  // 3. Handle Submit
  const handleSubmit = async (e?: React.FormEvent, isOverride = false) => {
    if (e) e.preventDefault();

    if (!user?.id) return;
    if (submittingRef.current) return;

    if (!visibleSpaceIds.includes(String(selectedSpace))) {
      toast.error("No tienes permisos para reservar este ambiente.");
      return;
    }

    if (
      !allowNextVigencia &&
      targetDates.some((d) => isDateBeyondCurrentVigencia(d))
    ) {
      toast.error("Fecha no disponible para reserva.");
      return;
    }

    if (isAuditoriumMaintenanceActive) {
      toast.error(
        `${resolveSpaceDisplayName(selectedSpace)} se encuentra en pausa o remodelación. No se permiten reservas de ningún tipo hasta que sea habilitado nuevamente.`,
      );
      return;
    }

    if (isPastReservation) {
      toast.error(
        "No es posible realizar reservas en fechas u horarios que ya han pasado. Por favor selecciona una fecha y horario futuros.",
      );
      return;
    }

    // Evitar multi-reservas simultáneas del mismo usuario en otros ambientes
    const ownerUserId = assignedUserId || user.id;
    const ownerReservations = reservations.filter(
      (r) => String(r.user_id) === String(ownerUserId),
    );
    for (const d of targetDates) {
      const dayTimes = getTimesForDate(d);
      const dayStartIso = new Date(
        `${d}T${dayTimes.startTime}:00-05:00`,
      ).toISOString();
      const dayEndIso = new Date(
        `${d}T${dayTimes.endTime}:00-05:00`,
      ).toISOString();
      const crossOverlap = hasCrossSpaceOverlap(
        ownerReservations,
        String(selectedSpace),
        dayStartIso,
        dayEndIso,
        reservationToEdit?.id,
      );
      if (crossOverlap) {
        toast.error(
          `No puedes tener reservas simultáneas en diferentes ambientes (${resolveSpaceDisplayName(String(crossOverlap.auditorium_id || "1"))} el ${d}).`,
        );
        return;
      }
    }

    if (conflicts.length > 0 && !isOverride) {
      // Check if ANY conflict is from a VIP user
      const hasVipConflict = conflicts.some(
        (c) => c.users?.is_vip || c.users?.role?.toLowerCase() === "vip",
      );

      if (currentUserVip && !hasVipConflict) {
        setShowOverrideConfirm(true);
        return;
      } else {
        toast.error(
          "El horario no está disponible en las fechas seleccionadas.",
        );
        return;
      }
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      // NOTE: We no longer manually cancel conflicts here.
      // We pass the isOverride flag to the backend to handle it atomically.

      const datesToReserve: string[] = targetDates;

      // Build Payload Data
      const reservationsPayload = [];
      const supportTicketsPayload = [];

      for (let i = 0; i < datesToReserve.length; i++) {
        const date = datesToReserve[i];
        const dayTimes = getTimesForDate(date);
        const startDateObj = new Date(`${date}T${dayTimes.startTime}:00-05:00`);
        const endDateObj = new Date(`${date}T${dayTimes.endTime}:00-05:00`);
        const startIso = startDateObj.toISOString();
        const endIso = endDateObj.toISOString();

        // Target ID only for first if editing a real reservation (if replacing a legacy assignment, omit id so a new reservation is inserted)
        const targetId =
          i === 0 && !legacyAssignmentIdToReplace
            ? reservationToEdit?.id
            : undefined;

        reservationsPayload.push({
          id: targetId,
          title,
          start_time: startIso,
          end_time: endIso,
          user_id: assignedUserId || user?.id || "",
          auditorium_id: selectedSpace,
          resources: selectedResources,
          description,
        });

        supportTicketsPayload.push({
          date,
          start: dayTimes.startTime,
          end: dayTimes.endTime,
          isoStart: startIso,
        });
      }

      // Execute Batch or Single
      // Note: createBatchReservations handles conflict checking atomically.
      // We accept `isOverride` to force VIP override on the server.
      const result = await createBatchReservations(
        reservationsPayload,
        isOverride,
      );
      if (legacyAssignmentIdToReplace) {
        await deleteInstructorAssignmentAction(legacyAssignmentIdToReplace);
      }
      setIsSuccess(true); // Mark as success immediately to prevent conflict flash

      const isPending = Boolean(result?.pendingApproval);

      // Helpers para nombres de espacio
      const getSpaceName = (spaceId: string) => {
        if (spaceId === "1") return "Auditorio 103";
        if (spaceId === "3") return "Biblioteca";
        if (spaceId === "4") return "Ambiente 107";
        if (spaceId === "5") return "Ambiente de Cocina";
        return "Subdirección";
      };

      const spaceName = getSpaceName(selectedSpace);

      // Handle Support Tickets (solo si la reserva quedó aprobada de inmediato;
      // si queda PENDING, el ticket se generará cuando el coordinador autorice la solicitud)
      if (!isPending) {
        if (reservationToEdit && !legacyAssignmentIdToReplace) {
          // Al editar (ya sea multi-día o de un solo día), actualizamos el ticket consolidado original
          const datesString = supportTicketsPayload
            .map((t) => t.date.split("-").reverse().join("-"))
            .join(", ");
          const primerDia = supportTicketsPayload[0];

          const assignedUserObj = assignableUsers.find(
            (u) => u.id === assignedUserId,
          );
          const assignedInfo =
            assignedUserObj && assignedUserId !== user?.id
              ? `\nAsignado a: ${assignedUserObj.full_name} (${assignedUserObj.job_category || assignedUserObj.employment_type || "Funcionario"})`
              : "";

          const fullNewDescription = `Reserva de ${spaceName}: ${title}\nFechas: ${datesString}\nHora: ${primerDia.start} - ${primerDia.end}\nRecursos: ${selectedResources.join(
            ", ",
          )}\nDetalles: ${description}${assignedInfo}\n(ACTUALIZADO)`;

          await syncTicketWithReservation(reservationToEdit.title || "", {
            fullNewDescription,
            isoStart: primerDia.isoStart,
            previousUserId: reservationToEdit.user_id,
            newUserId: assignedUserId || reservationToEdit.user_id || user?.id,
          });
        } else {
          // Create Batch (New)
          // Agrupar todas las fechas en un solo ticket para evitar spam
          const datesString = supportTicketsPayload
            .map((t) => t.date.split("-").reverse().join("-"))
            .join(", ");

          const primerDia = supportTicketsPayload[0];

          const assignedUserObj = assignableUsers.find(
            (u) => u.id === assignedUserId,
          );
          const assignedInfo =
            assignedUserObj && assignedUserId !== user?.id
              ? `\nAsignado a: ${assignedUserObj.full_name} (${assignedUserObj.job_category || assignedUserObj.employment_type || "Funcionario"})`
              : "";

          const ticketConsolidado = {
            category: "Reserva Auditorio", // Mantenemos la categoría base por temas de filtrado en panel
            ticket_type: "REQ" as const,
            description: `Reserva de ${spaceName}: ${title}\nFechas: ${datesString}\nHora: ${primerDia.start} - ${primerDia.end}\nRecursos: ${selectedResources.join(", ")}\nDetalles: ${description}${assignedInfo}`,
            user_id: assignedUserId || user?.id || "",
            location: spaceName,
            event_date: primerDia.isoStart,
          };

          // Enviamos el ticket consolidado
          await createBatchTickets([ticketConsolidado]);
        }
      }

      if (isPending) {
        toast.info(
          "Solicitud de prereserva registrada. Queda pendiente de autorización.",
          { duration: 6000 },
        );
      } else {
        toast.success("Reserva(s) confirmada(s) con éxito.");
      }

      const datesString = supportTicketsPayload
        .map((t) => t.date.split("-").reverse().join("-"))
        .join(", ");

      setSummaryData({
        title,
        spaceName,
        dates: datesString,
        timeRange:
          isMultiDay && multiDayMode === "custom"
            ? "Horarios personalizados por día"
            : `${startTime} - ${endTime}`,
        status: isPending ? "PENDING" : "APPROVED",
      });
      setCountdown(5);
    } catch (error: unknown) {
      setIsSuccess(false); // Reset success on error just in case
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      toast.error(`Error: ${message}`);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
      setShowOverrideConfirm(false);
    }
  };

  const lastEmittedSelectionRef = useRef("");
  useEffect(() => {
    if (!onSelectionChange || reservationToEdit) return;
    const signature = `${selectedSpace}|${startDate}|${startTime}|${endTime}`;
    if (signature === lastEmittedSelectionRef.current) return;
    lastEmittedSelectionRef.current = signature;
    onSelectionChange({
      spaceId: selectedSpace,
      date: startDate,
      startTime,
      endTime,
    });
  }, [
    selectedSpace,
    startDate,
    startTime,
    endTime,
    onSelectionChange,
    reservationToEdit,
  ]);

  const timeSlots = Array.from({ length: 16 }, (_, i) => i + 6);
  const startHourNum = parseInt(startTime.split(":")[0] || "7");
  const endHourNum = parseInt(endTime.split(":")[0] || "8");
  const currentDurationHours = Math.max(1, endHourNum - startHourNum);
  const isPrerreservaSpace = ["3", "4", "5"].includes(String(selectedSpace));

  return (
    <form
      onSubmit={handleSubmit}
      className={
        isSplit
          ? "@container bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
          : "@container max-h-[85dvh] overflow-y-auto px-6 sm:px-8 py-6 sm:py-8 scrollbar-thin scrollbar-thumb-gray-200"
      }
    >
      {isSplit && (
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 bg-white">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-5 rounded-full bg-[#043263]" />
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Solicitar Reserva
            </h3>
          </div>
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              isPrerreservaSpace
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            {isPrerreservaSpace ? "Prerreserva" : "Confirmación Directa"}
          </span>
        </div>
      )}

      <div className={isSplit ? "p-4 sm:p-5 space-y-4" : "space-y-6 pb-4"}>
        {/* Título o Motivo de la Actividad en la parte superior */}
        <div
          className={
            isSplit
              ? "space-y-1"
              : "bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs"
          }
        >
          <label
            className={
              isSplit
                ? "block text-xs font-bold uppercase tracking-wide text-slate-600"
                : "block text-sm font-bold text-slate-800 mb-1.5"
            }
          >
            Título o Motivo de la Actividad *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={
              isSplit
                ? "w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#39A900] outline-none transition text-sm bg-white"
                : "w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sena-green outline-none transition text-sm"
            }
            placeholder="Ej: Reunión de Equipo, Capacitación, Sustentación..."
            required
          />
        </div>

        {/* Vista compacta Split: Ambiente + Fecha inicio lado a lado */}
        {isSplit && (
          <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1">
                Ambiente
              </label>
              <select
                value={selectedSpace}
                onChange={(e) => {
                  const id = e.target.value;
                  const paused =
                    envGlobalConfig.disabled_special_spaces.includes(id) ||
                    Boolean(spacesMaintenance[id]?.is_active);
                  if (paused) {
                    toast.warning(
                      `${resolveSpaceDisplayName(id)} se encuentra en pausa o remodelación.`,
                    );
                    return;
                  }
                  setSelectedSpace(id);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-[#39A900] outline-none"
              >
                {visibleSpaceIds.map((id) => {
                  const paused =
                    envGlobalConfig.disabled_special_spaces.includes(id) ||
                    Boolean(spacesMaintenance[id]?.is_active);
                  return (
                    <option key={id} value={id} disabled={paused}>
                      {resolveSpaceDisplayName(id)}
                      {paused ? " (En pausa)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1">
                {isWeeklyRepeat ? "Fecha Primera Sesión" : "Fecha Inicio"}
              </label>
              <input
                type="date"
                value={startDate}
                min={todayStr}
                max={!allowNextVigencia ? currentVigenciaMax : undefined}
                onChange={(e) => {
                  let val =
                    e.target.value >= todayStr ? e.target.value : todayStr;
                  if (!allowNextVigencia && val > currentVigenciaMax) {
                    val = currentVigenciaMax;
                  }
                  setStartDate(val);
                  if (!isMultiDay && !isWeeklyRepeat) {
                    setFinalDate(val);
                  } else if (isMultiDay && finalDate < val) {
                    setFinalDate(val);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#39A900] outline-none"
              />
            </div>
          </div>
        )}

        {/* Encabezado Técnico Swiss GovTech (solo modo modal estándar) */}
        {!isSplit && (
          <div className="bento-grid-swiss shadow-sm">
            <div className="bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className="tabular-mono text-xs font-bold px-2 py-0.5 bg-[#043263] text-white rounded">
                  GOV·SENA·2026
                </span>
                <span className="text-xs font-bold text-[#0F172A] tracking-tight uppercase">
                  {reservationToEdit
                    ? "MODO EDICIÓN · MATRIZ DE ESPACIOS"
                    : `MATRIZ DE RESERVA · ${resolveSpaceDisplayName(selectedSpace)}`}
                </span>
              </div>
              {(() => {
                const allIds = visibleSpaceIds;
                const pausedCount = allIds.filter(
                  (id) =>
                    envGlobalConfig.disabled_special_spaces.includes(id) ||
                    Boolean(spacesMaintenance[id]?.is_active),
                ).length;
                const enabledCount = allIds.length - pausedCount;
                return (
                  <div className="flex items-center gap-3 text-xs tabular-mono text-slate-600">
                    <span>
                      Habilitados:{" "}
                      <strong className="text-[#39A900]">{enabledCount}</strong>
                    </span>
                    <span>
                      En Pausa:{" "}
                      <strong className="text-[#FC7323]">{pausedCount}</strong>
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Retícula Bento 1px de Selección de Espacio */}
            <div className="bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="swiss-section-tag">
                  01 / SELECCIÓN DE AMBIENTE
                </label>
                <span className="tabular-mono text-[11px] font-bold text-[#39A900]">
                  ● {resolveSpaceDisplayName(selectedSpace)}
                </span>
              </div>

              <div
                className={`grid grid-cols-1 @sm:grid-cols-2 ${
                  visibleSpaceIds.length <= 3
                    ? "@xl:grid-cols-3"
                    : "@xl:grid-cols-5"
                } gap-2.5`}
              >
                {(() => {
                  const spaceItems = [
                    {
                      id: "1",
                      name: "Auditorio 103",
                      subtitle: "Uso General",
                      visible: visibleSpaceIds.includes("1"),
                    },
                    {
                      id: "2",
                      name: "Subdirección",
                      subtitle: "Institucional",
                      visible: visibleSpaceIds.includes("2"),
                    },
                    {
                      id: "3",
                      name: "Biblioteca",
                      subtitle: "Académico",
                      visible: visibleSpaceIds.includes("3"),
                    },
                    {
                      id: "4",
                      name: "Ambiente 107",
                      subtitle: "Uso General",
                      visible: visibleSpaceIds.includes("4"),
                    },
                    {
                      id: "5",
                      name: "Ambiente de Cocina",
                      subtitle: "Prerreserva",
                      visible: visibleSpaceIds.includes("5"),
                    },
                  ];

                  return spaceItems
                    .filter((sp) => sp.visible)
                    .map((sp) => {
                      const isDisabledGlobal =
                        envGlobalConfig.disabled_special_spaces.includes(sp.id);
                      const isMaintActive = Boolean(
                        spacesMaintenance[sp.id]?.is_active,
                      );
                      const isPaused = isDisabledGlobal || isMaintActive;
                      const isSelected = selectedSpace === sp.id;

                      return (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => {
                            if (isPaused) {
                              toast.warning(
                                `${sp.name} se encuentra en pausa o remodelación. No se pueden realizar reservas hasta que sea habilitado nuevamente.`,
                              );
                              return;
                            }
                            setSelectedSpace(sp.id);
                          }}
                          className={`min-h-[76px] p-3 rounded-xl border text-left transition-all active:translate-y-[1px] flex flex-col justify-between ${
                            isSelected
                              ? "border-2 border-[#39A900] bg-emerald-50/50 text-[#0F172A] shadow-sm"
                              : isPaused
                                ? "border-orange-300 bg-orange-50/60 text-amber-950 hover:border-orange-400"
                                : "border-slate-200 bg-white text-slate-700 hover:border-[#043263]"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full gap-1.5">
                            <span className="font-bold text-xs leading-tight flex items-center gap-1.5">
                              <Calendar
                                className={`w-4 h-4 shrink-0 ${
                                  isSelected
                                    ? "text-[#39A900]"
                                    : isPaused
                                      ? "text-[#FC7323]"
                                      : "text-[#043263]"
                                }`}
                              />
                              {sp.name}
                            </span>
                            {isPaused ? (
                              <span className="tabular-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FC7323] text-white shrink-0">
                                PAUSA
                              </span>
                            ) : (
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isSelected ? "bg-[#39A900]" : "bg-emerald-400"
                                }`}
                              />
                            )}
                          </div>
                          <div className="tabular-mono text-[11px] text-slate-500 mt-1.5 flex items-center justify-between">
                            <span>
                              {isPaused ? "Obras / Mantenimiento" : sp.subtitle}
                            </span>
                            <span className="text-[10px] font-bold opacity-70">
                              0{sp.id}
                            </span>
                          </div>
                        </button>
                      );
                    });
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Selector de Asignación para Coordinadores / Administradores (Bento Cell 02) */}
        {canAssignToOthers && assignableUsers.length > 0 && (
          <div className="bento-grid-swiss shadow-sm">
            <div className="bg-[#F8FAFC] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="swiss-section-tag flex items-center gap-2 text-[#043263]">
                  <UserCheck className="w-4 h-4 text-[#39A900]" />
                  {reservationToEdit
                    ? "02 / RESPONSABLE DE LA RESERVA (REASIGNAR A TERCERO)"
                    : "02 / DELEGAR RESERVA A INSTRUCTOR O FUNCIONARIO"}
                </label>
                <span className="tabular-mono text-[11px] font-bold bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded border border-emerald-200">
                  PRIVILEGIO COORDINACIÓN
                </span>
              </div>
              <div className="grid grid-cols-1 @sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre o usuario..."
                  className="w-full min-h-[44px] p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#39A900] outline-none"
                />
                <select
                  value={assignedUserId}
                  onChange={(e) => setAssignedUserId(e.target.value)}
                  className="w-full min-h-[44px] p-2.5 border border-slate-300 rounded-lg text-sm bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-[#39A900] outline-none"
                >
                  <option value={user?.id || ""}>
                    A mi nombre ({user?.full_name || "Titular actual"})
                  </option>
                  {assignableUsers
                    .filter((u) => {
                      if (u.id === user?.id) return false;
                      if (!userSearchTerm.trim()) return true;
                      const q = userSearchTerm.toLowerCase();
                      return (
                        (u.full_name || "").toLowerCase().includes(q) ||
                        (u.username || "").toLowerCase().includes(q) ||
                        (u.job_category || "").toLowerCase().includes(q)
                      );
                    })
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} —{" "}
                        {u.job_category
                          ? u.job_category.toUpperCase()
                          : u.employment_type || "Funcionario"}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Título */}
        {selectedSpace === "1" && (
          <div className="relative group overflow-hidden bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 rounded-2xl p-6 shadow-lg shadow-amber-900/10 animate-in zoom-in-95 duration-500">
            {/* Elemento decorativo de fondo */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-amber-200/30 rounded-full blur-2xl group-hover:bg-amber-300/40 transition-all duration-700" />

            <div className="relative flex gap-5">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/40 animate-pulse">
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
              </div>

              <div className="flex-grow">
                <h4 className="text-amber-900 font-black text-lg tracking-tight mb-1 uppercase">
                  ¡Aviso Crítico de Conectividad!
                </h4>
                <p className="text-amber-800 text-sm leading-relaxed font-medium">
                  Para el uso del{" "}
                  <span className="underline decoration-amber-500 decoration-2 underline-offset-2">
                    cable HDMI óptico
                  </span>
                  , está estrictamente autorizado{" "}
                  <strong>
                    únicamente el equipo portátil del centro de formación
                  </strong>
                  .
                </p>
                <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-amber-700 bg-amber-200/50 w-fit px-3 py-1 rounded-full border border-amber-300/50">
                  <div className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-ping" />
                  PROTECCIÓN DE VIDA ÚTIL DEL EQUIPO
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fechas */}
        <div
          className={
            isSplit
              ? isMultiDay || isWeeklyRepeat
                ? "bg-[#F4F8FF] p-3.5 rounded-xl border border-blue-200 space-y-3"
                : "space-y-2"
              : "bg-gray-50/50 p-6 rounded-2xl border border-gray-100 shadow-sm"
          }
        >
          <div
            className={`flex flex-wrap items-center justify-between gap-2 ${
              isSplit && !isMultiDay && !isWeeklyRepeat ? "" : "mb-3"
            }`}
          >
            {!isSplit && (
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Fechas
              </label>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="multiDay"
                  checked={isMultiDay}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsMultiDay(checked);
                    if (checked) {
                      setIsWeeklyRepeat(false);
                      if (finalDate <= startDate) {
                        const [sY, sM, sD] = startDate.split("-").map(Number);
                        const nextD = new Date(sY, sM - 1, sD + 1);
                        let nextStr = getLocalDateString(nextD);
                        if (
                          !allowNextVigencia &&
                          nextStr > currentVigenciaMax
                        ) {
                          nextStr = currentVigenciaMax;
                        }
                        setFinalDate(nextStr);
                      }
                    } else {
                      setFinalDate(startDate);
                    }
                  }}
                  className="w-4 h-4 text-sena-green rounded focus:ring-sena-green"
                />
                <label
                  htmlFor="multiDay"
                  className="text-xs font-semibold text-gray-700 cursor-pointer"
                >
                  Días seguidos
                </label>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  id="weeklyRepeat"
                  checked={isWeeklyRepeat}
                  onChange={(e) => {
                    setIsWeeklyRepeat(e.target.checked);
                    if (e.target.checked) setIsMultiDay(false);
                  }}
                  className="w-4 h-4 text-sena-green rounded focus:ring-sena-green"
                />
                <label
                  htmlFor="weeklyRepeat"
                  className="text-xs font-semibold text-gray-700 cursor-pointer"
                >
                  Repetir semanalmente
                </label>
              </div>
            </div>
          </div>

          {(!isSplit || isMultiDay || isWeeklyRepeat) && (
            <div
              className={`grid grid-cols-1 ${
                isSplit ? "" : "sm:grid-cols-2"
              } gap-4`}
            >
              {!isSplit && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {isWeeklyRepeat ? "Fecha Primera Sesión" : "Fecha Inicio"}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    min={todayStr}
                    max={!allowNextVigencia ? currentVigenciaMax : undefined}
                    onChange={(e) => {
                      let val =
                        e.target.value >= todayStr ? e.target.value : todayStr;
                      if (!allowNextVigencia && val > currentVigenciaMax) {
                        val = currentVigenciaMax;
                      }
                      setStartDate(val);
                      if (!isMultiDay && !isWeeklyRepeat) {
                        setFinalDate(val);
                      } else if (isMultiDay && finalDate < val) {
                        setFinalDate(val);
                      }
                    }}
                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-sena-green outline-none"
                  />
                </div>
              )}
              {isMultiDay && (
                <div className="animate-in fade-in slide-in-from-left-2">
                  <label className="block text-xs text-gray-600 font-semibold mb-1">
                    Hasta fecha ({targetDates.length}{" "}
                    {targetDates.length === 1 ? "día" : "días seguidos"})
                  </label>
                  <input
                    type="date"
                    value={finalDate}
                    min={startDate}
                    max={!allowNextVigencia ? currentVigenciaMax : undefined}
                    onChange={(e) => {
                      let val =
                        e.target.value >= startDate
                          ? e.target.value
                          : startDate;
                      if (!allowNextVigencia && val > currentVigenciaMax) {
                        val = currentVigenciaMax;
                      }
                      setFinalDate(val);
                    }}
                    className="w-full p-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-sena-green outline-none"
                  />
                </div>
              )}
              {isWeeklyRepeat && (
                <div className="animate-in fade-in slide-in-from-left-2">
                  <label className="block text-xs text-gray-600 font-semibold mb-1">
                    Número de Semanas
                  </label>
                  <select
                    value={repeatWeeks}
                    onChange={(e) => setRepeatWeeks(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-sena-green outline-none bg-white"
                  >
                    {[2, 3, 4, 6, 8, 12].map((w) => (
                      <option key={w} value={w}>
                        {w} semanas (1 sesión cada 7 días)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {isMultiDay && (
            <div className="mt-4 pt-3 border-t border-gray-200/70 space-y-2">
              <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Horario para los {targetDates.length} días seguidos
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMultiDayMode("same")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    multiDayMode === "same"
                      ? "bg-[#043263] text-white border-[#043263]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  Mismo horario todos los días
                </button>
                <button
                  type="button"
                  onClick={() => setMultiDayMode("custom")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    multiDayMode === "custom"
                      ? "bg-[#043263] text-white border-[#043263]"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  Horario diferente por día
                </button>
              </div>
            </div>
          )}

          {(isWeeklyRepeat || (isMultiDay && targetDates.length > 0)) && (
            <div className="mt-4 pt-3 border-t border-gray-100 animate-in fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {isWeeklyRepeat
                    ? `Sesiones a reservar (${targetDates.length} semanas, cada 7 días):`
                    : `Días continuos seleccionados (${targetDates.length} días):`}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {targetDates.map((dateStr) => {
                  const [y, m, d] = dateStr.split("-").map(Number);
                  const dateObj = new Date(y, m - 1, d);
                  const dayName = dateObj.toLocaleDateString("es-CO", {
                    weekday: "short",
                  });
                  const formatted = `${dayName.toUpperCase()} ${d}/${m}/${y}`;
                  return (
                    <span
                      key={dateStr}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                      {formatted}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Horas */}
        {isMultiDay && multiDayMode === "custom" ? (
          <div className="space-y-2.5">
            <label className="block text-sm font-bold text-gray-700">
              Horario Personalizado por Día ({targetDates.length} días)
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {targetDates.map((dateStr) => {
                const dayTimes = getTimesForDate(dateStr);
                const [y, m, d] = dateStr.split("-").map(Number);
                const dateObj = new Date(y, m - 1, d);
                const label = dateObj.toLocaleDateString("es-CO", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                });
                return (
                  <div
                    key={dateStr}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center p-2.5 bg-white border border-slate-200 rounded-xl"
                  >
                    <span className="text-xs font-bold text-slate-700 capitalize">
                      {label}
                    </span>
                    <select
                      value={dayTimes.startTime}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        const sH = parseInt(newStart.split(":")[0]);
                        const eH = parseInt(dayTimes.endTime.split(":")[0]);
                        const nextEnd =
                          eH <= sH
                            ? `${Math.min(22, sH + 1)
                                .toString()
                                .padStart(2, "0")}:00`
                            : dayTimes.endTime;
                        setCustomDayTimes((prev) => ({
                          ...prev,
                          [dateStr]: { startTime: newStart, endTime: nextEnd },
                        }));
                      }}
                      className="w-full p-2 border rounded-lg text-xs focus:ring-2 focus:ring-sena-green outline-none bg-white"
                    >
                      {timeSlots.map((hour) => {
                        const hourStr = `${hour.toString().padStart(2, "0")}:00`;
                        const isPast = isPastSlot(dateStr, hourStr);
                        return (
                          <option
                            key={`${dateStr}-start-${hour}`}
                            value={hourStr}
                            disabled={isPast}
                          >
                            {hour === 12
                              ? "12:00 PM"
                              : hour > 12
                                ? `${hour - 12}:00 PM`
                                : `${hour}:00 AM`}
                            {isPast ? " (Pasado)" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <select
                      value={dayTimes.endTime}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        setCustomDayTimes((prev) => ({
                          ...prev,
                          [dateStr]: {
                            startTime: dayTimes.startTime,
                            endTime: newEnd,
                          },
                        }));
                      }}
                      className="w-full p-2 border rounded-lg text-xs focus:ring-2 focus:ring-sena-green outline-none bg-white"
                    >
                      {[...timeSlots, 22].map((hour) => (
                        <option
                          key={`${dateStr}-end-${hour}`}
                          value={`${hour.toString().padStart(2, "0")}:00`}
                          disabled={
                            hour <= parseInt(dayTimes.startTime.split(":")[0])
                          }
                        >
                          {hour === 12
                            ? "12:00 PM"
                            : hour > 12
                              ? `${hour - 12}:00 PM`
                              : `${hour}:00 AM`}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1">
                  Hora Inicio
                </label>
                <select
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    const sH = parseInt(e.target.value.split(":")[0]);
                    const eH = parseInt(endTime.split(":")[0]);
                    if (eH <= sH) {
                      setEndTime(
                        `${Math.min(22, sH + 1)
                          .toString()
                          .padStart(2, "0")}:00`,
                      );
                    }
                  }}
                  className={
                    isSplit
                      ? "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#39A900] outline-none"
                      : "w-full p-3 border rounded-xl focus:ring-2 focus:ring-sena-green outline-none transition"
                  }
                >
                  {timeSlots.map((hour) => {
                    const hourStr = `${hour.toString().padStart(2, "0")}:00`;
                    const isPast = targetDates.some((d) =>
                      isPastSlot(d, hourStr),
                    );
                    return (
                      <option
                        key={`start-${hour}`}
                        value={hourStr}
                        disabled={isPast}
                      >
                        {hour === 12
                          ? "12:00 PM"
                          : hour > 12
                            ? `${hour - 12}:00 PM`
                            : `${hour}:00 AM`}
                        {isPast ? " (No disponible - Pasado)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1">
                  Hora Fin (mín. 1h)
                </label>
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className={
                    isSplit
                      ? "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#39A900] outline-none"
                      : "w-full p-3 border rounded-xl focus:ring-2 focus:ring-sena-green outline-none transition"
                  }
                >
                  {[...timeSlots, 22].map((hour) => (
                    <option
                      key={`end-${hour}`}
                      value={`${hour.toString().padStart(2, "0")}:00`}
                      disabled={hour <= parseInt(startTime.split(":")[0])}
                    >
                      {hour === 12
                        ? "12:00 PM"
                        : hour > 12
                          ? `${hour - 12}:00 PM`
                          : `${hour}:00 AM`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <span>
                Duración:{" "}
                <strong className="tabular-mono text-slate-900">
                  {currentDurationHours}{" "}
                  {currentDurationHours === 1 ? "hora" : "horas"} ({startTime} -{" "}
                  {endTime})
                </strong>
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4].map((hrs) => {
                  const targetEnd = Math.min(22, startHourNum + hrs);
                  const canFit = startHourNum + hrs <= 22;
                  const active = currentDurationHours === hrs;
                  return (
                    <button
                      key={hrs}
                      type="button"
                      disabled={!canFit}
                      onClick={() =>
                        setEndTime(
                          `${targetEnd.toString().padStart(2, "0")}:00`,
                        )
                      }
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        active
                          ? "bg-[#043263] text-white border-[#043263]"
                          : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      {hrs}h
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Advertencia de horario en tiempo pasado */}
        {isPastReservation && (
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 flex items-center gap-3 animate-in fade-in">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-xs uppercase tracking-wider">
                Horario en tiempo pasado
              </p>
              <p className="text-xs text-amber-800 mt-0.5 font-medium">
                No se pueden realizar reservas en fechas u horarios que ya han
                transcurrido. Por favor selecciona un horario o fecha futuros.
              </p>
            </div>
          </div>
        )}

        {/* Recursos */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            Recursos Necesarios
          </label>
          <div className="flex flex-wrap gap-3">
            {FIXED_RESERVATION_RESOURCES.map((resource) => (
              <label
                key={resource}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-all ${
                  selectedResources.includes(resource)
                    ? "bg-green-50 border-sena-green text-sena-green font-medium"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={selectedResources.includes(resource)}
                  onChange={(e) => {
                    if (e.target.checked)
                      setSelectedResources([...selectedResources, resource]);
                    else
                      setSelectedResources(
                        selectedResources.filter((r) => r !== resource),
                      );
                  }}
                />
                {selectedResources.includes(resource) && (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                {resource}
              </label>
            ))}
          </div>
        </div>

        {/* Requerimientos Adicionales + Configuración de Correo de Destino */}
        <div className="bento-grid-swiss shadow-2xs">
          <div className="bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-sm font-bold text-slate-800">
                Requerimientos Especiales (Opcional)
              </label>

              {/* Correo de Destino actual + Botón para cambiarlo: exclusivo SuperAdmin */}
              {isSuperAdmin && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-[#39A900]" />
                    <span>Notifica solo si agregas texto:</span>
                    <strong className="text-[#043263]">
                      {activeSpaceCoord.full_name}
                    </strong>
                    <span className="tabular-mono text-[11px] text-slate-500">
                      ({activeSpaceCoord.email})
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isEditingRecipient) {
                        setRecipientUserId(activeSpaceCoord.user_id || "");
                        setRecipientEmailInput(activeSpaceCoord.email || "");
                        setRecipientNameInput(activeSpaceCoord.full_name || "");
                      }
                      setIsEditingRecipient((prev) => !prev);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#043263] hover:bg-[#053b75] text-white font-bold text-[11px] transition cursor-pointer"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-emerald-300" />
                    <span>
                      {isEditingRecipient
                        ? "Cerrar ajuste"
                        : "Cambiar Correo Destino"}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Panel Desplegable exclusivo SuperAdmin para actualizar Correo de Destino y Notificar Nuevo Rol */}
            {isEditingRecipient && isSuperAdmin && (
              <div className="swiss-view-enter p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-[#043263]">
                      Actualizar Destinatario de Prerreservas y Requerimientos
                      Especiales — {resolveSpaceDisplayName(selectedSpace)}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Al guardar el cambio, el sistema actualizará el correo de
                      destino para{" "}
                      <strong>{resolveSpaceDisplayName(selectedSpace)}</strong>{" "}
                      y enviará automáticamente un correo al nuevo responsable
                      notificándole que, debido a su rol institucional, a partir
                      de ahora recibirá las solicitudes de prerreserva y
                      requerimientos especiales.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 @sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      1. Seleccionar del Directorio (Opcional)
                    </label>
                    <select
                      value={recipientUserId}
                      onChange={(e) => {
                        const uid = e.target.value;
                        setRecipientUserId(uid);
                        const found = assignableUsers.find((u) => u.id === uid);
                        if (found) {
                          setRecipientNameInput(found.full_name || "");
                          const cleanU = (found.username || "")
                            .toLowerCase()
                            .trim();
                          const resolvedMail =
                            found.email &&
                            found.email.includes("@") &&
                            !found.email.endsWith("@sistema.local")
                              ? found.email.toLowerCase().trim()
                              : `${cleanU}@sena.edu.co`;
                          setRecipientEmailInput(resolvedMail);
                        }
                      }}
                      className="w-full p-2 border border-emerald-300 rounded-lg text-xs bg-white font-medium text-slate-800 focus:ring-2 focus:ring-[#39A900] outline-none"
                    >
                      <option value="">
                        -- Seleccionar funcionario o escribir manual --
                      </option>
                      {assignableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} (@{u.username})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      2. Nombre del Responsable
                    </label>
                    <input
                      type="text"
                      value={recipientNameInput}
                      onChange={(e) => setRecipientNameInput(e.target.value)}
                      placeholder="Nombre del funcionario..."
                      className="w-full p-2 border border-emerald-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#39A900] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                      3. Correo Institucional de Destino *
                    </label>
                    <input
                      type="email"
                      value={recipientEmailInput}
                      onChange={(e) => setRecipientEmailInput(e.target.value)}
                      placeholder="ejemplo@sena.edu.co"
                      className="w-full p-2 border border-emerald-300 rounded-lg text-xs tabular-mono bg-white focus:ring-2 focus:ring-[#39A900] outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingRecipient(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={
                      isSavingRecipient || !recipientEmailInput.includes("@")
                    }
                    onClick={async () => {
                      if (!recipientEmailInput.includes("@")) {
                        toast.warning(
                          "Ingresa un correo electrónico de destino válido.",
                        );
                        return;
                      }
                      setIsSavingRecipient(true);
                      try {
                        const {
                          data: { session },
                        } = await supabase.auth.getSession();
                        const res = await assignSpaceCoordinatorAction({
                          spaceId: selectedSpace,
                          userId: recipientUserId || null,
                          customEmail: recipientEmailInput.trim(),
                          customName: recipientNameInput.trim(),
                          accessToken: session?.access_token,
                        });
                        if (res.error) {
                          toast.error(res.error);
                          return;
                        }
                        if (res.config) {
                          setEnvGlobalConfig(res.config);
                        }
                        toast.success(
                          `Destinatario de ${resolveSpaceDisplayName(selectedSpace)} actualizado a ${recipientEmailInput}. Se ha enviado correo notificándole su nuevo rol institucional.`,
                          { duration: 6000 },
                        );
                        setIsEditingRecipient(false);
                      } catch {
                        toast.error(
                          "No se pudo actualizar el correo de destino.",
                        );
                      } finally {
                        setIsSavingRecipient(false);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[#39A900] hover:bg-[#2d8500] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isSavingRecipient ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Actualizando y notificando...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5" />
                        <span>Guardar Destino y Notificar Nuevo Rol</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sena-green outline-none transition min-h-[90px] text-sm"
              placeholder="Ej: Números de contacto, encargado, organización especial de mesas, sonido o logística requerida..."
            />
          </div>
        </div>

        {/* Disponibilidad inline (solo modo estándar; en vista Split se usa UnifiedAvailabilityCalendar) */}
        {!isSplit && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-gray-700 text-sm">
                Disponibilidad
              </h4>
              <div className="flex gap-3 text-[10px]">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-100 border border-green-300"></div>
                  Libre
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-100 border border-red-300"></div>
                  Ocupado
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-100 border border-blue-300"></div>
                  Tu Selección
                </span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1">
              {loading
                ? Array.from({ length: 15 }).map((_, idx) => (
                    <Skeleton
                      key={idx}
                      className="h-10 w-full rounded border border-gray-100"
                    />
                  ))
                : timeSlots.map((hour) => {
                    const formatHour = (h: number) =>
                      h.toString().padStart(2, "0");
                    const slotStart = new Date(
                      `${startDate}T${formatHour(hour)}:00:00-05:00`,
                    );
                    const slotEnd = new Date(
                      `${startDate}T${formatHour(hour + 1)}:00:00-05:00`,
                    );

                    const isOccupied = reservations.some((r) => {
                      if (String(r.auditorium_id) !== String(selectedSpace))
                        return false;
                      const rStart = new Date(r.start_time);
                      const rEnd = new Date(r.end_time);
                      return (
                        slotStart.getTime() < rEnd.getTime() &&
                        slotEnd.getTime() > rStart.getTime()
                      );
                    });

                    const selectedDayTimes = getTimesForDate(startDate);
                    const isSelected =
                      selectedDayTimes.startTime &&
                      selectedDayTimes.endTime &&
                      hour >=
                        parseInt(selectedDayTimes.startTime.split(":")[0]) &&
                      hour < parseInt(selectedDayTimes.endTime.split(":")[0]);

                    return (
                      <div
                        key={hour}
                        className={`p-2 rounded border text-center text-xs transition-all ${
                          isOccupied
                            ? "bg-red-50 border-red-200 text-red-400 cursor-not-allowed"
                            : isSelected
                              ? "bg-blue-50 border-blue-300 text-blue-700 font-bold shadow-sm ring-1 ring-blue-200"
                              : "bg-white border-green-100 hover:border-green-300 text-gray-600"
                        }`}
                      >
                        {hour}:00
                      </div>
                    );
                  })}
            </div>
          </div>
        )}

        {/* Conflicto Msg */}
        {conflicts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 animate-in fade-in slide-in-from-bottom-2">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <h4 className="font-bold text-red-700 text-sm">
                Horario No Disponible
              </h4>
              <p className="text-xs text-red-600 mt-1">
                {conflicts.length === 1 ? (
                  <>
                    Ya existe una reserva de{" "}
                    <strong>{conflicts[0].users?.full_name}</strong>.
                  </>
                ) : (
                  <>
                    Ya existen {conflicts.length} reservas en este horario
                    (Usuarios:{" "}
                    <strong>
                      {conflicts.map((c) => c.users?.full_name).join(", ")}
                    </strong>
                    ).
                  </>
                )}
                {currentUserVip && !conflicts.some((c) => c.users?.is_vip) && (
                  <span className="block mt-1 font-bold text-sena-orange">
                    Como usuario VIP, puedes tomar este horario.
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* ALERTA DE REMODELACIÓN / FUERA DE SERVICIO */}
        {isAuditoriumMaintenanceActive &&
          !["admin", "superadmin"].includes(
            ((user?.role as string) || "").toLowerCase(),
          ) && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-black text-amber-900 text-sm uppercase">
                    {maintenanceConfig.space_name ||
                      resolveSpaceDisplayName(selectedSpace)}{" "}
                    en Remodelación / Fuera de Servicio
                  </h4>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Las fechas seleccionadas caen dentro del periodo de obras y
                    adecuaciones de{" "}
                    <strong>
                      {maintenanceConfig.space_name ||
                        resolveSpaceDisplayName(selectedSpace)}
                    </strong>{" "}
                    (a partir del{" "}
                    <strong>{maintenanceConfig.start_date}</strong>
                    {maintenanceConfig.end_date
                      ? ` hasta el ${maintenanceConfig.end_date}`
                      : " por el resto de la vigencia 2026"}
                    ).
                  </p>
                  <p className="text-xs text-amber-900 font-semibold pt-1">
                    🚫 Las reservas se encuentran suspendidas. Para eventos
                    especiales, remítase a la Coordinación Académica o de
                    Formación.
                  </p>
                </div>
              </div>
            </div>
          )}

        {!visibleSpaceIds.includes(String(selectedSpace)) ? (
          <div className="bg-orange-50 border-orange-200 text-orange-800 border p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-orange-600" />
            <div className="text-sm">
              <p className="font-bold">Acceso Restringido</p>
              <p>
                No tienes permisos para solicitar reservas en este ambiente.
              </p>
            </div>
          </div>
        ) : (
          <div
            className={
              isSplit
                ? "flex flex-col-reverse sm:flex-row gap-3 pt-2"
                : "flex gap-4 pt-4"
            }
          >
            <button
              type="button"
              onClick={onCancel}
              className={
                isSplit
                  ? "sm:flex-1 px-4 py-3 border border-slate-300 rounded-xl font-bold text-slate-600 bg-white hover:bg-slate-50 transition cursor-pointer"
                  : "flex-1 px-4 py-4 border-2 border-gray-100 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 transition"
              }
            >
              {isSplit ? "Volver al calendario" : "Cancelar"}
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                loading ||
                isPastReservation ||
                (!title && conflicts.length === 0) ||
                (isAuditoriumMaintenanceActive &&
                  !["admin", "superadmin"].includes(
                    ((user?.role as string) || "").toLowerCase(),
                  ))
              }
              className={`flex-1 px-4 py-4 rounded-2xl font-bold text-white shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2 ${
                isSubmitting ||
                loading ||
                isPastReservation ||
                (!title && conflicts.length === 0) ||
                (isAuditoriumMaintenanceActive &&
                  !["admin", "superadmin"].includes(
                    ((user?.role as string) || "").toLowerCase(),
                  ))
                  ? "bg-gray-300 cursor-not-allowed shadow-none"
                  : "bg-sena-green hover:bg-green-700 shadow-green-900/20 shadow-lg hover:scale-[1.02] cursor-pointer"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Procesando...
                </>
              ) : reservationToEdit ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Guardar Cambios
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirmar Reserva
                </>
              )}
            </button>
          </div>
        )}

        <ConfirmationDialog
          isOpen={showOverrideConfirm}
          onClose={() => setShowOverrideConfirm(false)}
          onConfirm={() => handleSubmit(undefined, true)}
          title="Confirmar Sobrescritura VIP"
          message={`Existen ${conflicts.length} reservas en este horario (${conflicts.map((c) => c.users?.full_name).join(", ")}). Al ser usuario VIP, puedes tomar este horario. Se cancelarán las reservas anteriores. ¿Deseas continuar?`}
          confirmText="Confirmar y Sobrescribir"
          variant="warning"
          isLoading={isSubmitting}
        />

        {summaryData && (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
              {/* Cabecera del Resumen con fondo garantizado y colores institucionales SENA */}
              <div
                className="p-8 text-white text-center relative"
                style={{
                  backgroundColor:
                    summaryData.status === "PENDING" ? "#043263" : "#2d8500",
                  backgroundImage:
                    summaryData.status === "PENDING"
                      ? "linear-gradient(135deg, #043263 0%, #0a4d94 100%)"
                      : "linear-gradient(135deg, #236900 0%, #39a900 100%)",
                }}
              >
                <div
                  className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-3.5 shadow-inner"
                  style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
                >
                  {summaryData.status === "PENDING" ? (
                    <Clock className="w-10 h-10 text-white animate-pulse" />
                  ) : (
                    <CheckCircle className="w-10 h-10 text-white" />
                  )}
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white drop-shadow-sm">
                  {summaryData.status === "PENDING"
                    ? "¡Solicitud Registrada!"
                    : "¡Reserva Confirmada!"}
                </h3>
                <div className="mt-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs px-3.5 py-1 rounded-full font-bold uppercase tracking-wider text-white border border-white/30"
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
                  >
                    {summaryData.status === "PENDING" ? (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-200" />
                        <span className="text-amber-100 font-bold">
                          Pendiente de Autorización
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-200" />
                        <span className="text-white font-bold">
                          Confirmada con Éxito
                        </span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Cuerpo del Resumen de Alto Contraste */}
              <div className="p-8 space-y-6 bg-white">
                <div className="space-y-4 text-left">
                  <div>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
                      Evento / Actividad
                    </span>
                    <span className="text-xl font-black text-slate-900 leading-tight block mt-1">
                      {summaryData.title}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-4">
                    <div>
                      <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
                        Espacio
                      </span>
                      <span className="text-sm font-bold text-[#043263] block mt-1 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#39a900]"></span>
                        {summaryData.spaceName}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
                        Horario
                      </span>
                      <span className="text-sm font-bold text-slate-900 block mt-1">
                        {summaryData.timeRange}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200/80 pt-4">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
                      Fecha(s)
                    </span>
                    <span className="text-sm font-bold text-slate-900 block mt-1">
                      {summaryData.dates}
                    </span>
                  </div>
                </div>

                {/* Botón de Cierre Manual & Cuenta Regresiva */}
                <div className="pt-4 border-t border-slate-200/80 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => onSuccess()}
                    style={{ backgroundColor: "#39a900" }}
                    className="w-full py-3.5 hover:bg-[#2d8500] text-white rounded-2xl font-bold text-sm shadow-lg shadow-green-900/15 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] cursor-pointer"
                  >
                    Cerrar Ventana
                  </button>
                  <p className="text-center text-xs text-slate-500 font-semibold tracking-wide">
                    Cerrando automáticamente en{" "}
                    <span className="text-[#fc7323] font-black">
                      {countdown}s
                    </span>
                    ...
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
