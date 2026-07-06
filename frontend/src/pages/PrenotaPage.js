import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth, api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { 
  Car, Calendar as CalendarIcon, ArrowLeft, Plus, Trash2, CheckCircle, AlertCircle, Users
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PROVINCES = ['AG', 'AL', 'AN', 'AO', 'AR', 'AP', 'AT', 'AV', 'BA', 'BT', 'BL', 'BN', 'BG', 'BI', 'BO', 'BZ', 'BS', 'BR', 'CA', 'CL', 'CB', 'CI', 'CE', 'CT', 'CZ', 'CH', 'CO', 'CS', 'CR', 'KR', 'CN', 'EN', 'FM', 'FE', 'FI', 'FG', 'FC', 'FR', 'GE', 'GO', 'GR', 'IM', 'IS', 'SP', 'AQ', 'LT', 'LE', 'LC', 'LI', 'LO', 'LU', 'MC', 'MN', 'MS', 'MT', 'ME', 'MI', 'MO', 'MB', 'NA', 'NO', 'NU', 'OG', 'OT', 'OR', 'PD', 'PA', 'PR', 'PV', 'PG', 'PU', 'PE', 'PC', 'PI', 'PT', 'PN', 'PZ', 'PO', 'RG', 'RA', 'RC', 'RE', 'RI', 'RN', 'RM', 'RO', 'SA', 'VS', 'SS', 'SV', 'SI', 'SR', 'SO', 'TA', 'TE', 'TR', 'TO', 'TP', 'TN', 'TV', 'TS', 'UD', 'VA', 'VE', 'VB', 'VC', 'VR', 'VV', 'VI', 'VT'];
const LICENSE_CATEGORIES = ['AM', 'A1', 'A2', 'A', 'B', 'B1', 'BE', 'C', 'C1', 'CE', 'D', 'D1', 'DE'];

const emptyDriver = {
  nome: '', cognome: '', data_nascita: '', luogo_nascita: '', codice_fiscale: '',
  indirizzo: '', comune: '', provincia: '', cap: '', cellulare: '', email: '',
  patente_numero: '', patente_categoria: '', patente_data_rilascio: '', 
  patente_data_scadenza: '', patente_paese_rilascio: 'Italia'
};

export default function PrenotaPage() {
  const { vehicleId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [pickupDate, setPickupDate] = useState(addDays(new Date(), 1));
  const [returnDate, setReturnDate] = useState(addDays(new Date(), 3));
  const [pickupTime, setPickupTime] = useState('09:00');
  const [returnTime, setReturnTime] = useState('18:00');
  const [note, setNote] = useState('');
  
  // Tariffa stagionale
  const [tariffaStagionale, setTariffaStagionale] = useState(null);
  const [loadingTariffa, setLoadingTariffa] = useState(false);

  // Additional drivers
  const [conducentiAggiuntivi, setConducentiAggiuntivi] = useState([]);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [newDriver, setNewDriver] = useState({...emptyDriver});
  const [driverErrors, setDriverErrors] = useState([]);

  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        const data = await api.get(`/vehicles/${vehicleId}`, token);
        setVehicle(data);
      } catch (error) {
        toast.error('Veicolo non trovato');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchVehicle();
  }, [vehicleId, token, navigate]);

  // Fetch tariffa stagionale quando cambiano le date o il veicolo
  useEffect(() => {
    const fetchTariffaStagionale = async () => {
      if (!vehicle || !pickupDate || !returnDate) return;
      
      setLoadingTariffa(true);
      try {
        const res = await axios.get(`${API}/calcola-prezzo-dinamico`, {
          params: {
            veicolo_id: vehicleId,
            data_inizio: format(pickupDate, 'yyyy-MM-dd'),
            data_fine: format(returnDate, 'yyyy-MM-dd')
          }
        });
        setTariffaStagionale(res.data);
      } catch (error) {
        console.error('Errore calcolo tariffa:', error);
        setTariffaStagionale(null);
      } finally {
        setLoadingTariffa(false);
      }
    };
    
    fetchTariffaStagionale();
  }, [vehicle, vehicleId, pickupDate, returnDate]);

  // Calcolo giorni: 1 giorno = 24h, ogni eccedenza = +1 giorno
  const calculateDays = () => {
    try {
      const [ph, pm] = pickupTime.split(':').map(Number);
      const [rh, rm] = returnTime.split(':').map(Number);
      const start = new Date(pickupDate);
      start.setHours(ph, pm, 0);
      const end = new Date(returnDate);
      end.setHours(rh, rm, 0);
      const diffHours = (end - start) / (1000 * 60 * 60);
      return Math.max(1, Math.floor(diffHours / 24) + (diffHours % 24 > 0 ? 1 : 0));
    } catch {
      return Math.max(1, differenceInDays(returnDate, pickupDate));
    }
  };
  const days = calculateDays();
  const dailyRate = tariffaStagionale?.tariffa_giornaliera || vehicle?.tariffa_giornaliera || 0;
  const totalPrice = days * dailyRate;
  const kmInclusi = vehicle ? days * vehicle.km_inclusi_giorno : 0;

  const validateDriver = () => {
    const errs = [];
    if (!newDriver.nome.trim()) errs.push('Nome è obbligatorio');
    if (!newDriver.cognome.trim()) errs.push('Cognome è obbligatorio');
    if (!newDriver.data_nascita) errs.push('Data di nascita è obbligatoria');
    if (!newDriver.codice_fiscale.trim()) errs.push('Codice fiscale è obbligatorio');
    if (newDriver.codice_fiscale.trim().length !== 16) errs.push('Codice fiscale deve essere di 16 caratteri');
    if (!newDriver.patente_numero.trim()) errs.push('Numero patente è obbligatorio');
    if (!newDriver.patente_categoria) errs.push('Categoria patente è obbligatoria');
    if (!newDriver.patente_data_scadenza) errs.push('Scadenza patente è obbligatoria');
    
    if (newDriver.patente_data_scadenza) {
      const expiry = new Date(newDriver.patente_data_scadenza);
      if (expiry < new Date()) {
        errs.push('La patente del conducente aggiuntivo è scaduta');
      }
    }
    
    return errs;
  };

  const handleAddDriver = () => {
    const errs = validateDriver();
    if (errs.length > 0) {
      setDriverErrors(errs);
      return;
    }
    setConducentiAggiuntivi([...conducentiAggiuntivi, {...newDriver}]);
    setNewDriver({...emptyDriver});
    setShowDriverForm(false);
    setDriverErrors([]);
    toast.success('Conducente aggiunto');
  };

  const handleRemoveDriver = (index) => {
    setConducentiAggiuntivi(conducentiAggiuntivi.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    
    try {
      await api.post('/prenotazioni', {
        veicolo_id: vehicleId,
        data_ritiro: format(pickupDate, 'yyyy-MM-dd'),
        ora_ritiro: pickupTime,
        data_riconsegna: format(returnDate, 'yyyy-MM-dd'),
        ora_riconsegna: returnTime,
        conducenti_aggiuntivi: conducentiAggiuntivi,
        note: note
      }, token);
      
      setSuccess(true);
      toast.success('Prenotazione inviata con successo!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Errore durante la prenotazione');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-10 pb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Prenotazione Inviata!
            </h2>
            <p className="text-slate-500 mb-6">
              La tua richiesta è stata inviata. L'agenzia verificherà i dati e ti contatterà per confermare.
            </p>
            <div className="space-y-3">
              <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => navigate('/area-cliente')}>
                Vai all'Area Cliente
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/')}>
                Torna alla Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" className="mb-6 text-slate-600" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Indietro
        </Button>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Dates */}
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-blue-600" /> Date e Orari
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Ritiro *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4 text-blue-600" />
                          {format(pickupDate, 'dd MMM yyyy', { locale: it })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={pickupDate} onSelect={(d) => d && setPickupDate(d)} disabled={(d) => d < new Date()} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Ora Ritiro *</Label>
                    <Select value={pickupTime} onValueChange={setPickupTime}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Riconsegna *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4 text-blue-600" />
                          {format(returnDate, 'dd MMM yyyy', { locale: it })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="single" selected={returnDate} onSelect={(d) => d && setReturnDate(d)} disabled={(d) => d <= pickupDate} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Ora Riconsegna *</Label>
                    <Select value={returnTime} onValueChange={setReturnTime}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Drivers */}
            <Card className="border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" /> Conducenti Aggiuntivi
                </CardTitle>
                {!showDriverForm && (
                  <Button variant="outline" size="sm" onClick={() => setShowDriverForm(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Aggiungi
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {/* List of added drivers */}
                {conducentiAggiuntivi.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {conducentiAggiuntivi.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium">{d.nome} {d.cognome}</p>
                          <p className="text-sm text-slate-500">Patente: {d.patente_numero} ({d.patente_categoria})</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleRemoveDriver(i)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add driver form */}
                {showDriverForm && (
                  <div className="border border-slate-200 rounded-lg p-4 space-y-4">
                    <h4 className="font-semibold">Nuovo Conducente</h4>
                    
                    {driverErrors.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                        <ul className="list-disc list-inside">
                          {driverErrors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome *</Label>
                        <Input value={newDriver.nome} onChange={(e) => setNewDriver({...newDriver, nome: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Cognome *</Label>
                        <Input value={newDriver.cognome} onChange={(e) => setNewDriver({...newDriver, cognome: e.target.value})} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data Nascita *</Label>
                        <Input type="date" value={newDriver.data_nascita} onChange={(e) => setNewDriver({...newDriver, data_nascita: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Luogo Nascita</Label>
                        <Input value={newDriver.luogo_nascita} onChange={(e) => setNewDriver({...newDriver, luogo_nascita: e.target.value})} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Codice Fiscale *</Label>
                      <Input value={newDriver.codice_fiscale} onChange={(e) => setNewDriver({...newDriver, codice_fiscale: e.target.value.toUpperCase()})} maxLength={16} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Numero Patente *</Label>
                        <Input value={newDriver.patente_numero} onChange={(e) => setNewDriver({...newDriver, patente_numero: e.target.value.toUpperCase()})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Categoria *</Label>
                        <Select value={newDriver.patente_categoria} onValueChange={(v) => setNewDriver({...newDriver, patente_categoria: v})}>
                          <SelectTrigger><SelectValue placeholder="Sel..." /></SelectTrigger>
                          <SelectContent>
                            {LICENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data Rilascio</Label>
                        <Input type="date" value={newDriver.patente_data_rilascio} onChange={(e) => setNewDriver({...newDriver, patente_data_rilascio: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Data Scadenza *</Label>
                        <Input type="date" value={newDriver.patente_data_scadenza} onChange={(e) => setNewDriver({...newDriver, patente_data_scadenza: e.target.value})} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cellulare</Label>
                        <Input value={newDriver.cellulare} onChange={(e) => setNewDriver({...newDriver, cellulare: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={newDriver.email} onChange={(e) => setNewDriver({...newDriver, email: e.target.value})} />
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => { setShowDriverForm(false); setDriverErrors([]); }}>
                        Annulla
                      </Button>
                      <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleAddDriver}>
                        Aggiungi Conducente
                      </Button>
                    </div>
                  </div>
                )}
                
                {conducentiAggiuntivi.length === 0 && !showDriverForm && (
                  <p className="text-sm text-slate-500">Nessun conducente aggiuntivo. Clicca "Aggiungi" se vuoi autorizzare altri conducenti.</p>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Note (opzionale)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea 
                  placeholder="Richieste particolari, orario preferito, etc."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right: Vehicle Summary */}
          <div className="space-y-6">
            <Card className="border-slate-200 sticky top-8">
              <div className="aspect-[4/3] overflow-hidden rounded-t-xl">
                <img 
                  src={vehicle?.image_url || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800'}
                  alt={`${vehicle?.marca} ${vehicle?.modello}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardContent className="p-5">
                <h2 className="text-xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {vehicle?.marca} {vehicle?.modello}
                </h2>
                <p className="text-sm text-slate-500 mb-4">{vehicle?.anno} • {vehicle?.targa}</p>
                
                <div className="flex flex-wrap gap-2 text-xs text-slate-600 mb-4">
                  <span className="bg-slate-100 px-2 py-1 rounded">{vehicle?.cambio}</span>
                  <span className="bg-slate-100 px-2 py-1 rounded">{vehicle?.alimentazione}</span>
                  <span className="bg-slate-100 px-2 py-1 rounded">{vehicle?.posti} posti</span>
                  <span className="bg-slate-100 px-2 py-1 rounded">{vehicle?.colore}</span>
                </div>
                
                <div className="border-t border-slate-200 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tariffa giornaliera</span>
                    <span className="font-medium">
                      {loadingTariffa ? (
                        <span className="text-slate-400">Calcolo...</span>
                      ) : (
                        <>€{dailyRate.toFixed(2)}</>
                      )}
                    </span>
                  </div>
                  
                  {/* Box tariffa stagionale applicata */}
                  {!loadingTariffa && tariffaStagionale && tariffaStagionale.tariffa_applicata !== 'base' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs" data-testid="seasonal-rate-info">
                      <p className="text-green-700 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Tariffa stagionale applicata
                      </p>
                      <p className="text-green-600 mt-0.5">
                        {tariffaStagionale.nome_tariffa} {tariffaStagionale.periodo && `(${tariffaStagionale.periodo})`}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-slate-600">Giorni</span>
                    <span className="font-medium">{days}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Km inclusi</span>
                    <span className="font-medium">{kmInclusi} km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Deposito cauzionale</span>
                    <span className="font-medium">€{vehicle?.deposito_cauzionale}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold">Totale</span>
                    <span className="font-bold text-blue-600" data-testid="total-price">€{totalPrice.toFixed(2)}</span>
                  </div>
                </div>
                
                <Button 
                  className="w-full mt-4 h-12 bg-blue-600 hover:bg-blue-700 text-lg font-semibold"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Invio...
                    </span>
                  ) : 'Invia Prenotazione'}
                </Button>
                
                <p className="text-xs text-slate-500 text-center mt-3">
                  L'agenzia verificherà i dati e ti contatterà per confermare
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
