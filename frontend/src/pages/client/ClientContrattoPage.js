import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Printer, ArrowLeft, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
    <div className="grid grid-cols-2 gap-4">
      <div className="border border-dashed border-gray-300 rounded-lg p-2 bg-white">
        <img 
          src="/images/vista_laterale.png"
          alt="Vista laterale / frontale"
          className="w-full h-auto"
          style={{ maxHeight: '280px', objectFit: 'contain' }}
        />
        <div className="text-center text-xs text-gray-500 mt-1">Vista laterale / frontale</div>
      </div>
      <div className="border border-dashed border-gray-300 rounded-lg p-2 bg-white">
        <img 
          src="/images/vista_alto.png"
          alt="Vista dall'alto / interni"
          className="w-full h-auto"
          style={{ maxHeight: '280px', objectFit: 'contain' }}
        />
        <div className="text-center text-xs text-gray-500 mt-1">Vista dall'alto / interni</div>
      </div>
    </div>
  </div>
);

export default function ClientContrattoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [prenotazione, setPrenotazione] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const contractRef = useRef(null);

  const cliente = user;

  const AGENCY = {
    nome: "RE.LE.CO. GROUP",
    indirizzo: "CORSO UMBERTO, 220",
    cap: "88068",
    comune: "SOVERATO",
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
        const res = await axios.get(`${API}/api/prenotazioni/${id}`, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        setPrenotazione(res.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Errore nel caricamento del contratto');
        navigate('/area-cliente/contratti');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, token, navigate]);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (!contractRef.current) return;
    
    setGeneratingPdf(true);
    toast.info('Generazione PDF in corso... Attendere il caricamento delle immagini.');
    
    try {
      // Hide toolbar
      const toolbar = document.querySelector('.print\\:hidden');
      if (toolbar) toolbar.style.display = 'none';

      // Wait for images to load
      const images = contractRef.current.querySelectorAll('img');
      await Promise.all([...images].map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 5000);
        });
      }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const pages = contractRef.current.querySelectorAll('[data-page]');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = 210;
      const pdfHeight = 297;
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        
        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 15000
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        if (i > 0) {
          pdf.addPage();
        }
        
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pdfHeight));
      }
      
      pdf.save(`contratto_${prenotazione.veicolo_targa}_${prenotazione.data_ritiro}.pdf`);
      toast.success('PDF scaricato con successo!');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Errore nella generazione del PDF');
    } finally {
      const toolbar = document.querySelector('.print\\:hidden');
      if (toolbar) toolbar.style.display = '';

      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!prenotazione) {
    return <div className="p-8 text-center text-red-600">Contratto non trovato</div>;
  }

  const p = prenotazione;
  const patente = cliente?.patente || {};
  const today = new Date().toLocaleDateString('it-IT');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* TOOLBAR */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b shadow-sm p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/area-cliente/contratti')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Torna ai Contratti
          </Button>
          <div className="flex gap-2">
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
          </div>
        </div>
      </div>

      {/* CONTRATTO */}
      <div ref={contractRef} className="max-w-[210mm] mx-auto bg-white print:max-w-none print:mx-0 shadow-lg print:shadow-none">
        
        {/* ========== PAGINA 1/4 ========== */}
        <div data-page="1" className="p-8 print:p-6" style={{ minHeight: '297mm', pageBreakAfter: 'always' }}>
          {/* Header */}
          <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
            <div>
              <h1 className="text-2xl font-black text-blue-800">{AGENCY.nome}</h1>
              <p className="text-xs text-gray-600">{AGENCY.indirizzo} - {AGENCY.cap} {AGENCY.comune} ({AGENCY.provincia}) - {AGENCY.regione}</p>
              <p className="text-xs text-gray-600">P.IVA {AGENCY.piva} CF {AGENCY.cf}</p>
              <p className="text-xs text-gray-600">Tel. {AGENCY.telefono} Email: {AGENCY.email}</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold">CONTRATTO</h2>
              <p className="text-sm text-gray-600">Pag. 1/4</p>
            </div>
          </div>

          {/* Contratto di Noleggio */}
          <div className="border border-black mb-4">
            <div className="text-xs font-bold bg-gray-200 px-2 py-1 border-b border-black">CONTRATTO DI NOLEGGIO</div>
            <div className="grid grid-cols-5 text-xs">
              <div className="p-2 border-r border-black">
                <p className="text-gray-500">Data stipula:</p>
                <p className="font-semibold">{today}</p>
              </div>
              <div className="p-2 border-r border-black">
                <p className="text-gray-500">Dal:</p>
                <p className="font-semibold">{formatDateIT(p.data_ritiro)} {p.ora_ritiro}</p>
              </div>
              <div className="p-2 border-r border-black">
                <p className="text-gray-500">Al:</p>
                <p className="font-semibold">{formatDateIT(p.data_riconsegna)} {p.ora_riconsegna}</p>
              </div>
              <div className="p-2 border-r border-black">
                <p className="text-gray-500">Durata:</p>
                <p className="font-semibold">{p.durata_giorni} gg</p>
              </div>
              <div className="p-2">
                <p className="text-gray-500">Targa:</p>
                <p className="font-semibold text-lg">{p.veicolo_targa}</p>
              </div>
            </div>
          </div>

          {/* I. PARTI DEL CONTRATTO */}
          <div className="border border-black mb-4">
            <div className="bg-black text-white px-2 py-1 text-sm font-bold">I. PARTI DEL CONTRATTO</div>
            <div className="grid grid-cols-2 text-xs">
              <div className="p-3 border-r border-black">
                <p className="font-bold text-blue-700 mb-2">Locatore / Noleggiatore</p>
                <p><span className="text-gray-600">Ragione sociale:</span> <strong>{AGENCY.nome}</strong></p>
                <p><span className="text-gray-600">Indirizzo:</span> {AGENCY.indirizzo} - {AGENCY.cap} {AGENCY.comune} ({AGENCY.provincia})</p>
                <p><span className="text-gray-600">P.IVA / CF:</span> P.IVA {AGENCY.piva} CF {AGENCY.cf}</p>
                <p><span className="text-gray-600">Contatti:</span> Tel. {AGENCY.telefono} Email: {AGENCY.email}</p>
              </div>
              <div className="p-3">
                <p className="font-bold text-blue-700 mb-2">Locatario / Cliente</p>
                <p><span className="text-gray-600">Tipologia:</span> Persona Fisica</p>
                <p><span className="text-gray-600">Denominazione:</span> <strong>{cliente?.nome} {cliente?.cognome}</strong></p>
                <p><span className="text-gray-600">CF / P.IVA:</span> {cliente?.codice_fiscale}</p>
                <p><span className="text-gray-600">Indirizzo:</span> {cliente?.indirizzo}, {cliente?.cap} {cliente?.comune} ({cliente?.provincia})</p>
              </div>
            </div>
          </div>

          {/* II. CONDUCENTI AUTORIZZATI */}
          <div className="border border-black mb-4">
            <div className="bg-black text-white px-2 py-1 text-sm font-bold">II. CONDUCENTI AUTORIZZATI</div>
            <div className="p-3">
              <p className="text-xs font-bold mb-2">Conducente principale</p>
              <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                <div><span className="text-gray-600">Cognome:</span> <strong>{cliente?.cognome}</strong></div>
                <div><span className="text-gray-600">Nome:</span> <strong>{cliente?.nome}</strong></div>
                <div><span className="text-gray-600">Nascita:</span> {cliente?.luogo_nascita}, {formatDateIT(cliente?.data_nascita)}</div>
                <div><span className="text-gray-600">Cod. fiscale:</span> {cliente?.codice_fiscale}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-600">Residenza:</span> {cliente?.indirizzo}, {cliente?.comune} ({cliente?.provincia})</div>
                <div><span className="text-gray-600">Patente:</span> N. {patente.numero} Cat. {patente.categoria} Scad. {formatDateIT(patente.data_scadenza)}</div>
              </div>
            </div>
          </div>

          {/* III. VEICOLO OGGETTO DEL NOLEGGIO */}
          <div className="border border-black">
            <div className="bg-black text-white px-2 py-1 text-sm font-bold">III. VEICOLO OGGETTO DEL NOLEGGIO</div>
            <div className="grid grid-cols-3 text-xs">
              <div className="p-3 border-r border-black">
                <div className="space-y-1">
                  <div className="grid grid-cols-2"><span className="text-gray-600">Marca:</span><strong>{p.veicolo_marca}</strong></div>
                  <div className="grid grid-cols-2"><span className="text-gray-600">Modello:</span><strong>{p.veicolo_modello}</strong></div>
                  <div className="grid grid-cols-2"><span className="text-gray-600">Targa:</span><strong>{p.veicolo_targa}</strong></div>
                  <div className="grid grid-cols-2"><span className="text-gray-600">Colore:</span>{p.veicolo_colore || 'N/D'}</div>
                  <div className="grid grid-cols-2"><span className="text-gray-600">Cambio:</span>{p.veicolo_cambio || 'N/D'}</div>
                  <div className="grid grid-cols-2"><span className="text-gray-600">Alim.:</span>{p.veicolo_alimentazione || 'N/D'}</div>
                  <div className="grid grid-cols-2"><span className="text-gray-600">Km inclusi:</span>{p.km_inclusi_totali}</div>
                </div>
              </div>
              <div className="col-span-2 p-2">
                <VeicoloSchemaCompleto />
              </div>
            </div>
          </div>
        </div>

        {/* ========== PAGINA 2/4 ========== */}
        <div data-page="2" className="p-8 print:p-6" style={{ minHeight: '297mm', pageBreakAfter: 'always' }}>
          <div className="flex justify-between items-center border-b border-black pb-2 mb-4">
            <span className="font-bold">{AGENCY.nome} - CONTRATTO</span>
            <span className="text-xs text-gray-500">Pag. 2/4</span>
          </div>

          {/* IV. DURATA & CHILOMETRAGGIO */}
          <div className="border border-black mb-4">
            <div className="bg-black text-white px-2 py-1 text-sm font-bold">IV. DURATA &amp; CHILOMETRAGGIO</div>
            <div className="grid grid-cols-3 text-xs">
              <div className="border-r border-black p-3">
                <div className="font-bold mb-2">Periodo di noleggio</div>
                <p><span className="text-gray-600">Durata:</span> <strong>{p.durata_giorni} giorni</strong></p>
                <p><span className="text-gray-600">Dal:</span> {formatDateIT(p.data_ritiro)} ore {p.ora_ritiro}</p>
                <p><span className="text-gray-600">Al:</span> {formatDateIT(p.data_riconsegna)} ore {p.ora_riconsegna}</p>
              </div>
              <div className="border-r border-black p-3">
                <div className="font-bold mb-2">Chilometraggio</div>
                <p><span className="text-gray-600">Km inclusi:</span> <strong>{p.km_inclusi_totali} km</strong></p>
                <p><span className="text-gray-600">Prezzo km extra:</span> €{p.prezzo_km_extra}/km</p>
              </div>
              <div className="p-3 bg-gray-50">
                <div className="font-bold mb-2">Deposito &amp; acconti</div>
                <p><span className="text-gray-600">Acconto:</span> €{p.acconto || '0.00'}</p>
                <p><span className="text-gray-600">Deposito:</span> €{p.deposito_cauzionale}</p>
              </div>
            </div>
          </div>

          {/* V. CORRISPETTIVO & SERVIZI */}
          <div className="border border-black mb-4">
            <div className="bg-black text-white px-2 py-1 text-sm font-bold">V. CORRISPETTIVO &amp; SERVIZI</div>
            <div className="grid grid-cols-2 text-xs">
              <div className="p-3 border-r border-black">
                <div className="font-bold mb-2">Riepilogo Economico</div>
                <table className="w-full">
                  <tbody>
                    <tr><td>Noleggio base ({p.durata_giorni} gg x €{p.tariffa_giornaliera_veicolo}/gg):</td><td className="text-right font-semibold">€{p.tariffa_base?.toFixed(2)}</td></tr>
                    <tr><td>Servizi supplementari:</td><td className="text-right">€{(p.totale_servizi || 0).toFixed(2)}</td></tr>
                    <tr><td>Franchigie assicurative:</td><td className="text-right">€{(p.totale_franchigie || 0).toFixed(2)}</td></tr>
                    <tr className="border-t border-gray-300"><td className="font-bold">Totale (IVA inclusa):</td><td className="text-right font-bold text-lg">€{(p.totale_noleggio || p.tariffa_base)?.toFixed(2)}</td></tr>
                    <tr><td>Acconto già versato:</td><td className="text-right text-green-600">- €{(p.acconto || 0).toFixed(2)}</td></tr>
                    <tr className="bg-green-50"><td className="font-bold text-green-700">Saldo alla consegna:</td><td className="text-right font-bold text-green-700">€{((p.totale_noleggio || p.tariffa_base) - (p.acconto || 0)).toFixed(2)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-yellow-50">
                <div className="font-bold mb-2">Franchigia massima</div>
                <p className="text-sm">In caso di sinistro, il locatario risponde fino a un massimo di €{p.franchigia_massima || 500}.00</p>
              </div>
            </div>
          </div>

          {/* VI. LUOGO CHECK IN & CHECK OUT */}
          <div className="border border-black mb-4">
            <div className="bg-black text-white px-2 py-1 text-sm font-bold">VI. LUOGO CHECK IN &amp; CHECK OUT</div>
            <div className="grid grid-cols-2 text-xs">
              <div className="p-3 border-r border-black">
                <div className="font-bold text-green-700 mb-3">CHECK-IN (RITIRO VEICOLO)</div>
                <div className="space-y-2">
                  <p><span className="text-gray-600">Data:</span> {formatDateIT(p.contratto_check_in?.data) || '______________________'} <span className="text-gray-600 ml-4">Ora:</span> {p.contratto_check_in?.ora || '__________'}</p>
                  <p><span className="text-gray-600">Luogo:</span> {p.contratto_check_in?.luogo || '___________________________________________'}</p>
                  <p><span className="text-gray-600">Indirizzo:</span> {p.contratto_check_in?.indirizzo || '________________________________________'}</p>
                  <p><span className="text-gray-600">Km uscita:</span> {p.contratto_check_in?.km_uscita || '_________________'} <span className="text-gray-600 ml-4">Carburante:</span> {p.contratto_check_in?.carburante || '_____'} / 8</p>
                  <p><span className="text-gray-600">Operatore:</span> {p.contratto_check_in?.operatore || '_______________________________________'}</p>
                </div>
              </div>
              <div className="p-3">
                <div className="font-bold text-red-700 mb-3">CHECK-OUT (RICONSEGNA VEICOLO)</div>
                <div className="space-y-2">
                  <p><span className="text-gray-600">Data:</span> {formatDateIT(p.contratto_check_out?.data) || '______________________'} <span className="text-gray-600 ml-4">Ora:</span> {p.contratto_check_out?.ora || '__________'}</p>
                  <p><span className="text-gray-600">Luogo:</span> {p.contratto_check_out?.luogo || '___________________________________________'}</p>
                  <p><span className="text-gray-600">Indirizzo:</span> {p.contratto_check_out?.indirizzo || '________________________________________'}</p>
                  <p><span className="text-gray-600">Km entrata:</span> {p.contratto_check_out?.km_entrata || '________________'} <span className="text-gray-600 ml-4">Carburante:</span> {p.contratto_check_out?.carburante || '_____'} / 8</p>
                  <p><span className="text-gray-600">Operatore:</span> {p.contratto_check_out?.operatore || '_______________________________________'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* VII. DANNI PREESISTENTI */}
          <div className="border border-black mb-4">
            <div className="bg-black text-white px-2 py-1 text-sm font-bold">VII. DANNI PREESISTENTI</div>
            <div className="p-3">
              <table className="w-full text-xs border border-black">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-1 text-left w-20">Punto</th>
                    <th className="border border-black p-1 text-left">Descrizione del danno</th>
                  </tr>
                </thead>
                <tbody>
                  {(p.danni_preesistenti || []).map((d, i) => (
                    <tr key={i}>
                      <td className="border border-black p-1">{d.punto}</td>
                      <td className="border border-black p-1">{d.descrizione}</td>
                    </tr>
                  ))}
                  {(p.danni_preesistenti || []).length === 0 && (
                    <tr>
                      <td colSpan="2" className="border border-black p-2 text-center text-gray-400 italic">
                        Nessun danno dichiarato al momento della consegna.
                      </td>
                    </tr>
                  )}
                  {[...Array(Math.max(0, 4 - (p.danni_preesistenti || []).length))].map((_, i) => (
                    <tr key={`empty-${i}`}>
                      <td className="border border-black p-3"></td>
                      <td className="border border-black p-3"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* VIII. GARANZIE & PAGAMENTO */}
          <div className="border border-black">
            <div className="bg-black text-white px-2 py-1 text-sm font-bold">VIII. GARANZIE &amp; PAGAMENTO</div>
            <div className="grid grid-cols-3 text-xs">
              <div className="p-3 border-r border-black">
                <div className="font-bold mb-2">GARANTE</div>
                <p>Garante: _________________________</p>
                <p>Recapiti: _________________________</p>
                <p>Documento: _______________________</p>
              </div>
              <div className="p-3 border-r border-black bg-yellow-50">
                <div className="font-bold mb-2">CARTA DI CREDITO</div>
                <p>Circuito: _________________________</p>
                <p>Intestatario: _____________________</p>
                <p>Cifre della Carta: ________________</p>
                <p>Scadenza: ______ / ______</p>
              </div>
              <div className="p-3">
                <div className="font-bold mb-2">PAGAMENTO</div>
                <p><span className="inline-block w-4 h-4 border border-black mr-2"></span> Contanti</p>
                <p><span className="inline-block w-4 h-4 border border-black mr-2"></span> Carta di Credito</p>
                <p><span className="inline-block w-4 h-4 border border-black mr-2"></span> Bonifico</p>
              </div>
            </div>
          </div>
        </div>

        {/* ========== PAGINA 3/4 - CONDIZIONI GENERALI ========== */}
        <div data-page="3" className="p-8 print:p-6" style={{ minHeight: '297mm', pageBreakAfter: 'always' }}>
          <div className="flex justify-between items-center border-b border-black pb-2 mb-4">
            <span className="font-bold">{AGENCY.nome} - CONTRATTO</span>
            <span className="text-xs text-gray-500">Pag. 3/4</span>
          </div>

          <div className="border border-black">
            <div className="bg-black text-white px-2 py-1 text-sm font-bold">
              IX. CONDIZIONI GENERALI DI NOLEGGIO
            </div>
            <div className="p-3 text-xs leading-relaxed" style={{ fontSize: '8pt', lineHeight: '1.4' }}>
              <p className="mb-2"><strong>1.</strong> La società RE.LE.CO. Group SRL in seguito definita Locatrice, concede in noleggio alla persona che sottoscrive il presente contratto, in nome proprio ovvero in qualità di legale rappresentate della società indicata, in seguito definita Conduttore, il veicolo descritto nel contratto stesso.</p>
              
              <p className="mb-2"><strong>2.</strong> Il Conduttore dichiara che il veicolo, al momento della presa in consegna, si trova in buone condizioni di meccanica e di carrozzeria. Pertanto si obbliga a riconsegnarlo nello stesso stato in cui l'ha ricevuto, salvo il normale deterioramento dovuto all'uso, segnalando per iscritto alla Locatrice gli eventuali danni o anomalie.</p>
              
              <p className="mb-2"><strong>3.</strong> Il conduttore, all'atto della stipula del presente contratto di noleggio, dichiara di essere abilitato alla guida del veicolo noleggiato e si obbliga a presentare la relativa patente di guida in corso di validità. L'età minima per l'ammissione alla sottoscrizione del presente contratto è fissata in anni 21.</p>
              
              <p className="mb-2"><strong>4.</strong> La durata del noleggio è stabilita dal momento del ritiro del veicolo e fino alla data di riconsegna prevista indicata nel contratto. Qualora il Conduttore avesse esigenza di prolungare il periodo di noleggio stabilito in sede contrattuale, dovrà darne comunicazione alla Locatrice con almeno 24 ore di anticipo sulla scadenza del contratto stesso. In tal caso la Locatrice ha facoltà di non accogliere tale richiesta. In caso di inadempimento da parte del Conduttore delle obbligazioni sottoscritte con il presente contratto, la Locatrice ha la facoltà di risolvere di diritto il contratto stesso, inviando apposita comunicazione ai sensi dell'articolo 1456 del codice civile. Qualora al termine del periodo di noleggio concordato il Conduttore non restituisca il veicolo, la Locatrice si riserva il diritto di richiederne l'immediata riconsegna a mezzo telegramma, raccomandata A/R, PEC o Telefax. Trascorsi tre giorni dal ricevimento da parte del Conduttore della comunicazione citata senza che la Locatrice riceva valide spiegazioni in merito alla mancata riconsegna del veicolo, la stessa potrà presentare all'autorità competente denuncia/querela per l'appropriazione indebita del veicolo. In ogni caso il Conduttore sarà tenuto a versare, per ogni giorno in più, dal termine previsto per la riconsegna fino alla restituzione effettiva, il costo della tariffa a prezzo raddoppiato a titolo di penale per la ritardata restituzione del veicolo, oltre al risarcimento di eventuali danni maggiori. In caso di riconsegna dell'autovettura con ritardo rispetto all'orario stabilito in sede contrattuale, il Conduttore sarà obbligato al pagamento di una penale pari a 30€ per le prime tre ore di ritardo. Superate le tre ore di ritardo, viene applicata una penale pari all'importo della tariffa giornaliera prevista dal contratto sottoscritto. Il conduttore all'inizio del noleggio è obbligato a versare un deposito cauzionale che garantisca l'adempimento dei propri obblighi contrattuali pari a euro 1000 (mille).</p>
              
              <p className="mb-2"><strong>5.</strong> Il corrispettivo totale del noleggio sarà determinato alla stipula del contratto allegato, in base alle tariffe in vigore e dovrà essere immediatamente pagato alla Locatrice che si impegna a rilasciare regolare documento fiscale. Il pagamento dovrà essere effettuato con carta di credito. Nel caso di mancato pagamento del canone di noleggio, la Locatrice è autorizzata, previa comunicazione scritta (e-mail, fax o sms), all'incasso delle somme dovute mediante l'utilizzo diretto della carta di credito concessa a titolo di garanzia. Qualora il Conduttore richieda la consegna e/o la riconsegna del veicolo in luogo diverso della Locatrice, tutte le spese di trasferimento saranno a completo carico del Conduttore stesso.</p>
              
              <p className="mb-2"><strong>6.</strong> Le spese per il carburante sono a totale carico del Conduttore.</p>
              
              <p className="mb-2"><strong>7.</strong> Il conduttore si impegna ad utilizzare il veicolo noleggiato con diligenza e nel pieno rispetto dell'uso per cui è stato omologato. Il conduttore si impegna inoltre a non far guidare il veicolo noleggiato a terze persone, siano esse anche familiari oppure amici. Contravvenendo quanto sopra il Conduttore sarà ritenuto responsabile dei danni eventualmente arrecati sia all'autoveicolo noleggiato che a terzi.</p>
              
              <p className="mb-2"><strong>8.</strong> Le riparazioni e manutenzione sia ordinarie che straordinarie del veicolo noleggiato vengono effettuate dalla Locatrice. In caso di necessità urgenti vi può provvedere il Conduttore dietro autorizzazione scritta della Locatrice. Il Conduttore si obbliga a risarcire eventuali danni al veicolo noleggiato causati dal mancato rispetto delle norme previste dal libretto "uso e manutenzione" in dotazione al veicolo stesso. Il Conduttore si impegna inoltre a non effettuare modifiche di qualsiasi genere al veicolo noleggiato. In particolare, il Cliente si assume l'obbligo di risarcire: i danni derivanti dal rifornimento effettuato con carburante diverso da quello previsto per il motoveicolo o autovettura noleggiato; i danni derivanti da interventi di riparazione eseguiti o fatti eseguire direttamente dal Cliente senza il consenso scritto della locatrice; Nel caso in cui vengano riscontrati sul motoveicolo o autovettura danni di qualunque sorta, la ditta viene fin d'ora autorizzata a prelevare senza preavviso la cifra corrispondente all'importo dovuto sulla carta di credito del Cliente.</p>
              
              <p className="mb-2"><strong>9.</strong> Il conduttore dichiara di aver constatato che il veicolo noleggiato è regolarmente assicurato per la RCA nel rispetto delle condizioni e dei massimali previsti dalle Legge e si obbliga al pagamento delle somme dovute nel caso in cui il sinistro comporti un indennizzo superiore a quanto previsto dalla polizza. Nel caso in cui l'autovettura, al momento della riconsegna presenti danni alla carrozzeria, agli interni e/o alla parte meccanica, riconducibili alla responsabilità del Conduttore, lo stesso sarà obbligato a risarcire i danni riscontrati al mezzo, mediante l'utilizzo diretto da parte del locatore della carta di credito concessa a titolo di garanzia. In caso di sinistri a seguito di collisioni e/o ribaltamenti, il Conduttore dovrà compilare in ogni sua parte gli appositi moduli esistenti a bordo del veicolo noleggiato e contemporaneamente dovrà avvisare la Locatrice descrivendo il luogo e le cause dell'evento, indicando il nome di eventuali terze persone presenti al sinistro, specificando i danni riportati dagli automezzi, alle persone, alle cose e l'eventuale autorità intervenuta. Il Conduttore è tenuto a fornire la massima collaborazione alla Locatrice ed ai suoi assicuratori nelle investigazioni, nelle difese e nelle controversie derivanti dall'uso del veicolo noleggiato.</p>
              
              <p className="mb-2"><strong>10.</strong> Al verificarsi di un furto o incendio del veicolo noleggiato, il Conduttore si impegna ad effettuare immediata denuncia alle autorità competenti e a consegnare od inviare copia della copertura assicurativa alla Locatrice. La Locatrice si riserva il diritto di rivalersi sul Conduttore qualora la copertura assicurativa divenisse inoperante per colpa o incuria, diretta o indiretta, attribuita alla Compagnia di assicurazione del conduttore stesso.</p>
              
              <p className="mb-2"><strong>11.</strong> Le comunicazioni alla Locatrice di sinistro, furto, incendio, dovranno essere effettuate dal Conduttore nel più breve tempo possibile a mezzo telegramma, telefax. Qualora si verifichi uno dei suddetti eventi, sarà a carico del Cliente l'eventuale franchigia assicurativa (pari ad €250,00 oltre spese amministrative di €150,00) o scopertura assicurativa (pari al 20%) del valore commerciale del veicolo, prevista dalla polizza assicurativa in ordine alla garanzia furto e incendio (pari al 20%) del valore commerciale del veicolo.</p>
              
              <p className="mb-2"><strong>12.</strong> La locatrice non sarà ritenuta responsabile per perdite o danni a cose o animali lasciati all'interno o sopra il veicolo noleggiato.</p>
              
              <p className="mb-2"><strong>13.</strong> Il Conduttore si impegna a pagare tutte le ammende o le contravvenzioni elevate in relazione all'uso del veicolo noleggiato e a tenere indenne la Locatrice in caso di sequestro o di qualsiasi altro evento pregiudizievole. Il Conduttore è obbligato a rimborsare alla Locatrice quanto da essa anticipato per il pagamento di infrazioni dallo stesso commesse con conseguente liquidazione mediante utilizzo di carta di credito concessa a titolo di garanzia, ovvero in contante. In ogni caso il Conduttore è tenuto ad osservare diligentemente le normative previste dal codice della strada. Viene fin d'ora autorizzata a prelevare la cifra corrispondente all'importo dovuto sulla carta di credito del Cliente, oltre le somme inerenti alle spese amministrative di comunicazioni intercorse tra ente, organo di polizia o società gestionarie che ha sollevato la sanzione o il credito (somme amministrative di gestione pari ad €25,00 oltre IVA).</p>
              
              <p className="mb-2"><strong>14.</strong> Per qualsiasi controversia in merito al presente contratto le parti dichiarano competente il Foro della stessa città della società di noleggio.</p>
              
              <p className="mb-2"><strong>15.</strong> Per quanto non previsto nel presente contratto si fa riferimento alle norme del codice civile. Il Conduttore, con la sottoscrizione del presente contratto, dichiara di approvare pienamente e senza riserve quanto in esso contenuto. Agli effetti degli artt. 1341 e 1342 del C.C. il sottoscritto dichiara di approvare specificatamente le disposizioni dei seguenti articoli, delle condizioni contenute nel modello di cui sopra; art. 7 divieto di far guidare il veicolo ad altre persone - art.10 rivalsa sul Conduttore nel caso che la copertura assicurativa venisse inoperante - art. 11 pagamento dell'eventuale franchigia da parte del conduttore - art. 14 Il Conduttore si impegna a pagare tutte le ammende.</p>
            </div>
          </div>
        </div>

        {/* ========== PAGINA 4/4 - FIRME ========== */}
        <div data-page="4" className="p-8 print:p-6" style={{ minHeight: '297mm' }}>
          <div className="flex justify-between items-center border-b border-black pb-2 mb-4">
            <span className="font-bold">{AGENCY.nome} - CONTRATTO</span>
            <span className="text-xs text-gray-500">Pag. 4/4</span>
          </div>

          <div className="border border-black mb-8">
            <div className="bg-black text-white px-2 py-1 text-sm font-bold">
              X. DICHIARAZIONI E SOTTOSCRIZIONI
            </div>
            <div className="p-4">
              <p className="text-sm mb-6">
                Il sottoscritto locatario dichiara di aver letto attentamente e di accettare integralmente 
                le condizioni generali di noleggio riportate nel presente contratto, nonché ogni clausola ivi contenuta.
              </p>

              <div className="text-sm mb-4">
                <p>Luogo e data: <strong>{AGENCY.comune}</strong>, _______________</p>
              </div>
            </div>
          </div>

          {/* FIRME */}
          <div className="border border-black">
            <div className="bg-black text-white px-2 py-1 text-sm font-bold">
              FIRME
            </div>
            <div className="grid grid-cols-2 gap-0">
              <div className="p-6 border-r border-black text-center">
                <p className="font-bold mb-4">IL LOCATORE / NOLEGGIATORE</p>
                <div className="border-b-2 border-black h-24 mx-8 mb-2"></div>
                <p className="text-sm">Firma</p>
                <p className="text-xs text-gray-500 mt-2">{AGENCY.nome}</p>
              </div>
              <div className="p-6 text-center">
                <p className="font-bold mb-4">IL LOCATARIO / CLIENTE</p>
                <div className="border-b-2 border-black h-24 mx-8 mb-2"></div>
                <p className="text-sm">Firma</p>
                <p className="text-xs text-gray-500 mt-2">{cliente?.nome} {cliente?.cognome}</p>
              </div>
            </div>
          </div>

          {/* Firma clausole vessatorie */}
          <div className="mt-6 border border-black p-4">
            <p className="text-xs mb-4">
              Firma apposta ai sensi e per gli effetti degli artt. 1341 e 1342 c.c. con specifica 
              approvazione delle clausole eventualmente indicate nelle condizioni generali di noleggio
              (art. 7, art. 10, art. 11, art. 14):
            </p>
            <div className="grid grid-cols-2 gap-8 mt-4">
              <div className="text-center">
                <div className="border-b-2 border-black h-16 mx-12 mb-2"></div>
                <p className="text-xs">Firma Locatore</p>
              </div>
              <div className="text-center">
                <div className="border-b-2 border-black h-16 mx-12 mb-2"></div>
                <p className="text-xs">Firma Locatario</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-black text-center text-xs text-gray-500">
            <p>{AGENCY.nome} - {AGENCY.indirizzo}, {AGENCY.cap} {AGENCY.comune} ({AGENCY.provincia})</p>
            <p>P.IVA: {AGENCY.piva} - Tel: {AGENCY.telefono} - Email: {AGENCY.email}</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
