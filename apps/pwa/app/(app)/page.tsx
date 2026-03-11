import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function AppPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/tabs", { replace: true });
  }, [navigate]);

  return null;
}
