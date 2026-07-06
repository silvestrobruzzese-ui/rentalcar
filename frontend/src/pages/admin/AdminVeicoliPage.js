import { useState, useEffect, useRef } from 'react';
import { useAuth, api } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Car, Plus, Pencil, Trash2, Search, Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const initialForm = {
  marca: '', modello: '', targa: '', colore: '', cambio: 'Manuale',
  alimentazione: 'Benzina', anno: new Date().getFullYear(), posti: 5,
  km_attuali: 0, tariffa_giornaliera: '', deposito_cauzionale: 500,
  km_inclusi_giorno: 200, prezzo_km_extra: 0.25, image_url: ''
};

const statusLabels = {
  disponibile: { label: 'Disponibile', color: 'bg-green-100 text-green-700' },
  noleggiato: { label: 'Noleggiato', color: 'bg-blue-100 text-blue-700' },
  manutenzione: { label: 'Manutenzione', color: 'bg-amber-100 text-amber-700' }
};

export default function AdminVeicoliPage() {
  const { token } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const fetchData = async () => {
    try {
      const data = await api.get('/vehicles', token);
      setVehicles(data);
    } catch (error) {
      toast.error('Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [token]);

  const filtered = vehicles.filter(v => {
    const matchesSearch = `${v.marca} ${v.modello} ${v.targa}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleOpenDialog = (vehicle = null) => {
    if (vehicle) {
      setEditingId(vehicle.id);
      setFormData({
        marca: vehicle.marca, modello: vehicle.modello, targa: vehicle.targa,
        colore: vehicle.colore, cambio: vehicle.cambio, alimentazione: vehicle.alimentazione,
        anno: vehicle.anno, posti: vehicle.posti, km_attuali: vehicle.km_attuali,
        tariffa_giornaliera: vehicle.tariffa_giornaliera, deposito_cauzionale: vehicle.deposito_cauzionale,
        km_inclusi_giorno: vehicle.km_inclusi_giorno, prezzo_km_extra: vehicle.prezzo_km_extra,
        image_url: vehicle.image_url || ''
      });
      setImagePreview(vehicle.image_url || null);
    } else {
      setEditingId(null);
      setFormData(initialForm);
      setImagePreview(null);
    }
    setDialogOpen(true);
  };

  // Handle file upload
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Seleziona un file immagine valido');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'immagine non può superare 5MB');
      return;
    }

    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await axios.post(`${API}/api/upload/image`, formDataUpload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const imageUrl = response.data.url;
      setFormData(prev => ({ ...prev, image_url: imageUrl }));
      setImagePreview(imageUrl);
      toast.success('Immagine caricata!');
    } catch (error) {
      console.error('Upload error:', error);
      // Fallback: use local file as base64 preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        // For demo, we'll store a placeholder URL
        setFormData(prev => ({ ...prev, image_url: reader.result }));
      };
      reader.readAsDataURL(file);
      toast.info('Immagine caricata localmente');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, image_url: '' }));
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        ...formData,
        tariffa_giornaliera: parseFloat(formData.tariffa_giornaliera),
        deposito_cauzionale: parseFloat(formData.deposito_cauzionale),
        prezzo_km_extra: parseFloat(formData.prezzo_km_extra),
        anno: parseInt(formData.anno),
        posti: parseInt(formData.posti),
        km_attuali: parseInt(formData.km_attuali),
        km_inclusi_giorno: parseInt(formData.km_inclusi_giorno)
      };
      
      if (editingId) {
        await api.put(`/vehicles/${editingId}`, data, token);
        toast.success('Veicolo aggiornato');
      } else {
        await api.post('/vehicles', data, token);
        toast.success('Veicolo aggiunto');
      }
      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminare questo veicolo?')) return;
    try {
      await api.delete(`/vehicles/${id}`, token);
      toast.success('Veicolo eliminato');
      fetchData();
    } catch (error) {
      toast.error('Errore nell\'eliminazione');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.patch(`/vehicles/${id}/status?status=${status}`, {}, token);
      toast.success('Stato aggiornato');
      fetchData();
    } catch (error) {
      toast.error('Errore nell\'aggiornamento');
    }
  };

  return (
    <div className="space-y-6" data-testid="veicoli-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Gestione Flotta Veicoli
          </h2>
          <p className="text-sm text-slate-500">Gestisci i veicoli disponibili per il noleggio</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handleOpenDialog()} data-testid="add-vehicle-btn">
              <Plus className="w-4 h-4 mr-2" /> Aggiungi Veicolo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Modifica Veicolo' : 'Nuovo Veicolo'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Marca *</Label>
                  <Input value={formData.marca} onChange={(e) => setFormData({...formData, marca: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Modello *</Label>
                  <Input value={formData.modello} onChange={(e) => setFormData({...formData, modello: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Targa *</Label>
                  <Input value={formData.targa} onChange={(e) => setFormData({...formData, targa: e.target.value.toUpperCase()})} required />
                </div>
                <div className="space-y-2">
                  <Label>Colore *</Label>
                  <Input value={formData.colore} onChange={(e) => setFormData({...formData, colore: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Anno *</Label>
                  <Input type="number" value={formData.anno} onChange={(e) => setFormData({...formData, anno: e.target.value})} required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Cambio</Label>
                  <Select value={formData.cambio} onValueChange={(v) => setFormData({...formData, cambio: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Manuale">Manuale</SelectItem>
                      <SelectItem value="Automatico">Automatico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Alimentazione</Label>
                  <Select value={formData.alimentazione} onValueChange={(v) => setFormData({...formData, alimentazione: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Benzina">Benzina</SelectItem>
                      <SelectItem value="Diesel">Diesel</SelectItem>
                      <SelectItem value="GPL">GPL</SelectItem>
                      <SelectItem value="Metano">Metano</SelectItem>
                      <SelectItem value="Elettrico">Elettrico</SelectItem>
                      <SelectItem value="Ibrido">Ibrido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Posti</Label>
                  <Input type="number" min="1" max="9" value={formData.posti} onChange={(e) => setFormData({...formData, posti: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tariffa Giornaliera (€) *</Label>
                  <Input type="number" step="0.01" value={formData.tariffa_giornaliera} onChange={(e) => setFormData({...formData, tariffa_giornaliera: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Deposito Cauzionale (€)</Label>
                  <Input type="number" step="0.01" value={formData.deposito_cauzionale} onChange={(e) => setFormData({...formData, deposito_cauzionale: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Km Attuali</Label>
                  <Input type="number" value={formData.km_attuali} onChange={(e) => setFormData({...formData, km_attuali: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Km Inclusi/giorno</Label>
                  <Input type="number" value={formData.km_inclusi_giorno} onChange={(e) => setFormData({...formData, km_inclusi_giorno: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Prezzo Km Extra (€)</Label>
                  <Input type="number" step="0.01" value={formData.prezzo_km_extra} onChange={(e) => setFormData({...formData, prezzo_km_extra: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Immagine Veicolo</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  {imagePreview ? (
                    <div className="relative">
                      <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 w-8 h-8"
                        onClick={removeImage}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500 mb-2">Carica un'immagine del veicolo</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="vehicle-image"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                            Caricamento...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Seleziona File
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">Formati supportati: JPG, PNG, WebP. Max 5MB</p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={saving}>
                  {saving ? 'Salvataggio...' : 'Salva'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Cerca per marca, modello o targa..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Stato" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
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
                    <TableHead>Dettagli</TableHead>
                    <TableHead>Tariffa</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-12 rounded-lg overflow-hidden bg-slate-100">
                            <img src={v.image_url || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=200'} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="font-medium">{v.marca} {v.modello}</p>
                            <p className="text-xs text-slate-500">{v.anno} • {v.colore}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{v.targa}</TableCell>
                      <TableCell>
                        <p className="text-sm">{v.cambio} • {v.alimentazione}</p>
                        <p className="text-xs text-slate-500">{v.posti} posti • {v.km_attuali} km</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold">€{v.tariffa_giornaliera}/g</p>
                        <p className="text-xs text-slate-500">Dep: €{v.deposito_cauzionale}</p>
                      </TableCell>
                      <TableCell>
                        <Select value={v.status} onValueChange={(s) => handleStatusChange(v.id, s)}>
                          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusLabels).map(([k, val]) => <SelectItem key={k} value={k}>{val.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(v)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(v.id)}>
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
