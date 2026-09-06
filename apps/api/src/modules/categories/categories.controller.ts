import { Controller, Get } from '@nestjs/common';

import { PrismaService } from '@/infra/prisma/prisma.service';
import { UsuarioActual } from '@/modules/auth/decorators/current-user.decorator';
import type { TenantContext } from '@/modules/auth/tenant-context';

@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Las del sistema mas las propias del usuario. Nunca las de otro. */
  @Get()
  async listar(@UsuarioActual() tenant: TenantContext) {
    const categorias = await this.prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId: tenant.userId }], archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return categorias.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      color: c.colorHex,
      isSystem: c.isSystem,
    }));
  }
}
