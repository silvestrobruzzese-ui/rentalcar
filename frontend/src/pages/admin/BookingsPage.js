import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { CalendarDays, Search, Eye, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const statusLabels = {
  pending: 'In attesa',
  confirmed: 'Confermata',
  active: 'In corso',
  completed: 'Completata',
  cancelled: 'Annullata'
};

export default function BookingsPage() {
  const { token, isAdmin } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API}/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
    } catch (error) {
      toast.error('Errore nel caricamento delle prenotazioni');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, [token]);

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = `${b.user_name} ${b.vehicle_brand} ${b.vehicle_model}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || b.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (id, status) => {
    try {
      await axios.patch(`${API}/bookings/${id}/status?status=${status}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Stato aggiornato');
      fetchBookings();
    } catch (error) {
      toast.error('Errore durante l\'aggiornamento');
    }
  };

  const handleCreateContract = async (bookingId) => {
    try {
      await axios.post(`${API}/contracts/from-booking/${bookingId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Contratto creato');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Errore durante la creazione del contratto');
    }
  };

  const handleViewDetails = (booking) => {
    setSelectedBooking(booking);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-6" data-testid="bookings-page">
      <div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
          {isAdmin ? 'Gestione Prenotazioni' : 'Le mie Prenotazioni'}
        </h2>
        <p className="text-slate-500">{isAdmin ? 'Visualizza e gestisci tutte le prenotazioni' : 'Visualizza lo storico delle tue prenotazioni'}</p>
      </div>

      {/* Filters */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder={isAdmin ? "Cerca per cliente o veicolo..." : "Cerca per veicolo..."}
                className="pl-10" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                data-testid="search-bookings"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Stato" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CalendarDays className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>Nessuna prenotazione trovata</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isAdmin && <TableHead>Cliente</TableHead>}
                    <TableHead>Veicolo</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Totale</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => (
                    <TableRow key={booking.id} data-testid={`booking-row-${booking.id}`}>
                      {isAdmin && (
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">{booking.user_name}</p>
                            <p className="text-sm text-slate-500">{booking.user_email}</p>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <p className="font-medium">{booking.vehicle_brand} {booking.vehicle_model}</p>
                        <p className="text-sm text-slate-500">{booking.vehicle_plate}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{booking.pickup_date}</p>
                        <p className="text-sm text-slate-500">→ {booking.return_date}</p>
                      </TableCell>
                      <TableCell className="font-semibold">€{booking.total_price.toFixed(2)}</TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Select value={booking.status} onValueChange={(v) => handleStatusChange(booking.id, v)}>
                            <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`status-badge status-${booking.status}`}>
                            {statusLabels[booking.status]}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetails(booking)} data-testid={`view-booking-${booking.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {isAdmin && booking.status === 'confirmed' && (
                            <Button variant="ghost" size="sm" onClick={() => handleCreateContract(booking.id)} title="Crea contratto" data-testid={`create-contract-${booking.id}`}>
                              <FileText className="w-4 h-4 text-blue-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>Dettagli Prenotazione</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Veicolo</h4>
                <p>{selectedBooking.vehicle_brand} {selectedBooking.vehicle_model}</p>
                <p className="text-sm text-slate-500">Targa: {selectedBooking.vehicle_plate}</p>
              </div>
              {isAdmin && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold text-slate-900 mb-2">Cliente</h4>
                  <p>{selectedBooking.user_name}</p>
                  <p className="text-sm text-slate-500">{selectedBooking.user_email}</p>
                </div>
              )}
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Periodo</h4>
                <p>Dal: {selectedBooking.pickup_date}</p>
                <p>Al: {selectedBooking.return_date}</p>
                <p className="text-sm text-slate-500 mt-1">Ritiro: {selectedBooking.pickup_location}</p>
                <p className="text-sm text-slate-500">Riconsegna: {selectedBooking.return_location}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Totale</span>
                  <span className="text-xl font-bold text-blue-600">€{selectedBooking.total_price.toFixed(2)}</span>
                </div>
              </div>
              {selectedBooking.notes && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="font-semibold text-slate-900 mb-2">Note</h4>
                  <p className="text-sm text-slate-600">{selectedBooking.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
