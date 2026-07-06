import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth, api } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { 
  CalendarDays, Search, Eye, FileText, ChevronLeft, Download, Printer, CheckCircle,
  User, Car, MapPin, Clock, CreditCard, AlertCircle, Plus, Trash2, Save
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Funzione per formattare le date in formato italiano (gg/mm/aaaa)
const formatDateIT = (dateString) => {
  if (!dateString) return '';
  // Prende solo la parte della data (rimuove eventuale orario)
  const datePart = dateString.split(' ')[0].split('T')[0];
  // Se è in formato ISO (yyyy-mm-dd)
  if (datePart.includes('-')) {
    const parts = datePart.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return dateString;
};

const statusLabels = {
  bozza: { label: 'Bozza', color: 'bg-slate-100 text-slate-700' },
  in_verifica: { label: 'In Verifica', color: 'bg-yellow-100 text-yellow-700' },
  approvata: { label: 'Approvata', color: 'bg-blue-100 text-blue-700' },
  contratto_generato: { label: 'Contratto Generato', color: 'bg-purple-100 text-purple-700' },
  consegnato: { label: 'Consegnato', color: 'bg-green-100 text-green-700' },
  chiuso: { label: 'Chiuso', color: 'bg-slate-200 text-slate-600' },
  annullata: { label: 'Annullata', color: 'bg-red-100 text-red-700' }
};

// Bookings List
export default function AdminPrenotazioniPage() {
  const { token } = useAuth();
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchData = async () => {
    try {
      const data = await api.get('/prenotazioni', token);
      setPrenotazioni(data);
    } catch (error) {
      toast.error('Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token]);

  const filtered = prenotazioni.filter(p => {
    const matchesSearch = `${p.cliente_nome} ${p.veicolo_marca} ${p.veicolo_modello} ${p.veicolo_targa}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6" data-testid="prenotazioni-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Gestione Prenotazioni
          </h2>
          <p className="text-sm text-slate-500">Visualizza e gestisci tutte le prenotazioni</p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Cerca per cliente, veicolo o targa..." 
                className="pl-10" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="search-prenotazioni"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Stato" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CalendarDays className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>Nessuna prenotazione trovata</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Veicolo</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Totale</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="font-medium">{p.cliente_nome}</p>
                        <p className="text-xs text-slate-500">{p.cliente_email}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{p.veicolo_marca} {p.veicolo_modello}</p>
                        <p className="text-xs text-slate-500">{p.veicolo_targa}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{formatDateIT(p.data_ritiro)} {p.ora_ritiro}</p>
                        <p className="text-xs text-slate-500">→ {formatDateIT(p.data_riconsegna)} {p.ora_riconsegna}</p>
                      </TableCell>
                      <TableCell className="font-semibold">€{p.tariffa_base?.toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[p.status]?.color}`}>
                          {statusLabels[p.status]?.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {p.contratto_generato && (
                          <Link to={`/admin/contratto/${p.id}`}>
                            <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700" title="Stampa Contratto">
                              <Printer className="w-4 h-4" />
                            </Button>
                          </Link>
                        )}
                        <Link to={`/admin/prenotazioni/${p.id}`}>
                          <Button variant="ghost" size="sm" data-testid={`view-${p.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Booking Detail Page
// Component to assign a client to a calendar block
function ClienteAssignSelect({ token, prenotazioneId, onAssigned }) {
  const [clienti, setClienti] = useState([]);
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchClienti = async () => {
      try {
        const data = await api.get('/clienti', token);
        setClienti(data || []);
      } catch (e) { console.error(e); }
    };
    fetchClienti();
  }, [token]);

  const handleAssign = async () => {
    if (!selectedClienteId) return;
    setSaving(true);
    try {
      const cliente = clienti.find(c => c.id === selectedClienteId);
      if (!cliente) return;
      
      await api.put(`/prenotazioni/${prenotazioneId}/admin-update`, {
        cliente_id: cliente.id,
        cliente_nome: `${cliente.nome} ${cliente.cognome}`,
        cliente_email: cliente.email,
        cliente_cellulare: cliente.cellulare || '',
        carta_circuito: cliente.carta_credito?.circuito || '',
        carta_intestatario: cliente.carta_credito?.intestatario || '',
        carta_numero: cliente.carta_credito?.numero || '',
        carta_scadenza_mese: cliente.carta_credito?.scadenza_mese || '',
        carta_scadenza_anno: cliente.carta_credito?.scadenza_anno || '',
        status: 'bozza'
      }, token);
      
      toast.success(`Cliente ${cliente.nome} ${cliente.cognome} assegnato!`);
      onAssigned();
    } catch (e) {
      toast.error('Errore nell\'assegnazione');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
          <SelectTrigger data-testid="assign-client-select">
            <SelectValue placeholder="Seleziona cliente..." />
          </SelectTrigger>
          <SelectContent>
            {clienti.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome} {c.cognome} - {c.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button 
        onClick={handleAssign} 
        disabled={!selectedClienteId || saving}
        className="bg-blue-600 hover:bg-blue-700"
        data-testid="assign-client-btn"
      >
        {saving ? 'Salvataggio...' : 'Assegna Cliente'}
      </Button>
    </div>
  );
}

export function AdminPrenotazioneDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [prenotazione, setPrenotazione] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [franchigie, setFranchigie] = useState([]);
  const [servizi, setServizi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Check-in dialog
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInData, setCheckInData] = useState({ km_uscita: '', tacche_carburante: '8', danni_preesistenti: [] });
  
  // Check-out dialog
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [checkOutData, setCheckOutData] = useState({
    data_ora_rientro: new Date().toISOString().slice(0, 16),
    km_entrata: '',
    tacche_carburante_entrata: '8',
    danni_veicolo: 0,
    costo_gestione_danni: 0,
    carburante_mancante: 0,
    pulizia_straordinaria: 0,
    altri_addebiti: 0,
    note_addebiti: ''
  });

  const fetchData = async () => {
    try {
      const [pren, vehs, franch, serv] = await Promise.all([
        api.get(`/prenotazioni/${id}`, token),
        api.get('/vehicles?status=disponibile', token),
        api.get('/franchigie', token),
        api.get('/servizi-supplementari', token)
      ]);
      setPrenotazione(pren);
      
      // Mark vehicles with availability for this booking's period
      if (pren.data_ritiro && pren.data_riconsegna) {
        try {
          const availableVehs = await api.get(`/vehicles/available-period?data_inizio=${pren.data_ritiro}&data_fine=${pren.data_riconsegna}`, token);
          const availableIds = new Set((availableVehs || []).map(v => v.id));
          availableIds.add(pren.veicolo_id); // Current vehicle is always selectable
          setVehicles((vehs || []).map(v => ({ ...v, disponibile_periodo: availableIds.has(v.id) })));
        } catch { setVehicles(vehs || []); }
      } else {
        setVehicles(vehs || []);
      }
      
      setFranchigie(franch);
      setServizi(serv);
      
      // Fetch client details (skip for calendar blocks)
      if (pren.cliente_id && pren.cliente_id !== 'BLOCCO_CALENDARIO') {
        try {
          const cli = await api.get(`/clienti/${pren.cliente_id}`, token);
          setCliente(cli);
        } catch (e) {
          console.log('Cliente non trovato');
        }
      } else {
        setCliente({
          nome: 'BLOCCO',
          cognome: 'CALENDARIO',
          email: '',
          cellulare: ''
        });
      }
    } catch (error) {
      toast.error('Errore nel caricamento');
      navigate('/admin/prenotazioni');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id, token]);

  const handleStatusChange = async (newStatus) => {
    try {
      await api.patch(`/prenotazioni/${id}/status?status=${newStatus}`, {}, token);
      toast.success('Stato aggiornato');
      fetchData();
    } catch (error) {
      toast.error('Errore nell\'aggiornamento');
    }
  };

  const handleGenerateContract = async () => {
    try {
      await api.post(`/prenotazioni/${id}/genera-contratto`, {}, token);
      toast.success('Contratto generato');
      fetchData();
    } catch (error) {
      toast.error('Errore nella generazione del contratto');
    }
  };

  const handleDownloadPDF = () => {
    // Navigate to contract page for PDF download - uses same HTML rendering
    navigate(`/admin/contratto/${id}`);
    toast.info('Usa il pulsante "Scarica PDF" nella pagina del contratto');
  };

  const handleCheckIn = async () => {
    if (!checkInData.km_uscita) {
      toast.error('Inserisci i km in uscita');
      return;
    }
    try {
      await api.post(`/prenotazioni/${id}/check-in`, {
        ...checkInData,
        km_uscita: parseInt(checkInData.km_uscita),
        tacche_carburante: parseInt(checkInData.tacche_carburante)
      }, token);
      toast.success('Check-in registrato');
      setCheckInOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Errore nel check-in');
    }
  };

  const handleCheckOut = async () => {
    if (!checkOutData.km_entrata) {
      toast.error('Inserisci i km in entrata');
      return;
    }
    try {
      await api.post(`/prenotazioni/${id}/check-out`, {
        ...checkOutData,
        km_entrata: parseInt(checkOutData.km_entrata),
        tacche_carburante_entrata: parseInt(checkOutData.tacche_carburante_entrata)
      }, token);
      toast.success('Check-out registrato');
      setCheckOutOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Errore nel check-out');
    }
  };

  const handleUpdateField = async (field, value) => {
    try {
      await api.put(`/prenotazioni/${id}/admin-update`, { [field]: value }, token);
      fetchData();
    } catch (error) {
      const detail = error?.response?.data?.detail || 'Errore nell\'aggiornamento';
      toast.error(detail);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!prenotazione) return null;

  return (
    <div className="space-y-6" data-testid="prenotazione-detail">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/admin/prenotazioni">
            <Button variant="ghost" size="sm"><ChevronLeft className="w-4 h-4 mr-1" /> Indietro</Button>
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Prenotazione #{id.slice(0, 8)}
            </h2>
            <p className="text-sm text-slate-500">{prenotazione.cliente_nome}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={prenotazione.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {prenotazione.status === 'approvata' && !prenotazione.contratto_generato && (
            <Button onClick={handleGenerateContract} className="bg-purple-600 hover:bg-purple-700">
              <FileText className="w-4 h-4 mr-2" /> Genera Contratto
            </Button>
          )}
          
          {prenotazione.contratto_generato && (
            <>
              <Link to={`/admin/contratto/${id}`}>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Printer className="w-4 h-4 mr-2" /> Stampa Contratto
                </Button>
              </Link>
              <Button onClick={handleDownloadPDF} variant="outline">
                <Download className="w-4 h-4 mr-2" /> Scarica PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cliente */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" /> Dati Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* If it's a block, show option to assign a client */}
              {(prenotazione.cliente_id === 'BLOCCO_CALENDARIO' || prenotazione.cliente_nome === 'BLOCCO CALENDARIO') && (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm font-medium text-orange-700 mb-2">Questo è un blocco calendario. Assegna un cliente per trasformarlo in prenotazione:</p>
                  <ClienteAssignSelect 
                    token={token} 
                    prenotazioneId={id}
                    onAssigned={() => fetchData()}
                  />
                </div>
              )}
              {cliente && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Nome</p>
                    <p className="font-medium">{cliente.nome} {cliente.cognome}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Codice Fiscale</p>
                    <p className="font-medium">{cliente.codice_fiscale}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Email</p>
                    <p className="font-medium">{cliente.email}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Telefono</p>
                    <p className="font-medium">{cliente.cellulare}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-500">Indirizzo</p>
                    <p className="font-medium">{cliente.indirizzo}, {cliente.cap} {cliente.comune} ({cliente.provincia})</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Patente</p>
                    <p className="font-medium">{cliente.patente?.numero} ({cliente.patente?.categoria})</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Scadenza Patente</p>
                    <p className="font-medium">{formatDateIT(cliente.patente?.data_scadenza)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Veicolo */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="w-4 h-4 text-blue-600" /> Veicolo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <Select 
                  value={prenotazione.veicolo_id} 
                  onValueChange={(v) => handleUpdateField('veicolo_id', v)}
                >
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue placeholder="Seleziona veicolo" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id} disabled={v.disponibile_periodo === false}>
                        {v.disponibile_periodo === false ? '❌ ' : '✅ '}{v.marca} {v.modello} - {v.targa}{v.disponibile_periodo === false ? ' (GIÀ PRENOTATO)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-sm">
                <div>
                  <p className="text-slate-500">Marca/Modello</p>
                  <p className="font-medium">{prenotazione.veicolo_marca} {prenotazione.veicolo_modello}</p>
                </div>
                <div>
                  <p className="text-slate-500">Targa</p>
                  <p className="font-medium">{prenotazione.veicolo_targa}</p>
                </div>
                <div>
                  <p className="text-slate-500">Colore</p>
                  <p className="font-medium">{prenotazione.veicolo_colore}</p>
                </div>
                <div>
                  <p className="text-slate-500">Cambio/Alim.</p>
                  <p className="font-medium">{prenotazione.veicolo_cambio} / {prenotazione.veicolo_alimentazione}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Periodo */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" /> Periodo e Chilometraggio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Ritiro</p>
                  <p className="font-medium">{formatDateIT(prenotazione.data_ritiro)} {prenotazione.ora_ritiro}</p>
                </div>
                <div>
                  <p className="text-slate-500">Riconsegna</p>
                  <p className="font-medium">{formatDateIT(prenotazione.data_riconsegna)} {prenotazione.ora_riconsegna}</p>
                </div>
                <div>
                  <p className="text-slate-500">Durata</p>
                  <p className="font-medium">{prenotazione.durata_giorni} giorni</p>
                </div>
                <div>
                  <p className="text-slate-500">Km Inclusi</p>
                  <p className="font-medium">{prenotazione.km_inclusi_totali} km</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div>
                  <p className="text-slate-500">Luogo Ritiro</p>
                  <p className="font-medium">{prenotazione.luogo_ritiro}</p>
                  <p className="text-xs text-slate-400">{prenotazione.indirizzo_ritiro}</p>
                </div>
                <div>
                  <p className="text-slate-500">Luogo Riconsegna</p>
                  <p className="font-medium">{prenotazione.luogo_riconsegna}</p>
                  <p className="text-xs text-slate-400">{prenotazione.indirizzo_riconsegna}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Check-in / Check-out */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" /> Check-in / Check-out
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {/* Check-in */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Check-in</h4>
                  {prenotazione.check_in ? (
                    <div className="text-sm space-y-1">
                      <p>Km uscita: <span className="font-medium">{prenotazione.check_in.km_uscita}</span></p>
                      <p>Carburante: <span className="font-medium">{prenotazione.check_in.tacche_carburante}/8</span></p>
                      <p>Data: <span className="font-medium">{prenotazione.check_in.data_ora_effettivo?.slice(0, 10)}</span></p>
                    </div>
                  ) : (
                    <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 mt-2">
                          Registra Check-in
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Registra Check-in</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label>Km in uscita *</Label>
                            <Input 
                              type="number" 
                              value={checkInData.km_uscita}
                              onChange={(e) => setCheckInData({...checkInData, km_uscita: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Tacche carburante (0-8)</Label>
                            <Select value={checkInData.tacche_carburante} onValueChange={(v) => setCheckInData({...checkInData, tacche_carburante: v})}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[0,1,2,3,4,5,6,7,8].map(n => <SelectItem key={n} value={String(n)}>{n}/8</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={handleCheckIn} className="w-full bg-green-600 hover:bg-green-700">
                            Conferma Check-in
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                
                {/* Check-out */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Check-out</h4>
                  {prenotazione.check_out ? (
                    <div className="text-sm space-y-1">
                      <p>Km entrata: <span className="font-medium">{prenotazione.check_out.km_entrata}</span></p>
                      <p>Km percorsi: <span className="font-medium">{prenotazione.check_out.km_percorsi}</span></p>
                      <p>Km eccedenza: <span className="font-medium">{prenotazione.check_out.km_eccedenza}</span></p>
                      <p>Carburante: <span className="font-medium">{prenotazione.check_out.tacche_carburante_entrata}/8</span></p>
                      <p>Totale addebiti: <span className="font-medium text-red-600">€{prenotazione.check_out.totale_addebiti?.toFixed(2)}</span></p>
                    </div>
                  ) : prenotazione.check_in ? (
                    <Dialog open={checkOutOpen} onOpenChange={setCheckOutOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-orange-600 hover:bg-orange-700 mt-2">
                          Registra Check-out
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Registra Check-out</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Data/ora rientro</Label>
                              <Input 
                                type="datetime-local" 
                                value={checkOutData.data_ora_rientro}
                                onChange={(e) => setCheckOutData({...checkOutData, data_ora_rientro: e.target.value})}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Km entrata *</Label>
                              <Input 
                                type="number" 
                                value={checkOutData.km_entrata}
                                onChange={(e) => setCheckOutData({...checkOutData, km_entrata: e.target.value})}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Tacche carburante</Label>
                            <Select value={checkOutData.tacche_carburante_entrata} onValueChange={(v) => setCheckOutData({...checkOutData, tacche_carburante_entrata: v})}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[0,1,2,3,4,5,6,7,8].map(n => <SelectItem key={n} value={String(n)}>{n}/8</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="border-t pt-4">
                            <h5 className="font-semibold mb-2">Addebiti al rientro</h5>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Danni veicolo (€)</Label>
                                <Input type="number" step="0.01" value={checkOutData.danni_veicolo} onChange={(e) => setCheckOutData({...checkOutData, danni_veicolo: parseFloat(e.target.value) || 0})} />
                              </div>
                              <div className="space-y-2">
                                <Label>Gestione danni (€)</Label>
                                <Input type="number" step="0.01" value={checkOutData.costo_gestione_danni} onChange={(e) => setCheckOutData({...checkOutData, costo_gestione_danni: parseFloat(e.target.value) || 0})} />
                              </div>
                              <div className="space-y-2">
                                <Label>Carburante mancante (€)</Label>
                                <Input type="number" step="0.01" value={checkOutData.carburante_mancante} onChange={(e) => setCheckOutData({...checkOutData, carburante_mancante: parseFloat(e.target.value) || 0})} />
                              </div>
                              <div className="space-y-2">
                                <Label>Pulizia straordinaria (€)</Label>
                                <Input type="number" step="0.01" value={checkOutData.pulizia_straordinaria} onChange={(e) => setCheckOutData({...checkOutData, pulizia_straordinaria: parseFloat(e.target.value) || 0})} />
                              </div>
                              <div className="space-y-2">
                                <Label>Altri addebiti (€)</Label>
                                <Input type="number" step="0.01" value={checkOutData.altri_addebiti} onChange={(e) => setCheckOutData({...checkOutData, altri_addebiti: parseFloat(e.target.value) || 0})} />
                              </div>
                            </div>
                            <div className="space-y-2 mt-4">
                              <Label>Note addebiti</Label>
                              <Textarea value={checkOutData.note_addebiti} onChange={(e) => setCheckOutData({...checkOutData, note_addebiti: e.target.value})} rows={2} />
                            </div>
                          </div>
                          <Button onClick={handleCheckOut} className="w-full bg-orange-600 hover:bg-orange-700">
                            Conferma Check-out
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <p className="text-sm text-slate-500">Effettua prima il check-in</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conducenti aggiuntivi */}
          {prenotazione.conducenti_aggiuntivi?.length > 0 && (
            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Conducenti Aggiuntivi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {prenotazione.conducenti_aggiuntivi.map((c, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-lg text-sm">
                      <p className="font-medium">{c.nome} {c.cognome}</p>
                      <p className="text-slate-500">CF: {c.codice_fiscale} • Patente: {c.patente_numero} ({c.patente_categoria})</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          {/* Riepilogo economico */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600" /> Riepilogo Economico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tariffa base ({prenotazione.durata_giorni}gg)</span>
                  <span className="font-medium">€{prenotazione.tariffa_base?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Servizi supplementari</span>
                  <span className="font-medium">€{prenotazione.totale_servizi?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Franchigie</span>
                  <span className="font-medium">€{prenotazione.totale_franchigie?.toFixed(2) || '0.00'}</span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <span className="text-slate-500">Totale noleggio</span>
                  <span className="font-semibold">€{(prenotazione.tariffa_base + (prenotazione.totale_servizi || 0) + (prenotazione.totale_franchigie || 0)).toFixed(2)}</span>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-500">Acconto (€)</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={prenotazione.acconto || 0}
                    onChange={(e) => handleUpdateField('acconto', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Deposito cauzionale</span>
                  <span className="font-medium">€{prenotazione.deposito_cauzionale?.toFixed(2)}</span>
                </div>
                {prenotazione.check_out && (
                  <>
                    <hr />
                    <div className="flex justify-between text-red-600">
                      <span>Addebiti rientro</span>
                      <span className="font-semibold">€{prenotazione.totale_addebiti_rientro?.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <hr />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Saldo</span>
                  <span className="font-bold text-blue-600">
                    €{(prenotazione.tariffa_base + (prenotazione.totale_servizi || 0) + (prenotazione.totale_franchigie || 0) - (prenotazione.acconto || 0) + (prenotazione.totale_addebiti_rientro || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Stato Pratica</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className={`p-3 rounded-lg ${statusLabels[prenotazione.status]?.color}`}>
                  <p className="font-semibold">{statusLabels[prenotazione.status]?.label}</p>
                </div>
                {prenotazione.contratto_generato && (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>Contratto generato</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Azioni Rapide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!prenotazione.contratto_generato && prenotazione.status === 'approvata' && (
                <Button onClick={handleGenerateContract} className="w-full bg-purple-600 hover:bg-purple-700">
                  <FileText className="w-4 h-4 mr-2" /> Genera Contratto
                </Button>
              )}
              {prenotazione.contratto_generato && (
                <>
                  <Button onClick={handleDownloadPDF} variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" /> Scarica PDF
                  </Button>
                  <Button onClick={() => window.print()} variant="outline" className="w-full">
                    <Printer className="w-4 h-4 mr-2" /> Stampa
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
