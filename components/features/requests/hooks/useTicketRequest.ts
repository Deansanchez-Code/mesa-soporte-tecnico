import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { User, Asset, Outage } from "../types";

interface UseTicketRequestProps {
  user: User;
  initialLocation?: string;
  onSuccess?: () => void;
}

export function useTicketRequest({
  user,
  initialLocation,
  onSuccess,
}: UseTicketRequestProps) {
  // Data State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locationAssets, setLocationAssets] = useState<Asset[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<
    Record<string, string[]>
  >({});

  // Form State
  const [category, setCategory] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [manualSerial, setManualSerial] = useState("");
  const [location, setLocation] = useState(initialLocation || user.area || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI State
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Asset[]>([]);
  const [isValidSerial, setIsValidSerial] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocationLocked, setIsLocationLocked] = useState(false);
  const [activeOutage, setActiveOutage] = useState<Outage | null>(null);

  // 1. Fetch Initial Data (Assets, Areas, Categories)
  useEffect(() => {
    async function fetchData() {
      // My Assets
      const { data: assetsData } = await supabase
        .from("assets")
        .select("*")
        .eq("assigned_to_user_id", user.id);
      if (assetsData) setAssets(assetsData);

      // Areas
      const { data: areasData } = await supabase
        .from("areas")
        .select("name")
        .order("name");
      if (areasData) setAreas(areasData.map((a) => a.name));

      // Categories
      const { data: catData } = await supabase
        .from("ticket_categories_config")
        .select("id, user_selection_text")
        .eq("is_active", true)
        .order("user_selection_text");

      if (catData && catData.length > 0) {
        const groups: Record<string, string[]> = {};
        catData.forEach((item) => {
          const parts = item.user_selection_text.split(": ");
          const group = parts.length > 1 ? parts[0] : "General";
          if (!groups[group]) groups[group] = [];
          groups[group].push(item.user_selection_text);
        });
        setCategoryGroups(groups);
      } else {
        setCategoryGroups({ General: ["HARDWARE", "SOFTWARE"] });
      }
    }
    fetchData();
  }, [user.id]);

  // 2. Fetch Location Assets (Debounced)
  useEffect(() => {
    const fetchLocationAssets = async () => {
      if (!location || location.length < 3) {
        setLocationAssets([]);
        return;
      }
      const { data } = await supabase
        .from("assets")
        .select("*")
        .ilike("location", location);

      if (data) {
        const myAssetIds = new Set(assets.map((a) => a.id));
        const newAssets = data.filter((a) => !myAssetIds.has(a.id));
        setLocationAssets(newAssets);
      }
    };
    const timeout = setTimeout(fetchLocationAssets, 600);
    return () => clearTimeout(timeout);
  }, [location, assets]);

  // 3. Serial Search Logic
  useEffect(() => {
    const searchSerial = async () => {
      if (!manualSerial) {
        setSuggestions([]);
        setIsValidSerial(false);
        setShowSuggestions(false);
        return;
      }
      if (isValidSerial) return;

      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/assets/search?q=${encodeURIComponent(manualSerial)}`
        );
        const { data } = await response.json();

        if (data) {
          setSuggestions(data);
          setShowSuggestions(true);
          const exactMatch = data.find(
            (a: Asset) =>
              a.serial_number.toLowerCase() === manualSerial.toLowerCase()
          );
          if (exactMatch) setIsValidSerial(true);
        }
      } catch (error) {
        console.error("Error searching serial:", error);
      } finally {
        setIsSearching(false);
      }
    };
    const timeout = setTimeout(searchSerial, 300);
    return () => clearTimeout(timeout);
  }, [manualSerial, isValidSerial]);

  // 4. Location Locking Logic
  useEffect(() => {
    let currentAsset: Asset | undefined;
    if (selectedAsset) {
      currentAsset =
        assets.find((a) => a.serial_number === selectedAsset) ||
        locationAssets.find((a) => a.serial_number === selectedAsset) ||
        suggestions.find((a) => a.serial_number === selectedAsset);
    } else if (isValidSerial && manualSerial) {
      currentAsset = suggestions.find((a) => a.serial_number === manualSerial);
    }

    if (currentAsset) {
      const type = currentAsset.type || "";
      const normalizedType = type
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();

      if (
        normalizedType.includes("PORTATIL") ||
        normalizedType.includes("LAPTOP") ||
        normalizedType.includes("TABLET") ||
        normalizedType.includes("MOVIL")
      ) {
        setIsLocationLocked(false);
      } else if (currentAsset.location) {
        setLocation(currentAsset.location);
        setIsLocationLocked(true);
      } else {
        setIsLocationLocked(false);
      }
    } else {
      setIsLocationLocked(false);
    }
  }, [
    selectedAsset,
    isValidSerial,
    manualSerial,
    assets,
    locationAssets,
    suggestions,
  ]);

  // 5. Outage Check
  useEffect(() => {
    async function checkOutages() {
      if (!location) return;
      const { data } = await supabase
        .from("mass_outages")
        .select("*")
        .eq("is_active", true)
        .eq("location_scope", location)
        .maybeSingle();

      if (data) setActiveOutage(data);
      else setActiveOutage(null);
    }
    const timer = setTimeout(checkOutages, 500);
    return () => clearTimeout(timer);
  }, [location]);

  // 6. Submit Handler
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !location) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("tickets").insert({
        user_id: user.id,
        category: category,
        asset_serial: selectedAsset || manualSerial || null,
        location: location,
        status: "PENDIENTE",
      });

      if (error) throw error;
      alert("✅ ¡Ticket creado exitosamente! Un técnico va en camino.");
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error creating ticket:", error);
      alert("❌ Error al crear el ticket. Intenta de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    // Data
    assets,
    locationAssets,
    areas,
    categoryGroups,
    activeOutage,

    // Form State
    category,
    setCategory,
    selectedAsset,
    setSelectedAsset,
    manualSerial,
    setManualSerial,
    location,
    setLocation,
    isSubmitting,
    isLocationLocked,

    // Search / Validation
    showSuggestions,
    setShowSuggestions,
    suggestions,
    isValidSerial,
    setIsValidSerial,
    isSearching,

    // Handlers
    handleSubmitTicket,
  };
}
