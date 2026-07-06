import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { 
  Car, Calendar as CalendarIcon, MapPin, Users, Fuel, Settings2, 
  ArrowLeft, CheckCircle2, AlertTriangle, IdCard
} from 'lucide-react';
import { format, differenceInDays, parseISO, isBefore } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fuelLabels = {
  gasoline: 'Benzina',
  diesel: 'Diesel',
  electric: 'Elettrica',
  hybrid: 'Ibrida'
};

export default function BookingPage() {
  const { vehicleId } = useParams();
  const [searchParams] = useSearchParams();
  const { token, loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  
  const [vehicle, setVehicle] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [patenteScaduta, setPatenteScaduta] = useState(false);
  
  const initialPickup = searchParams.get('pickup') ? new Date(searchParams.get('pickup')) : new Date();
  const initialReturn = searchParams.get('return') ? new Date(searchParams.get('return')) : new Date();
  
  const [pickupDate, setPickupDate] = useState(initialPickup);
  const [returnDate, setReturnDate] = useState(initialReturn);
  const [pickupLocation, setPickupLocation] = useState('Sede principale');
  const [returnLocation, setReturnLocation] = useState('Sede principale');
  const [notes, setNotes] = useState('');
  const [tariffaStagionale, setTariffaStagionale] = useState(null);
  const [loadingTariffa, setLoadingTariffa] = useState(false);

  // Fetch tariffa stagionale quando cambiano le date
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

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;
    
    const fetchData = async () => {
      try {
        // Fetch vehicle
        const vehicleRes = await axios.get(`${API}/vehicles/${vehicleId}`);
        setVehicle(vehicleRes.data);
        
        // Fetch user profile to check license expiration
        if (token) {
          const profileRes = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUserProfile(profileRes.data);
          
          // Check license expiration
          const patente = profileRes.data?.patente;
          if (patente?.data_scadenza) {
            const scadenza = parseISO(patente.data_scadenza);
            if (isBefore(scadenza, new Date())) {
              setPatenteScaduta(true);
            }
          }
        }
      } catch (error) {
        toast.error('Veicolo non trovato');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [vehicleId, navigate, authLoading, token]);

  const days = Math.max(1, differenceInDays(returnDate, pickupDate));
  // Use seasonal rate if available, otherwise use vehicle daily rate
  const dailyRate = tariffaStagionale?.tariffa_giornaliera || vehicle?.daily_rate || vehicle?.tariffa_giornaliera || vehicle?.base_price || 50;
  const totalPrice = days * dailyRate;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      await axios.post(`${API}/bookings`, {
        vehicle_id: vehicleId,
        pickup_date: format(pickupDate, 'yyyy-MM-dd'),
        return_date: format(returnDate, 'yyyy-MM-dd'),
        pickup_location: pickupLocation,
        return_location: returnLocation,
        notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess(true);
      toast.success('Prenotazione effettuata con successo!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Errore durante la prenotazione');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
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
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Prenotazione Confermata!
            </h2>
            <p className="text-slate-500 mb-6">
              La tua richiesta di noleggio è stata inviata. Ti contatteremo presto per confermare i dettagli.
            </p>
            <div className="space-y-3">
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => navigate('/dashboard')}
                data-testid="go-to-dashboard-btn"
              >
                Vai alla Dashboard
              </Button>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/')}
              >
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
        <Button 
          variant="ghost" 
          className="mb-6 text-slate-600"
          onClick={() => navigate(-1)}
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Indietro
        </Button>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vehicle Info */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <div className="aspect-[4/3] overflow-hidden rounded-t-xl">
                <img 
                  src={vehicle?.image_url || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800'}
                  alt={`${vehicle?.brand} ${vehicle?.model}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardContent className="p-5">
                <h2 className="text-xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {vehicle?.brand} {vehicle?.model}
                </h2>
                <p className="text-sm text-slate-500 mb-4">{vehicle?.year}</p>
                
                <div className="flex flex-wrap gap-3 text-sm text-slate-600 mb-4">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {vehicle?.seats} posti
                  </span>
                  <span className="flex items-center gap-1">
                    <Fuel className="w-4 h-4" />
                    {fuelLabels[vehicle?.fuel_type]}
                  </span>
                  <span className="flex items-center gap-1">
                    <Settings2 className="w-4 h-4" />
                    {vehicle?.transmission === 'automatic' ? 'Automatico' : 'Manuale'}
                  </span>
                </div>
                
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600">Tariffa giornaliera</span>
                    <span className="font-semibold">€{vehicle?.daily_rate}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600">Giorni</span>
                    <span className="font-semibold">{days}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg pt-2 border-t border-slate-200">
                    <span className="font-semibold text-slate-900">Totale</span>
                    <span className="font-bold text-blue-600">€{totalPrice.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Booking Form */}
          <div className="lg:col-span-2">
            {/* Alert Patente Scaduta */}
            {patenteScaduta && (
              <Alert variant="destructive" className="mb-6 border-red-500 bg-red-50">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="text-red-800 font-bold">Patente Scaduta!</AlertTitle>
                <AlertDescription className="text-red-700">
                  La tua patente di guida risulta scaduta. Non puoi procedere con la prenotazione finché non aggiorni i dati della patente nel tuo profilo.
                  <br />
                  <Button 
                    variant="outline" 
                    className="mt-3 border-red-500 text-red-700 hover:bg-red-100"
                    onClick={() => navigate('/area-cliente/profilo')}
                  >
                    <IdCard className="w-4 h-4 mr-2" />
                    Aggiorna Patente
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            
            <Card>
              <CardHeader>
                <CardTitle style={{ fontFamily: 'Outfit, sans-serif' }}>Dettagli Prenotazione</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data Ritiro</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="w-full justify-start text-left font-normal h-11"
                            data-testid="booking-pickup-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-blue-600" />
                            {format(pickupDate, 'dd MMMM yyyy', { locale: it })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={pickupDate}
                            onSelect={(date) => date && setPickupDate(date)}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Data Riconsegna</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="w-full justify-start text-left font-normal h-11"
                            data-testid="booking-return-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-blue-600" />
                            {format(returnDate, 'dd MMMM yyyy', { locale: it })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={returnDate}
                            onSelect={(date) => date && setReturnDate(date)}
                            disabled={(date) => date <= pickupDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pickupLocation">Luogo Ritiro</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                          id="pickupLocation"
                          value={pickupLocation}
                          onChange={(e) => setPickupLocation(e.target.value)}
                          className="pl-10 h-11"
                          data-testid="pickup-location-input"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="returnLocation">Luogo Riconsegna</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                          id="returnLocation"
                          value={returnLocation}
                          onChange={(e) => setReturnLocation(e.target.value)}
                          className="pl-10 h-11"
                          data-testid="return-location-input"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="notes">Note aggiuntive (opzionale)</Label>
                    <Textarea 
                      id="notes"
                      placeholder="Richieste particolari, orario preferito, etc."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      data-testid="notes-input"
                    />
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-2">Riepilogo</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p>Veicolo: {vehicle?.brand || vehicle?.marca} {vehicle?.model || vehicle?.modello}</p>
                      <p>Periodo: {format(pickupDate, 'dd/MM/yyyy')} - {format(returnDate, 'dd/MM/yyyy')}</p>
                      <p>Durata: {days} {days === 1 ? 'giorno' : 'giorni'}</p>
                    </div>
                    
                    {/* Tariffa Stagionale */}
                    {loadingTariffa ? (
                      <div className="mt-3 text-sm text-slate-500">Calcolo tariffa...</div>
                    ) : tariffaStagionale ? (
                      <div className={`mt-3 p-2 rounded ${tariffaStagionale.tariffa_applicata !== 'base' ? 'bg-green-100 border border-green-300' : 'bg-slate-100'}`}>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Tariffa giornaliera:</span>
                          <span className={`font-bold ${tariffaStagionale.tariffa_applicata !== 'base' ? 'text-green-700' : 'text-slate-700'}`}>
                            €{tariffaStagionale.tariffa_giornaliera?.toFixed(2)}/giorno
                          </span>
                        </div>
                        {tariffaStagionale.tariffa_applicata !== 'base' && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ {tariffaStagionale.nome_tariffa} ({tariffaStagionale.periodo})
                          </p>
                        )}
                      </div>
                    ) : null}
                    
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-900">Totale stimato:</span>
                        <span className="text-xl font-bold text-blue-600">€{totalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit"
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-lg font-semibold rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
                    disabled={submitting || patenteScaduta}
                    data-testid="confirm-booking-btn"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Elaborazione...
                      </span>
                    ) : patenteScaduta ? (
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Patente Scaduta - Impossibile prenotare
                      </span>
                    ) : (
                      `Conferma Prenotazione - €${totalPrice.toFixed(2)}`
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
