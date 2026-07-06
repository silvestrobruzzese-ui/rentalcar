import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Printer, ArrowLeft, Save, Edit2, X, Download, Loader2, Car } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { addDays, format, parseISO } from 'date-fns';

const API = process.env.REACT_APP_BACKEND_URL;

// Helper per formattare la data in DD/MM/YYYY
const formatDateIT = (dateStr) => {
  if (!dateStr) return '';
  // Se è già in formato DD/MM/YYYY, restituisci così com'è
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  // Se è in formato YYYY-MM-DD, converti
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

// ============ DISEGNO VEICOLO - IMMAGINI ORIGINALI ============

const VeicoloSchemaCompleto = () => (
  <div className="vehicle-schema bg-white">
    <div className="grid grid-cols-2 gap-2">
      <div className="border border-dashed border-gray-300 rounded p-2 bg-white">
        <img 
          src="/images/vista_laterale.png"
          alt="Vista laterale / frontale"
          className="w-full h-auto"
          style={{ maxHeight: '200px', objectFit: 'contain' }}
        />
        <div className="text-center text-[8px] text-gray-500 mt-1">Vista laterale / frontale</div>
      </div>
      <div className="border border-dashed border-gray-300 rounded p-2 bg-white">
        <img 
          src="/images/vista_alto.png"
          alt="Vista dall'alto / interni"
          className="w-full h-auto"
          style={{ maxHeight: '200px', objectFit: 'contain' }}
        />
        <div className="text-center text-[8px] text-gray-500 mt-1">Vista dall'alto / interni</div>
      </div>
    </div>
  </div>
);

// ============ COMPONENTE PRINCIPALE ============
export default function ContrattoStampaPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [prenotazione, setPrenotazione] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [veicoli, setVeicoli] = useState([]);
  const [serviziDisponibili, setServiziDisponibili] = useState([]);
  const contractRef = useRef(null);
  
  // Dati agenzia FISSI per il contratto (come da richiesta)
  const AGENCY = {
    nome: "SOVERATO RENTAL by RE.LE.CO GROUP",
    indirizzo: "Via Giordano Bruno 81",
    cap: "88068",
    comune: "Soverato",
    provincia: "CZ",
    regione: "CALABRIA",
    piva: "03406230791",
    cf: "03406230791",
    telefono: "3342370420",
    email: "giannibruzzese@gmail.com"
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    const fetchData = async () => {
      try {
        // Fetch prenotazione
        const prenotazioneRes = await axios.get(`${API}/api/prenotazioni/${id}`, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        setPrenotazione(prenotazioneRes.data);
        setEditedData(prenotazioneRes.data);
        
        // Auto-populate km_uscita with last registered km of the vehicle (from previous checkouts)
        // Only if km_uscita is not already set on this booking
        if (prenotazioneRes.data.veicolo_id && !prenotazioneRes.data.km_uscita) {
          try {
            const vRes = await axios.get(`${API}/api/vehicles/${prenotazioneRes.data.veicolo_id}`);
            const ultimiKm = vRes.data?.km_attuali;
            if (ultimiKm !== undefined && ultimiKm !== null) {
              setEditedData(prev => ({ ...prev, km_uscita: String(ultimiKm) }));
            }
          } catch (e) {
            console.warn('Impossibile caricare km veicolo:', e);
          }
        }
        
        // Fetch cliente
        if (prenotazioneRes.data.cliente_id) {
          const clienteRes = await axios.get(`${API}/api/clienti/${prenotazioneRes.data.cliente_id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setCliente(clienteRes.data);
        }
        
        // Fetch veicoli disponibili per il dropdown
        const veicoliRes = await axios.get(`${API}/api/vehicles`);
        setVeicoli(veicoliRes.data || []);
        
        const serviziRes = await axios.get(`${API}/api/servizi-supplementari`);
        setServiziDisponibili(serviziRes.data || []);
        
      } catch (error) {
        console.error('Errore:', error);
        if (error.response?.status === 401) navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, token, navigate]);

  const handlePrint = async () => {
    // Generate clean PDF and open for printing (no browser headers/footers)
    const contractElement = contractRef.current;
    if (!contractElement) return;
    
    try {
      const pages = contractElement.querySelectorAll('[data-page]');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
      }
      
      // Open PDF in new window and trigger print
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(pdfUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => printWindow.print(), 500);
        };
      }
    } catch (error) {
      console.error('Print error:', error);
      // Fallback to direct print
      window.print();
    }
  };

  const handleDownloadPDF = async () => {
    if (!contractRef.current) return;
    
    setGeneratingPdf(true);
    toast.info('Generazione PDF in corso... Attendere il caricamento delle immagini.');
    
    try {
      // Hide toolbar
      const toolbar = document.querySelector('.print\\:hidden');
      if (toolbar) toolbar.style.display = 'none';

      // Wait for all images to load
      const images = contractRef.current.querySelectorAll('img');
      await Promise.all([...images].map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          // Timeout after 5 seconds
          setTimeout(resolve, 5000);
        });
      }));
      
      // Small delay to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get all pages inside the contract
      const contractElement = contractRef.current;
      const pages = contractElement.querySelectorAll('[data-page]');
      
      // Create PDF with A4 dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = 210; // A4 width in mm
      const pdfHeight = 297; // A4 height in mm
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        
        // Capture each page with high quality
        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 15000
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        // Calculate dimensions maintaining aspect ratio
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        if (i > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pdfHeight));
      }
      
      // Download the PDF
      pdf.save(`contratto_${prenotazione.veicolo_targa}_${prenotazione.data_ritiro}.pdf`);
      toast.success('PDF scaricato con successo!');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Errore nella generazione del PDF');
    } finally {
      // Restore toolbar
      const toolbar = document.querySelector('.print\\:hidden');
      if (toolbar) toolbar.style.display = '';

      setGeneratingPdf(false);
    }
  };

  const handleSaveEdits = async () => {
    try {
      // Prepara TUTTI i campi modificabili del contratto
      const updatePayload = {
        contratto_check_in: editedData.contratto_check_in,
        contratto_check_out: editedData.contratto_check_out,
        data_ritiro: editedData.data_ritiro,
        ora_ritiro: editedData.ora_ritiro,
        data_riconsegna: editedData.data_riconsegna,
        ora_riconsegna: editedData.ora_riconsegna,
        durata_giorni: editedData.durata_giorni,
        km_uscita: editedData.km_uscita,
        km_inclusi_totali: editedData.km_inclusi_totali,
        prezzo_km_extra: editedData.prezzo_km_extra,
        tacche_carburante_uscita: editedData.tacche_carburante_uscita,
        danni_preesistenti: editedData.danni_preesistenti,
        veicolo_colore: editedData.veicolo_colore,
        veicolo_cambio: editedData.veicolo_cambio,
        veicolo_alimentazione: editedData.veicolo_alimentazione,
        veicolo_marca: editedData.veicolo_marca,
        veicolo_modello: editedData.veicolo_modello,
        veicolo_targa: editedData.veicolo_targa,
        tariffa_base: editedData.tariffa_base,
        totale_servizi: editedData.totale_servizi,
        servizi_supplementari: editedData.servizi_supplementari,
        conducenti_aggiuntivi: editedData.conducenti_aggiuntivi,
        totale_franchigie: editedData.totale_franchigie,
        acconto: editedData.acconto,
        deposito_cauzionale: editedData.deposito_cauzionale,
        luogo_ritiro: editedData.luogo_ritiro,
        indirizzo_ritiro: editedData.indirizzo_ritiro,
        luogo_riconsegna: editedData.luogo_riconsegna,
        indirizzo_riconsegna: editedData.indirizzo_riconsegna,
        note: editedData.note,
        // Dati cliente editabili nel contratto
        cliente_dati_contratto: editedData.cliente_dati_contratto,
        // CARTA DI CREDITO
        carta_circuito: editedData.carta_circuito,
        carta_intestatario: editedData.carta_intestatario,
        carta_numero: editedData.carta_numero,
        carta_scadenza_mese: editedData.carta_scadenza_mese,
        carta_scadenza_anno: editedData.carta_scadenza_anno,
        // GARANTE
        garante_nome: editedData.garante_nome,
        garante_recapiti: editedData.garante_recapiti,
        garante_documento: editedData.garante_documento,
        // METODO PAGAMENTO
        pagamento_contanti: editedData.pagamento_contanti,
        pagamento_carta: editedData.pagamento_carta,
        pagamento_bonifico: editedData.pagamento_bonifico,
        pagamento_altro: editedData.pagamento_altro,
        pagamento_altro_desc: editedData.pagamento_altro_desc,
        // TARIFFA STAGIONALE
        tariffa_giornaliera: editedData.tariffa_giornaliera,
        tariffa_stagionale: editedData.tariffa_stagionale,
        // RIENTRO
        rientro_data: editedData.rientro_data,
        rientro_ora: editedData.rientro_ora,
        rientro_km_entrata: editedData.rientro_km_entrata,
        rientro_km_percorsi: editedData.rientro_km_percorsi,
        rientro_km_eccedenza: editedData.rientro_km_eccedenza,
        rientro_importo_km_eccedenza: editedData.rientro_importo_km_eccedenza,
        rientro_tacche_carburante: editedData.rientro_tacche_carburante,
        // ADDEBITI RIENTRO
        addebito_danni: editedData.addebito_danni,
        addebito_gestione_danni: editedData.addebito_gestione_danni,
        addebito_carburante: editedData.addebito_carburante,
        addebito_pulizia: editedData.addebito_pulizia,
        addebito_altro: editedData.addebito_altro,
        totale_addebiti_rientro: editedData.totale_addebiti_rientro,
        // FRANCHIGIE INCLUSE/ESCLUSE
        franchigia_kasko: editedData.franchigia_kasko,
        franchigia_sinistro: editedData.franchigia_sinistro,
        scoperto_furto: editedData.scoperto_furto,
        franchigia_kasko_inclusa: editedData.franchigia_kasko_inclusa,
        franchigia_sinistro_inclusa: editedData.franchigia_sinistro_inclusa
      };
      
      await axios.put(`${API}/api/prenotazioni/${id}/admin-update`, updatePayload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPrenotazione({...prenotazione, ...updatePayload});
      setIsEditing(false);
      toast.success('Modifiche salvate!');
    } catch (error) {
      console.error('Errore salvataggio:', error);
      toast.error('Errore nel salvataggio');
    }
  };

  const updateField = (field, value) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  // Funzione per cambiare la durata del noleggio e aggiornare date + prezzi
  const handleDurataChange = async (newDurata) => {
    const durata = parseInt(newDurata) || 1;
    const dataRitiro = editedData.data_ritiro || prenotazione.data_ritiro;
    
    // Calcola nuova data riconsegna
    let nuovaDataRiconsegna = dataRitiro;
    try {
      const ritiroDate = parseISO(dataRitiro);
      nuovaDataRiconsegna = format(addDays(ritiroDate, durata), 'yyyy-MM-dd');
    } catch (e) {
      console.error('Error parsing date:', e);
    }
    
    // Fetch tariffa stagionale per il nuovo periodo
    const veicoloId = editedData.veicolo_id || prenotazione.veicolo_id;
    let tariffaGiornaliera = editedData.tariffa_giornaliera || prenotazione.tariffa_giornaliera || 50;
    let tariffaStagionaleInfo = editedData.tariffa_stagionale || prenotazione.tariffa_stagionale || null;
    
    try {
      const res = await axios.get(`${API}/api/calcola-prezzo-dinamico`, {
        params: {
          veicolo_id: veicoloId,
          data_inizio: dataRitiro,
          data_fine: nuovaDataRiconsegna
        }
      });
      tariffaGiornaliera = res.data.tariffa_giornaliera;
      if (res.data.tariffa_applicata !== 'base') {
        tariffaStagionaleInfo = {
          nome: res.data.nome_tariffa,
          tariffa_giornaliera: res.data.tariffa_giornaliera,
          periodo: res.data.periodo,
          tipo: res.data.tariffa_applicata
        };
      } else {
        tariffaStagionaleInfo = null;
      }
    } catch (e) {
      console.error('Error fetching seasonal rate:', e);
    }
    
    const nuovaTariffaBase = tariffaGiornaliera * durata;
    const kmInclusiGiorno = editedData.km_inclusi_giorno || prenotazione.km_inclusi_giorno || 200;
    const nuoviKmInclusi = kmInclusiGiorno * durata;
    
    setEditedData(prev => ({
      ...prev,
      durata_giorni: durata,
      data_riconsegna: nuovaDataRiconsegna,
      tariffa_giornaliera: tariffaGiornaliera,
      tariffa_stagionale: tariffaStagionaleInfo,
      tariffa_base: nuovaTariffaBase,
      km_inclusi_totali: nuoviKmInclusi,
      totale_noleggio: nuovaTariffaBase + (prev.totale_servizi || 0)
    }));
    
    toast.info(`Durata aggiornata: ${durata} giorni → Riconsegna: ${formatDateIT(nuovaDataRiconsegna)} | €${tariffaGiornaliera}/gg`);
  };

  // Funzione per cambiare la data di ritiro e ricalcolare tutto
  const handleDataRitiroChange = async (newDataRitiro) => {
    const durata = editedData.durata_giorni || prenotazione.durata_giorni || 1;
    let nuovaDataRiconsegna = newDataRitiro;
    try {
      const ritiroDate = parseISO(newDataRitiro);
      nuovaDataRiconsegna = format(addDays(ritiroDate, durata), 'yyyy-MM-dd');
    } catch (e) {
      console.error('Error parsing date:', e);
    }
    
    // Fetch tariffa stagionale per il nuovo periodo
    const veicoloId = editedData.veicolo_id || prenotazione.veicolo_id;
    let tariffaGiornaliera = editedData.tariffa_giornaliera || prenotazione.tariffa_giornaliera || 50;
    let tariffaStagionaleInfo = editedData.tariffa_stagionale || prenotazione.tariffa_stagionale || null;
    
    try {
      const res = await axios.get(`${API}/api/calcola-prezzo-dinamico`, {
        params: {
          veicolo_id: veicoloId,
          data_inizio: newDataRitiro,
          data_fine: nuovaDataRiconsegna
        }
      });
      tariffaGiornaliera = res.data.tariffa_giornaliera;
      if (res.data.tariffa_applicata !== 'base') {
        tariffaStagionaleInfo = {
          nome: res.data.nome_tariffa,
          tariffa_giornaliera: res.data.tariffa_giornaliera,
          periodo: res.data.periodo,
          tipo: res.data.tariffa_applicata
        };
      } else {
        tariffaStagionaleInfo = null;
      }
    } catch (e) {
      console.error('Error fetching seasonal rate:', e);
    }
    
    const nuovaTariffaBase = tariffaGiornaliera * durata;
    
    setEditedData(prev => ({
      ...prev,
      data_ritiro: newDataRitiro,
      data_riconsegna: nuovaDataRiconsegna,
      tariffa_giornaliera: tariffaGiornaliera,
      tariffa_stagionale: tariffaStagionaleInfo,
      tariffa_base: nuovaTariffaBase,
      totale_noleggio: nuovaTariffaBase + (prev.totale_servizi || 0)
    }));
  };

  // Funzione per cambiare veicolo e aggiornare automaticamente tutti i costi
  const handleVeicoloChange = (veicoloId) => {
    const veicolo = veicoli.find(v => v.id === veicoloId);
    if (!veicolo) return;
    
    const durata = editedData.durata_giorni || prenotazione.durata_giorni || 1;
    const tariffaGiornaliera = veicolo.tariffa_giornaliera || veicolo.base_price || 50;
    const kmInclusiGiorno = veicolo.km_inclusi_giorno || 200;
    const prezzoKmExtra = veicolo.prezzo_km_extra || 0.20;
    const depositoCauzionale = veicolo.deposito_cauzionale || 500;
    
    // Calcola nuova tariffa base
    const nuovaTariffaBase = tariffaGiornaliera * durata;
    const nuoviKmInclusi = kmInclusiGiorno * durata;
    
    // Aggiorna tutti i campi del veicolo e i costi
    setEditedData(prev => ({
      ...prev,
      veicolo_id: veicoloId,
      veicolo_marca: veicolo.marca,
      veicolo_modello: veicolo.modello,
      veicolo_targa: veicolo.targa,
      veicolo_colore: veicolo.colore || '',
      veicolo_cambio: veicolo.cambio || '',
      veicolo_alimentazione: veicolo.alimentazione || '',
      tariffa_giornaliera: tariffaGiornaliera,
      tariffa_base: nuovaTariffaBase,
      km_inclusi_giorno: kmInclusiGiorno,
      km_inclusi_totali: nuoviKmInclusi,
      prezzo_km_extra: prezzoKmExtra,
      deposito_cauzionale: depositoCauzionale,
      totale_noleggio: nuovaTariffaBase + (prev.totale_servizi || 0)
    }));
    
    toast.success(`Veicolo cambiato: ${veicolo.marca} ${veicolo.modello} - €${tariffaGiornaliera}/giorno`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!prenotazione) {
    return <div className="p-8 text-center text-red-600">Prenotazione non trovata</div>;
  }

  const p = isEditing ? editedData : prenotazione;
  const patente = cliente?.patente || {};
  const today = new Date().toLocaleDateString('it-IT');
  
  // Dati cliente per contratto (possono essere sovrascritti)
  const clienteContratto = p.cliente_dati_contratto || cliente || {};
  const updateClienteField = (field, value) => {
    const current = editedData.cliente_dati_contratto || { ...cliente };
    setEditedData(prev => ({
      ...prev,
      cliente_dati_contratto: { ...current, [field]: value }
    }));
  };
  const updateClientePatenteField = (field, value) => {
    const current = editedData.cliente_dati_contratto || { ...cliente };
    const currentPatente = current.patente || { ...patente };
    setEditedData(prev => ({
      ...prev,
      cliente_dati_contratto: { 
        ...current, 
        patente: { ...currentPatente, [field]: value }
      }
    }));
  };
  const patenteContratto = clienteContratto?.patente || patente;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* TOOLBAR - nascosta in stampa */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b shadow-sm p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Torna Indietro
          </Button>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-2" /> Annulla
                </Button>
                <Button onClick={handleSaveEdits} className="bg-green-600 hover:bg-green-700">
                  <Save className="w-4 h-4 mr-2" /> Salva Modifiche
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit2 className="w-4 h-4 mr-2" /> Modifica Contratto
                </Button>
                <Button onClick={handleDownloadPDF} variant="outline" disabled={generatingPdf}>
                  {generatingPdf ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generazione...</>
                  ) : (
                    <><Download className="w-4 h-4 mr-2" /> Scarica PDF</>
                  )}
                </Button>
                <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
                  <Printer className="w-4 h-4 mr-2" /> Stampa Contratto
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* CONTRATTO - Formato A4 */}
      <div ref={contractRef} className="max-w-[210mm] mx-auto bg-white print:max-w-none print:mx-0 shadow-lg print:shadow-none">
        
        {/* ========== PAGINA 1/4 ========== */}
        <div data-page="1" className="p-6" style={{ pageBreakAfter: 'always' }}>
          
          {/* HEADER */}
          <div className="border-b-2 border-gray-400 pb-2 mb-3">
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-3">
                <img src="/images/logo_agenzia.png" alt="Logo" className="mt-0.5" style={{ width: '45px', height: 'auto', objectFit: 'contain' }} onError={e => e.target.style.display='none'} />
                <div>
                  <h1 className="text-lg font-bold tracking-wide" style={{ fontFamily: 'Arial Black, sans-serif' }}>{AGENCY.nome}</h1>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {AGENCY.indirizzo}, {AGENCY.cap} {AGENCY.comune} {AGENCY.provincia}
                  </p>
                  <p className="text-xs text-gray-600">
                    P.iva {AGENCY.piva}  CF {AGENCY.cf}
                  </p>
                  <p className="text-xs text-gray-600">
                    Tel. {AGENCY.telefono}  Email:{AGENCY.email} - Soverato.rental@libero.it
                  </p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold" style={{ fontFamily: 'Arial Black, sans-serif', color: '#1a2744' }}>CONTRATTO</h2>
                <p className="text-sm text-gray-500">Pag. 1/3</p>
              </div>
            </div>
          </div>

          {/* RIGA DATI CONTRATTO */}
          <div className="border border-black mb-2">
            <div className="text-xs font-bold bg-gray-200 px-2 py-1 border-b border-black">
              CONTRATTO DI NOLEGGIO
            </div>
            <div className="grid grid-cols-5 text-xs">
              <div className="border-r border-black p-2">
                <div className="text-gray-600">Data stipula:</div>
                <div className="font-semibold">{today}</div>
              </div>
              <div className="border-r border-black p-2">
                <div className="text-gray-600">Dal:</div>
                {isEditing ? (
                  <div className="flex flex-col gap-1">
                    <Input type="date" value={p.data_ritiro} onChange={e => handleDataRitiroChange(e.target.value)} className="h-6 text-xs w-full" />
                    <Input type="time" value={p.ora_ritiro} onChange={e => updateField('ora_ritiro', e.target.value)} className="h-6 text-xs w-full" />
                  </div>
                ) : (
                  <div className="font-semibold">{formatDateIT(p.data_ritiro)} {p.ora_ritiro}</div>
                )}
              </div>
              <div className="border-r border-black p-2">
                <div className="text-gray-600">al:</div>
                {isEditing ? (
                  <div className="flex flex-col gap-1">
                    <Input type="date" value={p.data_riconsegna} onChange={e => updateField('data_riconsegna', e.target.value)} className="h-6 text-xs w-full" />
                    <Input type="time" value={p.ora_riconsegna} onChange={e => updateField('ora_riconsegna', e.target.value)} className="h-6 text-xs w-full" />
                  </div>
                ) : (
                  <div className="font-semibold">{formatDateIT(p.data_riconsegna)} {p.ora_riconsegna}</div>
                )}
              </div>
              <div className="border-r border-black p-2">
                <div className="text-gray-600">Durata:</div>
                {isEditing ? (
                  <Input type="number" min="1" value={p.durata_giorni} onChange={e => handleDurataChange(e.target.value)} className="h-6 text-xs w-16" />
                ) : (
                  <div className="font-semibold">{p.durata_giorni} gg</div>
                )}
              </div>
              <div className="p-2">
                <div className="text-gray-600">Targa:</div>
                {isEditing ? (
                  <Input value={p.veicolo_targa} onChange={e => updateField('veicolo_targa', e.target.value.toUpperCase())} className="h-6 text-xs font-bold" />
                ) : (
                  <div className="font-bold text-lg">{p.veicolo_targa}</div>
                )}
              </div>
            </div>
          </div>

          {/* I. PARTI DEL CONTRATTO */}
          <div className="border border-black mb-2">
            <div className="px-2 py-1 text-sm font-bold border-b border-black bg-gray-100">
              I. PARTI DEL CONTRATTO
            </div>
            <div className="grid grid-cols-2">
              {/* Locatore */}
              <div className="border-r border-black p-3">
                <div className="font-bold text-xs mb-2 bg-gray-100 -mx-3 -mt-3 px-3 py-1 border-b border-black">
                  Locatore / Noleggiatore
                </div>
                <div className="text-xs space-y-1">
                  <p><span className="text-gray-600">Ragione sociale:</span> <strong>{AGENCY.nome}</strong></p>
                  <p><span className="text-gray-600">Indirizzo:</span> {AGENCY.indirizzo} - {AGENCY.cap} {AGENCY.comune} ({AGENCY.provincia})</p>
                  <p><span className="text-gray-600">P.IVA:</span> {AGENCY.piva}</p>
                  <p><span className="text-gray-600">Contatti:</span> Tel. {AGENCY.telefono}</p>
                  <p><span className="text-gray-600">Email:</span> {AGENCY.email} - soverato.rental@libero.it</p>
                </div>
              </div>
              {/* Locatario */}
              <div className="p-2">
                <div className="font-bold text-xs mb-2 bg-gray-100 -mx-3 -mt-3 px-3 py-1 border-b border-black">
                  Locatario / Cliente
                </div>
                <div className="text-xs space-y-1">
                  <p><span className="text-gray-600">Tipologia:</span> Persona Fisica</p>
                  <p>
                    <span className="text-gray-600">Denominazione:</span>{' '}
                    {isEditing ? (
                      <span className="inline-flex gap-1">
                        <Input value={clienteContratto?.nome || ''} onChange={e => updateClienteField('nome', e.target.value)} className="h-5 text-xs w-24 inline" placeholder="Nome" />
                        <Input value={clienteContratto?.cognome || ''} onChange={e => updateClienteField('cognome', e.target.value)} className="h-5 text-xs w-24 inline" placeholder="Cognome" />
                      </span>
                    ) : (
                      <strong>{clienteContratto?.nome} {clienteContratto?.cognome}</strong>
                    )}
                  </p>
                  <p>
                    <span className="text-gray-600">CF / P.IVA:</span>{' '}
                    {isEditing ? (
                      <Input value={clienteContratto?.codice_fiscale || ''} onChange={e => updateClienteField('codice_fiscale', e.target.value.toUpperCase())} className="h-5 text-xs w-40 inline" />
                    ) : (
                      clienteContratto?.codice_fiscale
                    )}
                  </p>
                  <p>
                    <span className="text-gray-600">Indirizzo / Sede legale:</span>{' '}
                    {isEditing ? (
                      <span className="inline-flex gap-1 flex-wrap">
                        <Input value={clienteContratto?.indirizzo || ''} onChange={e => updateClienteField('indirizzo', e.target.value)} className="h-5 text-xs w-32 inline" placeholder="Indirizzo" />
                        <Input value={clienteContratto?.cap || ''} onChange={e => updateClienteField('cap', e.target.value)} className="h-5 text-xs w-14 inline" placeholder="CAP" />
                        <Input value={clienteContratto?.comune || ''} onChange={e => updateClienteField('comune', e.target.value)} className="h-5 text-xs w-24 inline" placeholder="Comune" />
                        <Input value={clienteContratto?.provincia || ''} onChange={e => updateClienteField('provincia', e.target.value)} className="h-5 text-xs w-10 inline" placeholder="Prov" />
                      </span>
                    ) : (
                      <span>{clienteContratto?.indirizzo}, {clienteContratto?.cap} {clienteContratto?.comune} ({clienteContratto?.provincia})</span>
                    )}
                  </p>
                  <p>
                    <span className="text-gray-600">Telefono:</span>{' '}
                    {isEditing ? (
                      <Input 
                        value={clienteContratto?.cellulare || clienteContratto?.telefono || ''} 
                        onChange={e => updateClienteField('cellulare', e.target.value)} 
                        className="h-5 text-xs w-32 inline" 
                        placeholder="Cellulare / Telefono" 
                        data-testid="input-cliente-telefono"
                      />
                    ) : (
                      <strong>{clienteContratto?.cellulare || clienteContratto?.telefono || '—'}</strong>
                    )}
                  </p>
                  <p>
                    <span className="text-gray-600">Email:</span>{' '}
                    {isEditing ? (
                      <Input 
                        value={clienteContratto?.email || ''} 
                        onChange={e => updateClienteField('email', e.target.value)} 
                        className="h-5 text-xs w-48 inline" 
                        placeholder="email@esempio.com" 
                        data-testid="input-cliente-email"
                      />
                    ) : (
                      <span>{clienteContratto?.email || '—'}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* II. CONDUCENTI AUTORIZZATI */}
          <div className="border border-black mb-2">
            <div className="px-2 py-1 text-sm font-bold border-b border-black bg-gray-100">
              II. CONDUCENTI AUTORIZZATI
            </div>
            <div className="p-2">
              <div className="font-bold text-xs mb-2">Conducente principale</div>
              <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                <div>
                  <span className="text-gray-600">Cognome:</span>{' '}
                  {isEditing ? (
                    <Input value={clienteContratto?.cognome || ''} onChange={e => updateClienteField('cognome', e.target.value)} className="h-5 text-xs w-20 inline" />
                  ) : (
                    <strong>{clienteContratto?.cognome}</strong>
                  )}
                </div>
                <div>
                  <span className="text-gray-600">Nome:</span>{' '}
                  {isEditing ? (
                    <Input value={clienteContratto?.nome || ''} onChange={e => updateClienteField('nome', e.target.value)} className="h-5 text-xs w-20 inline" />
                  ) : (
                    <strong>{clienteContratto?.nome}</strong>
                  )}
                </div>
                <div>
                  <span className="text-gray-600">Nascita:</span>{' '}
                  {isEditing ? (
                    <span className="inline-flex gap-1">
                      <Input value={clienteContratto?.luogo_nascita || ''} onChange={e => updateClienteField('luogo_nascita', e.target.value)} className="h-5 text-xs w-16 inline" placeholder="Luogo" />
                      <Input type="date" value={clienteContratto?.data_nascita || ''} onChange={e => updateClienteField('data_nascita', e.target.value)} className="h-5 text-xs w-24 inline" />
                    </span>
                  ) : (
                    <span>{clienteContratto?.luogo_nascita}, {formatDateIT(clienteContratto?.data_nascita)}</span>
                  )}
                </div>
                <div>
                  <span className="text-gray-600">Cod. fiscale:</span>{' '}
                  {isEditing ? (
                    <Input value={clienteContratto?.codice_fiscale || ''} onChange={e => updateClienteField('codice_fiscale', e.target.value.toUpperCase())} className="h-5 text-xs w-32 inline" />
                  ) : (
                    clienteContratto?.codice_fiscale
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <span className="text-gray-600">Residenza:</span>{' '}
                  {isEditing ? (
                    <span className="inline-flex gap-1">
                      <Input value={clienteContratto?.indirizzo || ''} onChange={e => updateClienteField('indirizzo', e.target.value)} className="h-5 text-xs w-28 inline" />
                      <Input value={clienteContratto?.comune || ''} onChange={e => updateClienteField('comune', e.target.value)} className="h-5 text-xs w-20 inline" />
                      (<Input value={clienteContratto?.provincia || ''} onChange={e => updateClienteField('provincia', e.target.value)} className="h-5 text-xs w-8 inline" />)
                    </span>
                  ) : (
                    <span>{clienteContratto?.indirizzo}, {clienteContratto?.comune} ({clienteContratto?.provincia})</span>
                  )}
                </div>
                <div>
                  <span className="text-gray-600">Patente:</span>{' '}
                  {isEditing ? (
                    <span className="inline-flex gap-1">
                      N. <Input value={patenteContratto.numero || ''} onChange={e => updateClientePatenteField('numero', e.target.value)} className="h-5 text-xs w-24 inline" />
                      Cat. <Input value={patenteContratto.categoria || ''} onChange={e => updateClientePatenteField('categoria', e.target.value)} className="h-5 text-xs w-8 inline" />
                      Scad. <Input type="date" value={patenteContratto.data_scadenza || ''} onChange={e => updateClientePatenteField('data_scadenza', e.target.value)} className="h-5 text-xs w-28 inline" />
                    </span>
                  ) : (
                    <span>N. {patenteContratto.numero} Cat. {patenteContratto.categoria} Scad. {formatDateIT(patenteContratto.data_scadenza)}</span>
                  )}
                </div>
              </div>
              
              {/* Tabella conducenti aggiuntivi */}
              <div className="font-bold text-xs mb-1 mt-3">Ulteriori conducenti autorizzati</div>
              <table className="w-full text-xs border border-black">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-1 text-left">Conducente</th>
                    <th className="border border-black p-1 text-left">Documento identità</th>
                    <th className="border border-black p-1 text-left">Nascita (luogo, data)</th>
                    <th className="border border-black p-1 text-left">Patente</th>
                    <th className="border border-black p-1 text-left">Email</th>
                    <th className="border border-black p-1 text-left">Cellulare</th>
                    {isEditing && <th className="border border-black p-1 w-8"></th>}
                  </tr>
                </thead>
                <tbody>
                  {(p.conducenti_aggiuntivi || []).map((c, i) => (
                    <tr key={i}>
                      {isEditing ? (
                        <>
                          <td className="border border-black p-0.5">
                            <div className="flex gap-0.5">
                              <Input value={c.nome || ''} onChange={e => { const arr = [...(p.conducenti_aggiuntivi||[])]; arr[i] = {...arr[i], nome: e.target.value}; updateField('conducenti_aggiuntivi', arr); }} className="h-5 text-xs" placeholder="Nome" />
                              <Input value={c.cognome || ''} onChange={e => { const arr = [...(p.conducenti_aggiuntivi||[])]; arr[i] = {...arr[i], cognome: e.target.value}; updateField('conducenti_aggiuntivi', arr); }} className="h-5 text-xs" placeholder="Cognome" />
                            </div>
                          </td>
                          <td className="border border-black p-0.5">
                            <Input value={c.codice_fiscale || ''} onChange={e => { const arr = [...(p.conducenti_aggiuntivi||[])]; arr[i] = {...arr[i], codice_fiscale: e.target.value.toUpperCase()}; updateField('conducenti_aggiuntivi', arr); }} className="h-5 text-xs" placeholder="Cod. Fiscale" />
                          </td>
                          <td className="border border-black p-0.5">
                            <div className="flex gap-0.5">
                              <Input value={c.luogo_nascita || ''} onChange={e => { const arr = [...(p.conducenti_aggiuntivi||[])]; arr[i] = {...arr[i], luogo_nascita: e.target.value}; updateField('conducenti_aggiuntivi', arr); }} className="h-5 text-xs" placeholder="Luogo" />
                              <Input type="date" value={c.data_nascita || ''} onChange={e => { const arr = [...(p.conducenti_aggiuntivi||[])]; arr[i] = {...arr[i], data_nascita: e.target.value}; updateField('conducenti_aggiuntivi', arr); }} className="h-5 text-xs w-24" />
                            </div>
                          </td>
                          <td className="border border-black p-0.5">
                            <div className="flex gap-0.5">
                              <Input value={c.patente_numero || ''} onChange={e => { const arr = [...(p.conducenti_aggiuntivi||[])]; arr[i] = {...arr[i], patente_numero: e.target.value}; updateField('conducenti_aggiuntivi', arr); }} className="h-5 text-xs" placeholder="N. Patente" />
                              <Input value={c.patente_categoria || ''} onChange={e => { const arr = [...(p.conducenti_aggiuntivi||[])]; arr[i] = {...arr[i], patente_categoria: e.target.value.toUpperCase()}; updateField('conducenti_aggiuntivi', arr); }} className="h-5 text-xs w-10" placeholder="Cat" />
                            </div>
                          </td>
                          <td className="border border-black p-0.5">
                            <Input value={c.email || ''} onChange={e => { const arr = [...(p.conducenti_aggiuntivi||[])]; arr[i] = {...arr[i], email: e.target.value}; updateField('conducenti_aggiuntivi', arr); }} className="h-5 text-xs" placeholder="Email" />
                          </td>
                          <td className="border border-black p-0.5">
                            <Input value={c.cellulare || ''} onChange={e => { const arr = [...(p.conducenti_aggiuntivi||[])]; arr[i] = {...arr[i], cellulare: e.target.value}; updateField('conducenti_aggiuntivi', arr); }} className="h-5 text-xs" placeholder="Cellulare" />
                          </td>
                          <td className="border border-black p-0.5 text-center">
                            <button onClick={() => { const arr = (p.conducenti_aggiuntivi||[]).filter((_,idx) => idx !== i); updateField('conducenti_aggiuntivi', arr); }} className="text-red-500 text-xs">✕</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="border border-black p-1">{c.nome} {c.cognome}</td>
                          <td className="border border-black p-1">{c.codice_fiscale}</td>
                          <td className="border border-black p-1">{c.luogo_nascita}, {formatDateIT(c.data_nascita)}</td>
                          <td className="border border-black p-1">{c.patente_numero} ({c.patente_categoria})</td>
                          <td className="border border-black p-1">{c.email || ''}</td>
                          <td className="border border-black p-1">{c.cellulare}</td>
                        </>
                      )}
                    </tr>
                  ))}
                  {isEditing && (
                    <tr>
                      <td colSpan="7" className="border border-black p-1 text-center">
                        <button onClick={() => { const arr = [...(p.conducenti_aggiuntivi||[]), {nome:'',cognome:'',codice_fiscale:'',luogo_nascita:'',data_nascita:'',patente_numero:'',patente_categoria:'B',email:'',cellulare:''}]; updateField('conducenti_aggiuntivi', arr); }} className="text-blue-600 hover:text-blue-800 text-xs font-medium">+ Aggiungi conducente</button>
                      </td>
                    </tr>
                  )}
                  {!isEditing && (p.conducenti_aggiuntivi?.length || 0) === 0 && (
                    <tr><td colSpan="5" className="border border-black p-1"></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* III. VEICOLO OGGETTO DEL NOLEGGIO */}
          <div className="border border-black mb-2">
            <div className="px-2 py-1 text-sm font-bold border-b border-black bg-gray-100">
              III. VEICOLO OGGETTO DEL NOLEGGIO
            </div>
            <div className="grid grid-cols-3 gap-0">
              {/* Dati veicolo */}
              <div className="p-2 border-r border-black">
                <div className="text-xs space-y-2">
                  {/* DROPDOWN SELEZIONE VEICOLO - Solo in edit mode */}
                  {isEditing && (
                    <div className="mb-1 p-1 bg-blue-50 rounded border border-blue-200">
                      <div className="flex items-center gap-1 text-blue-700 font-medium mb-1">
                        <Car className="w-3 h-3" />
                        <span>Cambia Veicolo</span>
                      </div>
                      <Select onValueChange={handleVeicoloChange} value={p.veicolo_id || ''}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Seleziona altro veicolo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {veicoli.map(v => (
                            <SelectItem key={v.id} value={v.id} className="text-xs">
                              {v.marca} {v.modello} ({v.targa}) - €{v.tariffa_giornaliera || v.base_price}/gg
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-blue-600 mt-1">I costi verranno aggiornati automaticamente</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2">
                    <span className="text-gray-600">Marca / Modello:</span>
                    {isEditing ? (
                      <span className="inline-flex gap-1">
                        <Input value={p.veicolo_marca || ''} onChange={e => updateField('veicolo_marca', e.target.value)} className="h-5 text-xs w-16" />
                        <Input value={p.veicolo_modello || ''} onChange={e => updateField('veicolo_modello', e.target.value)} className="h-5 text-xs w-16" />
                      </span>
                    ) : (
                      <strong>{p.veicolo_marca} {p.veicolo_modello}</strong>
                    )}
                  </div>
                  <div className="grid grid-cols-2">
                    <span className="text-gray-600">Targa:</span>
                    {isEditing ? (
                      <Input value={p.veicolo_targa || ''} onChange={e => updateField('veicolo_targa', e.target.value.toUpperCase())} className="h-5 text-xs w-24" />
                    ) : (
                      <strong>{p.veicolo_targa}</strong>
                    )}
                  </div>
                  <div className="grid grid-cols-2">
                    <span className="text-gray-600">Colore:</span>
                    {isEditing ? <Input value={p.veicolo_colore || ''} onChange={e => updateField('veicolo_colore', e.target.value)} className="h-5 text-xs" /> : <span>{p.veicolo_colore || '_______'}</span>}
                  </div>
                  <div className="grid grid-cols-2">
                    <span className="text-gray-600">Cambio:</span>
                    {isEditing ? <Input value={p.veicolo_cambio || ''} onChange={e => updateField('veicolo_cambio', e.target.value)} className="h-5 text-xs" /> : <span>{p.veicolo_cambio || '_______'}</span>}
                  </div>
                  <div className="grid grid-cols-2">
                    <span className="text-gray-600">Alim.:</span>
                    {isEditing ? <Input value={p.veicolo_alimentazione || ''} onChange={e => updateField('veicolo_alimentazione', e.target.value)} className="h-5 text-xs" /> : <span>{p.veicolo_alimentazione || '_______'}</span>}
                  </div>
                  <div className="grid grid-cols-2">
                    <span className="text-gray-600">Tacche carburante:</span>
                    {isEditing ? <Input value={p.tacche_carburante_uscita || ''} onChange={e => updateField('tacche_carburante_uscita', e.target.value)} className="h-5 text-xs w-12" /> : <span>{p.tacche_carburante_uscita || '____'} / 8</span>}
                  </div>
                  <div className="grid grid-cols-2">
                    <span className="text-gray-600">Km uscita:</span>
                    {isEditing ? <Input value={p.km_uscita || ''} onChange={e => updateField('km_uscita', e.target.value)} className="h-5 text-xs w-20" /> : <span>{p.km_uscita || '_______'}</span>}
                  </div>
                  <div className="grid grid-cols-2">
                    <span className="text-gray-600">Km inclusi:</span>
                    {isEditing ? <Input type="number" value={p.km_inclusi_totali || ''} onChange={e => updateField('km_inclusi_totali', parseInt(e.target.value))} className="h-5 text-xs w-20" /> : <span>{p.km_inclusi_totali}</span>}
                  </div>
                </div>
              </div>
              
              {/* Schema veicolo per danni - COLONNE 2-3 */}
              <div className="col-span-2 p-2">
                <VeicoloSchemaCompleto />
              </div>
            </div>
          </div>

          {/* IV. DURATA & CHILOMETRAGGIO */}
          <div className="border border-black mb-2">
            <div className="px-2 py-1 text-sm font-bold border-b border-black bg-gray-100">
              IV. DURATA &amp; CHILOMETRAGGIO
            </div>
            <div className="grid grid-cols-3 text-xs">
              <div className="border-r border-black p-2">
                <div className="font-bold mb-1">Periodo di noleggio</div>
                <p><span className="text-gray-600">Durata:</span>{' '}{isEditing ? (<span className="inline-flex items-center gap-1"><Input type="number" min="1" value={p.durata_giorni} onChange={e => handleDurataChange(e.target.value)} className="h-5 text-xs w-12 inline" /><span>giorni</span></span>) : (<strong>{p.durata_giorni} giorni</strong>)}</p>
                <p><span className="text-gray-600">Dal:</span>{' '}{isEditing ? (<span className="inline-flex items-center gap-1"><Input type="date" value={p.data_ritiro} onChange={e => handleDataRitiroChange(e.target.value)} className="h-5 text-xs w-28 inline" /><span>ore</span><Input type="time" value={p.ora_ritiro} onChange={e => updateField('ora_ritiro', e.target.value)} className="h-5 text-xs w-16 inline" /></span>) : (<span>{formatDateIT(p.data_ritiro)} ore {p.ora_ritiro}</span>)}</p>
                <p><span className="text-gray-600">Al:</span>{' '}{isEditing ? (<span className="inline-flex items-center gap-1"><Input type="date" value={p.data_riconsegna} onChange={e => updateField('data_riconsegna', e.target.value)} className="h-5 text-xs w-28 inline" /><span>ore</span><Input type="time" value={p.ora_riconsegna} onChange={e => updateField('ora_riconsegna', e.target.value)} className="h-5 text-xs w-16 inline" /></span>) : (<span>{formatDateIT(p.data_riconsegna)} ore {p.ora_riconsegna}</span>)}</p>
              </div>
              <div className="border-r border-black p-2">
                <div className="font-bold mb-1">Chilometraggio</div>
                <p><span className="text-gray-600">Km inclusi:</span>{' '}{isEditing ? (<Select value={p.km_tipo || 'standard'} onValueChange={(v) => { updateField('km_tipo', v); if (v === 'illimitati') updateField('km_inclusi_totali', 'ILLIMITATI'); }}><SelectTrigger className="h-6 text-xs w-32 inline-flex"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Standard</SelectItem><SelectItem value="illimitati">ILLIMITATI</SelectItem></SelectContent></Select>) : null}{' '}{p.km_tipo === 'illimitati' || p.km_inclusi_totali === 'ILLIMITATI' ? (<strong className="text-green-700">KM ILLIMITATI</strong>) : isEditing ? (<Input type="number" value={p.km_inclusi_totali || ''} onChange={e => updateField('km_inclusi_totali', parseInt(e.target.value))} className="h-5 text-xs w-20 inline" />) : (<strong>{p.km_inclusi_totali} km</strong>)}</p>
                <p><span className="text-gray-600">Prezzo km extra:</span>{' '}{p.km_tipo === 'illimitati' || p.km_inclusi_totali === 'ILLIMITATI' ? (<span className="text-green-700">N/A</span>) : isEditing ? (<>€<Input type="number" step="0.01" value={p.prezzo_km_extra || ''} onChange={e => updateField('prezzo_km_extra', parseFloat(e.target.value))} className="h-5 text-xs w-16 inline" />/km</>) : (<>€{p.prezzo_km_extra}/km</>)}</p>
              </div>
              <div className="p-2 bg-gray-50">
                <div className="font-bold mb-1">Deposito &amp; acconti</div>
                <p><span className="text-gray-600">Acconto:</span>{' '}€{isEditing ? <Input type="number" step="0.01" value={p.acconto || ''} onChange={e => updateField('acconto', parseFloat(e.target.value))} className="h-5 text-xs w-20 inline" /> : (p.acconto || '_______')}</p>
                <p><span className="text-gray-600">Deposito:</span>{' '}€{isEditing ? <Input type="number" step="0.01" value={p.deposito_cauzionale || ''} onChange={e => updateField('deposito_cauzionale', parseFloat(e.target.value))} className="h-5 text-xs w-20 inline" /> : p.deposito_cauzionale}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ========== PAGINA 2/3 ========== */}
        <div data-page="2" className="p-6" style={{ pageBreakAfter: 'always' }}>
          <div className="flex justify-between items-center border-b border-black pb-1 mb-1">
            <span className="font-bold" style={{ fontFamily: 'Arial Black, sans-serif' }}>{AGENCY.nome} - CONTRATTO</span>
            <span className="text-sm text-gray-500">Pag. 2/3</span>
          </div>

          {/* V. CORRISPETTIVO & SERVIZI */}
          <div className="border border-black mb-2">
            <div className="px-2 py-1 text-sm font-bold border-b border-black bg-gray-100">
              V. CORRISPETTIVO &amp; SERVIZI
            </div>
            
            {/* Servizi supplementari */}
            <div className="p-1.5 border-b border-black">
              <div className="font-bold text-xs mb-2">SERVIZI SUPPLEMENTARI</div>
              <table className="w-full text-xs border border-black">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-1 text-left">SERVIZIO</th>
                    <th className="border border-black p-1 text-center w-16">Q.TÀ</th>
                    <th className="border border-black p-1 text-center w-16">UNITÀ</th>
                    <th className="border border-black p-1 text-right w-20">TOTALE</th>
                    {isEditing && <th className="border border-black p-1 w-8"></th>}
                  </tr>
                </thead>
                <tbody>
                  {(p.servizi_supplementari || []).map((s, i) => (
                    <tr key={i}>
                      <td className="border border-black p-1">{s.nome}</td>
                      <td className="border border-black p-1 text-center">
                        {isEditing ? (
                          <Input type="number" min="1" value={s.quantita || 1} onChange={e => {
                            const arr = [...(p.servizi_supplementari||[])];
                            const qty = parseInt(e.target.value) || 1;
                            arr[i] = {...arr[i], quantita: qty, totale: qty * (arr[i].prezzo_unitario || 0)};
                            updateField('servizi_supplementari', arr);
                            updateField('totale_servizi', arr.reduce((sum, sv) => sum + (sv.totale || 0), 0));
                          }} className="h-5 text-xs w-12 text-center" />
                        ) : s.quantita}
                      </td>
                      <td className="border border-black p-1 text-center">{s.unita}</td>
                      <td className="border border-black p-1 text-right">€{(s.totale || 0).toFixed(2)}</td>
                      {isEditing && (
                        <td className="border border-black p-0.5 text-center">
                          <button onClick={() => {
                            const arr = (p.servizi_supplementari||[]).filter((_,idx) => idx !== i);
                            updateField('servizi_supplementari', arr);
                            updateField('totale_servizi', arr.reduce((sum, sv) => sum + (sv.totale || 0), 0));
                          }} className="text-red-500 text-xs">✕</button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {isEditing && (
                    <tr>
                      <td colSpan="5" className="border border-black p-1">
                        <Select onValueChange={v => {
                          const servizio = serviziDisponibili.find(s => s.id === v);
                          if (servizio) {
                            const durata = p.durata_giorni || 1;
                            const prezzo = servizio.prezzo_unitario || servizio.prezzo || 0;
                            const unita = servizio.unita || 'giorno';
                            const qty = unita === 'noleggio' ? 1 : durata;
                            const newServ = {
                              id: servizio.id,
                              nome: servizio.nome,
                              prezzo_unitario: prezzo,
                              quantita: qty,
                              unita: unita,
                              totale: prezzo * qty
                            };
                            const arr = [...(p.servizi_supplementari||[]), newServ];
                            updateField('servizi_supplementari', arr);
                            updateField('totale_servizi', arr.reduce((sum, sv) => sum + (sv.totale || 0), 0));
                          }
                        }}>
                          <SelectTrigger className="h-6 text-xs"><SelectValue placeholder="+ Aggiungi servizio..." /></SelectTrigger>
                          <SelectContent>
                            {serviziDisponibili.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.nome} - €{(s.prezzo_unitario || s.prezzo || 0).toFixed(2)}/{s.unita || 'giorno'}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  )}
                  {!isEditing && (p.servizi_supplementari?.length || 0) === 0 && (
                    <tr>
                      <td colSpan="4" className="border border-black p-0.5 text-center text-gray-400 italic">
                        Nessun servizio supplementare.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Franchigie e Riepilogo */}
            <div className="grid grid-cols-2">
              <div className="p-2 border-r border-black">
                <div className="font-bold text-xs mb-2">COPERTURE ASSICURATIVE</div>
                <table className="w-full text-xs border border-black">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-black p-1 text-left">COPERTURA/FRANCHIGIA</th>
                      <th className="border border-black p-1 text-right w-24">IMPORTO</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black p-1">
                        Attivazione CASCO con franchigia danni
                      </td>
                      <td className="border border-black p-1 text-right">
                        <span className="font-semibold">€ {(p.franchigia_kasko ?? 500).toFixed(2)}</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1">
                        Penalità per sinistro con responsabilità
                      </td>
                      <td className="border border-black p-1 text-right">
                        <span className="font-semibold">€ {(p.franchigia_sinistro ?? 250).toFixed(2)}</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-1">Scoperto 10% incendio e furto</td>
                      <td className="border border-black p-1 text-right">
                        {isEditing ? (
                          <Input 
                            type="text" 
                            value={p.scoperto_furto ?? '10%'} 
                            onChange={e => updateField('scoperto_furto', e.target.value)} 
                            className="h-5 text-xs w-20 text-right" 
                          />
                        ) : (
                          <span className="font-semibold">{p.scoperto_furto ?? '10%'}</span>
                        )}
                      </td>
                    </tr>
                    <tr className="bg-yellow-50">
                      <td className="border border-black p-1 font-semibold">Totale franchigie contratto</td>
                      <td className="border border-black p-1 text-right font-bold">
                        € {(
                          (p.franchigia_kasko_inclusa !== false ? (p.franchigia_kasko ?? 500) : 0) + 
                          (p.franchigia_sinistro_inclusa !== false ? (p.franchigia_sinistro ?? 250) : 0)
                        ).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-[9px] mt-1 text-gray-500 italic">
                  * In caso di sinistro, il conduttore è tenuto al pagamento delle franchigie sopra indicate.
                </p>
              </div>
              <div className="p-2">
                <div className="font-bold text-xs mb-2">RIEPILOGO ECONOMICO</div>
                <table className="w-full text-xs">
                  <tbody>
                    {/* Tariffa Stagionale (info read-only) */}
                    {p.tariffa_stagionale && (
                      <tr>
                        <td colSpan="2" className="py-0.5">
                          <div className="bg-green-50 border border-green-200 rounded px-1.5 py-0.5 text-[9px] text-green-700">
                            Tariffa stagionale: <strong>{p.tariffa_stagionale.nome}</strong>
                            {p.tariffa_stagionale.data_inizio && (
                              <span> ({formatDateIT(p.tariffa_stagionale.data_inizio)} - {formatDateIT(p.tariffa_stagionale.data_fine)})</span>
                            )}
                            {p.tariffa_stagionale.periodo && !p.tariffa_stagionale.data_inizio && (
                              <span> ({p.tariffa_stagionale.periodo})</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    {/* Tariffa giornaliera - editable, riflette la stagionale ma può essere sovrascritta solo per questo contratto */}
                    <tr>
                      <td className="py-0.5">Tariffa giornaliera:</td>
                      <td className="text-right">
                        {isEditing ? (
                          <span className="inline-flex items-center gap-1">
                            <Input 
                              type="number" 
                              step="0.01" 
                              value={p.tariffa_giornaliera ?? ((p.tariffa_base || 0) / (p.durata_giorni || 1)) ?? ''} 
                              onChange={e => {
                                const nuovaTariffa = parseFloat(e.target.value) || 0;
                                const durata = p.durata_giorni || 1;
                                setEditedData(prev => ({
                                  ...prev,
                                  tariffa_giornaliera: nuovaTariffa,
                                  tariffa_base: nuovaTariffa * durata,
                                  totale_noleggio: (nuovaTariffa * durata) + (prev.totale_servizi || 0)
                                }));
                              }} 
                              className="h-5 text-xs w-20 text-right" 
                              data-testid="input-tariffa-giornaliera"
                            />
                            <span>€/gg</span>
                          </span>
                        ) : (
                          <>{(p.tariffa_giornaliera || (p.tariffa_base / (p.durata_giorni || 1)) || 0).toFixed(2)} €/gg</>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0.5">Tariffa base ({p.durata_giorni} gg):</td>
                      <td className="text-right">
                        {isEditing ? (
                          <Input type="number" step="0.01" value={p.tariffa_base || ''} onChange={e => updateField('tariffa_base', parseFloat(e.target.value))} className="h-5 text-xs w-20 text-right" />
                        ) : (
                          <>{p.tariffa_base?.toFixed(2)} €</>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0.5">Servizi supplementari:</td>
                      <td className="text-right">{(p.totale_servizi || 0).toFixed(2)} €</td>
                    </tr>
                    <tr><td className="py-0.5">Check-in:</td><td className="text-right">0,00 €</td></tr>
                    <tr><td className="py-0.5">Check-out:</td><td className="text-right">0,00 €</td></tr>
                    <tr>
                      <td className="py-0.5">Franchigie assicurative:</td>
                      <td className="text-right">
                        {(
                          (p.franchigia_kasko_inclusa !== false ? (p.franchigia_kasko ?? 500) : 0) + 
                          (p.franchigia_sinistro_inclusa !== false ? (p.franchigia_sinistro ?? 250) : 0)
                        ).toFixed(2)} €
                      </td>
                    </tr>
                    <tr><td className="py-0.5">Chilometri eccedenza:</td><td className="text-right">{(p.rientro_importo_km_eccedenza || 0).toFixed(2)} €</td></tr>
                    <tr><td className="py-0.5">Addebiti rientro:</td><td className="text-right">{(p.totale_addebiti_rientro || 0).toFixed(2)} €</td></tr>
                    <tr className="border-t border-black font-bold"><td className="py-1">Totale (IVA inclusa):</td><td className="text-right">{(
                      (p.tariffa_base || 0) + 
                      (p.totale_servizi || 0) + 
                      (p.totale_addebiti_rientro || 0)
                    ).toFixed(2)} €</td></tr>
                    <tr>
                      <td className="py-0.5">Acconto già versato:</td>
                      <td className="text-right">
                        {isEditing ? (
                          <Input type="number" step="0.01" value={p.acconto || ''} onChange={e => updateField('acconto', parseFloat(e.target.value))} className="h-5 text-xs w-20 text-right" />
                        ) : (
                          <>{(p.acconto || 0).toFixed(2)} €</>
                        )}
                      </td>
                    </tr>
                    <tr className="bg-yellow-100 font-bold"><td className="py-1">Saldo alla consegna:</td><td className="text-right">{(
                      (p.tariffa_base || 0) + 
                      (p.totale_servizi || 0) + 
                      (p.totale_addebiti_rientro || 0) -
                      (p.acconto || 0)
                    ).toFixed(2)} €</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* V-BIS. RIENTRO & ADDEBITI */}
          <div className="border border-black mb-2">
            <div className="px-2 py-1 text-sm font-bold border-b border-black bg-gray-100">
              V-BIS. RIENTRO &amp; ADDEBITI
            </div>
            <div className="grid grid-cols-2 text-xs">
              <div className="p-2 border-r border-black">
                <div className="font-bold mb-1">DATI RIENTRO</div>
                <div className="space-y-1">
                  {isEditing ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 w-32">Data/ora rientro:</span>
                        <Input type="date" value={p.rientro_data || ''} onChange={e => updateField('rientro_data', e.target.value)} className="h-5 text-xs flex-1" />
                        <Input type="time" value={p.rientro_ora || ''} onChange={e => updateField('rientro_ora', e.target.value)} className="h-5 text-xs w-16" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 w-32">Km entrata:</span>
                        <Input type="number" value={p.rientro_km_entrata || ''} onChange={e => {
                          const kmEntrata = parseInt(e.target.value) || 0;
                          const kmUscita = parseInt(p.km_uscita) || 0;
                          const kmPercorsi = Math.max(0, kmEntrata - kmUscita);
                          const kmInclusi = p.km_inclusi_totali || 0;
                          const kmEccedenza = Math.max(0, kmPercorsi - (typeof kmInclusi === 'number' ? kmInclusi : 0));
                          const prezzoKmExtra = p.prezzo_km_extra || 0.20;
                          const importoKmEccedenza = kmEccedenza * prezzoKmExtra;
                          updateField('rientro_km_entrata', kmEntrata);
                          updateField('rientro_km_percorsi', kmPercorsi);
                          updateField('rientro_km_eccedenza', kmEccedenza);
                          updateField('rientro_importo_km_eccedenza', importoKmEccedenza);
                        }} className="h-5 text-xs w-20" />
                        <span className="text-gray-600">Km percorsi:</span>
                        <span className="font-semibold">{p.rientro_km_percorsi || 0}</span>
                      </div>
                      <p>Km inclusi totali: <strong>{p.km_tipo === 'illimitati' || p.km_inclusi_totali === 'ILLIMITATI' ? 'ILLIMITATI' : p.km_inclusi_totali}</strong></p>
                      <p>Km eccedenza: <strong>{p.rientro_km_eccedenza || 0}</strong> — Importo: <strong>€{(p.rientro_importo_km_eccedenza || 0).toFixed(2)}</strong></p>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 w-32">Tacche carburante:</span>
                        <Input type="number" min="0" max="8" value={p.rientro_tacche_carburante || ''} onChange={e => updateField('rientro_tacche_carburante', e.target.value)} className="h-5 text-xs w-12" />
                        <span>/ 8</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>Data/ora rientro effettivo: {p.rientro_data ? `${formatDateIT(p.rientro_data)} ${p.rientro_ora || ''}` : '_____________________'}</p>
                      <p>Km entrata: {p.rientro_km_entrata || '_________'} Km percorsi: {p.rientro_km_percorsi || '_________'}</p>
                      <p>Km inclusi totali: {p.km_tipo === 'illimitati' || p.km_inclusi_totali === 'ILLIMITATI' ? 'ILLIMITATI' : p.km_inclusi_totali}</p>
                      <p>Km eccedenza: {p.rientro_km_eccedenza || '_________'} Importo km eccedenza: €{p.rientro_importo_km_eccedenza?.toFixed(2) || '_________'}</p>
                      <p>Tacche carburante entrata: {p.rientro_tacche_carburante || '_____'} / 8</p>
                    </>
                  )}
                </div>
              </div>
              <div className="p-2">
                <div className="font-bold mb-1">ADDEBITI AL RIENTRO</div>
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      { key: 'addebito_danni', label: 'Danni veicolo' },
                      { key: 'addebito_gestione_danni', label: 'Costo gestione danni' },
                      { key: 'addebito_carburante', label: 'Carburante mancante' },
                      { key: 'addebito_pulizia', label: 'Pulizia straordinaria' },
                      { key: 'addebito_altro', label: 'Altri addebiti' }
                    ].map(({ key, label }) => (
                      <tr key={key}>
                        <td className="py-0.5">{label}:</td>
                        <td className="text-right">
                          {isEditing ? (
                            <span className="inline-flex items-center">€<Input type="number" step="0.01" value={p[key] || ''} onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              updateField(key, val);
                              // Ricalcola totale addebiti
                              const keys = ['addebito_danni', 'addebito_gestione_danni', 'addebito_carburante', 'addebito_pulizia', 'addebito_altro'];
                              let tot = 0;
                              keys.forEach(k => { tot += (k === key ? val : (parseFloat(p[k]) || 0)); });
                              tot += (p.rientro_importo_km_eccedenza || 0);
                              updateField('totale_addebiti_rientro', tot);
                            }} className="h-5 text-xs w-20 text-right" /></span>
                          ) : (
                            <>€ {(p[key] || 0).toFixed(2)}</>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-0.5">Km eccedenza:</td>
                      <td className="text-right">€ {(p.rientro_importo_km_eccedenza || 0).toFixed(2)}</td>
                    </tr>
                    <tr className="border-t border-black font-bold bg-yellow-100">
                      <td className="py-1">Totale addebiti rientro:</td>
                      <td className="text-right">{(p.totale_addebiti_rientro || 0).toFixed(2)} €</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* VI. GARANZIE & PAGAMENTO */}
          <div className="border border-black mb-2">
            <div className="px-2 py-1 text-sm font-bold border-b border-black bg-gray-100">
              VI. GARANZIE &amp; PAGAMENTO
            </div>
            <div className="grid grid-cols-3 text-xs">
              {/* Garante */}
              <div className="p-2 border-r border-black">
                <div className="font-bold mb-1">GARANTE</div>
                <div className="space-y-2">
                  {isEditing ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 w-16">Garante:</span>
                        <Input value={p.garante_nome || ''} onChange={e => updateField('garante_nome', e.target.value)} className="h-5 text-xs flex-1" placeholder="Nome e cognome" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 w-16">Recapiti:</span>
                        <Input value={p.garante_recapiti || ''} onChange={e => updateField('garante_recapiti', e.target.value)} className="h-5 text-xs flex-1" placeholder="Telefono" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 w-16">Documento:</span>
                        <Input value={p.garante_documento || ''} onChange={e => updateField('garante_documento', e.target.value)} className="h-5 text-xs flex-1" placeholder="Tipo e numero" />
                      </div>
                    </>
                  ) : (
                    <>
                      <p>Garante: {p.garante_nome || '_________________________'}</p>
                      <p>Recapiti: {p.garante_recapiti || '_________________________'}</p>
                      <p>Documento: {p.garante_documento || '_______________________'}</p>
                    </>
                  )}
                </div>
              </div>
              {/* Carta di credito - CAMPI EDITABILI */}
              <div className="p-2 border-r border-black bg-yellow-50">
                <div className="font-bold mb-1">CARTA DI CREDITO</div>
                <div className="space-y-2">
                  {isEditing ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 w-20">Circuito:</span>
                        <Input value={p.carta_circuito || ''} onChange={e => updateField('carta_circuito', e.target.value)} className="h-5 text-xs flex-1" placeholder="Visa, Mastercard..." />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 w-20">Intestatario:</span>
                        <Input value={p.carta_intestatario || ''} onChange={e => updateField('carta_intestatario', e.target.value)} className="h-5 text-xs flex-1" placeholder="Nome sulla carta" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 w-20">N. Carta:</span>
                        <Input value={p.carta_numero || ''} onChange={e => updateField('carta_numero', e.target.value.replace(/\D/g, '').slice(0,16))} maxLength={19} className="h-5 text-xs flex-1 font-mono" placeholder="1234 5678 9012 3456" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 w-20">Scadenza:</span>
                        <Input value={p.carta_scadenza_mese || ''} onChange={e => updateField('carta_scadenza_mese', e.target.value)} maxLength={2} className="h-5 text-xs w-10" placeholder="MM" />
                        <span>/</span>
                        <Input value={p.carta_scadenza_anno || ''} onChange={e => updateField('carta_scadenza_anno', e.target.value)} maxLength={2} className="h-5 text-xs w-10" placeholder="AA" />
                      </div>
                    </>
                  ) : (
                    <>
                      <p>Circuito: {p.carta_circuito || '_________________________'}</p>
                      <p>Intestatario: {p.carta_intestatario || '_____________________'}</p>
                      <p>N. Carta: <span className="font-mono">{p.carta_numero || '________________'}</span></p>
                      <p>Scadenza: {p.carta_scadenza_mese || '______'} / {p.carta_scadenza_anno || '______'}</p>
                    </>
                  )}
                </div>
              </div>
              {/* Pagamento */}
              <div className="p-2">
                <div className="font-bold mb-1">PAGAMENTO</div>
                <div className="space-y-2">
                  {isEditing ? (
                    <>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={p.pagamento_contanti || false} onChange={e => updateField('pagamento_contanti', e.target.checked)} className="w-4 h-4" />
                        <span>Contanti</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={p.pagamento_carta || false} onChange={e => updateField('pagamento_carta', e.target.checked)} className="w-4 h-4" />
                        <span>Carta di Credito</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={p.pagamento_bonifico || false} onChange={e => updateField('pagamento_bonifico', e.target.checked)} className="w-4 h-4" />
                        <span>Bonifico</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={p.pagamento_altro || false} onChange={e => updateField('pagamento_altro', e.target.checked)} className="w-4 h-4" />
                        <span>Altro:</span>
                        <Input value={p.pagamento_altro_desc || ''} onChange={e => updateField('pagamento_altro_desc', e.target.value)} className="h-5 text-xs w-20" />
                      </div>
                    </>
                  ) : (
                    <>
                      <p><span className={`inline-block w-4 h-4 border border-black mr-2 ${p.pagamento_contanti ? 'bg-black' : ''}`}></span> Contanti</p>
                      <p><span className={`inline-block w-4 h-4 border border-black mr-2 ${p.pagamento_carta ? 'bg-black' : ''}`}></span> Carta di Credito</p>
                      <p><span className={`inline-block w-4 h-4 border border-black mr-2 ${p.pagamento_bonifico ? 'bg-black' : ''}`}></span> Bonifico</p>
                      <p><span className={`inline-block w-4 h-4 border border-black mr-2 ${p.pagamento_altro ? 'bg-black' : ''}`}></span> Altro: {p.pagamento_altro_desc || '____________'}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* VII. DICHIARAZIONI E SOTTOSCRIZIONI */}
          <div className="border border-black mt-3">
            <div className="px-2 py-1 text-sm font-bold border-b border-black bg-gray-100">
              VII. DICHIARAZIONI E SOTTOSCRIZIONI
            </div>
            <div className="p-1.5 text-xs">
              <p className="leading-relaxed">Il sottoscritto locatario dichiara di aver letto attentamente e di accettare integralmente le condizioni generali di noleggio riportate nel presente contratto, nonche' ogni clausola ivi contenuta.</p>
              <div className="mt-3 flex justify-between">
                <div><span className="text-gray-600">Luogo e data: </span>{p.luogo_ritiro || 'Soverato'}, {formatDateIT(p.data_ritiro)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ========== PAGINA 3/3 - CONDIZIONI GENERALI + FIRME ========== */}
        <div data-page="3" className="p-6" style={{ pageBreakAfter: 'auto' }}>
          <div className="flex justify-between items-center border-b border-black pb-1 mb-1">
            <span className="font-bold" style={{ fontFamily: 'Arial Black, sans-serif' }}>{AGENCY.nome} - CONTRATTO</span>
            <span className="text-sm text-gray-500">Pag. 3/3</span>
          </div>

          <div className="border border-black">
            <div className="px-2 py-1 text-sm font-bold border-b border-black bg-gray-100">
              VIII. CONDIZIONI GENERALI DI NOLEGGIO
            </div>
            <div className="p-2 leading-snug" style={{ fontSize: '6pt', lineHeight: '1.25' }}>
              <p className="mb-0.5"><strong>1.</strong> La società RE.LE.CO. Group SRL in seguito definita Locatrice, concede in noleggio alla persona che sottoscrive il presente contratto, in nome proprio ovvero in qualità di legale rappresentate della società indicata, in seguito definita Conduttore, il veicolo descritto nel contratto stesso.</p>
              
              <p className="mb-0.5"><strong>2.</strong> Il Conduttore dichiara che il veicolo, al momento della presa in consegna, si trova in buone condizioni di meccanica e di carrozzeria. Pertanto si obbliga a riconsegnarlo nello stesso stato in cui l'ha ricevuto, salvo il normale deterioramento dovuto all'uso, segnalando per iscritto alla Locatrice gli eventuali danni o anomalie.</p>
              
              <p className="mb-0.5"><strong>3.</strong> Il conduttore, all'atto della stipula del presente contratto di noleggio, dichiara di essere abilitato alla guida del veicolo noleggiato e si obbliga a presentare la relativa patente di guida in corso di validità. L'età minima per l'ammissione alla sottoscrizione del presente contratto è fissata in anni 21.</p>
              
              <p className="mb-0.5"><strong>4.</strong> La durata del noleggio è stabilita dal momento del ritiro del veicolo e fino alla data di riconsegna prevista indicata nel contratto. Qualora il Conduttore avesse esigenza di prolungare il periodo di noleggio stabilito in sede contrattuale, dovrà darne comunicazione alla Locatrice con almeno 24 ore di anticipo sulla scadenza del contratto stesso. In tal caso la Locatrice ha facoltà di non accogliere tale richiesta. In caso di inadempimento da parte del Conduttore delle obbligazioni sottoscritte con il presente contratto, la Locatrice ha la facoltà di risolvere di diritto il contratto stesso, inviando apposita comunicazione ai sensi dell'articolo 1456 del codice civile. Qualora al termine del periodo di noleggio concordato il Conduttore non restituisca il veicolo, la Locatrice si riserva il diritto di richiederne l'immediata riconsegna a mezzo telegramma, raccomandata A/R, PEC o Telefax. Trascorsi tre giorni dal ricevimento da parte del Conduttore della comunicazione citata senza che la Locatrice riceva valide spiegazioni in merito alla mancata riconsegna del veicolo, la stessa potrà presentare all'autorità competente denuncia/querela per l'appropriazione indebita del veicolo. In ogni caso il Conduttore sarà tenuto a versare, per ogni giorno in più, dal termine previsto per la riconsegna fino alla restituzione effettiva, il costo della tariffa a prezzo raddoppiato a titolo di penale per la ritardata restituzione del veicolo, oltre al risarcimento di eventuali danni maggiori. In caso di riconsegna dell'autovettura con ritardo rispetto all'orario stabilito in sede contrattuale, il Conduttore sarà obbligato al pagamento di una penale pari a 30€ per le prime tre ore di ritardo. Superate le tre ore di ritardo, viene applicata una penale pari all'importo della tariffa giornaliera prevista dal contratto sottoscritto. Il conduttore all'inizio del noleggio è obbligato a versare un deposito cauzionale che garantisca l'adempimento dei propri obblighi contrattuali pari a euro 1000 (mille).</p>
              
              <p className="mb-0.5"><strong>5.</strong> Il corrispettivo totale del noleggio sarà determinato alla stipula del contratto allegato, in base alle tariffe in vigore e dovrà essere immediatamente pagato alla Locatrice che si impegna a rilasciare regolare documento fiscale. Il pagamento dovrà essere effettuato con carta di credito. Nel caso di mancato pagamento del canone di noleggio, la Locatrice è autorizzata, previa comunicazione scritta (e-mail, fax o sms), all'incasso delle somme dovute mediante l'utilizzo diretto della carta di credito concessa a titolo di garanzia. Qualora il Conduttore richieda la consegna e/o la riconsegna del veicolo in luogo diverso della Locatrice, tutte le spese di trasferimento saranno a completo carico del Conduttore stesso.</p>
              
              <p className="mb-0.5"><strong>6.</strong> Le spese per il carburante sono a totale carico del Conduttore.</p>
              
              <p className="mb-0.5"><strong>7.</strong> Il conduttore si impegna ad utilizzare il veicolo noleggiato con diligenza e nel pieno rispetto dell'uso per cui è stato omologato. Il conduttore si impegna inoltre a non far guidare il veicolo noleggiato a terze persone, siano esse anche familiari oppure amici. Contravvenendo quanto sopra il Conduttore sarà ritenuto responsabile dei danni eventualmente arrecati sia all'autoveicolo noleggiato che a terzi.</p>
              
              <p className="mb-0.5"><strong>8.</strong> Le riparazioni e manutenzione sia ordinarie che straordinarie del veicolo noleggiato vengono effettuate dalla Locatrice. In caso di necessità urgenti vi può provvedere il Conduttore dietro autorizzazione scritta della Locatrice. Il Conduttore si obbliga a risarcire eventuali danni al veicolo noleggiato causati dal mancato rispetto delle norme previste dal libretto "uso e manutenzione" in dotazione al veicolo stesso. Il Conduttore si impegna inoltre a non effettuare modifiche di qualsiasi genere al veicolo noleggiato. In particolare, il Cliente si assume l'obbligo di risarcire: i danni derivanti dal rifornimento effettuato con carburante diverso da quello previsto per il motoveicolo o autovettura noleggiato; i danni derivanti da interventi di riparazione eseguiti o fatti eseguire direttamente dal Cliente senza il consenso scritto della locatrice; Nel caso in cui vengano riscontrati sul motoveicolo o autovettura danni di qualunque sorta, la ditta viene fin d'ora autorizzata a prelevare senza preavviso la cifra corrispondente all'importo dovuto sulla carta di credito del Cliente.</p>
              
              <p className="mb-0.5"><strong>9.</strong> Il conduttore dichiara di aver constatato che il veicolo noleggiato è regolarmente assicurato per la RCA nel rispetto delle condizioni e dei massimali previsti dalle Legge e si obbliga al pagamento delle somme dovute nel caso in cui il sinistro comporti un indennizzo superiore a quanto previsto dalla polizza. Nel caso in cui l'autovettura, al momento della riconsegna presenti danni alla carrozzeria, agli interni e/o alla parte meccanica, riconducibili alla responsabilità del Conduttore, lo stesso sarà obbligato a risarcire i danni riscontrati al mezzo, mediante l'utilizzo diretto da parte del locatore della carta di credito concessa a titolo di garanzia. In caso di sinistri a seguito di collisioni e/o ribaltamenti, il Conduttore dovrà compilare in ogni sua parte gli appositi moduli esistenti a bordo del veicolo noleggiato e contemporaneamente dovrà avvisare la Locatrice descrivendo il luogo e le cause dell'evento, indicando il nome di eventuali terze persone presenti al sinistro, specificando i danni riportati dagli automezzi, alle persone, alle cose e l'eventuale autorità intervenuta. Il Conduttore è tenuto a fornire la massima collaborazione alla Locatrice ed ai suoi assicuratori nelle investigazioni, nelle difese e nelle controversie derivanti dall'uso del veicolo noleggiato.</p>
              
              <p className="mb-0.5"><strong>10.</strong> Al verificarsi di un furto o incendio del veicolo noleggiato, il Conduttore si impegna ad effettuare immediata denuncia alle autorità competenti e a consegnare od inviare copia della copertura assicurativa alla Locatrice. La Locatrice si riserva il diritto di rivalersi sul Conduttore qualora la copertura assicurativa divenisse inoperante per colpa o incuria, diretta o indiretta, attribuita alla Compagnia di assicurazione del conduttore stesso.</p>
              
              <p className="mb-0.5"><strong>11.</strong> Le comunicazioni alla Locatrice di sinistro, furto, incendio, dovranno essere effettuate dal Conduttore nel più breve tempo possibile a mezzo telegramma, telefax. Qualora si verifichi uno dei suddetti eventi, sarà a carico del Cliente l'eventuale franchigia assicurativa (pari ad €250,00 oltre spese amministrative di €150,00) o scopertura assicurativa (pari al 20%) del valore commerciale del veicolo, prevista dalla polizza assicurativa in ordine alla garanzia furto e incendio (pari al 20%) del valore commerciale del veicolo.</p>
              
              <p className="mb-0.5"><strong>12.</strong> La locatrice non sarà ritenuta responsabile per perdite o danni a cose o animali lasciati all'interno o sopra il veicolo noleggiato.</p>
              
              <p className="mb-0.5"><strong>13.</strong> Il Conduttore si impegna a pagare tutte le ammende o le contravvenzioni elevate in relazione all'uso del veicolo noleggiato e a tenere indenne la Locatrice in caso di sequestro o di qualsiasi altro evento pregiudizievole. Il Conduttore è obbligato a rimborsare alla Locatrice quanto da essa anticipato per il pagamento di infrazioni dallo stesso commesse con conseguente liquidazione mediante utilizzo di carta di credito concessa a titolo di garanzia, ovvero in contante. In ogni caso il Conduttore è tenuto ad osservare diligentemente le normative previste dal codice della strada. Viene fin d'ora autorizzata a prelevare la cifra corrispondente all'importo dovuto sulla carta di credito del Cliente, oltre le somme inerenti alle spese amministrative di comunicazioni intercorse tra ente, organo di polizia o società gestionarie che ha sollevato la sanzione o il credito (somme amministrative di gestione pari ad €25,00 oltre IVA).</p>
              
              <p className="mb-0.5"><strong>14.</strong> Per qualsiasi controversia in merito al presente contratto le parti dichiarano competente il Foro della stessa città della società di noleggio.</p>
              
              <p className="mb-0.5"><strong>15.</strong> Per quanto non previsto nel presente contratto si fa riferimento alle norme del codice civile. Il Conduttore, con la sottoscrizione del presente contratto, dichiara di approvare pienamente e senza riserve quanto in esso contenuto. Agli effetti degli artt. 1341 e 1342 del C.C. il sottoscritto dichiara di approvare specificatamente le disposizioni dei seguenti articoli, delle condizioni contenute nel modello di cui sopra; art. 7 divieto di far guidare il veicolo ad altre persone - art.10 rivalsa sul Conduttore nel caso che la copertura assicurativa venisse inoperante - art. 11 pagamento dell'eventuale franchigia da parte del conduttore - art. 14 Il Conduttore si impegna a pagare tutte le ammende.</p>
            </div>
          </div>

          {/* FIRME */}
          <div className="border border-black mt-1">
            <div className="px-2 py-0.5 text-[9px] font-bold border-b border-black bg-gray-100">FIRME</div>
            <div className="grid grid-cols-2 gap-0">
              <div className="p-1 border-r border-black text-center">
                <p className="font-bold text-[9px] mb-1">IL LOCATORE / NOLEGGIATORE</p>
                <div className="border-b-2 border-black h-8 mx-4"></div>
                <p className="text-[7px]">Firma - {AGENCY.nome}</p>
              </div>
              <div className="p-1 text-center">
                <p className="font-bold text-[9px] mb-1">IL LOCATARIO / CLIENTE</p>
                <div className="border-b-2 border-black h-8 mx-4"></div>
                <p className="text-[7px]">Firma - {cliente?.nome} {cliente?.cognome}</p>
              </div>
            </div>
          </div>

          {/* Clausole vessatorie */}
          <div className="mt-1 border border-black p-1">
            <p className="text-[6pt] mb-1">
              Firma apposta ai sensi e per gli effetti degli artt. 1341 e 1342 c.c. con specifica 
              approvazione delle clausole (art. 7, art. 10, art. 11, art. 14):
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="border-b-2 border-black h-6 mx-6"></div>
                <p className="text-[7px]">Firma Locatore</p>
              </div>
              <div className="text-center">
                <div className="border-b-2 border-black h-6 mx-6"></div>
                <p className="text-[7px]">Firma Locatario</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-1 pt-1 border-t border-black text-center text-[7px] text-gray-500">
            <p>{AGENCY.nome} - {AGENCY.indirizzo}, {AGENCY.cap} {AGENCY.comune} ({AGENCY.provincia})</p>
            <p>P.IVA: {AGENCY.piva} - Tel: {AGENCY.telefono} - Email: {AGENCY.email}</p>
          </div>
        </div>
      </div>

      {/* Stili stampa */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
          .print\\:hidden { display: none !important; }
          @page { size: A4; margin: 5mm 8mm; }
          [data-page] { 
            padding: 4mm !important;
            page-break-after: always;
            page-break-inside: avoid;
          }
          [data-page]:last-child { page-break-after: auto; }
          * { font-size: 8px !important; line-height: 1.25 !important; }
          h1 { font-size: 14px !important; }
          .text-xl { font-size: 14px !important; }
          .text-sm { font-size: 8px !important; }
          .text-xs { font-size: 7px !important; }
          table { font-size: 7px !important; }
          .bg-black { padding: 1px 4px !important; }
          .mb-2 { margin-bottom: 2px !important; }
          .mb-1 { margin-bottom: 1px !important; }
          .p-2 { padding: 3px !important; }
          .gap-2 { gap: 2px !important; }
          img { max-height: 100px !important; }
          .vehicle-schema { margin: 0 !important; }
          .h-8 { height: 20px !important; }
          .h-6 { height: 16px !important; }
        }
      `}</style>
    </div>
  );
}
