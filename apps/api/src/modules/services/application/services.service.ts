import { Injectable } from '@nestjs/common';
import { Prisma, type Service, type ServiceCondition } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

import { AppException } from '@/common/http/app-exception';
import { planificarInsercion, type TramoVigencia } from '@/domain/conditions/condition-timeline';
import { CivilDate } from '@/domain/time/civil-date';
import { PrismaService } from '@/infra/prisma/prisma.service';
import type { TenantContext } from '@/modules/auth/tenant-context';

import type {
  ActualizarServicioInput,
  CrearCondicionInput,
  CrearServicioInput,
  ListarServiciosInput,
} from '../contracts/service.schemas';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenant: TenantContext, filtros: ListarServiciosInput) {
    const servicios = await this.prisma.service.findMany({
      where: {
        userId: tenant.userId,
        ...(filtros.status ? { status: filtros.status } : {}),
        ...(filtros.categoryId ? { categoryId: filtros.categoryId } : {}),
        ...(filtros.incluirArchivados ? {} : { archivedAt: null }),
      },
      include: {
        category: true,
        // Solo la condicion vigente: la lista no necesita el historial entero.
        conditions: { where: { validTo: null }, take: 1 },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });

    return servicios.map((s) => this.aResumen(s, s.conditions[0] ?? null, s.category));
  }

  async obtener(tenant: TenantContext, id: string) {
    const servicio = await this.prisma.service.findFirst({
      // El filtro por userId va DENTRO de la consulta, no despues: asi el
      // usuario ajeno recibe 404 y no llega a saber que el recurso existe.
      where: { id, userId: tenant.userId },
      include: { category: true, conditions: { orderBy: { validFrom: 'desc' } } },
    });

    if (!servicio) throw this.noEncontrado();

    const vigente = servicio.conditions.find((c) => c.validTo === null) ?? null;

    return {
      ...this.aResumen(servicio, vigente, servicio.category),
      notes: servicio.notes,
      accountNumber: servicio.accountNumber,
      autoDebit: servicio.autoDebit,
      endDate: servicio.endDate ? CivilDate.desdePrisma(servicio.endDate).toString() : null,
      conditions: servicio.conditions.map((c) => this.aCondicion(c)),
    };
  }

  async crear(tenant: TenantContext, input: CrearServicioInput) {
    await this.validarCategoria(tenant, input.categoryId ?? null);

    const serviceId = uuidv7();
    const startDate = CivilDate.parse(input.startDate);

    await this.prisma.$transaction(async (tx) => {
      await tx.service.create({
        data: {
          id: serviceId,
          userId: tenant.userId,
          name: input.name,
          providerName: input.providerName ?? null,
          accountNumber: input.accountNumber ?? null,
          categoryId: input.categoryId ?? null,
          currency: input.currency,
          startDate: startDate.aPrisma(),
          debtPolicy: input.debtPolicy,
          autoDebit: input.autoDebit,
          notes: input.notes ?? null,
        },
      });

      if (input.condition) {
        await tx.serviceCondition.create({
          data: this.datosDeCondicion(tenant, serviceId, input.condition, startDate),
        });
      }
    });

    return this.obtener(tenant, serviceId);
  }

  async actualizar(tenant: TenantContext, id: string, input: ActualizarServicioInput) {
    await this.asegurarPropiedad(tenant, id);
    if (input.categoryId !== undefined) await this.validarCategoria(tenant, input.categoryId);

    await this.prisma.service.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.providerName !== undefined ? { providerName: input.providerName } : {}),
        ...(input.accountNumber !== undefined ? { accountNumber: input.accountNumber } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.debtPolicy !== undefined ? { debtPolicy: input.debtPolicy } : {}),
        ...(input.autoDebit !== undefined ? { autoDebit: input.autoDebit } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.endDate !== undefined
          ? { endDate: input.endDate ? CivilDate.parse(input.endDate).aPrisma() : null }
          : {}),
      },
    });

    return this.obtener(tenant, id);
  }

  /**
   * Archiva el servicio en lugar de borrarlo.
   *
   * Un servicio con historial no se borra nunca: sus facturas y pagos son
   * hechos ocurridos, y borrarlos falsearia el historico financiero.
   */
  async archivar(tenant: TenantContext, id: string): Promise<void> {
    await this.asegurarPropiedad(tenant, id);
    await this.prisma.service.update({
      where: { id },
      data: { archivedAt: new Date(), status: 'CANCELLED' },
    });
  }

  /**
   * Agrega una condicion nueva CERRANDO la anterior, sin sobrescribirla.
   *
   * Es lo que permite responder "cuanto deberia haber salido la factura de
   * septiembre" con las condiciones de septiembre y no con las de hoy. Sin
   * historial, la aplicacion no podria detectar un aumento.
   */
  async agregarCondicion(tenant: TenantContext, serviceId: string, input: CrearCondicionInput) {
    await this.asegurarPropiedad(tenant, serviceId);

    const existentes = await this.prisma.serviceCondition.findMany({
      where: { serviceId, userId: tenant.userId },
      orderBy: { validFrom: 'asc' },
    });

    const tramos: TramoVigencia[] = existentes.map((c) => ({
      id: c.id,
      validFrom: CivilDate.desdePrisma(c.validFrom),
      validTo: c.validTo ? CivilDate.desdePrisma(c.validTo) : null,
    }));

    const desde = CivilDate.parse(input.validFrom);
    const plan = planificarInsercion(tramos, desde);

    if (!plan.ok) {
      throw plan.motivo === 'FECHA_YA_USADA'
        ? AppException.conflict(
            'CONDITION_DATE_TAKEN',
            'Ya hay una condición que empieza ese día',
            'Elegí otra fecha de inicio, o editá la condición existente.',
          )
        : AppException.conflict(
            'CONDITION_OUT_OF_ORDER',
            'No se puede insertar una condición anterior a la última',
            'Las condiciones se agregan hacia adelante en el tiempo, para no alterar períodos ya facturados.',
          );
    }

    await this.prisma.$transaction(async (tx) => {
      if (plan.cerrar) {
        await tx.serviceCondition.update({
          where: { id: plan.cerrar.id },
          data: { validTo: plan.cerrar.validTo.aPrisma() },
        });
      }
      await tx.serviceCondition.create({
        data: this.datosDeCondicion(tenant, serviceId, input, desde),
      });
    });

    return this.obtener(tenant, serviceId);
  }

  private datosDeCondicion(
    tenant: TenantContext,
    serviceId: string,
    input: CrearCondicionInput,
    desde: CivilDate,
  ): Prisma.ServiceConditionUncheckedCreateInput {
    return {
      id: uuidv7(),
      userId: tenant.userId,
      serviceId,
      validFrom: desde.aPrisma(),
      validTo: null,
      amountMode: input.amountMode,
      baseAmount: input.baseAmount ? new Prisma.Decimal(input.baseAmount) : null,
      frequency: input.frequency,
      // Sin ancla explicita, el calendario de periodos arranca donde arranca
      // la condicion.
      periodAnchorDate: (input.periodAnchorDate
        ? CivilDate.parse(input.periodAnchorDate)
        : desde
      ).aPrisma(),
      dueDayOfMonth: input.dueDayOfMonth ?? null,
      dueDayPolicy: input.dueDayPolicy,
      secondDueDayOfMonth: input.secondDueDayOfMonth ?? null,
      secondDueSurcharge: input.secondDueSurcharge
        ? new Prisma.Decimal(input.secondDueSurcharge)
        : null,
      interestModel: input.interestModel,
      interestParams: (input.interestParams ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      changeReason: input.changeReason ?? null,
      notes: input.notes ?? null,
    };
  }

  private async asegurarPropiedad(tenant: TenantContext, id: string): Promise<void> {
    const existe = await this.prisma.service.findFirst({
      where: { id, userId: tenant.userId },
      select: { id: true },
    });
    if (!existe) throw this.noEncontrado();
  }

  private async validarCategoria(tenant: TenantContext, categoryId: string | null): Promise<void> {
    if (!categoryId) return;

    // Vale una categoria del sistema o una propia; nunca la de otro usuario.
    const categoria = await this.prisma.category.findFirst({
      where: { id: categoryId, OR: [{ userId: null }, { userId: tenant.userId }] },
      select: { id: true },
    });

    if (!categoria) {
      throw AppException.notFound('CATEGORY_NOT_FOUND', 'Esa categoría no existe');
    }
  }

  /** Siempre 404, nunca 403: un 403 confirmaria que el recurso existe. */
  private noEncontrado(): AppException {
    return AppException.notFound('SERVICE_NOT_FOUND', 'No encontramos ese servicio');
  }

  private aResumen(
    servicio: Service,
    vigente: ServiceCondition | null,
    categoria: { id: string; name: string; icon: string | null; colorHex: string | null } | null,
  ) {
    return {
      id: servicio.id,
      name: servicio.name,
      providerName: servicio.providerName,
      status: servicio.status,
      currency: servicio.currency,
      startDate: CivilDate.desdePrisma(servicio.startDate).toString(),
      debtPolicy: servicio.debtPolicy,
      archived: servicio.archivedAt !== null,
      category: categoria
        ? {
            id: categoria.id,
            name: categoria.name,
            icon: categoria.icon,
            color: categoria.colorHex,
          }
        : null,
      currentCondition: vigente ? this.aCondicion(vigente) : null,
    };
  }

  private aCondicion(c: ServiceCondition) {
    return {
      id: c.id,
      validFrom: CivilDate.desdePrisma(c.validFrom).toString(),
      validTo: c.validTo ? CivilDate.desdePrisma(c.validTo).toString() : null,
      amountMode: c.amountMode,
      // El dinero viaja como texto: un number perderia precision.
      baseAmount: c.baseAmount?.toFixed(2) ?? null,
      frequency: c.frequency,
      dueDayOfMonth: c.dueDayOfMonth,
      dueDayPolicy: c.dueDayPolicy,
      secondDueDayOfMonth: c.secondDueDayOfMonth,
      secondDueSurcharge: c.secondDueSurcharge?.toFixed(2) ?? null,
      interestModel: c.interestModel,
      interestParams: c.interestParams,
      changeReason: c.changeReason,
      notes: c.notes,
    };
  }
}
