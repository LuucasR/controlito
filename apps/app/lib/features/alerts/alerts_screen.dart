import 'package:flutter/material.dart';

import '../shared/pantalla_pendiente.dart';

class AlertsScreen extends StatelessWidget {
  const AlertsScreen({super.key});

  @override
  Widget build(BuildContext context) => const PantallaPendiente(
        titulo: 'Alertas',
        icono: Icons.notifications_outlined,
        etapa: 'Etapa 4',
        descripcion:
            'Cambios detectados: aumentos de monto, corrimientos de vencimiento, '
            'facturas faltantes y deuda incluida en una factura.',
      );
}
