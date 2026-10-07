'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { SettingsIcon, CalendarIcon, UserIcon, ClipboardIcon, ShieldCheckIcon, CloseIcon, PencilIcon, TrashIcon, CopyIcon, WalletIcon } from '@/components/ui/icons';
import { Dialog } from '@/components/ui/dialog';
import { deveAvisarSessao, marcarAvisoSessao } from '@/lib/saldo-aviso';
import { getEvents, createEvent, updateEvent, updateEventStatus, deleteEvent, getUsers, updateUser, getProducts, getCategories, createProduct, updateProduct, deleteProduct, duplicateProduct, getEventMembers, addEventMember, removeEventMember, getAudit, exportAuditCsv, getEventSettings, updateEventSettings, getOutstandingBalances, getReports, extendBalance, unarchiveBalance, markBalanceNotified } from '@/lib/api';
import { downloadTextFile } from '@/lib/download';
import { montarUrlMesa } from '@/lib/mesa-qr';

const roleVariant: Record<string, 'brand' | 'warning' | 'success'> = {
  superadmin: 'brand',
  organizer: 'warning',
  cashier: 'success',
  bar: 'success',
  kitchen: 'success',
  treasurer: 'success',
  client: 'warning',
};

export default function AdminPage() {
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
  const [linkMesaQr, setLinkMesaQr] = useState('');
  const [mesaQrNumero, setMesaQrNumero] = useState('');
  const [copiadoMesaQr, setCopiadoMesaQr] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const mesaQrCanvasRef = useRef<HTMLCanvasElement>(null);
  const copiaTimerRef = useRef<number | null>(null);
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
  const [productEditing, setProductEditing] = useState<any>(null);
  const [productEditForm, setProductEditForm] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
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
      await createProduct({
        name: productForm.name,
        description: productForm.description || undefined,
        price,
        availability: productForm.availability,
        stock: productForm.stock ? parseFloat(productForm.stock) : undefined,
        categoryId: productForm.categoryId || undefined,
        kitchenName: productForm.kitchenName || undefined,
      });
      setProductForm({ name: '', description: '', price: '', availability: 'available', stock: '', categoryId: '', kitchenName: '' });
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
    const stock = productEditForm.stock ? parseFloat(productEditForm.stock) : null;
    if (stock !== null && (isNaN(stock) || stock < 0)) {
      setProductEditError('O stock tem de ser um número positivo');
      return;
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
    setMesaQrNumero('');
    setLinkMesaQr('');
    setCopiadoMesaQr(false);
    setQrEvento(evento);
  };

  const fecharQr = () => {
    if (copiaTimerRef.current) window.clearTimeout(copiaTimerRef.current);
    setCopiadoQr(false);
    setQrEvento(null);
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

  const gerarQrMesa = () => {
    const numero = mesaQrNumero.trim();
    if (!qrEvento?.shortCode || !numero) return;
    setLinkMesaQr(montarUrlMesa(window.location.origin, qrEvento.shortCode, numero));
  };

  const copiarLinkMesaQr = async () => {
    try {
      await navigator.clipboard.writeText(linkMesaQr);
      setCopiadoMesaQr(true);
      if (copiaTimerRef.current) window.clearTimeout(copiaTimerRef.current);
      copiaTimerRef.current = window.setTimeout(() => setCopiadoMesaQr(false), 1500);
    } catch {
      setCopiadoMesaQr(false);
    }
  };

  const descarregarMesaQr = () => {
    const canvas = mesaQrCanvasRef.current;
    if (!canvas || !qrEvento) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `mesa-${qrEvento.shortCode}-${mesaQrNumero.trim()}.png`;
    a.click();
  };

  const descarregarQr = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas || !qrEvento) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `qr-${qrEvento.shortCode}.png`;
    a.click();
  };

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
                    <Button size="sm" onClick={() => window.print()}>
                      Imprimir
                    </Button>
                    <Button size="sm" variant="outline" onClick={copiarLinkQr}>
                      {copiadoQr ? 'Copiado!' : 'Copiar link'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={descarregarQr}>
                      Descarregar PNG
                    </Button>
                  </div>

                  <div className="mt-6 border-t border-border pt-5">
                    <h3 className="text-sm font-bold text-zinc-100 mb-1">QR por mesa</h3>
                    <p className="text-xs text-zinc-400 mb-3">
                      Gera um QR individual que, ao ser escaneado, entra direto na mesa sem digitar o número.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={mesaQrNumero}
                        onChange={(e) => setMesaQrNumero(e.target.value)}
                        placeholder="Nº da mesa, ex: 12"
                        inputMode="numeric"
                        className="flex-1"
                      />
                      <Button onClick={gerarQrMesa}>Gerar</Button>
                    </div>
                    {linkMesaQr && (
                      <div className="mt-4 flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-white p-4">
                          <QRCodeCanvas ref={mesaQrCanvasRef} value={linkMesaQr} size={160} level="M" />
                        </div>
                        <p className="text-xs text-zinc-400 break-all text-center">{linkMesaQr}</p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <Button size="sm" variant="outline" onClick={copiarLinkMesaQr}>
                            {copiadoMesaQr ? 'Copiado!' : 'Copiar link'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={descarregarMesaQr}>
                            Descarregar PNG
                          </Button>
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
                                <Badge variant="neutral">Stock: {product.stock}</Badge>
                              )}
                              {product.isActive === false && (
                                <Badge variant="neutral">Inativo — escondido do POS e QR</Badge>
                              )}
                            </div>
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
                  <Input
                    label="Stock (opcional)"
                    type="number"
                    min="0"
                    step="1"
                    value={productEditForm.stock}
                    onChange={(e) => setProductEditForm({ ...productEditForm, stock: e.target.value })}
                  />
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
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Preço (€)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="3.50"
                    required
                  />
                  <Input
                    label="Stock (opcional)"
                    type="number"
                    min="0"
                    step="1"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                    placeholder="100"
                  />
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

        {error && <div className="mt-4"><Alert variant="error" message={error} /></div>}
      </AppShell>
    </>
  );
}