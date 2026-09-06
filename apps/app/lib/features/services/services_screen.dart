import 'package:flutter/material.dart';

import '../shared/pantalla_pendiente.dart';

class ServicesScreen extends StatelessWidget {
  const ServicesScreen({super.key});

  @override
  Widget build(BuildContext context) => const PantallaPendiente(
        titulo: 'Servicios',
        icono: Icons.receipt_long_outlined,
        etapa: 'Etapa 2',
        descripcion:
            'Alta de servicios con sus condiciones versionadas: monto base, '
            'frecuencia, día de vencimiento, promoción y reglas de deuda e interés.',
      );
}
