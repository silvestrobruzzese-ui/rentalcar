import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, api } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { 
  Car, LayoutDashboard, CalendarDays, FileText, Users, Settings, LogOut, Menu, X,
  ChevronRight, AlertCircle, Clock, CheckCircle, Truck, Calendar, ListOrdered
} from 'lucide-react';
import { toast } from 'sonner';

// Sidebar Component
export const AdminSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logout effettuato');
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: Car, label: 'Flotta Veicoli', path: '/admin/veicoli' },
    { icon: CalendarDays, label: 'Prenotazioni', path: '/admin/prenotazioni' },
    { icon: Calendar, label: 'Calendario', path: '/admin/calendario' },
    { icon: ListOrdered, label: 'Legenda Prenotazioni', path: '/admin/legenda-prenotazioni' },
    { icon: FileText, label: 'Contratti', path: '/admin/contratti' },
    { icon: Users, label: 'Clienti', path: '/admin/clienti' },
    { icon: Settings, label: 'Impostazioni', path: '/admin/impostazioni' },
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
                className="h-10 w-auto"
              />
              <div>
                <span className="text-sm font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Soverato Rental
                </span>
                <p className="text-[9px] text-slate-500 -mt-0.5">Gestionale Noleggio</p>
              </div>
            </Link>
            <button className="lg:hidden p-1 text-slate-400 hover:text-slate-600" onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <p className="text-sm font-medium text-slate-900">{user?.nome} {user?.cognome}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-100 text-purple-700">
              Amministratore
            </span>
          </div>
          
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || 
                (item.path !== '/admin' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors
                    ${isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                  `}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
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
              data-testid="logout-btn"
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

// Admin Layout
export default function AdminLayout() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && (!isAuthenticated || !isAdmin)) {
      navigate('/login');
    }
  }, [loading, isAuthenticated, isAdmin, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) return null;

  // Get page title
  const getTitle = () => {
    const path = location.pathname;
    if (path === '/admin') return 'Dashboard';
    if (path.includes('/veicoli')) return 'Gestione Flotta';
    if (path.includes('/prenotazioni')) return 'Prenotazioni';
    if (path.includes('/contratti')) return 'Contratti';
    if (path.includes('/clienti')) return 'Clienti';
    if (path.includes('/impostazioni')) return 'Impostazioni';
    return 'Admin';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
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

// Admin Dashboard Page
export function AdminDashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, bookingsData] = await Promise.all([
          api.get('/dashboard/stats', token),
          api.get('/prenotazioni?status=bozza', token)
        ]);
        setStats(statsData);
        setRecentBookings(bookingsData.slice(0, 5));
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const statCards = [
    { icon: Car, label: 'Veicoli Totali', value: stats?.total_vehicles || 0, color: 'blue' },
    { icon: CheckCircle, label: 'Disponibili', value: stats?.available_vehicles || 0, color: 'green' },
    { icon: Truck, label: 'Noleggiati', value: stats?.active_rentals || 0, color: 'purple' },
    { icon: Clock, label: 'In Attesa', value: stats?.pending_bookings || 0, color: 'amber' },
    { icon: Users, label: 'Clienti', value: stats?.total_clients || 0, color: 'slate' },
    { icon: FileText, label: 'Contratti', value: stats?.contracts_generated || 0, color: 'emerald' },
  ];

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    amber: 'bg-amber-100 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-100 text-emerald-600',
  };

  const statusLabels = {
    bozza: 'Bozza',
    in_verifica: 'In Verifica',
    approvata: 'Approvata',
    contratto_generato: 'Contratto Generato',
    consegnato: 'Consegnato',
    chiuso: 'Chiuso'
  };

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat, idx) => (
          <Card key={idx} className="border-slate-200">
            <CardContent className="p-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colorClasses[stat.color]}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Prenotazioni in Bozza
          </CardTitle>
          <Link to="/admin/prenotazioni">
            <Button variant="ghost" size="sm">Vedi tutte <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CalendarDays className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>Nessuna prenotazione in bozza</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentBookings.map((b) => (
                <Link 
                  key={b.id} 
                  to={`/admin/prenotazioni/${b.id}`}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-slate-900">{b.cliente_nome}</p>
                    <p className="text-sm text-slate-500">
                      {b.veicolo_marca} {b.veicolo_modello} • {b.data_ritiro}
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                    {statusLabels[b.status]}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
