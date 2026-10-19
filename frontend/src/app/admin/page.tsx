'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useCurrentEvent } from '@/lib/use-current-event';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { Alert } from '@/components/ui/alert';
import { SettingsIcon, CalendarIcon, UserIcon, ClipboardIcon, ShieldCheckIcon, CloseIcon, PencilIcon, TrashIcon, CopyIcon, WalletIcon } from '@/components/ui/icons';
import { Dialog } from '@/components/ui/dialog';
import { deveAvisarSessao, marcarAvisoSessao } from '@/lib/saldo-aviso';
import { importProducts, getEvents, createEvent, updateEvent, updateEventStatus, deleteEvent, getUsers, updateUser, getProducts, getCategories, createProduct, updateProduct, deleteProduct, duplicateProduct, ajustarStock, getEventMembers, addEventMember, removeEventMember, getAudit, exportAuditCsv, getEventSettings, updateEventSettings, getOutstandingBalances, getReports, extendBalance, unarchiveBalance, markBalanceNotified, getPlanta, guardarPlanta, ApiError } from '@/lib/api';
import { stockBaixo, esgotado } from '@/lib/stock';
import { downloadTextFile } from '@/lib/download';
import { montarUrlMesa } from '@/lib/mesa-qr';
import {
  numerosDeIntervalo,
  agruparFolhas,
  normalizarLugares,
  aplicarLugaresTodas,
  totalLugares,
  MAX_MESAS_LOTE,
  MAX_LUGARES_MESA,
} from '@/lib/qr-lote';
import {
  criarMesa,
  moverMesa,
  adicionarMesa,
  removerMesa,
  atualizarMesa,
  mesasParaQrs,
  posicaoParaIndice,
  reorganizarMesas,
  reorganizarMesasComZonas,
  agruparMesasPorZona,
  renderSvgPlanta,
  normalizarPosicao,
  encaixarGrelha,
  resolverPlanoCargaPlanta,
  parsePlantaPendente,
  chavePlantaPendente,
  descreverIdade,
  pendentesOrfaos,
  parseDocumentoPlanta,
  corZona,
  criarZona,
  adicionarZona,
  removerZona,
  atualizarZona,
  moverZona,
  redimensionarZona,
  CORES_ZONA,
  MAX_ZONAS_PLANTA,
  type Mesa,
  type Zona,
  type FormaMesa,
} from '@/lib/planta';
import { QrLoteControlos } from '@/components/admin/qr-lote-controlos';

const roleVariant: Record<string, 'brand' | 'warning' | 'success'> = {
  superadmin: 'brand',
  organizer: 'warning',
  cashier: 'success',
  bar: 'success',
  kitchen: 'success',
  treasurer: 'success',
  client: 'warning',
};

export default function AdminPageWrapper() {
  return (
    <Suspense fallback={null}>
      <AdminPage />
    </Suspense>
  );
}

