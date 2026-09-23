import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { Home } from "./Home";
import { MapApp } from "./MapApp";
import { AuthGate } from "./components/AuthGate";
import { JuiceLayer } from "./components/JuiceLayer";

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AuthGate>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/map/:mapId" element={<MapApp />} />
            <Route path="/map" element={<Navigate to="/map/amazon" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthGate>
      <JuiceLayer />
    </MotionConfig>
  );
}
