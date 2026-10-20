import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEntity, FloorPlanEntity, UserEntity } from '../../entities';
import { EventService } from './event.service';
import { OrderGateway } from '../../websocket/order.gateway';
import {
  CriarPlantaDto,
  GuardarPlantaDto,
  MAX_ZONAS_PLANTA,
  RenomearPlantaDto,
} from './planta.dto';
import { SnapshotAuditoria } from '../../common/interceptors/audit.interceptor';

const NOME_PRINCIPAL = 'Principal';
const DOC_VAZIO = { mesas: [], zonas: [] };

interface ZonaPlantaDoc {
  id: string;
  nome: string;
  cor: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DimensoesPlantaDoc {
  larguraM: number;
  alturaM: number;
}

interface DocPlanta {
  mesas: any[];
  zonas: ZonaPlantaDoc[];
  dimensoes: DimensoesPlantaDoc | null;
}

export interface RespostaPlanta {
  id: string;
  nome: string;
  mesas: any[];
  zonas: any[];
  dimensoes?: DimensoesPlantaDoc;
  version: number;
}

function clampNumero(valor: unknown, min: number, max: number): number {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function normalizarZonaPlanta(zona: any): ZonaPlantaDoc {
  const w = clampNumero(zona?.w, 1, 100);
  const h = clampNumero(zona?.h, 1, 100);
  return {
    id: typeof zona?.id === 'string' ? zona.id : '',
    nome: typeof zona?.nome === 'string' ? zona.nome : '',
    cor: typeof zona?.cor === 'string' ? zona.cor : '',
    x: clampNumero(zona?.x, 0, 100 - w),
    y: clampNumero(zona?.y, 0, 100 - h),
    w,
    h,
  };
}

function normalizarDimensoes(dimensoes: any): DimensoesPlantaDoc | null {
  if (!dimensoes || typeof dimensoes !== 'object') return null;
  const larguraM = Number(dimensoes.larguraM);
  const alturaM = Number(dimensoes.alturaM);
  if (!Number.isFinite(larguraM) || !Number.isFinite(alturaM)) return null;
  const arredondar = (v: number) => Math.round(clampNumero(v, 1, 200) * 10) / 10;
  return { larguraM: arredondar(larguraM), alturaM: arredondar(alturaM) };
}

/**
 * Normaliza o documento guardado para { mesas, zonas, dimensoes }. Aceita o
 * formato legado (array só de mesas) para não perder plantas migradas.
 */
function lerFloorPlan(documento: any): DocPlanta {
  if (Array.isArray(documento)) {
    return { mesas: documento, zonas: [], dimensoes: null };
  }
  if (documento && typeof documento === 'object') {
    return {
      mesas: Array.isArray(documento.mesas) ? documento.mesas : [],
      zonas: Array.isArray(documento.zonas)
        ? documento.zonas.map(normalizarZonaPlanta)
        : [],
      dimensoes: normalizarDimensoes(documento.dimensoes),
    };
  }
  return { mesas: [], zonas: [], dimensoes: null };
}

function ehViolacaoUnica(err: unknown): boolean {
  const codigo = (err as any)?.driverError?.code ?? (err as any)?.code;
  return codigo === '23505';
}

@Injectable()
export class FloorPlanService {
  constructor(
    @InjectRepository(FloorPlanEntity)
    private readonly floorPlanRepository: Repository<FloorPlanEntity>,
    private readonly eventService: EventService,
    private readonly orderGateway: OrderGateway,
  ) {}

  async listar(
    eventId: string,
    user: UserEntity,
  ): Promise<Array<{ id: string; nome: string; version: number }>> {
    await this.eventService.findOne(eventId, user);
    const linhas = await this.floorPlanRepository.find({
      where: { event: { id: eventId } },
      order: { createdAt: 'ASC' },
    });
    return linhas.map((l) => ({ id: l.id, nome: l.nome, version: l.version }));
  }

  async criar(
    eventId: string,
    user: UserEntity,
    dto: CriarPlantaDto,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<{ id: string; nome: string; version: number }> {
    await this.eventService.findOne(eventId, user);
    const nome = this.validarNome(dto.nome);
    const existente = await this.floorPlanRepository.findOne({
      where: { event: { id: eventId }, nome },
    });
    if (existente) {
      throw new ConflictException('Já existe uma planta com esse nome');
    }
    const linha = this.floorPlanRepository.create({
      event: { id: eventId } as EventEntity,
      nome,
      documento: { ...DOC_VAZIO },
      version: 0,
    });
    let guardada: FloorPlanEntity;
    try {
      guardada = await this.floorPlanRepository.save(linha);
    } catch (err) {
      if (ehViolacaoUnica(err)) {
        throw new ConflictException('Já existe uma planta com esse nome');
      }
      throw err;
    }
    arquivar?.({ entidadeId: guardada.id, eventId, extras: { nome } });
    this.orderGateway.emitPlantaUpdate(eventId, guardada.id, guardada.version, 'criada');
    return { id: guardada.id, nome: guardada.nome, version: guardada.version };
  }

  async obter(
    eventId: string,
    plantaId: string,
    user: UserEntity,
  ): Promise<RespostaPlanta> {
    return this.resposta(await this.buscar(eventId, plantaId, user));
  }

  async guardar(
    eventId: string,
    plantaId: string,
    user: UserEntity,
    dto: GuardarPlantaDto,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<RespostaPlanta> {
    const linha = await this.buscar(eventId, plantaId, user);
    const atual = lerFloorPlan(linha.documento);
    if (dto.version !== linha.version) {
      throw this.conflito(atual, linha.version, { id: linha.id, nome: linha.nome });
    }
    arquivar?.({
      antes: {
        mesas: atual.mesas,
        zonas: atual.zonas,
        dimensoes: atual.dimensoes,
        version: linha.version,
      },
      entidadeId: linha.id,
      eventId,
    });
    const construido = this.construirDocumento(dto, atual);
    linha.documento = construido.documento;
    linha.version = linha.version + 1;
    await this.floorPlanRepository.save(linha);
    this.orderGateway.emitPlantaUpdate(eventId, linha.id, linha.version, 'guardada');
    return {
      id: linha.id,
      nome: linha.nome,
      mesas: construido.documento.mesas,
      zonas: construido.documento.zonas,
      ...(construido.dimensoes ? { dimensoes: construido.dimensoes } : {}),
      version: linha.version,
    };
  }

  async renomear(
    eventId: string,
    plantaId: string,
    user: UserEntity,
    dto: RenomearPlantaDto,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<{ id: string; nome: string; version: number }> {
    const linha = await this.buscar(eventId, plantaId, user);
    const nome = this.validarNome(dto.nome);
    if (nome !== linha.nome) {
      const existente = await this.floorPlanRepository.findOne({
        where: { event: { id: eventId }, nome },
      });
      if (existente) {
        throw new ConflictException('Já existe uma planta com esse nome');
      }
    }
    arquivar?.({
      antes: { id: linha.id, nome: linha.nome, version: linha.version },
      entidadeId: linha.id,
      eventId,
    });
    linha.nome = nome;
    try {
      await this.floorPlanRepository.save(linha);
    } catch (err) {
      if (ehViolacaoUnica(err)) {
        throw new ConflictException('Já existe uma planta com esse nome');
      }
      throw err;
    }
    this.orderGateway.emitPlantaUpdate(eventId, linha.id, linha.version, 'renomeada');
    return { id: linha.id, nome: linha.nome, version: linha.version };
  }

  async apagar(
    eventId: string,
    plantaId: string,
    user: UserEntity,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<{ id: string; nome: string; version: number }> {
    const linha = await this.buscar(eventId, plantaId, user);
    const total = await this.floorPlanRepository.count({
      where: { event: { id: eventId } },
    });
    if (total <= 1) {
      throw new BadRequestException('Não é possível apagar a única planta do evento');
    }
    arquivar?.({
      antes: { id: linha.id, nome: linha.nome, version: linha.version },
      entidadeId: linha.id,
      eventId,
    });
    await this.floorPlanRepository.remove(linha);
    this.orderGateway.emitPlantaUpdate(eventId, plantaId, linha.version, 'apagada');
    return { id: plantaId, nome: linha.nome, version: linha.version };
  }

  /**
   * Compatibilidade com clientes antigos (GET /events/:id/planta): devolve a
   * planta "Principal", ou um documento vazio na versão 0 se o evento ainda
   * não tiver plantas.
   */
  async obterPrincipal(
    eventId: string,
    user: UserEntity,
  ): Promise<{ mesas: any[]; zonas: any[]; dimensoes?: DimensoesPlantaDoc; version: number }> {
    await this.eventService.findOne(eventId, user);
    const linha = await this.buscarPrincipal(eventId);
    if (!linha) {
      return { mesas: [], zonas: [], version: 0 };
    }
    const doc = lerFloorPlan(linha.documento);
    return {
      mesas: doc.mesas,
      zonas: doc.zonas,
      ...(doc.dimensoes ? { dimensoes: doc.dimensoes } : {}),
      version: linha.version,
    };
  }

  /**
   * Compatibilidade com clientes antigos (PUT /events/:id/planta): grava sobre
   * a planta "Principal", criando-a se ainda não existir (versão esperada 0).
   */
  async guardarPrincipal(
    eventId: string,
    user: UserEntity,
    dto: GuardarPlantaDto,
    arquivar?: (snapshot: SnapshotAuditoria) => void,
  ): Promise<{ mesas: any[]; zonas: any[]; dimensoes?: DimensoesPlantaDoc; version: number }> {
    await this.eventService.findOne(eventId, user);
    let linha = await this.buscarPrincipal(eventId);
    const atual = lerFloorPlan(linha?.documento);
    const versionAtual = linha?.version ?? 0;
    if (dto.version !== versionAtual) {
      throw this.conflito(atual, versionAtual);
    }
    arquivar?.({
      antes: {
        mesas: atual.mesas,
        zonas: atual.zonas,
        dimensoes: atual.dimensoes,
        version: versionAtual,
      },
      eventId,
    });
    const construido = this.construirDocumento(dto, atual);
    if (!linha) {
      linha = this.floorPlanRepository.create({
        event: { id: eventId } as EventEntity,
        nome: NOME_PRINCIPAL,
        documento: construido.documento,
        version: 1,
      });
    } else {
      linha.documento = construido.documento;
      linha.version = versionAtual + 1;
    }
    try {
      linha = await this.floorPlanRepository.save(linha);
    } catch (err) {
      if (ehViolacaoUnica(err)) {
        const estado = await this.buscarPrincipal(eventId);
        throw this.conflito(lerFloorPlan(estado?.documento), estado?.version ?? 0);
      }
      throw err;
    }
    this.orderGateway.emitPlantaUpdate(eventId, linha.id, linha.version, 'guardada');
    return {
      mesas: construido.documento.mesas,
      zonas: construido.documento.zonas,
      ...(construido.dimensoes ? { dimensoes: construido.dimensoes } : {}),
      version: linha.version,
    };
  }

  private async buscar(
    eventId: string,
    plantaId: string,
    user: UserEntity,
  ): Promise<FloorPlanEntity> {
    await this.eventService.findOne(eventId, user);
    const linha = await this.floorPlanRepository.findOne({
      where: { id: plantaId, event: { id: eventId } },
    });
    if (!linha) {
      throw new NotFoundException('Planta não encontrada');
    }
    return linha;
  }

  private async buscarPrincipal(eventId: string): Promise<FloorPlanEntity | null> {
    return this.floorPlanRepository.findOne({
      where: { event: { id: eventId }, nome: NOME_PRINCIPAL },
    });
  }

  private validarNome(nome: string): string {
    const normalizado = (nome ?? '').trim();
    if (!normalizado) {
      throw new BadRequestException('O nome da planta é obrigatório');
    }
    return normalizado;
  }

  private construirDocumento(
    dto: GuardarPlantaDto,
    atual: DocPlanta,
  ): { documento: { mesas: any[]; zonas: ZonaPlantaDoc[]; dimensoes?: DimensoesPlantaDoc }; dimensoes: DimensoesPlantaDoc | null } {
    const zonas = (dto.zonas ?? []).map(normalizarZonaPlanta).slice(0, MAX_ZONAS_PLANTA);
    // Sem `dimensoes` no payload (clientes antigos, drag de mesas) preserva-se
    // o valor guardado em vez de o apagar.
    const dimensoes = dto.dimensoes ? normalizarDimensoes(dto.dimensoes) : atual.dimensoes;
    return {
      documento: {
        mesas: dto.mesas,
        zonas,
        ...(dimensoes ? { dimensoes } : {}),
      },
      dimensoes,
    };
  }

  private resposta(linha: FloorPlanEntity): RespostaPlanta {
    const doc = lerFloorPlan(linha.documento);
    return {
      id: linha.id,
      nome: linha.nome,
      mesas: doc.mesas,
      zonas: doc.zonas,
      ...(doc.dimensoes ? { dimensoes: doc.dimensoes } : {}),
      version: linha.version,
    };
  }

  private conflito(doc: DocPlanta, version: number, extras?: Record<string, unknown>): ConflictException {
    return new ConflictException({
      message: 'A planta foi alterada noutro dispositivo',
      mesas: doc.mesas,
      zonas: doc.zonas,
      ...(doc.dimensoes ? { dimensoes: doc.dimensoes } : {}),
      version,
      ...extras,
    });
  }
}
