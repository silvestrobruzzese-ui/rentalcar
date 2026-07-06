import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, api } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { 
  Calendar, FileText, Shield, MapPin, Phone, Mail, ChevronRight, Menu, X, Users, Car
} from 'lucide-react';

const HERO_BG = "https://images.unsplash.com/photo-1485291571150-772bcfc10da5?w=1600";

export default function LandingPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const data = await api.get('/vehicles/available');
        setVehicles(data);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
  }, []);

  const features = [
    { icon: Shield, title: 'Assicurazione Inclusa', desc: 'Copertura completa su tutti i veicoli' },
    { icon: FileText, title: 'Contratto Digitale', desc: 'Firma e stampa il contratto online' },
    { icon: MapPin, title: 'Ritiro Flessibile', desc: 'Consegna presso la nostra sede' },
    { icon: Calendar, title: 'Prenotazione Facile', desc: 'Compila il modulo guidato step-by-step' }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3" data-testid="logo-link">
              <div>
                <span className="text-xl font-bold text-blue-600" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  RENTAL CAR
                </span>
              </div>
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <a href="#veicoli" className="text-slate-600 hover:text-slate-900 font-medium text-sm">Veicoli</a>
              <a href="#servizi" className="text-slate-600 hover:text-slate-900 font-medium text-sm">Servizi</a>
              <a href="#contatti" className="text-slate-600 hover:text-slate-900 font-medium text-sm">Contatti</a>
              {isAuthenticated ? (
                <>
                  <Link 
                    to={isAdmin ? '/admin' : '/area-cliente'} 
                    className="text-slate-600 hover:text-slate-900 font-medium text-sm"
                    data-testid="dashboard-link"
                  >
                    {isAdmin ? 'Pannello Admin' : 'Area Cliente'}
                  </Link>
                  <Button variant="outline" size="sm" onClick={logout} data-testid="logout-btn">
                    Esci
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" data-testid="login-link">
                    <Button variant="ghost" size="sm">Accedi</Button>
                  </Link>
                  <Link to="/registrazione" data-testid="register-link">
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Registrati</Button>
                  </Link>
                </>
              )}
            </nav>
            
            <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-200 py-4 px-4 space-y-3">
            <a href="#veicoli" className="block py-2 text-slate-600">Veicoli</a>
            <a href="#servizi" className="block py-2 text-slate-600">Servizi</a>
            <a href="#contatti" className="block py-2 text-slate-600">Contatti</a>
            {isAuthenticated ? (
              <>
                <Link to={isAdmin ? '/admin' : '/area-cliente'} className="block py-2 text-slate-600">
                  {isAdmin ? 'Pannello Admin' : 'Area Cliente'}
                </Link>
                <Button variant="outline" onClick={logout} className="w-full">Esci</Button>
              </>
            ) : (
              <>
                <Link to="/login"><Button variant="outline" className="w-full">Accedi</Button></Link>
                <Link to="/registrazione"><Button className="w-full bg-blue-600">Registrati</Button></Link>
              </>
            )}
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative pt-16 min-h-[85vh] flex items-center">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-900/50" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Noleggio Auto<br />
              <span className="text-blue-400">Semplice e Sicuro</span>
            </h1>
            <p className="mt-6 text-lg text-slate-300 leading-relaxed max-w-xl">
              Registrati, compila i tuoi dati e prenota il veicolo che preferisci. 
              Contratto digitale pronto in pochi minuti.
            </p>
            
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              {isAuthenticated ? (
                <Link to={isAdmin ? '/admin' : '/area-cliente'}>
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto" data-testid="cta-dashboard">
                    {isAdmin ? 'Vai al Pannello Admin' : 'Vai all\'Area Cliente'}
                    <ChevronRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/registrazione">
                    <Button size="lg" className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto" data-testid="cta-register">
                      Registrati e Prenota
                      <ChevronRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 w-full sm:w-auto">
                      Accedi
                    </Button>
                  </Link>
                </>
              )}
            </div>
            
            {/* Agency Info - Clickable contacts */}
            <div className="mt-12 flex flex-wrap gap-6 text-sm text-slate-300">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>Italia</span>
              </span>
              <a 
                href="tel:+393342370420"
                className="flex items-center gap-2 hover:text-white transition-colors"
                data-testid="hero-phone"
              >
                <Phone className="w-4 h-4 text-blue-400" />
                <span className="underline">334 237 0420</span>
              </a>
              <a 
                href="mailto:giannibruzzese@gmail.com?subject=Richiesta%20Informazioni%20Noleggio"
                className="flex items-center gap-2 hover:text-white transition-colors"
                data-testid="hero-email"
              >
                <Mail className="w-4 h-4 text-blue-400" />
                <span className="underline">giannibruzzese@gmail.com</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="servizi" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              I Nostri Servizi
            </h2>
            <p className="mt-4 text-slate-500 max-w-2xl mx-auto">
              Un servizio completo per rendere il tuo noleggio semplice, veloce e sicuro
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <Card key={i} className="border-slate-200 hover:border-blue-200 transition-colors">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                    <f.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    {f.title}
                  </h3>
                  <p className="text-slate-500 text-sm">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Vehicles */}
      <section id="veicoli" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              La Nostra Flotta
            </h2>
            <p className="mt-4 text-slate-500">Scegli il veicolo ideale per le tue esigenze</p>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Car className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p>Nessun veicolo disponibile al momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vehicles.map((v) => (
                <Card key={v.id} className="overflow-hidden border-slate-200 hover:shadow-lg transition-shadow" data-testid={`vehicle-card-${v.id}`}>
                  <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                    <img 
                      src={v.image_url || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600'}
                      alt={`${v.marca} ${v.modello}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                          {v.marca} {v.modello}
                        </h3>
                        <p className="text-sm text-slate-500">{v.anno} • {v.targa}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">€{v.tariffa_giornaliera}</p>
                        <p className="text-xs text-slate-500">/giorno</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-600 mb-4">
                      <span className="bg-slate-100 px-2 py-1 rounded">{v.cambio}</span>
                      <span className="bg-slate-100 px-2 py-1 rounded">{v.alimentazione}</span>
                      <span className="bg-slate-100 px-2 py-1 rounded">{v.posti} posti</span>
                      <span className="bg-slate-100 px-2 py-1 rounded">{v.colore}</span>
                    </div>
                    <div className="text-xs text-slate-500 mb-4">
                      <p>Km inclusi: {v.km_inclusi_giorno}/giorno • Extra: €{v.prezzo_km_extra}/km</p>
                      <p>Deposito: €{v.deposito_cauzionale}</p>
                    </div>
                    {isAuthenticated && !isAdmin && (
                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700" 
                        onClick={() => navigate(`/prenota/${v.id}`)}
                        data-testid={`book-btn-${v.id}`}
                      >
                        Prenota Ora
                      </Button>
                    )}
                    {!isAuthenticated && (
                      <Link to="/registrazione">
                        <Button className="w-full bg-blue-600 hover:bg-blue-700">
                          Registrati per Prenotare
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Contact / CTA */}
      <section id="contatti" className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Pronto a Partire?
          </h2>
          <p className="text-blue-100 text-lg mb-8">
            Registrati in pochi minuti e completa la prenotazione online
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
            {!isAuthenticated && (
              <Link to="/registrazione">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
                  Inizia la Registrazione
                </Button>
              </Link>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-white">
            <div
              className="bg-white/10 rounded-xl p-6"
              data-testid="contact-address"
            >
              <MapPin className="w-8 h-8 mx-auto mb-3" />
              <h4 className="font-semibold mb-1">Indirizzo</h4>
              <p className="text-sm text-blue-100">Italia</p>
            </div>
            <a 
              href="tel:+393342370420"
              className="bg-white/10 rounded-xl p-6 hover:bg-white/20 transition-colors cursor-pointer"
              data-testid="contact-phone"
            >
              <Phone className="w-8 h-8 mx-auto mb-3" />
              <h4 className="font-semibold mb-1">Telefono</h4>
              <p className="text-sm text-blue-100">334 237 0420</p>
              <p className="text-xs text-blue-200 mt-2 underline">Tocca per chiamare →</p>
            </a>
            <a 
              href="mailto:giannibruzzese@gmail.com?subject=Richiesta%20Informazioni%20Noleggio"
              className="bg-white/10 rounded-xl p-6 hover:bg-white/20 transition-colors cursor-pointer"
              data-testid="contact-email"
            >
              <Mail className="w-8 h-8 mx-auto mb-3" />
              <h4 className="font-semibold mb-1">Email</h4>
              <p className="text-sm text-blue-100">giannibruzzese@gmail.com</p>
              <p className="text-xs text-blue-200 mt-2 underline">Tocca per inviare email →</p>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>RENTAL CAR</span>
          </div>
          <p className="text-sm mt-2">© 2026 Rental Car. Tutti i diritti riservati.</p>
        </div>
      </footer>
    </div>
  );
}
