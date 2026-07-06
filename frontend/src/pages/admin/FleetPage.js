import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../../components/ui/table';
import { 
  Car, Plus, Pencil, Trash2, Search, AlertCircle, Fuel, Users, Settings2
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const categoryLabels = { economy: 'Economy', compact: 'Compact', suv: 'SUV', luxury: 'Luxury' };
const fuelLabels = { gasoline: 'Benzina', diesel: 'Diesel', electric: 'Elettrica', hybrid: 'Ibrida' };
const statusLabels = { available: 'Disponibile', rented: 'Noleggiato', maintenance: 'Manutenzione' };

const initialFormData = {
  brand: '', model: '', year: new Date().getFullYear(), license_plate: '',
  category: 'economy', daily_rate: '', fuel_type: 'gasoline',
  transmission: 'manual', seats: 5, image_url: '',
  insurance_expiry: '', mileage: 0
};

export default function FleetPage() {
  const { token } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  const fetchVehicles = async () => {
    try {
      const response = await axios.get(`${API}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVehicles(response.data);
    } catch (error) {
      toast.error('Errore nel caricamento dei veicoli');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVehicles(); }, [token]);

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = `${v.brand} ${v.model} ${v.license_plate}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || v.category === filterCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleOpenDialog = (vehicle = null) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        brand: vehicle.brand, model: vehicle.model, year: vehicle.year,
        license_plate: vehicle.license_plate, category: vehicle.category,
        daily_rate: vehicle.daily_rate, fuel_type: vehicle.fuel_type,
        transmission: vehicle.transmission, seats: vehicle.seats,
        image_url: vehicle.image_url || '', insurance_expiry: vehicle.insurance_expiry || '',
        mileage: vehicle.mileage || 0
      });
    } else {
      setEditingVehicle(null);
      setFormData(initialFormData);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const data = { ...formData, daily_rate: parseFloat(formData.daily_rate), year: parseInt(formData.year), seats: parseInt(formData.seats), mileage: parseInt(formData.mileage) };
      
      if (editingVehicle) {
        await axios.put(`${API}/vehicles/${editingVehicle.id}`, data, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Veicolo aggiornato');
      } else {
        await axios.post(`${API}/vehicles`, data, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Veicolo aggiunto');
      }
      
      setDialogOpen(false);
      fetchVehicles();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminare questo veicolo?')) return;
    try {
      await axios.delete(`${API}/vehicles/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Veicolo eliminato');
      fetchVehicles();
    } catch (error) {
      toast.error('Errore durante l\'eliminazione');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await axios.patch(`${API}/vehicles/${id}/status?status=${status}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Stato aggiornato');
      fetchVehicles();
    } catch (error) {
      toast.error('Errore durante l\'aggiornamento');
    }
  };

  return (
    <div className="space-y-6" data-testid="fleet-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Gestione Flotta
          </h2>
          <p className="text-slate-500">Gestisci i veicoli della tua flotta</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handleOpenDialog()} data-testid="add-vehicle-btn">
              <Plus className="w-4 h-4 mr-2" /> Aggiungi Veicolo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>
                {editingVehicle ? 'Modifica Veicolo' : 'Nuovo Veicolo'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Marca *</Label>
                  <Input value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value})} required data-testid="vehicle-brand-input" />
                </div>
                <div className="space-y-2">
                  <Label>Modello *</Label>
                  <Input value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} required data-testid="vehicle-model-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Anno *</Label>
                  <Input type="number" value={formData.year} onChange={(e) => setFormData({...formData, year: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Targa *</Label>
                  <Input value={formData.license_plate} onChange={(e) => setFormData({...formData, license_plate: e.target.value.toUpperCase()})} required data-testid="vehicle-plate-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria *</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tariffa Giornaliera (€) *</Label>
                  <Input type="number" step="0.01" value={formData.daily_rate} onChange={(e) => setFormData({...formData, daily_rate: e.target.value})} required data-testid="vehicle-rate-input" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Carburante</Label>
                  <Select value={formData.fuel_type} onValueChange={(v) => setFormData({...formData, fuel_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(fuelLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cambio</Label>
                  <Select value={formData.transmission} onValueChange={(v) => setFormData({...formData, transmission: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manuale</SelectItem>
                      <SelectItem value="automatic">Automatico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Posti</Label>
                  <Input type="number" min="1" max="9" value={formData.seats} onChange={(e) => setFormData({...formData, seats: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scadenza Assicurazione</Label>
                  <Input type="date" value={formData.insurance_expiry} onChange={(e) => setFormData({...formData, insurance_expiry: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Chilometraggio</Label>
                  <Input type="number" value={formData.mileage} onChange={(e) => setFormData({...formData, mileage: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>URL Immagine</Label>
                <Input value={formData.image_url} onChange={(e) => setFormData({...formData, image_url: e.target.value})} placeholder="https://..." />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={submitting} data-testid="save-vehicle-btn">
                  {submitting ? 'Salvataggio...' : 'Salva'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Cerca per marca, modello o targa..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} data-testid="search-input" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Stato" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le categorie</SelectItem>
                {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Car className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>Nessun veicolo trovato</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Veicolo</TableHead>
                    <TableHead>Targa</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tariffa</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehicles.map((vehicle) => (
                    <TableRow key={vehicle.id} data-testid={`vehicle-row-${vehicle.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-100">
                            <img src={vehicle.image_url || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=200'} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{vehicle.brand} {vehicle.model}</p>
                            <p className="text-sm text-slate-500">{vehicle.year}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{vehicle.license_plate}</TableCell>
                      <TableCell><span className={`status-badge category-${vehicle.category}`}>{categoryLabels[vehicle.category]}</span></TableCell>
                      <TableCell className="font-semibold">€{vehicle.daily_rate}/g</TableCell>
                      <TableCell>
                        <Select value={vehicle.status} onValueChange={(v) => handleStatusChange(vehicle.id, v)}>
                          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(vehicle)} data-testid={`edit-vehicle-${vehicle.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(vehicle.id)} data-testid={`delete-vehicle-${vehicle.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
    </div>
  );
}
