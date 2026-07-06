import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { 
  Car, LayoutDashboard, CalendarDays, FileText, Users, Settings, LogOut,
  Menu, X, ChevronRight, TrendingUp, Clock, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Sidebar Component
export const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, isAdmin, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logout effettuato');
  };

  const adminNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: Car, label: 'Flotta', path: '/admin/fleet' },
    { icon: CalendarDays, label: 'Prenotazioni', path: '/admin/bookings' },
    { icon: FileText, label: 'Contratti', path: '/admin/contracts' },
    { icon: Users, label: 'Clienti', path: '/admin/clients' },
  ];

  const clientNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: CalendarDays, label: 'Le mie prenotazioni', path: '/dashboard/bookings' },
    { icon: FileText, label: 'I miei contratti', path: '/dashboard/contracts' },
    { icon: Settings, label: 'Profilo', path: '/dashboard/profile' },
  ];

  const navItems = isAdmin ? adminNavItems : clientNavItems;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-slate-200
        transform transition-transform duration-300 lg:transform-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                <Car className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                AutoRent
              </span>
            </Link>
            <button 
              className="lg:hidden p-1 text-slate-400 hover:text-slate-600"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* User info */}
          <div className="px-4 py-4 border-b border-slate-200">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            <span className={`
              inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-full
              ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}
            `}>
              {isAdmin ? 'Amministratore' : 'Cliente'}
            </span>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors duration-200
                    ${isActive 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }
                  `}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          
          {/* Logout */}
          <div className="p-3 border-t border-slate-200">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 font-medium transition-colors duration-200"
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

// Dashboard Header
export const DashboardHeader = ({ title, onMenuClick }) => {
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <button 
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900"
            onClick={onMenuClick}
            data-testid="menu-toggle"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {title}
          </h1>
        </div>
        <Link to="/">
          <Button variant="outline" size="sm" className="hidden sm:flex">
            Vai al sito
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
    </header>
  );
};

// Admin Dashboard Stats
export const AdminDashboard = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, bookingsRes] = await Promise.all([
          axios.get(`${API}/dashboard/stats`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/bookings?status=pending`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setStats(statsRes.data);
        setRecentBookings(bookingsRes.data.slice(0, 5));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { icon: Car, label: 'Veicoli Totali', value: stats?.total_vehicles || 0, color: 'blue' },
    { icon: Car, label: 'Disponibili', value: stats?.available_vehicles || 0, color: 'green' },
    { icon: CalendarDays, label: 'Noleggi Attivi', value: stats?.active_rentals || 0, color: 'purple' },
    { icon: Clock, label: 'In Attesa', value: stats?.pending_bookings || 0, color: 'amber' },
    { icon: Users, label: 'Clienti', value: stats?.total_clients || 0, color: 'slate' },
    { icon: TrendingUp, label: 'Ricavi Mese', value: `€${stats?.monthly_revenue?.toFixed(0) || 0}`, color: 'emerald' },
  ];

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    amber: 'bg-amber-100 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-100 text-emerald-600',
  };

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      {/* Stats Grid */}
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
      
      {/* Recent Bookings */}
      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Prenotazioni in Attesa
          </CardTitle>
          <Link to="/admin/bookings">
            <Button variant="ghost" size="sm">
              Vedi tutte <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentBookings.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CalendarDays className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>Nessuna prenotazione in attesa</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">{booking.user_name}</p>
                    <p className="text-sm text-slate-500">
                      {booking.vehicle_brand} {booking.vehicle_model} • {booking.pickup_date}
                    </p>
                  </div>
                  <span className="status-badge status-pending">In attesa</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Client Dashboard
export const ClientDashboard = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await axios.get(`${API}/bookings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBookings(response.data.slice(0, 5));
      } catch (error) {
        console.error('Error fetching bookings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [token]);

  const statusLabels = {
    pending: 'In attesa',
    confirmed: 'Confermata',
    active: 'In corso',
    completed: 'Completata',
    cancelled: 'Annullata'
  };

  return (
    <div className="space-y-6" data-testid="client-dashboard">
      {/* Welcome */}
      <Card className="border-slate-200 bg-gradient-to-r from-blue-600 to-blue-500">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Ciao, {user?.name?.split(' ')[0]}!
          </h2>
          <p className="text-blue-100 mb-4">Pronto per il tuo prossimo viaggio?</p>
          <Button 
            onClick={() => navigate('/')}
            className="bg-white text-blue-600 hover:bg-blue-50"
            data-testid="browse-vehicles-btn"
          >
            Sfoglia i veicoli
          </Button>
        </CardContent>
      </Card>
      
      {/* Recent Bookings */}
      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Le tue prenotazioni recenti
          </CardTitle>
          <Link to="/dashboard/bookings">
            <Button variant="ghost" size="sm">
              Vedi tutte <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CalendarDays className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>Nessuna prenotazione ancora</p>
              <Button 
                variant="link" 
                className="text-blue-600 mt-2"
                onClick={() => navigate('/')}
              >
                Prenota ora
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">
                      {booking.vehicle_brand} {booking.vehicle_model}
                    </p>
                    <p className="text-sm text-slate-500">
                      {booking.pickup_date} → {booking.return_date}
                    </p>
                  </div>
                  <span className={`status-badge status-${booking.status}`}>
                    {statusLabels[booking.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
