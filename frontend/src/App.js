import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "./components/ui/sonner";

// Public Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegistrationPage from "./pages/RegistrationPage";
import PrenotaPage from "./pages/PrenotaPage";

// Admin
import AdminLayout, { AdminDashboardPage } from "./pages/admin/AdminLayout";
import AdminVeicoliPage from "./pages/admin/AdminVeicoliPage";
import AdminPrenotazioniPage, { AdminPrenotazioneDetailPage } from "./pages/admin/AdminPrenotazioniPage";
import AdminClientiPage from "./pages/admin/AdminClientiPage";
import AdminImpostazioniPage from "./pages/admin/AdminImpostazioniPage";
import CalendarioPrenotazioniPage from "./pages/admin/CalendarioPrenotazioniPage";
import LegendaPrenotazioniPage from "./pages/admin/LegendaPrenotazioniPage";
import ContrattoStampaPage from "./pages/admin/ContrattoStampaPage";
import StoricoNoleggiPage from "./pages/admin/StoricoNoleggiPage";

// Client
import ClientLayout, { 
  ClientDashboardPage, 
  ClientPrenotazioniPage, 
  ClientContrattiPage,
  ClientProfiloPage 
} from "./pages/client/ClientLayout";
import ClientContrattoPage from "./pages/client/ClientContrattoPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registrazione" element={<RegistrationPage />} />
          <Route path="/prenota/:vehicleId" element={<PrenotaPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="veicoli" element={<AdminVeicoliPage />} />
            <Route path="prenotazioni" element={<AdminPrenotazioniPage />} />
            <Route path="prenotazioni/:id" element={<AdminPrenotazioneDetailPage />} />
            <Route path="calendario" element={<CalendarioPrenotazioniPage />} />
            <Route path="legenda-prenotazioni" element={<LegendaPrenotazioniPage />} />
            <Route path="contratti" element={<AdminPrenotazioniPage />} />
            <Route path="clienti" element={<AdminClientiPage />} />
            <Route path="clienti/:clienteId/storico" element={<StoricoNoleggiPage />} />
            <Route path="impostazioni" element={<AdminImpostazioniPage />} />
          </Route>
          
          {/* Contratto Stampa (outside layout for full page print) */}
          <Route path="/admin/contratto/:id" element={<ContrattoStampaPage />} />
          <Route path="/contratto/:id" element={<ClientContrattoPage />} />
          
          {/* Client Routes */}
          <Route path="/area-cliente" element={<ClientLayout />}>
            <Route index element={<ClientDashboardPage />} />
            <Route path="prenotazioni" element={<ClientPrenotazioniPage />} />
            <Route path="contratti" element={<ClientContrattiPage />} />
            <Route path="profilo" element={<ClientProfiloPage />} />
          </Route>
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" richColors closeButton />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
