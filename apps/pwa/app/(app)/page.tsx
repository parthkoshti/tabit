import { useEffect } from "react";
import { useNavigate } from "@/lib/navigation";

export function AppPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/tabs", { replace: true });
  }, [navigate]);

  return null;
}
