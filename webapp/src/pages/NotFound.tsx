import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { CuratedErrorPage } from "@/components/CuratedErrorPage";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.info("[route-not-found]", location.pathname);
  }, [location.pathname]);

  return (
    <CuratedErrorPage
      kind="not-found"
      diagnostics={{
        path: location.pathname,
      }}
    />
  );
};

export default NotFound;
