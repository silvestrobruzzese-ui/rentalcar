import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { FileText, Search, Eye, Download, CheckCircle, Printer } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const statusLabels = {
  draft: 'Bozza',
  signed: 'Firmato',
  completed: 'Completato'
};

export default function ContractsPage() {
  const { token, isAdmin } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedContract, setSelectedContract] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchContracts = async () => {
    try {
      const response = await axios.get(`${API}/contracts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContracts(response.data);
    } catch (error) {
      toast.error('Errore nel caricamento dei contratti');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContracts(); }, [token]);

  const filteredContracts = contracts.filter(c => {
    const matchesSearch = `${c.user_name} ${c.vehicle_brand} ${c.vehicle_model}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (contract) => {
    setSelectedContract(contract);
    setDetailsOpen(true);
  };

  const handleDownloadPDF = async (contractId) => {
    try {
      const response = await axios.get(`${API}/contracts/${contractId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contratto_${contractId.slice(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF scaricato');
    } catch (error) {
      toast.error('Errore durante il download');
    }
  };

  const handleSignContract = async (contractId) => {
    try {
      await axios.patch(`${API}/contracts/${contractId}/sign`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Contratto firmato');
      fetchContracts();
    } catch (error) {
      toast.error('Errore durante la firma');
    }
  };

  return (
    <div className="space-y-6" data-testid="contracts-page">
      <div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
          {isAdmin ? 'Gestione Contratti' : 'I miei Contratti'}
        </h2>
        <p className="text-slate-500">{isAdmin ? 'Visualizza e gestisci tutti i contratti' : 'Visualizza i tuoi contratti di noleggio'}</p>
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
                data-testid="search-contracts"
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
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>Nessun contratto trovato</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N. Contratto</TableHead>
                    {isAdmin && <TableHead>Cliente</TableHead>}
                    <TableHead>Veicolo</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Totale</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract) => (
                    <TableRow key={contract.id} data-testid={`contract-row-${contract.id}`}>
                      <TableCell className="font-mono text-sm">{contract.id.slice(0, 8).toUpperCase()}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">{contract.user_name}</p>
                            <p className="text-sm text-slate-500">{contract.user_email}</p>
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <p className="font-medium">{contract.vehicle_brand} {contract.vehicle_model}</p>
                        <p className="text-sm text-slate-500">{contract.vehicle_plate}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{contract.pickup_date}</p>
                        <p className="text-sm text-slate-500">→ {contract.return_date}</p>
                      </TableCell>
                      <TableCell className="font-semibold">€{contract.total_price.toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={`status-badge ${contract.status === 'signed' ? 'status-confirmed' : contract.status === 'completed' ? 'status-completed' : 'status-pending'}`}>
                          {statusLabels[contract.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetails(contract)} data-testid={`view-contract-${contract.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDownloadPDF(contract.id)} title="Scarica PDF" data-testid={`download-contract-${contract.id}`}>
                            <Download className="w-4 h-4 text-blue-600" />
                          </Button>
                          {contract.status === 'draft' && (
                            <Button variant="ghost" size="sm" onClick={() => handleSignContract(contract.id)} title="Firma contratto" data-testid={`sign-contract-${contract.id}`}>
                              <CheckCircle className="w-4 h-4 text-green-600" />
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>Dettagli Contratto</DialogTitle>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-4 mt-4">
              <div className="flex justify-between items-center p-3 bg-slate-100 rounded-lg">
                <span className="font-mono text-sm">N. {selectedContract.id.slice(0, 8).toUpperCase()}</span>
                <span className={`status-badge ${selectedContract.status === 'signed' ? 'status-confirmed' : selectedContract.status === 'completed' ? 'status-completed' : 'status-pending'}`}>
                  {statusLabels[selectedContract.status]}
                </span>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Cliente</h4>
                <p>{selectedContract.user_name}</p>
                <p className="text-sm text-slate-500">{selectedContract.user_email}</p>
                {selectedContract.user_phone && <p className="text-sm text-slate-500">Tel: {selectedContract.user_phone}</p>}
                {selectedContract.user_license && <p className="text-sm text-slate-500">Patente: {selectedContract.user_license}</p>}
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Veicolo</h4>
                <p>{selectedContract.vehicle_brand} {selectedContract.vehicle_model}</p>
                <p className="text-sm text-slate-500">Targa: {selectedContract.vehicle_plate}</p>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">Periodo</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-slate-500">Ritiro</p>
                    <p>{selectedContract.pickup_date}</p>
                    <p className="text-slate-500">{selectedContract.pickup_location}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Riconsegna</p>
                    <p>{selectedContract.return_date}</p>
                    <p className="text-slate-500">{selectedContract.return_location}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span>Totale Noleggio</span>
                  <span className="font-semibold">€{selectedContract.total_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-slate-600">
                  <span>Deposito Cauzionale</span>
                  <span>€{selectedContract.deposit.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleDownloadPDF(selectedContract.id)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Scarica PDF
                </Button>
                {selectedContract.status === 'draft' && (
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => { handleSignContract(selectedContract.id); setDetailsOpen(false); }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Firma
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
