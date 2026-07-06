import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, api } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { 
  Car, LayoutDashboard, CalendarDays, FileText, User, LogOut, Menu, X, ChevronRight, Edit,
  Save, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Client Sidebar
export const ClientSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logout effettuato');
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/area-cliente' },
    { icon: CalendarDays, label: 'Prenotazioni', path: '/area-cliente/prenotazioni' },
    { icon: FileText, label: 'Contratti', path: '/area-cliente/contratti' },
    { icon: User, label: 'Profilo', path: '/area-cliente/profilo' },
  ];

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200
        transform transition-transform duration-300 lg:transform-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/soverato-rental-logo.png"
                alt="Soverato Rental"
                className="w-10 h-10 rounded-lg object-contain"
              />
              <span className="text-sm font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Soverato Rental
              </span>
            </Link>
            <button className="lg:hidden p-1 text-slate-400 hover:text-slate-600" onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <p className="text-sm font-medium text-slate-900">{user?.nome} {user?.cognome}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors
                    ${isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          
          <div className="p-3 border-t border-slate-200">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 font-medium text-sm transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>Esci</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

// Client Layout
export default function ClientLayout() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login');
    }
    if (!loading && isAdmin) {
      navigate('/admin');
    }
  }, [loading, isAuthenticated, isAdmin, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || isAdmin) return null;

  const getTitle = () => {
    const path = location.pathname;
    if (path === '/area-cliente') return 'Dashboard';
    if (path.includes('/prenotazioni')) return 'Le mie Prenotazioni';
    if (path.includes('/contratti')) return 'I miei Contratti';
    if (path.includes('/profilo')) return 'Profilo';
    return 'Area Cliente';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <ClientSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200 h-14">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <button className="lg:hidden p-2 text-slate-600 hover:text-slate-900" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {getTitle()}
              </h1>
            </div>
            <Link to="/">
              <Button variant="outline" size="sm">Vai al Sito</Button>
            </Link>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Client Dashboard Page
export function ClientDashboardPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.get('/prenotazioni', token);
        setPrenotazioni(data.slice(0, 5));
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const statusLabels = {
    bozza: 'Bozza',
    in_verifica: 'In Verifica',
    approvata: 'Approvata',
    contratto_generato: 'Contratto Pronto',
    consegnato: 'In Corso',
    chiuso: 'Chiuso'
  };

  return (
    <div className="space-y-6" data-testid="client-dashboard">
      <Card className="border-slate-200 bg-gradient-to-r from-blue-600 to-blue-500">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Ciao, {user?.nome}!
          </h2>
          <p className="text-blue-100 mb-4">Pronto per il tuo prossimo viaggio?</p>
          <Button onClick={() => navigate('/')} className="bg-white text-blue-600 hover:bg-blue-50">
            Sfoglia i Veicoli
          </Button>
        </CardContent>
      </Card>
      
      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Le tue Prenotazioni
          </CardTitle>
          <Link to="/area-cliente/prenotazioni">
            <Button variant="ghost" size="sm">Vedi tutte <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : prenotazioni.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CalendarDays className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>Nessuna prenotazione ancora</p>
              <Button variant="link" className="text-blue-600 mt-2" onClick={() => navigate('/')}>
                Prenota ora
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {prenotazioni.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{p.veicolo_marca} {p.veicolo_modello}</p>
                    <p className="text-sm text-slate-500">{p.data_ritiro} → {p.data_riconsegna}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                    {statusLabels[p.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Client Prenotazioni Page
export function ClientPrenotazioniPage() {
  const { token } = useAuth();
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPrenotazione, setEditingPrenotazione] = useState(null);
  const [veicoli, setVeicoli] = useState([]);
  const [veicoliDisponibili, setVeicoliDisponibili] = useState([]);
  const [loadingVeicoli, setLoadingVeicoli] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const data = await api.get('/prenotazioni', token);
      setPrenotazioni(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const statusLabels = {
    bozza: { label: 'Bozza', color: 'bg-slate-100 text-slate-700' },
    in_verifica: { label: 'In Verifica', color: 'bg-yellow-100 text-yellow-700' },
    approvata: { label: 'Approvata', color: 'bg-blue-100 text-blue-700' },
    contratto_generato: { label: 'Contratto Pronto', color: 'bg-purple-100 text-purple-700' },
    consegnato: { label: 'In Corso', color: 'bg-green-100 text-green-700' },
    chiuso: { label: 'Chiuso', color: 'bg-slate-200 text-slate-600' },
    annullata: { label: 'Annullata', color: 'bg-red-100 text-red-700' }
  };

  // Formatta data in italiano
  const formatDateIT = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Controlla se la prenotazione è futura e modificabile
  const isFutureAndEditable = (p) => {
    const today = new Date().toISOString().split('T')[0];
    return p.data_ritiro >= today && !['consegnato', 'chiuso', 'annullata'].includes(p.status);
  };

  // Apri modifica prenotazione
  const handleOpenEdit = async (prenotazione) => {
    setEditingPrenotazione({...prenotazione});
    setLoadingVeicoli(true);
    
    try {
      // Carica tutti i veicoli
      const allVeicoli = await api.get('/vehicles', token);
      setVeicoli(allVeicoli);
      
      // Carica veicoli disponibili per le date selezionate
      await fetchVeicoliDisponibili(prenotazione.data_ritiro, prenotazione.data_riconsegna, prenotazione.id, allVeicoli);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      toast.error('Errore nel caricamento veicoli');
    } finally {
      setLoadingVeicoli(false);
    }
  };

  // Fetch veicoli disponibili quando cambiano le date
  const fetchVeicoliDisponibili = async (dataRitiro, dataRiconsegna, excludeBookingId, allVeicoli = veicoli) => {
    if (!dataRitiro || !dataRiconsegna) {
      setVeicoliDisponibili(allVeicoli || []);
      return;
    }
    
    try {
      const disponibili = await api.get(
        `/vehicles/disponibili?data_inizio=${dataRitiro}&data_fine=${dataRiconsegna}&exclude_booking_id=${excludeBookingId || ''}`,
        token
      );
      setVeicoliDisponibili(disponibili || []);
    } catch (error) {
      console.error('Error fetching available vehicles:', error);
      // Fallback: usa tutti i veicoli se l'endpoint non esiste
      setVeicoliDisponibili(allVeicoli || []);
    }
  };

  // Quando cambiano le date, ricarica veicoli disponibili
  const handleDateChange = async (field, value) => {
    const updated = {...editingPrenotazione, [field]: value};
    setEditingPrenotazione(updated);
    
    if (updated.data_ritiro && updated.data_riconsegna) {
      setLoadingVeicoli(true);
      await fetchVeicoliDisponibili(updated.data_ritiro, updated.data_riconsegna, updated.id);
      setLoadingVeicoli(false);
    }
  };

  // Salva modifiche
  const handleSaveEdit = async () => {
    if (!editingPrenotazione) return;
    
    setSaving(true);
    try {
      await api.put(`/prenotazioni/${editingPrenotazione.id}/cliente-update`, {
        data_ritiro: editingPrenotazione.data_ritiro,
        data_riconsegna: editingPrenotazione.data_riconsegna,
        ora_ritiro: editingPrenotazione.ora_ritiro,
        ora_riconsegna: editingPrenotazione.ora_riconsegna,
        luogo_ritiro: editingPrenotazione.luogo_ritiro,
        luogo_riconsegna: editingPrenotazione.luogo_riconsegna,
        veicolo_id: editingPrenotazione.veicolo_id,
        note_cliente: editingPrenotazione.note_cliente
      }, token);
      
      toast.success('Prenotazione modificata con successo!');
      setEditingPrenotazione(null);
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Errore nella modifica');
    } finally {
      setSaving(false);
    }
  };

  // Annulla prenotazione
  const handleCancelBooking = async (prenotazioneId) => {
    if (!window.confirm('Sei sicuro di voler annullare questa prenotazione?')) return;
    
    try {
      await api.put(`/prenotazioni/${prenotazioneId}/cliente-annulla`, {}, token);
      toast.success('Prenotazione annullata');
      fetchData();
    } catch (error) {
      toast.error('Errore nell\'annullamento');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
        Le mie Prenotazioni
      </h2>
      
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : prenotazioni.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="py-12 text-center text-slate-500">
            <CalendarDays className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p>Nessuna prenotazione</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {prenotazioni.map((p) => (
            <Card key={p.id} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">{p.veicolo_marca} {p.veicolo_modello}</h3>
                    <p className="text-sm text-slate-500">Targa: {p.veicolo_targa}</p>
                    <p className="text-sm text-slate-500">
                      {formatDateIT(p.data_ritiro)} {p.ora_ritiro} → {formatDateIT(p.data_riconsegna)} {p.ora_riconsegna}
                    </p>
                    <p className="text-sm font-medium mt-1">Totale: €{p.tariffa_base?.toFixed(2)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusLabels[p.status]?.color}`}>
                      {statusLabels[p.status]?.label}
                    </span>
                    <div className="flex gap-2">
                      {isFutureAndEditable(p) && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleOpenEdit(p)}
                            className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            <Edit className="w-4 h-4 mr-1" /> Modifica
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleCancelBooking(p.id)}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            Annulla
                          </Button>
                        </>
                      )}
                      {p.contratto_generato && (
                        <Link to={`/area-cliente/contratti`}>
                          <Button variant="outline" size="sm">Vedi Contratto</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Modifica Prenotazione */}
      {editingPrenotazione && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">Modifica Prenotazione</h3>
              <button onClick={() => setEditingPrenotazione(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Veicolo */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Veicolo</label>
                {loadingVeicoli ? (
                  <div className="h-10 bg-slate-100 animate-pulse rounded"></div>
                ) : (
                  <select 
                    className="w-full h-10 px-3 border rounded-md"
                    value={editingPrenotazione?.veicolo_id || ''}
                    onChange={(e) => {
                      if (editingPrenotazione) {
                        setEditingPrenotazione({...editingPrenotazione, veicolo_id: e.target.value});
                      }
                    }}
                  >
                    <option value="">Seleziona veicolo</option>
                    {(veicoliDisponibili || []).map(v => (
                      <option key={v.id} value={v.id}>
                        {v.marca || ''} {v.modello || ''} ({v.targa || ''}) - €{(v.tariffa_giornaliera || v.base_price || 0).toFixed(0)}/giorno
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-slate-500">
                  Solo veicoli disponibili per il periodo selezionato
                </p>
              </div>

              {/* Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Ritiro</label>
                  <input 
                    type="date"
                    className="w-full h-10 px-3 border rounded-md"
                    value={editingPrenotazione.data_ritiro || ''}
                    onChange={(e) => handleDateChange('data_ritiro', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ora Ritiro</label>
                  <input 
                    type="time"
                    className="w-full h-10 px-3 border rounded-md"
                    value={editingPrenotazione.ora_ritiro || ''}
                    onChange={(e) => setEditingPrenotazione({...editingPrenotazione, ora_ritiro: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Riconsegna</label>
                  <input 
                    type="date"
                    className="w-full h-10 px-3 border rounded-md"
                    value={editingPrenotazione.data_riconsegna || ''}
                    onChange={(e) => handleDateChange('data_riconsegna', e.target.value)}
                    min={editingPrenotazione.data_ritiro || new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ora Riconsegna</label>
                  <input 
                    type="time"
                    className="w-full h-10 px-3 border rounded-md"
                    value={editingPrenotazione.ora_riconsegna || ''}
                    onChange={(e) => setEditingPrenotazione({...editingPrenotazione, ora_riconsegna: e.target.value})}
                  />
                </div>
              </div>

              {/* Luoghi */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Luogo Ritiro</label>
                  <input 
                    type="text"
                    className="w-full h-10 px-3 border rounded-md"
                    value={editingPrenotazione.luogo_ritiro || ''}
                    onChange={(e) => setEditingPrenotazione({...editingPrenotazione, luogo_ritiro: e.target.value})}
                    placeholder="Es: Aeroporto Lamezia"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Luogo Riconsegna</label>
                  <input 
                    type="text"
                    className="w-full h-10 px-3 border rounded-md"
                    value={editingPrenotazione.luogo_riconsegna || ''}
                    onChange={(e) => setEditingPrenotazione({...editingPrenotazione, luogo_riconsegna: e.target.value})}
                    placeholder="Es: Sede Soverato"
                  />
                </div>
              </div>

              {/* Note */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Note</label>
                <textarea 
                  className="w-full px-3 py-2 border rounded-md"
                  rows={3}
                  value={editingPrenotazione.note_cliente || ''}
                  onChange={(e) => setEditingPrenotazione({...editingPrenotazione, note_cliente: e.target.value})}
                  placeholder="Richieste particolari..."
                />
              </div>
            </div>

            <div className="p-4 border-t flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setEditingPrenotazione(null)}
                className="flex-1"
              >
                Annulla
              </Button>
              <Button 
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {saving ? 'Salvataggio...' : 'Salva Modifiche'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Client Contratti Page
export function ClientContrattiPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.get('/prenotazioni', token);
        setPrenotazioni(data.filter(p => p.contratto_generato));
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const handleViewContract = (prenotazioneId) => {
    // Redirect to contract view page
    navigate(`/contratto/${prenotazioneId}`);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
        I miei Contratti
      </h2>
      
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : prenotazioni.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="py-12 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p>Nessun contratto disponibile</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {prenotazioni.map((p) => (
            <Card key={p.id} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">Contratto #{p.contratto_id?.slice(0, 8) || p.id.slice(0, 8)}</h3>
                    <p className="text-sm text-slate-500">{p.veicolo_marca} {p.veicolo_modello} • {p.veicolo_targa}</p>
                    <p className="text-sm text-slate-500">{p.data_ritiro} → {p.data_riconsegna}</p>
                  </div>
                  <Button onClick={() => handleViewContract(p.id)} className="bg-blue-600 hover:bg-blue-700">
                    <FileText className="w-4 h-4 mr-2" /> Visualizza Contratto
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Client Profile Page
export function ClientProfiloPage() {
  const { user, token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        setProfile(res.data);
      } catch (e) {
        console.error('Error loading profile');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchProfile();
  }, [token]);

  const updateField = (field, value) => setProfile(prev => ({ ...prev, [field]: value }));
  const updatePatenteField = (field, value) => setProfile(prev => ({ ...prev, patente: { ...(prev.patente || {}), [field]: value } }));
  const updateCartaField = (field, value) => setProfile(prev => ({ ...prev, carta_credito: { ...(prev.carta_credito || {}), [field]: value } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        nome: profile.nome, cognome: profile.cognome, data_nascita: profile.data_nascita,
        luogo_nascita: profile.luogo_nascita, codice_fiscale: profile.codice_fiscale,
        indirizzo: profile.indirizzo, comune: profile.comune, provincia: profile.provincia,
        cap: profile.cap, stato: profile.stato, cellulare: profile.cellulare,
        patente: profile.patente, carta_credito: profile.carta_credito
      };
      const res = await axios.put(`${API}/auth/profile`, payload, { headers: { Authorization: `Bearer ${token}` } });
      setProfile(res.data);
      toast.success('Profilo salvato con successo!');
    } catch (e) {
      toast.error('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return <div className="flex items-center justify-center min-h-[300px]"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const pat = profile.patente || {};
  const carta = profile.carta_credito || {};
  const PROVINCES = ['AG','AL','AN','AO','AR','AP','AT','AV','BA','BT','BL','BN','BG','BI','BO','BZ','BS','BR','CA','CL','CB','CI','CE','CT','CZ','CH','CO','CS','CR','KR','CN','EN','FM','FE','FI','FG','FC','FR','GE','GO','GR','IM','IS','SP','AQ','LT','LE','LC','LI','LO','LU','MC','MN','MS','MT','ME','MI','MO','MB','NA','NO','NU','OG','OT','OR','PD','PA','PR','PV','PG','PU','PE','PC','PI','PT','PN','PZ','PO','RG','RA','RC','RE','RI','RN','RM','RO','SA','VS','SS','SV','SI','SR','SO','TA','TE','TR','TO','TP','TN','TV','TS','UD','VA','VE','VB','VC','VR','VV','VI','VT'];
  const LICENSE_CATS = ['AM','A1','A2','A','B','B1','BE','C','C1','CE','D','D1','DE'];

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Il mio Profilo</h2>
        <p className="text-sm text-slate-500">Modifica le tue informazioni e clicca Salva</p>
      </div>

      {/* Dati Anagrafici */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-blue-600" /> Dati Anagrafici</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Nome</Label><Input data-testid="profile-nome" value={profile.nome || ''} onChange={e => updateField('nome', e.target.value)} /></div>
            <div className="space-y-1"><Label>Cognome</Label><Input data-testid="profile-cognome" value={profile.cognome || ''} onChange={e => updateField('cognome', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Data Nascita</Label><Input type="date" value={profile.data_nascita || ''} onChange={e => updateField('data_nascita', e.target.value)} /></div>
            <div className="space-y-1"><Label>Luogo Nascita</Label><Input value={profile.luogo_nascita || ''} onChange={e => updateField('luogo_nascita', e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Codice Fiscale</Label><Input value={profile.codice_fiscale || ''} onChange={e => updateField('codice_fiscale', e.target.value.toUpperCase())} maxLength={16} /></div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={profile.email || ''} disabled className="bg-slate-50" />
            <p className="text-xs text-slate-400">L'email non puo' essere modificata</p>
          </div>
          <div className="space-y-1"><Label>Cellulare</Label><Input value={profile.cellulare || ''} onChange={e => updateField('cellulare', e.target.value)} placeholder="+39 333 1234567" /></div>
          <div className="space-y-1"><Label>Indirizzo</Label><Input value={profile.indirizzo || ''} onChange={e => updateField('indirizzo', e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Comune</Label><Input value={profile.comune || ''} onChange={e => updateField('comune', e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Provincia</Label>
              <Select value={profile.provincia || ''} onValueChange={v => updateField('provincia', v)}>
                <SelectTrigger><SelectValue placeholder="Prov." /></SelectTrigger>
                <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>CAP</Label><Input value={profile.cap || ''} onChange={e => updateField('cap', e.target.value)} maxLength={5} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Patente */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" /> Patente di Guida</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Numero Patente</Label><Input value={pat.numero || ''} onChange={e => updatePatenteField('numero', e.target.value.toUpperCase())} /></div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={pat.categoria || ''} onValueChange={v => updatePatenteField('categoria', v)}>
                <SelectTrigger><SelectValue placeholder="Cat." /></SelectTrigger>
                <SelectContent>{LICENSE_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Rilasciata da</Label><Input value={pat.rilasciata_da || ''} onChange={e => updatePatenteField('rilasciata_da', e.target.value)} placeholder="Es: MCTC Roma" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Data Rilascio</Label><Input type="date" value={pat.data_rilascio || ''} onChange={e => updatePatenteField('data_rilascio', e.target.value)} /></div>
            <div className="space-y-1"><Label>Data Scadenza</Label><Input type="date" value={pat.data_scadenza || ''} onChange={e => updatePatenteField('data_scadenza', e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Carta di Credito */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-600" /> Carta di Credito <span className="text-xs font-normal text-slate-400">(Opzionale)</span></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Circuito</Label>
              <Select value={carta.circuito || 'none'} onValueChange={v => updateCartaField('circuito', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuno</SelectItem>
                  <SelectItem value="Visa">Visa</SelectItem>
                  <SelectItem value="Mastercard">Mastercard</SelectItem>
                  <SelectItem value="American Express">American Express</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Intestatario</Label><Input value={carta.intestatario || ''} onChange={e => updateCartaField('intestatario', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Ultime 4 cifre</Label><Input value={carta.numero || ''} onChange={e => updateCartaField('numero', e.target.value.replace(/\D/g,'').slice(0,4))} maxLength={4} /></div>
            <div className="space-y-1"><Label>Mese</Label><Input value={carta.scadenza_mese || ''} onChange={e => updateCartaField('scadenza_mese', e.target.value)} maxLength={2} placeholder="MM" /></div>
            <div className="space-y-1"><Label>Anno</Label><Input value={carta.scadenza_anno || ''} onChange={e => updateCartaField('scadenza_anno', e.target.value)} maxLength={2} placeholder="AA" /></div>
          </div>
        </CardContent>
      </Card>

      {/* Salva */}
      <Button onClick={handleSave} disabled={saving} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-base font-semibold" data-testid="save-profile-btn">
        {saving ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Salvataggio...</span> : <><Save className="w-4 h-4 mr-2" />Salva Modifiche</>}
      </Button>
    </div>
  );
}