function AdminPage() {
  const { event: currentEvent } = useCurrentEvent();
  const activeEventId = currentEvent?.id;
  const activeEvent = currentEvent;
  const [activeTab, setActiveTab] = useState('eventos');
  const [events, setEvents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [memberEventId, setMemberEventId] = useState('');
  const [memberRole, setMemberRole] = useState('client');
  const [memberTarget, setMemberTarget] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [productPage, setProductPage] = useState(1);
  const [productLimit, setProductLimit] = useState(20);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productAvailability, setProductAvailability] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    startDate: '',
    endDate: '',
  });
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    availability: 'available',
    stock: '',
    stockControl: false,
    categoryId: '',
    kitchenName: '',
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit, setAuditLimit] = useState(20);
  const [auditEntity, setAuditEntity] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [auditDetail, setAuditDetail] = useState<any>(null);
  const [settingsEventId, setSettingsEventId] = useState('');
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [qrEvento, setQrEvento] = useState<any>(null);
  const [linkQr, setLinkQr] = useState('');
  const [copiadoQr, setCopiadoQr] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const copiaTimerRef = useRef<number | null>(null);
  const lugaresPadraoRef = useRef(false);
  const plantaRef = useRef<HTMLDivElement>(null);
  const plantaEstadoRef = useRef<Mesa[]>([]);
  const plantaZonasEstadoRef = useRef<Zona[]>([]);
  const plantaCarregadaRef = useRef<string>('');
  const arrastoRef = useRef<
    | { tipo: 'mesa'; id: string }
    | { tipo: 'zona'; id: string; dx: number; dy: number }
    | { tipo: 'zona-resize'; id: string }
    | null
  >(null);
  const undoSnapshotRef = useRef<{ mesas: Mesa[]; zonas: Zona[] } | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const plantaVersionRef = useRef(0);
  const plantaSaveTimerRef = useRef<number | null>(null);
  const plantaPendenteRef = useRef<{
    eventoId: string;
    shortCode: string;
    mesas: Mesa[];
    zonas: Zona[];
    version: number;
  } | null>(null);
  const plantaEditadaDesdeCargaRef = useRef(false);
  const [loteModo, setLoteModo] = useState<'intervalo' | 'nomes'>('intervalo');
  const [loteInicio, setLoteInicio] = useState('1');
  const [loteFim, setLoteFim] = useState('10');
  const [loteNomes, setLoteNomes] = useState<string[]>([]);
  const [loteTamanho, setLoteTamanho] = useState(160);
  const [loteColunas, setLoteColunas] = useState(3);
  const [loteLinhas, setLoteLinhas] = useState(4);
  const [loteGerado, setLoteGerado] = useState<string[] | null>(null);
  const [loteLugaresPadrao, setLoteLugaresPadrao] = useState(8);
  const [loteLugares, setLoteLugares] = useState<Record<string, number>>({});
  const [loteErro, setLoteErro] = useState('');
  const [loteShortCode, setLoteShortCode] = useState('');
  const [loteAgrupar, setLoteAgrupar] = useState<'nenhum' | 'zona'>('nenhum');
  const [plantaEventoId, setPlantaEventoId] = useState('');
  const [planta, setPlanta] = useState<Mesa[]>([]);
  const [plantaZonas, setPlantaZonas] = useState<Zona[]>([]);
  const [plantaSel, setPlantaSel] = useState<string | null>(null);
  const [zonaSel, setZonaSel] = useState<string | null>(null);
  const [plantaNovoNome, setPlantaNovoNome] = useState('');
  const [plantaSnap, setPlantaSnap] = useState(true);
  const [undoEtiqueta, setUndoEtiqueta] = useState<string | null>(null);
  const [plantaSync, setPlantaSync] = useState<'' | 'saving' | 'saved' | 'erro' | 'offline'>('');
  const [plantaConflito, setPlantaConflito] = useState<{
    mesas: Mesa[];
    zonas: Zona[];
    version: number;
    pendenteTs?: number;
  } | null>(null);
  const [plantaImportarDisponivel, setPlantaImportarDisponivel] = useState(false);
  const [plantaAviso, setPlantaAviso] = useState<string | null>(null);
  const [plantaLimpar, setPlantaLimpar] = useState(false);
  const [eventEditing, setEventEditing] = useState<any>(null);
  const [eventEditForm, setEventEditForm] = useState({ name: '', location: '', startDate: '', endDate: '' });
  const [eventDeleting, setEventDeleting] = useState<any>(null);
  const [actionLoadingEventId, setActionLoadingEventId] = useState('');
  const [outstandingEventId, setOutstandingEventId] = useState('');
  const [outstandingBalances, setOutstandingBalances] = useState<any[]>([]);
  const [outstandingLoading, setOutstandingLoading] = useState(false);
  const [outstandingTotal, setOutstandingTotal] = useState(0);
  const [balanceActionUserId, setBalanceActionUserId] = useState('');
  const [expiring, setExpiring] = useState<any>(null);
  const [expiringLoading, setExpiringLoading] = useState(false);
  const [expiringError, setExpiringError] = useState('');
  const [expiringPopup, setExpiringPopup] = useState(false);
  const [balancesEventId, setBalancesEventId] = useState('');
  const [balancesType, setBalancesType] = useState('');
  const [balancesFrom, setBalancesFrom] = useState('');
  const [balancesTo, setBalancesTo] = useState('');
  const [balancesQuery, setBalancesQuery] = useState('');
  const [balancesData, setBalancesData] = useState<any>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesError, setBalancesError] = useState('');
  const [productDeleting, setProductDeleting] = useState<any>(null);
  const [productDeleteError, setProductDeleteError] = useState('');
  const [productDeletingBusy, setProductDeletingBusy] = useState(false);
  // id do produto a ser duplicado, para so o botao dele ficar ocupado
  const [productDuplicatingId, setProductDuplicatingId] = useState<string | null>(null);
  const [productStockBusy, setProductStockBusy] = useState<string | null>(null);
  const [stockAdjusting, setStockAdjusting] = useState<any>(null);
  const [stockAdjustingForm, setStockAdjustingForm] = useState({ novoValor: '', motivo: '' });
  const [stockAdjustingError, setStockAdjustingError] = useState('');
  const [productEditing, setProductEditing] = useState<any>(null);
  const [productEditForm, setProductEditForm] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    stockControl: false,
    availability: 'available',
    categoryId: '',
    kitchenName: '',
  });
  const [productEditError, setProductEditError] = useState('');
  const [productEditBusy, setProductEditBusy] = useState(false);

  const tabs = [
    { id: 'eventos', label: 'Eventos', icon: <CalendarIcon className="h-4 w-4" /> },
    { id: 'produtos', label: 'Produtos', icon: <ClipboardIcon className="h-4 w-4" /> },
    { id: 'utilizadores', label: 'Utilizadores', icon: <UserIcon className="h-4 w-4" /> },
    { id: 'saldos', label: 'Saldos', icon: <WalletIcon className="h-4 w-4" /> },
    { id: 'configuracao', label: 'Configuração', icon: <SettingsIcon className="h-4 w-4" /> },
    { id: 'auditoria', label: 'Auditoria', icon: <ShieldCheckIcon className="h-4 w-4" /> },
    { id: 'planta', label: 'Planta', icon: <CalendarIcon className="h-4 w-4" /> },
  ];

  const loadEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await getEvents();
      setEvents(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await getUsers();
      setUsers(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar utilizadores');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (eventId: string) => {
    setLoading(true);
    setError('');
    try {
      const list = await getEventMembers(eventId);
      setMembers(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar membros do evento');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!memberEventId) return;
    setLoading(true);
    setError('');
    try {
      await addEventMember(memberEventId, userId, memberRole);
      await loadMembers(memberEventId);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao associar utilizador ao evento');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!memberEventId) return;
    setLoading(true);
    setError('');
    try {
      await removeEventMember(memberEventId, userId);
      await loadMembers(memberEventId);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao remover utilizador do evento');
    } finally {
      setLoading(false);
    }
  };

  const changeUserRole = async (userId: string, role: string) => {
    setError('');
    try {
      await updateUser(userId, { role });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao alterar perfil do utilizador');
    }
  };

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, cats] = await Promise.all([
        getProducts({
          page: productPage,
          limit: productLimit,
          q: productSearch || undefined,
          categoryId: productCategory || undefined,
          availability: productAvailability || undefined,
          includeInactive: true,
        }),
        getCategories(),
      ]);
      setProducts(Array.isArray(data) ? data : data?.items ?? []);
      setProductTotal(data?.total ?? (Array.isArray(data) ? data.length : 0));
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, [productPage, productLimit, productSearch, productCategory, productAvailability]);


  // Importação de produtos entre eventos
  const [showImportModal, setShowImportModal] = useState(false);
  const [sourceEventId, setSourceEventId] = useState("");
  const [importAll, setImportAll] = useState(true);
  const [sourceProducts, setSourceProducts] = useState<any[]>([]);
  const [selectedSourceProductIds, setSelectedSourceProductIds] = useState<string[]>([]);
  const [importingProducts, setImportingProducts] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState("");
  const [importError, setImportError] = useState("");

  const abrirModalImportacao = () => {
    setShowImportModal(true);
    setSourceEventId("");
    setSourceProducts([]);
    setSelectedSourceProductIds([]);
    setImportAll(true);
    setImportSuccessMsg("");
    setImportError("");
  };

  const fecharModalImportacao = () => {
    if (importingProducts) return;
    setShowImportModal(false);
    setImportError("");
    setImportSuccessMsg("");
  };

  const carregarProdutosOrigem = async (evId: string) => {
    setSourceEventId(evId);
    setImportSuccessMsg("");
    if (!evId) {
      setSourceProducts([]);
      setSelectedSourceProductIds([]);
      return;
    }
    try {
      const res = await getProducts({ eventId: evId, page: 1, limit: 100, includeInactive: true });
      const list = res.items || [];
      setSourceProducts(list);
      setSelectedSourceProductIds(list.map((p: any) => p.id));
    } catch {
      setSourceProducts([]);
      setSelectedSourceProductIds([]);
    }
  };

  const toggleSourceProduct = (id: string) => {
    setSelectedSourceProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceEventId) {
      setImportError("Selecione o evento de origem");
      return;
    }
    if (!activeEventId) {
      setImportError("Selecione um evento ativo no topo");
      return;
    }
    if (sourceEventId === activeEventId) {
      setImportError("O evento de origem deve ser diferente do evento de destino");
      return;
    }

    const idsParaImportar = importAll ? undefined : selectedSourceProductIds;
    if (!importAll && (!idsParaImportar || idsParaImportar.length === 0)) {
      setImportError("Selecione pelo menos um produto para importar");
      return;
    }

    setImportingProducts(true);
    setImportError("");
    setImportSuccessMsg("");

    try {
      const res: any = await importProducts(sourceEventId, activeEventId, idsParaImportar);
      setImportSuccessMsg(`Sucesso! ${res.importedCount} produto(s) importado(s) com sucesso.`);
      await loadProducts();
      setTimeout(() => {
        setShowImportModal(false);
        setImportSuccessMsg("");
      }, 1800);
    } catch (err: any) {
      setImportError(err?.message || "Não foi possível importar os produtos");
    } finally {
      setImportingProducts(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(productForm.price);
    if (!productForm.name || isNaN(price) || price < 0) {
      setError('Preencha o nome e um preço válido');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let stock: number | null = null;
      if (productForm.stockControl) {
        stock = productForm.stock ? parseFloat(productForm.stock) : null;
        if (stock === null || isNaN(stock) || stock < 0) {
          setError('Indique uma quantidade para controlar o stock');
          return;
        }
      }
      await createProduct({
        name: productForm.name,
        description: productForm.description || undefined,
        price,
        availability: productForm.availability,
        stock,
        categoryId: productForm.categoryId || undefined,
        kitchenName: productForm.kitchenName || undefined,
      });
      setProductForm({ name: '', description: '', price: '', availability: 'available', stock: '', stockControl: false, categoryId: '', kitchenName: '' });
      await loadProducts();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao criar produto');
    } finally {
      setLoading(false);
    }
  };

  const toggleProductActive = async (product: any) => {
    const next = product.isActive === false;
    setLoading(true);
    setError('');
    try {
      await updateProduct(product.id, { isActive: next });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isActive: next } : p)),
      );
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao atualizar produto');
    } finally {
      setLoading(false);
    }
  };

  const duplicarProduto = async (product: any) => {
    if (productDuplicatingId) return;
    setProductDuplicatingId(product.id);
    setError('');
    try {
      await duplicateProduct(product.id);
      // o nome da cópia é calculado no servidor ("(cópia)", "(cópia 2)", ...),
      // por isso recarregar em vez de acrescentar localmente: um nome
      // inventado aqui colidiria com a regra de numeração. loadProducts já
      // traz produtos e categorias.
      await loadProducts();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao duplicar produto');
    } finally {
      setProductDuplicatingId(null);
    }
  };

  // Reabastecimento rápido: um toque, +10 ou +20, sem formulário. O delta é
  // aplicado com lock e registado no audit pelo backend.
  const reabastecerProduto = async (product: any, delta: number) => {
    if (productStockBusy) return;
    setProductStockBusy(product.id);
    setError('');
    try {
      await ajustarStock(product.id, { delta, motivo: 'Reabastecimento' });
      await loadProducts();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao reabastecer stock');
    } finally {
      setProductStockBusy(null);
    }
  };

  const abrirAcertoStock = (product: any) => {
    setStockAdjustingError('');
    setStockAdjustingForm({ novoValor: String(product.stock ?? ''), motivo: '' });
    setStockAdjusting(product);
  };

  // Acerto com motivo: contagem de fim/noite, quebras, etc. Grava antes/depois
  // + razão no audit para reconciliar com as vendas.
  const handleAcertarStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockAdjusting) return;
    const novoValor = Number(stockAdjustingForm.novoValor);
    if (!Number.isFinite(novoValor) || novoValor < 0) {
      setStockAdjustingError('Indique uma quantidade válida (0 ou mais)');
      return;
    }
    setProductStockBusy(stockAdjusting.id);
    setStockAdjustingError('');
    try {
      await ajustarStock(stockAdjusting.id, {
        novoValor,
        motivo: stockAdjustingForm.motivo.trim() || 'Acerto manual',
      });
      await loadProducts();
      setStockAdjusting(null);
    } catch (err: any) {
      setStockAdjustingError(err?.message ?? 'Erro ao acertar stock');
    } finally {
      setProductStockBusy(null);
    }
  };

  const abrirEdicaoProduto = (product: any) => {
    setProductEditError('');
    setProductEditForm({
      name: product.name ?? '',
      description: product.description ?? '',
      // Number -> string: o input e controlado e um number solto faz o React
      // avisar sobre value={number}. null vira string vazia, que e o estado
      // "sem stock" e nao 0.
      price: product.price != null ? String(product.price) : '',
      stock: product.stock != null ? String(product.stock) : '',
      stockControl: product.stock != null,
      availability: product.availability ?? 'available',
      categoryId: product.category?.id ?? '',
      kitchenName: product.kitchenName ?? '',
    });
    setProductEditing(product);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productEditing || productEditBusy) return;
    const price = parseFloat(productEditForm.price);
    if (!productEditForm.name.trim() || isNaN(price) || price < 0) {
      setProductEditError('Preencha o nome e um preço válido');
      return;
    }
    let stock: number | null = null;
    if (productEditForm.stockControl) {
      stock = productEditForm.stock ? parseFloat(productEditForm.stock) : null;
      if (stock === null || isNaN(stock) || stock < 0) {
        setProductEditError('Indique uma quantidade para controlar o stock');
        return;
      }
    }
    setProductEditBusy(true);
    setProductEditError('');
    try {
      await updateProduct(productEditing.id, {
        name: productEditForm.name.trim(),
        // null e nao undefined: o JSON.stringify do cliente omite chaves com
        // undefined, o que chegaria ao backend como "nao mexer". Para o
        // utilizador conseguir limpar a descricao e o stock tem de ser null.
        description: productEditForm.description || null,
        price,
        availability: productEditForm.availability,
        stock,
        categoryId: productEditForm.categoryId || null,
        // null e nao undefined, pelo mesmo motivo da descricao: e assim que
        // o produto volta a ter o nome de menu na cozinha.
        kitchenName: productEditForm.kitchenName || null,
      });
      setProductEditing(null);
      await loadProducts();
    } catch (err: any) {
      // o dialog fica aberto para o erro ficar visivel e poder tentar de novo
      setProductEditError(err?.message ?? 'Erro ao atualizar produto');
    } finally {
      setProductEditBusy(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productDeleting || productDeletingBusy) return;
    setProductDeletingBusy(true);
    setProductDeleteError('');
    try {
      await deleteProduct(productDeleting.id);
      setProductDeleting(null);
      if (products.length === 1 && productPage > 1) {
        // era o ultimo item desta pagina: recua e deixa o efeito de
        // [productPage] recarregar. Recarregar aqui e depois recuar faria
        // duas requisicoes e mostraria a pagina vazia por um instante.
        setProductPage(productPage - 1);
      } else {
        await loadProducts();
      }
    } catch (err: any) {
      // o dialog fica aberto: o utilizador precisa de ver o erro e poder
      // tentar de novo ou cancelar
      setProductDeleteError(err?.message ?? 'Erro ao eliminar produto');
    } finally {
      setProductDeletingBusy(false);
    }
  };

  const toggleProductAvailability = async (product: any) => {
    const next = product.availability === 'available' ? 'unavailable' : 'available';
    setLoading(true);
    setError('');
    try {
      await updateProduct(product.id, { availability: next });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, availability: next } : p)),
      );
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao atualizar produto');
    } finally {
      setLoading(false);
    }
  };

  const changeProductCategory = async (product: any, categoryId: string) => {
    setError('');
    try {
      await updateProduct(product.id, { categoryId: categoryId || null });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? { ...p, category: categoryId ? categories.find((c) => c.id === categoryId) : null }
            : p,
        ),
      );
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao atualizar categoria');
    }
  };

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setError('');
    try {
      const data = await getAudit({
        page: auditPage,
        limit: auditLimit,
        entity: auditEntity || undefined,
        action: auditAction || undefined,
        from: auditFrom ? `${auditFrom}T00:00:00` : undefined,
        to: auditTo ? `${auditTo}T23:59:59` : undefined,
      });
      setAuditLogs(Array.isArray(data) ? data : data?.items ?? []);
      setAuditTotal(data?.total ?? 0);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar auditoria');
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage, auditLimit, auditEntity, auditAction, auditFrom, auditTo]);

  const handleExportAudit = async () => {
    setError('');
    try {
      const csv = await exportAuditCsv({
        entity: auditEntity || undefined,
        action: auditAction || undefined,
        from: auditFrom ? `${auditFrom}T00:00:00` : undefined,
        to: auditTo ? `${auditTo}T23:59:59` : undefined,
      });
      downloadTextFile('auditoria.csv', csv);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao exportar auditoria');
    }
  };

  const loadSettings = async (eventId: string) => {
    setSettingsLoading(true);
    setError('');
    setSettingsSaved(false);
    try {
      const settingsData = await getEventSettings(eventId);
      setSettings(settingsData ?? {});
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar configuração');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsEventId) return;
    setSettingsLoading(true);
    setError('');
    setSettingsSaved(false);
    try {
      const taxRate = settings.taxRate === undefined || settings.taxRate === '' ? undefined : Number(settings.taxRate) / 100;
      const payload: Record<string, unknown> = {
        currency: settings.currency ?? 'EUR',
        taxRate,
        serviceCharge:
          settings.serviceCharge === undefined || settings.serviceCharge === ''
            ? undefined
            : Number(settings.serviceCharge),
        requireBalance: Boolean(settings.requireBalance),
        allowOffline: Boolean(settings.allowOffline),
      };
      await updateEventSettings(settingsEventId, payload);
      setSettingsSaved(true);
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao guardar configuração');
    } finally {
      setSettingsLoading(false);
    }
  };

  const loadExpiring = useCallback(async () => {
    setExpiringLoading(true);
    setExpiringError('');
    try {
      const data = await getReports('expiring-balances', { dias: 7, limiteEventos: 5 });
      setExpiring(data ?? null);
      if ((data?.eventos?.length ?? 0) > 0 && deveAvisarSessao('admin-saldos-expirar')) {
        marcarAvisoSessao('admin-saldos-expirar');
        setExpiringPopup(true);
      }
    } catch (err: any) {
      setExpiring(null);
      setExpiringError(err?.message ?? 'Erro ao carregar saldos a expirar');
    } finally {
      setExpiringLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExpiring();
  }, [loadExpiring]);

  useEffect(() => {
    if (activeTab === 'eventos') loadEvents();
    if (activeTab === 'utilizadores') {
      loadUsers();
      loadEvents();
    }
    if (activeTab === 'produtos') loadProducts();
    if (activeTab === 'auditoria') loadAudit();
    if (activeTab === 'configuracao') loadEvents();
    if (activeTab === 'saldos') loadEvents();
    if (activeTab === 'planta') loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loadAudit, loadProducts]);

  // Carrega ao escolher evento; filtros (tipo, datas, q) só aplicam no "Atualizar".
  useEffect(() => {
    if (activeTab === 'saldos' && balancesEventId) loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balancesEventId, activeTab]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.startDate || !formData.endDate) {
      setError('Preencha nome e datas do evento');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createEvent({
        name: formData.name,
        location: formData.location || undefined,
        startDate: formData.startDate,
        endDate: formData.endDate,
      });
      setFormData({ name: '', location: '', startDate: '', endDate: '' });
      await loadEvents();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao criar evento');
    } finally {
      setLoading(false);
    }
  };

  const changeEventStatus = async (event: any, status: 'draft' | 'active' | 'closed') => {
    setActionLoadingEventId(event.id);
    setError('');
    try {
      await updateEventStatus(event.id, status);
      await loadEvents();
    } catch (err: any) {
      // Se o backend recusar reabrir (data de fim já passou), abre o editor para estender a data.
      const msg = err?.message ?? '';
      if (status === 'active' && /data de fim já passou|terminou/i.test(msg)) {
        setError(`${msg} — estenda a data no formulário abaixo e tente reabrir novamente.`);
        openEditEvent(event);
      } else {
        setError(msg || 'Erro ao alterar estado do evento');
      }
    } finally {
      setActionLoadingEventId('');
    }
  };

  const loadOutstanding = async (eventId: string) => {
    if (!eventId) {
      setOutstandingBalances([]);
      setOutstandingTotal(0);
      return;
    }
    setOutstandingLoading(true);
    setError('');
    try {
      const list = await getOutstandingBalances(eventId);
      setOutstandingBalances(Array.isArray(list) ? list : []);
      setOutstandingTotal((Array.isArray(list) ? list : []).reduce((sum, s: any) => sum + Number(s.balance ?? 0), 0));
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao carregar saldos pendentes');
    } finally {
      setOutstandingLoading(false);
    }
  };

  const runBalanceAction = async (userId: string, acao: () => Promise<any>) => {
    if (!outstandingEventId) return;
    setBalanceActionUserId(userId);
    setError('');
    try {
      await acao();
      await loadOutstanding(outstandingEventId);
    } catch (err: any) {
      setError(err?.message ?? 'Erro na operação de saldo');
    } finally {
      setBalanceActionUserId('');
    }
  };

  const handleExtend = (userId: string) => {
    const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return runBalanceAction(userId, () =>
      extendBalance(userId, { eventId: outstandingEventId, until }),
    );
  };

  const handleUnarchive = (userId: string) =>
    runBalanceAction(userId, () => unarchiveBalance(userId, outstandingEventId));

  const handleNotified = (userId: string) =>
    runBalanceAction(userId, () => markBalanceNotified(userId, outstandingEventId));

  const loadBalances = useCallback(async () => {
    if (!balancesEventId) {
      setBalancesData(null);
      setBalancesError('');
      return;
    }
    setBalancesLoading(true);
    setBalancesError('');
    try {
      const params: Record<string, string> = { eventId: balancesEventId };
      if (balancesType) params.type = balancesType;
      if (balancesFrom) params.from = `${balancesFrom}T00:00:00`;
      if (balancesTo) params.to = `${balancesTo}T23:59:59`;
      if (balancesQuery.trim()) params.q = balancesQuery.trim();
      const data = await getReports('balances', params);
      setBalancesData(data ?? null);
    } catch (err: any) {
      setBalancesData(null);
      setBalancesError(err?.message ?? 'Erro ao carregar saldos');
    } finally {
      setBalancesLoading(false);
    }
  }, [balancesEventId, balancesType, balancesFrom, balancesTo, balancesQuery]);

  const openEditEvent = (event: any) => {
    setEventEditing(event);
    setEventEditForm({
      name: event.name ?? '',
      location: event.location ?? '',
      startDate: event.startDate ? String(event.startDate).slice(0, 10) : '',
      endDate: event.endDate ? String(event.endDate).slice(0, 10) : '',
    });
    setError('');
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventEditing) return;
    if (!eventEditForm.name || !eventEditForm.startDate || !eventEditForm.endDate) {
      setError('Preencha nome e datas do evento');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await updateEvent(eventEditing.id, {
        name: eventEditForm.name,
        location: eventEditForm.location || undefined,
        startDate: eventEditForm.startDate,
        endDate: eventEditForm.endDate,
      });
      setEventEditing(null);
      await loadEvents();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao guardar evento');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventDeleting) return;
    setLoading(true);
    setError('');
    try {
      await deleteEvent(eventDeleting.id);
      setEventDeleting(null);
      await loadEvents();
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao eliminar evento');
    } finally {
      setLoading(false);
    }
  };

  const abrirQr = (evento: any) => {
    if (!evento?.shortCode) return;
    if (copiaTimerRef.current) window.clearTimeout(copiaTimerRef.current);
    setCopiadoQr(false);
    setLinkQr(`${window.location.origin}/entrar/${evento.shortCode}`);
    setQrEvento(evento);
  };

  const fecharQr = () => {
    if (copiaTimerRef.current) window.clearTimeout(copiaTimerRef.current);
    setCopiadoQr(false);
    setQrEvento(null);
    delete document.body.dataset.print;
  };

  const copiarLinkQr = async () => {
    try {
      await navigator.clipboard.writeText(linkQr);
      setCopiadoQr(true);
      if (copiaTimerRef.current) window.clearTimeout(copiaTimerRef.current);
      copiaTimerRef.current = window.setTimeout(() => setCopiadoQr(false), 1500);
    } catch {
      setCopiadoQr(false);
    }
  };

  const imprimirArea = (alvo: 'evento' | 'lote') => {
    document.body.dataset.print = alvo;
    const limpar = () => {
      delete document.body.dataset.print;
      window.removeEventListener('afterprint', limpar);
    };
    window.addEventListener('afterprint', limpar);
    window.print();
    window.setTimeout(limpar, 1500);
  };

  useEffect(() => {
    try {
      const pad = Number(localStorage.getItem('sf:qr-lugares-padrao'));
      if (Number.isFinite(pad) && pad > 0) setLoteLugaresPadrao(normalizarLugares(pad));
    } catch {}
    lugaresPadraoRef.current = true;
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem('sf:planta-snap');
      if (v !== null) setPlantaSnap(v !== '0');
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
      if (plantaSaveTimerRef.current) window.clearTimeout(plantaSaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (plantaSync !== 'saved') return;
    const t = window.setTimeout(() => setPlantaSync(''), 1500);
    return () => window.clearTimeout(t);
  }, [plantaSync]);

  useEffect(() => {
    if (!lugaresPadraoRef.current) return;
    try {
      localStorage.setItem('sf:qr-lugares-padrao', String(loteLugaresPadrao));
    } catch {}
  }, [loteLugaresPadrao]);

  useEffect(() => {
    const shortCode = qrEvento?.shortCode;
    if (!shortCode) return;
    try {
      const raw = localStorage.getItem(`sf:qr-lugares:${shortCode}`);
      setLoteLugares(raw ? JSON.parse(raw) : {});
    } catch {
      setLoteLugares({});
    }
  }, [qrEvento?.shortCode]);

  useEffect(() => {
    if (plantaEventoId || events.length === 0) return;
    const alvo = currentEvent?.id || events[0]?.id || '';
    if (alvo) setPlantaEventoId(alvo);
  }, [events, currentEvent, plantaEventoId]);

  const plantaShortCode =
    events.find((ev: any) => ev.id === plantaEventoId)?.shortCode ?? '';

  useEffect(() => {
    if (!plantaEventoId || !plantaShortCode) return;
    // Se mudou de evento, compromete o save pendente do evento anterior em vez de o descartar.
    if (plantaSaveTimerRef.current) {
      window.clearTimeout(plantaSaveTimerRef.current);
      plantaSaveTimerRef.current = null;
    }
    const pendente = plantaPendenteRef.current;
    plantaPendenteRef.current = null;
    if (pendente && pendente.shortCode !== plantaShortCode) {
      void enviarPlantaContexto(
        pendente.eventoId,
        pendente.shortCode,
        pendente.mesas,
        pendente.zonas,
        pendente.version,
      );
    }
    let pendenteInicial: ReturnType<typeof parsePlantaPendente> = null;
    try {
      pendenteInicial = parsePlantaPendente(localStorage.getItem(chavePlantaPendente(plantaShortCode)));
    } catch {}
    const docInicial = pendenteInicial
      ? { mesas: pendenteInicial.mesas, zonas: pendenteInicial.zonas }
      : parseDocumentoPlanta(localStorage.getItem(`sf:planta:${plantaShortCode}`));
    const carregadas = docInicial.mesas;
    const zonasCarregadas = docInicial.zonas;
    plantaCarregadaRef.current = plantaShortCode;
    plantaEditadaDesdeCargaRef.current = false;
    plantaEstadoRef.current = carregadas;
    plantaZonasEstadoRef.current = zonasCarregadas;
    setPlanta(carregadas);
    setPlantaZonas(zonasCarregadas);
    setPlantaSel(null);
    setZonaSel(null);
    limparUndo();
    setPlantaConflito(null);
    setPlantaImportarDisponivel(false);
    setPlantaAviso(null);
    setPlantaSync('');
    const eventoId = plantaEventoId;
    let cancelado = false;
    void (async () => {
      try {
        const remoto = await getPlanta(eventoId);
        if (cancelado || plantaCarregadaRef.current !== plantaShortCode) return;
        const versaoServidor = typeof remoto?.version === 'number' ? remoto.version : 0;
        const docRemoto = parseDocumentoPlanta(JSON.stringify(remoto ?? null));
        // Actualiza a version base mesmo que não apliquemos as mesas, para o próximo save
        // não partir de uma version desactualizada.
        plantaVersionRef.current = versaoServidor;
        const plano = resolverPlanoCargaPlanta({
          editadoDesdeCarga: plantaEditadaDesdeCargaRef.current,
          pendente: pendenteInicial,
          remoto: { mesas: docRemoto.mesas, zonas: docRemoto.zonas, version: versaoServidor },
          local: { mesas: carregadas, zonas: zonasCarregadas },
        });
        if (plano.tipo === 'ignorar') return;
        if (plano.tipo === 'oferecer-importacao') {
          setPlantaImportarDisponivel(true);
          return;
        }
        if (plano.tipo === 'conflito-pendente') {
          // O servidor mudou desde a edição pendente: não sobrescrever; oferecer escolha.
          setPlantaConflito({
            mesas: plano.mesas,
            zonas: plano.zonas,
            version: plano.version,
            pendenteTs: plano.pendenteTs,
          });
          setPlantaSync('');
          return;
        }
        plantaEstadoRef.current = plano.mesas;
        plantaZonasEstadoRef.current = plano.zonas;
        if (plano.tipo === 'retomar-pendente') {
          // O servidor está intacto desde a falha: reenvia a edição local sem banner.
          void enviarPlantaContexto(
            eventoId,
            plantaShortCode,
            plano.mesas,
            plano.zonas,
            plano.version,
          );
          return;
        }
        setPlanta(plano.mesas);
        setPlantaZonas(plano.zonas);
        try {
          localStorage.setItem(
            `sf:planta:${plantaShortCode}`,
            JSON.stringify({ mesas: plano.mesas, zonas: plano.zonas }),
          );
        } catch {}
      } catch {
        if (cancelado || plantaCarregadaRef.current !== plantaShortCode) return;
        // Offline ou servidor indisponível: mantém a cópia local.
        setPlantaSync('offline');
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantaEventoId, plantaShortCode]);

  useEffect(() => {
    if (events.length === 0) return;
    try {
      const validos = events.map((ev: any) => ev.shortCode).filter(Boolean);
      for (const chave of pendentesOrfaos(Object.keys(localStorage), validos)) {
        localStorage.removeItem(chave);
      }
    } catch {}
  }, [events]);

  const gravarLugaresEvento = (mapa: Record<string, number>) => {
    const shortCode = qrEvento?.shortCode;
    if (!shortCode) return;
    try {
      localStorage.setItem(`sf:qr-lugares:${shortCode}`, JSON.stringify(mapa));
    } catch {}
  };

  const ajustarQtdNomes = (valor: string) => {
    const qtd = Math.max(0, Math.min(100, Math.floor(Number(valor) || 0)));
    setLoteNomes((prev) => {
      const proximo = prev.slice(0, qtd);
      for (let i = proximo.length; i < qtd; i++) proximo.push('');
      return proximo;
    });
  };

  const definirLugarMesa = (mesa: string, valor: number) => {
    setLoteLugares((prev) => {
      const next = { ...prev, [mesa]: normalizarLugares(valor) };
      gravarLugaresEvento(next);
      return next;
    });
  };

  const aplicarATodas = () => {
    if (!loteGerado) return;
    const next = aplicarLugaresTodas(loteGerado, loteLugaresPadrao);
    setLoteLugares(next);
    gravarLugaresEvento(next);
  };

  const gerarLote = () => {
    setLoteErro('');
    if (!qrEvento?.shortCode) return;
    const mesas =
      loteModo === 'intervalo'
        ? numerosDeIntervalo(Number(loteInicio), Number(loteFim))
        : loteNomes.map((n) => n.trim()).filter(Boolean);
    if (!mesas.length) {
      setLoteGerado(null);
      setLoteErro(
        loteModo === 'intervalo'
          ? `Intervalo inválido. Usa mesas a partir da 1 e no máximo ${MAX_MESAS_LOTE} de uma vez.`
          : 'Preenche pelo menos um nome de mesa.',
      );
      return;
    }
    setLoteGerado(mesas);
    setLoteShortCode(qrEvento.shortCode);
    setLoteLugares((prev) => {
      const next: Record<string, number> = {};
      for (const mesa of mesas) next[mesa] = prev[mesa] ?? loteLugaresPadrao;
      return next;
    });
  };

  const gravarPlanta = (mesas: Mesa[]) => {
    if (!plantaShortCode) return;
    if (plantaCarregadaRef.current !== plantaShortCode) return;
    try {
      localStorage.setItem(
        `sf:planta:${plantaShortCode}`,
        JSON.stringify({ mesas, zonas: plantaZonasEstadoRef.current }),
      );
    } catch {}
  };

  const enviarPlantaContexto = async (
    eventoId: string,
    shortCode: string,
    mesas: Mesa[],
    zonas: Zona[],
    version: number,
  ) => {
    if (!eventoId || !shortCode) return;
    const ativo = () => plantaCarregadaRef.current === shortCode;
    if (ativo()) setPlantaSync('saving');
    try {
      const r = await guardarPlanta(eventoId, { mesas, zonas, version });
      try {
        localStorage.setItem(`sf:planta:${shortCode}`, JSON.stringify({ mesas, zonas }));
        localStorage.removeItem(chavePlantaPendente(shortCode));
      } catch {}
      if (!ativo()) return;
      plantaVersionRef.current =
        typeof r?.version === 'number' ? r.version : plantaVersionRef.current + 1;
      setPlantaConflito(null);
      setPlantaSync('saved');
    } catch (e) {
      // Persiste a edição por sincronizar para não se perder num reload/troca de evento.
      try {
        localStorage.setItem(
          chavePlantaPendente(shortCode),
          JSON.stringify({ mesas, zonas, version, ts: Date.now() }),
        );
      } catch {}
      if (!ativo()) {
        // O evento já não está activo (flush ao trocar de evento): não podemos mostrar o
        // conflito no contexto do evento actual, mas a edição ficou guardada localmente.
        setPlantaAviso(
          e instanceof ApiError && e.status === 409
            ? 'Uma edição do evento anterior ficou por sincronizar (conflito no servidor). Volta a esse evento para reconciliar.'
            : 'Uma edição do evento anterior ficou por sincronizar (falha de ligação). Volta a esse evento para reconciliar.',
        );
        return;
      }
      if (e instanceof ApiError && e.status === 409) {
        const body = e.body ?? {};
        const doc = parseDocumentoPlanta(JSON.stringify(body));
        setPlantaConflito({
          mesas: doc.mesas,
          zonas: doc.zonas,
          version: typeof body.version === 'number' ? body.version : 0,
        });
        setPlantaSync('');
      } else {
        setPlantaSync('erro');
      }
    }
  };

  const enviarPlanta = (mesas: Mesa[]) => {
    if (plantaCarregadaRef.current !== plantaShortCode) return;
    void enviarPlantaContexto(
      plantaEventoId,
      plantaShortCode,
      mesas,
      plantaZonasEstadoRef.current,
      plantaVersionRef.current,
    );
  };

  const agendarGuardarPlanta = (mesas: Mesa[]) => {
    if (!plantaEventoId || !plantaShortCode) return;
    if (plantaCarregadaRef.current !== plantaShortCode) return;
    plantaPendenteRef.current = {
      eventoId: plantaEventoId,
      shortCode: plantaShortCode,
      mesas,
      zonas: plantaZonasEstadoRef.current,
      version: plantaVersionRef.current,
    };
    if (plantaSaveTimerRef.current) window.clearTimeout(plantaSaveTimerRef.current);
    plantaSaveTimerRef.current = window.setTimeout(() => {
      plantaSaveTimerRef.current = null;
      const pendente = plantaPendenteRef.current;
      plantaPendenteRef.current = null;
      if (pendente) {
        void enviarPlantaContexto(
          pendente.eventoId,
          pendente.shortCode,
          pendente.mesas,
          pendente.zonas,
          pendente.version,
        );
      }
    }, 800);
  };

  const recarregarPlantaRemota = () => {
    const conflito = plantaConflito;
    if (!conflito) return;
    plantaVersionRef.current = conflito.version;
    plantaEstadoRef.current = conflito.mesas;
    plantaZonasEstadoRef.current = conflito.zonas;
    setPlanta(conflito.mesas);
    setPlantaZonas(conflito.zonas);
    setPlantaSel(null);
    setZonaSel(null);
    limparUndo();
    if (plantaShortCode) {
      try {
        localStorage.setItem(
          `sf:planta:${plantaShortCode}`,
          JSON.stringify({ mesas: conflito.mesas, zonas: conflito.zonas }),
        );
        localStorage.removeItem(chavePlantaPendente(plantaShortCode));
      } catch {}
    }
    setPlantaConflito(null);
    setPlantaSync('');
  };

  const forcarGuardarPlanta = () => {
    const conflito = plantaConflito;
    if (!conflito) return;
    plantaVersionRef.current = conflito.version;
    setPlantaConflito(null);
    void enviarPlanta(plantaEstadoRef.current);
  };

  const importarPlantaLocal = () => {
    setPlantaImportarDisponivel(false);
    void enviarPlanta(plantaEstadoRef.current);
  };

  const descartarPlantaLocal = () => {
    setPlantaImportarDisponivel(false);
    plantaVersionRef.current = 0;
    plantaEstadoRef.current = [];
    plantaZonasEstadoRef.current = [];
    setPlanta([]);
    setPlantaZonas([]);
    setPlantaSel(null);
    setZonaSel(null);
    limparUndo();
    if (plantaShortCode) {
      try {
        localStorage.removeItem(`sf:planta:${plantaShortCode}`);
        localStorage.removeItem(chavePlantaPendente(plantaShortCode));
      } catch {}
    }
  };

  const limparUndo = () => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    undoSnapshotRef.current = null;
    setUndoEtiqueta(null);
  };

  const definirDocumento = (mesas: Mesa[], zonas: Zona[]) => {
    plantaEstadoRef.current = mesas;
    plantaZonasEstadoRef.current = zonas;
    plantaEditadaDesdeCargaRef.current = true;
    setPlanta(mesas);
    setPlantaZonas(zonas);
    gravarPlanta(mesas);
    agendarGuardarPlanta(mesas);
    limparUndo();
  };

  const definirPlanta = (mesas: Mesa[]) => {
    definirDocumento(mesas, plantaZonasEstadoRef.current);
  };

  const definirZonas = (zonas: Zona[]) => {
    definirDocumento(plantaEstadoRef.current, zonas);
  };

  const definirSnap = (valor: boolean) => {
    setPlantaSnap(valor);
    try {
      localStorage.setItem('sf:planta-snap', valor ? '1' : '0');
    } catch {}
  };

  const oferecerUndo = (snapshot: { mesas: Mesa[]; zonas: Zona[] }, etiqueta: string) => {
    limparUndo();
    undoSnapshotRef.current = { mesas: snapshot.mesas.slice(), zonas: snapshot.zonas.slice() };
    setUndoEtiqueta(etiqueta);
    undoTimerRef.current = window.setTimeout(() => {
      undoSnapshotRef.current = null;
      setUndoEtiqueta(null);
    }, 6000);
  };

  const desfazer = () => {
    const snapshot = undoSnapshotRef.current;
    if (!snapshot) return;
    definirDocumento(snapshot.mesas, snapshot.zonas);
  };

  const autoOrganizarPlanta = () => {
    const antes = plantaEstadoRef.current;
    if (antes.length < 2) return;
    const zonas = plantaZonasEstadoRef.current;
    const snapshot = { mesas: antes, zonas };
    definirPlanta(zonas.length > 0 ? reorganizarMesasComZonas(antes, zonas) : reorganizarMesas(antes));
    oferecerUndo(snapshot, 'Planta organizada');
  };

  const adicionarMesaPlanta = () => {
    if (!plantaEventoId) return;
    const atual = plantaEstadoRef.current;
    const nome = plantaNovoNome.trim() || `Mesa ${atual.length + 1}`;
    const { x, y } = posicaoParaIndice(atual.length, atual.length + 1);
    const nova = criarMesa(nome, loteLugaresPadrao, 'redonda', x, y);
    definirPlanta(adicionarMesa(atual, nova));
    setPlantaNovoNome('');
    setPlantaSel(nova.id);
  };

  const duplicarMesaPlanta = (id: string) => {
    const atual = plantaEstadoRef.current;
    const origem = atual.find((m) => m.id === id);
    if (!origem) return;
    const { x, y } = posicaoParaIndice(atual.length, atual.length + 1);
    const copia = criarMesa(`${origem.nome} (cópia)`, origem.lugares, origem.forma, x, y);
    definirPlanta(adicionarMesa(atual, copia));
    setPlantaSel(copia.id);
  };

  const removerMesaPlanta = (id: string) => {
    definirPlanta(removerMesa(plantaEstadoRef.current, id));
    setPlantaSel((atual) => (atual === id ? null : atual));
  };

  const editarMesaPlanta = (id: string, patch: Partial<Omit<Mesa, 'id'>>) => {
    definirPlanta(atualizarMesa(plantaEstadoRef.current, id, patch));
  };

  const limparPlanta = () => {
    const antes = plantaEstadoRef.current;
    const snapshot = { mesas: antes, zonas: plantaZonasEstadoRef.current };
    definirPlanta([]);
    setPlantaSel(null);
    setPlantaLimpar(false);
    if (antes.length > 0) oferecerUndo(snapshot, 'Planta limpa');
  };

  const onMesaPointerDown = (e: React.PointerEvent, mesa: Mesa) => {
    e.preventDefault();
    limparUndo();
    setPlantaSel(mesa.id);
    setZonaSel(null);
    arrastoRef.current = { tipo: 'mesa', id: mesa.id };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const onZonaPointerDown = (e: React.PointerEvent, zona: Zona) => {
    e.preventDefault();
    limparUndo();
    setZonaSel(zona.id);
    setPlantaSel(null);
    const rect = plantaRef.current?.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (rect) {
      const rawX = ((e.clientX - rect.left) / rect.width) * 100;
      const rawY = ((e.clientY - rect.top) / rect.height) * 100;
      dx = rawX - zona.x;
      dy = rawY - zona.y;
    }
    arrastoRef.current = { tipo: 'zona', id: zona.id, dx, dy };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const onZonaResizePointerDown = (e: React.PointerEvent, zona: Zona) => {
    e.preventDefault();
    e.stopPropagation();
    limparUndo();
    setZonaSel(zona.id);
    setPlantaSel(null);
    arrastoRef.current = { tipo: 'zona-resize', id: zona.id };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const onPlantaPointerMove = (e: React.PointerEvent) => {
    const arrasto = arrastoRef.current;
    const rect = plantaRef.current?.getBoundingClientRect();
    if (!arrasto || !rect) return;
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    if (arrasto.tipo === 'mesa') {
      const x = plantaSnap ? encaixarGrelha(rawX) : normalizarPosicao(rawX);
      const y = plantaSnap ? encaixarGrelha(rawY) : normalizarPosicao(rawY);
      const next = moverMesa(plantaEstadoRef.current, arrasto.id, x, y);
      plantaEstadoRef.current = next;
      plantaEditadaDesdeCargaRef.current = true;
      setPlanta(next);
      return;
    }
    if (arrasto.tipo === 'zona') {
      const x = rawX - arrasto.dx;
      const y = rawY - arrasto.dy;
      const next = moverZona(
        plantaZonasEstadoRef.current,
        arrasto.id,
        plantaSnap ? encaixarGrelha(x) : x,
        plantaSnap ? encaixarGrelha(y) : y,
      );
      plantaZonasEstadoRef.current = next;
      plantaEditadaDesdeCargaRef.current = true;
      setPlantaZonas(next);
      return;
    }
    const zona = plantaZonasEstadoRef.current.find((z) => z.id === arrasto.id);
    if (!zona) return;
    const w = rawX - zona.x;
    const h = rawY - zona.y;
    const next = redimensionarZona(
      plantaZonasEstadoRef.current,
      arrasto.id,
      plantaSnap ? encaixarGrelha(w) : w,
      plantaSnap ? encaixarGrelha(h) : h,
    );
    plantaZonasEstadoRef.current = next;
    plantaEditadaDesdeCargaRef.current = true;
    setPlantaZonas(next);
  };

  const onPlantaPointerUp = () => {
    if (arrastoRef.current) {
      gravarPlanta(plantaEstadoRef.current);
      agendarGuardarPlanta(plantaEstadoRef.current);
    }
    arrastoRef.current = null;
  };

  const onMesaKeyDown = (e: React.KeyboardEvent, mesa: Mesa) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removerMesaPlanta(mesa.id);
      return;
    }
    const passo = e.shiftKey ? 5 : 2;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = -passo;
    else if (e.key === 'ArrowRight') dx = passo;
    else if (e.key === 'ArrowUp') dy = -passo;
    else if (e.key === 'ArrowDown') dy = passo;
    else return;
    e.preventDefault();
    const atual = plantaEstadoRef.current.find((m) => m.id === mesa.id) ?? mesa;
    definirPlanta(moverMesa(plantaEstadoRef.current, mesa.id, atual.x + dx, atual.y + dy));
  };

  const adicionarZonaPlanta = () => {
    if (!plantaEventoId) return;
    const atual = plantaZonasEstadoRef.current;
    if (atual.length >= MAX_ZONAS_PLANTA) return;
    const zona = criarZona(`Zona ${atual.length + 1}`, corZona(atual.length));
    definirZonas(adicionarZona(atual, zona));
    setZonaSel(zona.id);
    setPlantaSel(null);
  };

  const removerZonaPlanta = (id: string) => {
    setZonaSel((atual) => (atual === id ? null : atual));
    definirZonas(removerZona(plantaZonasEstadoRef.current, id));
  };

  const editarZonaPlanta = (id: string, patch: Partial<Omit<Zona, 'id'>>) => {
    definirZonas(atualizarZona(plantaZonasEstadoRef.current, id, patch));
  };

  const onZonaKeyDown = (e: React.KeyboardEvent, zona: Zona) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removerZonaPlanta(zona.id);
    }
  };

  const gerarQrsDaPlanta = () => {
    const mesas =
      loteAgrupar === 'zona'
        ? agruparMesasPorZona(plantaEstadoRef.current, plantaZonasEstadoRef.current).flatMap(
            (grupo) => grupo.mesas,
          )
        : plantaEstadoRef.current;
    const { nomes, lugares } = mesasParaQrs(mesas);
    if (!nomes.length) return;
    setLoteGerado(nomes);
    setLoteLugares(lugares);
    setLoteShortCode(plantaShortCode);
    if (plantaShortCode) {
      try {
        localStorage.setItem(`sf:qr-lugares:${plantaShortCode}`, JSON.stringify(lugares));
      } catch {}
    }
  };

  const exportarPlantaPng = () => {
    const svg = renderSvgPlanta({
      mesas: plantaEstadoRef.current,
      zonas: plantaZonasEstadoRef.current,
    });
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0b0b0f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((png) => {
          if (!png) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(png);
          a.download = `planta-${plantaShortCode || 'evento'}.png`;
          a.click();
          URL.revokeObjectURL(a.href);
        }, 'image/png');
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  const descartarLote = () => {
    setLoteGerado(null);
    setLoteLugares({});
    setLoteShortCode('');
  };

  const descarregarQr = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas || !qrEvento) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `qr-${qrEvento.shortCode}.png`;
    a.click();
  };

  const duplicadosAtuais = useMemo(() => mesasParaQrs(planta).duplicados, [planta]);
  const mesasDuplicadas = useMemo(
    () => new Set(duplicadosAtuais.map((d) => d.nome.trim().toLowerCase())),
    [duplicadosAtuais],
  );
  const eventoDoLote = useMemo(
    () => events.find((ev: any) => ev.shortCode === loteShortCode),
    [events, loteShortCode],
  );
  const loteDeOutroEvento = useMemo(
    () => !!loteGerado && !!loteShortCode && !!qrEvento && loteShortCode !== qrEvento.shortCode,
    [loteGerado, loteShortCode, qrEvento],
  );

  return (
    <>
      <title>Admin - SenhasFestas</title>

      <AppShell>
        <PageHeader
          title="Painel de Administração"
          subtitle="Gerir eventos, utilizadores e configurações"
          icon={<SettingsIcon className="h-5 w-5" />}
        />

        <Tabs items={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

        {plantaAviso && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2">
            <span className="text-xs text-amber-200">{plantaAviso}</span>
            <Button size="sm" variant="outline" onClick={() => setPlantaAviso(null)}>
              Fechar
            </Button>
          </div>
        )}

        {activeTab === 'eventos' && (
          <div className="space-y-6">
            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-2">Eventos</h2>
              <p className="text-zinc-400 mb-6 text-sm">
                Gerir eventos, criar novos, editar datas e fechar eventos.
              </p>

              {loading && events.length === 0 ? null : events.length === 0 ? (
                <div className="text-sm text-zinc-400 py-4">Nenhum evento criado ainda.</div>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <Card key={event.id} hover className="bg-surface border-border-hover">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-xl brand-chip">
                            <CalendarIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-100">{event.name}</div>
                            <div className="text-sm text-zinc-400 mt-1">
                              {event.location || 'Local não definido'} •{' '}
                              {new Date(event.startDate).toLocaleDateString('pt-PT')} a{' '}
                              {new Date(event.endDate).toLocaleDateString('pt-PT')}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={
                            event.status === 'active'
                              ? 'success'
                              : event.status === 'draft'
                                ? 'warning'
                                : 'danger'
                          }
                          dot
                        >
                          {event.status === 'active' ? 'Ativo' : event.status === 'draft' ? 'Rascunho' : 'Fechado'}
                        </Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {event.status === 'draft' && (
                          <Button
                            variant="success"
                            size="sm"
                            loading={actionLoadingEventId === event.id}
                            onClick={() => changeEventStatus(event, 'active')}
                          >
                            Ativar Evento
                          </Button>
                        )}
                        {event.status === 'active' && (
                          <>
                            <Button
                              variant="danger"
                              size="sm"
                              loading={actionLoadingEventId === event.id}
                              onClick={() => changeEventStatus(event, 'closed')}
                            >
                              Fechar Evento
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              loading={actionLoadingEventId === event.id}
                              onClick={() => changeEventStatus(event, 'draft')}
                            >
                              Voltar a Rascunho
                            </Button>
                          </>
                        )}
                        {event.status === 'closed' && (
                          <Button
                            variant="success"
                            size="sm"
                            loading={actionLoadingEventId === event.id}
                            onClick={() => changeEventStatus(event, 'active')}
                          >
                            Reabrir Evento
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => openEditEvent(event)}>
                          Editar
                        </Button>
                        {event.shortCode && (
                          <Button variant="outline" size="sm" onClick={() => abrirQr(event)}>
                            Ver QR
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEventDeleting(event)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          Eliminar
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>

            <Dialog
              open={!!qrEvento}
              onClose={fecharQr}
              title="QR do evento"
              description={
                qrEvento
                  ? `Os clientes apontam a câmara para entrar em ${qrEvento.name}.`
                  : undefined
              }
            >
              {qrEvento && (
                <>
                  <div className="qr-print-area flex flex-col items-center gap-4">
                    <p className="text-sm font-bold text-zinc-100">{qrEvento.name}</p>
                    <div className="rounded-2xl bg-white p-4">
                      <QRCodeCanvas ref={qrCanvasRef} value={linkQr} size={220} level="M" />
                    </div>
                    <p className="text-xs text-zinc-400 break-all text-center">{linkQr}</p>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    <Button size="sm" onClick={() => imprimirArea('evento')}>
                      Imprimir
                    </Button>
                    <Button size="sm" variant="outline" onClick={copiarLinkQr}>
                      {copiadoQr ? 'Copiado!' : 'Copiar link'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={descarregarQr}>
                      Descarregar PNG
                    </Button>
                  </div>

                  {loteDeOutroEvento && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2">
                      <span className="text-xs text-amber-300">
                        O lote ativo é do evento{' '}
                        <strong>{eventoDoLote?.name ?? loteShortCode}</strong>, não deste.
                      </span>
                      <Button size="sm" variant="ghost" onClick={descartarLote}>
                        Descartar lote
                      </Button>
                    </div>
                  )}

                  <div className="mt-6 border-t border-border pt-5">
                    <h3 className="text-sm font-bold text-zinc-100 mb-1">QRs por mesa</h3>
                    <p className="text-xs text-zinc-400 mb-3">
                      Gera QRs para várias mesas de uma vez e imprime numa grelha A4 pronta a recortar.
                    </p>

                    <div
                      role="group"
                      aria-label="Modo de criação de mesas"
                      className="flex gap-1 p-1 rounded-xl bg-surface border border-border mb-4"
                    >
                      {(['intervalo', 'nomes'] as const).map((modo) => (
                        <button
                          key={modo}
                          type="button"
                          onClick={() => {
                            setLoteModo(modo);
                            setLoteGerado(null);
                          }}
                          aria-pressed={loteModo === modo}
                          className={cn(
                            'flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                            loteModo === modo
                              ? 'bg-brand/15 text-brand'
                              : 'text-zinc-400 hover:text-zinc-200',
                          )}
                        >
                          {modo === 'intervalo' ? 'Intervalo (nº a nº)' : 'Nomes personalizados'}
                        </button>
                      ))}
                    </div>

                    {loteModo === 'intervalo' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Da mesa nº"
                          value={loteInicio}
                          onChange={(e) => {
                            setLoteInicio(e.target.value);
                            setLoteGerado(null);
                          }}
                          inputMode="numeric"
                          placeholder="1"
                        />
                        <Input
                          label="Até à mesa nº"
                          value={loteFim}
                          onChange={(e) => {
                            setLoteFim(e.target.value);
                            setLoteGerado(null);
                          }}
                          inputMode="numeric"
                          placeholder="10"
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Input
                          label="Quantas mesas?"
                          type="number"
                          min="1"
                          max="100"
                          value={loteNomes.length ? String(loteNomes.length) : ''}
                          onChange={(e) => {
                            ajustarQtdNomes(e.target.value);
                            setLoteGerado(null);
                          }}
                          placeholder="ex: 6"
                        />
                        {loteNomes.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {loteNomes.map((nome, i) => (
                              <Input
                                key={i}
                                label={`Mesa ${i + 1}`}
                                value={nome}
                                onChange={(e) => {
                                  const valor = e.target.value;
                                  setLoteNomes((prev) => prev.map((n, j) => (j === i ? valor : n)));
                                  setLoteGerado(null);
                                }}
                                placeholder="ex: Balcão"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <QrLoteControlos
                      className="mt-4"
                      tamanho={loteTamanho}
                      onTamanho={setLoteTamanho}
                      colunas={loteColunas}
                      onColunas={setLoteColunas}
                      linhas={loteLinhas}
                      onLinhas={setLoteLinhas}
                    />

                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <label className="block w-40">
                        <span className="block text-sm font-medium text-zinc-400 mb-1.5">Lugares por mesa</span>
                        <input
                          type="number"
                          min="0"
                          max={MAX_LUGARES_MESA}
                          value={loteLugaresPadrao}
                          onChange={(e) => setLoteLugaresPadrao(normalizarLugares(Number(e.target.value)))}
                          className="w-full bg-surface-solid border border-border rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                        />
                      </label>
                      <Button size="sm" variant="outline" onClick={aplicarATodas} disabled={!loteGerado}>
                        Aplicar a todas
                      </Button>
                      {loteGerado && loteGerado.length > 0 && (
                        <span className="text-xs text-zinc-400">
                          {loteGerado.length} mesa(s) · {totalLugares(loteGerado, loteLugares)} lugares
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Button size="sm" onClick={gerarLote} disabled={!qrEvento?.shortCode}>
                        Gerar QRs
                      </Button>
                      {loteGerado && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => imprimirArea('lote')}>
                            Imprimir
                          </Button>
                          <span className="text-xs text-zinc-400">
                            {loteGerado.length} mesa(s) •{' '}
                            {agruparFolhas(loteGerado, loteColunas * loteLinhas).length} folha(s)
                          </span>
                        </>
                      )}
                    </div>

                    {loteErro && <p className="mt-2 text-xs text-red-400">{loteErro}</p>}

                    {loteGerado && loteGerado.length > 0 && (
                      <details className="mt-4 rounded-xl border border-border bg-zinc-900/40">
                        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-zinc-300">
                          Ajustar lugares por mesa
                        </summary>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-border p-3 max-h-56 overflow-auto">
                          {loteGerado.map((mesa) => (
                            <label
                              key={mesa}
                              className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5"
                            >
                              <span className="flex-1 truncate text-xs text-zinc-300">{mesa}</span>
                              <input
                                type="number"
                                min="0"
                                max={MAX_LUGARES_MESA}
                                value={loteLugares[mesa] ?? ''}
                                onChange={(e) => definirLugarMesa(mesa, Number(e.target.value))}
                                className="w-14 rounded-md bg-surface-solid border border-border px-1.5 py-1 text-xs text-right text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40"
                              />
                            </label>
                          ))}
                        </div>
                      </details>
                    )}

                    {loteGerado && loteGerado.length > 0 && (
                      <div className="mt-4 max-h-80 overflow-auto rounded-xl border border-border bg-zinc-900/40 p-3">
                        <div className="min-w-max space-y-3">
                          {agruparFolhas(loteGerado, loteColunas * loteLinhas).map((folha, fi) => (
                            <div key={fi}>
                              <div className="qr-sheet" style={{ ['--qr-cols' as any]: loteColunas }}>
                                {folha.map((mesa) => (
                                  <div key={mesa} className="qr-card">
                                    <QRCodeSVG
                                      value={montarUrlMesa(window.location.origin, loteShortCode, mesa)}
                                      size={loteTamanho}
                                      level="M"
                                      className="max-w-full h-auto"
                                    />
                                    <span className="qr-card-label">{mesa}{(loteLugares[mesa] ?? 0) > 0 ? ` · ${loteLugares[mesa]} lugares` : ''}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </Dialog>

            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-4">Criar Evento</h2>
              <form onSubmit={handleCreateEvent} className="space-y-4 max-w-lg">
                <Input
                  label="Nome do evento"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Festa de Aldeia - Agosto 2026"
                  required
                />
                <Input
                  label="Local"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Praça Central"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Início"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                  <Input
                    label="Fim"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" loading={loading}>
                  {loading ? 'A criar...' : 'Criar Evento'}
                </Button>
              </form>
            </Card>

            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-2">Saldos pendentes por evento</h2>
              <p className="text-zinc-400 mb-4 text-sm">
                Clientes com saldo carregado ainda não gasto. Os estornos continuam disponíveis
                depois do evento fechar — nunca há devolução automática.
              </p>

              <div className="space-y-4 max-w-lg">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-400">Evento</label>
                  <select
                    value={outstandingEventId}
                    onChange={(e) => {
                      setOutstandingEventId(e.target.value);
                      loadOutstanding(e.target.value);
                    }}
                    className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                  >
                    <option value="">Selecionar evento...</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                </div>

                {outstandingEventId && (
                  <div>
                    {outstandingLoading ? (
                      <div className="text-sm text-zinc-400 py-2">A carregar saldos...</div>
                    ) : outstandingBalances.length === 0 ? (
                      <div className="text-sm text-zinc-400 py-2">
                        Nenhum cliente com saldo pendente neste evento.
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between py-2 border-b border-border">
                          <span className="text-xs text-zinc-400">
                            {outstandingBalances.length} cliente{outstandingBalances.length === 1 ? '' : 's'} com saldo
                          </span>
                          <Badge variant="warning">
                            Total: €{outstandingTotal.toFixed(2)}
                          </Badge>
                        </div>
                        <div className="space-y-2 pt-2 max-h-72 overflow-y-auto">
                          {outstandingBalances.map((s: any) => {
                            const busy = balanceActionUserId === s.userId;
                            return (
                              <Card key={s.userId} padding="sm" className="flex items-center justify-between gap-3 bg-surface">
                                <div className="min-w-0">
                                  <span className="text-sm text-zinc-200">{s.name}</span>
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    {s.archivedAt ? (
                                      <Badge variant="danger">Arquivado</Badge>
                                    ) : null}
                                    {s.notifiedAt ? (
                                      <Badge variant="info">
                                        Avisado {new Date(s.notifiedAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}
                                      </Badge>
                                    ) : null}
                                    {s.deadline ? (
                                      <span className="text-xs text-zinc-500">
                                        expira em {new Date(s.deadline).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="success">€{Number(s.balance).toFixed(2)}</Badge>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    loading={busy}
                                    disabled={busy}
                                    onClick={() => handleExtend(s.userId)}
                                  >
                                    Estender +7d
                                  </Button>
                                  {s.archivedAt ? (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      loading={busy}
                                      disabled={busy}
                                      onClick={() => handleUnarchive(s.userId)}
                                    >
                                      Desarquivar
                                    </Button>
                                  ) : null}
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    loading={busy}
                                    disabled={busy}
                                    onClick={() => handleNotified(s.userId)}
                                  >
                                    Marcar avisado
                                  </Button>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'utilizadores' && (
          <div className="space-y-6">
            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-2">Utilizadores</h2>
              <p className="text-zinc-400 mb-6 text-sm">Gerir perfis e permissões dos utilizadores do evento.</p>

              {users.length === 0 && !loading ? (
                <div className="text-sm text-zinc-400 py-4">Nenhum utilizador encontrado.</div>
              ) : (
                <div className="space-y-3">
                  {users.map((user, idx) => (
                    <Card
                      key={user.id}
                      hover
                      padding="sm"
                      className={`flex items-center justify-between bg-surface animate-fade-in stagger-${idx + 1}`}
                    >
                      <span className="flex items-center gap-3 text-zinc-200">
                        <span className="h-8 w-8 rounded-full bg-gradient-to-br from-brand/30 to-brand/10 border border-brand/30 flex items-center justify-center text-xs font-bold text-brand-light">
                          {(user.name || user.email || '?').charAt(0).toUpperCase()}
                        </span>
                        <span>
                          <span className="block">{user.name}</span>
                          <span className="block text-xs text-zinc-400">{user.email}</span>
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <select
                          value={user.role}
                          onChange={(e) => changeUserRole(user.id, e.target.value)}
                          aria-label={`Perfil de ${user.name ?? user.email}`}
                          className="bg-surface-solid border border-border rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/40"
                        >
                          <option value="client">Cliente</option>
                          <option value="bar">Bar</option>
                          <option value="kitchen">Cozinha</option>
                          <option value="cashier">Caixa</option>
                          <option value="treasurer">Tesoureiro</option>
                          <option value="organizer">Organizador</option>
                          <option value="superadmin">Superadmin</option>
                        </select>
                        <Badge variant={roleVariant[user.role] ?? 'warning'}>{user.role}</Badge>
                      </span>
                    </Card>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-2">Associar ao Evento</h2>
              <p className="text-zinc-400 mb-6 text-sm">
                Associe utilizadores a um evento para terem acesso ao menu, caixa e relatórios.
              </p>

              <div className="space-y-4 max-w-lg">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-400">Evento</label>
                  <select
                    value={memberEventId}
                    onChange={(e) => {
                      setMemberEventId(e.target.value);
                      setMembers([]);
                      if (e.target.value) loadMembers(e.target.value);
                    }}
                    className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                  >
                    <option value="">Selecionar evento...</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                </div>

                {memberEventId && (
                  <>
                    <div className="flex items-center gap-3">
                      <select
                        value={memberTarget}
                        onChange={(e) => setMemberTarget(e.target.value)}
                        className="flex-1 bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                      >
                        <option value="">Selecionar utilizador...</option>
                        {users
                          .filter((u) => !members.some((m) => m.userId === u.id))
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </option>
                          ))}
                      </select>
                      <select
                        value={memberRole}
                        onChange={(e) => setMemberRole(e.target.value)}
                        className="bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                      >
                        <option value="client">Cliente</option>
                        <option value="bar">Bar</option>
                        <option value="kitchen">Cozinha</option>
                        <option value="cashier">Caixa</option>
                        <option value="treasurer">Tesoureiro</option>
                        <option value="organizer">Organizador</option>
                      </select>
                      <Button
                        type="button"
                        onClick={() => handleAddMember(memberTarget)}
                        disabled={!memberTarget}
                      >
                        Associar
                      </Button>
                    </div>

                    <div className="space-y-2 pt-2">
                      {members.length === 0 ? (
                        <div className="text-sm text-zinc-400">Nenhum membro associado a este evento.</div>
                      ) : (
                        members.map((m) => (
                          <Card key={m.id} padding="sm" className="flex items-center justify-between bg-surface">
                            <span className="flex items-center gap-3 text-zinc-200">
                              <span className="h-8 w-8 rounded-full bg-gradient-to-br from-brand/30 to-brand/10 border border-brand/30 flex items-center justify-center text-xs font-bold text-brand-light">
                                {(m.name || m.email || '?').charAt(0).toUpperCase()}
                              </span>
                              <span>
                                <span className="block">{m.name}</span>
                                <span className="block text-xs text-zinc-400">{m.email}</span>
                              </span>
                            </span>
                            <span className="flex items-center gap-3">
                              <Badge variant={roleVariant[m.role] ?? 'warning'}>{m.role}</Badge>
                              <Button variant="danger" size="sm" onClick={() => handleRemoveMember(m.userId)}>
                                Remover
                              </Button>
                            </span>
                          </Card>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'saldos' && (
          <div className="space-y-6">
            <Card>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-50 mb-2">Saldos a expirar</h2>
                  <p className="text-zinc-400 text-sm">
                    Eventos com saldos por vencer nos próximos {expiring?.dias ?? 7} dias —
                    até 5 eventos, do prazo mais próximo ao mais distante.
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={loadExpiring} disabled={expiringLoading}>
                  Atualizar
                </Button>
              </div>

              {expiringError && <Alert variant="error" message={expiringError} className="mb-4" />}

              {expiringLoading && !expiring ? (
                <div className="text-sm text-zinc-400 py-2">A carregar saldos a expirar...</div>
              ) : (expiring?.eventos ?? []).length === 0 ? (
                <div className="text-sm text-zinc-400 py-2">
                  Sem saldos a expirar nos próximos {expiring?.dias ?? 7} dias.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {expiring.eventos.map((ev: any) => (
                      <Card
                        key={ev.eventId}
                        padding="sm"
                        className="flex flex-wrap items-center justify-between gap-3 bg-surface"
                      >
                        <div>
                          <div className="text-sm font-medium text-zinc-100">{ev.nome}</div>
                          <div className="text-xs text-zinc-500">
                            Prazo: {new Date(ev.deadline).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant={ev.diasRestantes <= 1 ? 'danger' : 'warning'}>
                            {ev.diasRestantes <= 0
                              ? 'expira hoje'
                              : ev.diasRestantes === 1
                                ? 'expira amanhã'
                                : `expira em ${ev.diasRestantes} dias`}
                          </Badge>
                          <span className="text-xs text-zinc-400">
                            {ev.clientes} cliente{ev.clientes === 1 ? '' : 's'}
                          </span>
                          <span className="text-sm font-mono text-amber-300">€{Number(ev.total).toFixed(2)}</span>
                          <Button variant="ghost" size="sm" onClick={() => setBalancesEventId(ev.eventId)}>
                            Ver saldos
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">
                    Total: {expiring.totalClientes} cliente{expiring.totalClientes === 1 ? '' : 's'} • €{Number(expiring.total).toFixed(2)}
                  </div>
                </>
              )}
            </Card>

            <Card>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-50 mb-2">Saldos por cliente</h2>
                  <p className="text-zinc-400 text-sm">
                    Carregamentos e consumos do evento, por cliente. Os valores líquidos já
                    descontam estornos (cancel) e reembolsos (refund).
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={loadBalances} disabled={balancesLoading || !balancesEventId}>
                  Atualizar
                </Button>
              </div>

              <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <select
                  value={balancesEventId}
                  onChange={(e) => setBalancesEventId(e.target.value)}
                  aria-label="Filtrar por evento"
                  className="bg-surface-solid border border-border rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/40"
                >
                  <option value="">Selecionar evento...</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                    </option>
                  ))}
                </select>
                <select
                  value={balancesType}
                  onChange={(e) => setBalancesType(e.target.value)}
                  aria-label="Filtrar por tipo de movimento"
                  className="bg-surface-solid border border-border rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/40"
                >
                  <option value="">Todos os tipos</option>
                  <option value="load">Carregamentos</option>
                  <option value="consume">Consumos</option>
                  <option value="cancel">Estornos</option>
                  <option value="refund">Reembolsos</option>
                </select>
                <input
                  type="date"
                  value={balancesFrom}
                  onChange={(e) => setBalancesFrom(e.target.value)}
                  aria-label="Data inicial"
                  className="bg-surface-solid border border-border rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
                <input
                  type="date"
                  value={balancesTo}
                  onChange={(e) => setBalancesTo(e.target.value)}
                  aria-label="Data final"
                  className="bg-surface-solid border border-border rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
                <input
                  type="search"
                  value={balancesQuery}
                  onChange={(e) => setBalancesQuery(e.target.value)}
                  placeholder="Nome, email ou telefone"
                  aria-label="Pesquisar cliente"
                  className="bg-surface-solid border border-border rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>

              {balancesError && <Alert variant="error" message={balancesError} className="mb-4" />}
            </Card>

            {!balancesEventId ? (
              <Card>
                <div className="text-sm text-zinc-400 py-2">
                  Selecione um evento para ver os saldos por cliente.
                </div>
              </Card>
            ) : balancesLoading && !balancesData ? (
              <Card>
                <div className="text-sm text-zinc-400 py-2">A carregar saldos...</div>
              </Card>
            ) : balancesData ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Carregado (líquido)', value: balancesData.totals?.loadedNet, sub: `bruto €${Number(balancesData.totals?.loadedGross ?? 0).toFixed(2)}` },
                    { label: 'Consumido (líquido)', value: balancesData.totals?.consumedNet, sub: `bruto €${Number(balancesData.totals?.consumedGross ?? 0).toFixed(2)}` },
                    { label: 'A favor dos clientes', value: Number(balancesData.totals?.loadedNet ?? 0) - Number(balancesData.totals?.consumedNet ?? 0), sub: 'líquido carregado - consumido' },
                    { label: 'Movimentos', value: balancesData.movementCount, sub: `${balancesData.items?.length ?? 0} cliente(s)` },
                  ].map((stat) => (
                    <Card key={stat.label} padding="sm">
                      <div className="text-xs text-zinc-400 mb-1">{stat.label}</div>
                      <div className="text-lg font-bold text-zinc-50 font-mono">
                        {stat.label === 'Movimentos' ? stat.value : `€${Number(stat.value ?? 0).toFixed(2)}`}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">{stat.sub}</div>
                    </Card>
                  ))}
                </div>

                <Card padding="none" className="overflow-hidden">
                  {(balancesData.items ?? []).length === 0 ? (
                    <div className="text-sm text-zinc-400 py-4 px-4">
                      Sem movimentos de saldo para este evento com os filtros atuais.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-surface-hover border-b border-border">
                            {['Cliente', 'Carregado (bruto / líquido)', 'Consumido (bruto / líquido)', 'Movimentos'].map((h) => (
                              <th key={h} className="px-4 py-3 text-left font-medium text-zinc-400">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(balancesData.items ?? []).map((item: any) => (
                            <tr key={item.userId} className="border-b border-border last:border-0 hover:bg-surface-hover transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-medium text-zinc-100">{item.name ?? 'Cliente'}</div>
                                {(item.email || item.phone) && (
                                  <div className="text-xs text-zinc-500">{item.email ?? item.phone}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono">
                                <span className="text-emerald-400">€{Number(item.loadedGross ?? 0).toFixed(2)}</span>
                                <span className="text-zinc-500"> / </span>
                                <span className="text-zinc-200">€{Number(item.loadedNet ?? 0).toFixed(2)}</span>
                              </td>
                              <td className="px-4 py-3 font-mono">
                                <span className="text-amber-300">€{Number(item.consumedGross ?? 0).toFixed(2)}</span>
                                <span className="text-zinc-500"> / </span>
                                <span className="text-zinc-200">€{Number(item.consumedNet ?? 0).toFixed(2)}</span>
                              </td>
                              <td className="px-4 py-3 text-zinc-300">{item.movementCount ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </>
            ) : null}
          </div>
        )}

        {activeTab === 'produtos' && (
          <div className="space-y-6">
            <Card>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold text-zinc-50 mb-1">Produtos</h2>
                  <p className="text-zinc-400 text-sm">
                    Catálogo de produtos e preços do evento. {productTotal > 0 && `${productTotal} produto${productTotal === 1 ? '' : 's'}.`}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={abrirModalImportacao}
                  disabled={loading}
                  icon={<CopyIcon className="h-4 w-4" />}
                >
                  Importar produtos
                </Button>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Input
                  label="Procurar"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductPage(1);
                  }}
                  placeholder="Nome do produto..."
                  className="w-full"
                />
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Categoria</label>
                  <select
                    value={productCategory}
                    onChange={(e) => {
                      setProductCategory(e.target.value);
                      setProductPage(1);
                    }}
                    className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                  >
                    <option value="">Todas as categorias</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Disponibilidade</label>
                  <select
                    value={productAvailability}
                    onChange={(e) => {
                      setProductAvailability(e.target.value);
                      setProductPage(1);
                    }}
                    className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                  >
                    <option value="">Todas</option>
                    <option value="available">Disponível</option>
                    <option value="limited">Limitado</option>
                    <option value="unavailable">Indisponível</option>
                  </select>
                </div>
              </div>

              <div className="mt-6">
                {loading && products.length === 0 ? null : products.length === 0 ? (
                  <div className="text-sm text-zinc-400 py-4">
                    {productSearch || productCategory || productAvailability
                      ? 'Nenhum produto corresponde aos filtros.'
                      : 'Nenhum produto criado ainda.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {products.map((product) => (
                      <Card
                        key={product.id}
                        hover
                        // produto inactivo nao aparece no POS nem no QR. A card
                        // esbatida diz-o sem depender de ler o badge.
                        className={`bg-surface border-border-hover ${product.isActive === false ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-semibold text-zinc-100">{product.name}</div>
                            {product.description && (
                              <div className="text-sm text-zinc-400 mt-1">{product.description}</div>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="success">€{Number(product.price).toFixed(2)}</Badge>
                              <Badge
                                variant={
                                  product.availability === 'available'
                                    ? 'success'
                                    : product.availability === 'limited'
                                      ? 'warning'
                                      : 'danger'
                                }
                              >
                                {product.availability === 'available'
                                  ? 'Disponível'
                                  : product.availability === 'limited'
                                    ? 'Limitado'
                                    : 'Indisponível'}
                              </Badge>
                              {product.stock != null && (
                                <Badge variant={esgotado(product) ? 'danger' : stockBaixo(product) ? 'warning' : 'neutral'}>
                                  {esgotado(product) ? 'Esgotado' : stockBaixo(product) ? `Stock baixo: ${product.stock}` : `Stock: ${product.stock}`}
                                </Badge>
                              )}
                              {product.isActive === false && (
                                <Badge variant="neutral">Inativo — escondido do POS e QR</Badge>
                              )}
                            </div>
                            {product.stock != null && (
                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-zinc-400">Reabastecer:</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => reabastecerProduto(product, 10)}
                                  disabled={loading || !!productStockBusy || !!productDuplicatingId}
                                >
                                  +10
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => reabastecerProduto(product, 20)}
                                  disabled={loading || !!productStockBusy || !!productDuplicatingId}
                                >
                                  +20
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => abrirAcertoStock(product)}
                                  disabled={loading || !!productStockBusy}
                                >
                                  Acerto...
                                </Button>
                              </div>
                            )}
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <select
                                value={product.category?.id ?? ''}
                                onChange={(e) => changeProductCategory(product, e.target.value)}
                                aria-label={`Categoria de ${product.name}`}
                                className="text-xs bg-surface-solid border border-border rounded-lg px-2 py-1 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/40"
                              >
                                <option value="">Sem categoria</option>
                                {categories.map((c) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                              <Button
                                variant={product.isActive === false ? 'success' : 'outline'}
                                size="sm"
                                onClick={() => toggleProductActive(product)}
                                disabled={loading}
                              >
                                {product.isActive === false ? 'Ativar no catálogo' : 'Desativar no catálogo'}
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-col items-stretch gap-2">
                            <Button
                              variant={product.availability === 'available' ? 'danger' : 'success'}
                              size="sm"
                              onClick={() => toggleProductAvailability(product)}
                              disabled={loading}
                            >
                              {/* availability, nao isActive. O botao da esquerda
                                  diz "Desativar no catalogo" e mexe no isActive,
                                  este mexe so na disponibilidade dentro do mesmo
                                  evento — dois "Desativar" na mesma card era
                                  curto-circuito garantido. */}
                              {product.availability === 'available' ? 'Marcar indisponível' : 'Marcar disponível'}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<PencilIcon className="h-4 w-4" />}
                              onClick={() => abrirEdicaoProduto(product)}
                              disabled={loading || productDeletingBusy || productEditBusy}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<CopyIcon className="h-4 w-4" />}
                              onClick={() => duplicarProduto(product)}
                              disabled={loading || !!productDuplicatingId}
                              aria-label={`Duplicar ${product.name}`}
                            >
                              {productDuplicatingId === product.id ? 'Duplicando...' : 'Duplicar'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<TrashIcon className="h-4 w-4" />}
                              onClick={() => {
                                setProductDeleteError('');
                                setProductDeleting(product);
                              }}
                              disabled={loading || productDeletingBusy}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {productTotal > 0 && (
                <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">Por página</span>
                    <select
                      value={productLimit}
                      onChange={(e) => {
                        setProductLimit(Number(e.target.value));
                        setProductPage(1);
                      }}
                      aria-label="Produtos por página"
                      className="bg-surface-solid border border-border rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/40"
                    >
                      <option value="20">20</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={loading || productPage <= 1}
                      onClick={() => setProductPage(productPage - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="text-xs text-zinc-400">
                      {productPage} / {Math.max(1, Math.ceil(productTotal / productLimit))}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={loading || productPage >= Math.max(1, Math.ceil(productTotal / productLimit))}
                      onClick={() => setProductPage(productPage + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Dialog
              open={!!productEditing}
              onClose={() => {
                if (!productEditBusy) {
                  setProductEditing(null);
                  setProductEditError('');
                }
              }}
              title="Editar produto"
              className="max-w-xl"
            >
              <form onSubmit={handleUpdateProduct} className="space-y-4">
                {productEditError && <Alert variant="error" message={productEditError} />}
                <Input
                  label="Nome do produto"
                  value={productEditForm.name}
                  onChange={(e) => setProductEditForm({ ...productEditForm, name: e.target.value })}
                  required
                />
                <Textarea
                  label="Descrição (opcional)"
                  value={productEditForm.description}
                  onChange={(e) =>
                    setProductEditForm({ ...productEditForm, description: e.target.value })
                  }
                  rows={3}
                />
                <Input
                  label="Nome na cozinha (opcional)"
                  value={productEditForm.kitchenName}
                  onChange={(e) =>
                    setProductEditForm({ ...productEditForm, kitchenName: e.target.value })
                  }
                  placeholder="igual ao nome do produto"
                  hint="É o que o ecrã da cozinha mostra. Vazio usa o nome do produto."
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Preço (€)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={productEditForm.price}
                    onChange={(e) => setProductEditForm({ ...productEditForm, price: e.target.value })}
                    required
                  />
                  <div className="space-y-1.5">
                    <span className="block text-sm font-medium text-zinc-400">Controlo de stock</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setProductEditForm({ ...productEditForm, stockControl: false })
                        }
                        className={cn(
                          'flex-1 rounded-xl border px-3 py-2 text-sm transition-colors',
                          !productEditForm.stockControl
                            ? 'bg-brand/10 border-brand/50 text-zinc-100'
                            : 'bg-surface border-border text-zinc-400 hover:bg-surface-hover',
                        )}
                      >
                        Sem stock
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductEditForm({ ...productEditForm, stockControl: true })}
                        className={cn(
                          'flex-1 rounded-xl border px-3 py-2 text-sm transition-colors',
                          productEditForm.stockControl
                            ? 'bg-brand/10 border-brand/50 text-zinc-100'
                            : 'bg-surface border-border text-zinc-400 hover:bg-surface-hover',
                        )}
                      >
                        Com stock
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      {productEditForm.stockControl
                        ? 'O stock abate a cada pedido e repõe-se quando o pedido é cancelado. Em 0, o produto fica esgotado.'
                        : 'Menu aberto: vende-se sem limite, o bar decide quando acabar.'}
                    </p>
                    {productEditForm.stockControl && (
                      <Input
                        label="Quantidade"
                        type="number"
                        min="0"
                        step="1"
                        autoFocus
                        value={productEditForm.stock}
                        onChange={(e) => setProductEditForm({ ...productEditForm, stock: e.target.value })}
                        placeholder="Ex.: 50"
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="product-edit-category" className="block text-sm font-medium text-zinc-400">
                    Categoria
                  </label>
                  <select
                    id="product-edit-category"
                    value={productEditForm.categoryId}
                    onChange={(e) =>
                      setProductEditForm({ ...productEditForm, categoryId: e.target.value })
                    }
                    className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="product-edit-availability" className="block text-sm font-medium text-zinc-400">
                    Disponibilidade
                  </label>
                  <select
                    id="product-edit-availability"
                    value={productEditForm.availability}
                    onChange={(e) =>
                      setProductEditForm({ ...productEditForm, availability: e.target.value })
                    }
                    className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                  >
                    <option value="available">Disponível</option>
                    <option value="limited">Limitado</option>
                    <option value="unavailable">Indisponível</option>
                  </select>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setProductEditing(null);
                      setProductEditError('');
                    }}
                    disabled={productEditBusy}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" loading={productEditBusy}>
                    Guardar
                  </Button>
                </div>
              </form>
            </Dialog>

            <Dialog
              open={!!stockAdjusting}
              onClose={() => {
                if (!productStockBusy) {
                  setStockAdjusting(null);
                  setStockAdjustingError('');
                }
              }}
              title="Acerto de stock"
              description={
                stockAdjusting
                  ? `${stockAdjusting.name} — corrige a contagem real (fim de noite, quebras). A diferença fica registada na auditoria.`
                  : undefined
              }
              className="max-w-md"
            >
              <form onSubmit={handleAcertarStock} className="space-y-4">
                {stockAdjustingError && <Alert variant="error" message={stockAdjustingError} />}
                <Input
                  type="number"
                  min={0}
                  step={1}
                  label="Quantidade real"
                  value={stockAdjustingForm.novoValor}
                  onChange={(e) =>
                    setStockAdjustingForm({ ...stockAdjustingForm, novoValor: e.target.value })
                  }
                  required
                />
                <Input
                  label="Motivo (opcional)"
                  placeholder="Ex.: quebraram 2 copos, sobra do Dia 1..."
                  value={stockAdjustingForm.motivo}
                  onChange={(e) =>
                    setStockAdjustingForm({ ...stockAdjustingForm, motivo: e.target.value })
                  }
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setStockAdjusting(null);
                      setStockAdjustingError('');
                    }}
                    disabled={!!productStockBusy}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" loading={productStockBusy === stockAdjusting?.id}>
                    Aplicar acerto
                  </Button>
                </div>
              </form>
            </Dialog>

            <Dialog
              open={!!productDeleting}
              onClose={() => {
                // enquanto o request esta a correr o dialog nao fecha: assim o
                // erro fica visivel e nao ha duplo envio
                if (!productDeletingBusy) {
                  setProductDeleting(null);
                  setProductDeleteError('');
                }
              }}
              title="Eliminar produto?"
              description={
                productDeleting
                  ? `${productDeleting.name} deixa de aparecer no catálogo, no POS e no QR. Os pedidos já feitos mantêm o registo.`
                  : undefined
              }
              footer={
                <>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => {
                      setProductDeleting(null);
                      setProductDeleteError('');
                    }}
                    disabled={productDeletingBusy}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="danger"
                    type="button"
                    onClick={handleDeleteProduct}
                    loading={productDeletingBusy}
                  >
                    Eliminar
                  </Button>
                </>
              }
            >
              {productDeleteError && (
                <Alert variant="error" message={productDeleteError} />
              )}
            </Dialog>

            <Dialog
              open={showImportModal}
              onClose={fecharModalImportacao}
              title="Importar produtos"
              description="Copia produtos de outro evento para o evento ativo. As categorias com o mesmo nome são reutilizadas; as novas são criadas."
              className="max-w-xl"
            >
              <form onSubmit={handleImportSubmit} className="space-y-4">
                {importError && <Alert variant="error" message={importError} />}
                {importSuccessMsg && <Alert variant="success" message={importSuccessMsg} />}

                {!activeEventId ? (
                  <Alert
                    variant="info"
                    message="Não há evento de destino. Seleciona um evento ativo no seletor no topo da página e volta a abrir esta janela."
                  />
                ) : (
                  <>
                    <p className="text-sm text-zinc-400">
                      Destino:{' '}
                      <span className="text-zinc-200 font-medium">
                        {activeEvent?.name ?? activeEventId}
                      </span>
                    </p>

                    <div className="space-y-1.5">
                      <label htmlFor="import-source" className="block text-sm font-medium text-zinc-400">
                        Evento de origem
                      </label>
                      <select
                        id="import-source"
                        value={sourceEventId}
                        onChange={(e) => carregarProdutosOrigem(e.target.value)}
                        disabled={importingProducts}
                        className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40 disabled:opacity-50"
                      >
                        <option value="">Escolhe o evento...</option>
                        {events
                          .filter((e) => e.id !== activeEventId)
                          .map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name ?? e.id}
                            </option>
                          ))}
                      </select>
                    </div>

                    {sourceEventId && (
                      <>
                        <label className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={importAll}
                            onChange={(e) => setImportAll(e.target.checked)}
                            disabled={importingProducts}
                            className="h-4 w-4 accent-brand"
                          />
                          <span>Importar todos os produtos ativos do evento de origem</span>
                        </label>

                        {!importAll &&
                          (sourceProducts.length === 0 ? (
                            <p className="text-sm text-zinc-400">
                              Este evento não tem produtos ativos para importar.
                            </p>
                          ) : (
                            <div className="max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                              {sourceProducts.map((productSource) => (
                                <label
                                  key={productSource.id}
                                  className="flex items-center gap-3 px-3 py-2 text-sm text-zinc-300 cursor-pointer hover:bg-surface"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedSourceProductIds.includes(productSource.id)}
                                    onChange={() => toggleSourceProduct(productSource.id)}
                                    disabled={importingProducts}
                                    className="h-4 w-4 accent-brand"
                                  />
                                  <span className="flex-1">{productSource.name}</span>
                                  <span className="text-zinc-500">
                                    €{Number(productSource.price ?? 0).toFixed(2)}
                                  </span>
                                </label>
                              ))}
                            </div>
                          ))}
                      </>
                    )}
                  </>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={fecharModalImportacao}
                    disabled={importingProducts}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    loading={importingProducts}
                    disabled={
                      !activeEventId ||
                      !sourceEventId ||
                      sourceEventId === activeEventId
                    }
                  >
                    Importar
                  </Button>
                </div>
              </form>
            </Dialog>

            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-4">Criar Produto</h2>
              <form onSubmit={handleCreateProduct} className="space-y-4 max-w-lg">
                <Input
                  label="Nome do produto"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="Bifana"
                  required
                />
                <Textarea
                  label="Descrição (opcional)"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  rows={3}
                  placeholder="Pão, carne e molho da casa..."
                />
                <Input
                  label="Nome na cozinha (opcional)"
                  value={productForm.kitchenName}
                  onChange={(e) => setProductForm({ ...productForm, kitchenName: e.target.value })}
                  placeholder="igual ao nome do produto"
                  hint="É o que o ecrã da cozinha mostra. Vazio usa o nome do produto."
                />
                <div className="space-y-1.5">
  <span className="block text-sm font-medium text-zinc-400">Controlo de stock</span>
  <div className="flex gap-2">
    <button
      type="button"
      onClick={() => setProductForm({ ...productForm, stockControl: false })}
      className={cn(
        'flex-1 rounded-xl border px-3 py-2 text-sm transition-colors',
        !productForm.stockControl
          ? 'bg-brand/10 border-brand/50 text-zinc-100'
          : 'bg-surface border-border text-zinc-400 hover:bg-surface-hover',
      )}
    >
      Sem stock
    </button>
    <button
      type="button"
      onClick={() => setProductForm({ ...productForm, stockControl: true })}
      className={cn(
        'flex-1 rounded-xl border px-3 py-2 text-sm transition-colors',
        productForm.stockControl
          ? 'bg-brand/10 border-brand/50 text-zinc-100'
          : 'bg-surface border-border text-zinc-400 hover:bg-surface-hover',
      )}
    >
      Com stock
    </button>
  </div>
  <p className="text-xs text-zinc-500 leading-relaxed">
    {productForm.stockControl
      ? 'O stock abate a cada pedido e repõe-se quando o pedido é cancelado. Em 0, o produto fica esgotado.'
      : 'Menu aberto: vende-se sem limite, o bar decide quando acabar.'}
  </p>
  {productForm.stockControl && (
    <Input
      label="Quantidade"
      type="number"
      min="0"
      step="1"
      value={productForm.stock}
      onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
      placeholder="Ex.: 50"
    />
  )}
</div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-400">Categoria</label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                    className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-400">Disponibilidade</label>
                  <select
                    value={productForm.availability}
                    onChange={(e) => setProductForm({ ...productForm, availability: e.target.value })}
                    className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                  >
                    <option value="available">Disponível</option>
                    <option value="limited">Limitado</option>
                    <option value="unavailable">Indisponível</option>
                  </select>
                </div>
                <Button type="submit" loading={loading}>
                  {loading ? 'A criar...' : 'Criar Produto'}
                </Button>
              </form>
            </Card>
          </div>
        )}

        {activeTab === 'configuracao' && (
          <div className="space-y-6">
            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-2">Configuração do Evento</h2>
              <p className="text-zinc-400 mb-6 text-sm">
                Configurar moeda, impostos e regras de um evento. As alterações ficam guardadas na base de dados.
              </p>

              <div className="space-y-4 max-w-lg">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-400">Evento</label>
                  <select
                    value={settingsEventId}
                    onChange={(e) => {
                      setSettingsEventId(e.target.value);
                      setSettings({});
                      setSettingsSaved(false);
                      if (e.target.value) loadSettings(e.target.value);
                    }}
                    className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                  >
                    <option value="">Selecionar evento...</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                </div>

                {settingsEventId && (
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-zinc-400">Moeda</label>
                      <select
                        value={settings.currency ?? 'EUR'}
                        onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                        className="w-full bg-surface-solid border border-border rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                      >
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="BRL">BRL (R$)</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="IVA (%)"
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={
                          settings.taxRate === undefined ? '' : String(Number(settings.taxRate) * 100)
                        }
                        onChange={(e) =>
                          setSettings({ ...settings, taxRate: e.target.value === '' ? '' : Number(e.target.value) / 100 })
                        }
                        placeholder="6"
                      />
                      <Input
                        label="Taxa de serviço"
                        type="number"
                        min="0"
                        step="0.5"
                        value={settings.serviceCharge ?? ''}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            serviceCharge:
                              e.target.value === '' ? '' : Number(e.target.value),
                          })
                        }
                        placeholder="0.50"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
                        <span className="text-sm text-zinc-300">Exigir saldo para pedidos</span>
                        <input
                          type="checkbox"
                          checked={Boolean(settings.requireBalance)}
                          onChange={(e) =>
                            setSettings({ ...settings, requireBalance: e.target.checked })
                          }
                          className="h-4 w-4 accent-brand"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
                        <span className="text-sm text-zinc-300">Permitir modo offline</span>
                        <input
                          type="checkbox"
                          checked={Boolean(settings.allowOffline)}
                          onChange={(e) =>
                            setSettings({ ...settings, allowOffline: e.target.checked })
                          }
                          className="h-4 w-4 accent-brand"
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button type="submit" loading={settingsLoading}>
                        {settingsLoading ? 'A guardar...' : 'Guardar'}
                      </Button>
                      {settingsSaved && <Badge variant="success">Configuração guardada</Badge>}
                    </div>
                  </form>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'auditoria' && (
          <div className="space-y-6">
            <Card>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-50 mb-2">Auditoria</h2>
                  <p className="text-zinc-400 text-sm">
                    Registo imutável de todas as ações (login, carregamentos, cancelamentos, fecho de caixa...).
                    {auditTotal > 0 && (
                      <span className="text-zinc-400">
                        {' '}
                        • {auditTotal} registos • página {auditPage} de {Math.max(1, Math.ceil(auditTotal / auditLimit))}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={loadAudit} disabled={auditLoading}>
                    Atualizar
                  </Button>
                  <Button size="sm" onClick={handleExportAudit} disabled={auditLoading}>
                    Exportar CSV
                  </Button>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <select
                  value={auditEntity}
                  onChange={(e) => {
                    setAuditEntity(e.target.value);
                    setAuditPage(1);
                  }}
                  aria-label="Filtrar por entidade"
                  className="bg-surface-solid border border-border rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/40"
                >
                  <option value="">Todas as entidades</option>
                  <option value="auth">auth</option>
                  <option value="user">user</option>
                  <option value="event">event</option>
                  <option value="order">order</option>
                  <option value="product">product</option>
                  <option value="category">category</option>
                  <option value="balance">balance</option>
                  <option value="cash-closure">cash-closure</option>
                  <option value="reports">reports</option>
                </select>
                <select
                  value={auditAction}
                  onChange={(e) => {
                    setAuditAction(e.target.value);
                    setAuditPage(1);
                  }}
                  aria-label="Filtrar por ação"
                  className="bg-surface-solid border border-border rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/40"
                >
                  <option value="">Todas as ações</option>
                  <option value="CREATE">CREATE</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                  <option value="LOGIN">LOGIN</option>
                  <option value="LOGIN_FAILED">LOGIN_FAILED</option>
                  <option value="LOGOUT">LOGOUT</option>
                  <option value="LOAD">LOAD</option>
                  <option value="CANCEL">CANCEL</option>
                  <option value="REVERSAL">REVERSAL</option>
                  <option value="OPEN">OPEN</option>
                  <option value="CLOSE">CLOSE</option>
                  <option value="STATUS">STATUS</option>
                  <option value="SETTINGS">SETTINGS</option>
                  <option value="MEMBER">MEMBER</option>
                  <option value="EXPORT">EXPORT</option>
                </select>
                <input
                  type="date"
                  value={auditFrom}
                  onChange={(e) => {
                    setAuditFrom(e.target.value);
                    setAuditPage(1);
                  }}
                  aria-label="Data inicial"
                  className="bg-surface-solid border border-border rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
                <input
                  type="date"
                  value={auditTo}
                  onChange={(e) => {
                    setAuditTo(e.target.value);
                    setAuditPage(1);
                  }}
                  aria-label="Data final"
                  className="bg-surface-solid border border-border rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>

              {auditLoading && auditLogs.length === 0 ? (
                <div className="text-sm text-zinc-400 py-4">A carregar auditoria...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-sm text-zinc-400 py-4">Nenhum registo de auditoria.</div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => setAuditDetail(log)}
                      className="w-full text-left rounded-xl border border-border bg-surface px-4 py-3 text-sm hover:bg-surface-hover transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                          <Badge variant="brand">{log.action}</Badge>
                          <span className="text-zinc-300">{log.entity ?? log.resource ?? '—'}</span>
                          {log.entityId && (
                            <span className="font-mono text-xs text-zinc-400">{String(log.entityId).slice(0, 8)}</span>
                          )}
                        </span>
                        <span className="text-xs text-zinc-400">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString('pt-PT') : '—'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-zinc-400">
                        <span>
                          por{' '}
                          {log.actorRole
                            ? `${log.actorRole}${log.actorId ? ` · ${String(log.actorId).slice(0, 8)}` : ''}`
                            : log.actorId
                              ? String(log.actorId).slice(0, 8)
                              : 'sistema'}
                        </span>
                        {log.ip && <span>· {log.ip}</span>}
                        <span className="text-zinc-400">· {log.details?.method ?? ''}</span>
                        <span className="ml-auto text-brand-light">Ver detalhes →</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-400">Mostrar</label>
                  <select
                    value={auditLimit}
                    onChange={(e) => {
                      setAuditLimit(Number(e.target.value));
                      setAuditPage(1);
                    }}
                    aria-label="Registos por página"
                    className="bg-surface-solid border border-border rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/40"
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={auditLoading || auditPage <= 1}
                    onClick={() => setAuditPage(auditPage - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-zinc-400">
                    {auditPage} / {Math.max(1, Math.ceil(auditTotal / auditLimit))}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={auditLoading || auditPage >= Math.max(1, Math.ceil(auditTotal / auditLimit))}
                    onClick={() => setAuditPage(auditPage + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {eventEditing && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-edit-title"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <div className="w-full sm:max-w-md bg-surface-solid border border-border rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 id="event-edit-title" className="text-2xl font-bold text-zinc-50">
                    Editar Evento
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1">{eventEditing.name}</p>
                </div>
                <button
                  onClick={() => setEventEditing(null)}
                  aria-label="Fechar diálogo"
                  className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEvent} className="space-y-4">
                <Input
                  label="Nome do evento"
                  value={eventEditForm.name}
                  onChange={(e) => setEventEditForm({ ...eventEditForm, name: e.target.value })}
                  placeholder="Festa de Aldeia - Agosto 2026"
                  required
                />
                <Input
                  label="Local"
                  value={eventEditForm.location}
                  onChange={(e) => setEventEditForm({ ...eventEditForm, location: e.target.value })}
                  placeholder="Praça Central"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Início"
                    type="date"
                    value={eventEditForm.startDate}
                    onChange={(e) => setEventEditForm({ ...eventEditForm, startDate: e.target.value })}
                    required
                  />
                  <Input
                    label="Fim"
                    type="date"
                    value={eventEditForm.endDate}
                    onChange={(e) => setEventEditForm({ ...eventEditForm, endDate: e.target.value })}
                    required
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" loading={loading}>
                    {loading ? 'A guardar...' : 'Guardar Alterações'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEventEditing(null)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <Dialog
          open={!!eventDeleting}
          onClose={() => {
            // com o pedido a correr o dialog nao fecha, para o erro ficar
            // visivel e nao haver duplo envio
            if (!loading) setEventDeleting(null);
          }}
          title="Eliminar Evento?"
          description={
            eventDeleting ? (
              <>
                Esta ação elimina o evento{' '}
                <span className="text-zinc-200 font-medium">{eventDeleting.name}</span>. Só é
                possível se não tiver pedidos em curso nem caixa aberto.
              </>
            ) : undefined
          }
          footer={
            <div className="flex items-center gap-3">
              <Button variant="danger" type="button" onClick={handleDeleteEvent} loading={loading}>
                {loading ? 'A eliminar...' : 'Sim, eliminar'}
              </Button>
              <Button variant="outline" type="button" onClick={() => setEventDeleting(null)}>
                Cancelar
              </Button>
            </div>
          }
        />

        {auditDetail && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-detail-title"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <div className="w-full sm:max-w-md bg-surface-solid border border-border rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 id="audit-detail-title" className="text-2xl font-bold text-zinc-50">
                    Detalhes do registo
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1">
                    {auditDetail.createdAt ? new Date(auditDetail.createdAt).toLocaleString('pt-PT') : '—'}
                  </p>
                </div>
                <button
                  onClick={() => setAuditDetail(null)}
                  aria-label="Fechar diálogo"
                  className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-surface"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="brand">{auditDetail.action}</Badge>
                  <span className="text-sm text-zinc-300">{auditDetail.entity ?? auditDetail.resource ?? '—'}</span>
                  {auditDetail.entityId && (
                    <span className="font-mono text-xs text-zinc-400">{auditDetail.entityId}</span>
                  )}
                </div>

                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2">
                    <dt className="text-zinc-400 shrink-0">Ator</dt>
                    <dd className="text-zinc-200 text-right">
                      {auditDetail.actorRole ??
                        (auditDetail.actorId ? '—' : 'sistema')}
                      {auditDetail.actorId && <span className="font-mono text-xs text-zinc-400"> · {auditDetail.actorId}</span>}
                    </dd>
                  </div>
                  {auditDetail.eventId && (
                    <div className="flex justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2">
                      <dt className="text-zinc-400 shrink-0">Evento</dt>
                      <dd className="font-mono text-xs text-zinc-300 text-right">{auditDetail.eventId}</dd>
                    </div>
                  )}
                  {auditDetail.details?.method && (
                    <div className="flex justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2">
                      <dt className="text-zinc-400 shrink-0">Método</dt>
                      <dd className="text-zinc-200">{auditDetail.details.method}</dd>
                    </div>
                  )}
                  {auditDetail.ip && (
                    <div className="flex justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2">
                      <dt className="text-zinc-400 shrink-0">IP</dt>
                      <dd className="text-zinc-200">{auditDetail.ip}</dd>
                    </div>
                  )}
                  {auditDetail.userAgent && (
                    <div className="flex justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2">
                      <dt className="text-zinc-400 shrink-0">User-Agent</dt>
                      <dd className="text-zinc-300 text-xs text-right break-all">{auditDetail.userAgent}</dd>
                    </div>
                  )}
                </dl>

                {auditDetail.before && (
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-300 mb-1">Antes</h3>
                    <pre className="text-xs text-zinc-300 bg-surface border border-border rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(auditDetail.before, null, 2)}
                    </pre>
                  </div>
                )}
                {auditDetail.after && (
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-300 mb-1">Depois</h3>
                    <pre className="text-xs text-zinc-300 bg-surface border border-border rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(auditDetail.after, null, 2)}
                    </pre>
                  </div>
                )}
                {auditDetail.details && (
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-300 mb-1">Detalhes</h3>
                    <pre className="text-xs text-zinc-300 bg-surface border border-border rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(auditDetail.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <Dialog
          open={expiringPopup}
          onClose={() => setExpiringPopup(false)}
          title="Saldos a expirar"
          footer={
            <Button variant="secondary" onClick={() => setExpiringPopup(false)}>
              Compreendi
            </Button>
          }
        >
          {(expiring?.eventos ?? []).length === 0 ? (
            <p className="text-sm text-zinc-300">Sem saldos a expirar de momento.</p>
          ) : (
            <div className="space-y-2">
              {(expiring?.eventos ?? []).map((ev: any) => (
                <div
                  key={ev.eventId}
                  className="flex items-center justify-between gap-3 rounded-xl bg-surface border border-border px-3 py-2"
                >
                  <span className="text-sm text-zinc-200">{ev.nome}</span>
                  <span className="text-xs text-zinc-400">
                    {ev.clientes} cliente{ev.clientes === 1 ? '' : 's'} • €{Number(ev.total).toFixed(2)}
                  </span>
                </div>
              ))}
              <p className="pt-1 text-sm text-zinc-400">
                Avisa os clientes com saldo por usar antes do fim do prazo.
              </p>
            </div>
          )}
        </Dialog>

        {activeTab === 'planta' && (
          <div className="space-y-6">
            <Card>
              <h2 className="text-xl font-bold text-zinc-50 mb-2">Planta das mesas</h2>
              <p className="text-zinc-400 mb-6 text-sm">
                Arrasta as mesas para desenhar a disposição do espaço. Guardado automaticamente no
                servidor, com cópia local para uso offline.
              </p>

              {events.length === 0 ? (
                <div className="text-sm text-zinc-400 py-4">Cria um evento primeiro.</div>
              ) : (
                <>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="block min-w-56">
                      <span className="block text-sm font-medium text-zinc-400 mb-1.5">Evento</span>
                      <select
                        value={plantaEventoId}
                        onChange={(e) => setPlantaEventoId(e.target.value)}
                        className="w-full bg-surface-solid border border-border rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                      >
                        <option value="">Seleciona um evento</option>
                        {events.map((ev: any) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block w-48">
                      <span className="block text-sm font-medium text-zinc-400 mb-1.5">Nova mesa</span>
                      <input
                        value={plantaNovoNome}
                        onChange={(e) => setPlantaNovoNome(e.target.value)}
                        placeholder="ex: Mesa 1"
                        className="w-full bg-surface-solid border border-border rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                      />
                    </label>
                    <Button size="sm" onClick={adicionarMesaPlanta} disabled={!plantaEventoId}>
                      Adicionar mesa
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={adicionarZonaPlanta}
                      disabled={!plantaEventoId || plantaZonas.length >= MAX_ZONAS_PLANTA}
                    >
                      Adicionar zona
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setPlantaLimpar(true)}
                      disabled={!planta.length}
                    >
                      Limpar planta
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={autoOrganizarPlanta}
                      disabled={planta.length < 2}
                    >
                      Auto-organizar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportarPlantaPng}
                      disabled={planta.length === 0 && plantaZonas.length === 0}
                    >
                      Exportar PNG
                    </Button>
                    {planta.length > 0 && (
                      <span className="text-xs text-zinc-400">
                        {planta.length} mesa(s) ·{' '}
                        {planta.reduce((s, m) => s + normalizarLugares(m.lugares), 0)} lugares
                      </span>
                    )}
                    {plantaSync === 'saving' && (
                      <span className="text-xs text-zinc-400">A guardar…</span>
                    )}
                    {plantaSync === 'saved' && (
                      <span className="text-xs text-emerald-400">Guardado</span>
                    )}
                    {plantaSync === 'erro' && (
                      <span className="text-xs text-amber-400">
                        Sem ligação — planta só neste dispositivo
                      </span>
                    )}
                    {plantaSync === 'offline' && (
                      <span className="text-xs text-zinc-400">Modo offline</span>
                    )}
                  </div>

                  {plantaConflito && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                      <span className="text-xs text-amber-200">
                        Há uma edição local por sincronizar
                        {plantaConflito.pendenteTs
                          ? ` (${descreverIdade(plantaConflito.pendenteTs)})`
                          : ''}
                        , ou a planta mudou noutro dispositivo. Escolhe a versão a manter.
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={forcarGuardarPlanta}>
                          Manter a minha
                        </Button>
                        <Button size="sm" onClick={recarregarPlantaRemota}>
                          Recarregar
                        </Button>
                      </div>
                    </div>
                  )}

                  {plantaImportarDisponivel && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand/10 px-3 py-2">
                      <span className="text-xs text-zinc-200">
                        Tens uma planta local para este evento. Importar para o servidor?
                      </span>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={importarPlantaLocal}>
                          Importar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={descartarPlantaLocal}>
                          Descartar local
                        </Button>
                      </div>
                    </div>
                  )}

                  {undoEtiqueta && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2">
                      <span className="text-xs text-zinc-300">{undoEtiqueta}.</span>
                      <Button size="sm" variant="outline" onClick={desfazer}>
                        Desfazer
                      </Button>
                    </div>
                  )}

                  <div
                    ref={plantaRef}
                    onPointerMove={onPlantaPointerMove}
                    onPointerUp={onPlantaPointerUp}
                    onPointerLeave={onPlantaPointerUp}
                    className="relative mt-4 w-full overflow-hidden rounded-2xl border border-border bg-zinc-900/40"
                    style={{ aspectRatio: '16 / 9', touchAction: 'none' }}
                  >
                    {planta.length === 0 && plantaZonas.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
                        Sem mesas. Adiciona a primeira acima.
                      </div>
                    )}
                    {plantaZonas.map((zona) => {
                      const sel = zonaSel === zona.id;
                      return (
                        <div
                          key={zona.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Zona ${zona.nome}`}
                          onPointerDown={(e) => onZonaPointerDown(e, zona)}
                          onFocus={() => setZonaSel(zona.id)}
                          onKeyDown={(e) => onZonaKeyDown(e, zona)}
                          className={cn(
                            'planta-zona absolute cursor-grab select-none rounded-lg outline-none',
                            sel ? 'ring-2 ring-white/70' : 'hover:ring-1 hover:ring-white/30',
                          )}
                          style={{
                            left: `${zona.x}%`,
                            top: `${zona.y}%`,
                            width: `${zona.w}%`,
                            height: `${zona.h}%`,
                            background: `${zona.cor}22`,
                            border: `1px solid ${zona.cor}`,
                            touchAction: 'none',
                          }}
                        >
                          <span
                            className="absolute left-1 top-1 max-w-full truncate px-1 text-[10px] font-medium"
                            style={{ color: zona.cor }}
                          >
                            {zona.nome}
                          </span>
                          {sel && (
                            <span
                              role="presentation"
                              aria-hidden="true"
                              onPointerDown={(e) => onZonaResizePointerDown(e, zona)}
                              className="absolute bottom-0 right-0 h-3 w-3 translate-x-1/3 translate-y-1/3 cursor-nwse-resize rounded-sm bg-white/80"
                            />
                          )}
                        </div>
                      );
                    })}
                    {planta.map((mesa) => {
                      const sel = plantaSel === mesa.id;
                      const duplicada = mesasDuplicadas.has(mesa.nome.trim().toLowerCase());
                      return (
                        <div
                          key={mesa.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Mesa ${mesa.nome}, ${mesa.lugares} lugares`}
                          onPointerDown={(e) => onMesaPointerDown(e, mesa)}
                          onFocus={() => setPlantaSel(mesa.id)}
                          onKeyDown={(e) => onMesaKeyDown(e, mesa)}
                          className={cn(
                            'planta-mesa absolute flex cursor-grab select-none flex-col items-center justify-center text-center outline-none',
                            mesa.forma === 'quadrada' ? 'rounded-lg' : 'rounded-full',
                            sel
                              ? 'bg-brand/20 ring-2 ring-brand'
                              : duplicada
                                ? 'bg-surface border border-amber-400/50 ring-2 ring-amber-400/70'
                                : 'bg-surface border border-border hover:border-border-hover',
                          )}
                          style={{
                            left: `${mesa.x}%`,
                            top: `${mesa.y}%`,
                            transform: 'translate(-50%, -50%)',
                            touchAction: 'none',
                          }}
                        >
                          <span className="max-w-[68px] truncate text-xs font-semibold text-zinc-100">
                            {mesa.nome}
                          </span>
                          <span className="text-[10px] text-zinc-400">{mesa.lugares} lug.</span>
                        </div>
                      );
                    })}
                  </div>

                  {duplicadosAtuais.length > 0 && (
                    <p className="mt-2 text-xs text-amber-400">
                      Nomes de mesa repetidos:{' '}
                      {duplicadosAtuais.map((d) => `«${d.nome}» aparece ${d.ocorrencias}×`).join('; ')}.
                      Só a primeira ocorrência de cada nome é usada nos QRs.
                    </p>
                  )}

                  {plantaSel &&
                    (() => {
                      const mesa = planta.find((m) => m.id === plantaSel);
                      if (!mesa) return null;
                      return (
                        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-border p-3">
                          <label className="block w-48">
                            <span className="block text-sm font-medium text-zinc-400 mb-1.5">Nome</span>
                            <input
                              value={mesa.nome}
                              onChange={(e) => editarMesaPlanta(mesa.id, { nome: e.target.value })}
                              className="w-full bg-surface-solid border border-border rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                            />
                          </label>
                          <label className="block w-28">
                            <span className="block text-sm font-medium text-zinc-400 mb-1.5">Lugares</span>
                            <input
                              type="number"
                              min="0"
                              max={MAX_LUGARES_MESA}
                              value={mesa.lugares}
                              onChange={(e) =>
                                editarMesaPlanta(mesa.id, { lugares: normalizarLugares(Number(e.target.value)) })
                              }
                              className="w-full bg-surface-solid border border-border rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                            />
                          </label>
                          <label className="block w-40">
                            <span className="block text-sm font-medium text-zinc-400 mb-1.5">Forma</span>
                            <select
                              value={mesa.forma}
                              onChange={(e) =>
                                editarMesaPlanta(mesa.id, { forma: e.target.value as FormaMesa })
                              }
                              className="w-full bg-surface-solid border border-border rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                            >
                              <option value="redonda">Redonda</option>
                              <option value="quadrada">Quadrada</option>
                            </select>
                          </label>
                          <Button size="sm" variant="outline" onClick={() => duplicarMesaPlanta(mesa.id)}>
                            Duplicar mesa
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => removerMesaPlanta(mesa.id)}>
                            Remover
                          </Button>
                        </div>
                      );
                    })()}

                  {zonaSel &&
                    (() => {
                      const zona = plantaZonas.find((z) => z.id === zonaSel);
                      if (!zona) return null;
                      return (
                        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-border p-3">
                          <label className="block w-48">
                            <span className="block text-sm font-medium text-zinc-400 mb-1.5">
                              Nome da zona
                            </span>
                            <input
                              value={zona.nome}
                              onChange={(e) => editarZonaPlanta(zona.id, { nome: e.target.value })}
                              className="w-full bg-surface-solid border border-border rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                            />
                          </label>
                          <div className="block">
                            <span className="block text-sm font-medium text-zinc-400 mb-1.5">Cor</span>
                            <div className="flex gap-1.5">
                              {CORES_ZONA.map((cor) => (
                                <button
                                  key={cor}
                                  type="button"
                                  aria-label={`Cor ${cor}`}
                                  onClick={() => editarZonaPlanta(zona.id, { cor })}
                                  className={cn(
                                    'h-7 w-7 rounded-full border',
                                    zona.cor === cor
                                      ? 'border-transparent ring-2 ring-white/80'
                                      : 'border-border',
                                  )}
                                  style={{ background: cor }}
                                />
                              ))}
                            </div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => removerZonaPlanta(zona.id)}>
                            Remover zona
                          </Button>
                        </div>
                      );
                    })()}

                  <div className="mt-4 rounded-xl border border-border p-3">
                    <QrLoteControlos
                      tamanho={loteTamanho}
                      onTamanho={setLoteTamanho}
                      colunas={loteColunas}
                      onColunas={setLoteColunas}
                      linhas={loteLinhas}
                      onLinhas={setLoteLinhas}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        Agrupar por
                        <select
                          value={loteAgrupar}
                          onChange={(e) => setLoteAgrupar(e.target.value as 'nenhum' | 'zona')}
                          className="bg-surface-solid border border-border rounded-xl px-2.5 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/40"
                        >
                          <option value="nenhum">Ordem da planta</option>
                          <option value="zona">Zona</option>
                        </select>
                      </label>
                      <Button size="sm" onClick={gerarQrsDaPlanta} disabled={!planta.length}>
                        Gerar QRs das mesas
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => imprimirArea('lote')}
                        disabled={!loteGerado}
                      >
                        Imprimir
                      </Button>
                      {loteGerado && loteGerado.length > 0 && (
                        <Button size="sm" variant="ghost" onClick={descartarLote}>
                          Descartar lote
                        </Button>
                      )}
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={plantaSnap}
                          onChange={(e) => definirSnap(e.target.checked)}
                          className="h-4 w-4 accent-brand"
                        />
                        Ajustar à grelha
                      </label>
                    </div>
                    <p className="mt-2 text-xs text-zinc-400">
                      Gera os QRs das mesas da planta e compõe a folha A4 com o tamanho e a grelha acima.
                    </p>
                  </div>
                </>
              )}
            </Card>
          </div>
        )}

        {error && <div className="mt-4"><Alert variant="error" message={error} /></div>}
      </AppShell>

      {loteShortCode && loteGerado && loteGerado.length > 0 && (
        <div className="qr-lote-print">
          {agruparFolhas(loteGerado, loteColunas * loteLinhas).map((folha, fi) => (
            <div
              key={fi}
              className="qr-sheet"
              style={{ ['--qr-cols' as any]: loteColunas }}
            >
              {folha.map((mesa) => (
                <div key={mesa} className="qr-card">
                  <QRCodeSVG
                    value={montarUrlMesa(window.location.origin, loteShortCode, mesa)}
                    size={loteTamanho}
                    level="M"
                    className="max-w-full h-auto"
                  />
                  <span className="qr-card-label">{mesa}{(loteLugares[mesa] ?? 0) > 0 ? ` · ${loteLugares[mesa]} lugares` : ''}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={plantaLimpar}
        onClose={() => setPlantaLimpar(false)}
        title="Limpar planta"
        description="Remove todas as mesas da planta deste evento. Podes desfazer durante alguns segundos."
        footer={
          <>
            <Button variant="outline" onClick={() => setPlantaLimpar(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={limparPlanta}>
              Limpar tudo
            </Button>
          </>
        }
      />
    </>
  );
}