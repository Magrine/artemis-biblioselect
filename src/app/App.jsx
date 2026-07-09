import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./routes/Home.jsx";
import Filtering from "./routes/Filtering.jsx";
import Results from "./routes/Results.jsx";
import Faq from "./routes/Faq.jsx";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/filtering" element={<Filtering />} />
      <Route path="/results" element={<Results />} />
      <Route path="/contact" element={<Results />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
